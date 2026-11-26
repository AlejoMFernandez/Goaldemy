-- ════════════════════════════════════════════════════════════════════
--  2026-11-24-07 — game_sessions: SIN BORRAR, RESULTADO CONGELADO AL TERMINAR
-- ════════════════════════════════════════════════════════════════════
--  (ajustado al esquema REAL de producción leído el 2026-11-26: las políticas
--   se llaman "Users can insert/update/view own sessions" y NO hay política de
--   DELETE, así que el hueco "borrar para rejugar" no existe en prod.)
--  QUÉ:
--   1) Política "Delete sessions (admin)": solo admins borran (lo usa el helper
--      de desarrollo resetTodaySessionsForCurrentUser).
--   2) "Users can update own sessions" se recrea con WITH CHECK (sin check se
--      podía cambiar user_id de una fila propia).
--   3) Trigger BEFORE INSERT/UPDATE que SOLO actúa cuando escribe el cliente
--      (current_user anon/authenticated; las funciones del servidor no se tocan):
--      INSERT:
--        • started_at = now(), ended_at = NULL, score_final = NULL, xp_earned = 0
--          (no se puede crear una partida "ya terminada" ni con fecha vieja);
--        • máximo MAX_SESSIONS_PER_GAME_DAY partidas por juego por día ART.
--      UPDATE:
--        • user_id, game_id, started_at y metadata.mode son inmutables;
--        • mientras NO terminó: se puede actualizar todo; ended_at = now()
--          del servidor (no se puede antedatar ni posdatar);
--        • una vez TERMINADA: ended_at, score_final, xp_earned y la metadata
--          quedan congelados; SOLO se acepta agregar/cambiar metadata.xpView.
--      Los cambios no permitidos se IGNORAN en silencio (se conserva el valor
--      viejo) en vez de tirar error, para no romper el cliente actual.
--
--  POR QUÉ: con UPDATE/DELETE libres se podía reescribir el resultado de
--      cualquier partida propia (los logros de achievement-rules.js se
--      calculan desde game_sessions) o borrar la de hoy para rejugar.
--
--  CLIENTE (src/services/game-modes.js, NO es de este parche): sigue
--      funcionando sin cambios. Hace 2 updates por partida: el primero la
--      termina (resultado) y el segundo agrega xpView → ambos permitidos.
--      resetTodaySessionsForCurrentUser() (helper de desarrollo, sin uso en la
--      UI) deja de funcionar para no-admins: es lo buscado.
--
--  RIESGO: Bajo-medio. Si algún juego guarda datos de resultado en un 2.º
--      update DESPUÉS de terminar (además de xpView), esos datos se ignoran.
--      Hoy (grep de completeChallengeSession) el 2.º update solo manda xpView.
--
--  ROLLBACK:
--      BEGIN;
--      DROP TRIGGER IF EXISTS game_sessions_guard ON public.game_sessions;
--      DROP POLICY IF EXISTS "Delete sessions (admin)" ON public.game_sessions;
--      -- la política UPDATE original está en backup_20261126 (pg_policies)
--      COMMIT;
-- ════════════════════════════════════════════════════════════════════

BEGIN;

DROP POLICY IF EXISTS "Delete own sessions" ON public.game_sessions;
DROP POLICY IF EXISTS "Delete sessions (admin)" ON public.game_sessions;
CREATE POLICY "Delete sessions (admin)" ON public.game_sessions
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "Update own sessions" ON public.game_sessions;
DROP POLICY IF EXISTS "Users can update own sessions" ON public.game_sessions;
CREATE POLICY "Users can update own sessions" ON public.game_sessions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- SECURITY INVOKER a propósito: current_user refleja quién escribe.
CREATE OR REPLACE FUNCTION public.tg_game_sessions_guard()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  MAX_SESSIONS_PER_GAME_DAY CONSTANT INTEGER := 10;
  v_day_start TIMESTAMPTZ;
  v_count INTEGER;
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;   -- servidor / service_role / SQL Editor: sin restricciones
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.started_at  := now();
    NEW.ended_at    := NULL;
    NEW.score_final := NULL;
    NEW.xp_earned   := 0;
    NEW.metadata    := COALESCE(NEW.metadata, '{}'::jsonb);

    v_day_start := (public.app_today()::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires');
    SELECT count(*) INTO v_count FROM public.game_sessions
      WHERE user_id = NEW.user_id AND game_id = NEW.game_id AND started_at >= v_day_start;
    IF v_count >= MAX_SESSIONS_PER_GAME_DAY THEN
      RAISE EXCEPTION 'Demasiadas partidas de este juego hoy' USING ERRCODE = '54000';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  NEW.user_id    := OLD.user_id;
  NEW.game_id    := OLD.game_id;
  NEW.started_at := OLD.started_at;
  NEW.metadata   := COALESCE(NEW.metadata, '{}'::jsonb);
  IF OLD.metadata ? 'mode' THEN
    NEW.metadata := jsonb_set(NEW.metadata, '{mode}', OLD.metadata->'mode');
  END IF;

  IF OLD.ended_at IS NOT NULL THEN
    -- Ya terminada: congelada. Solo se acepta metadata.xpView.
    NEW.ended_at    := OLD.ended_at;
    NEW.score_final := OLD.score_final;
    NEW.xp_earned   := OLD.xp_earned;
    NEW.metadata    := CASE WHEN NEW.metadata ? 'xpView'
                            THEN OLD.metadata || jsonb_build_object('xpView', NEW.metadata->'xpView')
                            ELSE OLD.metadata END;
  ELSIF NEW.ended_at IS NOT NULL THEN
    NEW.ended_at := now();   -- hora del servidor
  END IF;

  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS game_sessions_guard ON public.game_sessions;
CREATE TRIGGER game_sessions_guard
  BEFORE INSERT OR UPDATE ON public.game_sessions
  FOR EACH ROW EXECUTE FUNCTION public.tg_game_sessions_guard();

REVOKE ALL ON FUNCTION public.tg_game_sessions_guard() FROM PUBLIC, anon, authenticated;

COMMIT;

-- Verificación: trigger activo, UPDATE con WITH CHECK y DELETE solo admin.
SELECT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'game_sessions_guard' AND tgrelid = 'public.game_sessions'::regclass)
   AND EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'game_sessions'
               AND policyname = 'Users can update own sessions' AND with_check IS NOT NULL)
   AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'game_sessions'
               AND cmd IN ('DELETE', 'ALL') AND policyname <> 'Delete sessions (admin)') AS ok;
