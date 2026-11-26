/**
 * Estilo compartido de las "piezas" del vestuario (V4: Colección, Colecciones,
 * Tienda, Perfil). Módulo puro: colores por rareza (de services/rarity.js), etiquetas y si una pieza
 * tiene arte para dibujarse (las piezas nuevas de colecciones todavía no lo
 * tienen → se muestran apagadas).
 */
import { FRAME_STYLES, BANNER_STYLES } from '../../services/cosmetics'
import { RARITY } from '../../services/rarity'

// Colores de rareza: fuente única en services/rarity.js (paleta de los moodboards de motion).
export const PIECE_RARITY = RARITY
export function pieceRarity(r) { return PIECE_RARITY[r] || PIECE_RARITY.common }

export const KIND_LABEL = { icon: 'Ícono', frame: 'Borde', banner: 'Banner', title: 'Título' }

/** '#rrggbb' + alfa → 'rgba(...)'. */
export function hexA(hex, a) {
  const n = parseInt(String(hex || '#000000').slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

// Íconos que CosmeticIcon sabe dibujar (SVG propio o .webp en public/cosmetics/icons).
const ICON_KEYS = new Set(['ball', 'boot', 'gloves', 'medal', 'trophy', 'goat', 'crown', 'star', 'shield', 'bolt', 'flame', 'gem', 'owl', 'broom', 'sun', 'clover', 'sword', 'hat', 'laurel', 'chat', 'butterfly', 'globe', 'comet', 'phoenix', 'rank_bronze', 'rank_silver', 'rank_gold', 'rank_emerald', 'rank_cyan', 'rank_champion', 'rank_figura', 'rank_idolo', 'rank_icono', 'rank_leyenda', 'rank_goat', '⚽', '👟', '🧤', '🏅', '🏆', '🐐', '👑', '⭐', '🛡️', '🛡'])

/** ¿La pieza tiene arte real para dibujarse? (type + style_key del catálogo) */
export function hasArt(c) {
  if (!c) return false
  const k = c.style_key || c.styleKey || ''
  if (c.type === 'title') return true
  if (c.type === 'icon') return ICON_KEYS.has(k)
  if (c.type === 'frame') return !!k && k !== 'none' && !!FRAME_STYLES[k]
  if (c.type === 'banner') return !!k && !!BANNER_STYLES[k]
  return false
}

/** Cómo se consigue una pieza que todavía no tenés (texto corto, sin hover). */
export function howToGet(c) {
  if (!c) return ''
  if (c.unlock_achievement) return 'Logro secreto'
  if (c.premium_only) return 'Plan PRO'
  if (c.unlock_level > 100) return 'Abono del mes'
  if (c.unlock_level > 1) return `Nv ${c.unlock_level}`
  return 'Tienda'
}
