-- ============================================================
-- GOALDEMY — RECOMPENSAS FASE 1
-- Retos diarios + recompensa diaria (XP entre semana / powerup el finde)
-- Correr en Supabase SQL Editor. Es idempotente (se puede correr de nuevo).
-- Depende de: schema.sql (award_xp, xp_events) y premium-schema.sql (powerup_inventory, subscriptions)
-- ============================================================

-- ─── 1. Catálogo de retos diarios ───────────────────────────
CREATE TABLE IF NOT EXISTS public.daily_challenges (
  code TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  goal_type TEXT NOT NULL,              -- 'play_any' | 'win_any' | 'win_game'
  goal_game TEXT,                       -- slug del juego (solo para 'win_game')
  goal_target INTEGER NOT NULL DEFAULT 1,
  reward_xp INTEGER NOT NULL DEFAULT 0,
  reward_powerup TEXT,                  -- null | fifty_fifty | shield | extra_time | reveal_hint
  reward_powerup_qty INTEGER NOT NULL DEFAULT 0,
  icon TEXT DEFAULT '🎯',
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true
);

-- ─── 2. Progreso de retos diarios por usuario/día ───────────
CREATE TABLE IF NOT EXISTS public.user_daily_challenges (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day DATE NOT NULL DEFAULT CURRENT_DATE,
  challenge_code TEXT NOT NULL REFERENCES public.daily_challenges(code) ON DELETE CASCADE,
  progress INTEGER NOT NULL DEFAULT 0,
  target INTEGER NOT NULL,
  claimed BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (user_id, day, challenge_code)
);
CREATE INDEX IF NOT EXISTS idx_udc_user_day ON public.user_daily_challenges(user_id, day);

-- ─── 3. Ledger de recompensa diaria (1 por día por tipo) ────
CREATE TABLE IF NOT EXISTS public.user_daily_claims (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day DATE NOT NULL DEFAULT CURRENT_DATE,
  kind TEXT NOT NULL,                   -- 'daily'
  reward_kind TEXT,                     -- 'xp' | 'powerup'
  reward_powerup TEXT,
  amount INTEGER DEFAULT 0,
  claimed_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, day, kind)
);

-- ─── 4. RLS ─────────────────────────────────────────────────
ALTER TABLE public.daily_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_daily_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_daily_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Daily challenges public" ON public.daily_challenges;
DROP POLICY IF EXISTS "Users read own daily challenges" ON public.user_daily_challenges;
DROP POLICY IF EXISTS "Users read own daily claims" ON public.user_daily_claims;

CREATE POLICY "Daily challenges public" ON public.daily_challenges FOR SELECT USING (true);
CREATE POLICY "Users read own daily challenges" ON public.user_daily_challenges
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users read own daily claims" ON public.user_daily_claims
  FOR SELECT USING (auth.uid() = user_id);

-- ─── 5. Seed de retos (editá libremente) ────────────────────
INSERT INTO public.daily_challenges (code, title, description, goal_type, goal_game, goal_target, reward_xp, reward_powerup, reward_powerup_qty, icon, sort_order) VALUES
  ('win_1',        'Primera victoria',      'Ganá 1 desafío hoy',                'win_any',  NULL,          1, 60,  NULL,          0, '✅', 10),
  ('win_3',        'En racha',              'Ganá 3 desafíos hoy',               'win_any',  NULL,          3, 150, NULL,          0, '🔥', 20),
  ('play_5',       'Calentando',            'Jugá 5 desafíos hoy',               'play_any', NULL,          5, 120, NULL,          0, '🎮', 30),
  ('win_nat_2',    'Geógrafo',              'Ganá 2 veces Nacionalidad',         'win_game', 'nationality', 2, 120, NULL,          0, '🌍', 40),
  ('win_guess_2',  'Detective',             'Ganá 2 veces Adivina el jugador',   'win_game', 'guess-player',2, 120, NULL,          0, '🕵️', 50),
  ('win_5_pu',     'Cazador de premios',    'Ganá 5 desafíos hoy',               'win_any',  NULL,          5, 0,   'fifty_fifty', 1, '🎁', 60),
  ('play_3',       'Constancia',            'Jugá 3 desafíos hoy',               'play_any', NULL,          3, 80,  NULL,          0, '📅', 70),
  ('win_pos_2',    'Táctico',               'Ganá 2 veces Posición',             'win_game', 'player-position',2,120,NULL,        0, '📌', 80)
ON CONFLICT (code) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, goal_type = EXCLUDED.goal_type,
  goal_game = EXCLUDED.goal_game, goal_target = EXCLUDED.goal_target, reward_xp = EXCLUDED.reward_xp,
  reward_powerup = EXCLUDED.reward_powerup, reward_powerup_qty = EXCLUDED.reward_powerup_qty,
  icon = EXCLUDED.icon, sort_order = EXCLUDED.sort_order;

-- ─── 6. Helper: otorgar powerups (whitelist de columnas) ────
CREATE OR REPLACE FUNCTION public.grant_powerup(p_user_id UUID, p_type TEXT, p_qty INTEGER)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE col TEXT;
BEGIN
  IF p_qty IS NULL OR p_qty <= 0 THEN RETURN; END IF;
  CASE p_type
    WHEN 'fifty_fifty' THEN col := 'fifty_fifty';
    WHEN 'shield' THEN col := 'shield';
    WHEN 'extra_time' THEN col := 'extra_time';
    WHEN 'reveal_hint' THEN col := 'reveal_hint';
    WHEN 'streak_protector' THEN col := 'streak_protector';
    ELSE RETURN;
  END CASE;
  INSERT INTO public.powerup_inventory (user_id) VALUES (p_user_id) ON CONFLICT DO NOTHING;
  EXECUTE format('UPDATE public.powerup_inventory SET %I = %I + $1 WHERE user_id = $2', col, col)
    USING p_qty, p_user_id;
END$$;

-- ─── 7. Helper interno: asignar los retos de hoy ────────────
CREATE OR REPLACE FUNCTION public.ensure_daily_challenges(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_plan TEXT;
  v_count INTEGER;
BEGIN
  SELECT plan_slug INTO v_plan FROM public.subscriptions
    WHERE user_id = p_user_id AND status = 'active'
      AND (current_period_end IS NULL OR current_period_end > now())
    LIMIT 1;
  v_plan := COALESCE(v_plan, 'free');
  v_count := CASE v_plan WHEN 'legend' THEN 6 WHEN 'pro' THEN 4 ELSE 2 END;

  -- Selección determinística por día (rota cada día, igual para todo el día)
  INSERT INTO public.user_daily_challenges (user_id, day, challenge_code, progress, target, claimed)
  SELECT p_user_id, CURRENT_DATE, dc.code, 0, dc.goal_target, false
  FROM public.daily_challenges dc
  WHERE dc.active
  ORDER BY md5(dc.code || CURRENT_DATE::text)
  LIMIT v_count
  ON CONFLICT (user_id, day, challenge_code) DO NOTHING;
END$$;

-- ─── 8. RPC: obtener retos de hoy (con progreso) ────────────
CREATE OR REPLACE FUNCTION public.get_daily_challenges()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  result JSON;
BEGIN
  IF uid IS NULL THEN RETURN '[]'::json; END IF;
  PERFORM public.ensure_daily_challenges(uid);

  SELECT COALESCE(json_agg(t ORDER BY t.sort_order), '[]'::json) INTO result
  FROM (
    SELECT dc.code, dc.title, dc.description, dc.icon, dc.goal_type, dc.sort_order,
           udc.progress, udc.target, udc.claimed,
           dc.reward_xp, dc.reward_powerup, dc.reward_powerup_qty
    FROM public.user_daily_challenges udc
    JOIN public.daily_challenges dc ON dc.code = udc.challenge_code
    WHERE udc.user_id = uid AND udc.day = CURRENT_DATE
  ) t;

  RETURN result;
END$$;

-- ─── 9. RPC: reportar resultado de un juego (suma progreso) ─
CREATE OR REPLACE FUNCTION public.report_game_result(p_game_slug TEXT, p_won BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN; END IF;
  PERFORM public.ensure_daily_challenges(uid);

  UPDATE public.user_daily_challenges udc
  SET progress = LEAST(udc.target, udc.progress + 1)
  FROM public.daily_challenges dc
  WHERE udc.user_id = uid AND udc.day = CURRENT_DATE AND udc.claimed = false
    AND dc.code = udc.challenge_code
    AND (
      dc.goal_type = 'play_any'
      OR (dc.goal_type = 'win_any' AND p_won)
      OR (dc.goal_type = 'win_game' AND p_won AND dc.goal_game = p_game_slug)
    );
END$$;

-- ─── 10. RPC: reclamar un reto diario ───────────────────────
CREATE OR REPLACE FUNCTION public.claim_daily_challenge(p_code TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  rec RECORD;
  cat RECORD;
BEGIN
  IF uid IS NULL THEN RETURN json_build_object('ok', false, 'error', 'auth'); END IF;

  SELECT * INTO rec FROM public.user_daily_challenges
    WHERE user_id = uid AND day = CURRENT_DATE AND challenge_code = p_code;
  IF rec IS NULL THEN RETURN json_build_object('ok', false, 'error', 'not_found'); END IF;
  IF rec.claimed THEN RETURN json_build_object('ok', false, 'error', 'already_claimed'); END IF;
  IF rec.progress < rec.target THEN RETURN json_build_object('ok', false, 'error', 'incomplete'); END IF;

  SELECT * INTO cat FROM public.daily_challenges WHERE code = p_code;

  UPDATE public.user_daily_challenges SET claimed = true
    WHERE user_id = uid AND day = CURRENT_DATE AND challenge_code = p_code;

  IF cat.reward_xp > 0 THEN
    PERFORM public.award_xp(cat.reward_xp, 'daily_challenge', NULL, NULL, json_build_object('code', p_code)::jsonb);
  END IF;
  IF cat.reward_powerup IS NOT NULL AND cat.reward_powerup_qty > 0 THEN
    PERFORM public.grant_powerup(uid, cat.reward_powerup, cat.reward_powerup_qty);
  END IF;

  RETURN json_build_object(
    'ok', true, 'title', cat.title,
    'reward_xp', cat.reward_xp,
    'reward_powerup', cat.reward_powerup,
    'reward_powerup_qty', cat.reward_powerup_qty
  );
END$$;

-- ─── 11. RPC: estado de la recompensa diaria ────────────────
-- Entre semana: XP. Fin de semana (sáb/dom): un powerup rotativo
-- (rota por semana del año → en el mes juntás 1 de cada).
CREATE OR REPLACE FUNCTION public.get_daily_reward()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  v_weekend BOOLEAN;
  v_type TEXT;
  v_claimed BOOLEAN;
BEGIN
  IF uid IS NULL THEN RETURN json_build_object('available', false); END IF;
  v_weekend := EXTRACT(DOW FROM CURRENT_DATE) IN (0, 6);
  v_type := (ARRAY['fifty_fifty','shield','extra_time','reveal_hint'])[(EXTRACT(WEEK FROM CURRENT_DATE)::int % 4) + 1];
  SELECT EXISTS(SELECT 1 FROM public.user_daily_claims WHERE user_id = uid AND day = CURRENT_DATE AND kind = 'daily') INTO v_claimed;

  RETURN json_build_object(
    'available', NOT v_claimed,
    'claimed', v_claimed,
    'reward_kind', CASE WHEN v_weekend THEN 'powerup' ELSE 'xp' END,
    'reward_powerup', CASE WHEN v_weekend THEN v_type ELSE NULL END,
    'amount', CASE WHEN v_weekend THEN 1 ELSE 100 END
  );
END$$;

-- ─── 12. RPC: reclamar la recompensa diaria ─────────────────
CREATE OR REPLACE FUNCTION public.claim_daily_reward()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  v_weekend BOOLEAN;
  v_type TEXT;
  v_xp INTEGER := 100;
BEGIN
  IF uid IS NULL THEN RETURN json_build_object('ok', false, 'error', 'auth'); END IF;

  IF EXISTS(SELECT 1 FROM public.user_daily_claims WHERE user_id = uid AND day = CURRENT_DATE AND kind = 'daily') THEN
    RETURN json_build_object('ok', false, 'error', 'already_claimed');
  END IF;

  v_weekend := EXTRACT(DOW FROM CURRENT_DATE) IN (0, 6);
  v_type := (ARRAY['fifty_fifty','shield','extra_time','reveal_hint'])[(EXTRACT(WEEK FROM CURRENT_DATE)::int % 4) + 1];

  IF v_weekend THEN
    PERFORM public.grant_powerup(uid, v_type, 1);
    INSERT INTO public.user_daily_claims (user_id, day, kind, reward_kind, reward_powerup, amount)
      VALUES (uid, CURRENT_DATE, 'daily', 'powerup', v_type, 1);
    RETURN json_build_object('ok', true, 'reward_kind', 'powerup', 'reward_powerup', v_type, 'amount', 1);
  ELSE
    PERFORM public.award_xp(v_xp, 'daily_reward', NULL, NULL, '{}'::jsonb);
    INSERT INTO public.user_daily_claims (user_id, day, kind, reward_kind, amount)
      VALUES (uid, CURRENT_DATE, 'daily', 'xp', v_xp);
    RETURN json_build_object('ok', true, 'reward_kind', 'xp', 'amount', v_xp);
  END IF;
END$$;

-- ─── 13. Grants ─────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.get_daily_challenges() TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_game_result(TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_daily_challenge(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_daily_reward() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_daily_reward() TO authenticated;
