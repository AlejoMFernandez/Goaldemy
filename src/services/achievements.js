/**
 * SERVICIO DE LOGROS (ACHIEVEMENTS)
 * 
 * Gestiona el catálogo de logros y la consulta de logros desbloqueados por usuarios.
 * 
 * SISTEMA DE LOGROS:
 * - 34 logros totales en la aplicación
 * - Cada logro tiene: code (identificador único), name, description, icon_url, points
 * - Los logros se almacenan en la tabla "achievements" (catálogo)
 * - Los logros desbloqueados se guardan en "user_achievements" (relación usuario-logro)
 * 
 * DESBLOQUEO:
 * - Se usa el RPC unlock_achievement(p_code, p_meta) desde xp.js
 * - Es SECURITY DEFINER: se ejecuta con permisos del servidor (anti-trampa)
 * - Retorna true si se desbloqueó ahora, false si ya estaba desbloqueado
 * 
 * CACHE:
 * - El catálogo de logros se cachea 5 minutos en memoria
 * - Evita consultas repetitivas a la BD
 * - Se puede forzar la recarga con force=true
 * 
 * PORCENTAJES DE DESBLOQUEO:
 * - Calcula qué % de usuarios tiene cada logro
 * - Útil para mostrar rareza de logros (ej: "Solo el 3.5% lo tiene")
 */
import { supabase } from './supabase'

/**
 * Obtiene todos los logros desbloqueados de un usuario
 * @param {string} userId - UUID del usuario
 * @returns {Object} { data: [{ earned_at, achievements: {...} }], error }
 */
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

/**
 * Get achievement unlock percentage: (users with achievement / total users) * 100
 * Returns a map: { achievement_code: percentage }
 */
export async function getAchievementUnlockPercentages() {
  try {
    // Get total registered users count
    const { count: totalUsers, error: countError } = await supabase
      .from('user_profiles')
      .select('id', { count: 'exact', head: true })
    
    if (countError || !totalUsers) {
      console.error('[achievements.js] Error counting users:', countError)
      return {}
    }

    // Get count of users per achievement
    const { data: achievements, error: achError } = await supabase
      .from('user_achievements')
      .select('achievement_id, achievements!inner(code)')
    
    if (achError) {
      console.error('[achievements.js] Error fetching achievement stats:', achError)
      return {}
    }

    // Count users per achievement code
    const counts = {}
    for (const row of achievements || []) {
      const code = row?.achievements?.code
      if (code) {
        counts[code] = (counts[code] || 0) + 1
      }
    }

    // Calculate percentages
    const percentages = {}
    for (const code in counts) {
      percentages[code] = Math.round((counts[code] / totalUsers) * 100 * 10) / 10 // 1 decimal
    }

    return percentages
  } catch (e) {
    console.error('[achievements.js] Exception calculating percentages:', e)
    return {}
  }
}

