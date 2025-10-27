import { supabase } from './supabase'
import { getAuthUser } from './auth'
import { fetchGameBySlug, friendlyNameForSlug } from './games'
import { unlockAchievementWithToast } from './xp'

// Resolve game id by slug (cached in-memory)
const _gameIdCache = new Map()
async function getGameId(slug) {
  if (_gameIdCache.has(slug)) return _gameIdCache.get(slug)
  const g = await fetchGameBySlug(slug)
  const id = g?.id || null
  if (id) _gameIdCache.set(slug, id)
  return id
}

// Juegos con modo desafío diario habilitado (mantener actualizado)
export const DAILY_GAMES = ['who-is','guess-player','nationality','value-order','age-order','height-order','player-position','shirt-number']

function todayStartIso() {
  return new Date(new Date().setHours(0,0,0,0)).toISOString()
}

// Contar victorias de hoy en desafíos diarios (todas los juegos)
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

// Desbloquear logros diarios tras completar un desafío
export async function checkAndUnlockDailyWins(slugJustPlayed) {
  try {
    const wins = await countTodayDailyWins()
    if (wins >= 3) await unlockAchievementWithToast('daily_wins_3')
    if (wins >= 5) await unlockAchievementWithToast('daily_wins_5')
    if (wins >= 10) await unlockAchievementWithToast('daily_wins_10')
    // Pleno: ganaste todos los juegos con desafío
    if (wins >= DAILY_GAMES.length) await unlockAchievementWithToast('daily_wins_all')

    // Racha por día del juego recién jugado
    try {
      const streak = await fetchDailyWinStreak(slugJustPlayed)
      if (streak >= 3) await unlockAchievementWithToast('daily_streak_3', { game: slugJustPlayed })
      if (streak >= 5) await unlockAchievementWithToast('daily_streak_5', { game: slugJustPlayed })
      if (streak >= 10) await unlockAchievementWithToast('daily_streak_10', { game: slugJustPlayed })
    } catch {}

    // SUPERLOGRO: 5 días seguidos en 3 juegos distintos
    try {
      const values = await Promise.all(DAILY_GAMES.map(s => fetchDailyWinStreak(s).catch(()=>0)))
      const count5 = values.filter(v => (v || 0) >= 5).length
      if (count5 >= 3) await unlockAchievementWithToast('daily_super_5x3')
    } catch {}
  } catch {}
}

// Check if the user can play the daily challenge for given slug today
export async function isChallengeAvailable(slug) {
  const { id: userId } = getAuthUser() || {}
  if (!userId) return { available: false, reason: 'Debes iniciar sesión' }
  const gameId = await getGameId(slug)
  // If the game is not registered in DB yet, allow playing (no persisted session)
  if (!gameId) return { available: true, reason: null, result: null }
  const { data, error } = await supabase
    .from('game_sessions')
    .select('id, started_at, ended_at, metadata')
    .eq('user_id', userId)
    .eq('game_id', gameId)
    .gte('started_at', new Date(new Date().setHours(0,0,0,0)).toISOString())
  if (error) return { available: false, reason: 'Error verificando disponibilidad' }
  // Consider ONLY finished sessions as "already played" to allow leaving mid-game without burning the daily
  const todaySessions = (data || []).filter(r => (r?.metadata || {})?.mode === 'challenge')
  const finished = todaySessions.filter(r => !!r.ended_at)
  const already = finished.length > 0
  const last = finished.sort((a,b)=> new Date(b.started_at) - new Date(a.started_at))[0]
  const result = last?.metadata?.result || null
  return { available: !already, reason: already ? 'Ya jugaste hoy' : null, result }
}

// Start a challenge session and return session id
export async function startChallengeSession(slug, seconds) {
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
  await supabase
    .from('game_sessions')
    .update({ score_final: score ?? 0, xp_earned: xp ?? 0, ended_at: new Date().toISOString(), metadata })
    .eq('id', sessionId)
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

// Compute current daily win streak for games that record a result (metadata.result === 'win'|'loss').
// Streak counts consecutive days up to hoy con 'win'. Si hay un día sin jugar o con 'loss', se corta.
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
  let streak = 0
  const today = new Date()
  const todayKey = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString().slice(0,10)
  const playedToday = byDay.has(todayKey)
  // If today hasn't been played, start counting from yesterday so the chip still shows the running streak.
  const startOffset = playedToday ? 0 : 1
  for (let i = startOffset; i < 365; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)
    const key = d.toISOString().slice(0,10)
    const res = byDay.get(key)
    if (res === 'win') {
      streak += 1
      continue
    }
    // If there's a day without play or a loss, streak is cut
    break
  }
  return streak
}

// Compute best (max) daily win streak historically for a game
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
  // Iterate from newest to oldest measuring max consecutive win streaks
  const days = Array.from(byDay.entries()).sort((a,b) => (a[0] < b[0] ? 1 : -1))
  let maxStreak = 0
  let cur = 0
  let prevDate = null
  for (const [key, res] of days) {
    const d = new Date(key + 'T00:00:00Z')
    if (prevDate && (prevDate - d) > 86400000) {
      // gap of more than 1 day cuts streak
      cur = 0
    }
    if (res === 'win') cur += 1; else cur = 0
    if (cur > maxStreak) maxStreak = cur
    prevDate = d
  }
  return maxStreak
}

// Helper to get display list with names for UI
export function getDailyGamesList() {
  return DAILY_GAMES.map(slug => ({ slug, name: friendlyNameForSlug(slug) }))
}
