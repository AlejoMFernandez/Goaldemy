import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'No autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const adminSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: sub } = await adminSupabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .eq('auto_renew', true)
      .maybeSingle()

    if (!sub) {
      return new Response(JSON.stringify({ error: 'No tenés una suscripción activa con renovación automática' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (sub.provider === 'mercadopago') {
      const accessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')
      if (!accessToken) throw new Error('MERCADOPAGO_ACCESS_TOKEN no configurado')
      const res = await fetch(`https://api.mercadopago.com/preapproval/${sub.provider_subscription_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ status: 'cancelled' }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || 'Error cancelando en Mercado Pago')
      }
    } else if (sub.provider === 'stripe') {
      const secretKey = Deno.env.get('STRIPE_SECRET_KEY')
      if (!secretKey) throw new Error('STRIPE_SECRET_KEY no configurado')
      const res = await fetch(`https://api.stripe.com/v1/subscriptions/${sub.provider_subscription_id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Basic ${btoa(secretKey + ':')}` },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error?.message || 'Error cancelando en Stripe')
      }
    }

    try {
      const { error: updateError } = await adminSupabase
        .from('subscriptions')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', sub.id)
      if (updateError) throw updateError
    } catch (dbError) {
      console.error('DB update failed after provider cancellation succeeded:', dbError)
      return new Response(JSON.stringify({
        error: 'La suscripción se canceló en ' + (sub.provider === 'stripe' ? 'Stripe' : 'Mercado Pago') + ' pero no pudimos actualizarlo localmente todavía; se sincronizará automáticamente en unos minutos.'
      }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('cancel-subscription error:', e)
    return new Response(JSON.stringify({ error: e.message || 'Error interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
