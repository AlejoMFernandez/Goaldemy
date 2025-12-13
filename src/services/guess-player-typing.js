import { spawnXpBadge } from './ui-effects'
import { onCorrect } from './scoring'
import { awardXpForCorrect } from './game-xp'
import { flagUrl, countryCodeFromName } from './countries'
import { celebrateCorrect } from './game-celebrations'
import { loadAndClassifyPlayers, getBroadPosition, selectRandomPlayerFromBucket } from './game-common'
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
export function loadPlayers(state) {
  const { allPlayers, byPos } = loadAndClassifyPlayers(state)
  state.allPlayers = allPlayers
  state.byPos = byPos
  state.loading = false
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
// Slightly stronger blur so it's noticeable on mobile devices too
export function blurForLives(lives) { return lives >= 3 ? 14 : lives === 2 ? 9 : lives === 1 ? 5 : 0 }

/**
 * Selecciona siguiente jugador rotando entre posiciones
 */
export function nextRound(state) {
  if (!state.allPlayers.length) return
  
  state.current = selectRandomPlayerFromBucket(state.byPos, state.posOrder, state.posIndex)
  state.posIndex = (state.posIndex + 1) % state.posOrder.length
  
  // Si no hay jugador en buckets, tomar aleatorio
  if (!state.current) {
    const idx = Math.floor(Math.random() * state.allPlayers.length)
    state.current = state.allPlayers[idx]
  }
  
  state.lives = 3
  state.guess = ''
  state.answered = false
  state.feedback = null
  state.roundKey += 1
}

export async function submitGuess(state, confettiHost) {
  if (state.answered) return false
  const val = normalize(state.guess)
  if (!val || val.length < state.minGuessLen) return false
  const target = normalize(state.current?.name)
  const correct = target.includes(val)
  if (correct) {
    state.answered = true
    const nextStreak = state.streak + 1
    if (state.allowXp) {
      const xpAmount = state.difficultyConfig?.xpPerCorrect || 100
      await awardXpForCorrect({ gameCode: 'who-is', amount: xpAmount, attemptIndex: state.attempts, streak: nextStreak, corrects: state.corrects + 1 })
      state.xpEarned += xpAmount
    }
    onCorrect(state)
    state.streak = nextStreak
    state.maxStreak = Math.max(state.maxStreak || 0, nextStreak)
    
    // 🎉 Celebrate correct answer
    celebrateCorrect()
    
    if (state.allowXp) { 
      const xpAmount = state.difficultyConfig?.xpPerCorrect || 100
      spawnXpBadge(confettiHost, `+${xpAmount} XP`, { position: 'top-right' }) 
    }
    state.feedback = ''
    return true
  } else {
    state.lives = Math.max(0, state.lives - 1)
    if (state.lives === 0) {
      state.answered = true
      state.streak = 0
      // Count this round as an attempt (lost round)
      state.attempts += 1
    }
    return false
  }
}
