// payment-webhook — Stripe + MercadoPago
//
// Cambios de seguridad (2026-11-24, ver supabase/pendientes/README.md):
//  • Stripe: la firma es OBLIGATORIA. Sin STRIPE_WEBHOOK_SECRET → 500 (mal
//    configurado); sin header o firma inválida → 400. Tolerancia de 5 min y
//    comparación en tiempo constante.
//  • Idempotencia por id de evento (tabla payment_webhook_events, parche 09).
//  • Renovaciones: Stripe invoice.paid / customer.subscription.updated|deleted;
//    MercadoPago subscription_authorized_payment + subscription_preapproval.
//    El fin de período sale del proveedor (no "hoy + 1 mes").
//  • MercadoPago: si está MERCADOPAGO_WEBHOOK_SECRET se valida x-signature.
//    Igual, el estado SIEMPRE se re-consulta a la API de MP con el access token,
//    así un payload falso no puede activar nada.
//
// Requiere aplicar antes supabase/pendientes/2026-11-24-09-webhook-idempotencia.sql.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature, x-signature, x-request-id',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const provider = new URL(req.url).searchParams.get('provider')
  try {
    if (provider === 'stripe') return await handleStripeWebhook(req)
    if (provider === 'mercadopago') return await handleMercadoPagoWebhook(req)
    return json({ error: 'Unknown provider' }, 400)
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500
    console.error('webhook error:', e)
    return json({ error: (e as Error).message }, status)
  }
})

let _admin: SupabaseClient | null = null
function admin(): SupabaseClient {
  if (!_admin) {
    _admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    })
  }
  return _admin
}

// ─── Idempotencia ────────────────────────────────────────────────────

async function withIdempotency(provider: string, eventId: string, type: string, fn: () => Promise<void>) {
  const { data: state, error } = await admin().rpc('webhook_event_begin', {
    p_provider: provider, p_event_id: eventId, p_type: type,
  })
  if (error) throw new Error(`webhook_event_begin: ${error.message}`)
  if (state === 'duplicate') return json({ received: true, duplicate: true })
  if (state === 'in_progress') return json({ error: 'in progress' }, 409) // el proveedor reintenta

  try {
    await fn()
  } catch (e) {
    await admin().rpc('webhook_event_finish', {
      p_provider: provider, p_event_id: eventId, p_ok: false, p_error: String((e as Error)?.message || e),
    })
    throw e // 500 → el proveedor reintenta
  }
  await admin().rpc('webhook_event_finish', { p_provider: provider, p_event_id: eventId, p_ok: true, p_error: null })
  return json({ received: true })
}

// ─── Operaciones sobre suscripciones ─────────────────────────────────

const iso = (unixSeconds?: number | null) => (unixSeconds ? new Date(unixSeconds * 1000).toISOString() : null)

async function activateSubscription(userId: string, planSlug: string, provider: string, providerId: string,
  periodStart: string, periodEnd: string) {
  const { error } = await admin().rpc('activate_subscription', {
    p_user_id: userId, p_plan_slug: planSlug, p_provider: provider, p_provider_id: providerId,
    p_period_start: periodStart, p_period_end: periodEnd,
  })
  if (error) throw new Error(`activate_subscription failed: ${error.message}`)
}

/** Extiende el período; si no existe la fila y tenemos user/plan, la crea. */
async function renewOrActivate(provider: string, providerId: string, periodStart: string | null, periodEnd: string,
  userId?: string | null, planSlug?: string | null) {
  const { data: touched, error } = await admin().rpc('renew_subscription_period', {
    p_provider: provider, p_provider_id: providerId, p_period_start: periodStart, p_period_end: periodEnd,
  })
  if (error) throw new Error(`renew_subscription_period failed: ${error.message}`)
  if ((touched ?? 0) > 0) return
  if (userId && planSlug) {
    await activateSubscription(userId, planSlug, provider, providerId, periodStart || new Date().toISOString(), periodEnd)
  } else {
    console.warn(`renovación sin suscripción local ni metadata (${provider} ${providerId})`)
  }
}

async function setStatus(providerId: string, status: 'active' | 'cancelled' | 'past_due' | 'expired', honorPaid = true) {
  const { error } = await admin().rpc('set_subscription_status', {
    p_provider_id: providerId, p_status: status, p_honor_paid_period: honorPaid,
  })
  if (error) throw new Error(`set_subscription_status failed: ${error.message}`)
}

async function planSlugFromStripePrice(priceId?: string | null): Promise<string | null> {
  if (!priceId) return null
  const { data } = await admin().from('plans').select('slug').eq('stripe_price_id', priceId).maybeSingle()
  return data?.slug ?? null
}

// ─── STRIPE ──────────────────────────────────────────────────────────

async function stripeGet(path: string) {
  const secretKey = Deno.env.get('STRIPE_SECRET_KEY')
  if (!secretKey) throw new Error('STRIPE_SECRET_KEY no configurado')
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Basic ${btoa(secretKey + ':')}` },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Stripe GET ${path}: ${data?.error?.message || res.status}`)
  return data
}

/** current_period_* vive en la suscripción (API vieja) o en el item (API 2025+). */
function stripePeriod(sub: any): { start: string | null; end: string | null } {
  const item = sub?.items?.data?.[0]
  return {
    start: iso(sub?.current_period_start ?? item?.current_period_start),
    end: iso(sub?.current_period_end ?? item?.current_period_end),
  }
}

async function syncStripeSubscription(sub: any) {
  const subId = String(sub.id)
  const { start, end } = stripePeriod(sub)
  const userId = sub.metadata?.user_id ?? null
  const planSlug = (await planSlugFromStripePrice(sub.items?.data?.[0]?.price?.id)) ?? sub.metadata?.plan_slug ?? null

  switch (sub.status) {
    case 'active':
    case 'trialing':
      if (!end) throw new Error(`Stripe sub ${subId} sin current_period_end`)
      await renewOrActivate('stripe', subId, start, end, userId, planSlug)
      if (planSlug) {
        // cambio de plan (upgrade/downgrade)
        await admin().from('subscriptions').update({ plan_slug: planSlug, updated_at: new Date().toISOString() })
          .eq('provider_subscription_id', subId)
      }
      break
    case 'past_due':
    case 'unpaid':
      await setStatus(subId, 'past_due')
      break
    case 'canceled':
      await setStatus(subId, 'cancelled', true)
      break
    case 'incomplete_expired':
      await setStatus(subId, 'expired', false)
      break
    default:
      console.log(`Stripe sub ${subId} status ${sub.status}: sin acción`)
  }
}

async function handleStripeWebhook(req: Request) {
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  if (!webhookSecret) throw new HttpError(500, 'STRIPE_WEBHOOK_SECRET no configurado')
  const sig = req.headers.get('stripe-signature')
  if (!sig) throw new HttpError(400, 'Missing signature')

  const body = await req.text()
  if (!(await verifyStripeSignature(body, sig, webhookSecret))) throw new HttpError(400, 'Invalid signature')

  const event = JSON.parse(body)
  if (!event?.id || !event?.type) throw new HttpError(400, 'Bad event')

  return await withIdempotency('stripe', String(event.id), String(event.type), async () => {
    const obj = event.data?.object ?? {}
    switch (event.type) {
      case 'checkout.session.completed': {
        if (obj.mode !== 'subscription' || !obj.subscription) return
        const userId = obj.metadata?.user_id
        const planSlug = obj.metadata?.plan_slug
        if (!userId || !planSlug) throw new Error('checkout sin metadata user_id/plan_slug')
        const sub = await stripeGet(`subscriptions/${obj.subscription}`)
        const { start, end } = stripePeriod(sub)
        if (!end) throw new Error('subscription sin current_period_end')
        await activateSubscription(userId, planSlug, 'stripe', String(obj.subscription), start || new Date().toISOString(), end)
        return
      }
      case 'invoice.paid':
      case 'invoice.payment_succeeded': {
        const subId = obj.subscription ?? obj.parent?.subscription_details?.subscription
        if (!subId) return
        await syncStripeSubscription(await stripeGet(`subscriptions/${subId}`))
        return
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        // Re-consultamos para no depender del orden de llegada de eventos
        await syncStripeSubscription(await stripeGet(`subscriptions/${obj.id}`))
        return
      case 'customer.subscription.deleted':
        await setStatus(String(obj.id), 'cancelled', true)
        return
      case 'invoice.payment_failed': {
        const subId = obj.subscription ?? obj.parent?.subscription_details?.subscription
        if (subId) await setStatus(String(subId), 'past_due')
        return
      }
      default:
        return // evento no usado: se marca como procesado
    }
  })
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function verifyStripeSignature(body: string, header: string, secret: string, toleranceSec = 300): Promise<boolean> {
  try {
    let timestamp = ''
    const v1: string[] = []
    for (const part of header.split(',')) {
      const idx = part.indexOf('=')
      if (idx < 0) continue
      const k = part.slice(0, idx).trim()
      const v = part.slice(idx + 1).trim()
      if (k === 't') timestamp = v
      if (k === 'v1') v1.push(v)
    }
    if (!timestamp || !v1.length) return false
    const age = Math.abs(Date.now() / 1000 - Number(timestamp))
    if (!Number.isFinite(age) || age > toleranceSec) return false
    const expected = await hmacHex(secret, `${timestamp}.${body}`)
    return v1.some((s) => timingSafeEqual(s, expected))
  } catch {
    return false
  }
}

// ─── MERCADO PAGO ────────────────────────────────────────────────────

async function mpGet(path: string) {
  const token = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')
  if (!token) throw new Error('MERCADOPAGO_ACCESS_TOKEN no configurado')
  const res = await fetch(`https://api.mercadopago.com/${path}`, { headers: { Authorization: `Bearer ${token}` } })
  const data = await res.json()
  if (!res.ok) throw new Error(`MP GET ${path}: ${data?.message || res.status}`)
  return data
}

/** Valida x-signature (ts=...,v1=...) si hay secreto configurado. */
async function verifyMercadoPagoSignature(req: Request, dataId: string): Promise<boolean> {
  const secret = Deno.env.get('MERCADOPAGO_WEBHOOK_SECRET')
  if (!secret) {
    console.warn('MERCADOPAGO_WEBHOOK_SECRET no configurado: se confía en la re-consulta a la API de MP')
    return true
  }
  const header = req.headers.get('x-signature') || ''
  const requestId = req.headers.get('x-request-id') || ''
  let ts = '', v1 = ''
  for (const part of header.split(',')) {
    const [k, v] = part.split('=').map((s) => s?.trim())
    if (k === 'ts') ts = v
    if (k === 'v1') v1 = v
  }
  if (!ts || !v1) return false
  const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId
  let manifest = ''
  if (id) manifest += `id:${id};`
  if (requestId) manifest += `request-id:${requestId};`
  manifest += `ts:${ts};`
  return timingSafeEqual(await hmacHex(secret, manifest), v1)
}

function parseRef(ref: unknown): { user_id?: string; plan_slug?: string } {
  try { return JSON.parse(String(ref || '{}')) } catch { return {} }
}

/** Fin de período real de un preapproval: próximo cobro + 2 días de gracia. */
function mpPeriodEnd(pre: any): string {
  const GRACE_MS = 2 * 86400000
  if (pre?.next_payment_date) return new Date(new Date(pre.next_payment_date).getTime() + GRACE_MS).toISOString()
  // Fallback: último cobro (o alta) + frecuencia
  const base = new Date(pre?.last_modified || pre?.date_created || Date.now())
  const freq = Number(pre?.auto_recurring?.frequency || 1)
  if (pre?.auto_recurring?.frequency_type === 'days') base.setDate(base.getDate() + freq)
  else base.setMonth(base.getMonth() + freq)
  return new Date(base.getTime() + GRACE_MS).toISOString()
}

async function syncPreapproval(preapprovalId: string) {
  const pre = await mpGet(`preapproval/${preapprovalId}`)
  const ref = parseRef(pre.external_reference)
  switch (pre.status) {
    case 'authorized':
      await renewOrActivate('mercadopago', preapprovalId, new Date().toISOString(), mpPeriodEnd(pre), ref.user_id, ref.plan_slug)
      break
    case 'paused':
      await setStatus(preapprovalId, 'past_due')
      break
    case 'cancelled':
      await setStatus(preapprovalId, 'cancelled', true)
      break
    default:
      console.log(`MP preapproval ${preapprovalId} status ${pre.status}: sin acción`)
  }
}

async function handleMercadoPagoWebhook(req: Request) {
  const url = new URL(req.url)
  let body: any = {}
  try { body = await req.json() } catch { /* MP a veces manda solo query params */ }

  const type = String(body.type || body.topic || url.searchParams.get('type') || url.searchParams.get('topic') || '')
  const dataId = String(body.data?.id ?? url.searchParams.get('data.id') ?? body.id ?? url.searchParams.get('id') ?? '')
  if (!dataId) throw new HttpError(400, 'No data id')

  if (!(await verifyMercadoPagoSignature(req, dataId))) throw new HttpError(400, 'Invalid signature')

  // Id de evento: el de la notificación si viene; si no, uno compuesto.
  const eventId = String(body.id && body.data?.id ? body.id : `${type}:${dataId}:${body.action || ''}:${req.headers.get('x-request-id') || ''}`)

  return await withIdempotency('mercadopago', eventId, type, async () => {
    if (type === 'subscription_preapproval' || type === 'preapproval') {
      await syncPreapproval(dataId)
    } else if (type === 'subscription_authorized_payment' || type === 'authorized_payment') {
      // Cada cobro recurrente: si salió aprobado, extendemos según el preapproval.
      const ap = await mpGet(`authorized_payments/${dataId}`)
      const preapprovalId = ap.preapproval_id ? String(ap.preapproval_id) : ''
      const payStatus = ap.payment?.status || ap.status
      if (!preapprovalId) throw new Error(`authorized_payment ${dataId} sin preapproval_id`)
      if (payStatus === 'approved' || payStatus === 'processed') {
        await syncPreapproval(preapprovalId)
      } else {
        console.log(`MP authorized_payment ${dataId} status ${payStatus}: sin acción (MP reintenta el cobro)`)
      }
    }
    // otros tópicos (payment suelto, etc.): no se usan
  })
}
