-- ============================================================
-- FULVO — COSMÉTICOS DE LOS 5 RANGOS NUEVOS (feature/rangos-100)
-- Figura (NV 60) · Ídolo (70) · Ícono (80) · Leyenda (90) · GOAT (100): borde + ícono de rango + banner,
-- mismo esquema de ids/style_key que los 6 rangos actuales (rank-cosmetics.sql / category-banners.sql).
-- Se dan solos al llegar al nivel (owns_cosmetic() compara con unlock_level). NO se tocan los
-- cosméticos coleccionables existentes (Pelota de oro, La 10, GOAT, Laurel dorado…).
-- El ícono 'GOAT' de rango usa style_key 'rank_goat' (distinto del coleccionable 'goat').
-- Correr junto con 2026-10-03-rangos-curva-xp-51-100.sql. Idempotente.
-- ============================================================

-- ── BORDES ──
INSERT INTO public.cosmetics (code, type, name, rarity, style_key, unlock_level, premium_only, sort_order) VALUES
  ('frame_rank_figura', 'frame', 'Medallón Figura', 'epic', 'medal_figura', 60, false, 56),
  ('frame_rank_idolo', 'frame', 'Medallón Ídolo', 'epic', 'medal_idolo', 70, false, 57),
  ('frame_rank_icono', 'frame', 'Medallón Ícono', 'legendary', 'medal_icono', 80, false, 58),
  ('frame_rank_leyenda', 'frame', 'Medallón Leyenda', 'legendary', 'medal_leyenda', 90, false, 59),
  ('frame_rank_goat', 'frame', 'Medallón GOAT', 'legendary', 'medal_goat', 100, false, 60)
ON CONFLICT (code) DO UPDATE SET
  type = EXCLUDED.type, name = EXCLUDED.name, rarity = EXCLUDED.rarity, style_key = EXCLUDED.style_key,
  unlock_level = EXCLUDED.unlock_level, premium_only = EXCLUDED.premium_only, sort_order = EXCLUDED.sort_order;

-- ── ÍCONOS DE RANGO ──
INSERT INTO public.cosmetics (code, type, name, rarity, style_key, unlock_level, premium_only, sort_order) VALUES
  ('icon_rank_figura', 'icon', 'Ícono de rango Figura', 'epic', 'rank_figura', 60, false, 66),
  ('icon_rank_idolo', 'icon', 'Ícono de rango Ídolo', 'epic', 'rank_idolo', 70, false, 67),
  ('icon_rank_icono', 'icon', 'Ícono de rango Ícono', 'legendary', 'rank_icono', 80, false, 68),
  ('icon_rank_leyenda', 'icon', 'Ícono de rango Leyenda', 'legendary', 'rank_leyenda', 90, false, 69),
  ('icon_rank_goat', 'icon', 'Ícono de rango GOAT', 'legendary', 'rank_goat', 100, false, 70)
ON CONFLICT (code) DO UPDATE SET
  type = EXCLUDED.type, name = EXCLUDED.name, rarity = EXCLUDED.rarity, style_key = EXCLUDED.style_key,
  unlock_level = EXCLUDED.unlock_level, premium_only = EXCLUDED.premium_only, sort_order = EXCLUDED.sort_order;

-- ── BANNERS ──
INSERT INTO public.cosmetics (code, type, name, rarity, style_key, unlock_level, premium_only, sort_order) VALUES
  ('banner_tier_figura', 'banner', 'Categoría Figura', 'epic', 'tier_figura', 60, false, 46),
  ('banner_tier_idolo', 'banner', 'Categoría Ídolo', 'epic', 'tier_idolo', 70, false, 47),
  ('banner_tier_icono', 'banner', 'Categoría Ícono', 'legendary', 'tier_icono', 80, false, 48),
  ('banner_tier_leyenda', 'banner', 'Categoría Leyenda', 'legendary', 'tier_leyenda', 90, false, 49),
  ('banner_tier_goat', 'banner', 'Categoría GOAT', 'legendary', 'tier_goat', 100, false, 50)
ON CONFLICT (code) DO UPDATE SET
  type = EXCLUDED.type, name = EXCLUDED.name, rarity = EXCLUDED.rarity, style_key = EXCLUDED.style_key,
  unlock_level = EXCLUDED.unlock_level, premium_only = EXCLUDED.premium_only, sort_order = EXCLUDED.sort_order;
