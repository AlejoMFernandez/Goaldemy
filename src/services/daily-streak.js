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
 * - Usa fechas UTC en formato YYYY-MM-DD para evitar problemas de zona horaria
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
export async function updateDailyLoginStreak() {
  const { id: userId } = getAuthUser() || {}
  if (!userId) return { updated: false, streak: 0 }

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
    try {
      if (newStreak >= 3) await unlockAchievementWithToast('daily_streak_3')
      if (newStreak >= 5) await unlockAchievementWithToast('daily_streak_5')
      if (newStreak >= 7) await unlockAchievementWithToast('daily_streak_7')
      if (newStreak >= 14) await unlockAchievementWithToast('daily_streak_14')
      if (newStreak >= 30) await unlockAchievementWithToast('daily_streak_30')
    } catch {}

    return { updated: true, streak: newStreak, previous: currentStreak, isBest: newStreak === newBest && newStreak > bestStreak }
  } catch (e) {
    console.error('[daily-streak] Exception:', e)
    return { updated: false, streak: 0 }
  }
}
