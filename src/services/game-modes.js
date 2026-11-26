/**
 * SERVICIO DE MODOS DE JUEGO
 * 
 * Gestiona los diferentes modos de juego de Fulvo:
 * - NORMAL: Juego libre, otorga XP
 * - FREE: Juego de práctica, NO otorga XP
 * - CHALLENGE: Desafío diario, 1 intento por día por juego
 * 
 * DESAFÍOS DIARIOS:
 * - Cada juego tiene 1 desafío por día (se resetea a las 00:00)
 * - Se registra en la tabla "game_sessions" con mode: 'challenge'
 * - Toda sesión EMPEZADA cuenta como intento del día (relanzamiento): antes solo
 *   contaban las terminadas y se podía "mirar y reintentar" (ver las preguntas,
 *   salir y volver a empezar). Una sesión sin terminar se muestra en la revisión
 *   como partido abandonado (derrota).
 * - "Hoy" es el día de Argentina (services/app-date.js = app_today() del server).
 * 
 * RACHAS DIARIAS:
 * - Se cuentan los días consecutivos ganando un juego específico
 * - Ejemplo: ganaste "who-is" hoy, ayer y anteayer = racha de 3 días
 * - Desbloquea logros como streak_5, streak_10, streak_15
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
import { checkAllAchievementsAfterChallenge, checkNewAchievements } from './achievement-triggers'
import { getDailyChallengeLimit } from './premium'
import { appDayStartIso, appDateKey, appToday } from './app-date'
import { KNOWN_GAME_SLUGS, isGamePaused } from './games'

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

// Juegos con desafío diario: TODOS los juegos conocidos que no estén pausados
// (los 14 tienen modo desafío). Antes era una lista a mano de 8, por lo que el
// superlogro 5x3 y las rachas del perfil ignoraban 6 juegos.
export const DAILY_GAMES = KNOWN_GAME_SLUGS.filter(s => !isGamePaused(s))

/**
 * Inicio del día de HOY en Argentina (ISO), para filtrar sesiones de "hoy".
 * Antes usaba la hora local del dispositivo (un usuario de viaje veía otro día).
 */
function todayStartIso() {
  return appDayStartIso()
}

/** Cantidad de jugadores del partido de ordenar (3/5/7 según dificultad). */
function orderingTotal(m = {}) {
  const n = Array.isArray(m.items) ? m.items.length : Number(m.total || 0)
  return n > 0 ? n : 5
}

/**
 * Cuenta cuántas victorias de desafíos diarios logró el usuario hoy
 * @returns {number} Cantidad de JUEGOS DISTINTOS ganados hoy
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
  // Contar JUEGOS DISTINTOS ganados (no sesiones): un mismo juego con varios
  // intentos premium no debe contar doble para "todos los juegos del día".
  const uniqueGames = new Set()
  for (const row of (data || [])) {
    if (row.game_id) uniqueGames.add(row.game_id)
  }
  return uniqueGames.size
}

// Cantidad total de juegos jugables (no pausados). Dinámico: al agregar juegos
// nuevos, "todos los juegos" (Pleno diario / Grand Slam) se ajusta solo.
let _playableCountCache = null
let _playableCountAt = 0
export async function getPlayableGameCount() {
  const now = Date.now()
  if (_playableCountCache != null && (now - _playableCountAt < 5 * 60 * 1000)) {
    return _playableCountCache
  }
  try {
    const { fetchGames } = await import('./games')
    const games = await fetchGames()
    const n = Array.isArray(games) ? games.length : 0
    if (n > 0) { _playableCountCache = n; _playableCountAt = now }
    return n > 0 ? n : (_playableCountCache ?? DAILY_GAMES.length)
  } catch {
    return _playableCountCache ?? DAILY_GAMES.length
  }
}

/**
 * Verifica y desbloquea logros relacionados con victorias diarias
 * Se ejecuta después de completar un desafío diario
 * @param {string} slugJustPlayed - Slug del juego recién jugado
 * @param {boolean} won - Si el usuario ganó o perdió
 * @param {Object} metadata - Metadata del juego (score, corrects, etc.)
 */
export async function checkAndUnlockDailyWins(slugJustPlayed, wonArg, metaArg) {
  // El resumen espera a que esto termine (y a sus escenas) antes de ir al juego siguiente
  const notif = await import('../stores/notifications').catch(() => null)
  notif?.beginPendingCheck?.()
  try { await _checkAndUnlockDailyWins(slugJustPlayed, wonArg, metaArg) } finally { notif?.endPendingCheck?.() }
}
async function _checkAndUnlockDailyWins(slugJustPlayed, wonArg, metaArg) {
  try {
    // FUENTE DE VERDAD: la sesión recién terminada. Antes los juegos llamaban
    // sin `won`/`metadata` (quedaban en true/{}), por lo que perfectionist/comeback/
    // lucky_first nunca podían dispararse y `won` era siempre true. Ahora derivamos
    // el resultado real y la metadata guardada, y mezclamos lo que pase el caller.
    let won = wonArg
    let metadata = metaArg && typeof metaArg === 'object' ? { ...metaArg } : {}
    try {
      const last = await fetchTodayLastSession(slugJustPlayed)
      const savedMeta = last?.metadata || {}
      metadata = { ...savedMeta, ...metadata }
      if (won == null) won = metadata.result === 'win'
    } catch {}
    if (won == null) won = true

    // Solo verificar logros de victoria si el usuario ganó. Los logros nuevos
    // (achievements-new-1) también miran derrotas (Fuego azul, Enciclopedia).
    if (!won) {
      await checkNewAchievements(slugJustPlayed)
      try { const { detectAndToastLevelUp } = await import('./xp'); await detectAndToastLevelUp() } catch {}
      // Perder también puede dar un logro con cosmético (Fuego azul, Enciclopedia…)
      try { (await import('./cosmetics')).scheduleCosmeticCheck(600) } catch {}
      return
    }

    const wins = await countTodayDailyWins()           // juegos distintos ganados hoy
    const totalGames = await getPlayableGameCount()    // todos los juegos jugables (dinámico)
    // LOGROS POR VICTORIAS DIARIAS:
    // (3 juegos ganados hoy: cubierto por hat_trick, ver checkHatTrickAchievement)
    if (wins >= 5) await unlockAchievementWithToast('daily_wins_5')  // 5 juegos ganados hoy
    if (wins >= 10) await unlockAchievementWithToast('daily_wins_10') // 10 juegos ganados hoy
    // PLENO: Ganaste TODOS los juegos disponibles hoy
    if (totalGames > 0 && wins >= totalGames) await unlockAchievementWithToast('daily_wins_all')

    // RACHAS DE ACIERTOS: aciertos SEGUIDOS dentro de este juego (no días).
    // Los logros de constancia por días son daily_streak_* (otro sistema).
    // streak_3 quedó `active = false` (saturaba la primera partida): ya no se evalúa.
    try {
      const inStreak = Number(metadata.maxStreak || 0)
      if (inStreak >= 5) await unlockAchievementWithToast('streak_5', { game: slugJustPlayed, streak: inStreak })
      if (inStreak >= 10) await unlockAchievementWithToast('streak_10', { game: slugJustPlayed, streak: inStreak })
      if (inStreak >= 15) await unlockAchievementWithToast('streak_15', { game: slugJustPlayed, streak: inStreak })
    } catch {}

    // SUPERLOGRO: 5 días seguidos ganando en 3 juegos distintos simultáneamente
    try {
      const values = await Promise.all(DAILY_GAMES.map(s => fetchDailyWinStreak(s).catch(()=>0)))
      const count5 = values.filter(v => (v || 0) >= 5).length
      if (count5 >= 3) await unlockAchievementWithToast('daily_super_5x3')
    } catch {}

    // Verificar todos los demás logros (puntaje, tiempo, etc.)
    await checkAllAchievementsAfterChallenge(slugJustPlayed, won, metadata)

    // Logros nuevos (achievements-new-1): calculados desde las sesiones guardadas en Supabase
    await checkNewAchievements(slugJustPlayed)

    // La XP de los logros recién desbloqueados puede cruzar un nivel (o un rango): no pasa por
    // awardXp, así que la subida se detecta acá y no depende solo de Realtime.
    try { const { detectAndToastLevelUp } = await import('./xp'); await detectAndToastLevelUp() } catch {}

    // ESCENA DE COSMÉTICO: los logros recién desbloqueados pueden otorgar cosméticos
    // (get_cosmetics los marca owned al tener el logro). Detectarlos AHORA y encolarlos.
    // Como suppressOverlays está activo mientras se muestra el popup final, la escena
    // espera y se reproduce recién al cerrarlo (después de rango/nivel si los hubo).
    try {
      const { checkCosmeticUnlocks } = await import('./cosmetics')
      await checkCosmeticUnlocks()
    } catch {}
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
  // Invitado (sin cuenta): puede jugar, no hay sesión server-side contra la cual
  // chequear "ya jugaste hoy" — el límite de 1/día empieza a regir recién al registrarse.
  if (!userId) return { available: true, reason: null, result: null }
  const gameId = await getGameId(slug)
  // If the game is not registered in DB yet, allow playing (no persisted session)
  if (!gameId) return { available: true, reason: null, result: null }
  const { data, error } = await supabase
    .from('game_sessions')
    .select('id, started_at, ended_at, metadata, score_final')
    .eq('user_id', userId)
    .eq('game_id', gameId)
    .gte('started_at', todayStartIso())
  if (error) return { available: false, reason: 'Error verificando disponibilidad' }
  // Cuenta TODA sesión empezada hoy (terminada o no): si no, se podía ver el
  // desafío, salir y reintentar con las respuestas sabidas.
  const todaySessions = (data || []).filter(r => (r?.metadata || {})?.mode === 'challenge')
  const dailyLimit = await getDailyChallengeLimit()
  const already = todaySessions.length >= dailyLimit
  const last = pickReviewSession(todaySessions)
  const abandoned = !!(last && !last.ended_at)
  let result = abandoned ? 'loss' : (last?.metadata?.result || null)
  // Robust fallback: infer result if missing, so UI can always show ✓/✕
  if (!result && last) {
    const slugLower = (slug || '').toLowerCase()
    const m = last.metadata || {}
    const score = Number(last.score_final || 0)
    const corrects = Number(m.corrects ?? NaN)
    // Ordenar: gana solo con todos en su lugar (3, 5 o 7 según dificultad)
    if (['value-order','age-order','height-order'].includes(slugLower)) {
      const ok = Number(m.correctPositions ?? m.corrects ?? NaN)
      result = Number.isFinite(ok) ? (ok >= orderingTotal(m) ? 'win' : 'loss') : (score >= orderingTotal(m) * 20 ? 'win' : 'loss')
    } else if (['who-is'].includes(slugLower)) {
      // WhoIs should set result always; keep as null if truly unknown
      if (m.result === 'win' || m.result === 'loss') result = m.result
    } else {
      // Timed MCQ games: win if corrects >= 10; fallback by score >= 100
      if (Number.isFinite(corrects)) result = corrects >= 10 ? 'win' : 'loss'
      else result = score >= 100 ? 'win' : 'loss'
    }
  }
  const remaining = Math.max(0, dailyLimit - todaySessions.length)
  // Ficha del partido de hoy para el póster del índice (moodboard 07)
  const ficha = last ? matchFicha(slug, last.metadata || {}, Number(last.score_final || 0), result) : null
  if (ficha && abandoned) ficha.abandoned = true
  return { available: !already, reason: already ? `Ya usaste tus ${dailyLimit} intentos de hoy` : null, result, remaining, ficha, abandoned }
}

/**
 * Sesión a mostrar como "el partido de hoy": la última TERMINADA si hay; si no,
 * la última empezada (abandonada). Así un abandono no tapa un resultado real.
 */
function pickReviewSession(rows = []) {
  const sorted = [...rows].sort((a, b) => new Date(b.started_at) - new Date(a.started_at))
  return sorted.find(r => !!r.ended_at) || sorted[0] || null
}

/**
 * Resumen corto del último partido para mostrar en el póster: marcador y
 * estrellas por PRECISIÓN (decidido en el moodboard 07): 3 = sin errores,
 * 2 = hasta 2 errores, 1 = más. Solo se dan estrellas si ganó.
 */
export function matchFicha(slug, m = {}, scoreFinal = 0, result = null) {
  const s = (slug || '').toLowerCase()
  const win = result === 'win'
  if (['value-order', 'age-order', 'height-order'].includes(s)) {
    const ok = Number(m.correctPositions ?? m.corrects ?? Math.round(scoreFinal / 20))
    return { score: `${Number.isFinite(ok) ? ok : 0}/${orderingTotal(m)}`, stars: win ? 3 : 0 }
  }
  if (Number.isFinite(Number(m.corrects)) && ['guess-player', 'nationality', 'player-position', 'shirt-number', 'stat-challenge'].includes(s)) {
    const corrects = Number(m.corrects) || 0
    const errors = Number(m.errors ?? Math.max(0, (Number(m.attempts) || corrects) - corrects))
    const stars = win ? (errors === 0 ? 3 : errors <= 2 ? 2 : 1) : 0
    return { score: `${Math.min(corrects, 10)}/10`, stars, errors }
  }
  return { score: '', stars: win ? 3 : 0 }
}

// Start a challenge session and return session id.
// `extra` se mezcla en la metadata inicial: los juegos pasan { difficulty } para que
// los logros que dependen de "en Difícil" (achievement-rules.js) lo lean de la sesión.
export async function startChallengeSession(slug, seconds, extra = {}) {
  import('../stores/notifications').then(m => m.setSuppressOverlays(true)).catch(() => {})
  const { id: userId } = getAuthUser() || {}
  const gameId = await getGameId(slug)
  // Invitado o juego sin registrar en DB: sesión no persistida (sessionId null,
  // completeChallengeSession ya sabe no-opear con eso).
  if (!userId || !gameId) return null
  const metadata = { mode: 'challenge', seconds: seconds, ...(extra || {}) }
  const { data, error } = await supabase
    .from('game_sessions')
    .insert([{ user_id: userId, game_id: gameId, metadata }])
    .select('id')
    .maybeSingle()
  if (error) throw error
  return data?.id || null
}

// Sesiones ya cerradas en este cliente: el reporte a recompensas sale UNA vez.
const _completedSessions = new Set()

/**
 * Cierra la sesión con el resultado final y reporta a recompensas (pase, retos
 * diarios, Fichas) EXACTAMENTE una vez por sesión.
 *
 * Antes ~9 juegos llamaban esto dos veces (resultado + foto del XP) y cada
 * llamada reportaba: puntos del pase, progreso de retos y Fichas duplicados.
 * Ahora, si la sesión ya estaba terminada (en este cliente o en la DB), una
 * segunda llamada solo mezcla metadata — igual que saveSessionXpView().
 */
export async function completeChallengeSession(sessionId, score, xp, metadataPatch) {
  if (!sessionId) return
  if (_completedSessions.has(sessionId)) return saveSessionMeta(sessionId, metadataPatch)
  _completedSessions.add(sessionId)
  // Merge metadata to preserve mode/seconds and add result/maxStreak, etc.
  let existing = null
  let gameId = null
  let alreadyEnded = false
  try {
    const { data: cur } = await supabase
      .from('game_sessions')
      .select('metadata, game_id, ended_at')
      .eq('id', sessionId)
      .maybeSingle()
    existing = cur?.metadata || null
    gameId = cur?.game_id || null
    alreadyEnded = !!cur?.ended_at
  } catch (_) {}
  if (alreadyEnded) return saveSessionMeta(sessionId, metadataPatch, existing)
  const metadata = { ...(existing || {}), ...(metadataPatch || {}) }

  const { error } = await supabase
    .from('game_sessions')
    .update({ score_final: score ?? 0, xp_earned: xp ?? 0, ended_at: new Date().toISOString(), metadata })
    .eq('id', sessionId)

  if (error) {
    console.error('[completeChallengeSession] Error:', error)
    // Dejar reintentar el cierre si falló la escritura
    _completedSessions.delete(sessionId)
    return
  }

  // Reportar resultado a recompensas (retos diarios) — centralizado, una sola vez
  try {
    const won = !!(metadata && metadata.result === 'win')
    if (gameId) {
      const { data: grow } = await supabase
        .from('games').select('slug').eq('id', gameId).maybeSingle()
      if (grow?.slug) {
        const { reportGameResult } = await import('./rewards')
        await reportGameResult(grow.slug, won)
      }
    }
  } catch (_) {}
}

/** Mezcla metadata en una sesión SIN cerrarla ni reportar nada. */
async function saveSessionMeta(sessionId, patch, existing = undefined) {
  if (!sessionId || !patch) return
  try {
    let base = existing
    if (base === undefined) {
      const { data: cur } = await supabase
        .from('game_sessions').select('metadata').eq('id', sessionId).maybeSingle()
      base = cur?.metadata || null
    }
    await supabase
      .from('game_sessions')
      .update({ metadata: { ...(base || {}), ...patch } })
      .eq('id', sessionId)
  } catch (_) {}
}

/** Guarda la foto del XP (para la revisión) sin volver a cerrar ni reportar. */
export async function saveSessionXpView(sessionId, xpView) {
  return saveSessionMeta(sessionId, { xpView })
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
  const rows = (data || []).filter(r => (r?.metadata || {}).mode === 'challenge')
  const pick = pickReviewSession(rows)
  if (!pick) return null
  if (pick.ended_at) return pick
  // Partido abandonado: cuenta como intento del día → se revisa como derrota en 0.
  return { ...pick, score_final: 0, xp_earned: 0, metadata: { ...(pick.metadata || {}), result: 'loss', abandoned: true } }
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

/**
 * Día (Argentina) → resultado de ese día, para las rachas diarias.
 * - Manda la última sesión TERMINADA del día (antes podía ganar una sesión sin
 *   terminar con result null y "borrar" el resultado real).
 * - Un día pasado con solo sesiones abandonadas cuenta como derrota (si no,
 *   abandonar servía para no cortar la racha). Hoy sin terminar: no cuenta aún.
 */
function dailyResults(rows = []) {
  const today = appToday()
  const byDay = new Map()
  for (const r of (rows || [])) {
    const m = r?.metadata || {}
    if (m.mode && m.mode !== 'challenge') continue
    const key = appDateKey(r.started_at)
    if (!key) continue
    const cur = byDay.get(key) || { finished: null, open: false }
    if (r.ended_at) { if (!cur.finished) cur.finished = m.result || null } // filas vienen de más nueva a más vieja
    else cur.open = true
    byDay.set(key, cur)
  }
  const out = new Map()
  for (const [key, v] of byDay) {
    if (v.finished) out.set(key, v.finished)
    else if (v.open && key !== today) out.set(key, 'loss')
  }
  return out
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
    .select('started_at, ended_at, metadata')
    .eq('user_id', userId)
    .eq('game_id', gameId)
    .order('started_at', { ascending: false })
    .limit(365)
  if (error) return 0
  const byDay = dailyResults(data)
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
    .select('started_at, ended_at, metadata')
    .eq('user_id', userId)
    .eq('game_id', gameId)
    .order('started_at', { ascending: false })
    .limit(365)
  if (error) return 0
  const byDay = dailyResults(data)
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

/**
 * Próximo desafío diario disponible después de `currentSlug` (en el orden de
 * DAILY_GAMES, dando la vuelta). Respeta intentos del día y candado de nivel.
 * Devuelve la ruta lista para navegar ('/games/x?mode=challenge') o null.
 */
export async function findNextDailyGame(currentSlug) {
  try {
    const list = DAILY_GAMES
    const start = Math.max(0, list.indexOf(currentSlug) + 1)
    const ordered = [...list.slice(start), ...list.slice(0, start)].filter(s => s !== currentSlug)
    let level = null
    try {
      const { getUserLevel } = await import('./xp')
      const { data } = await getUserLevel(null)
      const info = Array.isArray(data) ? data[0] : data
      level = Number(info?.level) || null
    } catch {}
    const { isGameUnlocked } = await import('./level-rewards')
    const { gameRouteForSlug } = await import('./games')
    const avail = await Promise.all(ordered.map(s => isChallengeAvailable(s).catch(() => ({ available: false }))))
    for (let i = 0; i < ordered.length; i++) {
      const slug = ordered[i]
      if (!avail[i]?.available) continue
      if (level != null && !isGameUnlocked(slug, level)) continue
      return `${gameRouteForSlug(slug)}?mode=challenge`
    }
  } catch {}
  return null
}

// Helper to get display list with names for UI
export function getDailyGamesList() {
  return DAILY_GAMES.map(slug => ({ slug, name: friendlyNameForSlug(slug) }))
}
