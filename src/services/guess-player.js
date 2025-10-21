import { getAllPlayers } from './players'
import { spawnXpBadge } from './ui-effects'
import { onCorrect, onIncorrect } from './scoring'
import { awardXpForCorrect } from './game-xp'
import { flagUrl } from './countries'

export function initState() {
  return {
    allPlayers: [],
    byPos: {},
    posOrder: ['FW','MF','DF','GK'],
    posIndex: 0,
    current: null,
    options: [],
    answered: false,
    selected: null,
    feedback: null,
      // typing game state
      guess: '',
      minGuessLen: 3,
      lives: 3,
      answered: false,
      feedback: null,
    loading: true,
  }
}

export function loadPlayers(state) {
  state.allPlayers = getAllPlayers()
  // Group players by broad position to avoid bias (ensure variety)
  const by = { GK: [], DF: [], MF: [], FW: [] }
  for (const p of state.allPlayers) {
    // Prefer numeric positionId when available (0 GK, 1 DF, 2 MF, 3 FW)
    if (typeof p.positionId === 'number') {
      if (p.positionId === 0) by.GK.push(p)
      else if (p.positionId === 1) by.DF.push(p)
      // Prefer numeric positionId when available (0 GK, 1 DF, 2 MF, 3 FW)
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
    // Defender tokens
    const isDF = tokens.some(t => ['CB','LB','RB','LWB','RWB','WB','DEF','DF'].includes(t))
    // Midfielder tokens
    const isMF = tokens.some(t => ['CM','CDM','CAM','RM','LM','MID','MF'].includes(t))
    // Forward/attacker tokens
    const isFW = tokens.some(t => ['ST','CF','LW','RW','FW','ATT','FWD'].includes(t))
    if (pos.includes('GK')) by.GK.push(p)
    else if (isFW) by.FW.push(p)
    else if (isMF) by.MF.push(p)
    else if (isDF) by.DF.push(p)
    else by.MF.push(p)
  }
  state.byPos = by
  state.loading = false
        // select player whose bucket matches (extra guard)
        for (let tries = 0; tries < 5; tries++) {
          const idx = Math.floor(Math.random() * arr.length)
          const candidate = arr[idx]
          const b = broadPos(candidate)
          if (b === bucket) { state.current = candidate; break }
        }
        if (!state.current) {
          const idx = Math.floor(Math.random() * arr.length)
          state.current = arr[idx]
        }
export function nextRound(state) {
  if (!state.allPlayers.length) return
  // Pick position round-robin with priority FW->MF->DF->GK
  const order = state.posOrder
  for (let k = 0; k < order.length; k++) {
    const bucket = order[state.posIndex % order.length]
    const arr = state.byPos[bucket] || []
    state.posIndex = (state.posIndex + 1) % order.length
    // reset round state
    state.lives = 3
    state.guess = ''
      const idx = Math.floor(Math.random() * arr.length)
      break
    }
  }
  // Fallback if somehow not set
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

  export function posLabel(p) {
    const bp = broadPos(p)
    return bp // Already GK/DF/MF/FW short label
  }

  export function countryFlag(p, width = 32) {
    return flagUrl(p?.ccode || p?.cname, width)
  }

  export function teamLogo(p) {
    return p?.teamLogo || null
  }

  export async function submitGuess(state, confettiHost) {
    if (state.answered) return false
    const raw = state.guess
    const val = normalize(raw)
    if (!val || val.length < state.minGuessLen) return false
    const target = normalize(state.current?.name)
    const correct = target.includes(val)
    if (correct) {
      state.answered = true
      const nextStreak = state.streak + 1
      await awardXpForCorrect({ gameCode: 'guess-player', amount: 10, attemptIndex: state.attempts, streak: nextStreak, corrects: state.corrects + 1 })
      onCorrect(state)
      state.streak = nextStreak
      spawnXpBadge(confettiHost, '+10 XP', { position: 'top-right' })
      state.feedback = ''
      return true
    } else {
      // wrong guess
      state.lives = Math.max(0, state.lives - 1)
      onIncorrect(state)
      if (state.lives === 0) {
        state.answered = true
        state.streak = 0
      }
      return false
    }
  }
  await awardXpForCorrect({ gameCode: 'guess-player', amount: 10, attemptIndex: state.attempts, streak: nextStreak, corrects: state.corrects + 1 })
  onCorrect(state)
    // deprecated in typing version; kept for compatibility if needed
    return 'rounded-lg border px-4 py-2 text-slate-200'
  return correct

  export function blurForLives(lives) {
    // Stronger blur at start; reduce as lives go down
    if (lives >= 3) return 10
    if (lives === 2) return 6
    if (lives === 1) return 3
    return 0
  }
}

export function optionClass(state, opt) {
  const base = 'rounded-lg border px-4 py-2 text-slate-200 transition text-left'
  if (!state.answered) return base + ' border-white/10 hover:border-white/25 hover:bg-white/5'
  const isCorrect = opt.value === state.current.name
  const isSelected = opt.value === state.selected
  if (isCorrect) return base + ' border-green-500 bg-green-500/10 text-green-300'
  if (isSelected) return base + ' border-red-500 bg-red-500/10 text-red-300'
  return base + ' border-white/10 opacity-70'
}
