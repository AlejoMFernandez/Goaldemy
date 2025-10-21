import { unlockAchievementWithToast } from './xp'

/**
 * Check and unlock special badges for the current user, based on already-fetched data.
 * @param {string} userId - target profile user id
 * @param {Array} xpByGame - [{ id, xp }]
 * @param {Array} maxStreakRows - [{ id, streak }]
 * @param {boolean} isSelf - only unlock when viewing self
 */
export async function checkAndUnlockSpecials(userId, xpByGame = [], maxStreakRows = [], isSelf = false) {
  if (!isSelf || !userId) return { attempted: false }
  try {
    const streaksOk = (maxStreakRows || []).filter(r => (r?.streak || 0) >= 100).length >= 2
    const xpOk = (xpByGame || []).filter(r => (r?.xp || 0) >= 5000).length >= 3

    const results = {}
    if (streaksOk) {
      results.streak_dual_100 = await unlockAchievementWithToast('streak_dual_100')
    }
    if (xpOk) {
      results.xp_multi_5k_3 = await unlockAchievementWithToast('xp_multi_5k_3')
    }
    return { attempted: true, results }
  } catch (e) {
    return { attempted: true, error: e }
  }
}
