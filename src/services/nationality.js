import { countryCodeFromName, flagUrl } from './countries'
import { getAllPlayers } from './players'
import { spawnXpBadge } from './ui-effects'
import { onCorrect, onIncorrect } from './scoring'
import { awardXpForCorrect } from './game-xp'
import { celebrateCorrect } from './game-celebrations'

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
    score: 0,
    attempts: 0,
    streak: 0,
    roundKey: 0,
    loading: true,
    // Modes support
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

export function buildOptions(state) {
  const countries = Array.from(new Set(state.allPlayers.map(p => p.cname)))
  const distractors = countries.filter(c => c !== state.current.cname)
  const picked = []
  while (picked.length < 3 && distractors.length > 0) {
    const j = Math.floor(Math.random() * distractors.length)
    picked.push(distractors.splice(j, 1)[0])
  }
  const opts = [state.current.cname, ...picked].map(c => ({
    label: c,
    value: c,
    code: countryCodeFromName(c),
  }))
  for (let i = opts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[opts[i], opts[j]] = [opts[j], opts[i]]
  }
  state.options = opts
}

export function nextRound(state) {
  if (!state.allPlayers.length) return
  for (let k = 0; k < state.posOrder.length; k++) {
    const bucket = state.posOrder[state.posIndex % state.posOrder.length]
    const arr = state.byPos[bucket] || []
    state.posIndex = (state.posIndex + 1) % state.posOrder.length
    if (arr.length) {
      const idx = Math.floor(Math.random() * arr.length)
      state.current = arr[idx]
      break
    }
  }
  if (!state.current) {
    const idx = Math.floor(Math.random() * state.allPlayers.length)
    state.current = state.allPlayers[idx]
  }
  buildOptions(state)
  state.answered = false
  state.selected = null
  state.feedback = null
  state.roundKey += 1
}

export function flag(code, width = 40) {
  return flagUrl(code, width)
}

export function optionClass(state, opt) {
  const base = 'rounded-lg border px-3 py-2 text-slate-200 transition flex items-center gap-3'
  if (!state.answered) return base + ' border-white/10 hover:border-white/25 hover:bg-white/5'
  const isCorrect = opt.value === state.current.cname
  const isSelected = opt.value === state.selected
  if (isCorrect) return base + ' border-green-500 bg-green-500/10 text-green-300'
  if (isSelected) return base + ' border-red-500 bg-red-500/10 text-red-300'
  return base + ' border-white/10 opacity-70'
}

export async function pick(state, option, confettiHost) {
  if (state.answered) return false
  state.answered = true
  state.selected = option.value
  const correct = option.value === state.current.cname
  if (correct) {
    // Play correct sound immediately
    celebrateCorrect()
    // First award XP with current attempt/streak values (before increment)
  const nextStreak = state.streak + 1
  if (state.allowXp) {
    await awardXpForCorrect({ gameCode: 'nationality', amount: 10, attemptIndex: state.attempts, streak: nextStreak, corrects: state.corrects + 1 })
    state.xpEarned += 10
  }
    onCorrect(state)
    state.streak = nextStreak
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
