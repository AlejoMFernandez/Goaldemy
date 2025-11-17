import { supabase } from './supabase'

// Get achievements for a user, joined with achievements table
export async function getUserAchievements(userId) {
  const { data, error } = await supabase
    .from('user_achievements')
    .select('earned_at, achievements:achievement_id (id, code, name, description, icon_url, points)')
    .eq('user_id', userId)
    .order('earned_at', { ascending: false })
  return { data, error }
}

// Cache for achievements catalog from DB
let _achievementsCatalog = null
let _achievementsCatalogAt = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Fetch all achievements from the database (with cache)
 * Returns a map: { code: { id, code, name, description, icon_url, points } }
 */
export async function getAchievementsCatalog(force = false) {
  const now = Date.now()
  if (!force && _achievementsCatalog && (now - _achievementsCatalogAt < CACHE_TTL)) {
    return _achievementsCatalog
  }

  const { data, error } = await supabase
    .from('achievements')
    .select('id, code, name, description, icon_url, points')
    .order('code', { ascending: true })

  if (error) {
    console.error('[achievements.js] Error fetching catalog:', error)
    return _achievementsCatalog || {} // Return cached or empty
  }

  // Build map by code
  const catalog = {}
  for (const ach of data || []) {
    if (ach?.code) {
      catalog[ach.code] = ach
    }
  }

  _achievementsCatalog = catalog
  _achievementsCatalogAt = now
  return catalog
}

/**
 * Get a single achievement by code from the catalog
 */
export async function getAchievementByCode(code) {
  const catalog = await getAchievementsCatalog()
  return catalog[code] || null
}
