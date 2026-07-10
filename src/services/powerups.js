import { usePowerup as _usePowerup, getPowerupCounts, invalidatePlanCache } from './premium'

export const POWERUP_TYPES = {
  fifty_fifty: {
    key: 'fifty_fifty',
    inventoryKey: 'fiftyFifty',
    name: '50/50',
    icon: '✂️',
    description: 'Elimina 2 opciones incorrectas',
    color: 'from-orange-500 to-amber-500',
  },
  shield: {
    key: 'shield',
    inventoryKey: 'shield',
    name: 'Escudo',
    icon: '🛡️',
    description: 'Protege de un error sin perder vida',
    color: 'from-blue-500 to-cyan-500',
  },
  extra_time: {
    key: 'extra_time',
    inventoryKey: 'extraTime',
    name: '+15s',
    icon: '⏱️',
    description: 'Agrega 15 segundos al timer',
    color: 'from-emerald-500 to-green-500',
  },
  reveal_hint: {
    key: 'reveal_hint',
    inventoryKey: 'revealHint',
    name: 'Pista',
    icon: '💡',
    description: 'Revela una pista extra',
    color: 'from-purple-500 to-pink-500',
  },
}

// Las ayudas sólo se pueden usar en estos juegos (los de opción múltiple contra
// reloj). El índice lo muestra explícito para que el usuario sepa antes de jugar.
export const POWERUP_GAME_SLUGS = ['guess-player', 'nationality', 'player-position', 'shirt-number']

export async function usePowerup(type) {
  const success = await _usePowerup(type)
  if (success) invalidatePlanCache()
  return success
}

export async function getAvailablePowerups() {
  const counts = await getPowerupCounts()
  return Object.values(POWERUP_TYPES).map(p => ({
    ...p,
    count: counts[p.inventoryKey] ?? 0,
  }))
}

export function getPowerupMeta(type) {
  return POWERUP_TYPES[type] || null
}
