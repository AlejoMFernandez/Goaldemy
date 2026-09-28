-- ============================================================
-- FULVO — VESTUARIO NUEVO (septiembre 2026)
-- 12 bordes + 15 banners + 30 títulos.
-- Diseño: docs/vestuario/moodboard.html · Especificación: docs/vestuario/SPEC.md
-- Idempotente (ON CONFLICT). Correr DESPUÉS de rewards-phase4c.sql
-- (usa la columna unlock_achievement).
--
-- Regla de desbloqueo (ya existente en is_cosmetic_unlocked):
--   · por nivel     → unlock_level = N, unlock_achievement = NULL
--   · por logro     → unlock_level = 999, unlock_achievement = '<code>'
-- Los niveles son una PROPUESTA: se pueden mover sin tocar el front.
-- ============================================================

INSERT INTO public.cosmetics
  (code, type, name, rarity, style_key, unlock_level, premium_only, unlock_achievement, sort_order)
VALUES
  -- ── BORDES ────────────────────────────────────────────────
  ('frame_chalk',       'frame', 'Tiza',                 'common',    'chalk',       2,   false, NULL,               100),
  ('frame_grass',       'frame', 'Césped cortado',       'common',    'grass',       4,   false, NULL,               101),
  ('frame_net',         'frame', 'Red de arco',          'common',    'net',         6,   false, NULL,               102),
  ('frame_level_plate', 'frame', 'Placa de nivel',       'rare',      'level_plate', 10,  false, NULL,               103),
  ('frame_captain',     'frame', 'Capitán',              'rare',      'captain',     14,  false, NULL,               104),
  ('frame_fence',       'frame', 'Alambrado',            'rare',      'fence',       18,  false, NULL,               105),
  ('frame_led',         'frame', 'Tablero LED',          'epic',      'led',         26,  false, NULL,               106),
  ('frame_floodlights', 'frame', 'Reflectores',          'epic',      'floodlights', 34,  false, NULL,               107),
  ('frame_laurel',      'frame', 'Laurel dorado',        'epic',      'laurel',      44,  false, NULL,               108),
  ('frame_streak',      'frame', 'Racha encendida',      'epic',      'streak',      999, false, 'daily_streak_7',   109),
  ('frame_fire',        'frame', 'Fuego',                'epic',      'fire_ring',   999, false, 'daily_streak_14',  110),
  ('frame_stars',       'frame', 'Estrellas de campeón', 'legendary', 'stars',       999, false, 'invicto_temporada',111),

  -- ── BANNERS ───────────────────────────────────────────────
  ('banner_mowed',       'banner', 'Cancha cortada',       'common',    'mowed',       3,   false, NULL,              200),
  ('banner_penalty',     'banner', 'Punto penal',          'common',    'penalty',     5,   false, NULL,              201),
  ('banner_leather',     'banner', 'Pelota de cuero',      'common',    'leather',     7,   false, NULL,              202),
  ('banner_scoreboard',  'banner', 'Marcador del estadio', 'rare',      'scoreboard',  12,  false, NULL,              203),
  ('banner_away_kit',    'banner', 'Camiseta suplente',    'rare',      'away_kit',    16,  false, NULL,              204),
  ('banner_live',        'banner', 'En vivo',              'rare',      'live',        22,  false, NULL,              205),
  ('banner_var',         'banner', 'Revisión del VAR',     'rare',      'var',         28,  false, NULL,              206),
  ('banner_tactics',     'banner', 'Pizarra táctica',      'rare',      'tactics',     999, false, 'position_guru',   207),
  ('banner_newspaper',   'banner', 'Tapa de diario',       'rare',      'newspaper',   999, false, 'daily_wins_5',    208),
  ('banner_rain',        'banner', 'Noche de lluvia',      'epic',      'rain',        32,  false, NULL,              209),
  ('banner_heatmap',     'banner', 'Mapa de calor',        'epic',      'heatmap',     38,  false, NULL,              210),
  ('banner_lights',      'banner', 'Se prenden las luces', 'epic',      'lights',      45,  false, NULL,              211),
  ('banner_passmap',     'banner', 'Red de pases',         'epic',      'passmap',     999, false, 'trotamundos',     212),
  ('banner_commentary',  'banner', 'El relato',            'epic',      'commentary',  999, false, 'tiempo_descuento',213),
  ('banner_ticker_tape', 'banner', 'Recibimiento',         'legendary', 'ticker_tape', 999, false, 'daily_wins_all',  214),

  -- ── TÍTULOS (name = texto del título) ─────────────────────
  -- por nivel
  ('title_potrero',      'title', 'Pibe de potrero',      'common',    NULL, 3,   false, NULL,                 300),
  ('title_suplente',     'title', 'Suplente de lujo',     'common',    NULL, 8,   false, NULL,                 301),
  ('title_enganche',     'title', 'Enganche',             'rare',      NULL, 16,  false, NULL,                 302),
  ('title_capitan',      'title', 'Capitán',              'epic',      NULL, 25,  false, NULL,                 303),
  ('title_simbolo',      'title', 'Símbolo del club',     'epic',      NULL, 40,  false, NULL,                 304),
  ('title_el_que_sabe',  'title', 'El que sabe',          'legendary', NULL, 50,  false, NULL,                 305),
  -- por logro · comunes
  ('title_alcanzapelotas','title','Alcanzapelotas',       'common',    NULL, 999, false, 'first_win',          310),
  ('title_companero',    'title', 'Buen compañero',       'common',    NULL, 999, false, 'social_butterfly',   311),
  ('title_hincha_ley',   'title', 'Hincha de ley',        'common',    NULL, 999, false, 'daily_streak_7',     312),
  ('title_dt_cafe',      'title', 'DT de café',           'common',    NULL, 999, false, 'position_guru',      313),
  -- raros
  ('title_pasaporte',    'title', 'Pasaporte lleno',      'rare',      NULL, 999, false, 'nationality_expert', 320),
  ('title_primera_int',  'title', 'Primera intención',    'rare',      NULL, 999, false, 'lucky_first',        321),
  ('title_garra',        'title', 'Pura garra',           'rare',      NULL, 999, false, 'comeback_king',      322),
  ('title_muralla',      'title', 'Muralla',              'rare',      NULL, 999, false, 'salvado_escudo',     323),
  ('title_ojeador',      'title', 'Ojeador',              'rare',      NULL, 999, false, 'scout',              324),
  ('title_tiempista',    'title', 'Tiempista',            'rare',      NULL, 999, false, 'ni_la_mitad',        325),
  ('title_reloj_suizo',  'title', 'Reloj suizo',          'rare',      NULL, 999, false, 'relojero',           326),
  ('title_olfato',       'title', 'Olfato de gol',        'rare',      NULL, 999, false, 'ojo_halcon',         327),
  -- épicos
  ('title_sobre_hora',   'title', 'Sobre la hora',        'epic',      NULL, 999, false, 'tiempo_descuento',   330),
  ('title_arco_cero',    'title', 'Arco en cero',         'epic',      NULL, 999, false, 'invicto',            331),
  ('title_gambeta',      'title', 'A pura gambeta',       'epic',      NULL, 999, false, 'sin_red',            332),
  ('title_titular',      'title', 'Titular indiscutido',  'epic',      NULL, 999, false, 'jornada_primera',    333),
  ('title_fiel',         'title', 'Fiel a la camiseta',   'epic',      NULL, 999, false, 'especialista',       334),
  ('title_polifuncional','title', 'Polifuncional',        'epic',      NULL, 999, false, 'todoterreno',        335),
  ('title_videoteca',    'title', 'Memoria de videoteca', 'epic',      NULL, 999, false, 'enciclopedia',       336),
  ('title_doblete',      'title', 'Doblete',              'epic',      NULL, 999, false, 'doble_jornada',      337),
  -- legendarios
  ('title_distinto',     'title', 'Distinto',             'legendary', NULL, 999, false, 'daily_wins_10',      340),
  ('title_dueno_pelota', 'title', 'Dueño de la pelota',   'legendary', NULL, 999, false, 'grand_slam',         341),
  ('title_campeon_inv',  'title', 'Campeón invicto',      'legendary', NULL, 999, false, 'invicto_temporada',  342),
  ('title_abonado',      'title', 'Abonado de por vida',  'legendary', NULL, 999, false, 'daily_streak_30',    343)
ON CONFLICT (code) DO UPDATE SET
  type = EXCLUDED.type, name = EXCLUDED.name, rarity = EXCLUDED.rarity, style_key = EXCLUDED.style_key,
  unlock_level = EXCLUDED.unlock_level, premium_only = EXCLUDED.premium_only,
  unlock_achievement = EXCLUDED.unlock_achievement, sort_order = EXCLUDED.sort_order;

-- Chequeo: todos los logros referenciados tienen que existir y estar activos.
-- SELECT c.code, c.unlock_achievement FROM public.cosmetics c
-- LEFT JOIN public.achievements a ON a.code = c.unlock_achievement
-- WHERE c.sort_order BETWEEN 100 AND 399 AND c.unlock_achievement IS NOT NULL
--   AND (a.id IS NULL OR a.active = false);
