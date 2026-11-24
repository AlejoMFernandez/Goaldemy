-- ════════════════════════════════════════════════════════════════════
--  2026-11-24-06 — RECLAMOS CON DÍA DEL SERVIDOR + report_game_result IDEMPOTENTE
-- ════════════════════════════════════════════════════════════════════
--  QUÉ (mismas firmas → el cliente actual no cambia):
--   1) claim_reto_reward / claim_guest_game_reward / claim_career_reward:
--      IGNORAN p_day_key del cliente y usan public.app_today() (Argentina).
--      • guest: el slug tiene que ser un juego existente y activo, y la
--        cuenta tiene que tener menos de GUEST_WINDOW (7 días): es la
--        recompensa "de bienvenida" por lo jugado como invitado.
--      • career: el grado tiene que estar en la tabla; desconocido → rechazo.
--   2) report_game_result(slug, won): cuenta UNA vez por (usuario, juego, día
--      ART) y solo si existe una partida de desafío TERMINADA hoy de ese
--      juego. Llamadas repetidas → no suman pase / retos / Fichas.
--      Además, desde el parche 08, avanza la racha diaria en el servidor.
--
--  POR QUÉ:
--   • p_day_key era texto libre: rpc('claim_career_reward',{p_grade_key:'legend',
--     p_day_key:'x1'}), 'x2', 'x3'… = 200 XP + 80 Fichas por llamada, infinito.
--     Lo mismo con reto (150 XP/60 F) y guest (y además con slugs inventados).
--   • report_game_result no tenía idempotencia: un bucle de llamadas llenaba
--     el pase mensual (premios + cosméticos), retos y +10 Fichas por "victoria".
--
--  RIESGO: Medio-bajo.
--   • Un invitado que jugó a las 23:59 y crea la cuenta 00:01 reclama "hoy":
--     da igual, es 1 por día igual.
--   • Usuarios con cuenta de más de 7 días que deslogueados juegan como
--     invitado ya no cobran ese "regalo de bienvenida" (era el objetivo).
--   • Si completeChallengeSession falla al guardar ended_at, ese día no suma
--     al pase (antes sumaba igual).
--   • La carrera sigue confiando en el GRADO que manda el cliente (la
--     simulación es 100% cliente). Ahora el máximo es 200 XP + 80 F por día.
--
--  ROLLBACK: correr de nuevo supabase/reto-claim.sql, guest-game-claim.sql,
--      career-claim.sql y el bloque report_game_result de
--      mejoras11-currency-shop.sql. La tabla game_result_reports puede quedar.
-- ════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1) Reto del día ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.claim_reto_reward(p_corrects INTEGER, p_total INTEGER, p_day_key TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid        UUID := auth.uid();
  v_total    INTEGER;
  v_corrects INTEGER;
  v_perfect  BOOLEAN;
  v_xp       INTEGER;
  v_fichas   INTEGER;
  v_day      TEXT := public.app_today()::text;   -- p_day_key se ignora a propósito
BEGIN
  IF uid IS NULL THEN RETURN json_build_object('ok', false, 'error', 'auth'); END IF;

  v_total    := LEAST(GREATEST(COALESCE(p_total, 0), 1), 20);
  v_corrects := LEAST(GREATEST(COALESCE(p_corrects, 0), 0), v_total);
  v_perfect  := v_corrects >= v_total;
  v_xp     := LEAST(v_corrects * 10 + (CASE WHEN v_perfect THEN 50 ELSE 0 END), 150);
  v_fichas := LEAST(v_corrects * 4  + (CASE WHEN v_perfect THEN 20 ELSE 0 END), 60);

  BEGIN
    INSERT INTO public.reto_claims (user_id, day_key, corrects, total, xp, fichas)
      VALUES (uid, v_day, v_corrects, v_total, v_xp, v_fichas);
  EXCEPTION WHEN unique_violation THEN
    RETURN json_build_object('ok', false, 'error', 'already_claimed');
  END;

  PERFORM public.award_xp(v_xp, 'reto_welcome', NULL, NULL,
    json_build_object('day', v_day, 'corrects', v_corrects, 'total', v_total)::jsonb);
  IF v_fichas > 0 THEN
    PERFORM public.award_fichas(uid, v_fichas, 'reto_welcome', json_build_object('day', v_day)::jsonb);
  END IF;
  RETURN json_build_object('ok', true, 'xp', v_xp, 'fichas', v_fichas);
END$$;
REVOKE ALL ON FUNCTION public.claim_reto_reward(INTEGER, INTEGER, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_reto_reward(INTEGER, INTEGER, TEXT) TO authenticated;

-- ── 2) Partidas como invitado ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.claim_guest_game_reward(
  p_game_slug TEXT, p_corrects INTEGER, p_total INTEGER, p_max_streak INTEGER, p_day_key TEXT
) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  GUEST_WINDOW CONSTANT INTERVAL := interval '7 days';
  uid        UUID := auth.uid();
  v_slug     TEXT := NULLIF(btrim(p_game_slug), '');
  v_total    INTEGER;
  v_corrects INTEGER;
  v_streak   INTEGER;
  v_perfect  BOOLEAN;
  v_xp       INTEGER;
  v_fichas   INTEGER;
  v_day      TEXT := public.app_today()::text;   -- p_day_key se ignora a propósito
  v_created  TIMESTAMPTZ;
BEGIN
  IF uid IS NULL THEN RETURN json_build_object('ok', false, 'error', 'auth'); END IF;

  IF v_slug IS NULL OR NOT EXISTS (SELECT 1 FROM public.games WHERE slug = v_slug AND COALESCE(is_active, true)) THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_game');
  END IF;

  SELECT created_at INTO v_created FROM auth.users WHERE id = uid;
  IF v_created IS NULL OR v_created < now() - GUEST_WINDOW THEN
    RETURN json_build_object('ok', false, 'error', 'window_expired');
  END IF;

  v_total    := LEAST(GREATEST(COALESCE(p_total, 0), 1), 20);
  v_corrects := LEAST(GREATEST(COALESCE(p_corrects, 0), 0), v_total);
  v_streak   := LEAST(GREATEST(COALESCE(p_max_streak, 0), 0), v_total);
  v_perfect  := v_corrects >= v_total;
  v_xp     := LEAST(v_corrects * 10 + (CASE WHEN v_perfect THEN 50 ELSE 0 END), 150);
  v_fichas := LEAST(v_corrects * 4  + (CASE WHEN v_perfect THEN 20 ELSE 0 END), 60);

  BEGIN
    INSERT INTO public.guest_game_claims (user_id, game_slug, day_key, corrects, total, max_streak, xp, fichas)
      VALUES (uid, v_slug, v_day, v_corrects, v_total, v_streak, v_xp, v_fichas);
  EXCEPTION WHEN unique_violation THEN
    RETURN json_build_object('ok', false, 'error', 'already_claimed');
  END;

  PERFORM public.award_xp(v_xp, 'guest_welcome', NULL, NULL,
    json_build_object('game', v_slug, 'day', v_day, 'corrects', v_corrects, 'total', v_total)::jsonb);
  IF v_fichas > 0 THEN
    PERFORM public.award_fichas(uid, v_fichas, 'guest_welcome', json_build_object('game', v_slug, 'day', v_day)::jsonb);
  END IF;
  RETURN json_build_object('ok', true, 'xp', v_xp, 'fichas', v_fichas);
END$$;
REVOKE ALL ON FUNCTION public.claim_guest_game_reward(TEXT, INTEGER, INTEGER, INTEGER, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_guest_game_reward(TEXT, INTEGER, INTEGER, INTEGER, TEXT) TO authenticated;

-- ── 3) Modo carrera ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.claim_career_reward(p_grade_key TEXT, p_day_key TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid      UUID := auth.uid();
  v_day    TEXT := public.app_today()::text;   -- p_day_key se ignora a propósito
  v_xp     INTEGER;
  v_fichas INTEGER;
BEGIN
  IF uid IS NULL THEN RETURN json_build_object('ok', false, 'error', 'auth'); END IF;

  SELECT xp, fichas INTO v_xp, v_fichas FROM (VALUES
    ('legend', 200, 80), ('world_class', 150, 60), ('pro', 100, 40),
    ('decent', 60, 24), ('amateur', 30, 12)
  ) AS t(key, xp, fichas) WHERE t.key = p_grade_key;
  IF v_xp IS NULL THEN RETURN json_build_object('ok', false, 'error', 'invalid_grade'); END IF;

  BEGIN
    INSERT INTO public.career_claims (user_id, day_key, grade_key, xp, fichas)
      VALUES (uid, v_day, p_grade_key, v_xp, v_fichas);
  EXCEPTION WHEN unique_violation THEN
    RETURN json_build_object('ok', false, 'error', 'already_claimed');
  END;

  PERFORM public.award_xp(v_xp, 'career_mode', NULL, NULL, json_build_object('day', v_day, 'grade', p_grade_key)::jsonb);
  IF v_fichas > 0 THEN
    PERFORM public.award_fichas(uid, v_fichas, 'career_mode', json_build_object('day', v_day)::jsonb);
  END IF;
  RETURN json_build_object('ok', true, 'xp', v_xp, 'fichas', v_fichas);
END$$;
REVOKE ALL ON FUNCTION public.claim_career_reward(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_career_reward(TEXT, TEXT) TO authenticated;

-- ── 4) report_game_result idempotente ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.game_result_reports (
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_slug   TEXT NOT NULL,
  day         DATE NOT NULL,
  won         BOOLEAN NOT NULL,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, game_slug, day)
);
ALTER TABLE public.game_result_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "game_result_reports read own" ON public.game_result_reports;
CREATE POLICY "game_result_reports read own" ON public.game_result_reports
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Racha: no-op hasta que se aplique el parche 08 (que la redefine).
DO $$ BEGIN
  IF to_regprocedure('public._touch_daily_streak(uuid)') IS NULL THEN
    EXECUTE $f$CREATE FUNCTION public._touch_daily_streak(p_uid UUID) RETURNS JSON
      LANGUAGE sql SECURITY DEFINER SET search_path = public AS $b$ SELECT NULL::json $b$$f$;
    EXECUTE 'REVOKE ALL ON FUNCTION public._touch_daily_streak(uuid) FROM PUBLIC, anon, authenticated';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.report_game_result(p_game_slug TEXT, p_won BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  v_today DATE := public.app_today();
  v_month DATE := date_trunc('month', public.app_today())::date;
  v_day_start TIMESTAMPTZ := (public.app_today()::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires');
  v_gid UUID;
  v_rows INTEGER;
  v_pts INTEGER;
BEGIN
  IF uid IS NULL THEN RETURN; END IF;

  SELECT id INTO v_gid FROM public.games WHERE slug = p_game_slug;
  IF v_gid IS NULL THEN RETURN; END IF;

  -- Tiene que haber un desafío de ese juego TERMINADO hoy (ART).
  IF NOT EXISTS (
    SELECT 1 FROM public.game_sessions
    WHERE user_id = uid AND game_id = v_gid AND ended_at IS NOT NULL
      AND started_at >= v_day_start
      AND COALESCE(metadata->>'mode', 'challenge') = 'challenge'
  ) THEN
    RETURN;
  END IF;

  -- "Ganó" solo si el cliente lo dice Y la partida terminada de hoy lo registra.
  p_won := COALESCE(p_won, false) AND EXISTS (
    SELECT 1 FROM public.game_sessions
    WHERE user_id = uid AND game_id = v_gid AND ended_at IS NOT NULL
      AND started_at >= v_day_start AND metadata->>'result' = 'win'
  );

  -- Una sola vez por (usuario, juego, día)
  INSERT INTO public.game_result_reports (user_id, game_slug, day, won)
    VALUES (uid, p_game_slug, v_today, COALESCE(p_won, false))
    ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN RETURN; END IF;

  -- (0) Racha diaria en el servidor (no-op hasta el parche 08)
  PERFORM public._touch_daily_streak(uid);

  -- (1) Retos diarios
  PERFORM public.ensure_daily_challenges(uid);
  UPDATE public.user_daily_challenges udc
  SET progress = LEAST(udc.target, udc.progress + 1)
  FROM public.daily_challenges dc
  WHERE udc.user_id = uid AND udc.day = v_today AND udc.claimed = false
    AND dc.code = udc.challenge_code
    AND ( dc.goal_type = 'play_any'
       OR (dc.goal_type = 'win_any' AND p_won)
       OR (dc.goal_type = 'win_game' AND p_won AND dc.goal_game = p_game_slug) );

  -- (2) Pase mensual
  v_pts := CASE WHEN p_won THEN 3 ELSE 1 END;
  INSERT INTO public.user_monthly_pass (user_id, month, points)
    VALUES (uid, v_month, v_pts)
    ON CONFLICT (user_id, month) DO UPDATE SET points = public.user_monthly_pass.points + v_pts;

  -- (3) Retos progresivos
  PERFORM public.ensure_progressive_challenges(uid);
  UPDATE public.user_progressive_progress upp
  SET progress = upp.progress + 1
  FROM public.progressive_challenges pc
  WHERE upp.user_id = uid AND pc.code = upp.code AND pc.active
    AND ( pc.goal_type = 'play_any'
       OR (pc.goal_type = 'win_any' AND p_won)
       OR (pc.goal_type = 'win_game' AND p_won AND pc.goal_game = p_game_slug) );

  -- (4) Fichas por ganar
  IF p_won THEN
    PERFORM public.award_fichas(uid, 10, 'game_win', json_build_object('game', p_game_slug)::jsonb);
  END IF;
END$$;
REVOKE ALL ON FUNCTION public.report_game_result(TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_game_result(TEXT, BOOLEAN) TO authenticated;

COMMIT;
