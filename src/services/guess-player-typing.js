import { getAllPlayers } from './players'
import { spawnXpBadge } from './ui-effects'
import { onCorrect } from './scoring'
import { awardXpForCorrect } from './game-xp'
import { flagUrl, countryCodeFromName } from './countries'
import { celebrateCorrect } from './game-celebrations'
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

export function loadPlayers(state) {
  state.allPlayers = getAllPlayers()
  const by = { GK: [], DF: [], MF: [], FW: [] }
  for (const p of state.allPlayers) {
    if (typeof p.positionId === 'number') {
      if (p.positionId === 0) by.GK.push(p)
      else if (p.positionId === 1) by.DF.push(p)
      else if (p.positionId === 2) by.MF.push(p)
      else if (p.positionId === 3) by.FW.push(p)
      else by.MF.push(p)
      continue
    }
    const pos = (p.position || '').toUpperCase()
    const tokens = pos.split(',').map(t => t.trim())
    const isDF = tokens.some(t => ['CB','LB','RB','LWB','RWB','WB','DEF','DF'].includes(t))
    const isMF = tokens.some(t => ['CM','CDM','CAM','RM','LM','MID','MF'].includes(t))
    const isFW = tokens.some(t => ['ST','CF','LW','RW','FW','ATT','FWD'].includes(t))
    if (pos.includes('GK')) by.GK.push(p)
    else if (isFW) by.FW.push(p)
    else if (isMF) by.MF.push(p)
    else if (isDF) by.DF.push(p)
    else by.MF.push(p)
  }
  state.byPos = by
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

export function broadPos(p) {
  if (typeof p?.positionId === 'number') {
    return p.positionId === 0 ? 'GK' : p.positionId === 1 ? 'DF' : p.positionId === 2 ? 'MF' : 'FW'
  }
  const pos = (p?.position || '').toUpperCase()
  if (pos.includes('GK')) return 'GK'
  const tokens = pos.split(',').map(t => t.trim())
  if (tokens.some(t => ['ST','CF','LW','RW','FW','ATT','FWD'].includes(t))) return 'FW'
  if (tokens.some(t => ['CM','CDM','CAM','RM','LM','MID','MF'].includes(t))) return 'MF'
  if (tokens.some(t => ['CB','LB','RB','LWB','RWB','WB','DEF','DF'].includes(t))) return 'DF'
  return 'MF'
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

export function nextRound(state) {
  if (!state.allPlayers.length) return
  const order = state.posOrder
  state.current = null
  for (let k = 0; k < order.length; k++) {
    const bucket = order[state.posIndex % order.length]
    const arr = state.byPos[bucket] || []
    state.posIndex = (state.posIndex + 1) % order.length
    if (arr.length) {
      for (let tries = 0; tries < 5; tries++) {
        const idx = Math.floor(Math.random() * arr.length)
        const candidate = arr[idx]
        if (broadPos(candidate) === bucket) { state.current = candidate; break }
      }
      if (!state.current) {
        const idx = Math.floor(Math.random() * arr.length)
        state.current = arr[idx]
      }
      break
    }
  }
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
      await awardXpForCorrect({ gameCode: 'who-is', amount: 100, attemptIndex: state.attempts, streak: nextStreak, corrects: state.corrects + 1 })
      state.xpEarned += 100
    }
    onCorrect(state)
    state.streak = nextStreak
    state.maxStreak = Math.max(state.maxStreak || 0, nextStreak)
    
    // 🎉 Celebrate correct answer
    celebrateCorrect()
    
    if (state.allowXp) { spawnXpBadge(confettiHost, '+100 XP', { position: 'top-right' }) }
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
