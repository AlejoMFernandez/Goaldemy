import { spawnXpBadge } from './ui-effects'
import { onCorrect, onIncorrect } from './scoring'
import { awardXpForCorrect } from './game-xp'
import { celebrateCorrect } from './game-celebrations'
import { loadAndClassifyPlayers, shuffleArray, getOptionClasses } from './game-common'

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
    // modes
    allowXp: true,
    xpEarned: 0,
    maxStreak: 0,
  }
}

/**
 * Carga jugadores filtrados por posiciones válidas (GK, DF, MF, FW)
 */
export function loadPlayers(state) {
  const all = loadAndClassifyPlayers(state)
  state.allPlayers = all.filter(p => POSITIONS.includes(p.position))
  state.loading = false
}

/**
 * Genera 4 opciones de posición con la correcta incluida
 */
function buildOptionsForPosition(correctPos) {
  const opts = new Set([correctPos])
  while (opts.size < 4) {
    const rnd = POSITIONS[Math.floor(Math.random() * POSITIONS.length)]
    opts.add(rnd)
  }
  const shuffled = shuffleArray(Array.from(opts))
  return shuffled.map(code => ({ label: POS_LABEL[code] || code, value: code }))
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

/**
 * Maneja la selección de una respuesta
 * Valida posición, otorga XP y actualiza puntaje
 */
export async function pickAnswer(state, option, confettiHost) {
  if (state.answered) return false
  
  state.answered = true
  state.selected = option.value
  const correct = option.value === state.current.position
  
  if (correct) {
    celebrateCorrect() // Celebración inmediata por acierto
    
    const nextStreak = state.streak + 1
    const nextCorrects = (state.corrects || 0) + 1
    
    // Otorga XP por respuesta correcta (usa difficultyConfig si existe)
    const xpAmount = state.difficultyConfig?.xpPerCorrect || 10
    if (state.allowXp) {
      await awardXpForCorrect({ 
        gameCode: 'player-position', 
        amount: xpAmount, 
        attemptIndex: state.attempts, 
        streak: nextStreak, 
        corrects: nextCorrects 
      })
      state.xpEarned += xpAmount
    }
    
    onCorrect(state)
    state.streak = nextStreak
    state.corrects = nextCorrects
    state.maxStreak = Math.max(state.maxStreak || 0, nextStreak)
    
    // Muestra badge de XP ganado
    if (state.allowXp) {
      spawnXpBadge(confettiHost, '+10 XP', { position: 'top-right' })
    }
  } else {
    onIncorrect(state)
    state.streak = 0 // Resetea racha en error
  }
  
  state.feedback = ''
  return correct
}

/**
 * Retorna clases CSS para opciones según estado
 * Verde si correcta, roja si seleccionada incorrecta, gris si no seleccionada
 */
export function optionClass(state, opt) {
  return getOptionClasses({
    answered: state.answered,
    isCorrect: opt.value === state.current.position,
    isSelected: opt.value === state.selected,
    baseClasses: 'rounded-lg border px-4 py-2 text-slate-200 transition text-left'
  })
}
