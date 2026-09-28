/**
 * SERVICIO DE TRIGGERS DE LOGROS
 * 
 * Contiene toda la lógica para detectar cuándo desbloquear logros automáticamente.
 * Este archivo es el "cerebro" que analiza las acciones del usuario y decide qué logros otorgar.
 * 
 * TIPOS DE LOGROS:
 *
 * 1. BASADOS EN RENDIMIENTO:
 *    - perfect_10: 10/10 respuestas correctas
 *    - speed_demon: Completar en menos de X segundos
 *    - lucky_first: 10+ veces acertar al primer intento
 *
 * 2. BASADOS EN RACHAS:
 *    - streak_5, streak_10, streak_15: Días consecutivos ganando
 *    - daily_super_5x3: 5+ días en 3 juegos simultáneamente
 *
 * 3. BASADOS EN CANTIDAD:
 *    - games_played_10, games_played_50, games_played_100: Juegos jugados
 *    - total_wins_10, total_wins_50, total_wins_100: Victorias totales
 *
 * 4. ESPECIALES:
 *    - comeback_king ("Revancha"): ganar hoy un juego que se había perdido ayer
 *    - perfectionist: Ganar todos los juegos de ordenamiento con 5/5
 *
 * LLAMADAS:
 * - checkAllAchievementsAfterChallenge(): Al finalizar un desafío diario
 * - checkLuckyFirstAchievement(): Cuando se acierta al primer intento
 *
 * 5. LOGROS NUEVOS (achievements-new-1): 23 logros de tiempo/ayudas, por juego, colección,
 *    varios días, sostener el nivel y hazañas repetidas. Las reglas viven en
 *    achievement-rules.js (puro); checkNewAchievements() lee las sesiones de Supabase
 *    y desbloquea. checkCollectorAchievement() (Coleccionista) sale del sobre del día.
 *
 * NOTA: first_correct, streak_3, ten_correct y night_owl quedaron `active = false`
 * (supabase/achievements-curation-2.sql) por saturar la primera partida de las
 * cuentas nuevas. No se evalúan más desde acá; ver getAchievementsCatalog().
 */
import { supabase } from './supabase'
import { getAuthUser } from './auth'
import { unlockAchievementWithToast } from './xp'
import { DAILY_GAMES } from './game-modes'
import { fetchGames, gameRouteForSlug } from './games'
import { getAchievementsCatalog } from './achievements'
import { achievementIcon } from './achievement-icons'
import { evaluateNewAchievements, normalizeSessionRow, NEW_ACHIEVEMENT_CODES } from './achievement-rules'

/**
 * Check first-attempt achievements
 * Call this when user gets correct answer on first try
 */
export async function checkLuckyFirstAchievement() {
  const { id: userId } = getAuthUser() || {}
  if (!userId) return

  try {
    // Count how many times user got it right on first attempt
    const { data, error } = await supabase
      .from('game_sessions')
      .select('metadata')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(200)

    if (error) return

    let firstAttemptCount = 0
    for (const session of (data || [])) {
      const meta = session?.metadata || {}
      if (meta.firstTryCorrect === true || meta.attempts === 1) {
        firstAttemptCount++
      }
    }

    if (firstAttemptCount >= 10) {
      await unlockAchievementWithToast('lucky_first')
    }
  } catch {}
}

/**
 * Check comeback king ("Revancha") achievement.
 * Call after a WIN today: unlocks if the last finished challenge session for
 * this same game yesterday ended in a loss.
 * @param {string} slug - game slug just won
 * @param {boolean} won - whether user won today's game
 */
export async function checkComebackKingAchievement(slug, won) {
  if (!won || !slug) return

  const { id: userId } = getAuthUser() || {}
  if (!userId) return

  try {
    const { data: game } = await supabase
      .from('games')
      .select('id')
      .eq('slug', slug)
      .single()
    if (!game) return

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const yesterdayStart = new Date(todayStart)
    yesterdayStart.setDate(yesterdayStart.getDate() - 1)

    const { data, error } = await supabase
      .from('game_sessions')
      .select('ended_at, metadata')
      .eq('user_id', userId)
      .eq('game_id', game.id)
      .gte('started_at', yesterdayStart.toISOString())
      .lt('started_at', todayStart.toISOString())
      .order('started_at', { ascending: false })
      .limit(5)

    if (error) return

    const lastYesterday = (data || []).find(r => !!r.ended_at && (r?.metadata || {}).mode === 'challenge')
    if (lastYesterday && (lastYesterday.metadata || {}).result === 'loss') {
      await unlockAchievementWithToast('comeback_king')
    }
  } catch {}
}

/**
 * Check perfectionist achievement
 * Call when game ends with no errors
 * @param {boolean} won - whether user won
 * @param {number} errors - total errors in game
 */
export async function checkPerfectionistAchievement(won, errors) {
  if (!won || errors > 0) return
  
  try {
    await unlockAchievementWithToast('perfectionist')
  } catch {}
}

/**
 * Check hat-trick achievement (3 different games same day)
 * Call after completing any challenge
 */
export async function checkHatTrickAchievement() {
  const { id: userId } = getAuthUser() || {}
  if (!userId) return

  try {
    const today = new Date().toISOString().split('T')[0]
    const { data, error } = await supabase
      .from('game_sessions')
      .select('game_id, metadata')
      .eq('user_id', userId)
      .gte('started_at', today + 'T00:00:00Z')
      .contains('metadata', { result: 'win' })

    if (error) return

    // Count unique games won today
    const uniqueGames = new Set()
    for (const session of (data || [])) {
      if (session.game_id) uniqueGames.add(session.game_id)
    }

    if (uniqueGames.size >= 3) {
      await unlockAchievementWithToast('hat_trick')
    }
  } catch {}
}

/**
 * Check grand slam achievement (all games in one week)
 * Call after completing any challenge
 */
export async function checkGrandSlamAchievement() {
  const { id: userId } = getAuthUser() || {}
  if (!userId) return

  try {
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    
    const { data, error } = await supabase
      .from('game_sessions')
      .select('game_id, metadata')
      .eq('user_id', userId)
      .gte('started_at', weekAgo.toISOString())
      .contains('metadata', { result: 'win' })

    if (error) return

    // Count unique games won this week
    const uniqueGames = new Set()
    for (const session of (data || [])) {
      if (session.game_id) uniqueGames.add(session.game_id)
    }

    // Need to win ALL playable games within the week (dynamic: crece con juegos nuevos)
    const { getPlayableGameCount } = await import('./game-modes')
    const totalGames = await getPlayableGameCount()
    if (totalGames > 0 && uniqueGames.size >= totalGames) {
      await unlockAchievementWithToast('grand_slam')
    }
  } catch {}
}

/**
 * Check centurion achievement (100 total wins)
 * Call after completing any challenge with a win
 */
export async function checkCenturionAchievement() {
  const { id: userId } = getAuthUser() || {}
  if (!userId) return

  try {
    const { data, error } = await supabase
      .from('game_sessions')
      .select('id')
      .eq('user_id', userId)
      .contains('metadata', { result: 'win' })

    if (error) return

    const totalWins = (data || []).length

    if (totalWins >= 100) {
      await unlockAchievementWithToast('centurion')
    }
  } catch {}
}

/**
 * Check game-specific master achievements
 * @param {string} slug - game slug
 * @param {boolean} won - whether user won this game
 */
export async function checkGameMasterAchievements(slug, won) {
  if (!won) return
  
  const { id: userId } = getAuthUser() || {}
  if (!userId) return

  try {
    // Get game ID
    const { data: game } = await supabase
      .from('games')
      .select('id')
      .eq('slug', slug)
      .single()

    if (!game) return

    // Count wins for this specific game
    const { data, error } = await supabase
      .from('game_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('game_id', game.id)
      .contains('metadata', { result: 'win' })

    if (error) return

    const wins = (data || []).length

    // Check game-specific achievements
    if (slug === 'guess-player' && wins >= 20) {
      await unlockAchievementWithToast('guess_master')
    }

    // nationality_expert: 50 correct nationalities
    // This one tracks corrects, not just wins
    if (slug === 'nationality') {
      await checkNationalityExpert()
    }

    // position_guru: 50 correct positions
    if (slug === 'player-position') {
      await checkPositionGuru()
    }
  } catch {}
}

/**
 * Check nationality expert (50 correct answers across all sessions)
 */
async function checkNationalityExpert() {
  const { id: userId } = getAuthUser() || {}
  if (!userId) return

  try {
    const { data: game } = await supabase
      .from('games')
      .select('id')
      .eq('slug', 'nationality')
      .single()

    if (!game) return

    const { data, error } = await supabase
      .from('game_sessions')
      .select('metadata')
      .eq('user_id', userId)
      .eq('game_id', game.id)

    if (error) return

    let totalCorrects = 0
    for (const session of (data || [])) {
      const corrects = session?.metadata?.corrects || 0
      totalCorrects += corrects
    }

    if (totalCorrects >= 50) {
      await unlockAchievementWithToast('nationality_expert')
    }
  } catch {}
}

/**
 * Check position guru (50 correct positions)
 */
async function checkPositionGuru() {
  const { id: userId } = getAuthUser() || {}
  if (!userId) return

  try {
    const { data: game } = await supabase
      .from('games')
      .select('id')
      .eq('slug', 'player-position')
      .single()

    if (!game) return

    const { data, error } = await supabase
      .from('game_sessions')
      .select('metadata')
      .eq('user_id', userId)
      .eq('game_id', game.id)

    if (error) return

    let totalCorrects = 0
    for (const session of (data || [])) {
      const corrects = session?.metadata?.corrects || 0
      totalCorrects += corrects
    }

    if (totalCorrects >= 50) {
      await unlockAchievementWithToast('position_guru')
    }
  } catch {}
}

/**
 * Check first win achievement
 * Call when user wins their first daily game ever
 */
export async function checkFirstWinAchievement() {
  const { id: userId } = getAuthUser() || {}
  if (!userId) return

  try {
    const { data, error } = await supabase
      .from('game_sessions')
      .select('id')
      .eq('user_id', userId)
      .contains('metadata', { result: 'win', mode: 'challenge' })
      .limit(1)

    if (error) return

    if ((data || []).length > 0) {
      await unlockAchievementWithToast('first_win')
    }
  } catch {}
}

/**
 * Main checker to call after completing a challenge
 * Checks multiple achievements at once
 */
export async function checkAllAchievementsAfterChallenge(slug, won, metadata = {}) {
  if (!won) return

  try {
    // Check various achievements in parallel
    await Promise.all([
      checkFirstWinAchievement(),
      checkGameMasterAchievements(slug, won),
      checkHatTrickAchievement(),
      checkGrandSlamAchievement(),
      checkCenturionAchievement(),
    ])

    // Check perfectionist if no errors (requiere haber contestado algo)
    const errors = Number(metadata.errors ?? NaN)
    const answered = Number(metadata.attempts ?? metadata.corrects ?? NaN)
    if (Number.isFinite(errors) && errors === 0 && Number.isFinite(answered) && answered > 0) {
      await checkPerfectionistAchievement(won, 0)
    }

    // Comeback ("Revancha"): ganaste hoy un juego que habías perdido ayer
    await checkComebackKingAchievement(slug, won)

    // Check lucky first if first attempt correct
    if (metadata.firstTryCorrect) {
      await checkLuckyFirstAchievement()
    }
  } catch (e) {
    console.error('[check-all-achievements] Error:', e)
  }
}


// ─── Logros nuevos (achievements-new-1) ──────────────────────────────────

// Solo las columnas que las reglas necesitan (la metadata completa trae xpView,
// finalOrder, items… y para un veterano son miles de filas).
const SESSION_SELECT = [
  'id', 'game_id', 'started_at', 'ended_at',
  'result:metadata->result',
  'difficulty:metadata->difficulty',
  'corrects:metadata->corrects',
  'max_streak:metadata->maxStreak',
  'guess_count:metadata->guessCount',
  'base_seconds:metadata->seconds',
  'seconds_used:metadata->secondsUsed',
  'seconds_left:metadata->secondsLeft',
  'basta:metadata->basta',
  'powerups:metadata->powerups',
  'shield_saves:metadata->shieldSaves',
  'tb_left:metadata->timeBonus->secondsLeft',
].join(',')
const SESSION_PAGE = 1000
const SESSION_MAX_PAGES = 5 // 5000 partidas: de sobra para Enciclopedia (1000 correctas)

async function fetchFinishedChallengeSessions(userId) {
  const rows = []
  for (let page = 0; page < SESSION_MAX_PAGES; page++) {
    const { data, error } = await supabase
      .from('game_sessions')
      .select(SESSION_SELECT)
      .eq('user_id', userId)
      .eq('metadata->>mode', 'challenge')
      .not('ended_at', 'is', null)
      .order('started_at', { ascending: false })
      .range(page * SESSION_PAGE, (page + 1) * SESSION_PAGE - 1)
    if (error) throw error
    rows.push(...(data || []))
    if (!data || data.length < SESSION_PAGE) break
  }
  return rows
}

let _gamesCache = null
let _gamesCacheAt = 0
async function getGamesForAchievements() {
  if (_gamesCache && Date.now() - _gamesCacheAt < 5 * 60 * 1000) return _gamesCache
  const games = await fetchGames()
  const slugById = {}
  const active = new Set()
  for (const g of games || []) {
    if (g?.id && g?.slug) slugById[g.id] = g.slug
    // Solo juegos reales (con ruta propia): descarta filas viejas de la tabla games.
    if (g?.slug && gameRouteForSlug(g.slug) !== '/games') active.add(g.slug)
  }
  _gamesCache = { slugById, activeSlugs: [...active] }
  _gamesCacheAt = Date.now()
  return _gamesCache
}

/**
 * Evalúa los 23 logros nuevos y desbloquea los que se cumplen.
 * Todo se calcula desde game_sessions / user_daily_claims en Supabase (no desde el navegador).
 * Las escenas grandes las limita la cola de AchievementUnlockOverlay (máx. 2 por tanda;
 * el resto se agrupa) — acá desbloqueamos todos juntos, de mayor a menor rareza, para
 * que lleguen en la misma tanda.
 * @param {string|null} slug  juego que se acaba de terminar (null = sin partida, ej. sobre del día)
 * @param {{packsOpened?: number}} [opts]
 */
export async function checkNewAchievements(slug = null, { packsOpened = null } = {}) {
  const { id: userId } = getAuthUser() || {}
  if (!userId) return []

  try {
    const catalog = await getAchievementsCatalog()
    // Si el SQL todavía no se corrió, los códigos no están en el catálogo: no hacer nada.
    if (!NEW_ACHIEVEMENT_CODES.some(c => catalog[c])) return []

    let sessions = []
    let activeSlugs = []
    let currentId = null
    if (slug) {
      const { slugById, activeSlugs: act } = await getGamesForAchievements()
      activeSlugs = act
      const rows = await fetchFinishedChallengeSessions(userId)
      sessions = rows.map(r => normalizeSessionRow(r, slugById))
      // La sesión que acaba de terminar = la última de ese juego.
      const last = sessions.filter(s => s.slug === slug).sort((a, b) => b.endedAt - a.endedAt)[0]
      currentId = last?.id || null
    }

    const hits = evaluateNewAchievements({ sessions, activeSlugs, currentId, packsOpened })
    if (!hits.length) return []

    const { data: ownedRows } = await supabase
      .from('user_achievements')
      .select('achievements!inner(code)')
      .eq('user_id', userId)
    const owned = new Set((ownedRows || []).map(r => r?.achievements?.code).filter(Boolean))

    const RANK = { common: 0, rare: 1, epic: 2, legendary: 3 }
    const fresh = hits
      .filter(h => catalog[h.code] && !owned.has(h.code))
      .sort((a, b) => RANK[achievementIcon(b.code).rarity] - RANK[achievementIcon(a.code).rarity])
    await Promise.all(fresh.map(h => unlockAchievementWithToast(h.code, h.meta)))
    return fresh.map(h => h.code)
  } catch (e) {
    console.warn('[check-new-achievements]', e?.message || e)
    return []
  }
}

/** Coleccionista: 7 sobres del día abiertos (user_daily_claims kind='daily', 1 por día). */
export async function checkCollectorAchievement() {
  const { id: userId } = getAuthUser() || {}
  if (!userId) return
  try {
    const { count, error } = await supabase
      .from('user_daily_claims')
      .select('day', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('kind', 'daily')
    if (error) return
    await checkNewAchievements(null, { packsOpened: count ?? 0 })
  } catch {}
}
