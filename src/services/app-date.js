/**
 * FECHA DE LA APP — una sola zona horaria para todo lo "diario".
 *
 * El servidor usa public.app_today() = fecha en America/Argentina/Buenos_Aires
 * (supabase/mejoras7-pass-timezone.sql). El cliente tiene que usar el MISMO día:
 * antes se mezclaban hora local del dispositivo (disponibilidad), UTC (semilla
 * diaria → el juego cambiaba a las 21 h de Argentina) y UTC otra vez (rachas).
 *
 * Todo lo que diga "hoy" en los juegos pasa por acá.
 */
export const APP_TZ = 'America/Argentina/Buenos_Aires'

let _fmt = null
function fmt() {
  if (!_fmt) {
    _fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: APP_TZ, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
  }
  return _fmt
}

function wallParts(date) {
  const out = {}
  for (const p of fmt().formatToParts(date)) {
    if (p.type !== 'literal') out[p.type] = Number(p.value)
  }
  if (out.hour === 24) out.hour = 0
  return out
}

/** Diferencia (ms) entre la hora de pared en Argentina y UTC para ese instante. */
function tzOffsetMs(date) {
  const p = wallParts(date)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return asUtc - (date.getTime() - date.getMilliseconds())
}

/** Día de la app (YYYY-MM-DD) para un instante dado (por defecto, ahora). */
export function appDateKey(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  const p = wallParts(d)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

/** Hoy en Argentina, YYYY-MM-DD (igual que app_today() del servidor). */
export function appToday() {
  return appDateKey(new Date())
}

/** Instante (Date) en que empezó el día de la app que contiene `date`. */
export function appDayStart(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date)
  const p = wallParts(d)
  const guess = Date.UTC(p.year, p.month - 1, p.day, 0, 0, 0)
  // Restar el offset de ese momento (Argentina no tiene horario de verano hoy,
  // pero lo calculamos igual por si cambia).
  return new Date(guess - tzOffsetMs(new Date(guess)))
}

/** ISO del inicio del día de la app (para filtros `.gte('started_at', …)`). */
export function appDayStartIso(date = new Date()) {
  return appDayStart(date).toISOString()
}

/** Milisegundos que faltan para la medianoche de Argentina (cambio de día). */
export function msUntilAppMidnight(now = new Date()) {
  const start = appDayStart(now)
  const next = appDayStart(new Date(start.getTime() + 36 * 3600 * 1000))
  return Math.max(0, next.getTime() - now.getTime())
}
