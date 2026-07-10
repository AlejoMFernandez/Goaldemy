/**
 * RETO DEL DÍA (funnel público, sin login)
 *
 * Motor del "Reto del día" que se juega en /reto SIN cuenta. Objetivo de marketing:
 * un link único y compartible (modelo Wordle) que los streamers puedan mostrar en vivo
 * y que su chat juegue desde el celular sin registrarse.
 *
 * CLAVE: el reto es DETERMINÍSTICO por fecha → todos los que juegan el mismo día ven
 * exactamente el mismo reto (mismo juego rotado + mismas preguntas). Eso habilita el
 * efecto social ("¿cuánto sacaste hoy?"). La semilla es la fecha local (YYYY-MM-DD).
 *
 * El resultado del día se guarda en localStorage (1 intento por día, como en los juegos
 * logueados). No toca la tabla game_sessions ni requiere auth.
 */
import { getAllPlayers, initializePlayers } from './players'
import { getBroadPosition } from './game-common'

const LS_KEY = 'goaldemy_reto_v1'

// Posiciones amplias en español (mismo criterio que el juego "Posición")
const POS_LABEL = { GK: 'Arquero', DF: 'Defensor', MF: 'Mediocampista', FW: 'Delantero' }

// Juegos que rotan en el reto. Comparten la mecánica MCQ genérica ("mostramos un
// jugador → elegí el atributo correcto"), pero cada uno define cómo resolver el valor
// correcto y, si corresponde, un set fijo de opciones.
// - resolve(player): valor correcto (string) para ese jugador
// - fixedOptions: si existe, las opciones son siempre estas (ej: las 4 posiciones)
const RETO_POOL = [
  {
    slug: 'nationality', label: 'Nacionalidad', prompt: '¿De qué nacionalidad es?',
    resolve: p => p.cname || null,
  },
  {
    slug: 'player-position', label: 'Posición', prompt: '¿En qué posición juega?',
    resolve: p => POS_LABEL[getBroadPosition(p)] || null,
    fixedOptions: Object.values(POS_LABEL),
  },
  {
    slug: 'shirt-number', label: 'Dorsal', prompt: '¿Qué dorsal usa?',
    resolve: p => (p.shirtNumber != null ? String(p.shirtNumber) : null),
  },
]

const QUESTIONS_PER_RETO = 10
const OPTIONS_PER_QUESTION = 4

// --- Utilidades de aleatoriedad sembrada (determinística por día) ------------
function xmur3(str) {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return (h ^= h >>> 16) >>> 0
  }
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function shuffle(arr, rng) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Clave del día en horario local (YYYY-MM-DD). */
export function todayKey() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// --- Persistencia local (1 intento por día) ----------------------------------
export function getRetoResult(dayKey = todayKey()) {
  try {
    const all = JSON.parse(localStorage.getItem(LS_KEY) || '{}')
    return all[dayKey] || null
  } catch { return null }
}
export function saveRetoResult(res, dayKey = todayKey()) {
  try {
    const all = JSON.parse(localStorage.getItem(LS_KEY) || '{}')
    all[dayKey] = { ...res, at: Date.now() }
    localStorage.setItem(LS_KEY, JSON.stringify(all))
  } catch {}
}

/**
 * Genera (determinísticamente) el reto de hoy: qué juego toca y sus 10 preguntas.
 * @returns {Promise<{dayKey, game, questions, total}>}
 */
export async function getTodaysReto() {
  const dayKey = todayKey()
  const seed = xmur3(dayKey)
  const rng = mulberry32(seed())

  // Data estática (sin auth), independiente de la dificultad del usuario → mismo pool para todos.
  await initializePlayers()
  const players = getAllPlayers()

  // Elegir el juego del día (rotación determinística)
  const game = RETO_POOL[Math.floor(rng() * RETO_POOL.length)]

  // Jugadores cuyo valor correcto se puede resolver, mezclados de forma sembrada
  const valid = shuffle(
    players.map(p => ({ p, v: game.resolve(p) })).filter(x => x.v != null && x.v !== ''),
    rng,
  )
  const chosen = valid.slice(0, QUESTIONS_PER_RETO)

  const questions = chosen.map(({ p, v: correct }) => {
    let options
    if (game.fixedOptions) {
      options = shuffle(game.fixedOptions, rng)
    } else {
      // Distractores: valores DISTINTOS al correcto y entre sí (deduplicados)
      const seen = new Set([correct])
      const distractors = []
      for (const x of valid) {
        if (distractors.length >= OPTIONS_PER_QUESTION - 1) break
        if (!seen.has(x.v)) { seen.add(x.v); distractors.push(x.v) }
      }
      options = shuffle([correct, ...distractors], rng)
    }
    return {
      player: { id: p.id, name: p.name, image: p.image, teamName: p.teamName },
      correct,
      options,
    }
  })

  return { dayKey, game, questions, total: questions.length }
}

/** Nombre para mostrar/compartir del reto. */
export const RETO_SHARE_NAME = 'Reto del día'

/**
 * Recompensas "que ganó" el invitado con su resultado. Son las que se le muestran en
 * la pantalla final para tentarlo, pero que SOLO puede reclamar creando una cuenta.
 * Modelo simple y motivador: 10 XP por acierto (+50 bonus si es perfecto), Fichas
 * (moneda blanda) proporcionales, y un teaser de nivel donde un reto perfecto "sube"
 * al Nivel 2 (150 XP).
 */
export function computeRetoRewards(corrects = 0, total = 0) {
  const perfect = total > 0 && corrects >= total
  const xp = corrects * 10 + (perfect ? 50 : 0)
  const fichas = corrects * 4 + (perfect ? 20 : 0)
  const xpForLevel2 = 150
  const pct = Math.min(100, Math.round((xp / xpForLevel2) * 100))
  const levelUp = xp >= xpForLevel2
  const remaining = Math.max(0, xpForLevel2 - xp)
  return { xp, fichas, perfect, xpForLevel2, pct, levelUp, remaining }
}

// --- Reclamo REAL al crear cuenta (cierra el loop del funnel) -----------------
const PENDING_KEY = 'goaldemy_reto_pending'

/** Guarda un reclamo pendiente (el invitado terminó el reto). Se otorga al loguearse. */
export function setPendingRetoClaim(corrects, total) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify({
      dayKey: todayKey(), corrects, total, at: Date.now(),
    }))
  } catch {}
}

export function getPendingRetoClaim() {
  try { return JSON.parse(localStorage.getItem(PENDING_KEY) || 'null') } catch { return null }
}

export function clearPendingRetoClaim() {
  try { localStorage.removeItem(PENDING_KEY) } catch {}
}

/**
 * Si hay un reclamo pendiente y el usuario ya está logueado + verificado, lo reclama
 * DE VERDAD vía la RPC claim_reto_reward (otorga XP + Fichas server-side, 1 vez/día).
 * Muestra un toast de confirmación y dispara el overlay de level-up si corresponde.
 * Se llama al arrancar la app (App.vue) tras authReady.
 * @returns {Promise<{xp:number, fichas:number}|null>}
 */
export async function claimPendingRetoReward() {
  const pending = getPendingRetoClaim()
  if (!pending) return null
  try {
    const { getAuthUser } = await import('./auth')
    const user = getAuthUser()
    // Esperar a estar logueado y con email confirmado (el alta exige verificación)
    if (!user?.id || !user?.email_confirmed_at) return null

    const { supabase } = await import('./supabase')
    const { data, error } = await supabase.rpc('claim_reto_reward', {
      p_corrects: pending.corrects,
      p_total: pending.total,
      p_day_key: pending.dayKey,
    })
    if (error) { console.warn('[reto] claim error:', error.message); return null }

    // Éxito o 'already_claimed': limpiamos igual para no reintentar en loop
    clearPendingRetoClaim()
    if (!data?.ok) return null

    if (data.xp || data.fichas) {
      try {
        const { pushInfoToast } = await import('../stores/notifications')
        pushInfoToast(`🎁 ¡Reclamaste +${data.xp} XP y ${data.fichas} Fichas del Reto del día!`)
      } catch {}
      // Si la XP otorgada disparó un level-up, mostrar el overlay
      try {
        const { detectAndToastLevelUp } = await import('./xp')
        await detectAndToastLevelUp()
      } catch {}
    }
    return { xp: data.xp, fichas: data.fichas }
  } catch (e) {
    console.warn('[reto] claim exception:', e?.message || e)
    return null
  }
}
