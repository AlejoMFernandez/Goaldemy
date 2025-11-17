import { supabase } from './supabase'
import { getAuthUser } from './auth'
import { unlockAchievementWithToast } from './xp'
import { DAILY_GAMES } from './game-modes'

/**
 * Check and unlock achievements based on time of day
 * Call this when a game session starts
 */
export async function checkTimeBasedAchievements() {
  try {
    const now = new Date()
    const hour = now.getHours()
    
    // Night owl: 00:00 - 05:00
    if (hour >= 0 && hour < 5) {
      await unlockAchievementWithToast('night_owl')
    }
    
    // Early bird: Before 07:00
    if (hour < 7) {
      await unlockAchievementWithToast('early_bird')
    }
    
    // Weekend warrior: Saturday (6) or Sunday (0)
    const day = now.getDay()
    if (day === 0 || day === 6) {
      // Check if user has 10+ weekend wins
      await checkWeekendWarrior()
    }
  } catch (e) {
    console.error('[time-achievements] Error:', e)
  }
}

/**
 * Check weekend warrior achievement (10 wins on Saturday/Sunday)
 */
async function checkWeekendWarrior() {
  const { id: userId } = getAuthUser() || {}
  if (!userId) return

  try {
    const { data, error } = await supabase
      .from('game_sessions')
      .select('id, started_at, metadata')
      .eq('user_id', userId)
      .contains('metadata', { result: 'win' })
      .order('started_at', { ascending: false })
      .limit(500)

    if (error) return

    // Count wins on weekends
    let weekendWins = 0
    for (const session of (data || [])) {
      const date = new Date(session.started_at)
      const day = date.getDay()
      if (day === 0 || day === 6) {
        weekendWins++
      }
    }

    if (weekendWins >= 10) {
      await unlockAchievementWithToast('weekend_warrior')
    }
  } catch {}
}

/**
 * Check first-attempt achievements
 * Call this when user gets correct answer on first try
 */
export async function checkLuckyFirstAchievement() {
  const { id: userId } = getAuthUser() || {}
  if (!userId) return

  try {
    // Count how many times user got it right on first attempt
    const { data, error } = await supabase
      .from('game_sessions')
      .select('metadata')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(200)

    if (error) return

    let firstAttemptCount = 0
    for (const session of (data || [])) {
      const meta = session?.metadata || {}
      if (meta.firstTryCorrect === true || meta.attempts === 1) {
        firstAttemptCount++
      }
    }

    if (firstAttemptCount >= 10) {
      await unlockAchievementWithToast('lucky_first')
    }
  } catch {}
}

/**
 * Check comeback king achievement
 * Call when user wins after 3+ consecutive errors
 * @param {boolean} won - whether user won the game
 * @param {number} errors - number of consecutive errors before winning
 */
export async function checkComebackKingAchievement(won, errors) {
  if (!won || errors < 3) return
  
  try {
    await unlockAchievementWithToast('comeback_king')
  } catch {}
}

/**
 * Check perfectionist achievement
 * Call when game ends with no errors
 * @param {boolean} won - whether user won
 * @param {number} errors - total errors in game
 */
export async function checkPerfectionistAchievement(won, errors) {
  if (!won || errors > 0) return
  
  try {
    await unlockAchievementWithToast('perfectionist')
  } catch {}
}

/**
 * Check hat-trick achievement (3 different games same day)
 * Call after completing any challenge
 */
export async function checkHatTrickAchievement() {
  const { id: userId } = getAuthUser() || {}
  if (!userId) return

  try {
    const today = new Date().toISOString().split('T')[0]
    const { data, error } = await supabase
      .from('game_sessions')
      .select('game_id, metadata')
      .eq('user_id', userId)
      .gte('started_at', today + 'T00:00:00Z')
      .contains('metadata', { result: 'win' })

    if (error) return

    // Count unique games won today
    const uniqueGames = new Set()
    for (const session of (data || [])) {
      if (session.game_id) uniqueGames.add(session.game_id)
    }

    if (uniqueGames.size >= 3) {
      await unlockAchievementWithToast('hat_trick')
    }
  } catch {}
}

/**
 * Check grand slam achievement (all games in one week)
 * Call after completing any challenge
 */
export async function checkGrandSlamAchievement() {
  const { id: userId } = getAuthUser() || {}
  if (!userId) return

  try {
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    
    const { data, error } = await supabase
      .from('game_sessions')
      .select('game_id, metadata')
      .eq('user_id', userId)
      .gte('started_at', weekAgo.toISOString())
      .contains('metadata', { result: 'win' })

    if (error) return

    // Count unique games won this week
    const uniqueGames = new Set()
    for (const session of (data || [])) {
      if (session.game_id) uniqueGames.add(session.game_id)
    }

    // Need to win all daily games in a week
    if (uniqueGames.size >= DAILY_GAMES.length) {
      await unlockAchievementWithToast('grand_slam')
    }
  } catch {}
}

/**
 * Check centurion achievement (100 total wins)
 * Call after completing any challenge with a win
 */
export async function checkCenturionAchievement() {
  const { id: userId } = getAuthUser() || {}
  if (!userId) return

  try {
    const { data, error } = await supabase
      .from('game_sessions')
      .select('id')
      .eq('user_id', userId)
      .contains('metadata', { result: 'win' })

    if (error) return

    const totalWins = (data || []).length

    if (totalWins >= 100) {
      await unlockAchievementWithToast('centurion')
    }
  } catch {}
}

/**
 * Check game-specific master achievements
 * @param {string} slug - game slug
 * @param {boolean} won - whether user won this game
 */
export async function checkGameMasterAchievements(slug, won) {
  if (!won) return
  
  const { id: userId } = getAuthUser() || {}
  if (!userId) return

  try {
    // Get game ID
    const { data: game } = await supabase
      .from('games')
      .select('id')
      .eq('slug', slug)
      .single()

    if (!game) return

    // Count wins for this specific game
    const { data, error } = await supabase
      .from('game_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('game_id', game.id)
      .contains('metadata', { result: 'win' })

    if (error) return

    const wins = (data || []).length

    // Check game-specific achievements
    if (slug === 'guess-player' && wins >= 20) {
      await unlockAchievementWithToast('guess_master')
    }

    // nationality_expert: 50 correct nationalities
    // This one tracks corrects, not just wins
    if (slug === 'nationality') {
      await checkNationalityExpert()
    }

    // position_guru: 50 correct positions
    if (slug === 'player-position') {
      await checkPositionGuru()
    }
  } catch {}
}

/**
 * Check nationality expert (50 correct answers across all sessions)
 */
async function checkNationalityExpert() {
  const { id: userId } = getAuthUser() || {}
  if (!userId) return

  try {
    const { data: game } = await supabase
      .from('games')
      .select('id')
      .eq('slug', 'nationality')
      .single()

    if (!game) return

    const { data, error } = await supabase
      .from('game_sessions')
      .select('metadata')
      .eq('user_id', userId)
      .eq('game_id', game.id)

    if (error) return

    let totalCorrects = 0
    for (const session of (data || [])) {
      const corrects = session?.metadata?.corrects || 0
      totalCorrects += corrects
    }

    if (totalCorrects >= 50) {
      await unlockAchievementWithToast('nationality_expert')
    }
  } catch {}
}

/**
 * Check position guru (50 correct positions)
 */
async function checkPositionGuru() {
  const { id: userId } = getAuthUser() || {}
  if (!userId) return

  try {
    const { data: game } = await supabase
      .from('games')
      .select('id')
      .eq('slug', 'player-position')
      .single()

    if (!game) return

    const { data, error } = await supabase
      .from('game_sessions')
      .select('metadata')
      .eq('user_id', userId)
      .eq('game_id', game.id)

    if (error) return

    let totalCorrects = 0
    for (const session of (data || [])) {
      const corrects = session?.metadata?.corrects || 0
      totalCorrects += corrects
    }

    if (totalCorrects >= 50) {
      await unlockAchievementWithToast('position_guru')
    }
  } catch {}
}

/**
 * Check first win achievement
 * Call when user wins their first daily game ever
 */
export async function checkFirstWinAchievement() {
  const { id: userId } = getAuthUser() || {}
  if (!userId) return

  try {
    const { data, error } = await supabase
      .from('game_sessions')
      .select('id')
      .eq('user_id', userId)
      .contains('metadata', { result: 'win', mode: 'challenge' })
      .limit(1)

    if (error) return

    if ((data || []).length > 0) {
      await unlockAchievementWithToast('first_win')
    }
  } catch {}
}

/**
 * Main checker to call after completing a challenge
 * Checks multiple achievements at once
 */
export async function checkAllAchievementsAfterChallenge(slug, won, metadata = {}) {
  if (!won) return

  try {
    // Check various achievements in parallel
    await Promise.all([
      checkFirstWinAchievement(),
      checkGameMasterAchievements(slug, won),
      checkHatTrickAchievement(),
      checkGrandSlamAchievement(),
      checkCenturionAchievement(),
    ])

    // Check perfectionist if no errors
    if (metadata.errors === 0) {
      await checkPerfectionistAchievement(won, 0)
    }

    // Check comeback if had 3+ consecutive errors
    if (metadata.consecutiveErrors >= 3) {
      await checkComebackKingAchievement(won, metadata.consecutiveErrors)
    }

    // Check lucky first if first attempt correct
    if (metadata.firstTryCorrect) {
      await checkLuckyFirstAchievement()
    }
  } catch (e) {
    console.error('[check-all-achievements] Error:', e)
  }
}
