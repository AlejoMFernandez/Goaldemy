import { getAllPlayers } from './players'
import { spawnXpBadge } from './ui-effects'
import { onCorrect, onIncorrect } from './scoring'
import { awardXpForCorrect } from './game-xp'

const POSITIONS = ['GK','DF','MF','FW']
const POS_LABEL = {
  GK: 'Arquero',
  DF: 'Defensor',
  MF: 'Mediocampista',
  FW: 'Delantero',
}

export function initState() {
  return {
    allPlayers: [],
    current: null,
    options: [],
    answered: false,
    selected: null,
    feedback: null,
    score: 0,
    attempts: 0,
    streak: 0,
    corrects: 0,
    roundKey: 0,
    loading: true,
  }
}

export function loadPlayers(state) {
  const all = getAllPlayers().filter(p => POSITIONS.includes(p.position))
  state.allPlayers = all
  state.loading = false
}

function buildOptionsForPosition(correctPos) {
  const opts = new Set([correctPos])
  while (opts.size < 4) {
    const rnd = POSITIONS[Math.floor(Math.random() * POSITIONS.length)]
    opts.add(rnd)
  }
  // shuffle
  const arr = Array.from(opts)
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr.map(code => ({ label: POS_LABEL[code] || code, value: code }))
}

export function nextRound(state) {
  if (!state.allPlayers.length) return
  const idx = Math.floor(Math.random() * state.allPlayers.length)
  state.current = state.allPlayers[idx]
  state.options = buildOptionsForPosition(state.current.position)
  state.answered = false
  state.selected = null
  state.feedback = null
  state.roundKey += 1
}

export async function pickAnswer(state, option, confettiHost) {
  if (state.answered) return false
  state.answered = true
  state.selected = option.value
  const correct = option.value === state.current.position
  if (correct) {
    const nextStreak = state.streak + 1
    const nextCorrects = (state.corrects || 0) + 1
    await awardXpForCorrect({ gameCode: 'player-position', amount: 10, attemptIndex: state.attempts, streak: nextStreak, corrects: nextCorrects })
    onCorrect(state)
    state.streak = nextStreak
    state.corrects = nextCorrects
    spawnXpBadge(confettiHost, '+10 XP', { position: 'top-right' })
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
  const isCorrect = opt.value === state.current.position
  const isSelected = opt.value === state.selected
  if (isCorrect) return base + ' border-green-500 bg-green-500/10 text-green-300'
  if (isSelected) return base + ' border-red-500 bg-red-500/10 text-red-300'
  return base + ' border-white/10 opacity-70'
}
