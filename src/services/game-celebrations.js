/**
 * Sistema centralizado de celebraciones para TODOS los juegos
 * Maneja confetti, sonidos y feedback visual de victoria/derrota
 */

import { celebrateWin, celebrateLevelUp } from './confetti'
import { playWinSound, playLoseSound, playLevelUpSound, playCorrectSound } from './sounds'

/**
 * Tipos de juegos soportados
 */
export const GAME_TYPES = {
  TIMED: 'timed',           // Juegos con tiempo límite (30s para 10 aciertos)
  ORDERING: 'ordering',     // Juegos de ordenar jugadores (5 correctos)
  LIVES: 'lives',           // Juegos con vidas (guess player style)
  ROUNDS: 'rounds'          // Juegos por rondas
}

/**
 * Configuración de victorias por tipo de juego
 */
const WIN_CONDITIONS = {
  [GAME_TYPES.TIMED]: {
    minCorrect: 10,
    description: 'Hacé 10 aciertos en 30 segundos para ganar'
  },
  [GAME_TYPES.ORDERING]: {
    minCorrect: 5,
    description: 'Ordená los 5 jugadores correctamente para ganar'
  },
  [GAME_TYPES.LIVES]: {
    description: 'Adiviná jugadores sin perder todas las vidas'
  },
  [GAME_TYPES.ROUNDS]: {
    description: 'Completá todas las rondas correctamente'
  }
}

/**
 * Celebra una respuesta correcta (sonido corto)
 */
export function celebrateCorrect() {
  playCorrectSound()
}

/**
 * Determina si el jugador ganó según el tipo de juego y stats
 * @param {string} gameType - Tipo de juego (GAME_TYPES)
 * @param {object} stats - Estadísticas del juego { correct, total, lives, etc }
 * @returns {boolean} - true si ganó
 */
export function checkVictory(gameType, stats = {}) {
  switch (gameType) {
    case GAME_TYPES.TIMED:
      return (stats.correct || 0) >= WIN_CONDITIONS[GAME_TYPES.TIMED].minCorrect
    
    case GAME_TYPES.ORDERING:
      return (stats.correct || 0) >= WIN_CONDITIONS[GAME_TYPES.ORDERING].minCorrect
    
    case GAME_TYPES.LIVES:
      return stats.won === true || (stats.lives > 0 && stats.completed)
    
    case GAME_TYPES.ROUNDS:
      return stats.completed === true && stats.allCorrect === true
    
    default:
      return false
  }
}

/**
 * Celebra victoria del juego (confetti + sonido)
 * @param {number} delay - Delay en ms antes de celebrar (default 100)
 */
export function celebrateGameWin(delay = 100) {
  setTimeout(() => {
    celebrateWin()
    playWinSound()
  }, delay)
}

/**
 * Indica derrota del juego (solo sonido)
 * @param {number} delay - Delay en ms antes de reproducir (default 100)
 */
export function announceGameLoss(delay = 100) {
  setTimeout(() => {
    playLoseSound()
  }, delay)
}

/**
 * Celebra subida de nivel (confetti especial + sonido)
 * @param {number} newLevel - Nivel alcanzado
 * @param {number} delay - Delay en ms (default 500)
 */
export function celebrateGameLevelUp(newLevel, delay = 500) {
  setTimeout(() => {
    celebrateLevelUp(newLevel)
    playLevelUpSound()
  }, delay)
}

/**
 * Maneja el final del juego de forma completa
 * @param {string} gameType - Tipo de juego
 * @param {object} stats - Estadísticas finales
 * @param {object} levelInfo - Info de nivel { before, after }
 * @returns {object} - { won, levelUp }
 */
export function handleGameEnd(gameType, stats, levelInfo = {}) {
  const won = checkVictory(gameType, stats)
  
  // Celebrar victoria o anunciar derrota
  if (won) {
    celebrateGameWin()
  } else {
    announceGameLoss()
  }
  
  // Verificar level up
  const levelUp = levelInfo.after && levelInfo.before && levelInfo.after > levelInfo.before
  if (levelUp) {
    celebrateGameLevelUp(levelInfo.after)
  }
  
  return { won, levelUp }
}

/**
 * Obtiene la descripción de victoria para el popup pre-juego
 * @param {string} gameType - Tipo de juego
 * @returns {string} - Descripción
 */
export function getGameDescription(gameType) {
  return WIN_CONDITIONS[gameType]?.description || ''
}

/**
 * Para juegos con tiempo: detecta victoria anticipada (10 aciertos antes de que termine tiempo)
 * @param {number} correct - Número de aciertos actuales
 * @returns {boolean} - true si ya ganó
 */
export function checkEarlyWin(correct) {
  return correct >= WIN_CONDITIONS[GAME_TYPES.TIMED].minCorrect
}
