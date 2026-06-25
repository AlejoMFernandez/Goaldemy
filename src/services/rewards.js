/**
 * SERVICIO DE RECOMPENSAS (Fase 1)
 *
 * Retos diarios + recompensa diaria (XP entre semana / powerup el finde).
 * Envuelve las RPCs definidas en supabase/rewards-phase1.sql.
 */
import { supabase } from './supabase'
import { getAuthUser } from './auth'
import { invalidatePlanCache } from './premium'
import { detectAndToastLevelUp } from './xp'

/** Retos diarios de hoy con progreso. */
export async function getDailyChallenges() {
  const { id } = getAuthUser() || {}
  if (!id) return []
  const { data, error } = await supabase.rpc('get_daily_challenges')
  if (error) {
    console.warn('[rewards] get_daily_challenges:', error.message)
    return []
  }
  return Array.isArray(data) ? data : []
}

/** Reporta el resultado de un juego para sumar progreso a los retos. */
export async function reportGameResult(gameSlug, won) {
  const { id } = getAuthUser() || {}
  if (!id) return
  try {
    await supabase.rpc('report_game_result', { p_game_slug: gameSlug, p_won: !!won })
  } catch (e) {
    console.warn('[rewards] report_game_result:', e?.message)
  }
}

/** Reclama un reto diario completado. Devuelve { ok, title, reward_xp, reward_powerup, reward_powerup_qty }. */
export async function claimDailyChallenge(code) {
  const { data, error } = await supabase.rpc('claim_daily_challenge', { p_code: code })
  if (error) return { ok: false, error: error.message }
  if (data?.reward_powerup) invalidatePlanCache()
  if (data?.ok) detectAndToastLevelUp()
  return data || { ok: false }
}

/** Estado de la recompensa diaria (disponible, tipo, monto). */
export async function getDailyReward() {
  const { id } = getAuthUser() || {}
  if (!id) return { available: false }
  const { data, error } = await supabase.rpc('get_daily_reward')
  if (error) {
    console.warn('[rewards] get_daily_reward:', error.message)
    return { available: false }
  }
  return data || { available: false }
}

/** Reclama la recompensa diaria. Devuelve { ok, reward_kind, reward_powerup, amount }. */
export async function claimDailyReward() {
  const { data, error } = await supabase.rpc('claim_daily_reward')
  if (error) return { ok: false, error: error.message }
  if (data?.reward_kind === 'powerup') invalidatePlanCache()
  if (data?.ok) detectAndToastLevelUp()
  return data || { ok: false }
}

/** Estado del pase mensual: { month, points, is_premium, tiers[] }. */
export async function getMonthlyPass() {
  const { id } = getAuthUser() || {}
  if (!id) return { points: 0, tiers: [], is_premium: false }
  const { data, error } = await supabase.rpc('get_monthly_pass')
  if (error) {
    console.warn('[rewards] get_monthly_pass:', error.message)
    return { points: 0, tiers: [], is_premium: false }
  }
  return data || { points: 0, tiers: [], is_premium: false }
}

/** Reclama un tier del pase. track: 'free' | 'premium'. */
export async function claimPassTier(tier, track) {
  const { data, error } = await supabase.rpc('claim_pass_tier', { p_tier: tier, p_track: track })
  if (error) return { ok: false, error: error.message }
  if (data?.powerup) invalidatePlanCache()
  if (data?.ok) detectAndToastLevelUp()
  return data || { ok: false }
}

/** Retos progresivos (auto-upgrade) con tier/progreso/objetivo actuales. */
export async function getProgressiveChallenges() {
  const { id } = getAuthUser() || {}
  if (!id) return []
  const { data, error } = await supabase.rpc('get_progressive_challenges')
  if (error) {
    console.warn('[rewards] get_progressive_challenges:', error.message)
    return []
  }
  return Array.isArray(data) ? data : []
}

/** Reclama un reto progresivo; sube de tier. Devuelve { ok, xp, powerup, new_tier, new_target }. */
export async function claimProgressive(code) {
  const { data, error } = await supabase.rpc('claim_progressive', { p_code: code })
  if (error) return { ok: false, error: error.message }
  if (data?.powerup) invalidatePlanCache()
  if (data?.ok) detectAndToastLevelUp()
  return data || { ok: false }
}

const POWERUP_LABELS = {
  fifty_fifty: '50/50',
  shield: 'Escudo',
  extra_time: 'Tiempo extra',
  reveal_hint: 'Pista',
}

export function powerupLabel(type) {
  return POWERUP_LABELS[type] || 'Power-up'
}
