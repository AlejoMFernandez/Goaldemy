// Servicio compartido para lógica común de juegos
// Centraliza funcionalidad repetida en múltiples juegos

import { getAllPlayers } from './players'

/**
 * Clasifica a un jugador según su posición amplia
 * @param {Object} p - Jugador
 * @returns {string} - 'GK', 'DF', 'MF', o 'FW'
 */
export function getBroadPosition(p) {
  if (typeof p?.positionId === 'number') {
    return p.positionId === 0 ? 'GK' : p.positionId === 1 ? 'DF' : p.positionId === 2 ? 'MF' : 'FW'
  }
  const pos = (p?.position || '').toUpperCase()
  if (pos.includes('GK')) return 'GK'
  const tokens = pos.split(',').map(t => t.trim())
  if (tokens.some(t => ['ST','CF','LW','RW','FW','ATT','FWD'].includes(t))) return 'FW'
  if (tokens.some(t => ['CM','CDM','CAM','RM','LM','MID','MF'].includes(t))) return 'MF'
  if (tokens.some(t => ['CB','LB','RB','LWB','RWB','WB','DEF','DF'].includes(t))) return 'DF'
  return 'MF'
}

/**
 * Carga y clasifica jugadores por posición
 * @param {Object} state - Estado del componente
 */
export function loadAndClassifyPlayers(state) {
  state.allPlayers = getAllPlayers()
  const by = { GK: [], DF: [], MF: [], FW: [] }
  
  for (const p of state.allPlayers) {
    // Clasificación por positionId numérico
    if (typeof p.positionId === 'number') {
      if (p.positionId === 0) by.GK.push(p)
      else if (p.positionId === 1) by.DF.push(p)
      else if (p.positionId === 2) by.MF.push(p)
      else if (p.positionId === 3) by.FW.push(p)
      else by.MF.push(p)
      continue
    }
    
    // Clasificación por string de posición
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
  
  return { allPlayers: state.allPlayers, byPos: by }
}

/**
 * Estado inicial común para juegos MCQ (Multiple Choice Question)
 * @returns {Object} - Estado inicial
 */
export function createMCQGameState() {
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
    // Puntuación
    score: 0,
    attempts: 0,
    streak: 0,
    corrects: 0,
    roundKey: 0,
    loading: true,
    // Modos
    allowXp: true,
    xpEarned: 0,
    maxStreak: 0,
  }
}

/**
 * Clases CSS para opciones de respuesta (MCQ)
 * @param {Object} config - Configuración { answered, isCorrect, isSelected, baseClasses }
 * @returns {string} - Clases CSS
 */
export function getOptionClasses(config) {
  const { answered, isCorrect, isSelected, baseClasses } = config
  const base = baseClasses || 'rounded-lg border px-4 py-2 text-slate-200 transition text-left'
  
  if (!answered) {
    return base + ' border-white/10 hover:border-white/25 hover:bg-white/5'
  }
  
  if (isCorrect) {
    return base + ' border-green-500 bg-green-500/10 text-green-300'
  }
  if (isSelected) {
    return base + ' border-red-500 bg-red-500/10 text-red-300'
  }
  return base + ' border-white/10 opacity-70'
}

/**
 * Mezcla un array aleatoriamente (Fisher-Yates shuffle)
 * @param {Array} arr - Array a mezclar
 * @returns {Array} - Array mezclado
 */
export function shuffleArray(arr) {
  const shuffled = [...arr]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

/**
 * Selecciona jugador aleatorio de un bucket de posición
 * @param {Object} state - Estado del juego
 * @returns {Object|null} - Jugador seleccionado o null
 */
export function selectRandomPlayerFromBucket(state) {
  if (!state.allPlayers.length) return null
  
  const order = state.posOrder
  let selectedPlayer = null
  
  for (let k = 0; k < order.length; k++) {
    const bucket = order[state.posIndex % order.length]
    const arr = state.byPos[bucket] || []
    state.posIndex = (state.posIndex + 1) % order.length
    
    if (arr.length) {
      // Intenta encontrar un jugador que realmente pertenezca al bucket
      for (let tries = 0; tries < 5; tries++) {
        const idx = Math.floor(Math.random() * arr.length)
        const candidate = arr[idx]
        if (getBroadPosition(candidate) === bucket) {
          selectedPlayer = candidate
          break
        }
      }
      
      // Si no encuentra uno perfecto, toma uno aleatorio del bucket
      if (!selectedPlayer) {
        const idx = Math.floor(Math.random() * arr.length)
        selectedPlayer = arr[idx]
      }
      break
    }
  }
  
  // Fallback: jugador totalmente aleatorio
  if (!selectedPlayer) {
    const idx = Math.floor(Math.random() * state.allPlayers.length)
    selectedPlayer = state.allPlayers[idx]
  }
  
  return selectedPlayer
}
