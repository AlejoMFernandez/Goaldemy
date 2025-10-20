import { countryCodeFromName, flagUrl } from './countries'
import { getAllPlayers } from './players'
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
  const idx = Math.floor(Math.random() * state.allPlayers.length)
  state.current = state.allPlayers[idx]
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
    // First award XP with current attempt/streak values (before increment)
<<<<<<< HEAD
    await awardXpForCorrect({ gameCode: 'nationality', amount: 10, attemptIndex: state.attempts, streak: state.streak + 1 })
  onCorrect(state)
  spawnXpBadge(confettiHost, '+10 XP', { position: 'top-right' })
  } else {
    onIncorrect(state)
=======
  const nextStreak = state.streak + 1
  await awardXpForCorrect({ gameCode: 'nationality', amount: 10, attemptIndex: state.attempts, streak: nextStreak, corrects: state.corrects + 1 })
    onCorrect(state)
    state.streak = nextStreak
    spawnXpBadge(confettiHost, '+10 XP', { position: 'top-right' })
  } else {
    onIncorrect(state)
    state.streak = 0
>>>>>>> d0aeee3 (Opciones en Registro, agregado de logros y fix de XP)
  }
  state.feedback = correct ? '¡Correcto!' : `Incorrecto: era ${state.current.cname}`
  return correct
}
