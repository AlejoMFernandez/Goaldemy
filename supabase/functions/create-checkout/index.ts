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

    const { plan_slug, provider, billing_email } = await req.json()
    if (!plan_slug || !provider) {
      return new Response(JSON.stringify({ error: 'Faltan parámetros' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Mail de facturación opcional: permite pagar con una cuenta de Mercado Pago
    // cuyo e-mail sea distinto al de Goaldemy. Si no viene o es inválido, usamos el de la cuenta.
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (billing_email && !emailRe.test(String(billing_email).trim())) {
      return new Response(JSON.stringify({ error: 'El e-mail de facturación no es válido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const payerEmail = billing_email ? String(billing_email).trim() : user.email

    const adminSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: plan } = await adminSupabase
      .from('plans')
      .select('*')
      .eq('slug', plan_slug)
      .single()

    if (!plan || plan.price_usd_cents === 0) {
      return new Response(JSON.stringify({ error: 'Plan inválido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const frontendUrl = Deno.env.get('FRONTEND_URL') || 'http://localhost:5173'
    let checkoutUrl = ''

    if (provider === 'mercadopago') {
      checkoutUrl = await createMercadoPagoCheckout(plan, user, frontendUrl, payerEmail)
    } else if (provider === 'stripe') {
      checkoutUrl = await createStripeCheckout(plan, user, frontendUrl)
    } else {
      return new Response(JSON.stringify({ error: 'Proveedor inválido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ url: checkoutUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('create-checkout error:', e)
    return new Response(JSON.stringify({ error: e.message || 'Error interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

async function createMercadoPagoCheckout(plan: any, user: any, frontendUrl: string, payerEmail: string) {
  const accessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')
  if (!accessToken) throw new Error('MERCADOPAGO_ACCESS_TOKEN no configurado')

  const body = {
    reason: `Goaldemy ${plan.name}`,
    auto_recurring: {
      frequency: 1,
      frequency_type: 'months',
      transaction_amount: plan.price_ars / 100,
      currency_id: 'ARS',
    },
    payer_email: payerEmail,
    back_url: `${frontendUrl}/pricing?result=mp`,
    external_reference: JSON.stringify({ user_id: user.id, plan_slug: plan.slug }),
  }

  const res = await fetch('https://api.mercadopago.com/preapproval', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.message || 'Error creando suscripción en MP')

  return data.init_point
}

async function createStripeCheckout(plan: any, user: any, frontendUrl: string) {
  const secretKey = Deno.env.get('STRIPE_SECRET_KEY')
  if (!secretKey) throw new Error('STRIPE_SECRET_KEY no configurado')

  const stripePriceId = plan.stripe_price_id
  if (!stripePriceId) throw new Error('stripe_price_id no configurado para este plan')

  const params = new URLSearchParams({
    'mode': 'subscription',
    'success_url': `${frontendUrl}/pricing?result=stripe&session_id={CHECKOUT_SESSION_ID}`,
    'cancel_url': `${frontendUrl}/pricing?result=cancelled`,
    'customer_email': user.email,
    'line_items[0][price]': stripePriceId,
    'line_items[0][quantity]': '1',
    'metadata[user_id]': user.id,
    'metadata[plan_slug]': plan.slug,
    'subscription_data[metadata][user_id]': user.id,
    'subscription_data[metadata][plan_slug]': plan.slug,
  })

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${btoa(secretKey + ':')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || 'Error creando sesión de Stripe')

  return data.url
}
