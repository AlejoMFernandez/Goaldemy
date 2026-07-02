-- ============================================================
-- GOALDEMY — ÍCONOS SECRETOS POR LOGRO (tanda 2)
-- Más íconos que se desbloquean por logro (nivel 999). Se ven como "?" hasta
-- desbloquearlos; el hover dice cómo conseguirlos.
-- Correr DESPUÉS de achievement-icons.sql. Idempotente.
-- Front: glyphs en CosmeticIcon.vue (sun/clover/sword/hat/laurel) + iconThemeBg + hints en cosmetics.js.
-- ============================================================

INSERT INTO public.cosmetics (code, type, name, rarity, style_key, unlock_level, premium_only, unlock_achievement, sort_order) VALUES
  ('icon_sun',    'icon', 'Amanecer',  'rare',      'sun',    999, false, 'early_bird',      33),
  ('icon_clover', 'icon', 'Trébol',    'rare',      'clover', 999, false, 'lucky_first',     34),
  ('icon_sword',  'icon', 'Espada',    'epic',      'sword',  999, false, 'weekend_warrior', 35),
  ('icon_hat',    'icon', 'Hat-Trick', 'epic',      'hat',    999, false, 'hat_trick',       36),
  ('icon_laurel', 'icon', 'Laurel',    'legendary', 'laurel', 999, false, 'centurion',       37)
ON CONFLICT (code) DO UPDATE SET
  type=EXCLUDED.type, name=EXCLUDED.name, rarity=EXCLUDED.rarity, style_key=EXCLUDED.style_key,
  unlock_level=EXCLUDED.unlock_level, premium_only=EXCLUDED.premium_only,
  unlock_achievement=EXCLUDED.unlock_achievement, sort_order=EXCLUDED.sort_order;
