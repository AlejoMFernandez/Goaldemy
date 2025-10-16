// Simple wrappers for XP-related RPCs
import { supabase } from './supabase'
import { pushAchievementToast } from '../stores/notifications'

/**
 * Award XP to the current authenticated user.
 * @param {Object} params
 * @param {number} params.amount - XP to award (>=0)
 * @param {string} [params.reason='correct_answer'] - Reason label
 * @param {string|null} [params.gameId=null] - UUID of the game
 * @param {string|null} [params.sessionId=null] - UUID of the session
 * @param {Object|null} [params.meta=null] - Extra metadata (will be sent as JSON)
 */
export async function awardXp({ amount, reason = 'correct_answer', gameId = null, sessionId = null, meta = null }) {
  const { data, error } = await supabase.rpc('award_xp', {
    p_amount: amount,
    p_reason: reason,
    p_game_id: gameId,
    p_session_id: sessionId,
    p_meta: meta,
  })
  return { data, error }
}

/**
 * Get level info for a user (defaults to current user if userId is null).
 * @param {string|null} userId - UUID of the user or null for current
 */
export async function getUserLevel(userId = null) {
  const { data, error } = await supabase.rpc('get_user_level', { p_user_id: userId })
  return { data, error }
}

/**
 * Get leaderboard with optional period and game filter.
 * @param {Object} opts
 * @param {'all_time'|'weekly'|'monthly'} [opts.period='all_time']
 * @param {string|null} [opts.gameId=null]
 * @param {number} [opts.limit=50]
 * @param {number} [opts.offset=0]
 */
export async function getLeaderboard({ period = 'all_time', gameId = null, limit = 100, offset = 0 } = {}) {
  const { data, error } = await supabase.rpc('get_leaderboard', {
    p_period: period,
    p_game_id: gameId,
    p_limit: limit,
    p_offset: offset,
  })
  return { data, error }
}

/**
 * Fetch current user's XP events minimal fields to aggregate by game on the client.
 */
export async function getMyXpByGameEvents() {
  const { data, error } = await supabase
    .from('xp_events')
    .select('game_id, amount')
    .order('created_at', { ascending: false })
  return { data, error }
}

/**
 * Unlock an achievement by code for the current user.
 * Returns { data: boolean, error }
 */
export async function unlockAchievement(code, meta = null) {
  const { data, error } = await supabase.rpc('unlock_achievement', {
    p_code: code,
    p_meta: meta,
  })
  return { data, error }
}

/**
 * Unlock an achievement and, if newly unlocked, show a toast immediately.
 * Returns the same shape as unlockAchievement.
 */
export async function unlockAchievementWithToast(code, meta = null) {
  // To avoid duplicate toasts (RPC + Realtime), do not toast here.
  // Realtime listener on user_achievements will handle the toast on INSERT.
  return await unlockAchievement(code, meta)
}
