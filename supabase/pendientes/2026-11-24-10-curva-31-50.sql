-- ============================================================
-- FULVO · 2026-11-24 · 10 · CURVA DE NIVELES 31–50
-- ============================================================
-- QUÉ:   Agrega a public.level_thresholds los niveles 31..50 de la curva de
--        siempre (la de feature/rangos-100: 1–50 no cambia). Hoy la base tiene
--        1..30 y el nivel queda clavado en 30 desde 36.450 XP.
--        Generado por scripts/progresion-curva.mjs (espejo de src/services/level-curve.js).
-- POR QUÉ: la curva final es la de rangos-100 (NV 100 = 936.000 XP). Su SQL
--        (2026-10-03-rangos-curva-xp-51-100.sql) agrega 51..100 pero da por hecho
--        que 31..50 ya existen. Sin este archivo quedaría un hueco entre 30 y 51.
-- ORDEN:  1) este archivo  2) 2026-10-03-rangos-curva-xp-51-100.sql
-- NADIE BAJA: 1..30 no se toca; 31..50 solo agrega niveles (más XP = más nivel).
-- FUNCIONES: get_user_level, user_level_of y get_leaderboard leen esta tabla
--        (ORDER BY level DESC LIMIT 1): no hace falta tocar ninguna función.
-- ROLLBACK:
--        DELETE FROM public.level_thresholds WHERE level BETWEEN 31 AND 50;
-- Idempotente: se puede correr más de una vez.
-- ============================================================

BEGIN;

INSERT INTO public.level_thresholds (level, xp_required) VALUES
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
  (50, 130700)
ON CONFLICT (level) DO UPDATE SET xp_required = EXCLUDED.xp_required;

COMMIT;

-- Verificación
-- SELECT level, xp_required FROM public.level_thresholds WHERE level IN (30, 31, 50) ORDER BY level;
-- → 30 · 36450 | 31 · 39600 | 50 · 130700
