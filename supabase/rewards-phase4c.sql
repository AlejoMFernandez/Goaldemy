-- ============================================================
-- GOALDEMY — RECOMPENSAS FASE 4c: COSMÉTICOS POR LOGRO
-- Algunos cosméticos se desbloquean SOLO al conseguir un logro
-- (nivel 999 = inalcanzable por XP). Correr DESPUÉS de phase4b. Idempotente.
-- ============================================================

-- ─── 1. Columna de gateo por logro ──────────────────────────
-- (las columnas equipped_icon/banner y el seed de íconos/banners viven en phase4b)
ALTER TABLE public.cosmetics ADD COLUMN IF NOT EXISTS unlock_achievement TEXT;

-- ─── 2. Cosméticos exclusivos por logro (los más prestigiosos) ──
INSERT INTO public.cosmetics (code, type, name, rarity, style_key, unlock_level, premium_only, unlock_achievement, sort_order) VALUES
  ('frame_streaker',  'frame', 'Imparable',  'legendary', 'legend', 999, false, 'daily_streak_30', 8),
  ('title_centurion', 'title', 'Centurión',  'epic',      NULL,     999, false, 'centurion',       16),
  ('title_goleador',  'title', 'Goleador',   'rare',      NULL,     999, false, 'guess_master',    17),
  ('icon_perfect',    'icon',  'Perfecto',   'epic',      '💯',     999, false, 'perfectionist',   27),
  ('icon_owl',        'icon',  'Búho',       'rare',      '🦉',     999, false, 'night_owl',       28)
ON CONFLICT (code) DO UPDATE SET
  type=EXCLUDED.type, name=EXCLUDED.name, rarity=EXCLUDED.rarity, style_key=EXCLUDED.style_key,
  unlock_level=EXCLUDED.unlock_level, premium_only=EXCLUDED.premium_only,
  unlock_achievement=EXCLUDED.unlock_achievement, sort_order=EXCLUDED.sort_order;

-- ─── 3. owns_cosmetic: agregar el camino por logro ──────────
CREATE OR REPLACE FUNCTION public.owns_cosmetic(p_user_id UUID, p_code TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c RECORD;
BEGIN
  SELECT * INTO c FROM public.cosmetics WHERE code = p_code AND active;
  IF c IS NULL THEN RETURN false; END IF;

  -- Otorgado explícitamente (pase/grant)
  IF EXISTS(SELECT 1 FROM public.user_cosmetics WHERE user_id = p_user_id AND cosmetic_code = p_code) THEN
    RETURN true;
  END IF;

  -- Por logro
  IF c.unlock_achievement IS NOT NULL AND EXISTS(
       SELECT 1 FROM public.user_achievements ua
       JOIN public.achievements a ON a.id = ua.achievement_id
       WHERE ua.user_id = p_user_id AND a.code = c.unlock_achievement
     ) THEN
    RETURN true;
  END IF;

  -- Por nivel (+ premium)
  RETURN (public.user_level_of(p_user_id) >= c.unlock_level)
     AND (NOT c.premium_only OR EXISTS(
       SELECT 1 FROM public.subscriptions s
       WHERE s.user_id = p_user_id AND s.status = 'active'
         AND s.plan_slug IN ('pro','legend')
         AND (s.current_period_end IS NULL OR s.current_period_end > now())
     ));
END$$;

-- ─── 4. get_cosmetics: incluir logro en owned + devolverlo ──
CREATE OR REPLACE FUNCTION public.get_cosmetics()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  v_level INTEGER;
  v_premium BOOLEAN;
  v_frame TEXT;
  v_title TEXT;
  v_icon TEXT;
  v_banner TEXT;
  result JSON;
BEGIN
  IF uid IS NULL THEN RETURN '[]'::json; END IF;
  v_level := public.user_level_of(uid);
  v_premium := EXISTS(
    SELECT 1 FROM public.subscriptions s
    WHERE s.user_id = uid AND s.status = 'active'
      AND s.plan_slug IN ('pro','legend')
      AND (s.current_period_end IS NULL OR s.current_period_end > now())
  );
  SELECT equipped_frame, equipped_title, equipped_icon, equipped_banner
    INTO v_frame, v_title, v_icon, v_banner
    FROM public.user_profiles WHERE id = uid;

  SELECT COALESCE(json_agg(t ORDER BY t.type, t.sort_order), '[]'::json) INTO result
  FROM (
    SELECT c.code, c.type, c.name, c.rarity, c.style_key, c.unlock_level, c.premium_only,
           c.unlock_achievement, c.sort_order,
           (
             EXISTS(SELECT 1 FROM public.user_cosmetics uc WHERE uc.user_id = uid AND uc.cosmetic_code = c.code)
             OR (c.unlock_achievement IS NOT NULL AND EXISTS(
                  SELECT 1 FROM public.user_achievements ua
                  JOIN public.achievements a ON a.id = ua.achievement_id
                  WHERE ua.user_id = uid AND a.code = c.unlock_achievement))
             OR ((v_level >= c.unlock_level) AND (NOT c.premium_only OR v_premium))
           ) AS owned,
           (c.code = v_frame OR c.code = v_title OR c.code = v_icon OR c.code = v_banner) AS equipped
    FROM public.cosmetics c
    WHERE c.active
  ) t;

  RETURN result;
END$$;
