/**
 * CURVA DE NIVELES 1–100 (relanzamiento · progresión)
 *
 * Fuente única del lado del cliente para la XP acumulada que pide cada nivel.
 * Espejo EXACTO de supabase/pendientes/2026-11-24-10-curva-1-100.sql
 * (si cambiás uno, regenerá el otro con `node scripts/progresion-curva.mjs`).
 *
 * Costo de pasar del nivel n al n+1:
 *   n ≤ 3 → 50·(n+1)                      (100, 150, 200: el arranque de siempre)
 *   n ≥ 4 → redondeo50( 250 + 6650·(1 − e^(−(n−4)/32)) )
 * Es una saturación suave: arranca en 250, sube rápido en los primeros rangos y
 * se aplana cerca de ~6.550 XP por nivel en el tramo final.
 *
 * Calibrada para un jugador diario (~2.340 XP/día, ver docs/relanzamiento/PROGRESION.md):
 *   NV 10 ≈ día 2 · NV 30 ≈ día 25 · NV 50 ≈ día 61 · NV 80 ≈ día 130 · NV 100 ≈ día 181.
 */

export const MAX_LEVEL = 100
export const CURVE = { start: 250, span: 6650, tau: 32, from: 4 }

const round50 = (x) => Math.round(x / 50) * 50

/** XP que cuesta pasar del nivel n al n+1 (n en 1..99). */
export function levelCost(n) {
  const lvl = Math.max(1, Math.floor(Number(n) || 1))
  if (lvl <= 3) return 50 * (lvl + 1)
  return round50(CURVE.start + CURVE.span * (1 - Math.exp(-(lvl - CURVE.from) / CURVE.tau)))
}

// Tabla literal (índice = nivel − 1). Generada con levelCost(); se deja escrita
// para que el diff sea revisable y coincida 1:1 con el SQL.
export const LEVEL_XP = [
  0, 100, 250, 450, 700, 1150, 1800, 2650, 3700, 4900,
  6300, 7850, 9550, 11450, 13500, 15700, 18050, 20500, 23100, 25850,
  28700, 31700, 34800, 38050, 41400, 44850, 48400, 52050, 55800, 59650,
  63600, 67650, 71800, 76000, 80300, 84700, 89150, 93700, 98300, 102950,
  107700, 112500, 117350, 122300, 127300, 132350, 137450, 142600, 147800, 153050,
  158350, 163700, 169100, 174550, 180050, 185600, 191200, 196850, 202500, 208200,
  213950, 219750, 225550, 231400, 237300, 243200, 249150, 255100, 261100, 267150,
  273200, 279300, 285400, 291550, 297700, 303900, 310100, 316300, 322550, 328800,
  335100, 341400, 347700, 354050, 360400, 366750, 373150, 379550, 385950, 392400,
  398850, 405300, 411750, 418250, 424750, 431250, 437750, 444300, 450850, 457400,
]

/** Mismo formato que la tabla level_thresholds: [{ level, xp_required }]. */
export const LEVEL_THRESHOLDS = LEVEL_XP.map((xp, i) => ({ level: i + 1, xp_required: xp }))

/** XP acumulada para llegar al nivel. */
export function xpForLevel(level) {
  const l = Math.max(1, Math.min(MAX_LEVEL, Math.floor(Number(level) || 1)))
  return LEVEL_XP[l - 1]
}

/** Nivel para una XP total. */
export function levelForXp(xp) {
  const x = Number(xp) || 0
  let lvl = 1
  for (let i = 0; i < LEVEL_XP.length; i++) if (LEVEL_XP[i] <= x) lvl = i + 1
  return lvl
}

/** Progreso dentro del nivel: { level, earned, range, pct }. En NV 100 queda al 100 %. */
export function levelProgress(xp) {
  const level = levelForXp(xp)
  if (level >= MAX_LEVEL) return { level, earned: 0, range: 0, pct: 100 }
  const cur = LEVEL_XP[level - 1], nxt = LEVEL_XP[level]
  const earned = Math.max(0, (Number(xp) || 0) - cur)
  const range = nxt - cur
  return { level, earned, range, pct: Math.min(100, Math.round((earned / range) * 100)) }
}
