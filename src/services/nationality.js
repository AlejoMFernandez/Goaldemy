import { countryCodeFromName, flagUrl } from './countries'
import { spawnXpBadge } from './ui-effects'
import { onCorrect, onIncorrect } from './scoring'
import { awardXpForCorrect } from './game-xp'
import { celebrateCorrect } from './game-celebrations'
import { loadAndClassifyPlayers, shuffleArray, getOptionClasses, selectRandomPlayerFromBucket } from './game-common'

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
    // Difficulty system
    difficulty: 'normal',
    difficultyConfig: null,
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

/**
 * Genera 4 opciones de nacionalidad con la correcta incluida
 */
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
  state.options = shuffleArray(opts)
}

/**
 * Selecciona siguiente jugador rotando entre posiciones
 */
export function nextRound(state) {
  if (!state.allPlayers.length) return
  
  state.current = selectRandomPlayerFromBucket(state)
  
  // Si no hay jugador en buckets, tomar aleatorio
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

/**
 * Retorna clases CSS para opciones según estado
 */
export function optionClass(state, opt) {
  return getOptionClasses({
    answered: state.answered,
    isCorrect: opt.value === state.current.cname,
    isSelected: opt.value === state.selected,
    baseClasses: 'rounded-lg border px-3 py-2 text-slate-200 transition flex items-center gap-3'
  })
}

export async function pick(state, option, confettiHost) {
  if (state.answered) return false
  state.answered = true
  state.selected = option.value
  const correct = option.value === state.current.cname
  if (correct) {
    // Play correct sound immediately
    celebrateCorrect()
    
    // Calculate XP based on difficulty
    const xpAmount = state.difficultyConfig?.xpPerCorrect || 10
    
    // First award XP with current attempt/streak values (before increment)
    const nextStreak = state.streak + 1
    if (state.allowXp) {
      await awardXpForCorrect({ 
        gameCode: 'nationality', 
        amount: xpAmount, 
        attemptIndex: state.attempts, 
        streak: nextStreak, 
        corrects: state.corrects + 1,
        difficulty: state.difficulty
      })
      state.xpEarned += xpAmount
    }
    
    onCorrect(state)
    state.streak = nextStreak
    state.maxStreak = Math.max(state.maxStreak || 0, nextStreak)
    
    if (state.allowXp) {
      spawnXpBadge(confettiHost, `+${xpAmount} XP`, { position: 'top-right' })
    }
  } else {
    onIncorrect(state)
    state.streak = 0
  }
  state.feedback = ''
  return correct
}
