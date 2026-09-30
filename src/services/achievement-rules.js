/**
 * REGLAS DE LOGROS NUEVOS (achievements-new-1) — módulo PURO.
 *
 * No toca Supabase ni el navegador: recibe las sesiones terminadas del usuario
 * (ya leídas de `game_sessions`) y devuelve qué logros se cumplen. Lo llama
 * `checkNewAchievements()` en achievement-triggers.js, que es quien lee la base
 * y desbloquea por RPC. Al ser puro se prueba con sesiones sintéticas
 * (scripts/test-achievement-rules.mjs).
 *
 * DATOS QUE LEE DE CADA SESIÓN (metadata en game_sessions):
 *   result        'win' | 'loss'
 *   difficulty    'easy' | 'normal' | 'hard'   (se guarda desde achievements-new-1)
 *   corrects      respuestas correctas de la sesión
 *   maxStreak     mejor racha de aciertos seguidos dentro de la sesión
 *   guessCount    intentos usados (Adiviná el Crack)
 *   seconds       reloj elegido al empezar (base, sin +15 s)
 *   secondsUsed / secondsLeft / basta / powerups / shieldSaves
 *                 los guarda mixins/timedChallenge.js al terminar (contrarreloj)
 *   secondsLeft   también lo guarda Once Ideal
 * Las sesiones anteriores a achievements-new-1 no traen difficulty/powerups/etc.:
 * simplemente no cuentan para las reglas que los necesitan (nunca se inventan).
 *
 * DÍAS: se agrupan por día calendario de Argentina (UTC-3 fijo, sin horario de
 * verano), igual que app_today() en el servidor. "N días seguidos" = días
 * calendario consecutivos, sin saltear ninguno.
 */

// Juegos con reloj compartido y ¡Basta! (mixins/timedChallenge.js). Son los que
// la app rotula "Contrarreloj" (GAME_TYPES.TIMED en services/games.js).
export const CLOCK_GAMES = ['guess-player', 'nationality', 'player-position', 'shirt-number', 'stat-challenge']

// Cuántas partidas TERMINADAS tiene que tener la cuenta ANTES de la que se evalúa.
// Con 1, ninguno de estos logros se puede desbloquear en la primera partida de
// una cuenta nueva.
export const MIN_PRIOR_GAMES = 1

// XP por rareza (points en la tabla achievements).
export const XP_BY_RARITY = { common: 15, rare: 35, epic: 80, legendary: 180 }

export const NEW_ACHIEVEMENT_CODES = [
  'tiempo_descuento', 'ni_la_mitad', 'relampago', 'salvado_escudo', 'ascenso',
  'ojo_halcon', 'cadena_oro', 'scout', 'once_gala',
  'trotamundos', 'todoterreno', 'coleccionista',
  'semana_primera', 'relojero', 'especialista', 'doble_jornada',
  'invicto', 'invicto_temporada', 'sin_red', 'jornada_primera',
  'fuego_azul', 'cazador_cracks', 'enciclopedia',
]

const ART_OFFSET_MS = 3 * 3600 * 1000
const DAY_MS = 86400000

/** 'YYYY-MM-DD' del día calendario argentino de un instante. */
export function artDay(ms) {
  return new Date(ms - ART_OFFSET_MS).toISOString().slice(0, 10)
}

function dayNumber(day) { return Math.floor(Date.parse(day + 'T00:00:00Z') / DAY_MS) }

function num(v) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * Fila cruda de game_sessions (con los alias de fetchSessionsForAchievements)
 * → sesión normalizada. `slugById` traduce game_id → slug.
 */
export function normalizeSessionRow(row, slugById) {
  const startedAt = Date.parse(row.started_at)
  const endedAt = row.ended_at ? Date.parse(row.ended_at) : startedAt
  const tbLeft = num(row.tb_left)
  const secondsLeft = num(row.seconds_left) ?? tbLeft
  return {
    id: row.id,
    slug: slugById[row.game_id] || null,
    startedAt,
    endedAt,
    day: artDay(startedAt),
    result: row.result === 'win' || row.result === 'loss' ? row.result : null,
    difficulty: typeof row.difficulty === 'string' ? row.difficulty : null,
    corrects: num(row.corrects),
    maxStreak: num(row.max_streak),
    guessCount: num(row.guess_count),
    baseSeconds: num(row.base_seconds),
    secondsUsed: num(row.seconds_used),
    secondsLeft,
    // ¡Basta!: flag nuevo, o (sesiones recientes) rastro del bonus de tiempo.
    basta: row.basta === true || tbLeft !== null,
    powerups: num(row.powerups),
    shieldSaves: num(row.shield_saves) ?? 0,
  }
}

const isWin = (s) => s.result === 'win'
const isHard = (s) => s.difficulty === 'hard'
const isClock = (s) => CLOCK_GAMES.includes(s.slug)

/** Largo de la racha más larga de días calendario consecutivos dentro de un set de días. */
export function longestDayRun(days) {
  const nums = [...new Set(days)].map(dayNumber).sort((a, b) => a - b)
  let best = 0
  let cur = 0
  let prev = null
  for (const n of nums) {
    cur = prev !== null && n === prev + 1 ? cur + 1 : 1
    if (cur > best) best = cur
    prev = n
  }
  return best
}

/** Racha más larga de sesiones consecutivas que cumplen `ok` (cualquier otra la corta). */
function longestRun(list, ok) {
  let best = 0
  let cur = 0
  for (const s of list) {
    if (ok(s)) { cur += 1; if (cur > best) best = cur } else cur = 0
  }
  return best
}

/** Días en los que TODOS los juegos activos tienen una sesión que cumple `ok`. */
function daysCoveringAllGames(sessions, activeSlugs, ok) {
  if (!activeSlugs.length) return []
  const byDay = new Map()
  for (const s of sessions) {
    if (!s.slug || !ok(s)) continue
    if (!byDay.has(s.day)) byDay.set(s.day, new Set())
    byDay.get(s.day).add(s.slug)
  }
  return [...byDay.entries()].filter(([, set]) => activeSlugs.every(g => set.has(g))).map(([d]) => d)
}

/**
 * @param {object}  p
 * @param {Array}   p.sessions      sesiones TERMINADAS de modo desafío (normalizadas)
 * @param {string[]} p.activeSlugs  slugs de los juegos activos
 * @param {string}  [p.currentId]   sesión recién terminada (para los logros "de una partida")
 * @param {number}  [p.packsOpened] sobres del día abiertos (solo lo manda el reclamo del sobre)
 * @returns {{code:string, meta:object}[]} logros cuya condición se cumple (el que llama
 *   descarta los que el usuario ya tiene)
 */
export function evaluateNewAchievements({ sessions, activeSlugs = [], currentId = null, packsOpened = null }) {
  const out = []
  const push = (code, meta = {}) => out.push({ code, meta })

  // Coleccionista no depende de partidas: se evalúa aparte, sin la guarda de primera partida.
  if (packsOpened !== null && packsOpened >= 7) push('coleccionista', { packs: packsOpened })

  const list = [...sessions].sort((a, b) => a.endedAt - b.endedAt || a.startedAt - b.startedAt)
  // Nunca en la primera partida de una cuenta nueva.
  if (list.length <= MIN_PRIOR_GAMES) return out

  const wins = list.filter(isWin)

  // ─── Una sola partida (la que acaba de terminar) ───────────
  const idx = currentId ? list.findIndex(s => s.id === currentId) : -1
  const cur = idx >= MIN_PRIOR_GAMES ? list[idx] : null
  if (cur && isWin(cur)) {
    const game = cur.slug
    if (isClock(cur) && cur.basta) {
      const left = cur.secondsLeft
      const base = cur.baseSeconds
      const used = cur.secondsUsed
      // Tiempo de descuento: el último acierto cae en los últimos 3 s del reloj.
      if (left !== null && left <= 3) push('tiempo_descuento', { game, secondsLeft: left })
      if (base && used !== null) {
        // Ni la mitad: usó menos de la mitad del reloj elegido.
        if (used < base / 2) push('ni_la_mitad', { game, secondsUsed: used, base })
        // Relámpago: Difícil y le sobró el 40 % o más del reloj elegido.
        if (isHard(cur) && base - used >= base * 0.4) push('relampago', { game, secondsUsed: used, base })
      }
    }
    if (isClock(cur) && cur.shieldSaves >= 1) push('salvado_escudo', { game })
    if (game === 'football-wordle' && cur.guessCount !== null && cur.guessCount >= 1 && cur.guessCount <= 3) {
      push('ojo_halcon', { game, guesses: cur.guessCount })
    }
    if (game === 'higher-or-lower') push('cadena_oro', { game })
    // Scout: 10 cromos seguidos sin error (un error tapado por el escudo también cuenta como error).
    if (game === 'stat-challenge' && (cur.maxStreak ?? 0) >= 10 && cur.shieldSaves === 0) push('scout', { game })
    if (game === 'once-ideal' && cur.secondsLeft !== null && cur.secondsLeft > 60) {
      push('once_gala', { game, secondsLeft: cur.secondsLeft })
    }
  }

  // ─── Colección ─────────────────────────────────────────────
  if (new Set(wins.map(s => s.slug).filter(Boolean)).size >= 7) push('trotamundos')
  if (activeSlugs.length && activeSlugs.every(g => wins.some(s => s.slug === g))) push('todoterreno')
  if (CLOCK_GAMES.every(g => wins.some(s => s.slug === g && isHard(s)))) push('ascenso')

  // ─── Varios días ───────────────────────────────────────────
  if (longestDayRun(wins.filter(isHard).map(s => s.day)) >= 7) push('semana_primera')
  if (longestDayRun(wins.filter(s => isClock(s) && s.basta).map(s => s.day)) >= 3) push('relojero')
  const winDaysBySlug = new Map()
  for (const s of wins) {
    if (!s.slug) continue
    if (!winDaysBySlug.has(s.slug)) winDaysBySlug.set(s.slug, [])
    winDaysBySlug.get(s.slug).push(s.day)
  }
  for (const days of winDaysBySlug.values()) {
    if (longestDayRun(days) >= 14) { push('especialista'); break }
  }
  if (longestDayRun(daysCoveringAllGames(list, activeSlugs, isWin)) >= 2) push('doble_jornada')

  // ─── Sostener el nivel ─────────────────────────────────────
  // Solo cuentan las partidas con resultado; una derrota corta la racha.
  const decided = list.filter(s => s.result)
  const invictoRun = longestRun(decided, isWin)
  if (invictoRun >= 10) push('invicto', { run: invictoRun })
  if (invictoRun >= 30) push('invicto_temporada', { run: invictoRun })
  const sinRedRun = longestRun(list.filter(isClock), s => isWin(s) && isHard(s) && s.powerups === 0)
  if (sinRedRun >= 5) push('sin_red', { run: sinRedRun })
  if (daysCoveringAllGames(list, activeSlugs, s => isWin(s) && isHard(s)).length > 0) push('jornada_primera')

  // ─── Hazañas repetidas ─────────────────────────────────────
  const blueByDay = new Map()
  for (const s of list) {
    if (!s.slug || (s.maxStreak ?? 0) < 10) continue
    if (!blueByDay.has(s.day)) blueByDay.set(s.day, new Set())
    blueByDay.get(s.day).add(s.slug)
  }
  if ([...blueByDay.values()].some(set => set.size >= 3)) push('fuego_azul')
  const hawkDays = new Set(wins.filter(s => s.slug === 'football-wordle' && s.guessCount !== null && s.guessCount >= 1 && s.guessCount <= 3).map(s => s.day))
  if (hawkDays.size >= 5) push('cazador_cracks', { days: hawkDays.size })
  const totalCorrects = list.reduce((sum, s) => sum + (s.corrects ?? 0), 0)
  if (totalCorrects >= 1000) push('enciclopedia', { corrects: totalCorrects })

  return out
}
