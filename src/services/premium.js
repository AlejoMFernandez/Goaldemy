import { supabase } from './supabase'
import { getAuthUser } from './auth'

let _planCache = null
let _planCacheTime = 0
const CACHE_TTL = 60_000

const PLAN_DEFAULTS = {
  plan: 'free',
  planName: 'Free',
  status: 'active',
  dailyChallengesPerGame: 1,
  dailyPowerups: 1,
  xpMultiplier: 1.0,
  badge: null,
  periodEnd: null,
  powerups: { fiftyFifty: 0, shield: 0, extraTime: 0, revealHint: 0, streakProtector: 0 },
}

export async function getUserPlan(forceRefresh = false) {
  const { id } = getAuthUser() || {}
  if (!id) return { ...PLAN_DEFAULTS }

  if (!forceRefresh && _planCache && Date.now() - _planCacheTime < CACHE_TTL) {
    return _planCache
  }

  try {
    const { data, error } = await supabase.rpc('get_user_plan')
    if (error) throw error
    _planCache = { ...PLAN_DEFAULTS, ...data }
    _planCacheTime = Date.now()
    return _planCache
  } catch (e) {
    console.warn('[premium] get_user_plan failed, using defaults', e)
    return { ...PLAN_DEFAULTS }
  }
}

export function invalidatePlanCache() {
  _planCache = null
  _planCacheTime = 0
}

/**
 * Plan de CUALQUIER usuario (para el badge PRO/Legend en su perfil).
 * Solo lectura (RPC get_plan_badge). Devuelve { plan, name }.
 * Requiere supabase/mejoras13-plan-badge.sql.
 */
export async function getPlanBadge(userId) {
  if (!userId) return { plan: 'free', name: 'Free' }
  const { data, error } = await supabase.rpc('get_plan_badge', { p_user_id: userId })
  if (error) {
    console.warn('[premium] get_plan_badge:', error.message)
    return { plan: 'free', name: 'Free' }
  }
  return data || { plan: 'free', name: 'Free' }
}

export async function getXpMultiplier() {
  const plan = await getUserPlan()
  return plan.xpMultiplier ?? 1.0
}

export async function getDailyChallengeLimit() {
  // 1 intento por juego por día para TODOS los planes. El multi-play PRO se
  // retiró a propósito: el desafío diario debe ser único para que el ranking
  // y las rachas sean justos. (El campo dailyChallengesPerGame del plan queda
  // en la DB por compatibilidad, pero ya no habilita intentos extra.)
  return 1
}

export async function getPowerupCounts() {
  const plan = await getUserPlan(true)
  return plan.powerups ?? PLAN_DEFAULTS.powerups
}

export async function usePowerup(type) {
  const { id } = getAuthUser() || {}
  if (!id) return false

  try {
    const { data, error } = await supabase.rpc('use_powerup', { p_type: type })
    if (error) throw error
    invalidatePlanCache()
    return data === true
  } catch (e) {
    console.warn('[premium] use_powerup failed', e)
    return false
  }
}

export async function fetchPlans() {
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .order('sort_order')
  if (error) {
    console.warn('[premium] fetchPlans failed', error)
    return []
  }
  return data || []
}

export function isPremium(plan) {
  return plan && plan.plan !== 'free'
}

export function getPlanBadgeClass(planSlug) {
  if (planSlug === 'legend') return 'text-amber-400'
  if (planSlug === 'pro') return 'text-cyan-400'
  return 'text-white/60'
}
