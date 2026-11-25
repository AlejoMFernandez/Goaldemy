/**
 * CALENDARIO DE RACHA — días jugados y sobres cobrados, en hora Argentina.
 *
 * No hay una tabla de "actividad por día": la derivamos de lo que ya existe.
 *  - Días jugados del mes: fechas de game_sessions.started_at (desafíos) ∪
 *    xp_events.created_at con game_id (respuestas que dieron XP). Ambas tablas
 *    tienen RLS "leer las propias".
 *  - Sobres cobrados de la semana: user_daily_claims (kind = 'daily').
 * Todo se agrupa por día con appDateKey() (America/Argentina/Buenos_Aires),
 * el mismo "hoy" que usa el servidor (public.app_today()).
 */
import { supabase } from './supabase'
import { getAuthUser } from './auth'
import { appDateKey, appToday, appDayStartIso } from './app-date'

/** 'YYYY-MM-DD' → Date a las 12:00 UTC (seguro para sumar días sin saltos). */
export function keyToNoonUtc(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12))
}

/** Suma n días a un 'YYYY-MM-DD'. */
export function addDaysKey(key, n) {
  const t = keyToNoonUtc(key)
  t.setUTCDate(t.getUTCDate() + n)
  return t.toISOString().slice(0, 10)
}

/** Día de la semana del día de la app (0 = domingo … 6 = sábado). */
export function appWeekday(key = appToday()) {
  return keyToNoonUtc(key).getUTCDay()
}

/** Lunes (YYYY-MM-DD) de la semana del día dado. */
export function weekMondayKey(key = appToday()) {
  const dow = appWeekday(key)
  return addDaysKey(key, dow === 0 ? -6 : 1 - dow)
}

/** Inicio (ISO) del día de la app indicado por su clave. */
function keyStartIso(key) {
  return appDayStartIso(keyToNoonUtc(key))
}

/**
 * Días jugados de un mes (hora Argentina).
 * @param {number} year  ej. 2026
 * @param {number} month 1–12
 * @returns {Promise<Set<string>>} claves YYYY-MM-DD
 */
export async function getPlayedDaysInMonth(year, month) {
  const { id } = getAuthUser() || {}
  const out = new Set()
  if (!id) return out
  const first = `${year}-${String(month).padStart(2, '0')}-01`
  const nextFirst = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`
  const from = keyStartIso(first)
  const to = keyStartIso(nextFirst)

  const [sessions, xp] = await Promise.allSettled([
    supabase.from('game_sessions').select('started_at')
      .eq('user_id', id).gte('started_at', from).lt('started_at', to)
      .order('started_at', { ascending: true }).limit(2000),
    supabase.from('xp_events').select('created_at')
      .eq('user_id', id).not('game_id', 'is', null).gte('created_at', from).lt('created_at', to)
      .order('created_at', { ascending: true }).limit(5000),
  ])
  const add = (iso) => { const k = iso && appDateKey(iso); if (k && k >= first && k < nextFirst) out.add(k) }
  if (sessions.status === 'fulfilled') for (const r of sessions.value?.data || []) add(r.started_at)
  if (xp.status === 'fulfilled') for (const r of xp.value?.data || []) add(r.created_at)
  return out
}

/**
 * Sobres del día cobrados en la semana actual (lunes a domingo, hora ART).
 * @returns {Promise<Set<string>>} claves YYYY-MM-DD
 */
export async function getWeekDailyClaims() {
  const { id } = getAuthUser() || {}
  const out = new Set()
  if (!id) return out
  const monday = weekMondayKey()
  try {
    const { data, error } = await supabase.from('user_daily_claims').select('day')
      .eq('user_id', id).eq('kind', 'daily').gte('day', monday).lte('day', addDaysKey(monday, 6))
    if (!error) for (const r of data || []) if (r.day) out.add(String(r.day).slice(0, 10))
  } catch {}
  return out
}

/** Racha actual, récord y último día con actividad (user_profiles). */
export async function getStreakProfile() {
  const { id } = getAuthUser() || {}
  if (!id) return null
  const { data, error } = await supabase.from('user_profiles')
    .select('daily_streak, best_daily_streak, last_activity_date').eq('id', id).single()
  if (error || !data) return null
  return {
    current: data.daily_streak || 0,
    best: data.best_daily_streak || 0,
    lastActivity: data.last_activity_date ? String(data.last_activity_date).slice(0, 10) : null,
  }
}

/**
 * ¿Sigue viva la racha? Vale si el último día con actividad es hoy o ayer.
 * (Con protectores el servidor la sostiene más días, pero recién al volver a
 * jugar; mientras tanto mostramos lo que dice el perfil.)
 */
export function streakRange(profile, today = appToday()) {
  if (!profile?.current || !profile.lastActivity) return null
  const end = profile.lastActivity
  if (end > today) return { start: addDaysKey(today, 1 - profile.current), end: today }
  return { start: addDaysKey(end, 1 - profile.current), end }
}
