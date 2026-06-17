-- ============================================================
-- GOALDEMY — RECOMPENSAS FASE 3
-- Retos progresivos (estilo Clash): se auto-upgradean al reclamar.
-- objetivo(tier) = ceil(base_target * target_mult^(tier-1))
-- recompensa_xp(tier) = base_reward_xp * tier ; powerup en tiers pares.
-- Correr DESPUÉS de rewards-phase2.sql. Idempotente.
-- ============================================================

-- ─── 1. Catálogo de retos progresivos ──────────────────────
CREATE TABLE IF NOT EXISTS public.progressive_challenges (
  code TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  goal_type TEXT NOT NULL,              -- 'play_any' | 'win_any' | 'win_game'
  goal_game TEXT,
  icon TEXT DEFAULT '🏆',
  base_target INTEGER NOT NULL DEFAULT 5,
  target_mult NUMERIC NOT NULL DEFAULT 3,
  base_reward_xp INTEGER NOT NULL DEFAULT 100,
  reward_powerup TEXT,                  -- type otorgado en tiers pares (nullable)
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true
);

-- ─── 2. Progreso por usuario (tier actual + avance) ─────────
CREATE TABLE IF NOT EXISTS public.user_progressive_progress (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL REFERENCES public.progressive_challenges(code) ON DELETE CASCADE,
  tier INTEGER NOT NULL DEFAULT 1,
  progress INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, code)
);

-- ─── 3. RLS ─────────────────────────────────────────────────
ALTER TABLE public.progressive_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_progressive_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Progressive challenges public" ON public.progressive_challenges;
DROP POLICY IF EXISTS "Users read own progressive" ON public.user_progressive_progress;

CREATE POLICY "Progressive challenges public" ON public.progressive_challenges FOR SELECT USING (true);
CREATE POLICY "Users read own progressive" ON public.user_progressive_progress
  FOR SELECT USING (auth.uid() = user_id);

-- ─── 4. Seed ────────────────────────────────────────────────
INSERT INTO public.progressive_challenges (code, title, description, goal_type, goal_game, icon, base_target, target_mult, base_reward_xp, reward_powerup, sort_order) VALUES
  ('prog_win',   'Maestro del fútbol', 'Ganá desafíos (sube cada vez)',      'win_any',  NULL,            '🏆', 10, 2,   150, NULL,          10),
  ('prog_play',  'Incansable',         'Jugá desafíos (sube cada vez)',      'play_any', NULL,            '🎮', 20, 2,   100, 'extra_time',  20),
  ('prog_nat',   'Vuelta al mundo',    'Ganá Nacionalidad (sube cada vez)',  'win_game', 'nationality',   '🌍', 5,  3,   120, 'reveal_hint', 30),
  ('prog_guess', 'Ojo de águila',      'Ganá Adivina el jugador',            'win_game', 'guess-player',  '🕵️', 5,  3,   120, 'fifty_fifty', 40),
  ('prog_pos',   'Mariscal de campo',  'Ganá Posición del jugador',          'win_game', 'player-position','📌', 5,  3,   120, 'shield',      50)
ON CONFLICT (code) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, goal_type = EXCLUDED.goal_type,
  goal_game = EXCLUDED.goal_game, icon = EXCLUDED.icon, base_target = EXCLUDED.base_target,
  target_mult = EXCLUDED.target_mult, base_reward_xp = EXCLUDED.base_reward_xp,
  reward_powerup = EXCLUDED.reward_powerup, sort_order = EXCLUDED.sort_order;

-- ─── 5. Helper: asegurar filas de progreso del usuario ──────
CREATE OR REPLACE FUNCTION public.ensure_progressive_challenges(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_progressive_progress (user_id, code, tier, progress)
  SELECT p_user_id, pc.code, 1, 0 FROM public.progressive_challenges pc WHERE pc.active
  ON CONFLICT (user_id, code) DO NOTHING;
END$$;

-- ─── 6. report_game_result (REEMPLAZA al de fase 2) ─────────
-- Retos diarios + pase mensual + retos progresivos, todo junto.
CREATE OR REPLACE FUNCTION public.report_game_result(p_game_slug TEXT, p_won BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  v_month DATE := date_trunc('month', CURRENT_DATE)::date;
  v_pts INTEGER;
BEGIN
  IF uid IS NULL THEN RETURN; END IF;

  -- (1) Retos diarios
  PERFORM public.ensure_daily_challenges(uid);
  UPDATE public.user_daily_challenges udc
  SET progress = LEAST(udc.target, udc.progress + 1)
  FROM public.daily_challenges dc
  WHERE udc.user_id = uid AND udc.day = CURRENT_DATE AND udc.claimed = false
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
END$$;

-- ─── 7. RPC: obtener retos progresivos ──────────────────────
CREATE OR REPLACE FUNCTION public.get_progressive_challenges()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  result JSON;
BEGIN
  IF uid IS NULL THEN RETURN '[]'::json; END IF;
  PERFORM public.ensure_progressive_challenges(uid);

  SELECT COALESCE(json_agg(t ORDER BY t.sort_order), '[]'::json) INTO result
  FROM (
    SELECT pc.code, pc.title, pc.description, pc.icon, pc.sort_order,
           upp.tier, upp.progress,
           ceil(pc.base_target * power(pc.target_mult, upp.tier - 1))::int AS target,
           (pc.base_reward_xp * upp.tier) AS reward_xp,
           pc.reward_powerup,
           CASE WHEN pc.reward_powerup IS NOT NULL AND upp.tier % 2 = 0 THEN 1 ELSE 0 END AS reward_powerup_qty,
           (upp.progress >= ceil(pc.base_target * power(pc.target_mult, upp.tier - 1))::int) AS claimable
    FROM public.user_progressive_progress upp
    JOIN public.progressive_challenges pc ON pc.code = upp.code
    WHERE upp.user_id = uid AND pc.active
  ) t;

  RETURN result;
END$$;

-- ─── 8. RPC: reclamar un reto progresivo (sube de tier) ─────
CREATE OR REPLACE FUNCTION public.claim_progressive(p_code TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  c RECORD;
  p RECORD;
  v_target INTEGER;
  v_xp INTEGER;
  v_qty INTEGER;
  v_new_tier INTEGER;
  v_new_target INTEGER;
BEGIN
  IF uid IS NULL THEN RETURN json_build_object('ok', false, 'error', 'auth'); END IF;

  SELECT * INTO c FROM public.progressive_challenges WHERE code = p_code;
  IF c IS NULL THEN RETURN json_build_object('ok', false, 'error', 'not_found'); END IF;

  SELECT * INTO p FROM public.user_progressive_progress WHERE user_id = uid AND code = p_code;
  IF p IS NULL THEN RETURN json_build_object('ok', false, 'error', 'not_found'); END IF;

  v_target := ceil(c.base_target * power(c.target_mult, p.tier - 1))::int;
  IF p.progress < v_target THEN RETURN json_build_object('ok', false, 'error', 'incomplete'); END IF;

  v_xp := c.base_reward_xp * p.tier;
  v_qty := CASE WHEN c.reward_powerup IS NOT NULL AND p.tier % 2 = 0 THEN 1 ELSE 0 END;

  IF v_xp > 0 THEN
    PERFORM public.award_xp(v_xp, 'progressive_challenge', NULL, NULL, json_build_object('code', p_code, 'tier', p.tier)::jsonb);
  END IF;
  IF c.reward_powerup IS NOT NULL AND v_qty > 0 THEN
    PERFORM public.grant_powerup(uid, c.reward_powerup, v_qty);
  END IF;

  -- Subir de tier, arrastrando el excedente de progreso
  UPDATE public.user_progressive_progress
    SET tier = tier + 1, progress = GREATEST(0, progress - v_target)
    WHERE user_id = uid AND code = p_code;

  v_new_tier := p.tier + 1;
  v_new_target := ceil(c.base_target * power(c.target_mult, v_new_tier - 1))::int;

  RETURN json_build_object(
    'ok', true, 'title', c.title, 'xp', v_xp,
    'powerup', c.reward_powerup, 'powerup_qty', v_qty,
    'new_tier', v_new_tier, 'new_target', v_new_target
  );
END$$;

-- ─── 9. Grants ──────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.get_progressive_challenges() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_progressive(TEXT) TO authenticated;
