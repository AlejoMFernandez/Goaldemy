-- ============================================================
-- GOALDEMY — MEJORAS13: TIENDA CON COSMÉTICOS EXCLUSIVOS
--
-- Regla nueva: los cosméticos que se GANAN jugando (pase de batalla,
-- logros, subir de nivel) NO se pueden comprar. La tienda vende sólo
-- cosméticos ÚNICOS de tienda, creados a propósito para comprar.
--
-- Qué hace:
--  1. Agrega columna `section` a shop_items (para secciones estilo
--     Fortnite: 'generic', 'event_worldcup2026', etc.).
--  2. Borra el seed viejo (que había metido cosméticos ganables).
--  3. Crea cosméticos EXCLUSIVOS de tienda (unlock_level=999, sin
--     logro, no premium → sólo se obtienen comprándolos).
--  4. Los carga en la tienda con precio en Fichas / Balones.
--  5. get_shop ahora devuelve `section`.
--
-- Correr DESPUÉS de mejoras11-currency-shop.sql. Idempotente.
-- ============================================================

-- ─── 1. Columna de sección ──────────────────────────────────
ALTER TABLE public.shop_items
  ADD COLUMN IF NOT EXISTS section TEXT NOT NULL DEFAULT 'generic';

-- ─── 2. Limpiar el seed viejo ───────────────────────────────
-- Sacamos de la tienda cualquier cosmético que NO sea exclusivo de
-- tienda (los códigos exclusivos empiezan con 'shop_'). Así los
-- ganables (pase/logros/nivel) dejan de ser comprables.
DELETE FROM public.shop_items
WHERE cosmetic_code NOT LIKE 'shop\_%';

-- ─── 3. Cosméticos EXCLUSIVOS de tienda ─────────────────────
-- unlock_level=999 + sin unlock_achievement + premium_only=false
-- ⇒ imposibles por nivel/logro/PRO: SOLO se consiguen comprándolos.
-- Reusan style_keys que ya renderizan en el front (cosmetics.js).
INSERT INTO public.cosmetics (code, type, name, rarity, style_key, unlock_level, premium_only, sort_order, active) VALUES
  ('shop_frame_neon',    'frame',  'Aro de Neón',        'rare',      'emerald', 999, false, 700, true),
  ('shop_frame_prisma',  'frame',  'Prisma de Tienda',   'epic',      'legend',  999, false, 701, true),
  ('shop_frame_diamond', 'frame',  'Diamante Exclusivo', 'legendary', 'diamond', 999, false, 702, true),
  ('shop_frame_prestige','frame',  'Prestigio Dorado',   'legendary', 'champion',999, false, 703, true),
  ('shop_banner_neon',   'banner', 'Neón Urbano',        'rare',      'neon',    999, false, 710, true),
  ('shop_banner_fire',   'banner', 'Llama de Tienda',    'epic',      'fire',    999, false, 711, true),
  ('shop_banner_galaxy', 'banner', 'Galaxia Exclusiva',  'legendary', 'galaxy',  999, false, 712, true),
  ('shop_title_crack',   'title',  'Crack de la Tienda', 'rare',      NULL,      999, false, 720, true),
  ('shop_title_leyenda', 'title',  'Leyenda Urbana',     'epic',      NULL,      999, false, 721, true)
ON CONFLICT (code) DO UPDATE SET
  type = EXCLUDED.type, name = EXCLUDED.name, rarity = EXCLUDED.rarity,
  style_key = EXCLUDED.style_key, unlock_level = EXCLUDED.unlock_level,
  premium_only = EXCLUDED.premium_only, sort_order = EXCLUDED.sort_order, active = EXCLUDED.active;

-- ─── 4. Cargarlos en la tienda ──────────────────────────────
-- Precio en Fichas por rareza. Un par premium se pagan con Balones.
INSERT INTO public.shop_items (cosmetic_code, price_fichas, price_balones, featured, section, sort_order) VALUES
  ('shop_frame_neon',     500,  NULL, false, 'generic', 700),
  ('shop_frame_prisma',   1200, NULL, false, 'generic', 701),
  ('shop_frame_diamond',  2500, NULL, true,  'generic', 702),
  ('shop_frame_prestige', NULL, 300,  true,  'generic', 703),
  ('shop_banner_neon',    500,  NULL, false, 'generic', 710),
  ('shop_banner_fire',    1200, NULL, false, 'generic', 711),
  ('shop_banner_galaxy',  2500, NULL, false, 'generic', 712),
  ('shop_title_crack',    500,  NULL, false, 'generic', 720),
  ('shop_title_leyenda',  1200, NULL, false, 'generic', 721)
ON CONFLICT (cosmetic_code) DO UPDATE SET
  price_fichas = EXCLUDED.price_fichas, price_balones = EXCLUDED.price_balones,
  featured = EXCLUDED.featured, section = EXCLUDED.section, sort_order = EXCLUDED.sort_order, active = true;

-- ─── 5. get_shop devuelve la sección ────────────────────────
CREATE OR REPLACE FUNCTION public.get_shop()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid UUID := auth.uid(); result JSON;
BEGIN
  SELECT COALESCE(json_agg(t ORDER BY t.featured DESC, t.sort_order, t.name), '[]'::json) INTO result
  FROM (
    SELECT s.id, s.cosmetic_code, s.price_fichas, s.price_balones, s.featured, s.sort_order, s.section,
           c.type, c.name, c.rarity, c.style_key, c.premium_only,
           EXISTS(SELECT 1 FROM public.user_cosmetics uc WHERE uc.user_id = uid AND uc.cosmetic_code = s.cosmetic_code) AS owned
    FROM public.shop_items s
    JOIN public.cosmetics c ON c.code = s.cosmetic_code
    WHERE s.active
  ) t;
  RETURN result;
END$$;
GRANT EXECUTE ON FUNCTION public.get_shop() TO authenticated;
