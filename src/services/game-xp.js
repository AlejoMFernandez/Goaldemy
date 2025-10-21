import { awardXp, unlockAchievementWithToast } from './xp'
import { supabase } from './supabase'

/**
 * Award XP for a correct answer and handle common achievements
 * @param {Object} opts
 * @param {string} opts.gameCode - short code for the game (e.g., 'guess-player', 'nationality')
 * @param {number} [opts.amount=10] - base XP per correct answer
 * @param {number} [opts.attemptIndex=0] - zero-based index of the attempt to unlock 'first_correct'
 * @param {number} [opts.streak=1] - current streak to decide streak achievements
 */
const gameIdCache = new Map()

async function getGameIdBySlug(slug) {
  if (gameIdCache.has(slug)) return gameIdCache.get(slug)
  const { data, error } = await supabase.from('games').select('id').eq('slug', slug).maybeSingle()
  const id = error ? null : data?.id ?? null
  if (id) gameIdCache.set(slug, id)
  return id
}

export async function awardXpForCorrect({ gameCode, amount = 10, attemptIndex = 0, streak = 1, corrects = 1 }) {
  try {
    const gameId = await getGameIdBySlug(gameCode)
    await awardXp({ amount, reason: 'correct_answer', gameId, sessionId: null, meta: { game: gameCode, streak, corrects } })
  } catch {}
  try {
    if (attemptIndex === 0) {
      await unlockAchievementWithToast('first_correct', { game: gameCode })
    }
    if (streak === 3) {
      await unlockAchievementWithToast('streak_3', { game: gameCode })
    }
    if (streak === 5) {
      await unlockAchievementWithToast('streak_5', { game: gameCode })
    }
    if (streak === 10) {
      await unlockAchievementWithToast('streak_10', { game: gameCode })
    }
    if (corrects === 10) {
      await unlockAchievementWithToast('ten_correct', { game: gameCode })
    }
  } catch {}
}
