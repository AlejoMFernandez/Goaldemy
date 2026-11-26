/**
 * Claves de íconos cosméticos que la app sabe dibujar. Fuente única para
 * CosmeticIcon.vue (qué dibuja) y piece-style.js (si una pieza "tiene arte").
 *
 *  SVG_ICON_KEYS     → dibujo SVG propio en CosmeticIcon (respaldo si falta el .webp).
 *  VESTUARIO_ICONS   → los 23 del vestuario nuevo (09/2026): SOLO arte raster .webp.
 *  RANK_ICON_KEYS    → arte del kit de rango (public/cosmetics/rank/icon-<rango>.svg).
 *  RASTER_ICON_KEYS  → los que tienen public/cosmetics/icons/<clave>.webp.
 */
export const SVG_ICON_KEYS = ['ball', 'boot', 'gloves', 'medal', 'trophy', 'goat', 'crown', 'star', 'shield', 'bolt', 'flame', 'gem', 'owl', 'broom', 'sun', 'clover', 'sword', 'hat', 'laurel', 'chat', 'butterfly', 'globe', 'comet', 'phoenix']

export const VESTUARIO_ICONS = [
  'bufanda', 'bombo', 'corneta', 'silbato', 'banderin', 'tarjeta_roja', 'cinta', 'cronometro', 'pizarra', 'tunel', 'lobo', 'toro',
  'leon', 'tiburon', 'aguila', 'dragon', 'zapatillas', 'arco_oxidado', 'pelota_trapo', 'taco', 'botin_alado', 'pelota_oro', 'camiseta_10',
]

export const RANK_ICON_KEYS = ['rank_bronze', 'rank_silver', 'rank_gold', 'rank_emerald', 'rank_cyan', 'rank_champion', 'rank_figura', 'rank_idolo', 'rank_icono', 'rank_leyenda', 'rank_goat']

export const RASTER_ICON_KEYS = new Set([...SVG_ICON_KEYS, ...VESTUARIO_ICONS])

export const KNOWN_ICON_KEYS = new Set([...SVG_ICON_KEYS, ...RANK_ICON_KEYS, ...VESTUARIO_ICONS])

// style_key legacy en emoji → clave semántica
export const ICON_EMOJI_MAP = {
  '⚽': 'ball', '👟': 'boot', '🧤': 'gloves', '🏅': 'medal',
  '🏆': 'trophy', '🐐': 'goat', '👑': 'crown', '⭐': 'star', '🛡️': 'shield', '🛡': 'shield',
}

/** Clave semántica de un style_key (o '' si la app no la conoce). */
export function iconKeyOf(styleKey) {
  const k = String(styleKey || '').trim()
  if (KNOWN_ICON_KEYS.has(k)) return k
  return ICON_EMOJI_MAP[k] || ''
}
