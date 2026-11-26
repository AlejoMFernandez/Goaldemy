-- ════════════════════════════════════════════════════════════════════
--  2026-11-26 — CURVA DE NIVELES 1–100 (arregla level_thresholds rota)
-- ════════════════════════════════════════════════════════════════════
--  QUÉ: deja public.level_thresholds con EXACTAMENTE los 100 niveles de la curva
--      de rangos-100 que usa el cliente v4 (src/services/level-curve.js →
--      LEVEL_XP; NV 100 = 936.000 XP). UPSERT de 1..100 + borra cualquier nivel
--      fuera de 1..100.
--      REEMPLAZA a 2026-11-24-10-curva-31-50.sql y
--      2026-10-03-rangos-curva-xp-51-100.sql (no correr esos).
--
--  POR QUÉ: en prod (26/11) la tabla no es monótona: 1–30 tiene una curva vieja
--      más empinada (30 = 95.000) y 31–50 la nueva (31 = 39.600). Con la regla
--      "nivel = mayor level con xp_required <= XP" un usuario con 31.000 XP queda
--      en NV 21, y uno con 40.000 salta de 21 a 31.
--
--  CÓMO SE CALCULA EL NIVEL EN LA BASE: no hay columna de nivel guardada.
--      get_user_level, user_level_of, get_leaderboard, get_users_cosmetic_stats y
--      get_friends_leaderboard lo calculan en el momento: SUM(xp_events.amount) y
--      ORDER BY level DESC LIMIT 1 sobre esta tabla. Al cambiar la tabla cambia el
--      nivel mostrado al instante, sin migrar datos. owns_cosmetic usa
--      user_level_of → los cosméticos por nivel se ajustan solos.
--
--  IMPACTO: 1–30 pasa a pedir MENOS XP que la curva vieja → los usuarios suben o
--      quedan igual, nadie baja (ver la consulta de vista previa en
--      APLICAR-2026-11-26.md). Aceptado: no hay usuarios reales.
--      Debe correr ANTES de 2026-11-24-04-xp-servidor.sql (su backfill de bonus
--      de nivel usa esta tabla).
--
--  ROLLBACK: la tabla original está en backup_20261126.level_thresholds:
--      BEGIN; DELETE FROM public.level_thresholds;
--      INSERT INTO public.level_thresholds SELECT * FROM backup_20261126.level_thresholds; COMMIT;
--  Idempotente. Verificación = checksum md5 de "nivel:xp" igual al de level-curve.js.
-- ════════════════════════════════════════════════════════════════════

BEGIN;

INSERT INTO public.level_thresholds (level, xp_required) VALUES
  (1, 0),
  (2, 100),
  (3, 250),
  (4, 450),
  (5, 700),
  (6, 1000),
  (7, 1350),
  (8, 1750),
  (9, 2200),
  (10, 2700),
  (11, 3300),
  (12, 4000),
  (13, 4800),
  (14, 5700),
  (15, 6700),
  (16, 7800),
  (17, 9000),
  (18, 10300),
  (19, 11700),
  (20, 13200),
  (21, 14850),
  (22, 16650),
  (23, 18600),
  (24, 20700),
  (25, 22950),
  (26, 25350),
  (27, 27900),
  (28, 30600),
  (29, 33450),
  (30, 36450),
  (31, 39600),
  (32, 42900),
  (33, 46350),
  (34, 49950),
  (35, 53700),
  (36, 57600),
  (37, 61650),
  (38, 65850),
  (39, 70200),
  (40, 74700),
  (41, 79400),
  (42, 84300),
  (43, 89400),
  (44, 94700),
  (45, 100200),
  (46, 105900),
  (47, 111800),
  (48, 117900),
  (49, 124200),
  (50, 130700),
  (51, 137400),
  (52, 144300),
  (53, 151450),
  (54, 158800),
  (55, 166400),
  (56, 174250),
  (57, 182350),
  (58, 190750),
  (59, 199350),
  (60, 208250),
  (61, 217450),
  (62, 226950),
  (63, 236750),
  (64, 246850),
  (65, 257300),
  (66, 268050),
  (67, 279150),
  (68, 290650),
  (69, 302500),
  (70, 314700),
  (71, 327300),
  (72, 340350),
  (73, 353750),
  (74, 367650),
  (75, 381950),
  (76, 396750),
  (77, 411950),
  (78, 427700),
  (79, 443950),
  (80, 460750),
  (81, 478050),
  (82, 495900),
  (83, 514350),
  (84, 533350),
  (85, 553000),
  (86, 573250),
  (87, 594200),
  (88, 615800),
  (89, 638100),
  (90, 661100),
  (91, 684850),
  (92, 709350),
  (93, 734650),
  (94, 760750),
  (95, 787700),
  (96, 815500),
  (97, 844200),
  (98, 873850),
  (99, 904450),
  (100, 936000)
ON CONFLICT (level) DO UPDATE SET xp_required = EXCLUDED.xp_required
  WHERE public.level_thresholds.xp_required IS DISTINCT FROM EXCLUDED.xp_required;

DELETE FROM public.level_thresholds WHERE level < 1 OR level > 100;

COMMIT;

-- Verificación: 100 niveles, monótona y checksum idéntico al de src/services/level-curve.js.
SELECT count(*) = 100
   AND md5(string_agg(level || ':' || xp_required, ',' ORDER BY level)) = 'dbca40e32b9aa435b303054ddebdb54b' AS ok,
       count(*) AS niveles, max(xp_required) AS xp_nv100
FROM public.level_thresholds;
