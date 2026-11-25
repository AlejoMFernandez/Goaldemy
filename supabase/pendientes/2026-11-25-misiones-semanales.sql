-- ════════════════════════════════════════════════════════════════════
--  2026-11-25 — MISIONES SEMANALES (propuesta, NO aplicada)
-- ════════════════════════════════════════════════════════════════════
--
--  QUÉ
--   • Catálogo public.weekly_missions + progreso public.user_weekly_missions
--     (una fila por usuario/semana/misión; semana = lunes en hora Argentina).
--   • public.app_week_start()       → lunes de la semana actual (ART).
--   • public.ensure_weekly_missions(uid) → asigna 3 misiones de la semana.
--   • public.bump_weekly_missions(uid, slug, won) → suma progreso (interno).
--   • RPC get_weekly_missions()     → [{ code, title, description, icon, progress,
--                                       target, claimed, reward_xp, reward_powerup,
--                                       reward_powerup_qty, ends_at }]
--   • RPC claim_weekly_mission(code) → { ok, title, reward_xp, reward_powerup, reward_powerup_qty }
--     (misma forma que claim_daily_challenge, así la UI reusa todo).
--
--  POR QUÉ
--   El diseño aprobado de Misiones (V4) tiene un bloque "De la semana". Hoy el
--   servidor solo tiene retos diarios y progresivos, así que la UI muestra los
--   progresivos como "En curso". Con esto aplicado, la UI puede sumar el bloque
--   semanal real (falta: getWeeklyMissions/claimWeeklyMission en
--   src/services/rewards.js y pasarlos a MissionsPanel).
--
--  PASO MANUAL (no incluido para no pisar el parche 06):
--   Dentro de public.report_game_result (la versión de
--   2026-11-24-06-reclamos-dia-servidor.sql), después del bloque
--   "(3) Retos progresivos", agregar:
--       PERFORM public.bump_weekly_missions(uid, p_game_slug, p_won);
--   Así hereda la idempotencia por (usuario, juego, día) de ese parche.
--
--  RIESGO
--   Bajo: tablas y funciones nuevas, no cambia nada existente. Las recompensas
--   pasan por award_xp / grant_powerup desde SECURITY DEFINER (ruta de servidor).
--
--  ROLLBACK
--   BEGIN;
--   DROP FUNCTION IF EXISTS public.claim_weekly_mission(TEXT);
--   DROP FUNCTION IF EXISTS public.get_weekly_missions();
--   DROP FUNCTION IF EXISTS public.bump_weekly_missions(UUID, TEXT, BOOLEAN);
--   DROP FUNCTION IF EXISTS public.ensure_weekly_missions(UUID);
--   DROP FUNCTION IF EXISTS public.app_week_start();
--   DROP TABLE IF EXISTS public.user_weekly_missions;
--   DROP TABLE IF EXISTS public.weekly_missions;
--   COMMIT;
--   (y sacar el PERFORM de report_game_result si se agregó)
--
--  No se corrió contra ninguna base. Probar en staging primero.
-- ════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. Semana de la app (lunes, hora Argentina) ─────────────
CREATE OR REPLACE FUNCTION public.app_week_start()
RETURNS DATE LANGUAGE sql STABLE AS $$
  SELECT date_trunc('week', (now() AT TIME ZONE 'America/Argentina/Buenos_Aires'))::date;
$$;
GRANT EXECUTE ON FUNCTION public.app_week_start() TO authenticated;

-- ─── 2. Catálogo ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.weekly_missions (
  code TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  goal_type TEXT NOT NULL,              -- 'play_any' | 'win_any' | 'win_game'
  goal_game TEXT,                       -- slug (solo 'win_game')
  goal_target INTEGER NOT NULL DEFAULT 1 CHECK (goal_target > 0),
  reward_xp INTEGER NOT NULL DEFAULT 0 CHECK (reward_xp >= 0),
  reward_powerup TEXT,                  -- null | fifty_fifty | shield | extra_time | reveal_hint
  reward_powerup_qty INTEGER NOT NULL DEFAULT 0 CHECK (reward_powerup_qty >= 0),
  icon TEXT DEFAULT '📅',
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true
);

-- ─── 3. Progreso por usuario/semana ──────────────────────────
CREATE TABLE IF NOT EXISTS public.user_weekly_missions (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  mission_code TEXT NOT NULL REFERENCES public.weekly_missions(code) ON DELETE CASCADE,
  progress INTEGER NOT NULL DEFAULT 0,
  target INTEGER NOT NULL,
  claimed BOOLEAN NOT NULL DEFAULT false,
  claimed_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, week_start, mission_code)
);
CREATE INDEX IF NOT EXISTS idx_uwm_user_week ON public.user_weekly_missions(user_id, week_start);

-- ─── 4. RLS: catálogo público, progreso solo lectura propia ──
ALTER TABLE public.weekly_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_weekly_missions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Weekly missions public" ON public.weekly_missions;
CREATE POLICY "Weekly missions public" ON public.weekly_missions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Read own weekly missions" ON public.user_weekly_missions;
CREATE POLICY "Read own weekly missions" ON public.user_weekly_missions
  FOR SELECT USING (auth.uid() = user_id);
-- Sin INSERT/UPDATE/DELETE para clientes: todo pasa por las funciones.

-- ─── 5. Semilla (copy rioplatense) ───────────────────────────
INSERT INTO public.weekly_missions (code, title, description, goal_type, goal_game, goal_target, reward_xp, reward_powerup, reward_powerup_qty, icon, sort_order) VALUES
  ('w_play_25',   'Semana completa',     'Jugá 25 desafíos esta semana',        'play_any', NULL,              25, 300, NULL,          0, '📅', 10),
  ('w_win_15',    'Semana ganadora',     'Ganá 15 desafíos esta semana',        'win_any',  NULL,              15, 400, NULL,          0, '🏆', 20),
  ('w_win_30',    'Imparable',           'Ganá 30 desafíos esta semana',        'win_any',  NULL,              30, 0,   'shield',      1, '🛡️', 30),
  ('w_nat_8',     'Trotamundos',         'Ganá 8 veces Nacionalidad',           'win_game', 'nationality',      8, 250, NULL,          0, '🌍', 40),
  ('w_guess_8',   'Sabueso',             'Ganá 8 veces Adivina el jugador',     'win_game', 'guess-player',     8, 250, NULL,          0, '🕵️', 50),
  ('w_pos_8',     'Pizarrón',            'Ganá 8 veces Posición del jugador',   'win_game', 'player-position',  8, 250, 'reveal_hint', 1, '📌', 60)
ON CONFLICT (code) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, goal_type = EXCLUDED.goal_type,
  goal_game = EXCLUDED.goal_game, goal_target = EXCLUDED.goal_target, reward_xp = EXCLUDED.reward_xp,
  reward_powerup = EXCLUDED.reward_powerup, reward_powerup_qty = EXCLUDED.reward_powerup_qty,
  icon = EXCLUDED.icon, sort_order = EXCLUDED.sort_order;

-- ─── 6. Asignar 3 misiones de la semana (estables por usuario/semana) ─
CREATE OR REPLACE FUNCTION public.ensure_weekly_missions(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_week DATE := public.app_week_start();
BEGIN
  IF EXISTS (SELECT 1 FROM public.user_weekly_missions WHERE user_id = p_user_id AND week_start = v_week) THEN
    RETURN;
  END IF;
  INSERT INTO public.user_weekly_missions (user_id, week_start, mission_code, target)
  SELECT p_user_id, v_week, wm.code, wm.goal_target
  FROM public.weekly_missions wm
  WHERE wm.active
  ORDER BY md5(p_user_id::text || v_week::text || wm.code)
  LIMIT 3
  ON CONFLICT DO NOTHING;
END$$;
REVOKE ALL ON FUNCTION public.ensure_weekly_missions(UUID) FROM PUBLIC, anon, authenticated;

-- ─── 7. Sumar progreso (lo llama report_game_result) ─────────
CREATE OR REPLACE FUNCTION public.bump_weekly_missions(p_user_id UUID, p_game_slug TEXT, p_won BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;
  PERFORM public.ensure_weekly_missions(p_user_id);
  UPDATE public.user_weekly_missions uwm
  SET progress = LEAST(uwm.target, uwm.progress + 1)
  FROM public.weekly_missions wm
  WHERE uwm.user_id = p_user_id AND uwm.week_start = public.app_week_start()
    AND uwm.claimed = false AND wm.code = uwm.mission_code
    AND ( wm.goal_type = 'play_any'
       OR (wm.goal_type = 'win_any' AND p_won)
       OR (wm.goal_type = 'win_game' AND p_won AND wm.goal_game = p_game_slug) );
END$$;
REVOKE ALL ON FUNCTION public.bump_weekly_missions(UUID, TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;

-- ─── 8. RPC: misiones de la semana ───────────────────────────
CREATE OR REPLACE FUNCTION public.get_weekly_missions()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  v_week DATE := public.app_week_start();
  result JSON;
BEGIN
  IF uid IS NULL THEN RETURN '[]'::json; END IF;
  PERFORM public.ensure_weekly_missions(uid);
  SELECT COALESCE(json_agg(t ORDER BY t.sort_order), '[]'::json) INTO result
  FROM (
    SELECT wm.code, wm.title, wm.description, wm.icon, wm.sort_order,
           uwm.progress, uwm.target, uwm.claimed,
           wm.reward_xp, wm.reward_powerup, wm.reward_powerup_qty,
           -- próximo lunes 00:00 ART, como timestamptz
           ((v_week + 7)::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires') AS ends_at
    FROM public.user_weekly_missions uwm
    JOIN public.weekly_missions wm ON wm.code = uwm.mission_code
    WHERE uwm.user_id = uid AND uwm.week_start = v_week
  ) t;
  RETURN result;
END$$;
REVOKE ALL ON FUNCTION public.get_weekly_missions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_weekly_missions() TO authenticated;

-- ─── 9. RPC: cobrar una misión semanal ───────────────────────
CREATE OR REPLACE FUNCTION public.claim_weekly_mission(p_code TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  v_week DATE := public.app_week_start();
  rec RECORD;
  cat RECORD;
BEGIN
  IF uid IS NULL THEN RETURN json_build_object('ok', false, 'error', 'auth'); END IF;

  SELECT * INTO rec FROM public.user_weekly_missions
   WHERE user_id = uid AND week_start = v_week AND mission_code = p_code
   FOR UPDATE;
  IF rec IS NULL THEN RETURN json_build_object('ok', false, 'error', 'not_found'); END IF;
  IF rec.claimed THEN RETURN json_build_object('ok', false, 'error', 'already_claimed'); END IF;
  IF rec.progress < rec.target THEN RETURN json_build_object('ok', false, 'error', 'incomplete'); END IF;

  SELECT * INTO cat FROM public.weekly_missions WHERE code = p_code;

  UPDATE public.user_weekly_missions SET claimed = true, claimed_at = now()
   WHERE user_id = uid AND week_start = v_week AND mission_code = p_code;

  IF cat.reward_xp > 0 THEN
    PERFORM public.award_xp(cat.reward_xp, 'weekly_mission', NULL, NULL,
      json_build_object('code', p_code, 'week', v_week)::jsonb);
  END IF;
  IF cat.reward_powerup IS NOT NULL AND cat.reward_powerup_qty > 0 THEN
    PERFORM public.grant_powerup(uid, cat.reward_powerup, cat.reward_powerup_qty);
  END IF;

  RETURN json_build_object('ok', true, 'title', cat.title, 'reward_xp', cat.reward_xp,
    'reward_powerup', cat.reward_powerup, 'reward_powerup_qty', cat.reward_powerup_qty);
END$$;
REVOKE ALL ON FUNCTION public.claim_weekly_mission(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_weekly_mission(TEXT) TO authenticated;

COMMIT;
