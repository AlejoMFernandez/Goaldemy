-- ============================================================
-- GOALDEMY PREMIUM / MONETIZATION SCHEMA
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Plans configuration
CREATE TABLE IF NOT EXISTS public.plans (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price_ars INTEGER NOT NULL DEFAULT 0,
  price_usd_cents INTEGER NOT NULL DEFAULT 0,
  daily_challenges_per_game INTEGER NOT NULL DEFAULT 1,
  daily_powerups INTEGER NOT NULL DEFAULT 1,
  xp_multiplier NUMERIC(3,2) NOT NULL DEFAULT 1.00,
  weekly_streak_protectors INTEGER NOT NULL DEFAULT 0,
  badge TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

INSERT INTO public.plans (slug, name, price_ars, price_usd_cents, daily_challenges_per_game, daily_powerups, xp_multiplier, weekly_streak_protectors, badge, sort_order) VALUES
  ('free',   'Free',   0,       0,   1, 1, 1.00, 0, NULL,            0),
  ('pro',    'Pro',    1199000, 299, 3, 5, 1.25, 1, 'pro_badge',     1),
  ('legend', 'Legend', 1499000, 599, 5, 15, 1.50, 3, 'legend_badge', 2)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  price_ars = EXCLUDED.price_ars,
  price_usd_cents = EXCLUDED.price_usd_cents,
  daily_challenges_per_game = EXCLUDED.daily_challenges_per_game,
  daily_powerups = EXCLUDED.daily_powerups,
  xp_multiplier = EXCLUDED.xp_multiplier,
  weekly_streak_protectors = EXCLUDED.weekly_streak_protectors,
  badge = EXCLUDED.badge,
  sort_order = EXCLUDED.sort_order;

-- 2. User subscriptions
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_slug TEXT NOT NULL REFERENCES public.plans(slug) DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled','past_due','expired')),
  provider TEXT CHECK (provider IN ('mercadopago','stripe', NULL)),
  provider_subscription_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.subscriptions(user_id);

-- 3. Powerup inventory per user
CREATE TABLE IF NOT EXISTS public.powerup_inventory (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  fifty_fifty INTEGER NOT NULL DEFAULT 0,
  shield INTEGER NOT NULL DEFAULT 0,
  extra_time INTEGER NOT NULL DEFAULT 0,
  reveal_hint INTEGER NOT NULL DEFAULT 0,
  streak_protector INTEGER NOT NULL DEFAULT 0,
  last_daily_reset DATE DEFAULT CURRENT_DATE,
  last_weekly_reset DATE DEFAULT CURRENT_DATE
);

-- 4. RLS policies
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.powerup_inventory ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to make script re-runnable
DROP POLICY IF EXISTS "Plans are public" ON public.plans;
DROP POLICY IF EXISTS "Users read own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users read own powerups" ON public.powerup_inventory;

CREATE POLICY "Plans are public" ON public.plans FOR SELECT USING (true);
CREATE POLICY "Users read own subscription" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users read own powerups" ON public.powerup_inventory
  FOR SELECT USING (auth.uid() = user_id);

-- 5. RPC: Get user's effective plan with powerups
CREATE OR REPLACE FUNCTION public.get_user_plan(p_user_id UUID DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  uid UUID;
  sub RECORD;
  plan RECORD;
  inv RECORD;
  result JSON;
BEGIN
  uid := COALESCE(p_user_id, auth.uid());
  IF uid IS NULL THEN
    RETURN json_build_object('plan', 'free', 'status', 'active');
  END IF;

  -- Get subscription (or default to free)
  SELECT * INTO sub FROM public.subscriptions
    WHERE user_id = uid AND status = 'active'
    LIMIT 1;

  -- Check if paid plan expired
  IF sub IS NOT NULL AND sub.plan_slug != 'free' AND sub.current_period_end IS NOT NULL AND sub.current_period_end < now() THEN
    UPDATE public.subscriptions SET status = 'expired', updated_at = now() WHERE id = sub.id;
    sub.plan_slug := 'free';
    sub.status := 'expired';
  END IF;

  -- Get plan details
  SELECT * INTO plan FROM public.plans WHERE slug = COALESCE(sub.plan_slug, 'free');

  -- Get or create powerup inventory
  INSERT INTO public.powerup_inventory (user_id) VALUES (uid) ON CONFLICT DO NOTHING;
  SELECT * INTO inv FROM public.powerup_inventory WHERE user_id = uid;

  -- Auto-reset daily powerups if needed
  IF inv.last_daily_reset < CURRENT_DATE THEN
    UPDATE public.powerup_inventory SET
      fifty_fifty = plan.daily_powerups,
      shield = plan.daily_powerups,
      extra_time = plan.daily_powerups,
      reveal_hint = plan.daily_powerups,
      last_daily_reset = CURRENT_DATE
    WHERE user_id = uid;
    -- Refresh
    SELECT * INTO inv FROM public.powerup_inventory WHERE user_id = uid;
  END IF;

  -- Auto-reset weekly streak protectors
  IF inv.last_weekly_reset < (CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::int) THEN
    UPDATE public.powerup_inventory SET
      streak_protector = plan.weekly_streak_protectors,
      last_weekly_reset = CURRENT_DATE
    WHERE user_id = uid;
    SELECT * INTO inv FROM public.powerup_inventory WHERE user_id = uid;
  END IF;

  result := json_build_object(
    'plan', COALESCE(sub.plan_slug, 'free'),
    'planName', plan.name,
    'status', COALESCE(sub.status, 'active'),
    'dailyChallengesPerGame', plan.daily_challenges_per_game,
    'dailyPowerups', plan.daily_powerups,
    'xpMultiplier', plan.xp_multiplier,
    'badge', plan.badge,
    'periodEnd', sub.current_period_end,
    'powerups', json_build_object(
      'fiftyFifty', inv.fifty_fifty,
      'shield', inv.shield,
      'extraTime', inv.extra_time,
      'revealHint', inv.reveal_hint,
      'streakProtector', inv.streak_protector
    )
  );

  RETURN result;
END;
$$;

-- 6. RPC: Use a powerup (decrements count, returns success)
CREATE OR REPLACE FUNCTION public.use_powerup(p_type TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  uid UUID := auth.uid();
  current_count INTEGER;
  col_name TEXT;
BEGIN
  IF uid IS NULL THEN RETURN false; END IF;

  -- Map type to column
  CASE p_type
    WHEN 'fifty_fifty' THEN col_name := 'fifty_fifty';
    WHEN 'shield' THEN col_name := 'shield';
    WHEN 'extra_time' THEN col_name := 'extra_time';
    WHEN 'reveal_hint' THEN col_name := 'reveal_hint';
    WHEN 'streak_protector' THEN col_name := 'streak_protector';
    ELSE RETURN false;
  END CASE;

  -- Ensure inventory exists
  INSERT INTO public.powerup_inventory (user_id) VALUES (uid) ON CONFLICT DO NOTHING;

  -- Decrement atomically
  EXECUTE format(
    'UPDATE public.powerup_inventory SET %I = %I - 1 WHERE user_id = $1 AND %I > 0 RETURNING %I',
    col_name, col_name, col_name, col_name
  ) INTO current_count USING uid;

  RETURN current_count IS NOT NULL;
END;
$$;

-- 7. RPC: Activate a subscription (called by webhook)
CREATE OR REPLACE FUNCTION public.activate_subscription(
  p_user_id UUID,
  p_plan_slug TEXT,
  p_provider TEXT,
  p_provider_id TEXT,
  p_period_start TIMESTAMPTZ,
  p_period_end TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, plan_slug, status, provider, provider_subscription_id, current_period_start, current_period_end, updated_at)
  VALUES (p_user_id, p_plan_slug, 'active', p_provider, p_provider_id, p_period_start, p_period_end, now())
  ON CONFLICT (user_id) DO UPDATE SET
    plan_slug = EXCLUDED.plan_slug,
    status = 'active',
    provider = EXCLUDED.provider,
    provider_subscription_id = EXCLUDED.provider_subscription_id,
    current_period_start = EXCLUDED.current_period_start,
    current_period_end = EXCLUDED.current_period_end,
    updated_at = now();

  -- Reset powerups to new plan level
  DECLARE
    plan RECORD;
  BEGIN
    SELECT * INTO plan FROM public.plans WHERE slug = p_plan_slug;
    UPDATE public.powerup_inventory SET
      fifty_fifty = plan.daily_powerups,
      shield = plan.daily_powerups,
      extra_time = plan.daily_powerups,
      reveal_hint = plan.daily_powerups,
      streak_protector = plan.weekly_streak_protectors,
      last_daily_reset = CURRENT_DATE,
      last_weekly_reset = CURRENT_DATE
    WHERE user_id = p_user_id;
  END;
END;
$$;

-- 8. Grant execute on RPCs
GRANT EXECUTE ON FUNCTION public.get_user_plan TO authenticated;
GRANT EXECUTE ON FUNCTION public.use_powerup TO authenticated;
