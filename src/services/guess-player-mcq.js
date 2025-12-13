// Servicio para el juego "Adivina el jugador" (opción múltiple)
import { spawnXpBadge } from './ui-effects'
import { onCorrect, onIncorrect } from './scoring'
import { awardXpForCorrect } from './game-xp'
import { 
  createMCQGameState, 
  loadAndClassifyPlayers, 
  getBroadPosition, 
  shuffleArray,
  selectRandomPlayerFromBucket 
} from './game-common'

// Reutiliza estado inicial común
export function initState() {
  return createMCQGameState()
}

// Reutiliza carga y clasificación de jugadores
export function loadPlayers(state) {
  loadAndClassifyPlayers(state)
}

// Re-exporta función común para retrocompatibilidad
export function broadPos(p) {
  return getBroadPosition(p)
}

/**
 * Construye opciones de respuesta (4 jugadores)
 * Prioriza jugadores de la misma posición para mayor desafío
 */
function buildOptions(state, correct) {
  const names = new Set([correct.name])
  const bucket = getBroadPosition(correct)
  const pool = (state.byPos[bucket] || state.allPlayers).filter(p => p.name !== correct.name)
  
  while (names.size < 4 && pool.length) {
    const idx = Math.floor(Math.random() * pool.length)
    names.add(pool[idx].name)
  }
  
  const arr = Array.from(names)
  return shuffleArray(arr.map(n => ({ label: n, value: n })))
}

/**
 * Prepara la siguiente ronda del juego
 * Selecciona jugador aleatorio y genera opciones
 */
export function nextRound(state) {
  if (!state.allPlayers.length) return
  
  // Selecciona jugador usando lógica común
  state.current = selectRandomPlayerFromBucket(state)
  
  if (state.current) {
    state.options = buildOptions(state, state.current)
    state.answered = false
    state.selected = null
    state.feedback = null
    state.roundKey += 1
  }
}


/**
 * Maneja la selección de una respuesta
 * Otorga XP, actualiza puntaje y rachas
 */
export async function pickAnswer(state, option, confettiHost) {
  if (state.answered) return false
  
  state.answered = true
  state.selected = option.value
  const correct = option.value === state.current.name
  
  if (correct) {
    const nextStreak = state.streak + 1
    const nextCorrects = (state.corrects || 0) + 1
    
    // Otorga XP por respuesta correcta
    if (state.allowXp) {
      const xpAmount = state.difficultyConfig?.xpPerCorrect || 10
      await awardXpForCorrect({ 
        gameCode: 'guess-player', 
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
      const xpAmount = state.difficultyConfig?.xpPerCorrect || 10
      spawnXpBadge(confettiHost, `+${xpAmount} XP`, { position: 'top-right' })
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
  const base = 'rounded-lg border px-4 py-2 text-slate-200 transition text-left'
  
  if (!state.answered) {
    return base + ' border-white/10 hover:border-white/25 hover:bg-white/5'
  }
  
  const isCorrect = opt.value === state.current.name
  const isSelected = opt.value === state.selected
  
  if (isCorrect) return base + ' border-green-500 bg-green-500/10 text-green-300'
  if (isSelected) return base + ' border-red-500 bg-red-500/10 text-red-300'
  return base + ' border-white/10 opacity-70'
}

