export const GAME_UNLOCK_LEVELS = {
  'guess-player': 1,
  'nationality': 1,
  'player-position': 1,
  'shirt-number': 3,
  'who-is': 5,
  'value-order': 8,
  'age-order': 12,
  'height-order': 15,
  'once-ideal': 18,
}

export function getGameUnlockLevel(slug) {
  return GAME_UNLOCK_LEVELS[slug] || 1
}

export function isGameUnlocked(slug, userLevel) {
  return (Number(userLevel) || 0) >= getGameUnlockLevel(slug)
}

export function getLevelUpXpBonus(level) {
  const lvl = Number(level) || 1
  if (lvl <= 5) return 25
  if (lvl <= 10) return 50
  if (lvl <= 15) return 75
  if (lvl <= 20) return 100
  if (lvl <= 25) return 150
  return 200
}

export const MILESTONES = [
  {
    level: 10,
    tier: 'Juvenil',
    emoji: '🌱',
    color: 'amber',
    xpBonus: 150,
    title: '¡Rango Juvenil!',
    description: 'Has demostrado conocimiento real del fútbol',
    rewards: [
      { icon: '⭐', label: '+150 XP bonus' },
      { icon: '🌱', label: 'Rango: Juvenil' },
    ],
  },
  {
    level: 20,
    tier: 'Amateur',
    emoji: '💪',
    color: 'orange',
    xpBonus: 300,
    title: '¡Rango Amateur!',
    description: 'Tu conocimiento futbolístico es impresionante',
    rewards: [
      { icon: '⭐', label: '+300 XP bonus' },
      { icon: '💪', label: 'Rango: Amateur' },
    ],
  },
  {
    level: 30,
    tier: 'Reserva',
    emoji: '🔥',
    color: 'red',
    xpBonus: 500,
    title: '¡Rango Reserva!',
    description: '¡Nivel máximo! Sos un verdadero crack',
    rewards: [
      { icon: '⭐', label: '+500 XP bonus' },
      { icon: '🔥', label: 'Rango: Reserva' },
    ],
  },
]

export function getMilestone(level) {
  return MILESTONES.find(m => m.level === Number(level)) || null
}
