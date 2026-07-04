-- ============================================================
-- GOALDEMY — COSMÉTICOS POR RANGO (MEJORAS8)
-- Al llegar al nivel de cada rango se desbloquean: banner + borde + ícono.
-- (El escudo del rango es el badge, no un cosmético equipable.)
-- La pertenencia por nivel la maneja owns_cosmetic()/get_cosmetics() de rewards-phase4.sql.
-- Los BANNERS por rango ya los seedea supabase/category-banners.sql.
-- Correr DESPUÉS de rewards-phase4b.sql y category-banners.sql. Idempotente.
--
-- Front: TIER_UNLOCKS en src/services/tiers.js mapea cada rango a estos style_key.
--   frames medallón → FRAME_STYLES (cosmetics.js) · íconos rank_* → CosmeticIcon.vue
-- ============================================================

-- ── BORDES (medallón por rango) ──
INSERT INTO public.cosmetics (code, type, name, rarity, style_key, unlock_level, premium_only, sort_order) VALUES
  ('frame_rank_aficionado',  'frame', 'Medallón Bronce',   'common',    'medal_bronze',   1,  false, 50),
  ('frame_rank_juvenil',     'frame', 'Medallón Plata',    'common',    'medal_silver',   10, false, 51),
  ('frame_rank_amateur',     'frame', 'Medallón Oro',      'rare',      'medal_gold',     20, false, 52),
  ('frame_rank_reserva',     'frame', 'Medallón Esmeralda','rare',      'medal_emerald',  30, false, 53),
  ('frame_rank_profesional', 'frame', 'Medallón Diamante', 'epic',      'medal_diamond',  40, false, 54),
  ('frame_rank_crack',       'frame', 'Medallón Campeón',  'legendary', 'medal_champion', 50, false, 55)
ON CONFLICT (code) DO UPDATE SET
  type = EXCLUDED.type, name = EXCLUDED.name, rarity = EXCLUDED.rarity, style_key = EXCLUDED.style_key,
  unlock_level = EXCLUDED.unlock_level, premium_only = EXCLUDED.premium_only, sort_order = EXCLUDED.sort_order;

-- ── ÍCONOS (insignia por rango) ──
INSERT INTO public.cosmetics (code, type, name, rarity, style_key, unlock_level, premium_only, sort_order) VALUES
  ('icon_rank_aficionado',  'icon', 'Insignia Bronce',   'common',    'rank_bronze',   1,  false, 60),
  ('icon_rank_juvenil',     'icon', 'Insignia Plata',    'common',    'rank_silver',   10, false, 61),
  ('icon_rank_amateur',     'icon', 'Insignia Oro',      'rare',      'rank_gold',     20, false, 62),
  ('icon_rank_reserva',     'icon', 'Insignia Esmeralda','rare',      'rank_emerald',  30, false, 63),
  ('icon_rank_profesional', 'icon', 'Insignia Diamante', 'epic',      'rank_cyan',     40, false, 64),
  ('icon_rank_crack',       'icon', 'Insignia Campeón',  'legendary', 'rank_champion', 50, false, 65)
ON CONFLICT (code) DO UPDATE SET
  type = EXCLUDED.type, name = EXCLUDED.name, rarity = EXCLUDED.rarity, style_key = EXCLUDED.style_key,
  unlock_level = EXCLUDED.unlock_level, premium_only = EXCLUDED.premium_only, sort_order = EXCLUDED.sort_order;
