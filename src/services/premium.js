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

export async function getXpMultiplier() {
  const plan = await getUserPlan()
  return plan.xpMultiplier ?? 1.0
}

export async function getDailyChallengeLimit() {
  const plan = await getUserPlan()
  return plan.dailyChallengesPerGame ?? 1
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
