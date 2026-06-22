import { TIERS } from './tiers'

export const GAME_UNLOCK_LEVELS = {
  'guess-player': 1,
  'nationality': 1,
  'player-position': 1,
  'shirt-number': 1,
  'who-is': 1,
  'value-order': 1,
  'age-order': 1,
  'height-order': 1,
  'once-ideal': 18,
}

const GAME_NAMES = {
  'guess-player': 'Adivina el Jugador',
  'nationality': 'Nacionalidad',
  'player-position': 'Posición del Jugador',
  'shirt-number': 'Número de Camiseta',
  'who-is': '¿Quién Es?',
  'value-order': 'Orden por Valor',
  'age-order': 'Orden por Edad',
  'height-order': 'Orden por Altura',
  'once-ideal': 'Once Ideal',
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
  if (lvl <= 30) return 200
  if (lvl <= 40) return 300
  return 400
}

export const MILESTONES = [
  {
    level: 10,
    tier: 'Juvenil',
    color: 'amber',
    xpBonus: 150,
    title: '¡Rango Juvenil!',
    description: 'Has demostrado conocimiento real del fútbol',
    rewards: [
      { type: 'xp', label: '+150 XP bonus' },
      { type: 'tier', label: 'Rango: Juvenil', image: '/badges/juvenil.svg' },
    ],
  },
  {
    level: 20,
    tier: 'Amateur',
    color: 'orange',
    xpBonus: 300,
    title: '¡Rango Amateur!',
    description: 'Tu conocimiento futbolístico es impresionante',
    rewards: [
      { type: 'xp', label: '+300 XP bonus' },
      { type: 'tier', label: 'Rango: Amateur', image: '/badges/amateur.svg' },
    ],
  },
  {
    level: 30,
    tier: 'Reserva',
    color: 'red',
    xpBonus: 500,
    title: '¡Rango Reserva!',
    description: 'Entraste al banco de suplentes del élite',
    rewards: [
      { type: 'xp', label: '+500 XP bonus' },
      { type: 'tier', label: 'Rango: Reserva', image: '/badges/reserva.svg' },
    ],
  },
  {
    level: 40,
    tier: 'Profesional',
    color: 'sky',
    xpBonus: 750,
    title: '¡Rango Profesional!',
    description: 'Jugás en las grandes ligas del conocimiento',
    rewards: [
      { type: 'xp', label: '+750 XP bonus' },
      { type: 'tier', label: 'Rango: Profesional', image: '/badges/profesional.svg' },
    ],
  },
  {
    level: 50,
    tier: 'Crack',
    color: 'violet',
    xpBonus: 1000,
    title: '¡Rango Crack!',
    description: '¡Nivel máximo! Sos una enciclopedia viviente del fútbol',
    rewards: [
      { type: 'xp', label: '+1000 XP bonus' },
      { type: 'tier', label: 'Rango: Crack', image: '/badges/crack.svg' },
    ],
  },
]

export function getMilestone(level) {
  return MILESTONES.find(m => m.level === Number(level)) || null
}

export function getLevelUnlocks(level) {
  const lvl = Number(level)
  const unlocks = []
  for (const [slug, reqLevel] of Object.entries(GAME_UNLOCK_LEVELS)) {
    if (reqLevel === lvl && reqLevel > 1) {
      unlocks.push({ type: 'game', label: GAME_NAMES[slug] || slug })
    }
  }
  const tier = TIERS.find(t => t.minLevel === lvl)
  if (tier) {
    unlocks.push({ type: 'tier', label: `Rango: ${tier.label}`, image: tier.image })
  }
  return unlocks
}

// ── Mapa de cosméticos por nivel (espejo del seed SQL, solo para mostrar) ──
const COSMETIC_BY_LEVEL = [
  { level: 2,  kind: 'title',  name: 'Promesa' },
  { level: 3,  kind: 'frame',  name: 'Bronce' },
  { level: 5,  kind: 'title',  name: 'Hincha' },
  { level: 6,  kind: 'icon',   name: 'Botín' },
  { level: 8,  kind: 'frame',  name: 'Plata' },
  { level: 8,  kind: 'banner', name: 'Cancha' },
  { level: 12, kind: 'title',  name: 'Crack' },
  { level: 14, kind: 'icon',   name: 'Guantes' },
  { level: 18, kind: 'banner', name: 'Nocturno' },
  { level: 22, kind: 'icon',   name: 'Medalla' },
  { level: 25, kind: 'frame',  name: 'Oro' },
  { level: 30, kind: 'title',  name: 'Maestro del fútbol' },
  { level: 35, kind: 'frame',  name: 'Esmeralda' },
  { level: 35, kind: 'icon',   name: 'Trofeo' },
  { level: 40, kind: 'banner', name: 'Fuego' },
  { level: 50, kind: 'frame',  name: 'Leyenda' },
  { level: 50, kind: 'title',  name: 'Leyenda Mundial' },
  { level: 55, kind: 'icon',   name: 'GOAT' },
  { level: 60, kind: 'banner', name: 'Galaxia' },
]
const COSMETIC_KIND_LABEL = { frame: 'Borde', title: 'Título', icon: 'Ícono', banner: 'Banner' }

/** Recompensas otorgadas EN un nivel (XP bonus + juegos + rango + cosméticos). */
export function getLevelRewards(level) {
  const lvl = Number(level) || 1
  const rewards = [{ kind: 'xp', label: `+${getLevelUpXpBonus(lvl)} XP bonus` }]
  for (const [slug, req] of Object.entries(GAME_UNLOCK_LEVELS)) {
    if (req === lvl && req > 1) rewards.push({ kind: 'game', label: `Juego: ${GAME_NAMES[slug] || slug}` })
  }
  const tier = TIERS.find(t => t.minLevel === lvl)
  if (tier) rewards.push({ kind: 'tier', label: `Rango: ${tier.label}`, image: tier.image })
  for (const c of COSMETIC_BY_LEVEL) {
    if (c.level === lvl) rewards.push({ kind: c.kind, label: `${COSMETIC_KIND_LABEL[c.kind]}: ${c.name}` })
  }
  return rewards
}

/** Próximas recompensas notables (sin XP plano) para la senda "lo que viene". */
export function getUpcomingRewards(level, count = 3) {
  const lvl = Number(level) || 1
  const out = []
  for (let l = lvl + 1; l <= 60 && out.length < count; l++) {
    const atLevel = getLevelRewards(l).filter(r => r.kind !== 'xp')
    for (const r of atLevel) {
      out.push({ level: l, ...r })
      if (out.length >= count) break
    }
  }
  return out
}
