/**
 * SERVICIO DE RACHA DIARIA DE LOGIN
 * 
 * Rastrea cuántos días consecutivos el usuario ha jugado al menos un juego.
 * 
 * CÓMO FUNCIONA:
 * - Cada vez que el usuario juega su PRIMER juego del día, se llama updateDailyLoginStreak()
 * - Compara last_activity_date con la fecha actual
 * - Si fue ayer: incrementa daily_streak
 * - Si es hoy: no hace nada (ya contó)
 * - Si fue hace más de 1 día: resetea a 1 (perdió la racha)
 * 
 * CAMPOS EN user_profiles:
 * - daily_streak: Racha actual (días consecutivos)
 * - best_daily_streak: Máxima racha histórica
 * - last_activity_date: Última fecha de actividad (YYYY-MM-DD)
 * 
 * LOGROS RELACIONADOS:
 * - streak_rookie: 3 días consecutivos
 * - streak_veteran: 7 días consecutivos
 * - streak_legend: 30 días consecutivos
 * 
 * LLAMADA AUTOMÁTICA:
 * - Se llama desde awardXpForCorrect() (game-xp.js)
 * - Solo se ejecuta una vez por día (verifica last_activity_date)
 * 
 * IMPORTANTE:
 * - Modo legado (sin flag): fechas UTC escritas por el cliente. Tiene dos
 *   problemas: cualquiera puede escribir su racha (UPDATE directo) y entre las
 *   21:00 y 24:00 ART "hoy" ya es mañana.
 * - Con VITE_SERVER_ECONOMY=1 usa la RPC touch_daily_streak (hora Argentina,
 *   consume protectores de racha). Una vez aplicado el parche 08, el servidor
 *   ignora las escrituras del cliente en estas columnas.
 * - La racha se pierde si pasan más de 24 horas sin jugar
 */
import { supabase } from './supabase'
import { getAuthUser } from './auth'
import { unlockAchievementWithToast } from './xp'

/**
 * Actualiza la racha diaria de login del usuario
 * Debe llamarse al jugar el primer juego del día
 * @returns {Object} { updated: boolean, streak: number, reason?: string }
 */
const STREAK_ACHIEVEMENTS = [[3, 'daily_streak_3'], [5, 'daily_streak_5'], [7, 'daily_streak_7'], [14, 'daily_streak_14'], [30, 'daily_streak_30']]

async function unlockStreakAchievements(streak) {
  try {
    for (const [n, code] of STREAK_ACHIEVEMENTS) {
      if (streak >= n) await unlockAchievementWithToast(code)
    }
  } catch {}
}

/**
 * Versión servidor (VITE_SERVER_ECONOMY=1): la racha la calcula la RPC
 * touch_daily_streak en hora Argentina y consume protectores de racha.
 * Ver supabase/pendientes/2026-11-24-08-racha-servidor.sql.
 */
async function touchDailyStreakServer() {
  const { data, error } = await supabase.rpc('touch_daily_streak')
  if (error || !data?.ok) {
    if (error) console.error('[daily-streak] touch_daily_streak:', error)
    return { updated: false, streak: data?.streak || 0, reason: data?.error || data?.reason }
  }
  if (data.updated) await unlockStreakAchievements(data.streak)
  return {
    updated: !!data.updated,
    streak: data.streak,
    previous: data.previous,
    isBest: !!data.is_best,
    protectorUsed: data.protector_used || 0,
    reason: data.reason,
  }
}

export async function updateDailyLoginStreak() {
  const { id: userId } = getAuthUser() || {}
  if (!userId) return { updated: false, streak: 0 }

  if (import.meta.env.VITE_SERVER_ECONOMY === '1') {
    try { return await touchDailyStreakServer() } catch (e) {
      console.error('[daily-streak] Exception:', e)
      return { updated: false, streak: 0 }
    }
  }

  try {
    // Get current profile data
    const { data: profile, error: fetchError } = await supabase
      .from('user_profiles')
      .select('daily_streak, best_daily_streak, last_activity_date')
      .eq('id', userId)
      .single()

    if (fetchError) {
      console.error('[daily-streak] Error fetching profile:', fetchError)
      return { updated: false, streak: 0 }
    }

    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    const lastActivity = profile?.last_activity_date || null
    const currentStreak = profile?.daily_streak || 0
    const bestStreak = profile?.best_daily_streak || 0

    // If already updated today, skip
    if (lastActivity === today) {
      return { updated: false, streak: currentStreak, reason: 'already_today' }
    }

    // Calculate new streak
    let newStreak = 1
    if (lastActivity) {
      const lastDate = new Date(lastActivity + 'T00:00:00Z')
      const todayDate = new Date(today + 'T00:00:00Z')
      const diffDays = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24))

      if (diffDays === 1) {
        // Yesterday: increment streak
        newStreak = currentStreak + 1
      } else if (diffDays > 1) {
        // Missed days: reset to 1
        newStreak = 1
      }
    }

    const newBest = Math.max(newStreak, bestStreak)

    // Update profile
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({
        daily_streak: newStreak,
        best_daily_streak: newBest,
        last_activity_date: today,
      })
      .eq('id', userId)

    if (updateError) {
      console.error('[daily-streak] Error updating profile:', updateError)
      return { updated: false, streak: currentStreak }
    }

    // Unlock achievements based on streak
    await unlockStreakAchievements(newStreak)

    return { updated: true, streak: newStreak, previous: currentStreak, isBest: newStreak === newBest && newStreak > bestStreak }
  } catch (e) {
    console.error('[daily-streak] Exception:', e)
    return { updated: false, streak: 0 }
  }
}
