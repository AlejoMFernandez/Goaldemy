import { supabase } from './supabase'
import { getAuthUser } from './auth'
import { fetchGameBySlug } from './games'

// Resolve game id by slug (cached in-memory)
const _gameIdCache = new Map()
async function getGameId(slug) {
  if (_gameIdCache.has(slug)) return _gameIdCache.get(slug)
  const g = await fetchGameBySlug(slug)
  const id = g?.id || null
  if (id) _gameIdCache.set(slug, id)
  return id
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
    .select('id, started_at, metadata')
    .eq('user_id', userId)
    .eq('game_id', gameId)
    .gte('started_at', new Date(new Date().setHours(0,0,0,0)).toISOString())
  if (error) return { available: false, reason: 'Error verificando disponibilidad' }
  const todaySessions = (data || []).filter(r => (r?.metadata || {})?.mode === 'challenge')
  const already = todaySessions.length > 0
  const last = todaySessions.sort((a,b)=> new Date(b.started_at) - new Date(a.started_at))[0]
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
  // Iterate backwards day by day
  for (let i=0;i<365;i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)
    const key = d.toISOString().slice(0,10)
    const res = byDay.get(key)
    if (res === 'win') streak += 1
    else if (res == null) break // no jugó => corta
    else break // loss => corta
  }
  return streak
}
