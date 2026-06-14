import { spawnXpBadge } from './ui-effects'
import { onCorrect } from './scoring'
import { flagUrl, countryCodeFromName } from './countries'
import { celebrateCorrect, celebrateIncorrect } from './game-celebrations'
import { loadAndClassifyPlayers, loadAndClassifyPlayersAsync, getBroadPosition, selectRandomPlayerFromBucket } from './game-common'
import countryMap from '../codeCOUNTRYS.json'

export function initState() {
  return {
    allPlayers: [],
    byPos: {},
    posOrder: ['FW','MF','DF','GK'],
    posIndex: 0,
    current: null,
    // typing game state
    guess: '',
    minGuessLen: 3,
    lives: 3,
    answered: false,
    feedback: null,
    // scoring fields will merge from initScoring() in component
    score: 0,
    attempts: 0,
    streak: 0,
    roundKey: 0,
    loading: true,
    // modes
    allowXp: true,
    xpEarned: 0,
  }
}

/**
 * Carga jugadores y los clasifica por posición amplia
 */
export async function loadPlayers(state) {
  await loadAndClassifyPlayersAsync(state)
}

function normalize(s) {
  return (s || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
}

/**
 * Retorna posición amplia del jugador (GK, DF, MF, FW)
 */
export function broadPos(p) {
  return getBroadPosition(p)
}

export function posLabel(p) { return broadPos(p) }
export function countryFlag(p, width = 32) {
  // Prefer validated code from codeCOUNTRYS.json; fallback to mapping by name
  const raw = (p?.ccode || '').toString().toLowerCase()
  const validCode = raw && Object.prototype.hasOwnProperty.call(countryMap, raw) ? raw : null
  const code = validCode || countryCodeFromName(p?.cname)
  return flagUrl(code, width)
}
export function teamLogo(p) { return p?.teamLogo || null }
// Progressive reveal: strong blur until hints reduce it
export function blurForLives(lives) { return lives >= 3 ? 14 : lives === 2 ? 9 : lives === 1 ? 5 : 0 }

/**
 * Selecciona siguiente jugador rotando entre posiciones
 */
export function nextRound(state) {
  if (!state.allPlayers.length) return
  
  state.current = selectRandomPlayerFromBucket(state)
  
  // Si no hay jugador en buckets, tomar aleatorio
  if (!state.current) {
    const rand = state.rng || Math.random
    const idx = Math.floor(rand() * state.allPlayers.length)
    state.current = state.allPlayers[idx]
  }
  
  state.lives = 3
  state.guess = ''
  state.answered = false
  state.feedback = null
  state.roundKey += 1
}

export function submitGuess(state, confettiHost) {
  if (state.answered) return false
  const val = normalize(state.guess)
  if (!val || val.length < state.minGuessLen) return false
  const target = normalize(state.current?.name)
  const correct = target.includes(val) || val.includes(target)
  if (correct) {
    state.answered = true
    const nextStreak = state.streak + 1
    if (state.allowXp) {
      const xpAmount = state.difficultyConfig?.xpPerCorrect || 100
      state.xpEarned += xpAmount
      spawnXpBadge(confettiHost, `+${xpAmount} XP`, { position: 'top-right' })
    }
    onCorrect(state)
    state.streak = nextStreak
    state.maxStreak = Math.max(state.maxStreak || 0, nextStreak)
    celebrateCorrect()
    state.feedback = ''
    return true
  } else {
    celebrateIncorrect()
    state.lives = Math.max(0, state.lives - 1)
    if (state.lives === 0) {
      state.answered = true
      state.streak = 0
      state.attempts += 1
    }
    return false
  }
}
