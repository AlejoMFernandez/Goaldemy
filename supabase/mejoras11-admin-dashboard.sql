-- ============================================================
-- GOALDEMY — MEJORAS11: DASHBOARD DEL PANEL ADMIN
--
-- RPC único (SECURITY DEFINER) que agrega las métricas que sirven
-- para gestionar Goaldemy: ingresos (MRR), suscriptores PRO,
-- conversión, actividad (DAU / partidas), altas por día, mix por
-- plan y proveedor, top juegos y top XP.
--
-- Agregado server-side porque subscriptions/game_sessions tienen
-- RLS "solo lo propio": el admin no los puede leer por query directo.
-- Chequea rol admin adentro. Fechas en horario Argentina (app_today).
--
-- Correr en cualquier momento. Idempotente.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_admin_dashboard()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_today DATE := public.app_today();
  v_tz    TEXT := 'America/Argentina/Buenos_Aires';
  result  JSON;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin')
    INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT json_build_object(
    -- ── Totales ──────────────────────────────────────────────
    'total_users', (SELECT count(*) FROM public.user_profiles),
    'new_users_24h', (SELECT count(*) FROM public.user_profiles WHERE created_at >= now() - interval '24 hours'),
    'new_users_7d',  (SELECT count(*) FROM public.user_profiles WHERE created_at >= now() - interval '7 days'),

    -- ── Ingresos / suscripciones ─────────────────────────────
    -- price_ars está en centavos (create-checkout hace /100). MRR en pesos.
    'pro_active', (
      SELECT count(*) FROM public.subscriptions s
      WHERE s.plan_slug <> 'free' AND s.status = 'active'
        AND (s.current_period_end IS NULL OR s.current_period_end > now())
    ),
    'mrr_ars', (
      SELECT COALESCE(SUM(p.price_ars), 0) / 100.0 FROM public.subscriptions s
      JOIN public.plans p ON p.slug = s.plan_slug
      WHERE s.status = 'active' AND s.plan_slug <> 'free'
        AND (s.current_period_end IS NULL OR s.current_period_end > now())
    ),
    'subs_past_due', (SELECT count(*) FROM public.subscriptions WHERE status = 'past_due'),
    'subs_cancelled_30d', (
      SELECT count(*) FROM public.subscriptions
      WHERE status = 'cancelled' AND updated_at >= now() - interval '30 days'
    ),
    'by_plan', (
      SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.c DESC), '[]'::json) FROM (
        SELECT s.plan_slug, count(*) AS c FROM public.subscriptions s
        WHERE s.status = 'active' AND s.plan_slug <> 'free'
          AND (s.current_period_end IS NULL OR s.current_period_end > now())
        GROUP BY s.plan_slug
      ) t
    ),
    'by_provider', (
      SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.c DESC), '[]'::json) FROM (
        SELECT COALESCE(s.provider, 'sin dato') AS provider, count(*) AS c FROM public.subscriptions s
        WHERE s.status = 'active' AND s.plan_slug <> 'free'
          AND (s.current_period_end IS NULL OR s.current_period_end > now())
        GROUP BY s.provider
      ) t
    ),

    -- ── Actividad ────────────────────────────────────────────
    'dau', (SELECT count(*) FROM public.user_profiles WHERE last_activity_date = v_today),
    'active_7d', (SELECT count(*) FROM public.user_profiles WHERE last_activity_date >= v_today - 6),
    'games_today', (
      SELECT count(*) FROM public.game_sessions
      WHERE (started_at AT TIME ZONE v_tz)::date = v_today
    ),
    'games_7d', (SELECT count(*) FROM public.game_sessions WHERE started_at >= now() - interval '7 days'),

    -- ── Altas por día (últimos 14 días, ART) ─────────────────
    'signups_daily', (
      SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.d), '[]'::json) FROM (
        SELECT gs::date AS d,
               (SELECT count(*) FROM public.user_profiles up
                 WHERE (up.created_at AT TIME ZONE v_tz)::date = gs::date) AS c
        FROM generate_series(v_today - 13, v_today, interval '1 day') gs
      ) t
    ),

    -- ── Top juegos (7d) y top XP ─────────────────────────────
    'top_games', (
      SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.c DESC), '[]'::json) FROM (
        SELECT g.name, count(*) AS c
        FROM public.game_sessions gs JOIN public.games g ON g.id = gs.game_id
        WHERE gs.started_at >= now() - interval '7 days'
        GROUP BY g.name ORDER BY c DESC LIMIT 6
      ) t
    ),
    'top_xp', (
      SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.xp DESC), '[]'::json) FROM (
        SELECT up.display_name, SUM(xe.amount)::int AS xp
        FROM public.xp_events xe JOIN public.user_profiles up ON up.id = xe.user_id
        GROUP BY up.display_name ORDER BY xp DESC LIMIT 5
      ) t
    )
  ) INTO result;

  RETURN result;
END$$;

GRANT EXECUTE ON FUNCTION public.get_admin_dashboard() TO authenticated;
