import { TIERS } from './tiers.js'

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

// Hitos de rango (relanzamiento 1–100): XP bonus al ascender de categoría.
// El bonus crece con el rango; se suma al modelo de XP/día (docs/relanzamiento/PROGRESION.md).
const MILESTONE_COPY = {
  juvenil:     { xpBonus: 150,  description: 'Saliste del potrero: ahora jugás en las inferiores' },
  amateur:     { xpBonus: 300,  description: 'Primera de ascenso: barro, lluvia y reflectores' },
  reserva:     { xpBonus: 500,  description: 'Ya entendés la pizarra: el DT te tiene en cuenta' },
  profesional: { xpBonus: 750,  description: 'Día de partido: túnel, silbato y cámaras' },
  crack:       { xpBonus: 1000, description: 'Te toca jugar el clásico' },
  figura:      { xpBonus: 1250, description: 'Noches de Copa: se prenden las luces' },
  idolo:       { xpBonus: 1500, description: 'La hinchada canta tu nombre' },
  icono:       { xpBonus: 1750, description: 'Ganaste el Balón de Oro: sos un Ícono' },
  leyenda:     { xpBonus: 2000, description: 'Lo sostuviste años: sos Leyenda' },
  goat:        { xpBonus: 3000, description: 'Álbum completo. El más grande de todos' },
}

export const MILESTONES = TIERS.filter(t => MILESTONE_COPY[t.key]).map(t => {
  const m = MILESTONE_COPY[t.key]
  return {
    level: t.minLevel,
    tier: t.label,
    tierKey: t.key,
    color: t.color,
    xpBonus: m.xpBonus,
    title: `¡Rango ${t.label}!`,
    description: m.description,
    rewards: [
      { type: 'xp', label: `+${m.xpBonus} XP bonus` },
      { type: 'tier', label: `Rango: ${t.label}`, image: t.image },
    ],
  }
})

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

// ── Mapa de cosméticos por nivel (espejo del seed SQL) ──
// styleKey/rarity permiten RENDERIZAR el cosmético real (no solo texto):
//   frame/banner → clase CSS por styleKey; icon → glyph/raster; title → texto.
const COSMETIC_BY_LEVEL = [
  { level: 2,  kind: 'title',  name: 'Promesa',            rarity: 'common' },
  { level: 3,  kind: 'frame',  name: 'Bronce',   styleKey: 'bronze',  rarity: 'common' },
  { level: 5,  kind: 'title',  name: 'Hincha',             rarity: 'common' },
  { level: 6,  kind: 'icon',   name: 'Botín',    styleKey: 'boot',    rarity: 'common' },
  { level: 8,  kind: 'frame',  name: 'Plata',    styleKey: 'silver',  rarity: 'rare' },
  { level: 8,  kind: 'banner', name: 'Cancha',   styleKey: 'pitch',   rarity: 'common' },
  { level: 12, kind: 'title',  name: 'Crack',              rarity: 'rare' },
  { level: 14, kind: 'icon',   name: 'Guantes',  styleKey: 'gloves',  rarity: 'rare' },
  { level: 18, kind: 'banner', name: 'Nocturno', styleKey: 'night',   rarity: 'rare' },
  { level: 22, kind: 'icon',   name: 'Medalla',  styleKey: 'medal',   rarity: 'rare' },
  { level: 25, kind: 'frame',  name: 'Oro',      styleKey: 'gold',    rarity: 'epic' },
  { level: 30, kind: 'title',  name: 'Maestro del fútbol', rarity: 'epic' },
  { level: 35, kind: 'frame',  name: 'Esmeralda',styleKey: 'emerald', rarity: 'epic' },
  { level: 35, kind: 'icon',   name: 'Trofeo',   styleKey: 'trophy',  rarity: 'epic' },
  { level: 40, kind: 'banner', name: 'Fuego',    styleKey: 'fire',    rarity: 'epic' },
  { level: 50, kind: 'frame',  name: 'Leyenda',  styleKey: 'legend',  rarity: 'legendary' },
  { level: 50, kind: 'title',  name: 'Leyenda Mundial',    rarity: 'legendary' },
  { level: 55, kind: 'icon',   name: 'GOAT',     styleKey: 'goat',    rarity: 'legendary' },
  { level: 60, kind: 'banner', name: 'Galaxia',  styleKey: 'galaxy',  rarity: 'legendary' },
]
const COSMETIC_KIND_LABEL = { frame: 'Borde', title: 'Título', icon: 'Ícono', banner: 'Banner' }

/** Recompensas otorgadas EN un nivel (XP bonus + juegos + rango + cosméticos).
 *  Cada item cosmético trae name/styleKey/rarity para renderizarlo de verdad. */
export function getLevelRewards(level) {
  const lvl = Number(level) || 1
  const rewards = [{ kind: 'xp', label: `+${getLevelUpXpBonus(lvl)} XP bonus` }]
  for (const [slug, req] of Object.entries(GAME_UNLOCK_LEVELS)) {
    if (req === lvl && req > 1) rewards.push({ kind: 'game', label: `Juego: ${GAME_NAMES[slug] || slug}`, name: GAME_NAMES[slug] || slug, slug })
  }
  const tier = TIERS.find(t => t.minLevel === lvl)
  if (tier) rewards.push({ kind: 'tier', label: `Rango: ${tier.label}`, name: tier.label, image: tier.image })
  for (const c of COSMETIC_BY_LEVEL) {
    if (c.level === lvl) rewards.push({ kind: c.kind, label: `${COSMETIC_KIND_LABEL[c.kind]}: ${c.name}`, name: c.name, styleKey: c.styleKey, rarity: c.rarity, typeLabel: COSMETIC_KIND_LABEL[c.kind] })
  }
  return rewards
}

/** Próximas recompensas notables (sin XP plano) para la senda "lo que viene". */
export function getUpcomingRewards(level, count = 3) {
  const lvl = Number(level) || 1
  const out = []
  for (let l = lvl + 1; l <= 100 && out.length < count; l++) {
    const atLevel = getLevelRewards(l).filter(r => r.kind !== 'xp')
    for (const r of atLevel) {
      out.push({ level: l, ...r })
      if (out.length >= count) break
    }
  }
  return out
}
