-- ============================================================
-- FULVO · 2026-11-24 · 11 · COLECCIONES POR CATEGORÍA + KIT DE RANGO v2
-- ============================================================
-- QUÉ:
--   1. Columnas nuevas en public.cosmetics: collection (key de colección) y
--      collection_route ('kit' | 'camino' | 'logro' | 'premio' | 'legado' = ya existía y conserva su desbloqueo).
--   2. Kit por rango para los 11 rangos (ícono de rango, medallón, banner) con el
--      copy nuevo ("Ícono de rango Ícono"…). Upsert: los 6 que ya existían cambian
--      nombre y rareza por tramo (Aficionado–Juvenil común, Amateur–Profesional raro,
--      Crack–Ídolo épico, Ícono–GOAT legendario: artifact "El camino 1–100").
--   3. Piezas de las 11 colecciones (src/data/collections.js). Sin arte todavía:
--      íconos/banners/bordes quedan active=false; los TÍTULOS del camino y de premio
--      quedan activos (no necesitan arte). Las piezas 'logro' apuntan a un
--      unlock_achievement PROPUESTO (los logros hay que crearlos).
--   4. Cosméticos existentes mapeados por nombre (Fuego, GOAT). La cabra (icon_goat)
--      se muda del nivel 55 al 100: antes se le regala a quien ya tiene nivel ≥ 55.
--   5. grant_cosmetic(): si el usuario YA tenía el cosmético, lo convierte en
--      Fichas (raro 250 · épico 600 · legendario 1250; común 0).
--      + REVOKE de EXECUTE para public/anon/authenticated (antes se podía llamar
--      por RPC desde el cliente; con Fichas sería farmeable).
--   6. claim_collection_prize(p_collection): entrega el premio de una colección
--      completa (todas las piezas no-premio, ACTIVAS y en propiedad).
-- POR QUÉ: relanzamiento 1–100 · cada categoría trae kit + colección (decisión de Alejo).
-- DEPENDE DE: rewards-phase4.sql, rewards-phase4c.sql (unlock_achievement, owns_cosmetic),
--   rank-cosmetics.sql, category-banners.sql, mejoras11-currency-shop.sql (award_fichas; opcional).
-- ROLLBACK:
--   DELETE FROM public.cosmetics WHERE code LIKE 'col\_%' ESCAPE '\';
--   DELETE FROM public.cosmetics WHERE code IN ('icon_rank_figura', 'frame_rank_figura', 'banner_tier_figura', 'icon_rank_idolo', 'frame_rank_idolo', 'banner_tier_idolo', 'icon_rank_icono', 'frame_rank_icono', 'banner_tier_icono', 'icon_rank_leyenda', 'frame_rank_leyenda', 'banner_tier_leyenda', 'icon_rank_goat', 'frame_rank_goat', 'banner_tier_goat');
--   -- volver a correr rank-cosmetics.sql y category-banners.sql (nombres/rarezas viejos)
--   -- volver a correr el bloque grant_cosmetic de rewards-phase4.sql (versión SQL sin Fichas)
--   DROP FUNCTION IF EXISTS public.claim_collection_prize(TEXT);
--   ALTER TABLE public.cosmetics DROP COLUMN IF EXISTS collection, DROP COLUMN IF EXISTS collection_route;
-- Idempotente. Generado por scripts/progresion-colecciones.mjs — no editar a mano.
-- ============================================================

BEGIN;

-- 1) Columnas
ALTER TABLE public.cosmetics ADD COLUMN IF NOT EXISTS collection TEXT;
ALTER TABLE public.cosmetics ADD COLUMN IF NOT EXISTS collection_route TEXT;
ALTER TABLE public.cosmetics ADD COLUMN IF NOT EXISTS unlock_achievement TEXT;
CREATE INDEX IF NOT EXISTS idx_cosmetics_collection ON public.cosmetics (collection);

-- 2) Kit por rango (11 rangos × ícono/medallón/banner)
INSERT INTO public.cosmetics (code, type, name, rarity, style_key, unlock_level, premium_only, sort_order, collection, collection_route, active) VALUES
  ('icon_rank_aficionado', 'icon', 'Ícono de rango Aficionado', 'common', 'rank_bronze', 1, false, 60, 'potrero', 'kit', true),
  ('frame_rank_aficionado', 'frame', 'Medallón Aficionado', 'common', 'medal_bronze', 1, false, 50, 'potrero', 'kit', true),
  ('banner_tier_aficionado', 'banner', 'Banner Aficionado', 'common', 'tier_aficionado', 1, false, 40, 'potrero', 'kit', true),
  ('icon_rank_juvenil', 'icon', 'Ícono de rango Juvenil', 'common', 'rank_silver', 10, false, 61, 'inferiores', 'kit', true),
  ('frame_rank_juvenil', 'frame', 'Medallón Juvenil', 'common', 'medal_silver', 10, false, 51, 'inferiores', 'kit', true),
  ('banner_tier_juvenil', 'banner', 'Banner Juvenil', 'common', 'tier_juvenil', 10, false, 41, 'inferiores', 'kit', true),
  ('icon_rank_amateur', 'icon', 'Ícono de rango Amateur', 'rare', 'rank_gold', 20, false, 62, 'ascenso', 'kit', true),
  ('frame_rank_amateur', 'frame', 'Medallón Amateur', 'rare', 'medal_gold', 20, false, 52, 'ascenso', 'kit', true),
  ('banner_tier_amateur', 'banner', 'Banner Amateur', 'rare', 'tier_amateur', 20, false, 42, 'ascenso', 'kit', true),
  ('icon_rank_reserva', 'icon', 'Ícono de rango Reserva', 'rare', 'rank_emerald', 30, false, 63, 'pizarra', 'kit', true),
  ('frame_rank_reserva', 'frame', 'Medallón Reserva', 'rare', 'medal_emerald', 30, false, 53, 'pizarra', 'kit', true),
  ('banner_tier_reserva', 'banner', 'Banner Reserva', 'rare', 'tier_reserva', 30, false, 43, 'pizarra', 'kit', true),
  ('icon_rank_profesional', 'icon', 'Ícono de rango Profesional', 'rare', 'rank_cyan', 40, false, 64, 'diadepartido', 'kit', true),
  ('frame_rank_profesional', 'frame', 'Medallón Profesional', 'rare', 'medal_diamond', 40, false, 54, 'diadepartido', 'kit', true),
  ('banner_tier_profesional', 'banner', 'Banner Profesional', 'rare', 'tier_profesional', 40, false, 44, 'diadepartido', 'kit', true),
  ('icon_rank_crack', 'icon', 'Ícono de rango Crack', 'epic', 'rank_champion', 50, false, 65, 'clasico', 'kit', true),
  ('frame_rank_crack', 'frame', 'Medallón Crack', 'epic', 'medal_champion', 50, false, 55, 'clasico', 'kit', true),
  ('banner_tier_crack', 'banner', 'Banner Crack', 'epic', 'tier_crack', 50, false, 45, 'clasico', 'kit', true),
  ('icon_rank_figura', 'icon', 'Ícono de rango Figura', 'epic', 'rank_figura', 60, false, 66, 'copa', 'kit', true),
  ('frame_rank_figura', 'frame', 'Medallón Figura', 'epic', 'medal_figura', 60, false, 56, 'copa', 'kit', true),
  ('banner_tier_figura', 'banner', 'Banner Figura', 'epic', 'tier_figura', 60, false, 46, 'copa', 'kit', true),
  ('icon_rank_idolo', 'icon', 'Ícono de rango Ídolo', 'epic', 'rank_idolo', 70, false, 67, 'hinchada', 'kit', true),
  ('frame_rank_idolo', 'frame', 'Medallón Ídolo', 'epic', 'medal_idolo', 70, false, 57, 'hinchada', 'kit', true),
  ('banner_tier_idolo', 'banner', 'Banner Ídolo', 'epic', 'tier_idolo', 70, false, 47, 'hinchada', 'kit', true),
  ('icon_rank_icono', 'icon', 'Ícono de rango Ícono', 'legendary', 'rank_icono', 80, false, 68, 'gloria', 'kit', true),
  ('frame_rank_icono', 'frame', 'Medallón Ícono', 'legendary', 'medal_icono', 80, false, 58, 'gloria', 'kit', true),
  ('banner_tier_icono', 'banner', 'Banner Ícono', 'legendary', 'tier_icono', 80, false, 48, 'gloria', 'kit', true),
  ('icon_rank_leyenda', 'icon', 'Ícono de rango Leyenda', 'legendary', 'rank_leyenda', 90, false, 69, 'bestias', 'kit', true),
  ('frame_rank_leyenda', 'frame', 'Medallón Leyenda', 'legendary', 'medal_leyenda', 90, false, 59, 'bestias', 'kit', true),
  ('banner_tier_leyenda', 'banner', 'Banner Leyenda', 'legendary', 'tier_leyenda', 90, false, 49, 'bestias', 'kit', true),
  ('icon_rank_goat', 'icon', 'Ícono de rango GOAT', 'legendary', 'rank_goat', 100, false, 70, 'album', 'kit', true),
  ('frame_rank_goat', 'frame', 'Medallón GOAT', 'legendary', 'medal_goat', 100, false, 60, 'album', 'kit', true),
  ('banner_tier_goat', 'banner', 'Banner GOAT', 'legendary', 'tier_goat', 100, false, 50, 'album', 'kit', true)
ON CONFLICT (code) DO UPDATE SET
  type = EXCLUDED.type, name = EXCLUDED.name, rarity = EXCLUDED.rarity, style_key = EXCLUDED.style_key,
  unlock_level = EXCLUDED.unlock_level, premium_only = EXCLUDED.premium_only, sort_order = EXCLUDED.sort_order,
  collection = EXCLUDED.collection, collection_route = EXCLUDED.collection_route;

-- 3) Piezas de colección (active NO se pisa en re-corridas: se prende a mano cuando hay arte/logro)
INSERT INTO public.cosmetics (code, type, name, rarity, style_key, unlock_level, premium_only, unlock_achievement, sort_order, collection, collection_route, active) VALUES
  ('col_potrero_icon_pelota_de_trapo', 'icon', 'Pelota de trapo', 'common', 'col_potrero_icon_pelota_de_trapo', 2, false, NULL, 300, 'potrero', 'camino', false),
  ('col_potrero_title_pibe_de_potrero', 'title', 'Pibe de potrero', 'common', NULL, 4, false, NULL, 301, 'potrero', 'camino', true),
  ('col_potrero_banner_cuero', 'banner', 'Cuero', 'common', 'col_potrero_banner_cuero', 6, false, NULL, 302, 'potrero', 'camino', false),
  ('col_potrero_frame_tiza', 'frame', 'Tiza', 'common', 'col_potrero_frame_tiza', 8, false, NULL, 303, 'potrero', 'camino', false),
  ('col_potrero_icon_zapatillas', 'icon', 'Zapatillas', 'rare', 'col_potrero_icon_zapatillas', 999, false, 'col_potrero_zapatillas', 304, 'potrero', 'logro', false),
  ('col_potrero_icon_arco_oxidado', 'icon', 'Arco oxidado', 'rare', 'col_potrero_icon_arco_oxidado', 999, false, 'col_potrero_arco', 305, 'potrero', 'logro', false),
  ('col_potrero_icon_escudo_del_potrero', 'icon', 'Escudo del potrero', 'rare', 'col_potrero_icon_escudo_del_potrero', 999, false, 'col_potrero_escudo', 306, 'potrero', 'logro', false),
  ('col_potrero_frame_alambrado', 'frame', 'Alambrado', 'rare', 'col_potrero_frame_alambrado', 999, false, 'col_potrero_alambrado', 307, 'potrero', 'logro', false),
  ('col_potrero_frame_gajos_de_pelota', 'frame', 'Gajos de pelota', 'legendary', 'col_potrero_frame_gajos_de_pelota', 999, false, NULL, 308, 'potrero', 'premio', false),
  ('col_potrero_title_potrero_puro', 'title', 'Potrero puro', 'legendary', NULL, 999, false, NULL, 309, 'potrero', 'premio', true),
  ('col_inferiores_icon_conos', 'icon', 'Conos', 'common', 'col_inferiores_icon_conos', 12, false, NULL, 310, 'inferiores', 'camino', false),
  ('col_inferiores_title_enganche', 'title', 'Enganche', 'common', NULL, 14, false, NULL, 311, 'inferiores', 'camino', true),
  ('col_inferiores_banner_cancha_cortada', 'banner', 'Cancha cortada', 'common', 'col_inferiores_banner_cancha_cortada', 16, false, NULL, 312, 'inferiores', 'camino', false),
  ('col_inferiores_frame_cesped', 'frame', 'Césped', 'common', 'col_inferiores_frame_cesped', 18, false, NULL, 313, 'inferiores', 'camino', false),
  ('col_inferiores_banner_punto_penal', 'banner', 'Punto penal', 'rare', 'col_inferiores_banner_punto_penal', 999, false, 'col_inferiores_penal', 314, 'inferiores', 'logro', false),
  ('col_inferiores_frame_red_de_arco', 'frame', 'Red de arco', 'rare', 'col_inferiores_frame_red_de_arco', 999, false, 'col_inferiores_red', 315, 'inferiores', 'logro', false),
  ('col_inferiores_icon_pechera', 'icon', 'Pechera', 'rare', 'col_inferiores_icon_pechera', 999, false, 'col_inferiores_pechera', 316, 'inferiores', 'logro', false),
  ('col_inferiores_icon_bolso', 'icon', 'Bolso', 'rare', 'col_inferiores_icon_bolso', 999, false, 'col_inferiores_bolso', 317, 'inferiores', 'logro', false),
  ('col_ascenso_icon_botin_embarrado', 'icon', 'Botín embarrado', 'rare', 'col_ascenso_icon_botin_embarrado', 22, false, NULL, 318, 'ascenso', 'camino', false),
  ('col_ascenso_title_ascendido', 'title', 'Ascendido', 'rare', NULL, 24, false, NULL, 319, 'ascenso', 'camino', true),
  ('col_ascenso_banner_noche_de_lluvia', 'banner', 'Noche de lluvia', 'rare', 'col_ascenso_banner_noche_de_lluvia', 26, false, NULL, 320, 'ascenso', 'camino', false),
  ('col_ascenso_frame_reflectores', 'frame', 'Reflectores', 'rare', 'col_ascenso_frame_reflectores', 28, false, NULL, 321, 'ascenso', 'camino', false),
  ('col_ascenso_banner_marcador_del_estadio', 'banner', 'Marcador del estadio', 'epic', 'col_ascenso_banner_marcador_del_estadio', 999, false, 'col_ascenso_marcador', 322, 'ascenso', 'logro', false),
  ('col_ascenso_icon_tablon', 'icon', 'Tablón', 'epic', 'col_ascenso_icon_tablon', 999, false, 'col_ascenso_tablon', 323, 'ascenso', 'logro', false),
  ('col_ascenso_icon_farol', 'icon', 'Farol', 'epic', 'col_ascenso_icon_farol', 999, false, 'col_ascenso_farol', 324, 'ascenso', 'logro', false),
  ('col_pizarra_icon_tunel', 'icon', 'Túnel', 'rare', 'col_pizarra_icon_tunel', 32, false, NULL, 325, 'pizarra', 'camino', false),
  ('col_pizarra_title_suplente_de_lujo', 'title', 'Suplente de lujo', 'rare', NULL, 34, false, NULL, 326, 'pizarra', 'camino', true),
  ('col_pizarra_banner_mapa_de_calor', 'banner', 'Mapa de calor', 'rare', 'col_pizarra_banner_mapa_de_calor', 36, false, NULL, 327, 'pizarra', 'camino', false),
  ('col_pizarra_frame_capitan', 'frame', 'Capitán', 'rare', 'col_pizarra_frame_capitan', 38, false, NULL, 328, 'pizarra', 'camino', false),
  ('col_pizarra_icon_pizarra', 'icon', 'Pizarra', 'epic', 'col_pizarra_icon_pizarra', 999, false, 'col_pizarra_icono', 329, 'pizarra', 'logro', false),
  ('col_pizarra_banner_pizarra', 'banner', 'Pizarra', 'epic', 'col_pizarra_banner_pizarra', 999, false, 'col_pizarra_banner', 330, 'pizarra', 'logro', false),
  ('col_pizarra_icon_cinta_de_capitan', 'icon', 'Cinta de capitán', 'epic', 'col_pizarra_icon_cinta_de_capitan', 999, false, 'col_pizarra_cinta', 331, 'pizarra', 'logro', false),
  ('col_pizarra_title_dt_de_cafe', 'title', 'DT de café', 'epic', NULL, 999, false, 'col_pizarra_dt', 332, 'pizarra', 'logro', false),
  ('col_pizarra_frame_pizarra_magnetica', 'frame', 'Pizarra magnética', 'legendary', 'col_pizarra_frame_pizarra_magnetica', 999, false, NULL, 333, 'pizarra', 'premio', false),
  ('col_pizarra_title_el_profe', 'title', 'El Profe', 'legendary', NULL, 999, false, NULL, 334, 'pizarra', 'premio', true),
  ('col_diadepartido_icon_silbato', 'icon', 'Silbato', 'rare', 'col_diadepartido_icon_silbato', 42, false, NULL, 335, 'diadepartido', 'camino', false),
  ('col_diadepartido_title_titular_indiscutido', 'title', 'Titular indiscutido', 'rare', NULL, 44, false, NULL, 336, 'diadepartido', 'camino', true),
  ('col_diadepartido_banner_en_vivo', 'banner', 'En vivo', 'rare', 'col_diadepartido_banner_en_vivo', 46, false, NULL, 337, 'diadepartido', 'camino', false),
  ('col_diadepartido_frame_led', 'frame', 'LED', 'rare', 'col_diadepartido_frame_led', 48, false, NULL, 338, 'diadepartido', 'camino', false),
  ('col_diadepartido_icon_cronometro', 'icon', 'Cronómetro', 'epic', 'col_diadepartido_icon_cronometro', 999, false, 'col_partido_crono', 339, 'diadepartido', 'logro', false),
  ('col_diadepartido_icon_banderin', 'icon', 'Banderín', 'epic', 'col_diadepartido_icon_banderin', 999, false, 'col_partido_banderin', 340, 'diadepartido', 'logro', false),
  ('col_diadepartido_icon_tarjeta_roja', 'icon', 'Tarjeta roja', 'epic', 'col_diadepartido_icon_tarjeta_roja', 999, false, 'col_partido_roja', 341, 'diadepartido', 'logro', false),
  ('col_diadepartido_banner_var', 'banner', 'VAR', 'epic', 'col_diadepartido_banner_var', 999, false, 'col_partido_var', 342, 'diadepartido', 'logro', false),
  ('col_diadepartido_banner_camiseta_suplente', 'banner', 'Camiseta suplente', 'epic', 'col_diadepartido_banner_camiseta_suplente', 999, false, 'col_partido_suplente', 343, 'diadepartido', 'logro', false),
  ('col_diadepartido_banner_adentro_del_arco', 'banner', 'Adentro del arco', 'legendary', 'col_diadepartido_banner_adentro_del_arco', 999, false, NULL, 344, 'diadepartido', 'premio', false),
  ('col_diadepartido_title_jugador_del_partido', 'title', 'Jugador del partido', 'legendary', NULL, 999, false, NULL, 345, 'diadepartido', 'premio', true),
  ('col_clasico_icon_bengala', 'icon', 'Bengala', 'epic', 'col_clasico_icon_bengala', 52, false, NULL, 346, 'clasico', 'camino', false),
  ('col_clasico_title_sobre_la_hora', 'title', 'Sobre la hora', 'epic', NULL, 54, false, NULL, 347, 'clasico', 'camino', true),
  ('col_clasico_banner_clasico_dividido', 'banner', 'Clásico dividido', 'epic', 'col_clasico_banner_clasico_dividido', 56, false, NULL, 348, 'clasico', 'camino', false),
  ('col_clasico_frame_humo_de_colores', 'frame', 'Humo de colores', 'epic', 'col_clasico_frame_humo_de_colores', 58, false, NULL, 349, 'clasico', 'camino', false),
  ('col_clasico_banner_el_relato', 'banner', 'El relato', 'legendary', 'col_clasico_banner_el_relato', 999, false, 'col_clasico_relato', 350, 'clasico', 'logro', false),
  ('col_clasico_icon_trapo_gigante', 'icon', 'Trapo gigante', 'legendary', 'col_clasico_icon_trapo_gigante', 999, false, 'col_clasico_trapo', 351, 'clasico', 'logro', false),
  ('col_copa_icon_pelota_de_noche', 'icon', 'Pelota de noche', 'epic', 'col_copa_icon_pelota_de_noche', 62, false, NULL, 352, 'copa', 'camino', false),
  ('col_copa_title_rey_de_copas', 'title', 'Rey de copas', 'epic', NULL, 64, false, NULL, 353, 'copa', 'camino', true),
  ('col_copa_banner_se_prenden_las_luces', 'banner', 'Se prenden las luces', 'epic', 'col_copa_banner_se_prenden_las_luces', 66, false, NULL, 354, 'copa', 'camino', false),
  ('col_copa_frame_noche_de_copa', 'frame', 'Noche de copa', 'epic', 'col_copa_frame_noche_de_copa', 68, false, NULL, 355, 'copa', 'camino', false),
  ('col_copa_banner_red_de_pases', 'banner', 'Red de pases', 'legendary', 'col_copa_banner_red_de_pases', 999, false, 'col_copa_red', 356, 'copa', 'logro', false),
  ('col_copa_icon_valija', 'icon', 'Valija', 'legendary', 'col_copa_icon_valija', 999, false, 'col_copa_valija', 357, 'copa', 'logro', false),
  ('col_hinchada_icon_bufanda', 'icon', 'Bufanda', 'epic', 'col_hinchada_icon_bufanda', 72, false, NULL, 358, 'hinchada', 'camino', false),
  ('col_hinchada_title_hincha_de_ley', 'title', 'Hincha de ley', 'epic', NULL, 74, false, NULL, 359, 'hinchada', 'camino', true),
  ('col_hinchada_banner_banderazo', 'banner', 'Banderazo', 'epic', 'col_hinchada_banner_banderazo', 76, false, NULL, 360, 'hinchada', 'camino', false),
  ('col_hinchada_frame_trapos_colgados', 'frame', 'Trapos colgados', 'epic', 'col_hinchada_frame_trapos_colgados', 78, false, NULL, 361, 'hinchada', 'camino', false),
  ('col_hinchada_icon_bombo', 'icon', 'Bombo', 'legendary', 'col_hinchada_icon_bombo', 999, false, 'col_hinchada_bombo', 362, 'hinchada', 'logro', false),
  ('col_hinchada_banner_recibimiento', 'banner', 'Recibimiento', 'legendary', 'col_hinchada_banner_recibimiento', 999, false, 'col_hinchada_recibimiento', 363, 'hinchada', 'logro', false),
  ('col_hinchada_banner_tapa_de_diario', 'banner', 'Tapa de diario', 'legendary', 'col_hinchada_banner_tapa_de_diario', 999, false, 'col_hinchada_tapa', 364, 'hinchada', 'logro', false),
  ('col_hinchada_icon_corneta', 'icon', 'Corneta', 'legendary', 'col_hinchada_icon_corneta', 999, false, 'col_hinchada_corneta', 365, 'hinchada', 'logro', false),
  ('col_hinchada_frame_bufanda', 'frame', 'Bufanda', 'legendary', 'col_hinchada_frame_bufanda', 999, false, NULL, 366, 'hinchada', 'premio', false),
  ('col_hinchada_title_de_la_popular', 'title', 'De la popular', 'legendary', NULL, 999, false, NULL, 367, 'hinchada', 'premio', true),
  ('col_gloria_icon_botin_de_oro', 'icon', 'Botín de oro', 'legendary', 'col_gloria_icon_botin_de_oro', 82, false, NULL, 368, 'gloria', 'camino', false),
  ('col_gloria_title_el_que_sabe', 'title', 'El que sabe', 'legendary', NULL, 84, false, NULL, 369, 'gloria', 'camino', true),
  ('col_gloria_banner_alfombra_roja', 'banner', 'Alfombra roja', 'legendary', 'col_gloria_banner_alfombra_roja', 86, false, NULL, 370, 'gloria', 'camino', false),
  ('col_gloria_frame_laurel_dorado', 'frame', 'Laurel dorado', 'legendary', 'col_gloria_frame_laurel_dorado', 88, false, NULL, 371, 'gloria', 'camino', false),
  ('col_gloria_icon_diez_de_diez', 'icon', 'Diez de diez', 'legendary', 'col_gloria_icon_diez_de_diez', 999, false, 'col_gloria_diez', 372, 'gloria', 'logro', false),
  ('col_gloria_icon_botin_alado', 'icon', 'Botín alado', 'legendary', 'col_gloria_icon_botin_alado', 999, false, 'col_gloria_botin', 373, 'gloria', 'logro', false),
  ('col_gloria_frame_estrellas', 'frame', 'Estrellas', 'legendary', 'col_gloria_frame_estrellas', 999, false, 'col_gloria_estrellas', 374, 'gloria', 'logro', false),
  ('col_gloria_banner_tres_estrellas', 'banner', 'Tres estrellas', 'legendary', 'col_gloria_banner_tres_estrellas', 999, false, NULL, 375, 'gloria', 'premio', false),
  ('col_gloria_title_bandera_del_club', 'title', 'Bandera del club', 'legendary', NULL, 999, false, NULL, 376, 'gloria', 'premio', true),
  ('col_bestias_icon_leon', 'icon', 'León', 'legendary', 'col_bestias_icon_leon', 92, false, NULL, 377, 'bestias', 'camino', false),
  ('col_bestias_title_indomable', 'title', 'Indomable', 'legendary', NULL, 94, false, NULL, 378, 'bestias', 'camino', true),
  ('col_bestias_banner_rugido', 'banner', 'Rugido', 'legendary', 'col_bestias_banner_rugido', 96, false, NULL, 379, 'bestias', 'camino', false),
  ('col_bestias_frame_garras', 'frame', 'Garras', 'legendary', 'col_bestias_frame_garras', 98, false, NULL, 380, 'bestias', 'camino', false),
  ('col_bestias_icon_aguila', 'icon', 'Águila', 'legendary', 'col_bestias_icon_aguila', 999, false, 'col_bestias_aguila', 381, 'bestias', 'logro', false),
  ('col_bestias_icon_tiburon', 'icon', 'Tiburón', 'legendary', 'col_bestias_icon_tiburon', 999, false, 'col_bestias_tiburon', 382, 'bestias', 'logro', false),
  ('col_bestias_icon_dragon', 'icon', 'Dragón', 'legendary', 'col_bestias_icon_dragon', 999, false, 'col_bestias_dragon', 383, 'bestias', 'logro', false),
  ('col_bestias_icon_lobo', 'icon', 'Lobo', 'legendary', 'col_bestias_icon_lobo', 999, false, 'col_bestias_lobo', 384, 'bestias', 'logro', false),
  ('col_bestias_icon_toro', 'icon', 'Toro', 'legendary', 'col_bestias_icon_toro', 999, false, 'col_bestias_toro', 385, 'bestias', 'logro', false),
  ('col_bestias_frame_tormenta', 'frame', 'Tormenta', 'legendary', 'col_bestias_frame_tormenta', 999, false, NULL, 386, 'bestias', 'premio', false),
  ('col_bestias_title_fiera', 'title', 'Fiera', 'legendary', NULL, 999, false, NULL, 387, 'bestias', 'premio', true),
  ('col_album_frame_holografico', 'frame', 'Holográfico', 'legendary', 'col_album_frame_holografico', 999, false, NULL, 388, 'album', 'premio', false),
  ('col_album_title_hijo_del_futbol', 'title', 'Hijo del fútbol', 'legendary', NULL, 999, false, NULL, 389, 'album', 'premio', true)
ON CONFLICT (code) DO UPDATE SET
  type = EXCLUDED.type, name = EXCLUDED.name, rarity = EXCLUDED.rarity, style_key = EXCLUDED.style_key,
  unlock_level = EXCLUDED.unlock_level, premium_only = EXCLUDED.premium_only, unlock_achievement = EXCLUDED.unlock_achievement,
  sort_order = EXCLUDED.sort_order, collection = EXCLUDED.collection, collection_route = EXCLUDED.collection_route;

-- 4) Cosméticos existentes que entran a una colección (no se tocan sus reglas de desbloqueo)
UPDATE public.cosmetics SET collection = 'clasico', collection_route = 'legado' WHERE code = 'banner_fire';  -- Fuego
UPDATE public.cosmetics SET collection = 'album', collection_route = 'legado' WHERE code = 'icon_goat';  -- GOAT

-- 4b) La cabra (GOAT) pasa del nivel 55 al 100. Quien ya la tenía por nivel la conserva:
--     se la deja como fila explícita en user_cosmetics ANTES de subir el unlock_level.
INSERT INTO public.user_cosmetics (user_id, cosmetic_code)
SELECT u.id, 'icon_goat' FROM auth.users u
WHERE public.owns_cosmetic(u.id, 'icon_goat')
ON CONFLICT DO NOTHING;
UPDATE public.cosmetics SET unlock_level = 100 WHERE code = 'icon_goat';

-- 5) grant_cosmetic: duplicado → Fichas por rareza
CREATE OR REPLACE FUNCTION public.grant_cosmetic(p_user_id UUID, p_code TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rarity TEXT;
  v_dup BOOLEAN;
  v_fichas INTEGER;
BEGIN
  IF p_user_id IS NULL OR p_code IS NULL THEN RETURN; END IF;
  SELECT rarity INTO v_rarity FROM public.cosmetics WHERE code = p_code;
  IF v_rarity IS NULL THEN RETURN; END IF;

  -- "Ya lo tenía": fila explícita o lo poseía por nivel/logro
  v_dup := EXISTS(SELECT 1 FROM public.user_cosmetics WHERE user_id = p_user_id AND cosmetic_code = p_code)
           OR public.owns_cosmetic(p_user_id, p_code);

  INSERT INTO public.user_cosmetics (user_id, cosmetic_code)
  VALUES (p_user_id, p_code) ON CONFLICT DO NOTHING;

  IF v_dup THEN
    v_fichas := CASE v_rarity WHEN 'rare' THEN 250 WHEN 'epic' THEN 600 WHEN 'legendary' THEN 1250 ELSE 0 END;
    IF v_fichas > 0 AND to_regprocedure('public.award_fichas(uuid,integer,text,jsonb)') IS NOT NULL THEN
      PERFORM public.award_fichas(p_user_id, v_fichas, 'cosmetic_duplicate',
        jsonb_build_object('code', p_code, 'rarity', v_rarity));
    END IF;
  END IF;
END$$;
REVOKE ALL ON FUNCTION public.grant_cosmetic(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.grant_cosmetic(UUID, TEXT) FROM anon, authenticated;

-- 6) Premio por colección completa
--    Requiere TODAS las piezas no-premio (activas y en propiedad). Mientras falte arte
--    (piezas active=false) la colección no se puede completar: a propósito.
--    'album' (GOAT) = todas las piezas no-premio de TODAS las colecciones.
CREATE OR REPLACE FUNCTION public.claim_collection_prize(p_collection TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  v_missing INTEGER;
  v_prizes TEXT[];
BEGIN
  IF uid IS NULL THEN RETURN json_build_object('ok', false, 'error', 'auth'); END IF;

  SELECT array_agg(code) INTO v_prizes FROM public.cosmetics
  WHERE collection = p_collection AND collection_route = 'premio';
  IF v_prizes IS NULL THEN RETURN json_build_object('ok', false, 'error', 'no_prize'); END IF;

  IF NOT EXISTS (SELECT 1 FROM unnest(v_prizes) c
                 WHERE NOT EXISTS (SELECT 1 FROM public.user_cosmetics uc WHERE uc.user_id = uid AND uc.cosmetic_code = c)) THEN
    RETURN json_build_object('ok', false, 'error', 'already_claimed');
  END IF;

  SELECT COUNT(*) INTO v_missing FROM public.cosmetics c
  WHERE c.collection IS NOT NULL
    AND c.collection_route <> 'premio'
    AND (p_collection = 'album' OR c.collection = p_collection)
    AND NOT (c.active AND public.owns_cosmetic(uid, c.code));
  IF v_missing > 0 THEN
    RETURN json_build_object('ok', false, 'error', 'incomplete', 'missing', v_missing);
  END IF;

  INSERT INTO public.user_cosmetics (user_id, cosmetic_code)
  SELECT uid, c FROM unnest(v_prizes) c ON CONFLICT DO NOTHING;
  RETURN json_build_object('ok', true, 'collection', p_collection, 'granted', to_json(v_prizes));
END$$;
GRANT EXECUTE ON FUNCTION public.claim_collection_prize(TEXT) TO authenticated;

COMMIT;

-- Verificación
-- SELECT collection, collection_route, COUNT(*), COUNT(*) FILTER (WHERE active) AS activos
-- FROM public.cosmetics WHERE collection IS NOT NULL GROUP BY 1, 2 ORDER BY 1, 2;
