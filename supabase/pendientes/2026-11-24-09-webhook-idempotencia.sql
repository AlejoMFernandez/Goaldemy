-- ════════════════════════════════════════════════════════════════════
--  2026-11-24-09 — WEBHOOK DE PAGOS: IDEMPOTENCIA + RENOVACIONES
-- ════════════════════════════════════════════════════════════════════
--  QUÉ:
--   1) Tabla payment_webhook_events: 1 fila por evento de Stripe/MercadoPago.
--      Si el proveedor reenvía el mismo evento (lo hacen, a propósito), no se
--      procesa dos veces.
--   2) webhook_event_begin / webhook_event_finish: "tomar" y "cerrar" un
--      evento de forma atómica. Si el procesamiento falla, se marca 'failed'
--      y el reintento del proveedor lo vuelve a procesar.
--   3) renew_subscription_period: extiende current_period_end con la fecha
--      REAL que informa el proveedor (Stripe invoice.paid / subscription.updated,
--      MP authorized_payment / preapproval), sin resetear powerups.
--   4) set_subscription_status: past_due / cancelled / expired por id del
--      proveedor. Con p_honor_paid_period = true, una cancelación deja el plan
--      activo hasta el fin del período ya pagado (vence solo, get_user_plan
--      lo pasa a 'expired').
--   Todo SOLO para service_role (la Edge Function payment-webhook).
--
--  POR QUÉ: el webhook no manejaba renovaciones (Stripe invoice.paid,
--      MP subscription_authorized_payment) y en MP ponía period_end = hoy + 1
--      mes al autorizar: al mes, todos los suscriptores pasaban a 'expired'
--      aunque se les siguiera cobrando. Y sin idempotencia un reintento podía
--      re-activar (y resetear powerups) varias veces.
--
--  RIESGO: Bajo. Solo agrega objetos nuevos. Requiere deployar la versión
--      nueva de supabase/functions/payment-webhook (si no, nada los usa).
--
--  ROLLBACK:
--      BEGIN;
--      DROP FUNCTION IF EXISTS public.webhook_event_begin(text, text, text);
--      DROP FUNCTION IF EXISTS public.webhook_event_finish(text, text, boolean, text);
--      DROP FUNCTION IF EXISTS public.renew_subscription_period(text, text, timestamptz, timestamptz);
--      DROP FUNCTION IF EXISTS public.set_subscription_status(text, text, boolean);
--      DROP TABLE IF EXISTS public.payment_webhook_events;
--      COMMIT;
-- ════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
  provider     TEXT NOT NULL CHECK (provider IN ('stripe', 'mercadopago')),
  event_id     TEXT NOT NULL,
  event_type   TEXT,
  status       TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'done', 'failed')),
  attempts     INTEGER NOT NULL DEFAULT 1,
  last_error   TEXT,
  received_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  PRIMARY KEY (provider, event_id)
);
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;
-- Sin políticas: solo service_role (que saltea RLS) la usa.
REVOKE ALL ON public.payment_webhook_events FROM anon, authenticated;

-- Devuelve 'new' (procesar), 'duplicate' (ya hecho) o 'in_progress' (otro
-- worker lo está procesando hace < 5 min → responder 409 para que reintente).
CREATE OR REPLACE FUNCTION public.webhook_event_begin(p_provider TEXT, p_event_id TEXT, p_type TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD;
BEGIN
  INSERT INTO public.payment_webhook_events (provider, event_id, event_type)
  VALUES (p_provider, p_event_id, p_type)
  ON CONFLICT (provider, event_id) DO NOTHING;
  IF FOUND THEN RETURN 'new'; END IF;

  SELECT * INTO r FROM public.payment_webhook_events
   WHERE provider = p_provider AND event_id = p_event_id FOR UPDATE;
  IF r.status = 'done' THEN RETURN 'duplicate'; END IF;
  IF r.status = 'processing' AND r.updated_at > now() - interval '5 minutes' THEN RETURN 'in_progress'; END IF;

  UPDATE public.payment_webhook_events
     SET status = 'processing', attempts = attempts + 1, updated_at = now()
   WHERE provider = p_provider AND event_id = p_event_id;
  RETURN 'new';
END$$;

CREATE OR REPLACE FUNCTION public.webhook_event_finish(p_provider TEXT, p_event_id TEXT, p_ok BOOLEAN, p_error TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.payment_webhook_events
     SET status = CASE WHEN p_ok THEN 'done' ELSE 'failed' END,
         last_error = CASE WHEN p_ok THEN NULL ELSE left(p_error, 2000) END,
         processed_at = CASE WHEN p_ok THEN now() ELSE processed_at END,
         updated_at = now()
   WHERE provider = p_provider AND event_id = p_event_id;
$$;

-- Extiende el período con la fecha real del proveedor. Nunca lo acorta.
-- Devuelve cuántas filas tocó (0 = no hay suscripción con ese id → el webhook
-- debe usar activate_subscription con user_id/plan del metadata).
CREATE OR REPLACE FUNCTION public.renew_subscription_period(
  p_provider TEXT, p_provider_id TEXT, p_period_start TIMESTAMPTZ, p_period_end TIMESTAMPTZ
) RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n INTEGER;
BEGIN
  UPDATE public.subscriptions
     SET status = 'active',
         current_period_start = COALESCE(p_period_start, current_period_start),
         current_period_end = GREATEST(COALESCE(current_period_end, p_period_end), p_period_end),
         updated_at = now()
   WHERE provider = p_provider AND provider_subscription_id = p_provider_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END$$;

CREATE OR REPLACE FUNCTION public.set_subscription_status(
  p_provider_id TEXT, p_status TEXT, p_honor_paid_period BOOLEAN DEFAULT true
) RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n INTEGER;
BEGIN
  IF p_status NOT IN ('active', 'cancelled', 'past_due', 'expired') THEN
    RAISE EXCEPTION 'bad status %', p_status;
  END IF;
  IF p_status = 'cancelled' AND p_honor_paid_period THEN
    -- Sigue activa hasta el fin de lo pagado; si ya venció, se cancela ahora.
    UPDATE public.subscriptions
       SET status = CASE WHEN current_period_end IS NOT NULL AND current_period_end > now() THEN status ELSE 'cancelled' END,
           updated_at = now()
     WHERE provider_subscription_id = p_provider_id;
  ELSE
    UPDATE public.subscriptions SET status = p_status, updated_at = now()
     WHERE provider_subscription_id = p_provider_id;
  END IF;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END$$;

DO $$
DECLARE f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.webhook_event_begin(text, text, text)',
    'public.webhook_event_finish(text, text, boolean, text)',
    'public.renew_subscription_period(text, text, timestamptz, timestamptz)',
    'public.set_subscription_status(text, text, boolean)',
    'public.activate_subscription(uuid, text, text, text, timestamptz, timestamptz)'
  ] LOOP
    IF to_regprocedure(f) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END IF;
  END LOOP;
END $$;

COMMIT;
