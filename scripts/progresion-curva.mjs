#!/usr/bin/env node
/**
 * Curva 1–100 (la de feature/rangos-100): verifica que src/services/level-curve.js
 * coincida con la base (1–30) y con el SQL 51–100, simula los días por nivel y
 * (con --sql) genera supabase/pendientes/2026-11-24-10-curva-31-50.sql.
 *
 *   node scripts/progresion-curva.mjs           → verifica + tabla + simulación
 *   node scripts/progresion-curva.mjs --sql     → además reescribe el SQL 31–50
 *
 * La base hoy tiene 1–30. Orden para aplicar (con aprobación de Alejo):
 *   1) 2026-11-24-10-curva-31-50.sql   2) 2026-10-03-rangos-curva-xp-51-100.sql
 *
 * XP/día del modelo: docs/relanzamiento/PROGRESION.md (jornada completa ≈ 5.200,
 * diario ≈ 2.340, casual ≈ 1.200), más el bonus de subir de nivel (level-rewards.js).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { LEVEL_XP, levelCost } from '../src/services/level-curve.js'
import { getLevelUpXpBonus, getMilestone } from '../src/services/level-rewards.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SQL_51 = resolve(ROOT, 'supabase/pendientes/2026-10-03-rangos-curva-xp-51-100.sql')
const SQL_31 = resolve(ROOT, 'supabase/pendientes/2026-11-24-10-curva-31-50.sql')

// 1–30: lo que hay hoy en la base (no cambia)
const DB_1_30 = [0, 100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700, 3300, 4000, 4800, 5700, 6700, 7800, 9000, 10300, 11700, 13200,
  14850, 16650, 18600, 20700, 22950, 25350, 27900, 30600, 33450, 36450]

function fail(msg) { console.error('✗', msg); process.exit(1) }

// 1) 100 niveles crecientes, que respeten la base (1–30) y el SQL 51–100
if (LEVEL_XP.length !== 100) fail(`level-curve.js tiene ${LEVEL_XP.length} niveles`)
for (let i = 1; i < 100; i++) if (LEVEL_XP[i] <= LEVEL_XP[i - 1]) fail(`NV ${i + 1} no crece`)
DB_1_30.forEach((xp, i) => { if (LEVEL_XP[i] !== xp) fail(`NV ${i + 1}: ${LEVEL_XP[i]} ≠ base ${xp}`) })
const sql51 = readFileSync(SQL_51, 'utf8')
let n51 = 0
for (const [, l, xp] of sql51.matchAll(/\((\d+),\s*(\d+)\)/g)) {
  n51++
  if (LEVEL_XP[Number(l) - 1] !== Number(xp)) fail(`NV ${l}: level-curve ${LEVEL_XP[Number(l) - 1]} ≠ SQL 51–100 ${xp}`)
}
if (n51 !== 50) fail(`el SQL 51–100 tiene ${n51} filas`)

// 2) Simulación día a día (con bonus de subida de nivel / hito de rango)
function simulate(perDay) {
  let xp = 0, lvl = 1
  const day = { 1: 0 }
  for (let d = 1; d <= 2000 && lvl < 100; d++) {
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
const full = simulate(5200), daily = simulate(2340), casual = simulate(1200)
console.log('NV  | XP acumulada | costo nivel | jornada completa | diario | casual')
for (const L of [2, 3, 4, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]) {
  console.log(`${String(L).padStart(3)} | ${String(LEVEL_XP[L - 1]).padStart(12)} | ${String(L < 100 ? levelCost(L) : '-').padStart(11)} | ${String(full[L] ?? '-').padStart(16)} | ${String(daily[L] ?? '-').padStart(6)} | ${String(casual[L] ?? '-').padStart(6)}`)
}

// 3) SQL 31–50
if (process.argv.includes('--sql')) {
  const rows = LEVEL_XP.slice(30, 50).map((xp, i) => `  (${i + 31}, ${xp})`).join(',\n')
  const sql = `-- ============================================================
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
${rows}
ON CONFLICT (level) DO UPDATE SET xp_required = EXCLUDED.xp_required;

COMMIT;

-- Verificación
-- SELECT level, xp_required FROM public.level_thresholds WHERE level IN (30, 31, 50) ORDER BY level;
-- → 30 · 36450 | 31 · ${LEVEL_XP[30]} | 50 · ${LEVEL_XP[49]}
`
  writeFileSync(SQL_31, sql)
  console.log('\nSQL →', SQL_31)
}
