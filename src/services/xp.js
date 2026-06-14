/**
 * SISTEMA DE EXPERIENCIA (XP) Y NIVELES
 * 
 * Este servicio gestiona toda la lógica de XP y niveles del usuario:
 * 
 * CONCEPTO:
 * - Los usuarios ganan XP por respuestas correctas, rachas, logros, etc.
 * - El XP acumulado determina el nivel del usuario (1-30)
 * - Los niveles tienen umbrales definidos en la tabla "level_thresholds"
 * 
 * AWARD_XP RPC:
 * - Es un Remote Procedure Call (función PostgreSQL) ejecutada en el servidor
 * - SECURITY DEFINER: Se ejecuta con permisos de la base de datos (no del usuario)
 * - Garantiza que el XP se otorgue de forma segura sin que el cliente pueda hacer trampa
 * - Actualiza automáticamente el campo "xp" en la tabla "users"
 * 
 * DETECCIÓN DE LEVEL UP:
 * - Después de otorgar XP, verifica si el nivel aumentó
 * - Compara el nivel actual con el anterior guardado en localStorage
 * - Si hay incremento, muestra un toast de "¡Subiste de nivel!"
 * - Esto es un fallback por si el sistema Realtime no detectó el cambio
 * 
 * CACHE:
 * - Los umbrales de nivel se cachean en memoria durante 60 segundos
 * - Evita consultas repetitivas a la base de datos
 */
import { supabase } from './supabase'
import { pushAchievementToast, pushLevelUpToast } from '../stores/notifications'
import { setKnownLevel as _setKnownLevelRealtime } from './levelup-realtime'

/**
 * Otorga XP al usuario autenticado actual
 * @param {Object} params
 * @param {number} params.amount - Cantidad de XP a otorgar (>=0)
 * @param {string} [params.reason='correct_answer'] - Razón por la que se otorga (para logs/auditoría)
 * @param {string|null} [params.gameId=null] - UUID del juego (si aplica)
 * @param {string|null} [params.sessionId=null] - UUID de la sesión de juego (si aplica)
 * @param {Object|null} [params.meta=null] - Metadata adicional (se guarda como JSON)
 */
export async function awardXp({ amount, reason = 'correct_answer', gameId = null, sessionId = null, meta = null }) {
  const { data, error } = await supabase.rpc('award_xp', {
    p_amount: amount,
    p_reason: reason,
    p_game_id: gameId,
    p_session_id: sessionId,
    p_meta: meta,
  })
  // Fallback: after awarding, verify if level increased and toast if Realtime missed it
  try {
    const { data: me } = await supabase.auth.getUser()
    const userId = me?.user?.id || null
    if (userId) {
      const { data: lvlData } = await getUserLevel(null)
      const info = Array.isArray(lvlData) ? lvlData[0] : lvlData
      const newLevel = info?.level ?? null
      if (newLevel != null) {
        const key = `gl:last_level:${userId}`
        let prev = null
        try {
          const raw = localStorage.getItem(key)
          prev = raw != null ? Number(raw) : null
        } catch {}
        if (prev != null && Number.isFinite(prev) && newLevel > prev) {
          pushLevelUpToast({ level: newLevel })
        }
        try { localStorage.setItem(key, String(newLevel)) } catch {}
        try { _setKnownLevelRealtime(newLevel) } catch {}
      }
    }
  } catch {}
  return { data, error }
}

/**
 * Obtiene información del nivel de un usuario
 * @param {string|null} userId - UUID del usuario o null para el usuario actual
 * @returns {Object} { data: { level, xp, xp_to_next_level }, error }
 */
export async function getUserLevel(userId = null) {
  const { data, error } = await supabase.rpc('get_user_level', { p_user_id: userId })
  return { data, error }
}

/**
 * Obtiene la tabla de clasificación (leaderboard) con filtros opcionales
 * @param {Object} opts - Opciones de filtrado
 * @param {'all_time'|'weekly'|'monthly'} [opts.period='all_time'] - Período de tiempo
 * @param {string|null} [opts.gameId=null] - Filtrar por juego específico
 * @param {number} [opts.limit=100] - Máximo de resultados
 * @param {number} [opts.offset=0] - Offset para paginación
 * @returns {Object} { data: [{ user_id, display_name, xp, level, rank }], error }
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

const FALLBACK_THRESHOLDS = [
  { level: 1, xp_required: 0 }, { level: 2, xp_required: 100 }, { level: 3, xp_required: 250 },
  { level: 4, xp_required: 450 }, { level: 5, xp_required: 700 }, { level: 6, xp_required: 1000 },
  { level: 7, xp_required: 1350 }, { level: 8, xp_required: 1750 }, { level: 9, xp_required: 2200 },
  { level: 10, xp_required: 2700 }, { level: 11, xp_required: 3300 }, { level: 12, xp_required: 4000 },
  { level: 13, xp_required: 4800 }, { level: 14, xp_required: 5700 }, { level: 15, xp_required: 6700 },
  { level: 16, xp_required: 7800 }, { level: 17, xp_required: 9000 }, { level: 18, xp_required: 10300 },
  { level: 19, xp_required: 11700 }, { level: 20, xp_required: 13200 }, { level: 21, xp_required: 14850 },
  { level: 22, xp_required: 16650 }, { level: 23, xp_required: 18600 }, { level: 24, xp_required: 20700 },
  { level: 25, xp_required: 22950 }, { level: 26, xp_required: 25350 }, { level: 27, xp_required: 27900 },
  { level: 28, xp_required: 30600 }, { level: 29, xp_required: 33450 }, { level: 30, xp_required: 36450 },
]

let _levelThresholdsCache = null
let _levelThresholdsAt = 0

export async function fetchLevelThresholds(force = false) {
  const now = Date.now()
  if (!force && _levelThresholdsCache && _levelThresholdsCache.length > 0 && (now - _levelThresholdsAt < 60_000)) {
    return _levelThresholdsCache
  }
  try {
    const { data, error } = await supabase.from('level_thresholds').select('level, xp_required').order('level', { ascending: true })
    if (!error && Array.isArray(data) && data.length > 0) {
      _levelThresholdsCache = data
      _levelThresholdsAt = now
      return _levelThresholdsCache
    }
  } catch {}
  if (!_levelThresholdsCache || _levelThresholdsCache.length === 0) {
    _levelThresholdsCache = FALLBACK_THRESHOLDS
    _levelThresholdsAt = now
  }
  return _levelThresholdsCache
}

fetchLevelThresholds()

function getThresholds() {
  if (_levelThresholdsCache && _levelThresholdsCache.length > 0) return _levelThresholdsCache
  return FALLBACK_THRESHOLDS
}

export function computeProgressPercentSync(levelInfo) {
  if (!levelInfo) return 0
  if (levelInfo.next_level == null) return 100

  const nextXp = Number(levelInfo.next_level_xp) || 0
  if (nextXp <= 0) return 0

  const thresholds = getThresholds()
  const lvl = Number(levelInfo.level) || 1
  const t = thresholds.find(t => Number(t.level) === lvl)
  const currXp = Number(t?.xp_required) || 0
  const range = nextXp - currXp
  if (range <= 0) return 100
  const earned = (Number(levelInfo.xp_total) || 0) - currXp
  return Math.max(0, Math.min(100, Math.round((earned / range) * 100)))
}

export async function captureLevelSnapshot() {
  const { data, error } = await getUserLevel(null)
  const info = Array.isArray(data) ? data[0] : data
  await fetchLevelThresholds()
  const pct = computeProgressPercentSync(info)
  return {
    level: info?.level ?? null,
    xpTotal: info?.xp_total ?? 0,
    percent: pct,
    xpToNext: info?.xp_to_next ?? null,
  }
}

/**
 * Calcula el nivel correspondiente a una cantidad de XP
 * @param {number} xp - Cantidad de XP
 * @param {Array} thresholds - Array de umbrales [{ level, xp_required }, ...]
 * @returns {number} Nivel calculado (1-30)
 */
export function computeLevelFromXp(xp, thresholds) {
  if (!Array.isArray(thresholds) || thresholds.length === 0) return 1
  const x = typeof xp === 'number' ? xp : Number(xp || 0)
  let lvl = 1
  for (const t of thresholds) {
    if ((t?.xp_required ?? 0) <= x && (t?.level ?? 0) >= lvl) lvl = t.level
  }
  return lvl
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
 * Desbloquea un logro para el usuario actual
 * @param {string} code - Código del logro (ej: 'first_win', 'streak_5')
 * @param {Object|null} meta - Metadata adicional (ej: { streak: 10 })
 * @returns {Object} { data: boolean (true si se desbloquó ahora, false si ya estaba), error }
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

/**
 * Get user's max streak per game. Preferred via RPC get_user_max_streak_by_game.
 * Fallback (current user only): scan xp_events meta.streak and aggregate.
 * Always returns items like: [{ id, name, streak }]
 */
export async function getUserMaxStreakByGame(userId = null) {
  // Try RPC first
  try {
    const { data, error } = await supabase.rpc('get_user_max_streak_by_game', { p_user_id: userId })
    const rows = (data || []).map(r => ({ id: r.game_id || 'unknown', name: r.name || 'Juego', streak: r.max_streak ?? 0 }))
    if (!error) return { data: rows, error: null }
    // If error continues, fall through to fallback
  } catch {}

  // Fallback: only if requesting own data (RLS restriction)
  try {
    const { data: me } = await supabase.auth.getUser()
    const authId = me?.user?.id || null
    const targetId = userId || authId
    if (!authId || !targetId || targetId !== authId) {
      return { data: [], error: null }
    }
    const { data: events, error: evErr } = await supabase
      .from('xp_events')
      .select('game_id, meta')
      .eq('user_id', authId)
    if (evErr) return { data: [], error: evErr }

    const maxById = new Map()
    const maxBySlug = new Map()
    for (const e of (events || [])) {
      if (!e) continue
      const sRaw = e.meta?.streak
      const s = typeof sRaw === 'number' ? sRaw : Number(sRaw)
      if (!Number.isFinite(s)) continue
      const gid = e.game_id || null
      if (gid) {
        const prev = maxById.get(gid) || 0
        if (s > prev) maxById.set(gid, s)
      } else {
        const slug = typeof e?.meta?.game === 'string' ? e.meta.game : null
        if (!slug) continue
        const prev = maxBySlug.get(slug) || 0
        if (s > prev) maxBySlug.set(slug, s)
      }
    }

    // Enrich names for known game ids
    const ids = Array.from(maxById.keys()).filter(k => k)
    let nameMap = {}
    if (ids.length) {
      const { data, error } = await supabase.from('games').select('id, name').in('id', ids)
      if (!error) {
        nameMap = {}
        for (const g of data || []) nameMap[g.id] = g.name || 'Juego'
      }
    }

    const rows = []
    for (const [gid, streak] of maxById.entries()) {
      if (!gid) continue // ignore unknown bucket for streaks
      rows.push({ id: gid, name: nameMap[gid] || 'Juego', streak })
    }
    // Add slug-based streaks using friendly names
    try {
      const { friendlyNameForSlug } = await import('./games')
      for (const [slug, streak] of maxBySlug.entries()) {
        rows.push({ id: slug, name: friendlyNameForSlug(slug), streak })
      }
    } catch {
      for (const [slug, streak] of maxBySlug.entries()) {
        rows.push({ id: slug, name: 'Juego', streak })
      }
    }
    rows.sort((a, b) => (b.streak || 0) - (a.streak || 0))
    return { data: rows, error: null }
  } catch (e) {
    return { data: [], error: e }
  }
}
