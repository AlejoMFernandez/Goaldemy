-- ============================================================
-- GOALDEMY — RECOMPENSAS FASE 4: COSMÉTICOS
-- Bordes de foto de perfil + títulos. Se desbloquean por nivel
-- (y algunos premium-only). Correr DESPUÉS de rewards-phase2.sql.
-- Idempotente.
-- ============================================================

-- ─── 1. Catálogo de cosméticos ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.cosmetics (
  code TEXT PRIMARY KEY,
  type TEXT NOT NULL,                   -- 'frame' | 'title'
  name TEXT NOT NULL,                   -- frame: nombre; title: el texto del título
  rarity TEXT NOT NULL DEFAULT 'common',-- common | rare | epic | legendary
  style_key TEXT,                       -- frame: clave de estilo (mapea a CSS en el front)
  unlock_level INTEGER NOT NULL DEFAULT 1,
  premium_only BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true
);

-- ─── 2. Inventario explícito (para grants por pase/logros) ──
CREATE TABLE IF NOT EXISTS public.user_cosmetics (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cosmetic_code TEXT NOT NULL REFERENCES public.cosmetics(code) ON DELETE CASCADE,
  acquired_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, cosmetic_code)
);

-- ─── 3. Equipados en el perfil ──────────────────────────────
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS equipped_frame TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS equipped_title TEXT;

-- ─── 4. RLS ─────────────────────────────────────────────────
ALTER TABLE public.cosmetics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_cosmetics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Cosmetics public" ON public.cosmetics;
DROP POLICY IF EXISTS "Users read own cosmetics" ON public.user_cosmetics;
CREATE POLICY "Cosmetics public" ON public.cosmetics FOR SELECT USING (true);
CREATE POLICY "Users read own cosmetics" ON public.user_cosmetics FOR SELECT USING (auth.uid() = user_id);

-- ─── 5. Seed ────────────────────────────────────────────────
INSERT INTO public.cosmetics (code, type, name, rarity, style_key, unlock_level, premium_only, sort_order) VALUES
  -- Bordes (frames)
  ('frame_none',    'frame', 'Sin borde',         'common',    'none',    1,  false, 0),
  ('frame_bronze',  'frame', 'Bronce',            'common',    'bronze',  3,  false, 1),
  ('frame_silver',  'frame', 'Plata',             'rare',      'silver',  8,  false, 2),
  ('frame_gold',    'frame', 'Oro',               'epic',      'gold',    15, false, 3),
  ('frame_emerald', 'frame', 'Esmeralda',         'epic',      'emerald', 20, false, 4),
  ('frame_legend',  'frame', 'Leyenda',           'legendary', 'legend',  30, false, 5),
  ('frame_premium', 'frame', 'Élite Premium',     'legendary', 'premium', 1,  true,  6),
  -- Títulos
  ('title_rookie',  'title', 'Promesa',           'common',    NULL,      2,  false, 10),
  ('title_fan',     'title', 'Hincha',            'common',    NULL,      5,  false, 11),
  ('title_pro',     'title', 'Crack',             'rare',      NULL,      12, false, 12),
  ('title_master',  'title', 'Maestro del fútbol','epic',      NULL,      20, false, 13),
  ('title_legend',  'title', 'Leyenda Mundial',   'legendary', NULL,      30, false, 14),
  ('title_premium', 'title', 'Élite',             'legendary', NULL,      1,  true,  15)
ON CONFLICT (code) DO UPDATE SET
  type = EXCLUDED.type, name = EXCLUDED.name, rarity = EXCLUDED.rarity, style_key = EXCLUDED.style_key,
  unlock_level = EXCLUDED.unlock_level, premium_only = EXCLUDED.premium_only, sort_order = EXCLUDED.sort_order;

-- ─── 6. Helper: nivel del usuario ───────────────────────────
CREATE OR REPLACE FUNCTION public.user_level_of(p_user_id UUID)
RETURNS INTEGER LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((
    SELECT lt.level FROM public.level_thresholds lt
    WHERE lt.xp_required <= public.get_user_total_xp(p_user_id)
    ORDER BY lt.level DESC LIMIT 1
  ), 1);
$$;

-- ─── 7. Helper interno: ¿el usuario posee el cosmético? ─────
CREATE OR REPLACE FUNCTION public.owns_cosmetic(p_user_id UUID, p_code TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c RECORD;
BEGIN
  SELECT * INTO c FROM public.cosmetics WHERE code = p_code AND active;
  IF c IS NULL THEN RETURN false; END IF;
  IF EXISTS(SELECT 1 FROM public.user_cosmetics WHERE user_id = p_user_id AND cosmetic_code = p_code) THEN
    RETURN true;
  END IF;
  RETURN (public.user_level_of(p_user_id) >= c.unlock_level)
     AND (NOT c.premium_only OR public.user_is_premium(p_user_id));
END$$;

-- ─── 8. RPC: catálogo con estado (owned / equipped) ─────────
CREATE OR REPLACE FUNCTION public.get_cosmetics()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  v_level INTEGER;
  v_premium BOOLEAN;
  v_frame TEXT;
  v_title TEXT;
  result JSON;
BEGIN
  IF uid IS NULL THEN RETURN '[]'::json; END IF;
  v_level := public.user_level_of(uid);
  v_premium := public.user_is_premium(uid);
  SELECT equipped_frame, equipped_title INTO v_frame, v_title FROM public.user_profiles WHERE id = uid;

  SELECT COALESCE(json_agg(t ORDER BY t.type, t.sort_order), '[]'::json) INTO result
  FROM (
    SELECT c.code, c.type, c.name, c.rarity, c.style_key, c.unlock_level, c.premium_only,
           (
             EXISTS(SELECT 1 FROM public.user_cosmetics uc WHERE uc.user_id = uid AND uc.cosmetic_code = c.code)
             OR ((v_level >= c.unlock_level) AND (NOT c.premium_only OR v_premium))
           ) AS owned,
           (c.code = v_frame OR c.code = v_title) AS equipped
    FROM public.cosmetics c
    WHERE c.active
  ) t;

  RETURN result;
END$$;

-- ─── 9. RPC: equipar (o desequipar con '') ──────────────────
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
  ELSE
    RETURN json_build_object('ok', false, 'error', 'bad_type');
  END IF;

  RETURN json_build_object('ok', true, 'type', c.type, 'code', p_code);
END$$;

-- ─── 10. Helper: otorgar cosmético (pase/logros, futuro) ────
CREATE OR REPLACE FUNCTION public.grant_cosmetic(p_user_id UUID, p_code TEXT)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.user_cosmetics (user_id, cosmetic_code)
  VALUES (p_user_id, p_code) ON CONFLICT DO NOTHING;
$$;

-- ─── 11. Grants ─────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.user_level_of(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owns_cosmetic(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_cosmetics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.equip_cosmetic(TEXT) TO authenticated;
