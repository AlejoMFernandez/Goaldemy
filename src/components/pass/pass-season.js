/**
 * Abono de temporada — tema del mes, reloj de cierre y memoria local.
 *
 *  · Tema: cada mes cambian solo 4 colores y el arte (artifact "Abono de
 *    temporada"). Sale de pass_seasons.theme; el de lanzamiento es RETRO
 *    (sepia con grano de película) y es también el de respaldo, así el
 *    diseño V4 aprobado se ve igual aunque el mes no tenga tema cargado.
 *  · Reloj: el mes cierra a las 00:00 de Argentina (app_today() es ART).
 *  · Memoria (localStorage, por usuario): último nivel visto (troquel),
 *    si ya era Platea (se prende la Platea) y foto del mes (pitazo final).
 */

// [header claro, header oscuro, papel, acento]
export const PASS_THEMES = {
  retro: { key: 'retro', label: 'Retro', c1: '#4a2e14', c2: '#160e07', paper: '#f1e4c6', accent: '#fde68a', grain: true },
}
export function passTheme(season) {
  const k = String(season?.theme || '').toLowerCase()
  return PASS_THEMES[k] || PASS_THEMES.retro
}
export function themeVars(t) {
  return { '--ab-c1': t.c1, '--ab-c2': t.c2, '--ab-paper': t.paper, '--ab-accent': t.accent }
}

// Hitos con sello de goma: 5, 10, 15, 20, 25 y 30.
export const isMilestone = (n) => Number(n) > 0 && Number(n) % 5 === 0

/** Fin del mes del abono (ms, hora Argentina UTC−3). month = 'YYYY-MM-01'. */
export function monthEndsAt(month) {
  const m = /^(\d{4})-(\d{2})/.exec(month || '')
  if (!m) return null
  const y = Number(m[1]), mo = Number(m[2]) // 1..12
  // Primer día del mes siguiente, 00:00 ART = 03:00 UTC
  return Date.UTC(mo === 12 ? y + 1 : y, mo === 12 ? 0 : mo, 1, 3, 0, 0)
}

/** "Quedan 2 d 14 h" / "Quedan 5 h" / "Quedan 40 min" (últimos 3 días). */
export function countdownText(ms) {
  if (ms == null || ms <= 0) return 'Último momento'
  const totalMin = Math.floor(ms / 60000)
  const d = Math.floor(totalMin / 1440)
  const h = Math.floor((totalMin % 1440) / 60)
  const min = totalMin % 60
  if (d > 0) return `Quedan ${d} d ${h} h`
  if (h > 0) return `Quedan ${h} h`
  return `Quedan ${Math.max(1, min)} min`
}

export function monthLabel(month, opts = { month: 'long' }) {
  if (!month) return ''
  try {
    const s = new Date(month.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-AR', opts)
    return s.charAt(0).toUpperCase() + s.slice(1)
  } catch { return '' }
}

const KEY = (uid) => `fulvo:abono:${uid || 'anon'}`
export function readMemory(uid) {
  try { return JSON.parse(localStorage.getItem(KEY(uid)) || 'null') } catch { return null }
}
export function writeMemory(uid, mem) {
  try { localStorage.setItem(KEY(uid), JSON.stringify(mem)) } catch { /* modo privado */ }
}
