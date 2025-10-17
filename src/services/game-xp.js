import { awardXp, unlockAchievementWithToast } from './xp'

/**
 * Award XP for a correct answer and handle common achievements
 * @param {Object} opts
 * @param {string} opts.gameCode - short code for the game (e.g., 'guess-player', 'nationality')
 * @param {number} [opts.amount=10] - base XP per correct answer
 * @param {number} [opts.attemptIndex=0] - zero-based index of the attempt to unlock 'first_correct'
 * @param {number} [opts.streak=1] - current streak to decide streak achievements
 */
export async function awardXpForCorrect({ gameCode, amount = 10, attemptIndex = 0, streak = 1 }) {
  try {
    await awardXp({ amount, reason: 'correct_answer', gameId: null, sessionId: null, meta: { game: gameCode } })
  } catch {}
  try {
    if (attemptIndex === 0) {
      await unlockAchievementWithToast('first_correct', { game: gameCode })
    }
    if (streak === 3) {
      await unlockAchievementWithToast('streak_3', { game: gameCode })
    }
  } catch {}
}
