// RANGOS (categorías) de Fulvo · relanzamiento 1–100.
// 11 categorías de 10 niveles (Aficionado 1–9 … GOAT 100). Cada una trae su KIT
// (2 colores + dibujo de camiseta + emblema + metal del aro + forma de escudo) y
// su COLECCIÓN (src/data/collections.js). Los escudos se dibujan por código:
// src/services/rank-crest.js → RankCrest / RankMedallion / RankBanner.
//
// Historia: ganar un Balón de Oro te hace Ícono; sostenerlo años, Leyenda.
//
// Compat: se mantienen key/label/minLevel/maxLevel/color/emoji/image, TIER_UNLOCKS,
// getTierForLevel, getNextTier, tierAccentText y tierColorClasses.
// `image` apunta a public/badges/rangos/<key>.svg (generados desde rank-crest.js
// por scripts/build-rangos-preview.mjs) para que los <img> existentes muestren el kit nuevo.

/**
 * kit:
 *  primary/secondary → colores de camiseta
 *  pattern → lisa | bastones | banda | cuartos | franja | mitad | rayas | bastones-anchos | v | holo
 *  metal   → bronce | plata | oro | diamante | holo
 *  emblem  → clave de emblema monolínea (rank-crest.js)
 *  shape   → redondeado (1–29) | punta (30–59) | almenado (60–89) | corona (90–99) | cuernos (100)
 */
export const TIERS = [
  { key: 'aficionado', label: 'Aficionado', minLevel: 1, maxLevel: 9, color: 'bronze', emoji: '🥉',
    collection: 'El Potrero', kit: { primary: '#c2410c', secondary: '#7c2d12', pattern: 'lisa', metal: 'bronce', emblem: 'trapo', shape: 'redondeado' } },
  { key: 'juvenil', label: 'Juvenil', minLevel: 10, maxLevel: 19, color: 'orange', emoji: '🥉',
    collection: 'Las Inferiores', kit: { primary: '#f97316', secondary: '#ffffff', pattern: 'bastones', metal: 'bronce', emblem: 'cono', shape: 'redondeado' } },
  { key: 'amateur', label: 'Amateur', minLevel: 20, maxLevel: 29, color: 'amber', emoji: '🥉',
    collection: 'El Ascenso', kit: { primary: '#7a5230', secondary: '#facc15', pattern: 'banda', metal: 'bronce', emblem: 'farol', shape: 'redondeado' } },
  { key: 'reserva', label: 'Reserva', minLevel: 30, maxLevel: 39, color: 'emerald', emoji: '🥈',
    collection: 'La Pizarra', kit: { primary: '#065f46', secondary: '#1f4a3a', pattern: 'cuartos', metal: 'plata', emblem: 'pizarra', shape: 'punta' } },
  { key: 'profesional', label: 'Profesional', minLevel: 40, maxLevel: 49, color: 'cyan', emoji: '🥈',
    collection: 'Día de partido', kit: { primary: '#0b0f14', secondary: '#0e7490', pattern: 'franja', metal: 'plata', emblem: 'tv', shape: 'punta' } },
  { key: 'crack', label: 'Crack', minLevel: 50, maxLevel: 59, color: 'red', emoji: '🥈',
    collection: 'El Clásico', kit: { primary: '#dc2626', secondary: '#1d4ed8', pattern: 'mitad', metal: 'plata', emblem: 'banderas', shape: 'punta' } },
  { key: 'figura', label: 'Figura', minLevel: 60, maxLevel: 69, color: 'blue', emoji: '🥇',
    collection: 'Noches de Copa', kit: { primary: '#1e3a8a', secondary: '#0b1437', pattern: 'rayas', metal: 'oro', emblem: 'copa', shape: 'almenado' } },
  { key: 'idolo', label: 'Ídolo', minLevel: 70, maxLevel: 79, color: 'sky', emoji: '🥇',
    collection: 'La Hinchada', kit: { primary: '#38bdf8', secondary: '#ffffff', pattern: 'bastones-anchos', metal: 'oro', emblem: 'bufanda', shape: 'almenado' } },
  { key: 'icono', label: 'Ícono', minLevel: 80, maxLevel: 89, color: 'violet', emoji: '🥇',
    collection: 'Bestias', kit: { primary: '#581c87', secondary: '#1e0b2e', pattern: 'v', metal: 'oro', emblem: 'zarpazo', shape: 'almenado' } },
  { key: 'leyenda', label: 'Leyenda', minLevel: 90, maxLevel: 99, color: 'gold', emoji: '💎',
    collection: 'Gloria', kit: { primary: '#d97706', secondary: '#78350f', pattern: 'lisa', metal: 'diamante', emblem: 'laurel', shape: 'corona' } },
  { key: 'goat', label: 'GOAT', minLevel: 100, maxLevel: 100, color: 'champion', emoji: '🐐',
    collection: 'Álbum completo', kit: { primary: '#f9a8d4', secondary: '#a5f3fc', pattern: 'holo', metal: 'holo', emblem: 'cabra', shape: 'cuernos' } },
].map(t => ({ ...t, image: `/badges/rangos/${t.key}.svg` }))

export const TIER_KEYS = TIERS.map(t => t.key)
export function getTierByKey(key) { return TIERS.find(t => t.key === key) || null }

// DESBLOQUEABLES por rango (popup "Ver todos los rangos" / cartas del ascenso).
// Los 6 primeros conservan los style_key viejos (CSS/CosmeticIcon existentes).
// Los nuevos usan claves rank_<key>/medal_<key>/tier_<key>: PrizeCard cae al
// render genérico hasta que el kit v2 se pinte con RankCrest/RankMedallion/RankBanner
// (ver docs/relanzamiento/PROGRESION.md · pendientes).
// El GRANT real por nivel: supabase/rank-cosmetics.sql + pendientes/2026-11-24-11-colecciones.sql.
export const TIER_UNLOCKS = {
  aficionado:  { banner: 'tier_aficionado',  frame: 'medal_bronze',   icon: 'rank_bronze' },
  juvenil:     { banner: 'tier_juvenil',     frame: 'medal_silver',   icon: 'rank_silver' },
  amateur:     { banner: 'tier_amateur',     frame: 'medal_gold',     icon: 'rank_gold' },
  reserva:     { banner: 'tier_reserva',     frame: 'medal_emerald',  icon: 'rank_emerald' },
  profesional: { banner: 'tier_profesional', frame: 'medal_diamond',  icon: 'rank_cyan' },
  crack:       { banner: 'tier_crack',       frame: 'medal_champion', icon: 'rank_champion' },
  figura:      { banner: 'tier_figura',      frame: 'medal_figura',   icon: 'rank_figura' },
  idolo:       { banner: 'tier_idolo',       frame: 'medal_idolo',    icon: 'rank_idolo' },
  icono:       { banner: 'tier_icono',       frame: 'medal_icono',    icon: 'rank_icono' },
  leyenda:     { banner: 'tier_leyenda',     frame: 'medal_leyenda',  icon: 'rank_leyenda' },
  goat:        { banner: 'tier_goat',        frame: 'medal_goat',     icon: 'rank_goat' },
}

export function getTierForLevel(level) {
  const lvl = Number(level || 0)
  let found = null
  for (const t of TIERS) {
    if (lvl >= (t.minLevel || 1) && (t.maxLevel ? lvl <= t.maxLevel : true)) {
      if (!found || t.minLevel > found.minLevel) found = t
    }
  }
  // Por encima del máximo (no debería pasar) → último rango
  if (!found && lvl > TIERS[TIERS.length - 1].maxLevel) found = TIERS[TIERS.length - 1]
  return found
}

export function getNextTier(level) {
  const lvl = Number(level || 0)
  const future = TIERS.filter(t => (t.minLevel || 1) > lvl)
  future.sort((a, b) => (a.minLevel || 0) - (b.minLevel || 0))
  return future[0] || null
}

// Texto de acento por color de rango (fuente única para header/perfil/level-up/popup).
export const TIER_ACCENT_TEXT = {
  bronze: 'text-amber-500', orange: 'text-orange-400', amber: 'text-yellow-400',
  emerald: 'text-emerald-400', cyan: 'text-cyan-400', red: 'text-red-400',
  blue: 'text-blue-400', sky: 'text-sky-300', violet: 'text-violet-400',
  gold: 'text-amber-300', champion: 'text-pink-200',
  // compat con colores viejos
  silver: 'text-slate-300',
}
export function tierAccentText(colorKey) {
  return TIER_ACCENT_TEXT[colorKey] || 'text-emerald-400'
}

/** Color de brillo (hex) por rango: para glows/acentos en escenas. */
export const TIER_GLOW = {
  aficionado: '#ea580c', juvenil: '#fb923c', amateur: '#facc15', reserva: '#34d399',
  profesional: '#22d3ee', crack: '#f87171', figura: '#60a5fa', idolo: '#7dd3fc',
  icono: '#c084fc', leyenda: '#fbbf24', goat: '#f9a8d4',
}
export function tierGlow(tierOrKey) {
  const k = typeof tierOrKey === 'string' ? tierOrKey : tierOrKey?.key
  return TIER_GLOW[k] || '#fcd34d'
}

export function tierColorClasses(colorKey) {
  switch (colorKey) {
    case 'bronze': return 'border-amber-600/40 bg-amber-600/10 text-amber-400'
    case 'silver': return 'border-slate-400/40 bg-slate-400/10 text-slate-300'
    case 'gold': return 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300'
    case 'cyan': return 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300'
    case 'champion': return 'border-pink-300/50 bg-pink-300/10 text-pink-200'
    case 'red': return 'border-red-500/40 bg-red-500/10 text-red-300'
    case 'orange': return 'border-orange-500/40 bg-orange-500/10 text-orange-300'
    case 'amber': return 'border-amber-500/40 bg-amber-500/10 text-amber-300'
    case 'emerald': return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
    case 'sky': return 'border-sky-500/40 bg-sky-500/10 text-sky-300'
    case 'blue': return 'border-blue-500/40 bg-blue-500/10 text-blue-300'
    case 'violet': return 'border-violet-500/40 bg-violet-500/10 text-violet-300'
    default: return 'border-white/20 text-slate-200'
  }
}

/**
 * Kit que trae cada rango al llegar, con el copy acordado
 * ("Ícono de rango Ícono" para 80–89). Formato compatible con PrizeCard
 * (kind/name/rarity/styleKey) + `tierKey` para dibujarlo con RankCrest/RankMedallion/RankBanner.
 * TODO (prize-card.js, otro dueño): tierPrizes() debería delegar acá.
 */
export function rankKitPrizes(tier) {
  const t = typeof tier === 'string' ? getTierByKey(tier) : tier
  const tu = t && TIER_UNLOCKS[t.key]
  if (!tu) return []
  return [
    { kind: 'icon', part: 'crest', name: `Ícono de rango ${t.label}`, rarity: 'legendary', styleKey: tu.icon, tierKey: t.key },
    { kind: 'frame', part: 'medallion', name: `Medallón ${t.label}`, rarity: 'epic', styleKey: tu.frame, tierKey: t.key },
    { kind: 'banner', part: 'banner', name: `Banner ${t.label}`, rarity: 'epic', styleKey: tu.banner, tierKey: t.key },
  ]
}
