-- ============================================================
-- FULVO · 2026-11-24 · 10 · CURVA DE NIVELES 1–100
-- ============================================================
-- QUÉ:   Upsert de public.level_thresholds para los niveles 1..100 (hoy la
--        DB tiene 1..30 y el nivel queda clavado en 30 desde 36.450 XP).
--        Costo por nivel: n≤3 → 50·(n+1); n≥4 → redondeo50(250 + 6650·(1−e^(−(n−4)/32))).
--        Generado por scripts/progresion-curva.mjs (espejo de src/services/level-curve.js).
-- POR QUÉ: un jugador diario (~2.340 XP/día) llega a NV 100 en ~180 días:
--        NV 10 ≈ día 2 · NV 30 ≈ día 25 · NV 50 ≈ día 61 · NV 80 ≈ día 130.
--        Detalle en docs/relanzamiento/PROGRESION.md.
-- FUNCIONES: get_user_level, user_level_of, get_leaderboard y patch-fix-profiles
--        calculan el nivel SOLO con esta tabla (ORDER BY level DESC LIMIT 1),
--        sin tope fijo en el código → no hace falta reemplazar ninguna función.
-- OJO:   los niveles 5..30 ahora piden MÁS XP que antes. Un usuario con XP
--        fija puede BAJAR de nivel (p. ej. 36.450 XP: antes NV 30, ahora NV 24).
--        Ver bloque OPCIONAL al final (compensación para no bajar a nadie).
-- ROLLBACK:
--        DELETE FROM public.level_thresholds WHERE level > 30;
--        INSERT INTO public.level_thresholds(level, xp_required) VALUES
--          (1, 0), (2, 100), (3, 250), (4, 450), (5, 700), (6, 1000), (7, 1350), (8, 1750), (9, 2200), (10, 2700), (11, 3300), (12, 4000), (13, 4800), (14, 5700), (15, 6700), (16, 7800), (17, 9000), (18, 10300), (19, 11700), (20, 13200), (21, 14850), (22, 16650), (23, 18600), (24, 20700), (25, 22950), (26, 25350), (27, 27900), (28, 30600), (29, 33450), (30, 36450)
--        ON CONFLICT (level) DO UPDATE SET xp_required = EXCLUDED.xp_required;
-- Idempotente: se puede correr más de una vez.
-- ============================================================

-- 0) (solo lectura) ¿A cuántos usuarios les baja el nivel? Correr ANTES.
-- WITH xp AS (SELECT user_id, SUM(amount) AS xp FROM public.xp_events GROUP BY user_id),
-- old_t(level, xp_required) AS (VALUES (1, 0), (2, 100), (3, 250), (4, 450), (5, 700), (6, 1000), (7, 1350), (8, 1750), (9, 2200), (10, 2700), (11, 3300), (12, 4000), (13, 4800), (14, 5700), (15, 6700), (16, 7800), (17, 9000), (18, 10300), (19, 11700), (20, 13200), (21, 14850), (22, 16650), (23, 18600), (24, 20700), (25, 22950), (26, 25350), (27, 27900), (28, 30600), (29, 33450), (30, 36450)),
-- new_t(level, xp_required) AS (VALUES
--   (1, 0),
--   (2, 100),
--   (3, 250),
--   (4, 450),
--   (5, 700),
--   (6, 1150),
--   (7, 1800),
--   (8, 2650),
--   (9, 3700),
--   (10, 4900),
--   (11, 6300),
--   (12, 7850),
--   (13, 9550),
--   (14, 11450),
--   (15, 13500),
--   (16, 15700),
--   (17, 18050),
--   (18, 20500),
--   (19, 23100),
--   (20, 25850),
--   (21, 28700),
--   (22, 31700),
--   (23, 34800),
--   (24, 38050),
--   (25, 41400),
--   (26, 44850),
--   (27, 48400),
--   (28, 52050),
--   (29, 55800),
--   (30, 59650),
--   (31, 63600),
--   (32, 67650),
--   (33, 71800),
--   (34, 76000),
--   (35, 80300),
--   (36, 84700),
--   (37, 89150),
--   (38, 93700),
--   (39, 98300),
--   (40, 102950),
--   (41, 107700),
--   (42, 112500),
--   (43, 117350),
--   (44, 122300),
--   (45, 127300),
--   (46, 132350),
--   (47, 137450),
--   (48, 142600),
--   (49, 147800),
--   (50, 153050),
--   (51, 158350),
--   (52, 163700),
--   (53, 169100),
--   (54, 174550),
--   (55, 180050),
--   (56, 185600),
--   (57, 191200),
--   (58, 196850),
--   (59, 202500),
--   (60, 208200),
--   (61, 213950),
--   (62, 219750),
--   (63, 225550),
--   (64, 231400),
--   (65, 237300),
--   (66, 243200),
--   (67, 249150),
--   (68, 255100),
--   (69, 261100),
--   (70, 267150),
--   (71, 273200),
--   (72, 279300),
--   (73, 285400),
--   (74, 291550),
--   (75, 297700),
--   (76, 303900),
--   (77, 310100),
--   (78, 316300),
--   (79, 322550),
--   (80, 328800),
--   (81, 335100),
--   (82, 341400),
--   (83, 347700),
--   (84, 354050),
--   (85, 360400),
--   (86, 366750),
--   (87, 373150),
--   (88, 379550),
--   (89, 385950),
--   (90, 392400),
--   (91, 398850),
--   (92, 405300),
--   (93, 411750),
--   (94, 418250),
--   (95, 424750),
--   (96, 431250),
--   (97, 437750),
--   (98, 444300),
--   (99, 450850),
--   (100, 457400)
-- )
-- SELECT COUNT(*) FILTER (WHERE n < o) AS bajan, COUNT(*) AS total FROM (
--   SELECT x.user_id,
--     (SELECT MAX(level) FROM old_t WHERE xp_required <= x.xp) AS o,
--     (SELECT MAX(level) FROM new_t WHERE xp_required <= x.xp) AS n
--   FROM xp x) s;

BEGIN;

INSERT INTO public.level_thresholds (level, xp_required) VALUES
  (1, 0),
  (2, 100),
  (3, 250),
  (4, 450),
  (5, 700),
  (6, 1150),
  (7, 1800),
  (8, 2650),
  (9, 3700),
  (10, 4900),
  (11, 6300),
  (12, 7850),
  (13, 9550),
  (14, 11450),
  (15, 13500),
  (16, 15700),
  (17, 18050),
  (18, 20500),
  (19, 23100),
  (20, 25850),
  (21, 28700),
  (22, 31700),
  (23, 34800),
  (24, 38050),
  (25, 41400),
  (26, 44850),
  (27, 48400),
  (28, 52050),
  (29, 55800),
  (30, 59650),
  (31, 63600),
  (32, 67650),
  (33, 71800),
  (34, 76000),
  (35, 80300),
  (36, 84700),
  (37, 89150),
  (38, 93700),
  (39, 98300),
  (40, 102950),
  (41, 107700),
  (42, 112500),
  (43, 117350),
  (44, 122300),
  (45, 127300),
  (46, 132350),
  (47, 137450),
  (48, 142600),
  (49, 147800),
  (50, 153050),
  (51, 158350),
  (52, 163700),
  (53, 169100),
  (54, 174550),
  (55, 180050),
  (56, 185600),
  (57, 191200),
  (58, 196850),
  (59, 202500),
  (60, 208200),
  (61, 213950),
  (62, 219750),
  (63, 225550),
  (64, 231400),
  (65, 237300),
  (66, 243200),
  (67, 249150),
  (68, 255100),
  (69, 261100),
  (70, 267150),
  (71, 273200),
  (72, 279300),
  (73, 285400),
  (74, 291550),
  (75, 297700),
  (76, 303900),
  (77, 310100),
  (78, 316300),
  (79, 322550),
  (80, 328800),
  (81, 335100),
  (82, 341400),
  (83, 347700),
  (84, 354050),
  (85, 360400),
  (86, 366750),
  (87, 373150),
  (88, 379550),
  (89, 385950),
  (90, 392400),
  (91, 398850),
  (92, 405300),
  (93, 411750),
  (94, 418250),
  (95, 424750),
  (96, 431250),
  (97, 437750),
  (98, 444300),
  (99, 450850),
  (100, 457400)
ON CONFLICT (level) DO UPDATE SET xp_required = EXCLUDED.xp_required;

-- Por si alguna vez se cargó algo más allá de 100
DELETE FROM public.level_thresholds WHERE level > 100;

COMMIT;

-- Verificación
-- SELECT COUNT(*) AS niveles, MAX(xp_required) AS xp_nv100 FROM public.level_thresholds;  -- 100 · 457400

-- ============================================================
-- OPCIONAL · Compensación: nadie baja de nivel con la curva nueva.
-- Le da a cada usuario la XP justa para quedar en el MISMO nivel que tenía
-- (al inicio de ese nivel). Queda registrado como reason='curve_migration'.
-- Correr UNA sola vez, en la misma ventana que el upsert de arriba.
-- (Ojo: si award_xp/xp_events mapea reason→fichas por trigger, revisarlo antes.)
-- ============================================================
-- WITH xp AS (SELECT user_id, SUM(amount)::bigint AS xp FROM public.xp_events GROUP BY user_id),
-- old_t(level, xp_required) AS (VALUES (1, 0), (2, 100), (3, 250), (4, 450), (5, 700), (6, 1000), (7, 1350), (8, 1750), (9, 2200), (10, 2700), (11, 3300), (12, 4000), (13, 4800), (14, 5700), (15, 6700), (16, 7800), (17, 9000), (18, 10300), (19, 11700), (20, 13200), (21, 14850), (22, 16650), (23, 18600), (24, 20700), (25, 22950), (26, 25350), (27, 27900), (28, 30600), (29, 33450), (30, 36450)),
-- prev AS (SELECT x.user_id, x.xp, (SELECT MAX(level) FROM old_t WHERE xp_required <= x.xp) AS old_level FROM xp x)
-- INSERT INTO public.xp_events (user_id, game_id, amount, reason, session_id, meta)
-- SELECT p.user_id, NULL, (lt.xp_required - p.xp)::int, 'curve_migration', NULL,
--        jsonb_build_object('old_level', p.old_level, 'curve', '2026-11-24')
-- FROM prev p JOIN public.level_thresholds lt ON lt.level = p.old_level
-- WHERE lt.xp_required > p.xp
--   AND NOT EXISTS (SELECT 1 FROM public.xp_events e WHERE e.user_id = p.user_id AND e.reason = 'curve_migration');
