-- ============================================================
-- GOALDEMY — RECOMPENSAS FASE 2
-- Pase mensual (battle-pass) con track gratis + premium.
-- Correr DESPUÉS de rewards-phase1.sql. Idempotente.
-- ============================================================

-- ─── 1. Catálogo de tiers del pase ──────────────────────────
CREATE TABLE IF NOT EXISTS public.monthly_pass_tiers (
  tier INTEGER PRIMARY KEY,
  points_required INTEGER NOT NULL,
  -- recompensa track GRATIS
  free_xp INTEGER NOT NULL DEFAULT 0,
  free_powerup TEXT,
  free_powerup_qty INTEGER NOT NULL DEFAULT 0,
  -- recompensa track PREMIUM (solo Pro/Legend)
  premium_xp INTEGER NOT NULL DEFAULT 0,
  premium_powerup TEXT,
  premium_powerup_qty INTEGER NOT NULL DEFAULT 0
);

-- ─── 2. Progreso mensual por usuario ────────────────────────
CREATE TABLE IF NOT EXISTS public.user_monthly_pass (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month DATE NOT NULL,                  -- primer día del mes
  points INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, month)
);

-- ─── 3. Tiers reclamados por usuario/mes/track ──────────────
CREATE TABLE IF NOT EXISTS public.user_pass_claims (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  tier INTEGER NOT NULL,
  track TEXT NOT NULL,                  -- 'free' | 'premium'
  claimed_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, month, tier, track)
);

-- ─── 4. RLS ─────────────────────────────────────────────────
ALTER TABLE public.monthly_pass_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_monthly_pass ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_pass_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Pass tiers public" ON public.monthly_pass_tiers;
DROP POLICY IF EXISTS "Users read own pass progress" ON public.user_monthly_pass;
DROP POLICY IF EXISTS "Users read own pass claims" ON public.user_pass_claims;

CREATE POLICY "Pass tiers public" ON public.monthly_pass_tiers FOR SELECT USING (true);
CREATE POLICY "Users read own pass progress" ON public.user_monthly_pass
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users read own pass claims" ON public.user_pass_claims
  FOR SELECT USING (auth.uid() = user_id);

-- ─── 5. Seed de tiers (15). Premium siempre mejor. ──────────
-- 30 niveles (mensual). Generados por fórmula: premium siempre mejor que gratis.
INSERT INTO public.monthly_pass_tiers (tier, points_required, free_xp, free_powerup, free_powerup_qty, premium_xp, premium_powerup, premium_powerup_qty)
SELECT
  n,
  (18 * n - 8),                                                                              -- puntos (alcanzable en el mes)
  (50 + n * 10),                                                                             -- XP gratis
  CASE WHEN n % 6 = 0 THEN (ARRAY['fifty_fifty','shield','extra_time','reveal_hint'])[(n % 4) + 1] ELSE NULL END,
  CASE WHEN n % 6 = 0 THEN 1 ELSE 0 END,
  (100 + n * 20),                                                                            -- XP premium (mayor)
  CASE WHEN n % 3 = 0 THEN (ARRAY['fifty_fifty','shield','extra_time','reveal_hint'])[(n % 4) + 1] ELSE NULL END,
  CASE WHEN n % 3 = 0 THEN 1 + (n / 15) ELSE 0 END
FROM generate_series(1, 30) AS n
ON CONFLICT (tier) DO UPDATE SET
  points_required = EXCLUDED.points_required,
  free_xp = EXCLUDED.free_xp, free_powerup = EXCLUDED.free_powerup, free_powerup_qty = EXCLUDED.free_powerup_qty,
  premium_xp = EXCLUDED.premium_xp, premium_powerup = EXCLUDED.premium_powerup, premium_powerup_qty = EXCLUDED.premium_powerup_qty;

-- ─── 6. report_game_result (REEMPLAZA al de fase 1) ─────────
-- Ahora también suma puntos al pase mensual (gana +3 / juega +1).
CREATE OR REPLACE FUNCTION public.report_game_result(p_game_slug TEXT, p_won BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  v_month DATE := date_trunc('month', CURRENT_DATE)::date;
  v_pts INTEGER;
BEGIN
  IF uid IS NULL THEN RETURN; END IF;

  -- Retos diarios (igual que fase 1)
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

  -- Puntos del pase mensual
  v_pts := CASE WHEN p_won THEN 3 ELSE 1 END;
  INSERT INTO public.user_monthly_pass (user_id, month, points)
    VALUES (uid, v_month, v_pts)
    ON CONFLICT (user_id, month) DO UPDATE SET points = public.user_monthly_pass.points + v_pts;
END$$;

-- ─── 7. Helper: ¿el usuario es premium (pro/legend)? ────────
CREATE OR REPLACE FUNCTION public.user_is_premium(p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.subscriptions
    WHERE user_id = p_user_id AND status = 'active'
      AND plan_slug IN ('pro','legend')
      AND (current_period_end IS NULL OR current_period_end > now())
  );
$$;

-- ─── 8. RPC: estado del pase mensual ────────────────────────
CREATE OR REPLACE FUNCTION public.get_monthly_pass()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  v_month DATE := date_trunc('month', CURRENT_DATE)::date;
  v_points INTEGER := 0;
  v_premium BOOLEAN := false;
  v_tiers JSON;
BEGIN
  IF uid IS NULL THEN RETURN json_build_object('points', 0, 'tiers', '[]'::json); END IF;

  SELECT points INTO v_points FROM public.user_monthly_pass WHERE user_id = uid AND month = v_month;
  v_points := COALESCE(v_points, 0);
  v_premium := public.user_is_premium(uid);

  SELECT COALESCE(json_agg(t ORDER BY t.tier), '[]'::json) INTO v_tiers
  FROM (
    SELECT mt.tier, mt.points_required,
           (v_points >= mt.points_required) AS unlocked,
           mt.free_xp, mt.free_powerup, mt.free_powerup_qty,
           mt.premium_xp, mt.premium_powerup, mt.premium_powerup_qty,
           EXISTS(SELECT 1 FROM public.user_pass_claims c WHERE c.user_id = uid AND c.month = v_month AND c.tier = mt.tier AND c.track = 'free') AS free_claimed,
           EXISTS(SELECT 1 FROM public.user_pass_claims c WHERE c.user_id = uid AND c.month = v_month AND c.tier = mt.tier AND c.track = 'premium') AS premium_claimed
    FROM public.monthly_pass_tiers mt
  ) t;

  RETURN json_build_object(
    'month', v_month,
    'points', v_points,
    'is_premium', v_premium,
    'tiers', v_tiers
  );
END$$;

-- ─── 9. RPC: reclamar un tier del pase ──────────────────────
CREATE OR REPLACE FUNCTION public.claim_pass_tier(p_tier INTEGER, p_track TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  v_month DATE := date_trunc('month', CURRENT_DATE)::date;
  v_points INTEGER := 0;
  v_tier RECORD;
  v_xp INTEGER;
  v_pu TEXT;
  v_qty INTEGER;
BEGIN
  IF uid IS NULL THEN RETURN json_build_object('ok', false, 'error', 'auth'); END IF;
  IF p_track NOT IN ('free','premium') THEN RETURN json_build_object('ok', false, 'error', 'bad_track'); END IF;

  SELECT * INTO v_tier FROM public.monthly_pass_tiers WHERE tier = p_tier;
  IF v_tier IS NULL THEN RETURN json_build_object('ok', false, 'error', 'not_found'); END IF;

  SELECT points INTO v_points FROM public.user_monthly_pass WHERE user_id = uid AND month = v_month;
  v_points := COALESCE(v_points, 0);
  IF v_points < v_tier.points_required THEN RETURN json_build_object('ok', false, 'error', 'locked'); END IF;

  IF p_track = 'premium' AND NOT public.user_is_premium(uid) THEN
    RETURN json_build_object('ok', false, 'error', 'premium_required');
  END IF;

  IF EXISTS(SELECT 1 FROM public.user_pass_claims WHERE user_id = uid AND month = v_month AND tier = p_tier AND track = p_track) THEN
    RETURN json_build_object('ok', false, 'error', 'already_claimed');
  END IF;

  IF p_track = 'free' THEN
    v_xp := v_tier.free_xp; v_pu := v_tier.free_powerup; v_qty := v_tier.free_powerup_qty;
  ELSE
    v_xp := v_tier.premium_xp; v_pu := v_tier.premium_powerup; v_qty := v_tier.premium_powerup_qty;
  END IF;

  IF v_xp > 0 THEN
    PERFORM public.award_xp(v_xp, 'monthly_pass', NULL, NULL, json_build_object('tier', p_tier, 'track', p_track)::jsonb);
  END IF;
  IF v_pu IS NOT NULL AND v_qty > 0 THEN
    PERFORM public.grant_powerup(uid, v_pu, v_qty);
  END IF;

  INSERT INTO public.user_pass_claims (user_id, month, tier, track) VALUES (uid, v_month, p_tier, p_track);

  RETURN json_build_object('ok', true, 'tier', p_tier, 'track', p_track, 'xp', v_xp, 'powerup', v_pu, 'powerup_qty', v_qty);
END$$;

-- ─── 10. Grants ─────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.user_is_premium(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_monthly_pass() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_pass_tier(INTEGER, TEXT) TO authenticated;
