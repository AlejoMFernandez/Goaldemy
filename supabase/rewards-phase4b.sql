-- ============================================================
-- GOALDEMY — RECOMPENSAS FASE 4b: ÍCONOS + BANNERS + DIFICULTAD
-- Suma cosméticos tipo 'icon' y 'banner', sube la dificultad de los
-- legendarios, y otorga un borde exclusivo al completar el pase (tier 30).
-- Correr DESPUÉS de rewards-phase4.sql. Idempotente.
-- ============================================================

-- ─── 1. Columnas de equipado nuevas ─────────────────────────
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS equipped_icon TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS equipped_banner TEXT;

-- ─── 2. Subir dificultad de los mejores cosméticos ──────────
UPDATE public.cosmetics SET unlock_level = 25 WHERE code = 'frame_gold';
UPDATE public.cosmetics SET unlock_level = 35 WHERE code = 'frame_emerald';
UPDATE public.cosmetics SET unlock_level = 50 WHERE code = 'frame_legend';
UPDATE public.cosmetics SET unlock_level = 30 WHERE code = 'title_master';
UPDATE public.cosmetics SET unlock_level = 50 WHERE code = 'title_legend';

-- ─── 3. Seed íconos + banners ───────────────────────────────
-- Íconos: style_key = glyph que se muestra como avatar.
-- Banners: style_key = clave de gradiente (mapeada en el front).
INSERT INTO public.cosmetics (code, type, name, rarity, style_key, unlock_level, premium_only, sort_order) VALUES
  ('icon_none',    'icon',   'Sin ícono',   'common',    '',        1,   false, 19),
  ('icon_ball',    'icon',   'Pelota',      'common',    '⚽',      1,   false, 20),
  ('icon_boot',    'icon',   'Botín',       'common',    '👟',      6,   false, 21),
  ('icon_gloves',  'icon',   'Guantes',     'rare',      '🧤',      14,  false, 22),
  ('icon_medal',   'icon',   'Medalla',     'rare',      '🏅',      22,  false, 23),
  ('icon_trophy',  'icon',   'Trofeo',      'epic',      '🏆',      35,  false, 24),
  ('icon_goat',    'icon',   'GOAT',        'legendary', '🐐',      55,  false, 25),
  ('icon_crown',   'icon',   'Corona',      'legendary', '👑',      1,   true,  26),
  ('banner_default','banner','Por defecto', 'common',    'default', 1,   false, 30),
  ('banner_pitch', 'banner', 'Cancha',      'common',    'pitch',   8,   false, 31),
  ('banner_night', 'banner', 'Nocturno',    'rare',      'night',   18,  false, 32),
  ('banner_fire',  'banner', 'Fuego',       'epic',      'fire',    40,  false, 33),
  ('banner_galaxy','banner', 'Galaxia',     'legendary', 'galaxy',  60,  false, 34),
  ('banner_gold',  'banner', 'Oro Élite',   'legendary', 'gold',    1,   true,  35),
  -- Exclusivo: SOLO se consigue completando el pase (nivel inalcanzable por XP)
  ('frame_champion','frame', 'Campeón del Pase', 'legendary', 'champion', 999, false, 7)
ON CONFLICT (code) DO UPDATE SET
  type = EXCLUDED.type, name = EXCLUDED.name, rarity = EXCLUDED.rarity, style_key = EXCLUDED.style_key,
  unlock_level = EXCLUDED.unlock_level, premium_only = EXCLUDED.premium_only, sort_order = EXCLUDED.sort_order;

-- ─── 4. equip_cosmetic: soportar icon + banner ──────────────
CREATE OR REPLACE FUNCTION public.equip_cosmetic(p_code TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  c RECORD;
BEGIN
  IF uid IS NULL THEN RETURN json_build_object('ok', false, 'error', 'auth'); END IF;

  -- Desequipar título con string vacío
  IF p_code = '' THEN
    UPDATE public.user_profiles SET equipped_title = NULL WHERE id = uid;
    RETURN json_build_object('ok', true, 'type', 'title', 'code', NULL);
  END IF;

  SELECT * INTO c FROM public.cosmetics WHERE code = p_code AND active;
  IF c IS NULL THEN RETURN json_build_object('ok', false, 'error', 'not_found'); END IF;
  IF NOT public.owns_cosmetic(uid, p_code) THEN
    RETURN json_build_object('ok', false, 'error', 'not_owned');
  END IF;

  IF c.type = 'frame' THEN
    UPDATE public.user_profiles SET equipped_frame = p_code WHERE id = uid;
  ELSIF c.type = 'title' THEN
    UPDATE public.user_profiles SET equipped_title = p_code WHERE id = uid;
  ELSIF c.type = 'icon' THEN
    UPDATE public.user_profiles SET equipped_icon = p_code WHERE id = uid;
  ELSIF c.type = 'banner' THEN
    UPDATE public.user_profiles SET equipped_banner = p_code WHERE id = uid;
  ELSE
    RETURN json_build_object('ok', false, 'error', 'bad_type');
  END IF;

  RETURN json_build_object('ok', true, 'type', c.type, 'code', p_code);
END$$;

-- ─── 5. claim_pass_tier: otorgar borde exclusivo al tier 30 ─
-- Redefine la función de fase 2 agregando el grant del cosmético.
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

  -- Recompensa exclusiva: completar el último tier otorga el borde "Campeón del Pase"
  IF p_tier >= 30 THEN
    PERFORM public.grant_cosmetic(uid, 'frame_champion');
  END IF;

  INSERT INTO public.user_pass_claims (user_id, month, tier, track) VALUES (uid, v_month, p_tier, p_track);

  RETURN json_build_object('ok', true, 'tier', p_tier, 'track', p_track, 'xp', v_xp, 'powerup', v_pu, 'powerup_qty', v_qty);
END$$;
