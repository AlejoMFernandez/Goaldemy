-- ════════════════════════════════════════════════════════════════════
--  2026-11-24-08 — RACHA DIARIA CALCULADA EN EL SERVIDOR (HORA ARGENTINA)
-- ════════════════════════════════════════════════════════════════════
--  QUÉ:
--   1) _touch_daily_streak(uid) + RPC touch_daily_streak(): calcula la racha
--      con public.app_today() (America/Argentina/Buenos_Aires):
--        • ya contó hoy → no cambia;
--        • jugó ayer → +1;
--        • faltó 1 a 3 días y tiene esa cantidad de "protector de racha"
--          (powerup_inventory.streak_protector) → los CONSUME y la racha sigue (+1);
--        • si no → vuelve a 1.
--      Actualiza best_daily_streak.
--   2) report_game_result (parche 06) ya la llama → la racha avanza al
--      terminar un desafío AUNQUE el cliente sea el viejo.
--   3) Trigger en user_profiles: el cliente ya NO puede escribir
--      daily_streak / best_daily_streak / last_activity_date (los cambios se
--      ignoran en silencio, así el cliente viejo no tira error).
--   4) get_streak_reminder_targets: "jugó ayer" pasa a ser ayer en hora ART.
--
--  POR QUÉ: la racha la escribía el cliente (daily-streak.js) en
--      user_profiles con UPDATE libre → cualquiera se ponía racha 365 y
--      desbloqueaba daily_streak_30 (+ cosméticos legendarios). Además usaba
--      fecha UTC: entre las 21:00 y 24:00 ART "hoy" ya era mañana, y la racha
--      se cortaba o duplicaba según la hora.
--
--  RIESGO: Bajo-medio.
--   • El día de la transición, quien tenga last_activity_date en UTC "mañana"
--     cuenta como "ya jugó hoy" (puede perder +1 una sola vez).
--   • Con el cliente viejo, daily-streak.js sigue intentando escribir: no
--     rompe (se ignora) pero su toast/cálculo local puede mostrar un número
--     distinto por un rato. Con VITE_SERVER_ECONOMY=1 usa la RPC.
--   • Los protectores se consumen solos al volver (antes no hacían nada).
--
--  ROLLBACK:
--      BEGIN;
--      DROP TRIGGER IF EXISTS user_profiles_protect_streak ON public.user_profiles;
--      -- touch_daily_streak puede quedar; report_game_result la sigue llamando
--      -- (si querés apagarla: CREATE OR REPLACE FUNCTION public._touch_daily_streak(p_uid uuid)
--      --  RETURNS json LANGUAGE sql SECURITY DEFINER AS $$ SELECT NULL::json $$;)
--      COMMIT;
-- ════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS daily_streak INTEGER DEFAULT 0;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS best_daily_streak INTEGER DEFAULT 0;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS last_activity_date DATE;

CREATE OR REPLACE FUNCTION public._touch_daily_streak(p_uid UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  MAX_PROTECTED_GAP CONSTANT INTEGER := 3;   -- días salteados que puede cubrir el protector
  v_today  DATE := public.app_today();
  v_prof   RECORD;
  v_prev   INTEGER;
  v_new    INTEGER;
  v_best   INTEGER;
  v_missed INTEGER;
  v_prot   INTEGER := 0;
  v_used   INTEGER := 0;
BEGIN
  IF p_uid IS NULL THEN RETURN json_build_object('ok', false, 'error', 'auth'); END IF;

  SELECT daily_streak, best_daily_streak, last_activity_date INTO v_prof
  FROM public.user_profiles WHERE id = p_uid FOR UPDATE;
  IF NOT FOUND THEN RETURN json_build_object('ok', false, 'error', 'no_profile'); END IF;

  v_prev := COALESCE(v_prof.daily_streak, 0);
  v_best := COALESCE(v_prof.best_daily_streak, 0);

  -- Ya contó hoy (o hay una fecha "futura" escrita en UTC por el cliente viejo)
  IF v_prof.last_activity_date IS NOT NULL AND v_prof.last_activity_date >= v_today THEN
    RETURN json_build_object('ok', true, 'updated', false, 'streak', v_prev, 'best', v_best, 'reason', 'already_today');
  END IF;

  IF v_prof.last_activity_date IS NULL THEN
    v_new := 1;
  ELSIF v_prof.last_activity_date = v_today - 1 THEN
    v_new := v_prev + 1;
  ELSE
    v_missed := (v_today - v_prof.last_activity_date) - 1;
    SELECT COALESCE(streak_protector, 0) INTO v_prot FROM public.powerup_inventory WHERE user_id = p_uid FOR UPDATE;
    IF v_prev > 0 AND v_missed <= MAX_PROTECTED_GAP AND COALESCE(v_prot, 0) >= v_missed THEN
      UPDATE public.powerup_inventory SET streak_protector = streak_protector - v_missed WHERE user_id = p_uid;
      v_used := v_missed;
      v_new := v_prev + 1;
    ELSE
      v_new := 1;
    END IF;
  END IF;

  UPDATE public.user_profiles
    SET daily_streak = v_new,
        best_daily_streak = GREATEST(v_best, v_new),
        last_activity_date = v_today
  WHERE id = p_uid;

  RETURN json_build_object('ok', true, 'updated', true, 'streak', v_new, 'previous', v_prev,
                           'best', GREATEST(v_best, v_new), 'is_best', v_new > v_best,
                           'protector_used', v_used);
END$$;
REVOKE ALL ON FUNCTION public._touch_daily_streak(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.touch_daily_streak()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN json_build_object('ok', false, 'error', 'auth'); END IF;
  -- Solo cuenta si jugó algo hoy (al menos una partida iniciada hoy ART)
  IF NOT EXISTS (
    SELECT 1 FROM public.game_sessions
    WHERE user_id = auth.uid()
      AND started_at >= (public.app_today()::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires')
  ) THEN
    RETURN json_build_object('ok', false, 'error', 'no_activity_today');
  END IF;
  RETURN public._touch_daily_streak(auth.uid());
END$$;
REVOKE ALL ON FUNCTION public.touch_daily_streak() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.touch_daily_streak() TO authenticated;

-- El cliente no escribe más la racha (silencioso para no romper el cliente viejo)
CREATE OR REPLACE FUNCTION public.tg_user_profiles_protect_streak()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.daily_streak := 0;
    NEW.best_daily_streak := 0;
    NEW.last_activity_date := NULL;
  ELSE
    NEW.daily_streak := OLD.daily_streak;
    NEW.best_daily_streak := OLD.best_daily_streak;
    NEW.last_activity_date := OLD.last_activity_date;
  END IF;
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS user_profiles_protect_streak ON public.user_profiles;
CREATE TRIGGER user_profiles_protect_streak
  BEFORE INSERT OR UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_user_profiles_protect_streak();

-- Recordatorio de racha: "jugó ayer" en hora Argentina
CREATE OR REPLACE FUNCTION public.get_streak_reminder_targets()
RETURNS TABLE (user_id UUID, email TEXT, display_name TEXT, daily_streak INTEGER)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.email, p.display_name, p.daily_streak
  FROM public.user_profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.last_activity_date = (public.app_today() - 1)
    AND COALESCE(p.daily_streak, 0) >= 2
    AND p.email IS NOT NULL
    AND u.email_confirmed_at IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.streak_reminder_log l
      WHERE l.user_id = p.id AND l.day_key = current_date
    );
$$;
REVOKE ALL ON FUNCTION public.get_streak_reminder_targets() FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_streak_reminder_targets() TO service_role;

COMMIT;
