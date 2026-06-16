import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const provider = url.searchParams.get('provider')

  try {
    if (provider === 'stripe') {
      return await handleStripeWebhook(req)
    } else if (provider === 'mercadopago') {
      return await handleMercadoPagoWebhook(req)
    }
    return new Response('Unknown provider', { status: 400, headers: corsHeaders })
  } catch (e) {
    console.error('webhook error:', e)
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

function getAdminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
}

async function activateSubscription(
  userId: string, planSlug: string, provider: string,
  providerId: string, periodStart: string, periodEnd: string,
) {
  const supabase = getAdminClient()
  const { error } = await supabase.rpc('activate_subscription', {
    p_user_id: userId,
    p_plan_slug: planSlug,
    p_provider: provider,
    p_provider_id: providerId,
    p_period_start: periodStart,
    p_period_end: periodEnd,
  })
  if (error) throw new Error(`activate_subscription failed: ${error.message}`)
}

async function cancelSubscription(providerId: string) {
  const supabase = getAdminClient()
  const { error } = await supabase
    .from('subscriptions')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('provider_subscription_id', providerId)
  if (error) console.error('cancel failed:', error)
}

// ─── STRIPE ──────────────────────────────────────────────

async function handleStripeWebhook(req: Request) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

  if (webhookSecret && sig) {
    const isValid = await verifyStripeSignature(body, sig, webhookSecret)
    if (!isValid) {
      return new Response('Invalid signature', { status: 400, headers: corsHeaders })
    }
  }

  const event = JSON.parse(body)

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    if (session.mode === 'subscription') {
      const userId = session.metadata?.user_id
      const planSlug = session.metadata?.plan_slug
      const subscriptionId = session.subscription

      if (userId && planSlug && subscriptionId) {
        const secretKey = Deno.env.get('STRIPE_SECRET_KEY')!
        const subRes = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
          headers: { 'Authorization': `Basic ${btoa(secretKey + ':')}` },
        })
        const sub = await subRes.json()

        await activateSubscription(
          userId, planSlug, 'stripe', subscriptionId,
          new Date(sub.current_period_start * 1000).toISOString(),
          new Date(sub.current_period_end * 1000).toISOString(),
        )
      }
    }
  } else if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object
    await cancelSubscription(sub.id)
  } else if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object
    if (invoice.subscription) {
      const supabase = getAdminClient()
      await supabase
        .from('subscriptions')
        .update({ status: 'past_due', updated_at: new Date().toISOString() })
        .eq('provider_subscription_id', invoice.subscription)
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function verifyStripeSignature(body: string, sig: string, secret: string): Promise<boolean> {
  try {
    const parts = Object.fromEntries(sig.split(',').map(p => {
      const [k, v] = p.split('=')
      return [k, v]
    }))
    const timestamp = parts['t']
    const expectedSig = parts['v1']
    if (!timestamp || !expectedSig) return false

    const payload = `${timestamp}.${body}`
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    )
    const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
    const hex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('')
    return hex === expectedSig
  } catch {
    return false
  }
}

// ─── MERCADO PAGO ────────────────────────────────────────

async function handleMercadoPagoWebhook(req: Request) {
  const body = await req.json()
  const type = body.type || body.topic

  if (type === 'subscription_preapproval' || type === 'preapproval') {
    const preapprovalId = body.data?.id || body.id
    if (!preapprovalId) {
      return new Response('No preapproval id', { status: 400, headers: corsHeaders })
    }

    const accessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')!
    const res = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    })
    const preapproval = await res.json()

    if (preapproval.status === 'authorized') {
      let ref: any = {}
      try { ref = JSON.parse(preapproval.external_reference || '{}') } catch {}

      const userId = ref.user_id
      const planSlug = ref.plan_slug

      if (userId && planSlug) {
        const now = new Date()
        const periodEnd = new Date(now)
        periodEnd.setMonth(periodEnd.getMonth() + 1)

        await activateSubscription(
          userId, planSlug, 'mercadopago', String(preapprovalId),
          now.toISOString(), periodEnd.toISOString(),
        )
      }
    } else if (preapproval.status === 'cancelled' || preapproval.status === 'paused') {
      await cancelSubscription(String(preapprovalId))
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
