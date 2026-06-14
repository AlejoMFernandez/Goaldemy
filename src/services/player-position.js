import { spawnXpBadge } from './ui-effects'
import { onCorrect, onIncorrect } from './scoring'
import { celebrateCorrect, celebrateIncorrect } from './game-celebrations'
import { loadAndClassifyPlayers, loadAndClassifyPlayersAsync, shuffleArray, getOptionClasses } from './game-common'

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
    allowXp: true,
    xpEarned: 0,
    maxStreak: 0,
  }
}

export async function loadPlayers(state) {
  await loadAndClassifyPlayersAsync(state)
}

function buildOptionsForPosition(correctPos, rng) {
  const rand = rng || Math.random
  const opts = new Set([correctPos])
  while (opts.size < 4) {
    const rnd = POSITIONS[Math.floor(rand() * POSITIONS.length)]
    opts.add(rnd)
  }
  const shuffled = shuffleArray(Array.from(opts), rng)
  return shuffled.map(code => ({ label: POS_LABEL[code] || code, value: code }))
}

export function nextRound(state) {
  if (!state.allPlayers.length) return
  const rand = state.rng || Math.random
  const idx = Math.floor(rand() * state.allPlayers.length)
  state.current = state.allPlayers[idx]
  state.options = buildOptionsForPosition(state.current.position, state.rng)
  state.answered = false
  state.selected = null
  state.feedback = null
  state.roundKey += 1
}

export function pickAnswer(state, option, confettiHost) {
  if (state.answered) return false

  state.answered = true
  state.selected = option.value
  const correct = option.value === state.current.position

  if (correct) {
    celebrateCorrect()
    const nextStreak = state.streak + 1
    const nextCorrects = (state.corrects || 0) + 1
    const xpAmount = state.difficultyConfig?.xpPerCorrect || 10
    if (state.allowXp) {
      state.xpEarned += xpAmount
      spawnXpBadge(confettiHost, `+${xpAmount} XP`, { position: 'top-right' })
    }
    onCorrect(state)
    state.streak = nextStreak
    state.corrects = nextCorrects
    state.maxStreak = Math.max(state.maxStreak || 0, nextStreak)
  } else {
    celebrateIncorrect()
    onIncorrect(state)
    state.streak = 0
  }

  state.feedback = ''
  return correct
}

export function optionClass(state, opt) {
  return getOptionClasses({
    answered: state.answered,
    isCorrect: opt.value === state.current.position,
    isSelected: opt.value === state.selected,
    baseClasses: 'rounded-lg border px-4 py-2 text-slate-200 transition text-left'
  })
}
