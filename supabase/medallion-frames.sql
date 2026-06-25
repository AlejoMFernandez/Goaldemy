-- ============================================================
-- GOALDEMY — BORDES MEDALLÓN (frames desbloqueables)
-- Familia de bordes tipo medallón (anillo metálico + remaches + glow).
-- style_key mapea a FRAME_STYLES en cosmetics.js (medal_bronze/silver/gold/diamond).
-- Correr DESPUÉS de rewards-phase4*.sql. Idempotente.
-- ============================================================

INSERT INTO public.cosmetics (code, type, name, rarity, style_key, unlock_level, premium_only, sort_order) VALUES
  ('frame_medal_bronze',  'frame', 'Medallón Bronce',   'rare',      'medal_bronze',  12, false, 9),
  ('frame_medal_silver',  'frame', 'Medallón Plata',    'epic',      'medal_silver',  24, false, 10),
  ('frame_medal_gold',    'frame', 'Medallón Oro',      'legendary', 'medal_gold',    40, false, 11),
  ('frame_medal_diamond', 'frame', 'Medallón Diamante', 'legendary', 'medal_diamond', 1,  true,  12)
ON CONFLICT (code) DO UPDATE SET
  type = EXCLUDED.type, name = EXCLUDED.name, rarity = EXCLUDED.rarity, style_key = EXCLUDED.style_key,
  unlock_level = EXCLUDED.unlock_level, premium_only = EXCLUDED.premium_only, sort_order = EXCLUDED.sort_order;
