# Fulvo — Pago único de MercadoPago + página de checkout tipo carrito

## Contexto

Auditoría de la integración de pagos actual (`supabase/functions/create-checkout`, `supabase/functions/payment-webhook`, `src/services/checkout.js`, `supabase/premium-schema.sql`, `src/pages/Pricing.vue`) realizada en esta misma conversación. Hallazgos:

**Funciona:** suscripción recurrente vía `/preapproval` de MercadoPago (débito automático), con activación por webhook y RPC `activate_subscription` idempotente (`UNIQUE(user_id)` + `ON CONFLICT DO UPDATE`). Soporte dual MP + Stripe en el mismo edge function (Stripe no está expuesto en la UI actual — `Pricing.vue` hardcodea `provider: 'mercadopago'`).

**Gaps identificados (owner decidió cuáles entran en esta spec):**
1. Solo existe pago recurrente — no hay pago único. **→ En alcance.**
2. El webhook de MP no valida firma (`x-signature`/`x-request-id`), a diferencia del de Stripe que sí valida HMAC. **→ En alcance.**
3. No hay botón de cancelar suscripción in-app — el FAQ manda al usuario a cancelar desde MercadoPago. Riesgo de compliance con Ley 24.240 (la baja debe ser tan fácil como el alta, mismo canal). **→ En alcance.**
4. No hay páginas de Términos, Privacidad ni Política de cancelación/reembolso — ninguna ruta `/terms`, `/privacy` existe en el router. MP las pide para aprobar cobros recurrentes. **→ En alcance.**
5. MP no maneja cobros recurrentes fallidos (topic `payment` sobre un `preapproval`) — Stripe sí lo hace vía `invoice.payment_failed`. **→ Fuera de alcance, queda anotado como backlog.**

## Alcance

**Incluye:**
- Nueva modalidad de pago único en MercadoPago (Checkout Pro / `/checkout/preferences`) además del débito automático existente (`/preapproval`).
- Manejo del topic `payment` en el webhook, para activar planes de pago único.
- Validación de firma (`x-signature`) en el webhook de MercadoPago.
- Cancelación de suscripción in-app (nuevo edge function `cancel-subscription`), con botón en `/pricing` y `/profile-edit`.
- Página nueva `/checkout?plan=<slug>`, layout de 2 columnas, que reemplaza el popup modal de confirmación actual.
- Páginas `/terms`, `/privacy`, `/cancellation-policy` — contenido **DRAFT**, a revisar por un abogado antes de publicar en producción. No es asesoramiento legal.

**No incluye (fuera de esta spec):**
- Manejo de cobros recurrentes fallidos de MP (gap #5 arriba) — el plan sigue activo en Fulvo hasta que MP cancele el `preapproval` por su cuenta.
- Pago único en Stripe (Stripe no está expuesto en la UI hoy; se deja como está, sin tocar).
- Precio "lifetime" o duración configurable — el pago único es siempre "un mes al mismo precio que la suscripción, sin renovación".
- Rediseño de `PlanCard.vue` más allá de cambiar su acción de "abrir modal" a "navegar a /checkout".

## Modelo de datos

```sql
-- supabase/mp-one-time-payment.sql
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN NOT NULL DEFAULT true;
```

`auto_renew = false` para pagos únicos. No requiere lógica de expiración nueva: `get_user_plan()` ya baja a Free cuando `current_period_end < now()` (líneas 103-108 de `premium-schema.sql`), independientemente de `auto_renew`. La columna solo controla qué UI mostrar (botón "Cancelar" vs. texto "Vence el DD/MM") y evita que `cancel-subscription` intente cancelar un preapproval que no existe.

`activate_subscription(...)` gana un parámetro `p_auto_renew BOOLEAN DEFAULT true`, propagado al `INSERT ... ON CONFLICT DO UPDATE`.

No se toca `plans` — mismo precio (`price_ars`) para las dos modalidades.

## Backend — pago único (MercadoPago)

`create-checkout/index.ts`: el body pasa a aceptar `billing_type: 'recurring' | 'one_time'` (default `'recurring'` si no viene, por compatibilidad).

- `billing_type: 'recurring'` → comportamiento actual, sin cambios (`/preapproval`).
- `billing_type: 'one_time'` → nueva función `createMercadoPagoOneTimePayment`, que llama a `POST https://api.mercadopago.com/checkout/preferences` con:
  ```json
  {
    "items": [{ "title": "Fulvo <plan.name> (1 mes)", "quantity": 1, "unit_price": plan.price_ars/100, "currency_id": "ARS" }],
    "payer": { "email": payerEmail },
    "back_urls": {
      "success": "<frontendUrl>/checkout?plan=<slug>&result=mp_ok",
      "failure": "<frontendUrl>/checkout?plan=<slug>&result=mp_fail",
      "pending": "<frontendUrl>/checkout?plan=<slug>&result=mp_pending"
    },
    "auto_return": "approved",
    "external_reference": "{\"user_id\":..,\"plan_slug\":..,\"billing_type\":\"one_time\"}"
  }
  ```
  Devuelve `data.init_point`.

`src/services/checkout.js`: `startCheckout(planSlug, provider, billingEmail, billingType)` — pasa `billing_type` en el body.

## Backend — webhook: pago único + firma

`payment-webhook/index.ts`, dentro de `handleMercadoPagoWebhook`:

1. **Validación de firma** (antes de cualquier otra lógica, para ambos topics): leer headers `x-signature` (`ts=...,v1=...`) y `x-request-id`, tomar `data.id` de la query string de la URL de la request. Construir el manifest `id:{data.id};request-id:{x-request-id};ts:{ts};`, firmar con HMAC-SHA256 usando `MERCADOPAGO_WEBHOOK_SECRET` (nuevo secret, obtenido del panel de MP → Tu integración → Notificaciones → Webhooks → Firma secreta), comparar con `v1`. Si no matchea → 401. Reutiliza el mismo patrón que `verifyStripeSignature` ya implementado para Stripe.
2. **Topic `payment`** (nuevo, junto al `preapproval` existente): `GET /v1/payments/{id}`. Si `status === 'approved'` y `external_reference.billing_type === 'one_time'`: parsear `user_id`/`plan_slug`, activar con `activate_subscription(..., p_auto_renew: false)`, `provider_subscription_id` = el `payment.id` de MP, período = hoy → hoy + 1 mes. Si el pago no es `one_time` (es un cobro recurrente asociado a un preapproval), no hacer nada — ese caso lo sigue cubriendo el evento `preapproval` existente.

## Backend — cancelación in-app

Nuevo edge function `supabase/functions/cancel-subscription/index.ts`:
- Requiere usuario autenticado (mismo patrón de `create-checkout`).
- Busca su fila en `subscriptions` (`status = 'active' AND auto_renew = true`). Si no hay ninguna, error.
- Si `provider === 'mercadopago'`: `PUT https://api.mercadopago.com/preapproval/{provider_subscription_id}` con `{ "status": "cancelled" }`.
- Si `provider === 'stripe'`: `DELETE /v1/subscriptions/{id}` (dejar implementado por paridad, aunque Stripe no esté expuesto en la UI).
- Actualiza `subscriptions.status = 'cancelled'` localmente (no espera al webhook, para que la UI refleje el cambio al instante; el webhook de `preapproval` cancelado, cuando llegue, es un no-op porque ya está en `'cancelled'`).

`src/services/checkout.js`: nueva función `cancelSubscription()` que invoca el edge function y hace `invalidatePlanCache()`.

## Frontend — página `/checkout`

Nueva ruta en `router.js`: `{ path: '/checkout', component: Checkout, meta: { requiresAuth: true, zone: 'hub' } }`, query param `plan=<slug>`.

`PlanCard.vue`: el evento `subscribe` pasa a hacer `router.push('/checkout?plan=' + plan.slug)` en vez de emitir hacia el modal de `Pricing.vue`. Se elimina el modal (`confirmPlan` y todo el `Teleport` de `Pricing.vue`) — su contenido se migra a la página nueva.

**Layout `Checkout.vue`** (2 columnas en desktop ≥768px, apiladas en mobile — columna de resumen primero en mobile para que el usuario vea qué está pagando antes del formulario):

- **Columna izquierda (formulario):**
  - Selector de modalidad: 2 tarjetas radio, "Débito automático" (con ícono de renovación, texto "se renueva solo cada mes, cancelás cuando quieras") vs. "Pago único" (ícono de check, texto "pagás una vez, dura 30 días, no se renueva"). Mismo precio en ambas — se aclara explícitamente para que no parezca un descuento.
  - Mail de facturación: reutiliza el toggle "Mi cuenta de Mercado Pago usa otro e-mail" + validación ya existentes en `Pricing.vue`.
  - Checkbox obligatorio: "Acepto los [Términos y Condiciones] y la [Política de cancelación]" (links a las páginas nuevas, `target="_blank"`). El botón de pagar está deshabilitado hasta marcarlo.
- **Columna derecha (resumen, sticky en desktop):**
  - Nombre del plan, ícono/badge (reusa `planStyle`), lista de perks (reusa `planPerks` de `Pricing.vue`).
  - Desglose: "Fulvo `<Plan>` — 1 mes", precio, total.
  - Botón "Pagar con Mercado Pago" (mismo estado de loading que hoy).
  - Trust footer (reusa el bloque de `Pricing.vue`: pagos seguros, cancelás cuando quieras, tarjeta/débito/efectivo).

Maneja el retorno de MP igual que hoy (`handleReturnFromCheckout`, adaptado a los nuevos query params `result=mp_ok|mp_fail|mp_pending`).

## Frontend — botón de cancelar

Componente nuevo `SubscriptionStatusCard.vue`, reusado en:
- `Pricing.vue`: reemplaza al texto plano que hoy indica el plan actual, cuando `currentPlan !== 'free'`.
- `ProfileEdit.vue`: nueva sección "Mi plan".

Muestra: plan actual, fecha de vencimiento/renovación. Si `auto_renew`: botón "Cancelar suscripción" → confirmación (¿seguro? perderás X al vencer) → `cancelSubscription()` → toast. Si `!auto_renew`: texto "Vence el DD/MM — no se renueva automáticamente" sin botón.

## Páginas legales

`src/pages/legal/Terms.vue`, `Privacy.vue`, `CancellationPolicy.vue`, rutas `/terms`, `/privacy`, `/cancellation-policy` (`zone: 'hub'`, sin `requiresAuth`). Contenido en español, marcado con un aviso visible al tope: *"Borrador — pendiente de revisión legal antes de publicar."* Estructura basada en lo que MP y la Ley 24.240 piden: identificación del vendedor (Fulvo), qué se cobra y cómo, botón de arrepentimiento / derecho de cancelación, plazos de reembolso, tratamiento de datos personales (enlaza a lo que ya haga Supabase Auth). Linkeadas desde el checkbox del checkout y desde el FAQ de `/pricing`.

## Testing

- Manual, contra el sandbox de MercadoPago (credenciales de test) para los 3 flujos: alta recurrente (regresión), alta pago único, cancelación.
- Verificar que la validación de firma rechaza un POST sin firma válida (curl manual) y acepta el payload real de MP.
- Verificar que `get_user_plan()` baja a Free automáticamente a un usuario de pago único vencido (ajustando `current_period_end` a mano en SQL para no esperar 30 días).
- Responsive del checkout: mobile (columna resumen arriba) y desktop (2 columnas).

## Rollout

Requiere que el owner:
1. Configure `MERCADOPAGO_WEBHOOK_SECRET` como secret de Supabase (`supabase secrets set`), con el valor del panel de MP.
2. Corra `supabase/mp-one-time-payment.sql`.
3. Revise el contenido DRAFT de `/terms`, `/privacy`, `/cancellation-policy` con un abogado antes de que el checkbox del checkout quede como único gate legal.
