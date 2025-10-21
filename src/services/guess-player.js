import { getAllPlayers, buildOptions } from './players'
import { spawnXpBadge } from './ui-effects'
import { onCorrect, onIncorrect } from './scoring'
import { awardXpForCorrect } from './game-xp'

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
    roundKey: 0,
    loading: true,
  }
}

export function loadPlayers(state) {
  state.allPlayers = getAllPlayers()
  state.loading = false
}

export function nextRound(state) {
  if (!state.allPlayers.length) return
  const idx = Math.floor(Math.random() * state.allPlayers.length)
  state.current = state.allPlayers[idx]
  state.options = buildOptions(state.allPlayers, state.current, 4, 'name')
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
    // Award XP and achievements using standardized helper
  const nextStreak = state.streak + 1
  await awardXpForCorrect({ gameCode: 'guess-player', amount: 10, attemptIndex: state.attempts, streak: nextStreak, corrects: state.corrects + 1 })
  onCorrect(state)
  state.streak = nextStreak
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
  const isCorrect = opt.value === state.current.name
  const isSelected = opt.value === state.selected
  if (isCorrect) return base + ' border-green-500 bg-green-500/10 text-green-300'
  if (isSelected) return base + ' border-red-500 bg-red-500/10 text-red-300'
  return base + ' border-white/10 opacity-70'
}
