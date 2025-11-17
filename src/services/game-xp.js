import { awardXp, unlockAchievementWithToast } from './xp'
import { supabase } from './supabase'
import { updateDailyLoginStreak } from './daily-streak'

/**
 * Award XP for a correct answer and handle common achievements
 * @param {Object} opts
 * @param {string} opts.gameCode - short code for the game (e.g., 'guess-player', 'nationality')
 * @param {number} [opts.amount=10] - base XP per correct answer
 * @param {number} [opts.attemptIndex=0] - zero-based index of the attempt to unlock 'first_correct'
 * @param {number} [opts.corrects=1] - total corrects in this session to decide 'ten_correct'
 */
const gameIdCache = new Map()

async function getGameIdBySlug(slug) {
  if (gameIdCache.has(slug)) return gameIdCache.get(slug)
  const { data, error } = await supabase.from('games').select('id').eq('slug', slug).maybeSingle()
  const id = error ? null : data?.id ?? null
  if (id) gameIdCache.set(slug, id)
  return id
}

export async function awardXpForCorrect({ gameCode, amount = 10, attemptIndex = 0, corrects = 1 }) {
  try {
    const gameId = await getGameIdBySlug(gameCode)
    await awardXp({ amount, reason: 'correct_answer', gameId, sessionId: null, meta: { game: gameCode, corrects } })
  } catch {}
  
  try {
    // Update daily login streak (only first game of the day)
    await updateDailyLoginStreak()
    
    // First correct answer ever
    if (attemptIndex === 0) {
      await unlockAchievementWithToast('first_correct', { game: gameCode })
    }
    
    // 10 corrects in one session
    if (corrects === 10) {
      await unlockAchievementWithToast('ten_correct', { game: gameCode })
    }
  } catch {}
}
