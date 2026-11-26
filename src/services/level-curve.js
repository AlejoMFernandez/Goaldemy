/**
 * CURVA DE NIVELES 1–100 (feature/rangos-100, la de Alejo)
 *
 * Fuente única del lado del cliente para la XP acumulada que pide cada nivel.
 *   · 1–50: la tabla de siempre (nadie pierde niveles). En la base hoy hay 1–30:
 *     supabase/pendientes/2026-11-24-10-curva-31-50.sql completa 31–50.
 *   · 51–100: supabase/pendientes/2026-10-03-rangos-curva-xp-51-100.sql
 *     (costo = 6.700 × 1,0321^k, redondeado a 50). NV 100 = 936.000 XP.
 * Los dos SQL son espejo exacto de esta tabla: `node scripts/progresion-curva.mjs` lo verifica.
 *
 * Días estimados (docs/relanzamiento/PROGRESION.md): jornada completa (~5.200 XP/día)
 * llega al 100 en ~174 días; un jugador diario del modelo (~2.340 XP/día) en ~385.
 */

export const MAX_LEVEL = 100

// Tabla literal (índice = nivel − 1)
export const LEVEL_XP = [
  0, 100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700,
  3300, 4000, 4800, 5700, 6700, 7800, 9000, 10300, 11700, 13200,
  14850, 16650, 18600, 20700, 22950, 25350, 27900, 30600, 33450, 36450,
  39600, 42900, 46350, 49950, 53700, 57600, 61650, 65850, 70200, 74700,
  79400, 84300, 89400, 94700, 100200, 105900, 111800, 117900, 124200, 130700,
  137400, 144300, 151450, 158800, 166400, 174250, 182350, 190750, 199350, 208250,
  217450, 226950, 236750, 246850, 257300, 268050, 279150, 290650, 302500, 314700,
  327300, 340350, 353750, 367650, 381950, 396750, 411950, 427700, 443950, 460750,
  478050, 495900, 514350, 533350, 553000, 573250, 594200, 615800, 638100, 661100,
  684850, 709350, 734650, 760750, 787700, 815500, 844200, 873850, 904450, 936000,
]

/** Mismo formato que la tabla level_thresholds: [{ level, xp_required }]. */
export const LEVEL_THRESHOLDS = LEVEL_XP.map((xp, i) => ({ level: i + 1, xp_required: xp }))

/** XP que cuesta pasar del nivel n al n+1 (n en 1..99). */
export function levelCost(n) {
  const l = Math.max(1, Math.min(MAX_LEVEL - 1, Math.floor(Number(n) || 1)))
  return LEVEL_XP[l] - LEVEL_XP[l - 1]
}

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

/**
 * Une los umbrales de la base con la curva del cliente: lo que la base tiene manda,
 * y los niveles que faltan (hoy la base llega solo al 30) salen de LEVEL_XP.
 * Así el progreso del 31 al 100 se calcula bien aunque los SQL no estén aplicados.
 */
export function mergeThresholds(rows) {
  const byLevel = new Map(LEVEL_THRESHOLDS.map(t => [t.level, t.xp_required]))
  for (const r of rows || []) {
    const l = Number(r?.level), x = Number(r?.xp_required)
    if (Number.isFinite(l) && Number.isFinite(x) && l >= 1 && l <= MAX_LEVEL) byLevel.set(l, x)
  }
  return [...byLevel.entries()].sort((a, b) => a[0] - b[0]).map(([level, xp_required]) => ({ level, xp_required }))
}
