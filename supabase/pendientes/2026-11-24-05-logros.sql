-- ════════════════════════════════════════════════════════════════════
--  2026-11-24-05 — LOGROS: SIN INSERT/DELETE DIRECTO, XP 1 SOLA VEZ
-- ════════════════════════════════════════════════════════════════════
--  QUÉ:
--   1) Borra las políticas "Insert own achievement" y "Delete own achievement"
--      de user_achievements y saca INSERT/UPDATE/DELETE de la tabla a
--      anon/authenticated. Solo se desbloquea vía unlock_achievement().
--   2) unlock_achievement(code, meta) endurecida (misma firma, compatible):
--        • el logro tiene que existir y estar ACTIVO;
--        • tiene que haber al menos 1 partida terminada (igual que
--          MIN_PRIOR_GAMES del cliente) — salvo logros sociales;
--        • daily_streak_N: se verifica en el servidor contra
--          user_profiles.best_daily_streak >= N (la racha la calcula el
--          servidor a partir del parche 08);
--        • tope de 10 desbloqueos por día (hora Argentina) por usuario;
--        • la XP (+ Fichas vía trigger) se paga UNA sola vez en la vida por
--          (usuario, logro), registrada en achievement_xp_awards. Aunque
--          después se borre la fila de user_achievements, no se vuelve a pagar.
--
--  POR QUÉ: con "Delete own achievement" + unlock_achievement se podía hacer
--      un bucle borrar → desbloquear → +XP +25 Fichas, infinito. Con
--      "Insert own achievement" se insertaba cualquier logro (incluidos los
--      secretos que desbloquean cosméticos legendarios) sin cumplir nada.
--
--  LIMITACIÓN (honesta): la mayoría de las reglas de logros se evalúan en el
--      CLIENTE (achievement-rules.js) a partir de game_sessions. Un tramposo
--      todavía puede pedir unlock_achievement('ojo_halcon') sin haberlo
--      ganado. Lo que se cerró es que eso sea INFINITO: ahora el máximo que
--      puede sacar es la suma de points de cada logro, una vez. Para cerrarlo
--      del todo hay que portar las reglas a SQL (tarea aparte, listada en el
--      README).
--
--  RIESGO: Bajo. El cliente no inserta ni borra user_achievements directo
--      (verificado con grep). Logros inactivos (first_correct, streak_3,
--      ten_correct, night_owl) dejan de poder desbloquearse — ya era la
--      intención de achievements-curation-2.sql.
--
--  ROLLBACK: recrear las políticas desde supabase/schema.sql (bloque "User
--      achievements") y correr de nuevo supabase/seed_achievements.sql
--      (solo la función unlock_achievement).
-- ════════════════════════════════════════════════════════════════════

BEGIN;

DROP POLICY IF EXISTS "Insert own achievement" ON public.user_achievements;
DROP POLICY IF EXISTS "Delete own achievement" ON public.user_achievements;
REVOKE INSERT, UPDATE, DELETE ON public.user_achievements FROM anon, authenticated;

ALTER TABLE public.achievements ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;

-- Registro de XP de logros ya pagada (1 vez en la vida)
CREATE TABLE IF NOT EXISTS public.achievement_xp_awards (
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  xp             INTEGER NOT NULL,
  awarded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, achievement_id)
);
ALTER TABLE public.achievement_xp_awards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "achievement_xp_awards read own" ON public.achievement_xp_awards;
CREATE POLICY "achievement_xp_awards read own" ON public.achievement_xp_awards
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Backfill: lo ya cobrado (según xp_events reason='achievement') y lo ya desbloqueado.
INSERT INTO public.achievement_xp_awards (user_id, achievement_id, xp)
SELECT DISTINCT ON (e.user_id, a.id) e.user_id, a.id, e.amount
FROM public.xp_events e
JOIN public.achievements a ON a.code = e.meta->>'achievement'
WHERE e.reason = 'achievement'
ON CONFLICT DO NOTHING;
INSERT INTO public.achievement_xp_awards (user_id, achievement_id, xp)
SELECT ua.user_id, ua.achievement_id, 0 FROM public.user_achievements ua
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.unlock_achievement(
  p_code text,
  p_meta jsonb default '{}'::jsonb
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  MAX_UNLOCKS_PER_DAY CONSTANT INTEGER := 10;
  -- Logros que no dependen de haber jugado (sociales)
  SOCIAL_CODES CONSTANT TEXT[] := ARRAY['chat_master', 'social_butterfly'];
  v_user uuid := auth.uid();
  v_ach  RECORD;
  v_inserted int := 0;
  v_paid int := 0;
  v_n int;
  v_best int;
  v_day_start TIMESTAMPTZ := (public.app_today()::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires');
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT id, points, active INTO v_ach FROM public.achievements WHERE code = p_code;
  IF v_ach.id IS NULL THEN RAISE EXCEPTION 'Achievement code % not found', p_code; END IF;

  -- Ya lo tiene → nada que hacer (respuesta idéntica a la versión anterior)
  IF EXISTS (SELECT 1 FROM public.user_achievements WHERE user_id = v_user AND achievement_id = v_ach.id) THEN
    RETURN false;
  END IF;

  IF NOT COALESCE(v_ach.active, true) THEN RETURN false; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('ach:' || v_user::text));

  -- Al menos 1 partida terminada (salvo logros sociales)
  IF NOT (p_code = ANY (SOCIAL_CODES)) AND NOT EXISTS (
       SELECT 1 FROM public.game_sessions WHERE user_id = v_user AND ended_at IS NOT NULL) THEN
    RETURN false;
  END IF;

  -- Rachas diarias: verificables en el servidor
  IF p_code ~ '^daily_streak_[0-9]+$' THEN
    v_n := substring(p_code from '[0-9]+$')::int;
    BEGIN
      SELECT GREATEST(COALESCE(best_daily_streak, 0), COALESCE(daily_streak, 0)) INTO v_best
      FROM public.user_profiles WHERE id = v_user;
    EXCEPTION WHEN undefined_column THEN v_best := NULL;
    END;
    IF COALESCE(v_best, 0) < v_n THEN RETURN false; END IF;
  END IF;

  -- Tope diario de desbloqueos
  IF (SELECT count(*) FROM public.user_achievements WHERE user_id = v_user AND earned_at >= v_day_start) >= MAX_UNLOCKS_PER_DAY THEN
    RETURN false;
  END IF;

  INSERT INTO public.user_achievements(user_id, achievement_id, metadata)
  VALUES (v_user, v_ach.id, COALESCE(p_meta, '{}'::jsonb))
  ON CONFLICT (user_id, achievement_id) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted = 0 THEN RETURN false; END IF;

  -- XP una sola vez en la vida por (usuario, logro)
  INSERT INTO public.achievement_xp_awards (user_id, achievement_id, xp)
  VALUES (v_user, v_ach.id, COALESCE(v_ach.points, 0))
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_paid = ROW_COUNT;
  IF v_paid > 0 AND COALESCE(v_ach.points, 0) > 0 THEN
    -- award_xp desde aquí corre como owner → ruta confiable (ver parche 04)
    PERFORM public.award_xp(v_ach.points, 'achievement', NULL, NULL, jsonb_build_object('achievement', p_code));
  END IF;

  RETURN true;
END$$;
REVOKE ALL ON FUNCTION public.unlock_achievement(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unlock_achievement(text, jsonb) TO authenticated;

COMMIT;
