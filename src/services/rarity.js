/**
 * COLORES DE RAREZA · fuente única (PrizeCard, Tienda, Colección, Colecciones, Abono,
 * gema de rareza, subida de nivel).
 *
 * Base: los moodboards de motion (Reclamar / Carta de recompensa), que son los que
 * Alejo cerró para las escenas por rareza: común #cbd5e1, rara #38bdf8,
 * épica #e879f9, legendaria #fbbf24. Reemplaza la paleta del BRIEF v4
 * (#94a3b8 / #60a5fa / #a855f7 / #fbbf24), que solo coincidía en legendaria.
 *
 *   c     → color principal (gema, borde, texto de la etiqueta)
 *   dark  → sombra / fondo del marco de la carta
 *   light → brillo de la carta y de la gema
 *   t     → texto sobre fondo oscuro
 *   rgb   → para rgba(var(--rar-rgb) / a)
 */
export const RARITY = {
  common:    { key: 'common',    label: 'Común',      c: '#cbd5e1', dark: '#64748b', light: '#f8fafc', t: '#f1f5f9', rgb: '203 213 225' },
  rare:      { key: 'rare',      label: 'Raro',       c: '#38bdf8', dark: '#0369a1', light: '#bae6fd', t: '#bae6fd', rgb: '56 189 248' },
  epic:      { key: 'epic',      label: 'Épico',      c: '#e879f9', dark: '#a21caf', light: '#f5d0fe', t: '#f5d0fe', rgb: '232 121 249' },
  legendary: { key: 'legendary', label: 'Legendario', c: '#fbbf24', dark: '#b45309', light: '#fef3c7', t: '#fde68a', rgb: '251 191 36' },
}

export const RARITY_KEYS = ['common', 'rare', 'epic', 'legendary']

export function rarityOf(r) { return RARITY[r] || RARITY.common }

/** Variables CSS para un elemento: --rar, --rar-dark, --rar-light, --rar-t, --rar-rgb. */
export function rarityVars(r) {
  const x = rarityOf(r)
  return { '--rar': x.c, '--rar-dark': x.dark, '--rar-light': x.light, '--rar-t': x.t, '--rar-rgb': x.rgb }
}
