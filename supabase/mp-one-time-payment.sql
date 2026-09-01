-- ============================================================
-- FULVO — PAGO ÚNICO DE MERCADOPAGO
-- Corre esto en el SQL Editor de Supabase, DESPUÉS de premium-schema.sql
-- ============================================================

-- 1. Columna nueva: distingue suscripción con renovación automática
--    (débito automático) de pago único (vence solo, sin recobro).
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN NOT NULL DEFAULT true;

-- 2. activate_subscription: gana p_auto_renew (default true, no rompe
--    a los callers existentes del webhook que todavía no lo pasan).
CREATE OR REPLACE FUNCTION public.activate_subscription(
  p_user_id UUID,
  p_plan_slug TEXT,
  p_provider TEXT,
  p_provider_id TEXT,
  p_period_start TIMESTAMPTZ,
  p_period_end TIMESTAMPTZ,
  p_auto_renew BOOLEAN DEFAULT true
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, plan_slug, status, provider, provider_subscription_id, current_period_start, current_period_end, auto_renew, updated_at)
  VALUES (p_user_id, p_plan_slug, 'active', p_provider, p_provider_id, p_period_start, p_period_end, p_auto_renew, now())
  ON CONFLICT (user_id) DO UPDATE SET
    plan_slug = EXCLUDED.plan_slug,
    status = 'active',
    provider = EXCLUDED.provider,
    provider_subscription_id = EXCLUDED.provider_subscription_id,
    current_period_start = EXCLUDED.current_period_start,
    current_period_end = EXCLUDED.current_period_end,
    auto_renew = EXCLUDED.auto_renew,
    updated_at = now();

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

-- 3. get_user_plan: agrega "autoRenew" al JSON de salida.
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
    RETURN json_build_object('plan', 'free', 'status', 'active', 'autoRenew', true);
  END IF;

  SELECT * INTO sub FROM public.subscriptions
    WHERE user_id = uid AND status = 'active'
    LIMIT 1;

  IF sub IS NOT NULL AND sub.plan_slug != 'free' AND sub.current_period_end IS NOT NULL AND sub.current_period_end < now() THEN
    UPDATE public.subscriptions SET status = 'expired', updated_at = now() WHERE id = sub.id;
    sub.plan_slug := 'free';
    sub.status := 'expired';
  END IF;

  SELECT * INTO plan FROM public.plans WHERE slug = COALESCE(sub.plan_slug, 'free');

  INSERT INTO public.powerup_inventory (user_id) VALUES (uid) ON CONFLICT DO NOTHING;
  SELECT * INTO inv FROM public.powerup_inventory WHERE user_id = uid;

  IF inv.last_daily_reset < CURRENT_DATE THEN
    UPDATE public.powerup_inventory SET
      fifty_fifty = plan.daily_powerups,
      shield = plan.daily_powerups,
      extra_time = plan.daily_powerups,
      reveal_hint = plan.daily_powerups,
      last_daily_reset = CURRENT_DATE
    WHERE user_id = uid;
    SELECT * INTO inv FROM public.powerup_inventory WHERE user_id = uid;
  END IF;

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
    'autoRenew', COALESCE(sub.auto_renew, true),
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

GRANT EXECUTE ON FUNCTION public.get_user_plan TO authenticated;
