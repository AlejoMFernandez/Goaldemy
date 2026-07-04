-- ============================================================
-- GOALDEMY — MEJORAS7: HORARIOS ARGENTINA + BASE DEL PASE
--
-- (A) Alinea TODOS los reseteos de recompensas al día/mes de
--     Argentina (America/Argentina/Buenos_Aires), igual que los
--     juegos que resetean a medianoche local del navegador.
--     Antes usaban CURRENT_DATE = UTC → el mes cambiaba a las
--     21:00 ART del día anterior (por eso el pase saltó a julio
--     3 horas antes que los juegos).
--
-- (B) Convierte el pase mensual en un motor de TEMPORADAS:
--     cada mes puede tener sus propios cosméticos (borde/banner/
--     ícono) como recompensa, programados desde ya en la base.
--     El track FREE da 1 cosmético final; el PRO reparte varios.
--
-- Correr DESPUÉS de rewards-phase4b.sql. Idempotente.
-- ============================================================


-- ════════════════════════════════════════════════════════════
--  PARTE A — FECHA/MES DE ARGENTINA
-- ════════════════════════════════════════════════════════════

-- Día "de la app" = fecha en horario Argentina. Reemplaza a
-- CURRENT_DATE (que resolvía en UTC) en todas las RPCs de abajo.
CREATE OR REPLACE FUNCTION public.app_today()
RETURNS DATE LANGUAGE sql STABLE AS $$
  SELECT (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;
$$;
GRANT EXECUTE ON FUNCTION public.app_today() TO authenticated;

-- ─── Retos diarios: asignar los de hoy (ART) ────────────────
CREATE OR REPLACE FUNCTION public.ensure_daily_challenges(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_plan TEXT;
  v_count INTEGER;
  v_today DATE := public.app_today();
BEGIN
  SELECT plan_slug INTO v_plan FROM public.subscriptions
    WHERE user_id = p_user_id AND status = 'active'
      AND (current_period_end IS NULL OR current_period_end > now())
    LIMIT 1;
  v_plan := COALESCE(v_plan, 'free');
  v_count := CASE v_plan WHEN 'legend' THEN 6 WHEN 'pro' THEN 4 ELSE 2 END;

  INSERT INTO public.user_daily_challenges (user_id, day, challenge_code, progress, target, claimed)
  SELECT p_user_id, v_today, dc.code, 0, dc.goal_target, false
  FROM public.daily_challenges dc
  WHERE dc.active
  ORDER BY md5(dc.code || v_today::text)
  LIMIT v_count
  ON CONFLICT (user_id, day, challenge_code) DO NOTHING;
END$$;

-- ─── Retos diarios: obtener los de hoy (ART) ────────────────
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
    WHERE udc.user_id = uid AND udc.day = public.app_today()
  ) t;

  RETURN result;
END$$;

-- ─── Retos diarios: reclamar (ART) ──────────────────────────
CREATE OR REPLACE FUNCTION public.claim_daily_challenge(p_code TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  rec RECORD;
  cat RECORD;
  v_today DATE := public.app_today();
BEGIN
  IF uid IS NULL THEN RETURN json_build_object('ok', false, 'error', 'auth'); END IF;

  SELECT * INTO rec FROM public.user_daily_challenges
    WHERE user_id = uid AND day = v_today AND challenge_code = p_code;
  IF rec IS NULL THEN RETURN json_build_object('ok', false, 'error', 'not_found'); END IF;
  IF rec.claimed THEN RETURN json_build_object('ok', false, 'error', 'already_claimed'); END IF;
  IF rec.progress < rec.target THEN RETURN json_build_object('ok', false, 'error', 'incomplete'); END IF;

  SELECT * INTO cat FROM public.daily_challenges WHERE code = p_code;

  UPDATE public.user_daily_challenges SET claimed = true
    WHERE user_id = uid AND day = v_today AND challenge_code = p_code;

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

-- ─── Recompensa diaria: estado (ART) ────────────────────────
CREATE OR REPLACE FUNCTION public.get_daily_reward()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  v_today DATE := public.app_today();
  v_weekend BOOLEAN;
  v_type TEXT;
  v_claimed BOOLEAN;
BEGIN
  IF uid IS NULL THEN RETURN json_build_object('available', false); END IF;
  v_weekend := EXTRACT(DOW FROM v_today) IN (0, 6);
  v_type := (ARRAY['fifty_fifty','shield','extra_time','reveal_hint'])[(EXTRACT(WEEK FROM v_today)::int % 4) + 1];
  SELECT EXISTS(SELECT 1 FROM public.user_daily_claims WHERE user_id = uid AND day = v_today AND kind = 'daily') INTO v_claimed;

  RETURN json_build_object(
    'available', NOT v_claimed,
    'claimed', v_claimed,
    'reward_kind', CASE WHEN v_weekend THEN 'powerup' ELSE 'xp' END,
    'reward_powerup', CASE WHEN v_weekend THEN v_type ELSE NULL END,
    'amount', CASE WHEN v_weekend THEN 1 ELSE 100 END
  );
END$$;

-- ─── Recompensa diaria: reclamar (ART) ──────────────────────
CREATE OR REPLACE FUNCTION public.claim_daily_reward()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  v_today DATE := public.app_today();
  v_weekend BOOLEAN;
  v_type TEXT;
  v_xp INTEGER := 100;
BEGIN
  IF uid IS NULL THEN RETURN json_build_object('ok', false, 'error', 'auth'); END IF;

  IF EXISTS(SELECT 1 FROM public.user_daily_claims WHERE user_id = uid AND day = v_today AND kind = 'daily') THEN
    RETURN json_build_object('ok', false, 'error', 'already_claimed');
  END IF;

  v_weekend := EXTRACT(DOW FROM v_today) IN (0, 6);
  v_type := (ARRAY['fifty_fifty','shield','extra_time','reveal_hint'])[(EXTRACT(WEEK FROM v_today)::int % 4) + 1];

  IF v_weekend THEN
    PERFORM public.grant_powerup(uid, v_type, 1);
    INSERT INTO public.user_daily_claims (user_id, day, kind, reward_kind, reward_powerup, amount)
      VALUES (uid, v_today, 'daily', 'powerup', v_type, 1);
    RETURN json_build_object('ok', true, 'reward_kind', 'powerup', 'reward_powerup', v_type, 'amount', 1);
  ELSE
    PERFORM public.award_xp(v_xp, 'daily_reward', NULL, NULL, '{}'::jsonb);
    INSERT INTO public.user_daily_claims (user_id, day, kind, reward_kind, amount)
      VALUES (uid, v_today, 'daily', 'xp', v_xp);
    RETURN json_build_object('ok', true, 'reward_kind', 'xp', 'amount', v_xp);
  END IF;
END$$;

-- ─── report_game_result (diarios + pase + progresivos, ART) ─
-- Redefine la versión viva (fase 3) usando app_today().
CREATE OR REPLACE FUNCTION public.report_game_result(p_game_slug TEXT, p_won BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  v_today DATE := public.app_today();
  v_month DATE := date_trunc('month', public.app_today())::date;
  v_pts INTEGER;
BEGIN
  IF uid IS NULL THEN RETURN; END IF;

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
END$$;


-- ════════════════════════════════════════════════════════════
--  PARTE B — MOTOR DE TEMPORADAS DEL PASE
-- ════════════════════════════════════════════════════════════

-- ─── 1. Metadata por temporada (un mes = una temporada) ─────
CREATE TABLE IF NOT EXISTS public.pass_seasons (
  month  DATE PRIMARY KEY,               -- primer día del mes (ART)
  name   TEXT NOT NULL,                  -- "Pase de Julio"
  theme  TEXT,                           -- etiqueta libre (winter, mundial, …)
  accent TEXT NOT NULL DEFAULT 'amber'   -- color de marca del pase ese mes
);

-- ─── 2. Cosméticos que da el pase, por temporada/nivel/track ─
-- Sparse: solo se cargan los niveles que otorgan un cosmético.
-- month = '0001-01-01' → PLANTILLA por defecto (se usa cuando el
-- mes en curso no tiene filas propias, así nunca queda sin premio).
CREATE TABLE IF NOT EXISTS public.pass_season_rewards (
  month         DATE NOT NULL,
  tier          INTEGER NOT NULL,
  track         TEXT NOT NULL,           -- 'free' | 'premium'
  cosmetic_code TEXT NOT NULL REFERENCES public.cosmetics(code) ON DELETE CASCADE,
  PRIMARY KEY (month, tier, track)
);

-- ─── 3. RLS ─────────────────────────────────────────────────
ALTER TABLE public.pass_seasons        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pass_season_rewards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Pass seasons public"  ON public.pass_seasons;
DROP POLICY IF EXISTS "Pass rewards public"  ON public.pass_season_rewards;
CREATE POLICY "Pass seasons public"  ON public.pass_seasons        FOR SELECT USING (true);
CREATE POLICY "Pass rewards public"  ON public.pass_season_rewards FOR SELECT USING (true);

-- ─── 4. Helper: qué "mes de recompensas" aplica ─────────────
-- El del mes en curso si tiene filas propias; si no, la plantilla.
CREATE OR REPLACE FUNCTION public.pass_rewards_month(p_month DATE)
RETURNS DATE LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.pass_season_rewards r WHERE r.month = p_month)
    THEN p_month ELSE DATE '0001-01-01'
  END;
$$;

-- ─── 5. Cosméticos EXCLUSIVOS del pase (premio final free) ──
-- Reusan style_keys existentes (renderizan ya). unlock_level=999
-- => imposibles por XP: solo se consiguen completando el pase.
-- Para un pase nuevo con arte fresco: (1) generá el arte, (2)
-- insertá acá el cosmético con unlock_level=999, (3) referencialo
-- en pass_season_rewards para el mes correspondiente.
INSERT INTO public.cosmetics (code, type, name, rarity, style_key, unlock_level, premium_only, sort_order) VALUES
  ('frame_pass_jul',  'frame',  'Guardián de Julio',   'legendary', 'champion', 999, false, 40),
  ('banner_pass_ago', 'banner', 'Cielo de Agosto',     'legendary', 'galaxy',   999, false, 41),
  ('frame_pass_sep',  'frame',  'Coloso de Septiembre','legendary', 'legend',   999, false, 42)
ON CONFLICT (code) DO UPDATE SET
  type = EXCLUDED.type, name = EXCLUDED.name, rarity = EXCLUDED.rarity, style_key = EXCLUDED.style_key,
  unlock_level = EXCLUDED.unlock_level, premium_only = EXCLUDED.premium_only, sort_order = EXCLUDED.sort_order;

-- ─── 6. Seed de temporadas ──────────────────────────────────
-- Ajustá nombres/acentos/meses a gusto. Idempotente.
INSERT INTO public.pass_seasons (month, name, theme, accent) VALUES
  (DATE '0001-01-01', 'Pase Mensual',        'default', 'amber'),
  (DATE '2026-07-01', 'Pase de Julio',       'winter',  'amber'),
  (DATE '2026-08-01', 'Pase de Agosto',      'night',   'cyan'),
  (DATE '2026-09-01', 'Pase de Septiembre',  'classic', 'emerald')
ON CONFLICT (month) DO UPDATE SET
  name = EXCLUDED.name, theme = EXCLUDED.theme, accent = EXCLUDED.accent;

-- ─── 7. Seed de recompensas cosméticas por temporada ────────
-- Convención: FREE = 1 cosmético en el tier final (30). PREMIUM =
-- 5 cosméticos repartidos (6/12/18/24/30). Todos con códigos que
-- ya existen en `cosmetics` (renderizan hoy).

-- Plantilla por defecto (cualquier mes sin filas propias)
INSERT INTO public.pass_season_rewards (month, tier, track, cosmetic_code) VALUES
  (DATE '0001-01-01', 30, 'free',    'frame_champion'),
  (DATE '0001-01-01',  6, 'premium', 'banner_gold'),
  (DATE '0001-01-01', 12, 'premium', 'icon_crown'),
  (DATE '0001-01-01', 18, 'premium', 'frame_premium'),
  (DATE '0001-01-01', 24, 'premium', 'title_premium'),
  (DATE '0001-01-01', 30, 'premium', 'frame_legend')
ON CONFLICT (month, tier, track) DO UPDATE SET cosmetic_code = EXCLUDED.cosmetic_code;

-- Julio 2026
INSERT INTO public.pass_season_rewards (month, tier, track, cosmetic_code) VALUES
  (DATE '2026-07-01', 30, 'free',    'frame_pass_jul'),
  (DATE '2026-07-01',  6, 'premium', 'banner_gold'),
  (DATE '2026-07-01', 12, 'premium', 'icon_trophy'),
  (DATE '2026-07-01', 18, 'premium', 'frame_emerald'),
  (DATE '2026-07-01', 24, 'premium', 'title_master'),
  (DATE '2026-07-01', 30, 'premium', 'icon_crown')
ON CONFLICT (month, tier, track) DO UPDATE SET cosmetic_code = EXCLUDED.cosmetic_code;

-- Agosto 2026
INSERT INTO public.pass_season_rewards (month, tier, track, cosmetic_code) VALUES
  (DATE '2026-08-01', 30, 'free',    'banner_pass_ago'),
  (DATE '2026-08-01',  6, 'premium', 'frame_gold'),
  (DATE '2026-08-01', 12, 'premium', 'banner_fire'),
  (DATE '2026-08-01', 18, 'premium', 'icon_goat'),
  (DATE '2026-08-01', 24, 'premium', 'frame_premium'),
  (DATE '2026-08-01', 30, 'premium', 'banner_galaxy')
ON CONFLICT (month, tier, track) DO UPDATE SET cosmetic_code = EXCLUDED.cosmetic_code;

-- Septiembre 2026
INSERT INTO public.pass_season_rewards (month, tier, track, cosmetic_code) VALUES
  (DATE '2026-09-01', 30, 'free',    'frame_pass_sep'),
  (DATE '2026-09-01',  6, 'premium', 'title_premium'),
  (DATE '2026-09-01', 12, 'premium', 'banner_gold'),
  (DATE '2026-09-01', 18, 'premium', 'icon_trophy'),
  (DATE '2026-09-01', 24, 'premium', 'frame_legend'),
  (DATE '2026-09-01', 30, 'premium', 'frame_premium')
ON CONFLICT (month, tier, track) DO UPDATE SET cosmetic_code = EXCLUDED.cosmetic_code;


-- ════════════════════════════════════════════════════════════
--  PARTE C — RPCs DEL PASE (temporada + cosméticos + días)
-- ════════════════════════════════════════════════════════════

-- ─── get_monthly_pass: estado + temporada + días + cosméticos
CREATE OR REPLACE FUNCTION public.get_monthly_pass()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  v_month DATE := date_trunc('month', public.app_today())::date;
  v_rmonth DATE;
  v_points INTEGER := 0;
  v_premium BOOLEAN := false;
  v_days_left INTEGER;
  v_season RECORD;
  v_tiers JSON;
BEGIN
  IF uid IS NULL THEN RETURN json_build_object('points', 0, 'tiers', '[]'::json); END IF;

  v_rmonth := public.pass_rewards_month(v_month);
  SELECT points INTO v_points FROM public.user_monthly_pass WHERE user_id = uid AND month = v_month;
  v_points := COALESCE(v_points, 0);
  v_premium := public.user_is_premium(uid);
  v_days_left := ((date_trunc('month', public.app_today()) + INTERVAL '1 month')::date - public.app_today());
  SELECT * INTO v_season FROM public.pass_seasons WHERE month = v_month;

  SELECT COALESCE(json_agg(t ORDER BY t.tier), '[]'::json) INTO v_tiers
  FROM (
    SELECT mt.tier, mt.points_required,
           (v_points >= mt.points_required) AS unlocked,
           mt.free_xp, mt.free_powerup, mt.free_powerup_qty,
           mt.premium_xp, mt.premium_powerup, mt.premium_powerup_qty,
           EXISTS(SELECT 1 FROM public.user_pass_claims c WHERE c.user_id = uid AND c.month = v_month AND c.tier = mt.tier AND c.track = 'free')    AS free_claimed,
           EXISTS(SELECT 1 FROM public.user_pass_claims c WHERE c.user_id = uid AND c.month = v_month AND c.tier = mt.tier AND c.track = 'premium') AS premium_claimed,
           (SELECT row_to_json(fc) FROM (
              SELECT c.code, c.type, c.name, c.rarity, c.style_key
              FROM public.pass_season_rewards r JOIN public.cosmetics c ON c.code = r.cosmetic_code
              WHERE r.month = v_rmonth AND r.tier = mt.tier AND r.track = 'free'
           ) fc) AS free_cosmetic,
           (SELECT row_to_json(pc) FROM (
              SELECT c.code, c.type, c.name, c.rarity, c.style_key
              FROM public.pass_season_rewards r JOIN public.cosmetics c ON c.code = r.cosmetic_code
              WHERE r.month = v_rmonth AND r.tier = mt.tier AND r.track = 'premium'
           ) pc) AS premium_cosmetic
    FROM public.monthly_pass_tiers mt
  ) t;

  RETURN json_build_object(
    'month', v_month,
    'points', v_points,
    'is_premium', v_premium,
    'days_left', v_days_left,
    'season', CASE WHEN v_season.month IS NULL THEN NULL
                   ELSE json_build_object('name', v_season.name, 'accent', v_season.accent, 'theme', v_season.theme) END,
    'tiers', v_tiers
  );
END$$;

-- ─── claim_pass_tier: XP + powerup + COSMÉTICO de la temporada
CREATE OR REPLACE FUNCTION public.claim_pass_tier(p_tier INTEGER, p_track TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  v_month DATE := date_trunc('month', public.app_today())::date;
  v_points INTEGER := 0;
  v_tier RECORD;
  v_xp INTEGER;
  v_pu TEXT;
  v_qty INTEGER;
  v_cos TEXT;
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

  -- Cosmético del pase para este nivel/track (según la temporada)
  SELECT cosmetic_code INTO v_cos
  FROM public.pass_season_rewards
  WHERE month = public.pass_rewards_month(v_month) AND tier = p_tier AND track = p_track;
  IF v_cos IS NOT NULL THEN
    PERFORM public.grant_cosmetic(uid, v_cos);
  END IF;

  INSERT INTO public.user_pass_claims (user_id, month, tier, track) VALUES (uid, v_month, p_tier, p_track);

  RETURN json_build_object('ok', true, 'tier', p_tier, 'track', p_track,
                           'xp', v_xp, 'powerup', v_pu, 'powerup_qty', v_qty, 'cosmetic', v_cos);
END$$;

-- ─── Grants ─────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.pass_rewards_month(DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_monthly_pass() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_pass_tier(INTEGER, TEXT) TO authenticated;
