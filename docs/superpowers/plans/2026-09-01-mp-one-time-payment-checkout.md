# Pago único de MercadoPago + checkout de 2 columnas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a one-time-payment option to the existing MercadoPago recurring-subscription flow, move plan checkout from a modal into a dedicated two-column `/checkout` page, add in-app subscription cancellation, and close the webhook-signature and legal-pages gaps found in the pre-work audit.

**Architecture:** Two Supabase Edge Functions get extended (`create-checkout` gains a `billing_type` branch that calls MercadoPago's Checkout Pro `/checkout/preferences` instead of `/preapproval`; `payment-webhook` gains signature verification and a `payment`-topic handler). A new `cancel-subscription` Edge Function wraps MP's cancel-preapproval call. The DB gains one column (`subscriptions.auto_renew`) and an updated `get_user_plan`/`activate_subscription` pair. The frontend gets one new page (`Checkout.vue`), one new shared component (`SubscriptionStatusCard.vue`), and three new static legal pages — no existing page is restructured beyond removing the old confirmation modal from `Pricing.vue`.

**Tech Stack:** Vue 3 (`<script setup>` for new files, matching `PlanCard.vue`/`Pricing.vue`), Supabase Postgres (SQL migration, `SECURITY DEFINER` RPCs) + Supabase Edge Functions (Deno), MercadoPago REST API (`/preapproval`, `/checkout/preferences`, `/v1/payments`). No automated test runner exists in this project (`package.json` has no `vitest`/`jest`) — every task's verification step is either a Supabase SQL check (via the `mcp__plugin_supabase_supabase__execute_sql` tool), `npx vite build --mode development` for frontend sanity, or a manual browser/curl check, matching how `docs/superpowers/plans/2026-08-28-prode.md` validated the last feature in this codebase.

**Spec:** `docs/superpowers/specs/2026-09-01-mp-one-time-payment-checkout-design.md`

## Global Constraints

- Pago único y débito automático cobran el **mismo precio** (`plans.price_ars`) — no se agrega ningún campo de precio nuevo.
- Pago único = `auto_renew = false`, dura exactamente 1 mes, sin renovación. `get_user_plan()` ya baja a Free solo cuando `current_period_end < now()` — no se toca esa lógica.
- Stripe **no se modifica** en esta plan — no está expuesto en la UI (`Pricing.vue` hardcodea `provider: 'mercadopago'`) y el pago único no se implementa para Stripe.
- Cobros recurrentes de MP fallidos (topic `payment` asociado a un `preapproval`) quedan **fuera de alcance** — el handler nuevo de `payment` solo actúa sobre pagos `one_time`, ignora el resto.
- Todo el contenido legal nuevo es **DRAFT** y debe llevar un aviso visible de "pendiente de revisión legal" — no es asesoramiento legal.
- Todo el texto de UI en español, tono consistente con el resto de la app (ver `Pricing.vue`, `AboutObjective.vue`).
- No se toca el modal de `Pricing.vue` línea por línea — se elimina entero y se reemplaza por navegación a `/checkout`.

---

### Task 1: Migración de base de datos — `auto_renew` + RPCs

**Files:**
- Create: `supabase/mp-one-time-payment.sql`

**Interfaces:**
- Produces: columna `public.subscriptions.auto_renew BOOLEAN NOT NULL DEFAULT true`; función `public.activate_subscription(p_user_id UUID, p_plan_slug TEXT, p_provider TEXT, p_provider_id TEXT, p_period_start TIMESTAMPTZ, p_period_end TIMESTAMPTZ, p_auto_renew BOOLEAN DEFAULT true) RETURNS VOID`; función `public.get_user_plan(p_user_id UUID DEFAULT NULL) RETURNS JSON` — mismo shape que hoy (`plan`, `planName`, `status`, `dailyChallengesPerGame`, `dailyPowerups`, `xpMultiplier`, `badge`, `periodEnd`, `powerups`) más una clave nueva `autoRenew` (boolean, `true` si no hay suscripción o es plan Free).

- [ ] **Step 1: Escribir la migración**

```sql
-- ============================================================
-- FULVO — PAGO ÚNICO DE MERCADOPAGO
-- Corre esto en el SQL Editor de Supabase, DESPUÉS de premium-schema.sql
-- ============================================================

-- 1. Columna nueva: distingue suscripción con renovación automática
--    (débito automático) de pago único (vence solo, sin recobro).
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN NOT NULL DEFAULT true;

-- 2. activate_subscription: gana p_auto_renew (default true, no rompe
--    a los callers existentes del webhook que todavía no lo pasan).
CREATE OR REPLACE FUNCTION public.activate_subscription(
  p_user_id UUID,
  p_plan_slug TEXT,
  p_provider TEXT,
  p_provider_id TEXT,
  p_period_start TIMESTAMPTZ,
  p_period_end TIMESTAMPTZ,
  p_auto_renew BOOLEAN DEFAULT true
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, plan_slug, status, provider, provider_subscription_id, current_period_start, current_period_end, auto_renew, updated_at)
  VALUES (p_user_id, p_plan_slug, 'active', p_provider, p_provider_id, p_period_start, p_period_end, p_auto_renew, now())
  ON CONFLICT (user_id) DO UPDATE SET
    plan_slug = EXCLUDED.plan_slug,
    status = 'active',
    provider = EXCLUDED.provider,
    provider_subscription_id = EXCLUDED.provider_subscription_id,
    current_period_start = EXCLUDED.current_period_start,
    current_period_end = EXCLUDED.current_period_end,
    auto_renew = EXCLUDED.auto_renew,
    updated_at = now();

  DECLARE
    plan RECORD;
  BEGIN
    SELECT * INTO plan FROM public.plans WHERE slug = p_plan_slug;
    UPDATE public.powerup_inventory SET
      fifty_fifty = plan.daily_powerups,
      shield = plan.daily_powerups,
      extra_time = plan.daily_powerups,
      reveal_hint = plan.daily_powerups,
      streak_protector = plan.weekly_streak_protectors,
      last_daily_reset = CURRENT_DATE,
      last_weekly_reset = CURRENT_DATE
    WHERE user_id = p_user_id;
  END;
END;
$$;

-- 3. get_user_plan: agrega "autoRenew" al JSON de salida.
CREATE OR REPLACE FUNCTION public.get_user_plan(p_user_id UUID DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  uid UUID;
  sub RECORD;
  plan RECORD;
  inv RECORD;
  result JSON;
BEGIN
  uid := COALESCE(p_user_id, auth.uid());
  IF uid IS NULL THEN
    RETURN json_build_object('plan', 'free', 'status', 'active', 'autoRenew', true);
  END IF;

  SELECT * INTO sub FROM public.subscriptions
    WHERE user_id = uid AND status = 'active'
    LIMIT 1;

  IF sub IS NOT NULL AND sub.plan_slug != 'free' AND sub.current_period_end IS NOT NULL AND sub.current_period_end < now() THEN
    UPDATE public.subscriptions SET status = 'expired', updated_at = now() WHERE id = sub.id;
    sub.plan_slug := 'free';
    sub.status := 'expired';
  END IF;

  SELECT * INTO plan FROM public.plans WHERE slug = COALESCE(sub.plan_slug, 'free');

  INSERT INTO public.powerup_inventory (user_id) VALUES (uid) ON CONFLICT DO NOTHING;
  SELECT * INTO inv FROM public.powerup_inventory WHERE user_id = uid;

  IF inv.last_daily_reset < CURRENT_DATE THEN
    UPDATE public.powerup_inventory SET
      fifty_fifty = plan.daily_powerups,
      shield = plan.daily_powerups,
      extra_time = plan.daily_powerups,
      reveal_hint = plan.daily_powerups,
      last_daily_reset = CURRENT_DATE
    WHERE user_id = uid;
    SELECT * INTO inv FROM public.powerup_inventory WHERE user_id = uid;
  END IF;

  IF inv.last_weekly_reset < (CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::int) THEN
    UPDATE public.powerup_inventory SET
      streak_protector = plan.weekly_streak_protectors,
      last_weekly_reset = CURRENT_DATE
    WHERE user_id = uid;
    SELECT * INTO inv FROM public.powerup_inventory WHERE user_id = uid;
  END IF;

  result := json_build_object(
    'plan', COALESCE(sub.plan_slug, 'free'),
    'planName', plan.name,
    'status', COALESCE(sub.status, 'active'),
    'dailyChallengesPerGame', plan.daily_challenges_per_game,
    'dailyPowerups', plan.daily_powerups,
    'xpMultiplier', plan.xp_multiplier,
    'badge', plan.badge,
    'periodEnd', sub.current_period_end,
    'autoRenew', COALESCE(sub.auto_renew, true),
    'powerups', json_build_object(
      'fiftyFifty', inv.fifty_fifty,
      'shield', inv.shield,
      'extraTime', inv.extra_time,
      'revealHint', inv.reveal_hint,
      'streakProtector', inv.streak_protector
    )
  );

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_plan TO authenticated;
```

- [ ] **Step 2: Correr la migración con el MCP de Supabase**

Usar `mcp__plugin_supabase_supabase__apply_migration` con el nombre `mp_one_time_payment` y el SQL de arriba (o pedirle al owner que lo corra en el SQL Editor si no hay proyecto conectado por MCP en este entorno).

- [ ] **Step 3: Verificar que la columna y las funciones existen**

Correr con `mcp__plugin_supabase_supabase__execute_sql`:
```sql
SELECT column_name FROM information_schema.columns
  WHERE table_name = 'subscriptions' AND column_name = 'auto_renew';
SELECT proname, pronargs FROM pg_proc WHERE proname = 'activate_subscription';
```
Expected: una fila con `auto_renew`; `activate_subscription` con `pronargs = 7`.

- [ ] **Step 4: Verificar `get_user_plan` con un usuario free**

```sql
SELECT public.get_user_plan('00000000-0000-0000-0000-000000000000'::uuid);
```
Expected: `{"plan":"free","status":"active","autoRenew":true}` (uid inexistente → user null → rama temprana).

- [ ] **Step 5: Commit**

```bash
git add supabase/mp-one-time-payment.sql
git commit -m "feat: agregar auto_renew a subscriptions para pago único de MP"
```

---

### Task 2: `create-checkout` — pago único vía Checkout Pro

**Files:**
- Modify: `supabase/functions/create-checkout/index.ts`

**Interfaces:**
- Consumes: `plan.slug`, `plan.name`, `plan.price_ars` (de la tabla `plans`, ya cargados en `index.ts:50-60`).
- Produces: el body de la request ahora acepta `billing_type: 'recurring' | 'one_time'` (opcional, default `'recurring'`); nueva función `createMercadoPagoOneTimePayment(plan, user, frontendUrl, payerEmail): Promise<string>` (devuelve `init_point`), misma firma que `createMercadoPagoCheckout`.

- [ ] **Step 1: Leer `billing_type` del body y validarlo**

En `index.ts`, reemplazar la línea 28 (`const { plan_slug, provider, billing_email } = await req.json()`) por:

```typescript
    const { plan_slug, provider, billing_email, billing_type } = await req.json()
    const billingType = billing_type === 'one_time' ? 'one_time' : 'recurring'
```

- [ ] **Step 2: Ramificar `createMercadoPagoCheckout` según `billingType`**

Reemplazar la línea `checkoutUrl = await createMercadoPagoCheckout(plan, user, frontendUrl, payerEmail)` por:

```typescript
      checkoutUrl = billingType === 'one_time'
        ? await createMercadoPagoOneTimePayment(plan, user, frontendUrl, payerEmail)
        : await createMercadoPagoCheckout(plan, user, frontendUrl, payerEmail)
```

- [ ] **Step 3: Cambiar el `back_url` de la suscripción recurrente para que apunte a `/checkout`**

En `createMercadoPagoCheckout`, reemplazar:
```typescript
    back_url: `${frontendUrl}/pricing?result=mp`,
```
por:
```typescript
    back_url: `${frontendUrl}/checkout?plan=${plan.slug}&result=mp`,
```
(La página `/checkout` se crea en la Task 8; hasta que esa task se complete esta URL 404ea, aceptable en un plan de varias tasks secuenciales.)

- [ ] **Step 4: Agregar `createMercadoPagoOneTimePayment`**

Agregar al final del archivo, después de `createMercadoPagoCheckout`:

```typescript
async function createMercadoPagoOneTimePayment(plan: any, user: any, frontendUrl: string, payerEmail: string) {
  const accessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')
  if (!accessToken) throw new Error('MERCADOPAGO_ACCESS_TOKEN no configurado')

  const body = {
    items: [{
      title: `Fulvo ${plan.name} (1 mes)`,
      quantity: 1,
      unit_price: plan.price_ars / 100,
      currency_id: 'ARS',
    }],
    payer: { email: payerEmail },
    back_urls: {
      success: `${frontendUrl}/checkout?plan=${plan.slug}&result=mp_ok`,
      failure: `${frontendUrl}/checkout?plan=${plan.slug}&result=mp_fail`,
      pending: `${frontendUrl}/checkout?plan=${plan.slug}&result=mp_pending`,
    },
    auto_return: 'approved',
    external_reference: JSON.stringify({ user_id: user.id, plan_slug: plan.slug, billing_type: 'one_time' }),
  }

  const res = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.message || 'Error creando pago único en MP')

  return data.init_point
}
```

- [ ] **Step 5: Deploy y verificación manual**

Deploy: `supabase functions deploy create-checkout` (o pedirle al owner que lo corra si el entorno no tiene la CLI de Supabase autenticada).

Verificar con curl (reemplazando `<ANON_KEY>` y `<JWT_DE_UN_USUARIO_LOGUEADO>` por valores reales de un usuario de test, y usando credenciales de **sandbox** de MP):
```bash
curl -X POST 'https://<project-ref>.supabase.co/functions/v1/create-checkout' \
  -H 'Authorization: Bearer <JWT_DE_UN_USUARIO_LOGUEADO>' \
  -H 'apikey: <ANON_KEY>' \
  -H 'Content-Type: application/json' \
  -d '{"plan_slug":"pro","provider":"mercadopago","billing_type":"one_time"}'
```
Expected: `{"url":"https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=..."}` (o `.com.ar/checkout/...` de sandbox). Confirmar también que `billing_type` ausente (payload sin ese campo) sigue devolviendo una URL de `/preapproval` como antes — regresión.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/create-checkout/index.ts
git commit -m "feat: agregar pago único de MercadoPago a create-checkout"
```

---

### Task 3: `payment-webhook` — firma de MP + topic `payment`

**Files:**
- Modify: `supabase/functions/payment-webhook/index.ts`

**Interfaces:**
- Consumes: `activate_subscription` RPC (Task 1) con el nuevo parámetro `p_auto_renew`.
- Produces: función `verifyMercadoPagoSignature(req: Request, secret: string): Promise<boolean>`.

- [ ] **Step 1: Agregar `verifyMercadoPagoSignature`**

Agregar cerca de `verifyStripeSignature` (después de la línea 141):

```typescript
async function verifyMercadoPagoSignature(req: Request, secret: string): Promise<boolean> {
  try {
    const sig = req.headers.get('x-signature')
    const requestId = req.headers.get('x-request-id')
    if (!sig || !requestId) return false

    const parts = Object.fromEntries(sig.split(',').map(p => {
      const [k, v] = p.split('=')
      return [k?.trim(), v?.trim()]
    }))
    const ts = parts['ts']
    const expectedSig = parts['v1']
    if (!ts || !expectedSig) return false

    const url = new URL(req.url)
    const dataId = (url.searchParams.get('data.id') || '').toLowerCase()

    const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    )
    const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(manifest))
    const hex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('')
    return hex === expectedSig
  } catch {
    return false
  }
}
```

- [ ] **Step 2: Llamar a la validación al principio de `handleMercadoPagoWebhook`**

Reemplazar el inicio de la función (línea 145-146):
```typescript
async function handleMercadoPagoWebhook(req: Request) {
  const body = await req.json()
  const type = body.type || body.topic
```
por:
```typescript
async function handleMercadoPagoWebhook(req: Request) {
  const webhookSecret = Deno.env.get('MERCADOPAGO_WEBHOOK_SECRET')
  if (webhookSecret) {
    const isValid = await verifyMercadoPagoSignature(req, webhookSecret)
    if (!isValid) {
      return new Response('Invalid signature', { status: 401, headers: corsHeaders })
    }
  }

  const body = await req.json()
  const type = body.type || body.topic
```

(Se guarda detrás de `if (webhookSecret)` a propósito: mientras el owner no configure el secret en el panel de MP y como env var, el webhook sigue funcionando como hoy — sin bloquear producción a mitad de esta plan. Una vez configurado, la validación queda activa.)

- [ ] **Step 3: Manejar el topic `payment` para pagos únicos**

Agregar, dentro de `handleMercadoPagoWebhook`, junto al `if (type === 'subscription_preapproval' || type === 'preapproval')` existente (después de su bloque `if/else if`, antes del `return` final):

```typescript
  } else if (type === 'payment') {
    const paymentId = body.data?.id || body.id
    if (!paymentId) {
      return new Response('No payment id', { status: 400, headers: corsHeaders })
    }

    const accessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')!
    const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    })
    const payment = await res.json()

    let ref: any = {}
    try { ref = JSON.parse(payment.external_reference || '{}') } catch {}

    if (payment.status === 'approved' && ref.billing_type === 'one_time' && ref.user_id && ref.plan_slug) {
      const now = new Date()
      const periodEnd = new Date(now)
      periodEnd.setMonth(periodEnd.getMonth() + 1)

      await activateSubscription(
        ref.user_id, ref.plan_slug, 'mercadopago', String(paymentId),
        now.toISOString(), periodEnd.toISOString(),
      )
    }
  }
```

Nota: `type === 'payment'` incluye cobros recurrentes de un `preapproval` (esos no tienen `billing_type: 'one_time'` en su `external_reference`, porque `createMercadoPagoCheckout` no lo setea) — la condición `ref.billing_type === 'one_time'` los descarta correctamente, sin necesidad de una rama `else` explícita.

- [ ] **Step 4: Propagar `auto_renew` en `activateSubscription`**

`activateSubscription` (línea 39-53) ya llama al RPC — agregarle el parámetro nuevo con default `true` para no romper el call site de `preapproval` (que sigue siendo recurrente):

```typescript
async function activateSubscription(
  userId: string, planSlug: string, provider: string,
  providerId: string, periodStart: string, periodEnd: string,
  autoRenew: boolean = true,
) {
  const supabase = getAdminClient()
  const { error } = await supabase.rpc('activate_subscription', {
    p_user_id: userId,
    p_plan_slug: planSlug,
    p_provider: provider,
    p_provider_id: providerId,
    p_period_start: periodStart,
    p_period_end: periodEnd,
    p_auto_renew: autoRenew,
  })
  if (error) throw new Error(`activate_subscription failed: ${error.message}`)
}
```

Y en el bloque de Step 3, pasar `false` explícito:
```typescript
      await activateSubscription(
        ref.user_id, ref.plan_slug, 'mercadopago', String(paymentId),
        now.toISOString(), periodEnd.toISOString(), false,
      )
```

- [ ] **Step 5: Deploy y verificación manual**

Deploy: `supabase functions deploy payment-webhook`.

Verificar rechazo de firma inválida (con `MERCADOPAGO_WEBHOOK_SECRET` ya configurado como secret — si todavía no está, este paso se pospone a la Task 12):
```bash
curl -i -X POST 'https://<project-ref>.supabase.co/functions/v1/payment-webhook?provider=mercadopago&data.id=123' \
  -H 'x-signature: ts=1,v1=deadbeef' -H 'x-request-id: test' \
  -H 'Content-Type: application/json' -d '{"type":"payment","data":{"id":"123"}}'
```
Expected: `401 Invalid signature`.

Simular un pago único (sandbox de MP, usuario y `checkout/preferences` de la Task 2), completar el pago, y confirmar en la tabla `subscriptions` que aparece la fila con `provider = 'mercadopago'`, `auto_renew = false`, `current_period_end` ≈ hoy + 1 mes:
```sql
SELECT plan_slug, provider, auto_renew, current_period_end FROM public.subscriptions WHERE user_id = '<uid-de-test>';
```

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/payment-webhook/index.ts
git commit -m "feat: validar firma de MP y manejar pagos únicos en payment-webhook"
```

---

### Task 4: Edge function `cancel-subscription`

**Files:**
- Create: `supabase/functions/cancel-subscription/index.ts`

**Interfaces:**
- Consumes: tabla `subscriptions` (columnas `provider`, `provider_subscription_id`, `auto_renew`, `status`).
- Produces: endpoint `POST /functions/v1/cancel-subscription` (sin body), requiere `Authorization` de un usuario logueado. Responde `{ ok: true }` o `{ error: string }`.

- [ ] **Step 1: Escribir el edge function**

```typescript
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

    const { error: updateError } = await adminSupabase
      .from('subscriptions')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', sub.id)
    if (updateError) throw updateError

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
```

- [ ] **Step 2: Deploy**

`supabase functions deploy cancel-subscription`.

- [ ] **Step 3: Verificación manual**

Con un usuario de test que tenga una suscripción activa (`auto_renew = true`) creada en la Task 2/3, invocar:
```bash
curl -X POST 'https://<project-ref>.supabase.co/functions/v1/cancel-subscription' \
  -H 'Authorization: Bearer <JWT_DE_ESE_USUARIO>' -H 'apikey: <ANON_KEY>'
```
Expected: `{"ok":true}`. Confirmar en SQL que la fila pasó a `status = 'cancelled'`, y en el panel de MercadoPago (sandbox) que el `preapproval` correspondiente quedó `cancelled`.

Repetir el mismo curl con un usuario sin suscripción activa. Expected: `400` con `"No tenés una suscripción activa..."`.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/cancel-subscription/index.ts
git commit -m "feat: agregar edge function cancel-subscription"
```

---

### Task 5: `src/services/premium.js` — defaults de `autoRenew`

**Files:**
- Modify: `src/services/premium.js`

**Interfaces:**
- Produces: `getUserPlan()` ahora siempre incluye `autoRenew: boolean` en su resultado (consumido por la Task 7).

- [ ] **Step 1: Agregar `autoRenew` a `PLAN_DEFAULTS`**

En `premium.js:8-18`, agregar la clave:
```javascript
const PLAN_DEFAULTS = {
  plan: 'free',
  planName: 'Free',
  status: 'active',
  dailyChallengesPerGame: 1,
  dailyPowerups: 1,
  xpMultiplier: 1.0,
  badge: null,
  periodEnd: null,
  autoRenew: true,
  powerups: { fiftyFifty: 0, shield: 0, extraTime: 0, revealHint: 0, streakProtector: 0 },
}
```

(El spread `{ ...PLAN_DEFAULTS, ...data }` en `getUserPlan` ya toma automáticamente el `autoRenew` real que devuelve el RPC de la Task 1 — no hace falta tocar el resto de la función.)

- [ ] **Step 2: Verificación**

`npx vite build --mode development`. Expected: build sin errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add src/services/premium.js
git commit -m "feat: agregar autoRenew a los defaults de plan"
```

---

### Task 6: `src/services/checkout.js` — `billing_type`, `cancelSubscription`, retorno nuevo

**Files:**
- Modify: `src/services/checkout.js`

**Interfaces:**
- Produces: `startCheckout(planSlug: string, provider = 'mercadopago', billingEmail = null, billingType = 'recurring'): Promise<void>`; `cancelSubscription(): Promise<void>` (lanza `Error` si falla); `handleReturnFromCheckout(): Promise<{status: 'success'|'cancelled'|'pending', provider?: string} | null>` (mismo shape que hoy, más el estado `'pending'` nuevo).

- [ ] **Step 1: `startCheckout` acepta `billingType`**

Reemplazar todo el archivo por:

```javascript
import { supabase } from './supabase'
import { getAuthUser } from './auth'
import { invalidatePlanCache } from './premium'

export async function startCheckout(planSlug, provider = 'mercadopago', billingEmail = null, billingType = 'recurring') {
  const { id } = getAuthUser() || {}
  if (!id) throw new Error('No autenticado')

  const body = { plan_slug: planSlug, provider, billing_type: billingType }
  if (billingEmail) body.billing_email = billingEmail

  const { data, error } = await supabase.functions.invoke('create-checkout', {
    body,
  })

  if (error) throw new Error(error.message || 'Error al crear checkout')
  if (data?.error) throw new Error(data.error)
  if (!data?.url) throw new Error('No se recibió URL de checkout')

  window.location.href = data.url
}

export async function cancelSubscription() {
  const { id } = getAuthUser() || {}
  if (!id) throw new Error('No autenticado')

  const { data, error } = await supabase.functions.invoke('cancel-subscription', { body: {} })

  if (error) throw new Error(error.message || 'Error al cancelar la suscripción')
  if (data?.error) throw new Error(data.error)

  invalidatePlanCache()
}

export async function handleReturnFromCheckout() {
  const params = new URLSearchParams(window.location.search)
  const result = params.get('result')

  if (!result) return null

  if (result === 'cancelled' || result === 'mp_fail') {
    return { status: 'cancelled' }
  }
  if (result === 'mp_pending') {
    return { status: 'pending', provider: 'mercadopago' }
  }

  invalidatePlanCache()

  if (result === 'stripe') {
    return { status: 'success', provider: 'stripe' }
  }
  if (result === 'mp' || result === 'mp_ok') {
    return { status: 'success', provider: 'mercadopago' }
  }

  return null
}
```

- [ ] **Step 2: Verificación**

`npx vite build --mode development`. Expected: build sin errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add src/services/checkout.js
git commit -m "feat: soportar billing_type y cancelación en checkout.js"
```

---

### Task 7: Componente `SubscriptionStatusCard.vue`

**Files:**
- Create: `src/components/pricing/SubscriptionStatusCard.vue`

**Interfaces:**
- Consumes: `cancelSubscription()` de `src/services/checkout.js` (Task 6); `pushSuccessToast`/`pushErrorToast` de `src/stores/notifications.js`; `planStyle` de `src/services/plans-ui.js`.
- Produces: componente con prop `userPlan: Object` (shape de `getUserPlan()`: `{ plan, planName, status, periodEnd, autoRenew }`), emite `@cancelled` (sin payload) cuando la cancelación se confirma con éxito, para que el padre re-consulte `getUserPlan(true)`.

- [ ] **Step 1: Escribir el componente**

```vue
<script setup>
import { ref } from 'vue'
import { cancelSubscription } from '../../services/checkout'
import { pushSuccessToast, pushErrorToast } from '../../stores/notifications'
import { planStyle } from '../../services/plans-ui'

const props = defineProps({
  userPlan: { type: Object, required: true },
})
const emit = defineEmits(['cancelled'])

const confirming = ref(false)
const cancelling = ref(false)

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

async function confirmCancel() {
  cancelling.value = true
  try {
    await cancelSubscription()
    pushSuccessToast('Suscripción cancelada. Mantenés tu plan hasta el final del período pagado.')
    confirming.value = false
    emit('cancelled')
  } catch (e) {
    pushErrorToast(e.message || 'No se pudo cancelar la suscripción')
  }
  cancelling.value = false
}
</script>

<template>
  <div v-if="userPlan.plan !== 'free'" class="rounded-2xl border p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4" :class="planStyle(userPlan.plan).border">
    <div>
      <div class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold mb-2" :class="planStyle(userPlan.plan).badge">
        <span class="w-2 h-2 rounded-full" :class="planStyle(userPlan.plan).dot"></span>
        Plan {{ userPlan.planName }}
      </div>
      <p class="text-sm text-slate-300">
        <template v-if="userPlan.autoRenew">
          Se renueva automáticamente el <strong class="text-white">{{ formatDate(userPlan.periodEnd) }}</strong>.
        </template>
        <template v-else>
          Vence el <strong class="text-white">{{ formatDate(userPlan.periodEnd) }}</strong> — no se renueva automáticamente.
        </template>
      </p>
    </div>

    <div v-if="userPlan.autoRenew" class="flex-shrink-0">
      <button
        v-if="!confirming"
        @click="confirming = true"
        class="text-sm font-semibold text-slate-400 hover:text-red-400 transition underline underline-offset-2"
      >
        Cancelar suscripción
      </button>
      <div v-else class="flex items-center gap-2">
        <span class="text-xs text-slate-400">¿Seguro?</span>
        <button
          @click="confirmCancel"
          :disabled="cancelling"
          class="text-sm font-bold text-red-400 hover:text-red-300 transition disabled:opacity-50"
        >
          {{ cancelling ? 'Cancelando…' : 'Sí, cancelar' }}
        </button>
        <button @click="confirming = false" class="text-sm text-slate-400 hover:text-white transition">
          No
        </button>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Verificación**

`npx vite build --mode development`. Expected: build sin errores nuevos (el componente todavía no se importa desde ninguna página, así que este build solo valida sintaxis).

- [ ] **Step 3: Commit**

```bash
git add src/components/pricing/SubscriptionStatusCard.vue
git commit -m "feat: agregar SubscriptionStatusCard"
```

---

### Task 8: Página `Checkout.vue` + ruta

**Files:**
- Create: `src/pages/Checkout.vue`
- Modify: `src/router/router.js`

**Interfaces:**
- Consumes: `fetchPlans()` de `src/services/premium.js`; `startCheckout`, `handleReturnFromCheckout` de `src/services/checkout.js`; `planStyle`, `formatPrice` de `src/services/plans-ui.js`; `getAuthUser` de `src/services/auth.js`; `pushSuccessToast`/`pushErrorToast`/`pushInfoToast` de `src/stores/notifications.js`.
- Produces: ruta `/checkout?plan=<slug>`.

- [ ] **Step 1: Registrar la ruta**

En `router.js`, agregar el import lazy junto a `Pricing` (línea 47):
```javascript
const Checkout = () => import('../pages/Checkout.vue');
```
Y la ruta, justo después de la de `/pricing` (línea 96):
```javascript
    { path: '/checkout', component: Checkout, meta: { requiresAuth: true, zone: 'hub' } },
```

- [ ] **Step 2: Escribir `Checkout.vue`**

```vue
<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchPlans } from '../services/premium'
import { getAuthUser } from '../services/auth'
import { startCheckout, handleReturnFromCheckout } from '../services/checkout'
import { pushSuccessToast, pushErrorToast, pushInfoToast } from '../stores/notifications'
import { planStyle, formatPrice } from '../services/plans-ui'

const route = useRoute()
const router = useRouter()

const plan = ref(null)
const loading = ref(true)
const payLoading = ref(false)
const billingType = ref('recurring') // 'recurring' | 'one_time'
const accountEmail = computed(() => getAuthUser()?.email || '')
const useOtherEmail = ref(false)
const billingEmail = ref('')
const emailError = ref('')
const acceptedTerms = ref(false)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function planPerks(p) {
  if (!p) return []
  const perks = []
  if (p.xp_multiplier > 1) perks.push(`Bonus de XP +${Math.round((p.xp_multiplier - 1) * 100)}%`)
  if (p.daily_powerups) perks.push(`${p.daily_powerups} power-up${p.daily_powerups === 1 ? '' : 's'} por día`)
  perks.push('Pase de Batalla PRO + cosméticos exclusivos')
  if (p.badge) perks.push(`Badge ${p.slug === 'legend' ? 'Legend dorado' : 'Pro'} en perfil`)
  return perks
}

async function pay() {
  if (!plan.value || payLoading.value || !acceptedTerms.value) return

  let payerEmail = null
  if (useOtherEmail.value) {
    const val = billingEmail.value.trim()
    if (!EMAIL_RE.test(val)) {
      emailError.value = 'Ingresá un e-mail válido'
      return
    }
    emailError.value = ''
    payerEmail = val
  }

  payLoading.value = true
  try {
    await startCheckout(plan.value.slug, 'mercadopago', payerEmail, billingType.value)
  } catch (e) {
    pushErrorToast(e.message || 'Error al iniciar el pago')
    payLoading.value = false
  }
}

onMounted(async () => {
  const returnResult = await handleReturnFromCheckout()
  if (returnResult) {
    if (returnResult.status === 'success') {
      pushSuccessToast('Pago procesado. Tu plan se activará en unos segundos.')
      setTimeout(() => router.push('/pricing'), 2500)
    } else if (returnResult.status === 'pending') {
      pushInfoToast('Tu pago está pendiente de aprobación en Mercado Pago.')
    } else if (returnResult.status === 'cancelled') {
      pushInfoToast('Pago cancelado')
    }
    window.history.replaceState({}, '', `/checkout?plan=${route.query.plan || ''}`)
  }

  const slug = route.query.plan
  const allPlans = await fetchPlans()
  plan.value = allPlans.find(p => p.slug === slug) || null
  loading.value = false

  if (!plan.value) {
    pushErrorToast('Plan no encontrado')
    router.push('/pricing')
  }
})
</script>

<template>
  <div class="min-h-[calc(100dvh-4rem)] text-white max-w-5xl mx-auto px-4 py-10">
    <div v-if="loading" class="flex justify-center py-20">
      <div class="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
    </div>

    <div v-else-if="plan" class="grid grid-cols-1 md:grid-cols-[1fr_360px] gap-8 items-start">
      <!-- Columna izquierda: formulario -->
      <div class="order-2 md:order-1 space-y-6">
        <div>
          <h1 class="text-2xl font-extrabold mb-1">Completá tu compra</h1>
          <p class="text-sm text-slate-400">Plan {{ plan.name }}</p>
        </div>

        <!-- Modalidad de pago -->
        <div>
          <div class="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-3">Modalidad de pago</div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              @click="billingType = 'recurring'"
              class="text-left rounded-xl border p-4 transition"
              :class="billingType === 'recurring' ? 'border-violet-400/60 bg-violet-500/10' : 'border-white/10 hover:border-white/20'"
            >
              <div class="font-bold text-white text-sm mb-1">Débito automático</div>
              <div class="text-xs text-slate-400">Se renueva solo cada mes. Cancelás cuando quieras.</div>
            </button>
            <button
              type="button"
              @click="billingType = 'one_time'"
              class="text-left rounded-xl border p-4 transition"
              :class="billingType === 'one_time' ? 'border-violet-400/60 bg-violet-500/10' : 'border-white/10 hover:border-white/20'"
            >
              <div class="font-bold text-white text-sm mb-1">Pago único</div>
              <div class="text-xs text-slate-400">Pagás una vez, dura 30 días, no se renueva.</div>
            </button>
          </div>
        </div>

        <!-- Mail de facturación -->
        <div>
          <div class="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-3">Mail de facturación</div>
          <p class="text-sm text-slate-300 leading-relaxed mb-2">
            Se cobra a tu cuenta de Mercado Pago con el e-mail <strong class="text-white">{{ accountEmail }}</strong>.
          </p>
          <label class="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
            <input type="checkbox" v-model="useOtherEmail" class="accent-indigo-500 w-4 h-4 rounded" />
            Mi cuenta de Mercado Pago usa otro e-mail
          </label>
          <div v-if="useOtherEmail" class="mt-3">
            <input
              v-model="billingEmail"
              type="email"
              inputmode="email"
              autocomplete="email"
              placeholder="tu-email-de-mercadopago@ejemplo.com"
              class="w-full rounded-xl border bg-slate-900/60 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-violet-400/60"
              :class="emailError ? 'border-red-500/60' : 'border-white/15'"
            />
            <p v-if="emailError" class="text-xs text-red-400 mt-1.5">{{ emailError }}</p>
          </div>
        </div>

        <!-- Términos -->
        <label class="flex items-start gap-2.5 text-xs text-slate-300 cursor-pointer select-none">
          <input type="checkbox" v-model="acceptedTerms" class="accent-indigo-500 w-4 h-4 rounded mt-0.5" />
          <span>
            Acepto los <RouterLink to="/terms" target="_blank" class="text-violet-300 hover:underline">Términos y Condiciones</RouterLink>
            y la <RouterLink to="/cancellation-policy" target="_blank" class="text-violet-300 hover:underline">Política de cancelación</RouterLink>.
          </span>
        </label>
      </div>

      <!-- Columna derecha: resumen -->
      <div class="order-1 md:order-2 md:sticky md:top-24 rounded-2xl border border-white/15 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
        <div class="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-3">Resumen</div>

        <div class="flex items-center gap-3 mb-4">
          <div class="w-12 h-12 rounded-2xl grid place-items-center border" :class="planStyle(plan.slug).badge">
            <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
          </div>
          <div class="font-display font-bold text-white text-lg leading-tight">Fulvo {{ plan.name }}</div>
        </div>

        <ul class="space-y-1.5 mb-4">
          <li v-for="(perk, i) in planPerks(plan)" :key="i" class="flex items-center gap-2 text-sm text-slate-300">
            <svg class="w-4 h-4 flex-shrink-0" :class="planStyle(plan.slug).accent" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
            {{ perk }}
          </li>
        </ul>

        <div class="border-t border-white/10 pt-4 mb-5">
          <div class="flex items-center justify-between text-sm text-slate-300 mb-1">
            <span>{{ billingType === 'one_time' ? '1 mes (sin renovación)' : '1 mes (renovación automática)' }}</span>
          </div>
          <div class="flex items-end gap-1">
            <span class="text-2xl font-extrabold text-white">{{ formatPrice(plan) }}</span>
            <span class="text-slate-400 text-xs mb-1">ARS</span>
          </div>
        </div>

        <button
          @click="pay"
          :disabled="payLoading || !acceptedTerms"
          class="w-full rounded-xl py-3 text-sm font-bold transition disabled:opacity-50 flex items-center justify-center gap-2"
          :class="planStyle(plan.slug).cta"
        >
          <span v-if="payLoading" class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
          {{ payLoading ? 'Redirigiendo…' : 'Pagar con Mercado Pago' }}
        </button>

        <div class="mt-4 flex items-center gap-2 text-xs text-slate-500">
          <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
          Pagos seguros con Mercado Pago
        </div>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 3: Verificación**

`npx vite build --mode development`. Expected: build sin errores nuevos.

Levantar `npm run dev`, loguearse, navegar a `/checkout?plan=pro` manualmente en el navegador y confirmar visualmente: 2 columnas en desktop (≥768px), apiladas con el resumen arriba en mobile (usar devtools responsive), el botón de pagar deshabilitado hasta tildar el checkbox de términos, y el toggle de modalidad cambiando el texto del resumen.

- [ ] **Step 4: Commit**

```bash
git add src/router/router.js src/pages/Checkout.vue
git commit -m "feat: agregar página de checkout de 2 columnas"
```

---

### Task 9: `Pricing.vue` — sacar el modal, navegar a `/checkout`, mostrar estado de suscripción

**Files:**
- Modify: `src/pages/Pricing.vue`

**Interfaces:**
- Consumes: `SubscriptionStatusCard.vue` (Task 7), `getUserPlan` de `src/services/premium.js` (ya importado).

- [ ] **Step 1: Reemplazar el script**

Reemplazar el bloque `<script setup>` completo (líneas 1-118) por:

```vue
<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { fetchPlans, getUserPlan, invalidatePlanCache } from '../services/premium'
import { getAuthUser } from '../services/auth'
import { handleReturnFromCheckout } from '../services/checkout'
import { pushSuccessToast, pushErrorToast, pushInfoToast } from '../stores/notifications'
import PlanCard from '../components/pricing/PlanCard.vue'
import SubscriptionStatusCard from '../components/pricing/SubscriptionStatusCard.vue'
import { planStyle, formatPrice } from '../services/plans-ui'

const router = useRouter()
const plans = ref([])
const currentPlan = ref('free')
const userPlanData = ref(null)
const loading = ref(true)
const openFaq = ref(null)

const sortedPlans = computed(() =>
  [...plans.value].sort((a, b) => a.sort_order - b.sort_order)
)

function askSubscribe(plan) {
  const { id } = getAuthUser() || {}
  if (!id) {
    router.push('/login')
    return
  }
  router.push(`/checkout?plan=${plan.slug}`)
}

async function reloadPlan() {
  const userPlan = await getUserPlan(true)
  currentPlan.value = userPlan.plan || 'free'
  userPlanData.value = userPlan
}

const COMPARISON = [
  { label: 'Power-ups por día', key: 'daily_powerups' },
  { label: 'Bonus de XP', key: 'xp_multiplier', format: v => v > 1 ? `+${Math.round((v - 1) * 100)}%` : 'Base' },
  { label: 'Pase de Batalla PRO', proOnly: true },
  { label: 'Íconos, bordes y banners exclusivos', proOnly: true },
  { label: '9 modos de juego', static: true },
  { label: 'Sistema de XP y niveles', static: true },
  { label: 'Ranking global', static: true },
  { label: 'Badge exclusivo en perfil', key: 'badge', format: v => v ? '✓' : '—' },
]

const FAQ = [
  { q: '¿Puedo cancelar en cualquier momento?', a: 'Sí, podés cancelar tu suscripción cuando quieras desde acá mismo o desde Mercado Pago. No hay contratos ni permanencia mínima.' },
  { q: '¿Cómo se procesan los pagos?', a: 'Los pagos se procesan de forma segura a través de Mercado Pago. Podés pagar con tarjeta de crédito, débito, dinero en cuenta o efectivo.' },
  { q: '¿Qué pasa con mis power-ups si cancelo?', a: 'Si cancelás, tu plan vuelve a Free al final del período pagado. Los power-ups no usados se pierden, pero conservás todo tu progreso, XP y logros.' },
  { q: '¿Puedo cambiar de plan?', a: 'Sí, podés subir o bajar de plan en cualquier momento. El cambio se aplica en el siguiente ciclo de facturación.' },
  { q: '¿Cuál es la diferencia entre débito automático y pago único?', a: 'El débito automático se renueva solo cada mes hasta que lo canceles. El pago único es una sola vez: tenés el plan por 30 días y no se te cobra de nuevo — volvés a Free automáticamente salvo que compres otra vez.' },
]

onMounted(async () => {
  const returnResult = await handleReturnFromCheckout()
  if (returnResult) {
    if (returnResult.status === 'success') {
      pushSuccessToast('Pago procesado. Tu plan se activará en unos segundos.')
      invalidatePlanCache()
      setTimeout(reloadPlan, 3000)
    } else if (returnResult.status === 'cancelled') {
      pushInfoToast('Pago cancelado')
    }
    window.history.replaceState({}, '', '/pricing')
  }

  const [allPlans] = await Promise.all([fetchPlans(), reloadPlan()])
  plans.value = allPlans
  loading.value = false
})
</script>
```

- [ ] **Step 2: Agregar `SubscriptionStatusCard` al template y sacar el modal**

En el `<template>`, insertar antes del bloque `<!-- Plans -->` (línea ~135):
```vue
    <!-- Estado de suscripción actual -->
    <div v-if="!loading && userPlanData && userPlanData.plan !== 'free'" class="max-w-5xl mx-auto px-4 pb-6">
      <SubscriptionStatusCard :user-plan="userPlanData" @cancelled="reloadPlan" />
    </div>
```

Y eliminar por completo el bloque `<!-- ════ Popup de confirmación antes de Mercado Pago ════ -->` (el `<Teleport to="body">...</Teleport>` entero, líneas ~250-343 del archivo original) y el bloque `<style scoped>` que solo tenía transiciones de ese modal (`.pay-modal-*`; dejar `.faq-expand-*` porque el FAQ se mantiene).

- [ ] **Step 3: Verificación**

`npx vite build --mode development`. Expected: build sin errores nuevos (ningún import roto por el modal eliminado).

Manual: loguearse con un usuario Pro/Legend de test (o setear `subscriptions` a mano en SQL), abrir `/pricing`, confirmar que aparece la `SubscriptionStatusCard` con el botón de cancelar (si `auto_renew`) o el texto de vencimiento (si no). Con un usuario Free, click en "Suscribirme" de un `PlanCard` navega a `/checkout?plan=pro`.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Pricing.vue
git commit -m "refactor: sacar modal de checkout de Pricing.vue, navegar a /checkout"
```

---

### Task 10: `ProfileEdit.vue` — sección "Mi plan"

**Files:**
- Modify: `src/pages/profile/ProfileEdit.vue`

**Interfaces:**
- Consumes: `getUserPlan` de `src/services/premium.js`; `SubscriptionStatusCard.vue` (Task 7).

- [ ] **Step 1: Importar dependencias y cargar el plan**

En el bloque `<script>` (Options API), agregar el import junto a los existentes (línea 9):
```javascript
import SubscriptionStatusCard from '../../components/pricing/SubscriptionStatusCard.vue';
import { getUserPlan } from '../../services/premium';
```

Registrar el componente (línea 15):
```javascript
  components: { AppButton, SearchSelect, CosmeticsCollection, SubscriptionStatusCard },
```

Agregar `userPlan: null` a `data()` (junto a `user: null`, línea 18):
```javascript
      user: null,
      userPlan: null,
```

Agregar un método para (re)cargarlo:
```javascript
    async loadUserPlan() {
      this.userPlan = await getUserPlan(true);
    },
```
(Va dentro de `methods`, junto a `handleSubmit`.)

Llamarlo en `mounted()` (junto a la suscripción de auth, línea 59-84):
```javascript
  mounted() {
    this.loadUserPlan();
    let initialized = false
    // ...(resto igual)
```

- [ ] **Step 2: Agregar la sección al template**

En el `<template>`, insertar antes de `<CosmeticsCollection ...>` (línea 100):
```vue
    <SubscriptionStatusCard
      v-if="userPlan"
      :user-plan="userPlan"
      @cancelled="loadUserPlan"
      class="mb-4"
    />
```

- [ ] **Step 3: Verificación**

`npx vite build --mode development`. Expected: build sin errores nuevos.

Manual: loguearse con un usuario Pro/Legend de test, ir a `/profile-edit`, confirmar que aparece la card de plan arriba del form. Con un usuario Free, confirmar que no aparece nada raro (el componente ya se auto-oculta con `v-if="userPlan.plan !== 'free'"` interno).

- [ ] **Step 4: Commit**

```bash
git add src/pages/profile/ProfileEdit.vue
git commit -m "feat: agregar sección Mi plan a ProfileEdit"
```

---

### Task 11: Páginas legales (DRAFT) — Términos, Privacidad, Cancelación

**Files:**
- Create: `src/pages/legal/Terms.vue`
- Create: `src/pages/legal/Privacy.vue`
- Create: `src/pages/legal/CancellationPolicy.vue`
- Modify: `src/router/router.js`
- Modify: `src/pages/Pricing.vue` (link desde el FAQ)

**Interfaces:**
- Produces: rutas `/terms`, `/privacy`, `/cancellation-policy` (sin `requiresAuth`, `zone: 'hub'`).

- [ ] **Step 1: Registrar las 3 rutas**

En `router.js`, agregar los imports lazy junto a `Checkout` (Task 8):
```javascript
const Terms = () => import('../pages/legal/Terms.vue');
const Privacy = () => import('../pages/legal/Privacy.vue');
const CancellationPolicy = () => import('../pages/legal/CancellationPolicy.vue');
```
Y las rutas, junto a `/checkout`:
```javascript
    { path: '/terms', component: Terms, meta: { zone: 'hub' } },
    { path: '/privacy', component: Privacy, meta: { zone: 'hub' } },
    { path: '/cancellation-policy', component: CancellationPolicy, meta: { zone: 'hub' } },
```

- [ ] **Step 2: Componente compartido de aviso DRAFT**

Al tope de cada una de las 3 páginas (dentro del `<template>`, antes del contenido), repetir este bloque (no vale la pena un componente aparte para 3 usos — YAGNI):
```vue
    <div class="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 mb-8 text-sm text-amber-200">
      <strong>Borrador — pendiente de revisión legal.</strong> Este texto todavía no fue revisado por un abogado. No lo tomes como asesoramiento legal definitivo.
    </div>
```

- [ ] **Step 3: `Terms.vue`**

```vue
<script setup></script>

<template>
  <section class="relative min-h-screen overflow-hidden">
    <div class="relative z-10 max-w-3xl mx-auto px-6 py-10 text-slate-300">
      <h1 class="text-2xl md:text-3xl font-bold text-white mb-6">Términos y Condiciones</h1>

      <div class="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 mb-8 text-sm text-amber-200">
        <strong>Borrador — pendiente de revisión legal.</strong> Este texto todavía no fue revisado por un abogado. No lo tomes como asesoramiento legal definitivo.
      </div>

      <div class="space-y-6 text-sm leading-relaxed">
        <section>
          <h2 class="text-lg font-bold text-white mb-2">1. Quién ofrece el servicio</h2>
          <p>Fulvo es una plataforma de trivia de fútbol operada por su titular, con contacto en <a href="mailto:fernandezmalejo@gmail.com" class="text-violet-300 hover:underline">fernandezmalejo@gmail.com</a>.</p>
        </section>
        <section>
          <h2 class="text-lg font-bold text-white mb-2">2. Qué se cobra y cómo</h2>
          <p>Los planes pagos (Pro, Legend) se cobran en pesos argentinos a través de Mercado Pago, en dos modalidades:</p>
          <ul class="list-disc pl-5 mt-2 space-y-1">
            <li><strong class="text-white">Débito automático:</strong> se renueva cada mes hasta que se cancele.</li>
            <li><strong class="text-white">Pago único:</strong> un solo cobro, acceso por 30 días, sin renovación.</li>
          </ul>
        </section>
        <section>
          <h2 class="text-lg font-bold text-white mb-2">3. Derecho de arrepentimiento</h2>
          <p>De acuerdo a la normativa de defensa del consumidor vigente en Argentina, tenés derecho a revocar tu compra dentro de los 10 días corridos desde la contratación, sin costo ni responsabilidad alguna, salvo que ya hayas hecho uso efectivo del servicio contratado.</p>
        </section>
        <section>
          <h2 class="text-lg font-bold text-white mb-2">4. Cómo cancelar</h2>
          <p>Podés cancelar tu suscripción con débito automático en cualquier momento desde tu perfil o desde la página de planes en Fulvo, o directamente desde tu cuenta de Mercado Pago. Ver la <RouterLink to="/cancellation-policy" class="text-violet-300 hover:underline">Política de cancelación</RouterLink> completa.</p>
        </section>
        <section>
          <h2 class="text-lg font-bold text-white mb-2">5. Modificaciones</h2>
          <p>Estos términos pueden actualizarse. Los cambios relevantes se comunicarán dentro de la plataforma.</p>
        </section>
      </div>
    </div>
  </section>
</template>
```

- [ ] **Step 4: `Privacy.vue`**

```vue
<script setup></script>

<template>
  <section class="relative min-h-screen overflow-hidden">
    <div class="relative z-10 max-w-3xl mx-auto px-6 py-10 text-slate-300">
      <h1 class="text-2xl md:text-3xl font-bold text-white mb-6">Política de Privacidad</h1>

      <div class="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 mb-8 text-sm text-amber-200">
        <strong>Borrador — pendiente de revisión legal.</strong> Este texto todavía no fue revisado por un abogado. No lo tomes como asesoramiento legal definitivo.
      </div>

      <div class="space-y-6 text-sm leading-relaxed">
        <section>
          <h2 class="text-lg font-bold text-white mb-2">1. Qué datos recolectamos</h2>
          <p>Datos de cuenta (email, nombre de usuario), datos de perfil que cargues voluntariamente (biografía, país, redes), y datos de uso del juego (puntajes, rachas, logros) necesarios para el funcionamiento de la plataforma.</p>
        </section>
        <section>
          <h2 class="text-lg font-bold text-white mb-2">2. Cómo se procesan los pagos</h2>
          <p>Los datos de pago (tarjeta, cuenta bancaria) son procesados directamente por Mercado Pago — Fulvo nunca almacena ni tiene acceso a esos datos. Solo recibimos confirmación de si el pago fue aprobado y un identificador de la transacción.</p>
        </section>
        <section>
          <h2 class="text-lg font-bold text-white mb-2">3. Con quién se comparten los datos</h2>
          <p>No vendemos datos personales a terceros. Se comparten únicamente con los proveedores necesarios para operar el servicio (Supabase para autenticación y base de datos, Mercado Pago para pagos).</p>
        </section>
        <section>
          <h2 class="text-lg font-bold text-white mb-2">4. Tus derechos</h2>
          <p>Podés acceder, rectificar o solicitar la eliminación de tus datos personales escribiendo a <a href="mailto:fernandezmalejo@gmail.com" class="text-violet-300 hover:underline">fernandezmalejo@gmail.com</a>.</p>
        </section>
      </div>
    </div>
  </section>
</template>
```

- [ ] **Step 5: `CancellationPolicy.vue`**

```vue
<script setup></script>

<template>
  <section class="relative min-h-screen overflow-hidden">
    <div class="relative z-10 max-w-3xl mx-auto px-6 py-10 text-slate-300">
      <h1 class="text-2xl md:text-3xl font-bold text-white mb-6">Política de Cancelación y Reembolsos</h1>

      <div class="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 mb-8 text-sm text-amber-200">
        <strong>Borrador — pendiente de revisión legal.</strong> Este texto todavía no fue revisado por un abogado. No lo tomes como asesoramiento legal definitivo.
      </div>

      <div class="space-y-6 text-sm leading-relaxed">
        <section>
          <h2 class="text-lg font-bold text-white mb-2">1. Cancelar el débito automático</h2>
          <p>Podés cancelar tu suscripción con renovación automática en cualquier momento, sin costo, desde:</p>
          <ul class="list-disc pl-5 mt-2 space-y-1">
            <li>Tu perfil en Fulvo (sección "Mi plan") o la página de Planes.</li>
            <li>Tu cuenta de Mercado Pago, en la sección de suscripciones.</li>
          </ul>
          <p class="mt-2">Al cancelar, conservás el acceso al plan pago hasta el final del período ya pagado — no se hacen reembolsos parciales de días no usados dentro de un ciclo mensual.</p>
        </section>
        <section>
          <h2 class="text-lg font-bold text-white mb-2">2. Pago único</h2>
          <p>El pago único no se renueva: da acceso por 30 días exactos desde la fecha de compra, y no requiere ninguna acción para "cancelarse" — simplemente no vuelve a cobrarse.</p>
        </section>
        <section>
          <h2 class="text-lg font-bold text-white mb-2">3. Derecho de arrepentimiento (10 días)</h2>
          <p>Si todavía no usaste ningún beneficio del plan pago, podés pedir la devolución total dentro de los 10 días corridos de la compra escribiendo a <a href="mailto:fernandezmalejo@gmail.com" class="text-violet-300 hover:underline">fernandezmalejo@gmail.com</a>.</p>
        </section>
      </div>
    </div>
  </section>
</template>
```

- [ ] **Step 6: Linkear desde el FAQ de `Pricing.vue`**

En `Pricing.vue`, en el bloque `<!-- Trust footer -->` (después del FAQ), agregar debajo del `<div>` de trust badges existente:
```vue
      <div class="flex items-center justify-center gap-4 text-xs text-slate-500 mt-4">
        <RouterLink to="/terms" class="hover:text-slate-300 transition">Términos y Condiciones</RouterLink>
        <span>·</span>
        <RouterLink to="/privacy" class="hover:text-slate-300 transition">Privacidad</RouterLink>
        <span>·</span>
        <RouterLink to="/cancellation-policy" class="hover:text-slate-300 transition">Cancelación</RouterLink>
      </div>
```
(`RouterLink` ya está disponible globalmente en este proyecto sin import explícito — confirmar contra otro uso existente de `RouterLink` en `Pricing.vue`/`PlanCard.vue`; si `vue-router` no lo registra globalmente acá, agregar `import { RouterLink } from 'vue-router'` al `<script setup>`.)

- [ ] **Step 7: Verificación**

`npx vite build --mode development`. Expected: build sin errores nuevos.

Manual: navegar a `/terms`, `/privacy`, `/cancellation-policy` sin estar logueado (deben cargar, no tienen `requiresAuth`), confirmar que se ve el aviso DRAFT arriba de cada una, y que los links desde `/checkout` (checkbox, Task 8) y `/pricing` (footer) funcionan.

- [ ] **Step 8: Commit**

```bash
git add src/pages/legal src/router/router.js src/pages/Pricing.vue
git commit -m "feat: agregar páginas legales DRAFT (términos, privacidad, cancelación)"
```

---

### Task 12: Verificación end-to-end + notas de rollout para el owner

**Files:** ninguno (checklist manual).

- [ ] **Step 1: Confirmar secrets configurados**

Con `mcp__plugin_supabase_supabase__list_edge_functions` o preguntándole al owner, confirmar que estos secrets existen en el proyecto de Supabase (Settings → Edge Functions → Secrets):
- `MERCADOPAGO_ACCESS_TOKEN` (ya debería existir de antes).
- `MERCADOPAGO_WEBHOOK_SECRET` (nuevo — el owner lo obtiene del panel de MercadoPago: su app → Webhooks → configurar URL `https://<project-ref>.supabase.co/functions/v1/payment-webhook?provider=mercadopago` → copiar la "Firma secreta"). Si todavía no está configurado, la validación de firma de la Task 3 queda inactiva (por diseño, ver Step 2 de esa task) — avisarle al owner explícitamente que sin este secret el gap de seguridad #2 de la auditoría sigue abierto.
- `SUPABASE_SERVICE_ROLE_KEY` y `SUPABASE_URL` (ya deberían existir, usados por `create-checkout`/`payment-webhook` hoy).

- [ ] **Step 2: Flujo completo en sandbox — débito automático (regresión)**

Con credenciales de sandbox de MP, loguearse en la app, ir a `/pricing` → elegir un plan → `/checkout` → modalidad "Débito automático" → completar el pago de test. Confirmar: redirección de vuelta a `/checkout?plan=...&result=mp`, toast de éxito, y en `/pricing` aparece la `SubscriptionStatusCard` con botón "Cancelar suscripción".

- [ ] **Step 3: Flujo completo en sandbox — pago único**

Mismo flujo, modalidad "Pago único". Confirmar: redirección con `result=mp_ok`, toast de éxito, en `subscriptions` la fila queda con `auto_renew = false`, y en `/pricing`/`/profile-edit` la card muestra "Vence el DD/MM — no se renueva automáticamente" **sin** botón de cancelar.

- [ ] **Step 4: Cancelación in-app**

Desde la suscripción de débito automático del Step 2, click en "Cancelar suscripción" → confirmar → toast de éxito. Verificar en el panel de sandbox de MP que el `preapproval` quedó `cancelled`, y en `subscriptions` que `status = 'cancelled'`.

- [ ] **Step 5: Expiración automática de pago único**

En SQL, adelantar a mano el `current_period_end` de la fila del Step 3 a una fecha pasada:
```sql
UPDATE public.subscriptions SET current_period_end = now() - interval '1 day' WHERE user_id = '<uid-de-test>';
```
Llamar a `get_user_plan()` (o simplemente recargar `/pricing` logueado como ese usuario) y confirmar que el plan volvió a `free` solo.

- [ ] **Step 6: Resumen para el owner**

Nota final (sin código) para quien corra esta plan: avisarle al owner que además de los secrets del Step 1 necesita (a) correr manualmente `supabase/mp-one-time-payment.sql` si el MCP de Supabase no estaba disponible en este entorno para aplicarlo directo, y (b) hacer revisar por un abogado el contenido de `/terms`, `/privacy` y `/cancellation-policy` antes de que el checkbox del checkout sea el único gate legal frente a usuarios reales — hoy ese contenido es un borrador razonable, no asesoramiento legal.
