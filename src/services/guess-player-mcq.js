import { getAllPlayers } from './players'
import { spawnXpBadge } from './ui-effects'
import { onCorrect, onIncorrect } from './scoring'
import { awardXpForCorrect } from './game-xp'

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
    // scoring
    score: 0,
    attempts: 0,
    streak: 0,
    corrects: 0,
    roundKey: 0,
    loading: true,
    // modes
    allowXp: true,
    xpEarned: 0,
    maxStreak: 0,
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

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function buildOptions(state, correct) {
  const names = new Set([correct.name])
  // Prefer distractors from same broad position for challenge
  const bucket = broadPos(correct)
  const pool = (state.byPos[bucket] || state.allPlayers).filter(p => p.name !== correct.name)
  while (names.size < 4 && pool.length) {
    const idx = Math.floor(Math.random() * pool.length)
    names.add(pool[idx].name)
  }
  const arr = Array.from(names)
  return shuffle(arr.map(n => ({ label: n, value: n })))
}

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
  state.options = buildOptions(state, state.current)
  state.answered = false
  state.selected = null
  state.feedback = null
  state.roundKey += 1
}

export async function pickAnswer(state, option, confettiHost) {
  if (state.answered) return false
  state.answered = true
  state.selected = option.value
  const correct = option.value === state.current.name
  if (correct) {
    const nextStreak = state.streak + 1
    const nextCorrects = (state.corrects || 0) + 1
    if (state.allowXp) {
      await awardXpForCorrect({ gameCode: 'guess-player', amount: 10, attemptIndex: state.attempts, streak: nextStreak, corrects: nextCorrects })
      state.xpEarned += 10
    }
    onCorrect(state)
    state.streak = nextStreak
    state.corrects = nextCorrects
    state.maxStreak = Math.max(state.maxStreak || 0, nextStreak)
    if (state.allowXp) {
      spawnXpBadge(confettiHost, '+10 XP', { position: 'top-right' })
    }
  } else {
    onIncorrect(state)
    state.streak = 0
  }
  state.feedback = ''
  return correct
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
