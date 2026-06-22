// Servicio compartido para lógica común de juegos
// Centraliza funcionalidad repetida en múltiples juegos

import { getAllPlayers, getAllPlayersAsync } from './players'

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
  if (pos.includes('GK') || pos.includes('POR') || pos.includes('ARQ')) return 'GK'
  const tokens = pos.split(/[,/\s]+/).map(t => t.trim()).filter(Boolean)
  const FW = ['ST','CF','LW','RW','FW','ATT','FWD','SS','DC','EI','ED','SD','DEL','DELC']
  const MF = ['CM','CDM','CAM','RM','LM','MID','MF','DM','AM','MC','MCD','MCO','MCA','MI','MD','MP','VOL','MED','PIV','INT']
  const DF = ['CB','LB','RB','LWB','RWB','WB','DEF','DF','DFC','LI','LD','CAI','CAD','LIB']
  if (tokens.some(t => FW.includes(t))) return 'FW'
  if (tokens.some(t => MF.includes(t))) return 'MF'
  if (tokens.some(t => DF.includes(t))) return 'DF'
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
 * Versión asíncrona: usa getAllPlayersAsync() para datos frescos de FotMob.
 */
export async function loadAndClassifyPlayersAsync(state) {
  state.allPlayers = await getAllPlayersAsync()
  const by = { GK: [], DF: [], MF: [], FW: [] }
  
  for (const p of state.allPlayers) {
    if (typeof p.positionId === 'number') {
      if (p.positionId === 0) by.GK.push(p)
      else if (p.positionId === 1) by.DF.push(p)
      else if (p.positionId === 2) by.MF.push(p)
      else if (p.positionId === 3) by.FW.push(p)
      else by.MF.push(p)
      continue
    }
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
    return base + ' border-white/10 hover:border-white/25 hover:bg-white/5 hover:shadow-lg hover:shadow-white/5 active:scale-[0.97]'
  }

  if (isCorrect) {
    return base + ' border-emerald-400 bg-emerald-500/15 text-emerald-300 shadow-lg shadow-emerald-500/20 option-correct scale-[1.02]'
  }
  if (isSelected) {
    return base + ' border-red-400 bg-red-500/15 text-red-300 shadow-lg shadow-red-500/20 shake'
  }
  return base + ' border-white/10 opacity-40'
}

/**
 * Mezcla un array aleatoriamente (Fisher-Yates shuffle)
 * @param {Array} arr - Array a mezclar
 * @returns {Array} - Array mezclado
 */
export function shuffleArray(arr, rng) {
  const rand = rng || Math.random
  const shuffled = [...arr]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
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
  const rand = state.rng || Math.random
  if (!state.allPlayers.length) return null

  const order = state.posOrder
  let selectedPlayer = null

  for (let k = 0; k < order.length; k++) {
    const bucket = order[state.posIndex % order.length]
    const arr = state.byPos[bucket] || []
    state.posIndex = (state.posIndex + 1) % order.length

    if (arr.length) {
      for (let tries = 0; tries < 5; tries++) {
        const idx = Math.floor(rand() * arr.length)
        const candidate = arr[idx]
        if (getBroadPosition(candidate) === bucket) {
          selectedPlayer = candidate
          break
        }
      }

      if (!selectedPlayer) {
        const idx = Math.floor(rand() * arr.length)
        selectedPlayer = arr[idx]
      }
      break
    }
  }

  if (!selectedPlayer) {
    const idx = Math.floor(rand() * state.allPlayers.length)
    selectedPlayer = state.allPlayers[idx]
  }

  return selectedPlayer
}
