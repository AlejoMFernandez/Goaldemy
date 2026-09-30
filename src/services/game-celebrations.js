/**
 * Sistema centralizado de celebraciones para TODOS los juegos
 * Maneja sonidos y feedback de victoria/derrota
 */

import { playCorrectSound, playIncorrectSound } from './sounds'

/**
 * Tipos de juegos soportados
 */
export const GAME_TYPES = {
  TIMED: 'timed',           // Juegos con tiempo límite (30s para 10 aciertos)
  ORDERING: 'ordering',     // Juegos de ordenar jugadores (5 correctos)
  LIVES: 'lives',           // Juegos con vidas (guess player style)
  ROUNDS: 'rounds',         // Juegos por rondas
  WORDLE: 'wordle',         // Adiviná el jugador con pistas de colores
  CHAIN: 'chain',           // Cadena de comparaciones (Higher or Lower)
  PUZZLE: 'puzzle',         // Agrupación lógica (Connections)
  GRID: 'grid',             // Grilla con restricciones cruzadas
  SQUAD: 'squad',           // Armar un equipo contra reloj (Once Ideal)
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

export function celebrateIncorrect() {
  playIncorrectSound()
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

/*
 * Victoria / derrota / subida de nivel: ya NO suenan desde acá. El resultado
 * lo suena GameSummaryPopup cuando aparece en pantalla y el nivel lo suena
 * LevelUpOverlay cuando le toca su turno en la cola (cada sonido suena SOLO
 * cuando su escena está en pantalla, nunca todos juntos al terminar). Las
 * funciones quedan como no-op porque las llaman todos los juegos.
 */
export function celebrateGameWin() {}
export function announceGameLoss() {}
export function celebrateGameLevelUp() {}

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
