-- ============================================================
-- PENDIENTE · NO APLICADO · 2026-11-26 (viene de feature/vestuario-nuevo, 28/09)
-- QUÉ: filas del catálogo para los 23 íconos del vestuario (bufanda, bombo, lobo…).
--      Los .webp ya están en public/cosmetics/icons/ y las claves en
--      src/services/cosmetic-icon-keys.js.
-- POR QUÉ: sin filas no se pueden ganar. En producción parece estar aplicado (la
--      Colección muestra Bufanda); este archivo queda para staging o bases nuevas.
-- IDEMPOTENTE: ON CONFLICT (code) DO NOTHING (no pisa ajustes hechos en la base).
-- ROLLBACK: DELETE FROM public.cosmetics WHERE code LIKE 'icon\_%' AND sort_order BETWEEN 400 AND 432
--      AND NOT EXISTS (SELECT 1 FROM public.user_cosmetics uc WHERE uc.cosmetic_code = cosmetics.code).
-- ============================================================

BEGIN;

-- ============================================================
-- FULVO — ÍCONOS NUEVOS (23) · vestuario septiembre 2026
-- Los PNG/webp ya están en public/cosmetics/icons y las claves en RASTER_ICONS.
-- Faltaban las filas del catálogo: sin ellas no se pueden ganar ni equipar.
-- style_key = clave semántica del archivo (CosmeticIcon.vue la busca en RASTER_ICONS).
-- Regla: por nivel → unlock_level N; por logro → unlock_level 999 + unlock_achievement.
-- Idempotente. Chequear antes: que no choquen code/style_key/sort_order y que los
-- logros existan y estén activos.
-- ============================================================
ALTER TABLE public.cosmetics ADD COLUMN IF NOT EXISTS unlock_achievement TEXT;

-- AJUSTE 2026-11-26: solo se insertan las piezas por nivel y las de logros que
-- EXISTEN y están activos (una pieza atada a un logro inexistente no se podría
-- ganar nunca). Si después se crea el logro, volver a correr este archivo la suma.
-- ON CONFLICT sin columna: tampoco frena si choca otra restricción única.
INSERT INTO public.cosmetics
  (code, type, name, rarity, style_key, unlock_level, premium_only, unlock_achievement, sort_order)
SELECT v.code, v.type, v.name, v.rarity, v.style_key, v.unlock_level, v.premium_only, v.unlock_achievement, v.sort_order
FROM (VALUES
  -- comunes (nivel)
  ('icon_bufanda',      'icon', 'Bufanda',            'common',    'bufanda',      3,   false, NULL,                400),
  ('icon_silbato',      'icon', 'Silbato',            'common',    'silbato',      5,   false, NULL,                401),
  ('icon_banderin',     'icon', 'Banderín de córner', 'common',    'banderin',     7,   false, NULL,                402),
  ('icon_corneta',      'icon', 'Corneta',            'common',    'corneta',      9,   false, NULL,                403),
  ('icon_zapatillas',   'icon', 'Zapatillas gastadas','common',    'zapatillas',   11,  false, NULL,                404),
  ('icon_pelota_trapo', 'icon', 'Pelota de trapo',    'common',    'pelota_trapo', 13,  false, NULL,                405),
  -- raros
  ('icon_tarjeta_roja', 'icon', 'Tarjeta roja',       'rare',      'tarjeta_roja', 17,  false, NULL,                410),
  ('icon_arco_oxidado', 'icon', 'Arco oxidado',       'rare',      'arco_oxidado', 19,  false, NULL,                411),
  ('icon_cinta',        'icon', 'Cinta de capitán',   'rare',      'cinta',        21,  false, NULL,                412),
  ('icon_lobo',         'icon', 'Lobo',               'rare',      'lobo',         23,  false, NULL,                413),
  ('icon_toro',         'icon', 'Toro',               'rare',      'toro',         27,  false, NULL,                414),
  ('icon_bombo',        'icon', 'Bombo',              'rare',      'bombo',        999, false, 'daily_streak_5',    415),
  ('icon_cronometro',   'icon', 'Cronómetro',         'rare',      'cronometro',   999, false, 'ni_la_mitad',       416),
  ('icon_pizarra',      'icon', 'Pizarra táctica',    'rare',      'pizarra',      999, false, 'position_guru',     417),
  ('icon_taco',         'icon', 'Taco',               'rare',      'taco',         999, false, 'lucky_first',       418),
  -- épicos
  ('icon_tunel',        'icon', 'Túnel',              'epic',      'tunel',        31,  false, NULL,                420),
  ('icon_leon',         'icon', 'León',               'epic',      'leon',         35,  false, NULL,                421),
  ('icon_aguila',       'icon', 'Águila',             'epic',      'aguila',       999, false, 'hat_trick',         422),
  ('icon_tiburon',      'icon', 'Tiburón',            'epic',      'tiburon',      999, false, 'invicto',           423),
  ('icon_botin_alado',  'icon', 'Botín alado',        'epic',      'botin_alado',  999, false, 'relampago',         424),
  -- legendarios
  ('icon_pelota_oro',   'icon', 'Pelota de oro',      'legendary', 'pelota_oro',   50,  false, NULL,                430),
  ('icon_dragon',       'icon', 'Dragón',             'legendary', 'dragon',       999, false, 'invicto_temporada', 431),
  ('icon_camiseta_10',  'icon', 'La 10',              'legendary', 'camiseta_10',  999, false, 'daily_wins_10',     432)
) AS v(code, type, name, rarity, style_key, unlock_level, premium_only, unlock_achievement, sort_order)
WHERE v.unlock_achievement IS NULL
   OR EXISTS (SELECT 1 FROM public.achievements a
              WHERE a.code = v.unlock_achievement AND COALESCE((to_jsonb(a)->>'active')::boolean, true))
ON CONFLICT DO NOTHING;

COMMIT;

-- Verificación: cuántas piezas del rango de sort_order 400–432 quedaron en el catálogo
-- y cuántas se saltearon por logro inexistente/inactivo (se suman al crear el logro).
SELECT count(*) > 0 AS ok, count(*) AS piezas_en_catalogo
FROM public.cosmetics WHERE sort_order BETWEEN 400 AND 432;
