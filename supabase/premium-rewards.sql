-- ============================================================
-- GOALDEMY — RECOMPENSAS PREMIUM (pay-to-win)
-- 1) Cosméticos exclusivos premium (se obtienen al suscribirse).
-- 2) Buff del track PREMIUM del pase mensual (más XP + powerups más seguidos).
-- Correr DESPUÉS de rewards-phase2.sql + rewards-phase4*.sql. Idempotente.
-- ============================================================

-- ─── 1. Cosméticos exclusivos PREMIUM ───────────────────────
-- premium_only = true y unlock_level = 1 → cualquier suscriptor (pro/legend)
-- los tiene al instante. Los free los ven bloqueados con badge PRO.
-- style_key de íconos = emoji que el front mapea a SVG (CosmeticIcon).
INSERT INTO public.cosmetics (code, type, name, rarity, style_key, unlock_level, premium_only, sort_order) VALUES
  ('frame_diamond', 'frame',  'Diamante',      'legendary', 'diamond', 1, true, 8),
  ('icon_star',     'icon',   'Estrella Élite','epic',      '⭐',       1, true, 27),
  ('icon_shield',   'icon',   'Escudo Élite',  'epic',      '🛡️',      1, true, 28),
  ('banner_neon',   'banner', 'Neón',          'legendary', 'neon',    1, true, 36),
  ('title_mvp',     'title',  'MVP',           'legendary', 'mvp',     1, true, 40),
  ('title_crack',   'title',  'Crack Total',   'epic',      'crack',   1, true, 41)
ON CONFLICT (code) DO UPDATE SET
  type = EXCLUDED.type, name = EXCLUDED.name, rarity = EXCLUDED.rarity, style_key = EXCLUDED.style_key,
  unlock_level = EXCLUDED.unlock_level, premium_only = EXCLUDED.premium_only, sort_order = EXCLUDED.sort_order;

-- ─── 2. Buff del track PREMIUM del pase mensual ─────────────
-- Antes: premium_xp = 100 + n*20, powerup cada 3 tiers.
-- Ahora: premium_xp = 150 + n*30 (más alto), powerup cada 2 tiers, qty creciente.
-- El track GRATIS no se toca → el premium queda CLARAMENTE mejor (pay-to-win).
UPDATE public.monthly_pass_tiers mt SET
  premium_xp = (150 + mt.tier * 30),
  premium_powerup = CASE
    WHEN mt.tier % 2 = 0 THEN (ARRAY['fifty_fifty','shield','extra_time','reveal_hint'])[(mt.tier % 4) + 1]
    ELSE NULL END,
  premium_powerup_qty = CASE
    WHEN mt.tier % 2 = 0 THEN 1 + (mt.tier / 10)
    ELSE 0 END;

-- ─── 3. (OPCIONAL) Subir el multiplicador de XP de Legend ───
-- Descomentá si querés que Legend sea aún más tentador (de +50% a +75%):
-- UPDATE public.plans SET xp_multiplier = 1.75 WHERE slug = 'legend';
