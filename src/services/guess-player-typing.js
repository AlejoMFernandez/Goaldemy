import { onCorrect } from './scoring'
import { flagUrl, countryCodeFromName } from './countries'
import { loadAndClassifyPlayersAsync, getBroadPosition, selectRandomPlayerFromBucket } from './game-common'
import countryMap from '../codeCOUNTRYS.json'

export function initState() {
  return {
    allPlayers: [], // pool elegible como TARGET (fame 1-2, ver difficulty.js)
    byPos: {},
    posOrder: ['FW', 'MF', 'DF', 'GK'],
    posIndex: 0,
    current: null,
    // ficha (moodboard 09, sección 01)
    lives: 3,
    maxLives: 3,
    tried: [], // jugadores ya probados esta ronda (se tachan abajo)
    hintsShown: [], // 'age' | 'shirt', en orden de aparición
    answered: false,
    lit: false, // silueta iluminada (acierto o derrota)
    lost: false,
    score: 0,
    attempts: 0,
    streak: 0,
    roundKey: 0,
    loading: true,
    allowXp: true,
    xpEarned: 0,
  }
}

/** Carga jugadores y los clasifica por posición amplia (pool = target elegible). */
export async function loadPlayers(state) {
  await loadAndClassifyPlayersAsync(state)
}

export function broadPos(p) { return getBroadPosition(p) }

const POS_ES = { GK: 'ARQ', DF: 'DEF', MF: 'MED', FW: 'DEL' }
export function posLabel(p) { return POS_ES[broadPos(p)] || 'MED' }

export function countryFlag(p, width = 32) {
  const raw = (p?.ccode || '').toString().toLowerCase()
  const validCode = raw && Object.prototype.hasOwnProperty.call(countryMap, raw) ? raw : null
  const code = validCode || countryCodeFromName(p?.cname)
  return flagUrl(code, width)
}
export function teamLogo(p) { return p?.teamLogo || null }

/** Selecciona el próximo jugador a adivinar (rotando entre posiciones). */
export function nextRound(state) {
  if (!state.allPlayers.length) return
  state.current = selectRandomPlayerFromBucket(state)
  if (!state.current) {
    const rand = state.rng || Math.random
    const idx = Math.floor(rand() * state.allPlayers.length)
    state.current = state.allPlayers[idx]
  }
  state.lives = state.maxLives || 3
  state.tried = []
  state.hintsShown = []
  state.answered = false
  state.lit = false
  state.lost = false
  state.roundKey += 1
}

/**
 * Recibe el jugador elegido en el buscador (PlayerSearch busca entre TODOS
 * los jugadores, incluido fame 3 — cualquiera puede probarse). Devuelve
 * true si acertó.
 */
export function submitGuess(state, player) {
  if (state.answered || !player || !state.current) return false
  if (player.id === state.current.id) {
    state.answered = true
    state.lit = true
    const nextStreak = state.streak + 1
    if (state.allowXp) {
      const xpAmount = state.difficultyConfig?.xpPerCorrect || 100
      state.xpEarned += xpAmount
      state._lastXpGained = xpAmount
    }
    onCorrect(state)
    state.streak = nextStreak
    state.maxStreak = Math.max(state.maxStreak || 0, nextStreak)
    return true
  }
  if (!state.tried.some((t) => t.id === player.id)) state.tried.push(player)
  state.lives = Math.max(0, state.lives - 1)
  // Primer error → pista de edad; segundo error → pista de dorsal (moodboard 09).
  if (state.lives === 2 && !state.hintsShown.includes('age')) state.hintsShown.push('age')
  else if (state.lives === 1 && !state.hintsShown.includes('shirt')) state.hintsShown.push('shirt')
  if (state.lives <= 0) {
    state.answered = true
    state.lit = true
    state.lost = true
    state.streak = 0
    state.attempts += 1
  }
  return false
}
