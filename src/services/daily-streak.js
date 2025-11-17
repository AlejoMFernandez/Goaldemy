import { supabase } from './supabase'
import { getAuthUser } from './auth'
import { unlockAchievementWithToast } from './xp'

/**
 * Update the user's daily login streak.
 * Call this when the user plays their first game of the day.
 * Logic:
 * - If last_activity_date is yesterday: increment daily_streak
 * - If last_activity_date is today: do nothing (already counted)
 * - If last_activity_date is older: reset to 1
 * - Update best_daily_streak if current is higher
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
