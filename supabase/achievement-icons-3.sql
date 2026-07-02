-- ============================================================
-- GOALDEMY — ÍCONOS SECRETOS POR LOGRO (tanda 3)
-- Correr DESPUÉS de achievement-icons-2.sql. Idempotente.
-- Front: glyphs en CosmeticIcon.vue (chat/butterfly/globe/comet/phoenix) + iconThemeBg + hints.
-- ============================================================

INSERT INTO public.cosmetics (code, type, name, rarity, style_key, unlock_level, premium_only, unlock_achievement, sort_order) VALUES
  ('icon_chat',      'icon', 'Charlatán',  'rare',      'chat',      999, false, 'chat_master',        38),
  ('icon_butterfly', 'icon', 'Mariposa',   'rare',      'butterfly', 999, false, 'social_butterfly',   39),
  ('icon_globe',     'icon', 'Trotamundos','epic',      'globe',     999, false, 'nationality_expert', 40),
  ('icon_comet',     'icon', 'Cometa',     'epic',      'comet',     999, false, 'grand_slam',         41),
  ('icon_phoenix',   'icon', 'Fénix',      'legendary', 'phoenix',   999, false, 'comeback_king',      42)
ON CONFLICT (code) DO UPDATE SET
  type=EXCLUDED.type, name=EXCLUDED.name, rarity=EXCLUDED.rarity, style_key=EXCLUDED.style_key,
  unlock_level=EXCLUDED.unlock_level, premium_only=EXCLUDED.premium_only,
  unlock_achievement=EXCLUDED.unlock_achievement, sort_order=EXCLUDED.sort_order;
