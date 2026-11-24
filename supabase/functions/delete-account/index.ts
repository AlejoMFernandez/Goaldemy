// delete-account — borrado COMPLETO de la cuenta del usuario que llama.
// (Requisito de Apple App Store 5.1.1(v): borrar la cuenta desde la app.)
//
// Flujo:
//  1. Verifica el JWT del usuario (Authorization: Bearer <access_token>).
//  2. Exige body { confirm: "BORRAR" } (la UI pide tipearlo).
//  3. Cancela la suscripción activa en Stripe / MercadoPago (para no seguir
//     cobrándole a una cuenta borrada). Si falla, ABORTA sin borrar nada.
//  4. Borra los archivos del usuario en Storage (carpeta "<uid>/" de cada bucket).
//  5. purge_user_data(uid) con service_role (parche 03): XP, logros, sesiones,
//     billetera, pase, DMs, amistades, perfil…
//  6. auth.admin.deleteUser(uid) → el resto cae por ON DELETE CASCADE.
//
// Deploy:  supabase functions deploy delete-account
// (verify_jwt queda en true por defecto: Supabase rechaza llamadas sin JWT válido.)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('FRONTEND_URL') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization') || ''
  const jwt = authHeader.replace(/^Bearer\s+/i, '')
  if (!jwt) return json({ error: 'No autenticado' }, 401)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })

  // 1) ¿Quién es? (valida firma y expiración del JWT contra Auth)
  const { data: { user }, error: authError } = await admin.auth.getUser(jwt)
  if (authError || !user) return json({ error: 'No autenticado' }, 401)
  const uid = user.id

  // 2) Confirmación explícita
  let body: any = {}
  try { body = await req.json() } catch { /* vacío */ }
  if (body?.confirm !== 'BORRAR') return json({ error: 'Falta la confirmación' }, 400)

  try {
    // 3) Cancelar suscripción paga
    await cancelProviderSubscription(admin, uid)

    // 4) Storage
    const removed = await deleteUserStorage(admin, uid)

    // 5) Datos de la app
    const { error: purgeError } = await admin.rpc('purge_user_data', { p_user_id: uid })
    if (purgeError) throw new Error(`purge_user_data: ${purgeError.message}`)
    // DMs explícitos (por si purge_user_data es la versión vieja en algún entorno)
    await admin.from('direct_messages').delete().or(`sender_id.eq.${uid},recipient_id.eq.${uid}`)

    // 6) Usuario de Auth
    const { error: delError } = await admin.auth.admin.deleteUser(uid)
    if (delError) throw new Error(`auth.admin.deleteUser: ${delError.message}`)

    console.log(`cuenta borrada ${uid} (archivos: ${removed})`)
    return json({ ok: true })
  } catch (e) {
    console.error('delete-account error:', uid, e)
    return json({ ok: false, error: 'No pudimos borrar la cuenta. Probá de nuevo o escribinos.' }, 500)
  }
})

async function cancelProviderSubscription(admin: SupabaseClient, uid: string) {
  const { data: sub } = await admin.from('subscriptions')
    .select('provider, provider_subscription_id, status, current_period_end')
    .eq('user_id', uid).maybeSingle()
  if (!sub?.provider_subscription_id) return
  if (sub.status !== 'active' && sub.status !== 'past_due') return

  if (sub.provider === 'stripe') {
    const key = Deno.env.get('STRIPE_SECRET_KEY')
    if (!key) throw new Error('STRIPE_SECRET_KEY no configurado')
    const res = await fetch(`https://api.stripe.com/v1/subscriptions/${sub.provider_subscription_id}`, {
      method: 'DELETE', headers: { Authorization: `Basic ${btoa(key + ':')}` },
    })
    // 404 = ya no existe en Stripe → nada que cancelar
    if (!res.ok && res.status !== 404) throw new Error(`Stripe cancel: ${res.status} ${await res.text()}`)
  } else if (sub.provider === 'mercadopago') {
    const token = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')
    if (!token) throw new Error('MERCADOPAGO_ACCESS_TOKEN no configurado')
    const res = await fetch(`https://api.mercadopago.com/preapproval/${sub.provider_subscription_id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    })
    if (!res.ok && res.status !== 404) throw new Error(`MP cancel: ${res.status} ${await res.text()}`)
  }
}

/** Borra todo lo que esté bajo "<uid>/" en cada bucket (recursivo). */
async function deleteUserStorage(admin: SupabaseClient, uid: string): Promise<number> {
  const { data: buckets, error } = await admin.storage.listBuckets()
  if (error) throw new Error(`listBuckets: ${error.message}`)
  let total = 0
  for (const b of buckets || []) {
    const paths = await listRecursive(admin, b.id, uid)
    for (let i = 0; i < paths.length; i += 100) {
      const chunk = paths.slice(i, i + 100)
      const { error: rmErr } = await admin.storage.from(b.id).remove(chunk)
      if (rmErr) throw new Error(`storage.remove(${b.id}): ${rmErr.message}`)
      total += chunk.length
    }
  }
  return total
}

async function listRecursive(admin: SupabaseClient, bucket: string, prefix: string, depth = 0): Promise<string[]> {
  if (depth > 5) return []
  const out: string[] = []
  let offset = 0
  for (;;) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000, offset })
    if (error) return out // carpeta inexistente → nada
    for (const item of data || []) {
      const path = `${prefix}/${item.name}`
      // Las "carpetas" vienen sin id
      if (item.id === null || item.id === undefined) out.push(...await listRecursive(admin, bucket, path, depth + 1))
      else out.push(path)
    }
    if (!data || data.length < 1000) break
    offset += 1000
  }
  return out
}
