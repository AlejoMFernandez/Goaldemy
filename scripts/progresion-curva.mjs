#!/usr/bin/env node
/**
 * Curva 1–100: verifica level-curve.js contra la fórmula, simula días por nivel
 * y genera supabase/pendientes/2026-11-24-10-curva-1-100.sql.
 *
 *   node scripts/progresion-curva.mjs           → imprime tabla + simulación
 *   node scripts/progresion-curva.mjs --sql     → además reescribe el SQL
 *
 * XP/día del modelo: ver docs/relanzamiento/PROGRESION.md (diario ≈ 2.340, casual ≈ 1.200),
 * más el bonus de subir de nivel que otorga el cliente (level-rewards.js).
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { LEVEL_XP, levelCost } from '../src/services/level-curve.js'
import { getLevelUpXpBonus, getMilestone } from '../src/services/level-rewards.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// 1) La tabla literal tiene que coincidir con la fórmula
let acc = 0
for (let l = 1; l <= 100; l++) {
  if (LEVEL_XP[l - 1] !== acc) { console.error(`Tabla ≠ fórmula en NV ${l}: ${LEVEL_XP[l - 1]} vs ${acc}`); process.exit(1) }
  acc += l < 100 ? levelCost(l) : 0
}

// 2) Simulación día a día (con bonus de subida de nivel / hito de rango)
function simulate(perDay) {
  let xp = 0, lvl = 1
  const day = { 1: 0 }
  for (let d = 1; d <= 1200 && lvl < 100; d++) {
    xp += perDay
    while (lvl < 100 && xp >= LEVEL_XP[lvl]) {
      lvl++
      const ms = getMilestone(lvl)
      xp += ms ? ms.xpBonus : getLevelUpXpBonus(lvl)
      day[lvl] = d
    }
  }
  return day
}
const daily = simulate(2340), casual = simulate(1200)
console.log('NV  | XP acumulada | costo nivel | día diario | día casual')
for (let l = 5; l <= 100; l += 5) {
  const l2 = l === 5 ? [2, 3, 4, 5] : [l]
  for (const L of l2) console.log(`${String(L).padStart(3)} | ${String(LEVEL_XP[L - 1]).padStart(12)} | ${String(L < 100 ? levelCost(L) : '-').padStart(11)} | ${String(daily[L]).padStart(10)} | ${String(casual[L]).padStart(10)}`)
}

// 3) SQL
if (process.argv.includes('--sql')) {
  const OLD = [0, 100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700, 3300, 4000, 4800, 5700, 6700, 7800, 9000, 10300, 11700, 13200,
    14850, 16650, 18600, 20700, 22950, 25350, 27900, 30600, 33450, 36450]
  const rows = LEVEL_XP.map((xp, i) => `  (${i + 1}, ${xp})`).join(',\n')
  const oldRows = OLD.map((xp, i) => `(${i + 1}, ${xp})`).join(', ')
  const sql = `-- ============================================================
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
--          ${oldRows}
--        ON CONFLICT (level) DO UPDATE SET xp_required = EXCLUDED.xp_required;
-- Idempotente: se puede correr más de una vez.
-- ============================================================

-- 0) (solo lectura) ¿A cuántos usuarios les baja el nivel? Correr ANTES.
-- WITH xp AS (SELECT user_id, SUM(amount) AS xp FROM public.xp_events GROUP BY user_id),
-- old_t(level, xp_required) AS (VALUES ${oldRows}),
-- new_t(level, xp_required) AS (VALUES
${LEVEL_XP.map((xp, i) => `--   (${i + 1}, ${xp})`).join(',\n')}
-- )
-- SELECT COUNT(*) FILTER (WHERE n < o) AS bajan, COUNT(*) AS total FROM (
--   SELECT x.user_id,
--     (SELECT MAX(level) FROM old_t WHERE xp_required <= x.xp) AS o,
--     (SELECT MAX(level) FROM new_t WHERE xp_required <= x.xp) AS n
--   FROM xp x) s;

BEGIN;

INSERT INTO public.level_thresholds (level, xp_required) VALUES
${rows}
ON CONFLICT (level) DO UPDATE SET xp_required = EXCLUDED.xp_required;

-- Por si alguna vez se cargó algo más allá de 100
DELETE FROM public.level_thresholds WHERE level > 100;

COMMIT;

-- Verificación
-- SELECT COUNT(*) AS niveles, MAX(xp_required) AS xp_nv100 FROM public.level_thresholds;  -- 100 · ${LEVEL_XP[99]}

-- ============================================================
-- OPCIONAL · Compensación: nadie baja de nivel con la curva nueva.
-- Le da a cada usuario la XP justa para quedar en el MISMO nivel que tenía
-- (al inicio de ese nivel). Queda registrado como reason='curve_migration'.
-- Correr UNA sola vez, en la misma ventana que el upsert de arriba.
-- (Ojo: si award_xp/xp_events mapea reason→fichas por trigger, revisarlo antes.)
-- ============================================================
-- WITH xp AS (SELECT user_id, SUM(amount)::bigint AS xp FROM public.xp_events GROUP BY user_id),
-- old_t(level, xp_required) AS (VALUES ${oldRows}),
-- prev AS (SELECT x.user_id, x.xp, (SELECT MAX(level) FROM old_t WHERE xp_required <= x.xp) AS old_level FROM xp x)
-- INSERT INTO public.xp_events (user_id, game_id, amount, reason, session_id, meta)
-- SELECT p.user_id, NULL, (lt.xp_required - p.xp)::int, 'curve_migration', NULL,
--        jsonb_build_object('old_level', p.old_level, 'curve', '2026-11-24')
-- FROM prev p JOIN public.level_thresholds lt ON lt.level = p.old_level
-- WHERE lt.xp_required > p.xp
--   AND NOT EXISTS (SELECT 1 FROM public.xp_events e WHERE e.user_id = p.user_id AND e.reason = 'curve_migration');
`
  const out = resolve(ROOT, 'supabase/pendientes/2026-11-24-10-curva-1-100.sql')
  writeFileSync(out, sql)
  console.log('\nSQL →', out)
}
