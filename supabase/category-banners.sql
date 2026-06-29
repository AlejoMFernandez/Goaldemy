-- ============================================================
-- GOALDEMY — BANNERS DE CATEGORÍA (desbloqueables por nivel)
-- Un banner por tier (ver src/services/tiers.js). Se desbloquean al
-- llegar al nivel del tier y quedan como OPCIÓN en edición de perfil
-- (NO se equipan solos). La pertenencia por nivel ya la maneja
-- owns_cosmetic()/get_cosmetics() de rewards-phase4.sql.
-- Correr DESPUÉS de rewards-phase4b.sql. Idempotente.
-- El front mapea estos style_key en cosmetics.js (BANNER_STYLES) y
-- las clases .bnr-tier-* viven en src/style.css.
-- ============================================================

INSERT INTO public.cosmetics (code, type, name, rarity, style_key, unlock_level, premium_only, sort_order) VALUES
  ('banner_tier_aficionado',  'banner', 'Categoría Aficionado',  'common',    'tier_aficionado',  1,  false, 40),
  ('banner_tier_juvenil',     'banner', 'Categoría Juvenil',     'common',    'tier_juvenil',     10, false, 41),
  ('banner_tier_amateur',     'banner', 'Categoría Amateur',     'rare',      'tier_amateur',     20, false, 42),
  ('banner_tier_reserva',     'banner', 'Categoría Reserva',     'rare',      'tier_reserva',     30, false, 43),
  ('banner_tier_profesional', 'banner', 'Categoría Profesional', 'epic',      'tier_profesional', 40, false, 44),
  ('banner_tier_crack',       'banner', 'Categoría Crack',       'legendary', 'tier_crack',       50, false, 45)
ON CONFLICT (code) DO UPDATE SET
  type = EXCLUDED.type, name = EXCLUDED.name, rarity = EXCLUDED.rarity, style_key = EXCLUDED.style_key,
  unlock_level = EXCLUDED.unlock_level, premium_only = EXCLUDED.premium_only, sort_order = EXCLUDED.sort_order;
