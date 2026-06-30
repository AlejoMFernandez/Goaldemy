-- ============================================================
-- GOALDEMY — ÍCONOS SECRETOS POR LOGRO
-- Íconos que se desbloquean SOLO al conseguir un logro (nivel 999).
-- En el editor se ven como "?" hasta desbloquearlos (el hover dice qué hacer).
-- Correr DESPUÉS de rewards-phase4c.sql. Idempotente.
-- Front: glyphs en CosmeticIcon.vue (bolt/flame/gem/owl/broom) + iconThemeBg + pistas en CosmeticsCollection.
-- ============================================================

INSERT INTO public.cosmetics (code, type, name, rarity, style_key, unlock_level, premium_only, unlock_achievement, sort_order) VALUES
  ('icon_bolt',    'icon', 'Rayo',   'rare', 'bolt',  999, false, 'streak_15',       28),
  ('icon_flame',   'icon', 'Llama',  'epic', 'flame', 999, false, 'daily_streak_30', 29),
  ('icon_perfect', 'icon', 'Gema',   'epic', 'gem',   999, false, 'perfectionist',   30),
  ('icon_owl',     'icon', 'Búho',   'rare', 'owl',   999, false, 'night_owl',       31),
  ('icon_broom',   'icon', 'Escoba', 'epic', 'broom', 999, false, 'daily_wins_all',  32)
ON CONFLICT (code) DO UPDATE SET
  type=EXCLUDED.type, name=EXCLUDED.name, rarity=EXCLUDED.rarity, style_key=EXCLUDED.style_key,
  unlock_level=EXCLUDED.unlock_level, premium_only=EXCLUDED.premium_only,
  unlock_achievement=EXCLUDED.unlock_achievement, sort_order=EXCLUDED.sort_order;
