/**
 * SERVICIO DE MODOS DE JUEGO
 * 
 * Gestiona los diferentes modos de juego de Goaldemy:
 * - NORMAL: Juego libre, otorga XP
 * - FREE: Juego de práctica, NO otorga XP
 * - CHALLENGE: Desafío diario, 1 intento por día por juego
 * 
 * DESAFÍOS DIARIOS:
 * - Cada juego tiene 1 desafío por día (se resetea a las 00:00)
 * - Se registra en la tabla "game_sessions" con mode: 'challenge'
 * - Solo las sesiones TERMINADAS (ended_at !== null) cuentan como "jugadas"
 * - Esto permite salir a mitad de juego sin perder el intento diario
 * 
 * RACHAS DIARIAS:
 * - Se cuentan los días consecutivos ganando un juego específico
 * - Ejemplo: ganaste "who-is" hoy, ayer y anteayer = racha de 3 días
 * - Desbloquea logros como streak_3, streak_5, streak_10, streak_15
 * 
 * SUPERLOGRO daily_super_5x3:
 * - Requiere tener racha de 5+ días en 3 juegos diferentes simultáneamente
 * - Es el logro más difícil de conseguir
 * 
 * FLUJO DE UN DESAFÍO:
 * 1. isChallengeAvailable() - Verifica si puede jugar hoy
 * 2. startChallengeSession() - Crea registro en game_sessions
 * 3. Usuario juega...
 * 4. completeChallengeSession() - Marca ended_at y guarda resultado
 * 5. checkAndUnlockDailyWins() - Verifica logros desbloqueados
 */
import { supabase } from './supabase'
import { getAuthUser } from './auth'
import { fetchGameBySlug, friendlyNameForSlug } from './games'
import { unlockAchievementWithToast } from './xp'
import { checkAllAchievementsAfterChallenge, checkTimeBasedAchievements } from './achievement-triggers'
import { getDailyChallengeLimit } from './premium'

// Cache de game_id por slug para evitar consultas repetitivas
const _gameIdCache = new Map()

/**
 * Obtiene el UUID de un juego a partir de su slug (con cache)
 */
async function getGameId(slug) {
  if (_gameIdCache.has(slug)) return _gameIdCache.get(slug)
  const g = await fetchGameBySlug(slug)
  const id = g?.id || null
  if (id) _gameIdCache.set(slug, id)
  return id
}

// Lista de juegos con desafío diario habilitado (mantener actualizado)
export const DAILY_GAMES = ['who-is','guess-player','nationality','value-order','age-order','height-order','player-position','shirt-number']

/**
 * Retorna el inicio del día actual en formato ISO (00:00:00)
 * Usado para filtrar sesiones de "hoy"
 */
function todayStartIso() {
  return new Date(new Date().setHours(0,0,0,0)).toISOString()
}

/**
 * Cuenta cuántas victorias de desafíos diarios logró el usuario hoy
 * @returns {number} Cantidad de desafíos ganados hoy (max: 8, uno por juego)
 */
export async function countTodayDailyWins() {
  const { id: userId } = getAuthUser() || {}
  if (!userId) return 0
  const { data, error } = await supabase
    .from('game_sessions')
    .select('id, metadata, game_id, started_at')
    .eq('user_id', userId)
    .gte('started_at', todayStartIso())
    .contains('metadata', { result: 'win' })
  if (error) return 0
  // Dado que el desafío diario por juego se limita a 1, un simple conteo sirve
  return (data || []).length
}

/**
 * Verifica y desbloquea logros relacionados con victorias diarias
 * Se ejecuta después de completar un desafío diario
 * @param {string} slugJustPlayed - Slug del juego recién jugado
 * @param {boolean} won - Si el usuario ganó o perdió
 * @param {Object} metadata - Metadata del juego (score, corrects, etc.)
 */
export async function checkAndUnlockDailyWins(slugJustPlayed, won = true, metadata = {}) {
  try {
    // Verificar logros basados en tiempo (ej: jugar de madrugada)
    await checkTimeBasedAchievements()
    
    // Solo verificar logros de victoria si el usuario ganó
    if (!won) return
    
    const wins = await countTodayDailyWins()
    // LOGROS POR VICTORIAS DIARIAS:
    if (wins >= 3) await unlockAchievementWithToast('daily_wins_3')  // 3 desafíos ganados hoy
    if (wins >= 5) await unlockAchievementWithToast('daily_wins_5')  // 5 desafíos ganados hoy
    if (wins >= 10) await unlockAchievementWithToast('daily_wins_10') // 10 desafíos ganados hoy
    // PLENO: Ganaste todos los juegos con desafío diario (8 juegos)
    if (wins >= DAILY_GAMES.length) await unlockAchievementWithToast('daily_wins_all')

    // RACHAS: Días consecutivos ganando este juego específico
    try {
      const streak = await fetchDailyWinStreak(slugJustPlayed)
      if (streak >= 3) await unlockAchievementWithToast('streak_3', { game: slugJustPlayed })
      if (streak >= 5) await unlockAchievementWithToast('streak_5', { game: slugJustPlayed })
      if (streak >= 10) await unlockAchievementWithToast('streak_10', { game: slugJustPlayed })
      if (streak >= 15) await unlockAchievementWithToast('streak_15', { game: slugJustPlayed })
    } catch {}

    // SUPERLOGRO: 5 días seguidos en 3 juegos distintos simultáneamente
    try {
      const values = await Promise.all(DAILY_GAMES.map(s => fetchDailyWinStreak(s).catch(()=>0)))
      const count5 = values.filter(v => (v || 0) >= 5).length
      if (count5 >= 3) await unlockAchievementWithToast('daily_super_5x3')
    } catch {}
    
    // Verificar todos los demás logros (puntaje, tiempo, etc.)
    await checkAllAchievementsAfterChallenge(slugJustPlayed, won, metadata)
  } catch {}
}

/**
 * Verifica si el usuario puede jugar el desafío diario de un juego hoy
 * @param {string} slug - Slug del juego (ej: 'who-is', 'nationality')
 * @returns {Object} { available: boolean, reason: string|null, result: 'win'|'loss'|null }
 *   - available: true si puede jugar, false si ya lo jugó hoy
 *   - reason: Mensaje explicativo si no está disponible
 *   - result: Resultado del último intento ('win', 'loss', o null si no jugó)
 */
export async function isChallengeAvailable(slug) {
  const { id: userId } = getAuthUser() || {}
  if (!userId) return { available: false, reason: 'Debes iniciar sesión' }
  const gameId = await getGameId(slug)
  // If the game is not registered in DB yet, allow playing (no persisted session)
  if (!gameId) return { available: true, reason: null, result: null }
  const { data, error } = await supabase
    .from('game_sessions')
    .select('id, started_at, ended_at, metadata, score_final')
    .eq('user_id', userId)
    .eq('game_id', gameId)
    .gte('started_at', new Date(new Date().setHours(0,0,0,0)).toISOString())
  if (error) return { available: false, reason: 'Error verificando disponibilidad' }
  // Consider ONLY finished sessions as "already played" to allow leaving mid-game without burning the daily
  const todaySessions = (data || []).filter(r => (r?.metadata || {})?.mode === 'challenge')
  const finished = todaySessions.filter(r => !!r.ended_at)
  const dailyLimit = await getDailyChallengeLimit()
  const already = finished.length >= dailyLimit
  const last = finished.sort((a,b)=> new Date(b.started_at) - new Date(a.started_at))[0]
  let result = last?.metadata?.result || null
  // Robust fallback: infer result if missing, so UI can always show ✓/✕
  if (!result && last) {
    const slugLower = (slug || '').toLowerCase()
    const m = last.metadata || {}
    const score = Number(last.score_final || 0)
    const corrects = Number(m.corrects ?? NaN)
    // Non-timed ordering games: win only if 5/5 (score 50)
    if (['value-order','age-order','height-order'].includes(slugLower)) {
      result = score >= 50 ? 'win' : 'loss'
    } else if (['who-is'].includes(slugLower)) {
      // WhoIs should set result always; keep as null if truly unknown
      if (m.result === 'win' || m.result === 'loss') result = m.result
    } else {
      // Timed MCQ games: win if corrects >= 10; fallback by score >= 100
      if (Number.isFinite(corrects)) result = corrects >= 10 ? 'win' : 'loss'
      else result = score >= 100 ? 'win' : 'loss'
    }
  }
  const remaining = dailyLimit - finished.length
  return { available: !already, reason: already ? `Ya usaste tus ${dailyLimit} intentos de hoy` : null, result, remaining }
}

// Start a challenge session and return session id
export async function startChallengeSession(slug, seconds) {
  import('../stores/notifications').then(m => m.setSuppressOverlays(true)).catch(() => {})
  const { id: userId } = getAuthUser() || {}
  const gameId = await getGameId(slug)
  // If no DB game exists, start a non-persisted session by returning null
  if (!userId) throw new Error('No se pudo iniciar la sesión')
  if (!gameId) return null
  const metadata = { mode: 'challenge', seconds: seconds }
  const { data, error } = await supabase
    .from('game_sessions')
    .insert([{ user_id: userId, game_id: gameId, metadata }])
    .select('id')
    .maybeSingle()
  if (error) throw error
  return data?.id || null
}

// Complete session with final score/xp
export async function completeChallengeSession(sessionId, score, xp, metadataPatch) {
  if (!sessionId) return
  // Merge metadata to preserve mode/seconds and add result/maxStreak, etc.
  let existing = null
  try {
    const { data: cur } = await supabase
      .from('game_sessions')
      .select('metadata')
      .eq('id', sessionId)
      .maybeSingle()
    existing = cur?.metadata || null
  } catch (_) {}
  const metadata = { ...(existing || {}), ...(metadataPatch || {}) }
  
  // 🔍 DEBUG: Log what we're saving
  console.log('[completeChallengeSession] Saving:', { sessionId, score, xp, metadata })
  
  const { error } = await supabase
    .from('game_sessions')
    .update({ score_final: score ?? 0, xp_earned: xp ?? 0, ended_at: new Date().toISOString(), metadata })
    .eq('id', sessionId)
  
  if (error) {
    console.error('[completeChallengeSession] Error:', error)
  } else {
    console.log('[completeChallengeSession] ✅ Saved successfully')
  }
}

// Fetch the latest FINISHED session for today for a given game slug (for review mode)
export async function fetchTodayLastSession(slug) {
  const { id: userId } = getAuthUser() || {}
  const gameId = await getGameId(slug)
  if (!userId || !gameId) return null
  const { data, error } = await supabase
    .from('game_sessions')
    .select('id, started_at, ended_at, score_final, xp_earned, metadata')
    .eq('user_id', userId)
    .eq('game_id', gameId)
    .gte('started_at', todayStartIso())
    .order('started_at', { ascending: false })
    .limit(5)
  if (error) return null
  const finished = (data || []).filter(r => !!r.ended_at && (r?.metadata || {}).mode === 'challenge')
  return finished[0] || null
}

// Developer helper: reset today's challenge sessions for current user (to replay all daily games)
export async function resetTodaySessionsForCurrentUser() {
  try {
    const { id: userId } = getAuthUser() || {}
    if (!userId) throw new Error('No autenticado')
    const { error } = await supabase
      .from('game_sessions')
      .delete()
      .eq('user_id', userId)
      .gte('started_at', todayStartIso())
    if (error) throw error
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e?.message || String(e) }
  }
}

// Fetch lifetime best streak for this user and game
export async function fetchLifetimeMaxStreak(slug) {
  const { id: userId } = getAuthUser() || {}
  const gameId = await getGameId(slug)
  if (!userId || !gameId) return 0
  const { data, error } = await supabase
    .from('game_sessions')
    .select('metadata')
    .eq('user_id', userId)
    .eq('game_id', gameId)
    .order('started_at', { ascending: false })
    .limit(200)
  if (error) return 0
  let max = 0
  for (const r of (data || [])) {
    const m = r?.metadata || {}
    const s = Number(m.maxStreak || 0)
    if (s > max) max = s
  }
  return max
}

// Compute current daily win streak per requested rule:
// - Incrementa sólo cuando jugás y GANÁS ese día
// - Días sin jugar NO cortan la racha
// - Se corta únicamente cuando jugás y PERDÉS
export async function fetchDailyWinStreak(slug) {
  const { id: userId } = getAuthUser() || {}
  const gameId = await getGameId(slug)
  if (!userId || !gameId) return 0
  const { data, error } = await supabase
    .from('game_sessions')
    .select('started_at, metadata')
    .eq('user_id', userId)
    .eq('game_id', gameId)
    .order('started_at', { ascending: false })
    .limit(365)
  if (error) return 0
  // Build a map day -> last result that day
  const byDay = new Map()
  for (const r of (data || [])) {
    const d = new Date(r.started_at)
    const dayKey = d.toISOString().slice(0,10)
    if (!byDay.has(dayKey)) {
      byDay.set(dayKey, (r?.metadata || {}).result || null)
    }
  }
  // Iterate from most recent played day backwards, counting wins until first loss.
  const days = Array.from(byDay.entries()).sort((a,b) => (a[0] < b[0] ? 1 : -1))
  let streak = 0
  for (const [_, res] of days) {
    if (res === 'win') streak += 1
    else if (res === 'loss') break
    // null/unknown shouldn't happen, but don't affect streak
  }
  return streak
}

// Compute best (max) daily win streak historically for a game under same rule (gaps don't cut)
export async function fetchMaxDailyWinStreak(slug) {
  const { id: userId } = getAuthUser() || {}
  const gameId = await getGameId(slug)
  if (!userId || !gameId) return 0
  const { data, error } = await supabase
    .from('game_sessions')
    .select('started_at, metadata')
    .eq('user_id', userId)
    .eq('game_id', gameId)
    .order('started_at', { ascending: false })
    .limit(365)
  if (error) return 0
  // Build unique days with result
  const byDay = new Map()
  for (const r of (data || [])) {
    const d = new Date(r.started_at)
    const key = d.toISOString().slice(0,10)
    if (!byDay.has(key)) byDay.set(key, (r?.metadata || {}).result || null)
  }
  // Iterate from oldest to newest measuring max consecutive win streaks; gaps don't cut
  const days = Array.from(byDay.entries()).sort((a,b) => (a[0] > b[0] ? 1 : -1))
  let maxStreak = 0
  let cur = 0
  for (const [_, res] of days) {
    if (res === 'win') cur += 1; else if (res === 'loss') cur = 0
    if (cur > maxStreak) maxStreak = cur
  }
  return maxStreak
}

// Helper to get display list with names for UI
export function getDailyGamesList() {
  return DAILY_GAMES.map(slug => ({ slug, name: friendlyNameForSlug(slug) }))
}
