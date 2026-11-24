/**
 * COLECCIONES · una por categoría (rango). Relanzamiento 1–100.
 *
 * Cada pieza:
 *   name    → nombre visible
 *   kind    → 'icon' | 'banner' | 'title' | 'frame'
 *   route   → cómo se consigue:
 *     'kit'    → el kit del rango (ícono de rango, medallón, banner) al llegar al rango
 *     'camino' → por NIVEL dentro del rango (`level`): 1 borde/ícono/banner/título por categoría
 *     'logro'  → por un logro relacionado (`achievement`: código PROPUESTO, a crear)
 *     'premio' → al completar la colección (borde + título)
 *   legacy  → code de un cosmético que YA existe con ese nombre (no se duplica: se le asigna la colección)
 *
 * El SQL (supabase/pendientes/2026-11-24-11-colecciones.sql) se genera desde acá:
 *   node scripts/progresion-colecciones.mjs
 *
 * Criterio de tipos (Alejo pasó solo nombres): "entre comillas" = título; escenas
 * (Tiza, Alambrado, Noche de lluvia…) = banner; objetos en minúscula = ícono;
 * "borde X" = borde. Documentado en docs/relanzamiento/PROGRESION.md.
 */
import { TIERS } from '../services/tiers.js'

// Escalón por metal → rareza base de las piezas de la colección
const RARITY_BY_METAL = { bronce: 'common', plata: 'rare', oro: 'epic', diamante: 'legendary', holo: 'legendary' }
const BUMP = { common: 'rare', rare: 'epic', epic: 'legendary', legendary: 'legendary' }

// Offsets de nivel (desde el minLevel del rango) para las piezas 'camino'
const PATH_OFFSET = { frame: 1, icon: 3, banner: 6, title: 8 }

const RAW = [
  {
    key: 'potrero', name: 'El Potrero', tier: 'aficionado',
    blurb: 'Donde empezó todo: tierra, alambrado y una pelota de trapo.',
    pieces: [
      { name: 'Escudo del potrero', kind: 'icon', route: 'camino' },
      { name: 'Alambrado', kind: 'banner', route: 'camino' },
      { name: 'Pibe de potrero', kind: 'title', route: 'camino' },
      { name: 'Pelota de trapo', kind: 'icon', route: 'logro', achievement: 'col_potrero_trapo' },
      { name: 'Zapatillas', kind: 'icon', route: 'logro', achievement: 'col_potrero_zapatillas' },
      { name: 'Arco oxidado', kind: 'icon', route: 'logro', achievement: 'col_potrero_arco' },
      { name: 'Pelota de cuero', kind: 'icon', route: 'logro', achievement: 'col_potrero_cuero' },
      { name: 'Tiza', kind: 'banner', route: 'logro', achievement: 'col_potrero_tiza' },
      { name: 'Gajos de pelota', kind: 'frame', route: 'premio' },
      { name: 'Potrero puro', kind: 'title', route: 'premio' },
    ],
  },
  {
    key: 'inferiores', name: 'Las Inferiores', tier: 'juvenil',
    blurb: 'Conos, pechera y bolso: la escuelita del club.',
    pieces: [
      { name: 'Conos', kind: 'icon', route: 'camino' },
      { name: 'Cancha cortada', kind: 'banner', route: 'camino' },
      { name: 'Enganche', kind: 'title', route: 'camino' },
      { name: 'Pechera', kind: 'icon', route: 'logro', achievement: 'col_inferiores_pechera' },
      { name: 'Bolso', kind: 'icon', route: 'logro', achievement: 'col_inferiores_bolso' },
      { name: 'Punto penal', kind: 'banner', route: 'logro', achievement: 'col_inferiores_penal' },
      { name: 'Césped', kind: 'banner', route: 'logro', achievement: 'col_inferiores_cesped' },
      { name: 'Red de arco', kind: 'banner', route: 'logro', achievement: 'col_inferiores_red' },
    ],
  },
  {
    key: 'ascenso', name: 'El Ascenso', tier: 'amateur',
    blurb: 'Noches de lluvia, tablones y reflectores que tiemblan.',
    pieces: [
      { name: 'Farol', kind: 'icon', route: 'camino' },
      { name: 'Noche de lluvia', kind: 'banner', route: 'camino' },
      { name: 'Botín embarrado', kind: 'icon', route: 'logro', achievement: 'col_ascenso_botin' },
      { name: 'Tablón', kind: 'icon', route: 'logro', achievement: 'col_ascenso_tablon' },
      { name: 'Marcador del estadio', kind: 'banner', route: 'logro', achievement: 'col_ascenso_marcador' },
      { name: 'Reflectores', kind: 'banner', route: 'logro', achievement: 'col_ascenso_reflectores' },
    ],
  },
  {
    key: 'pizarra', name: 'La Pizarra', tier: 'reserva',
    blurb: 'El banco, la charla técnica y la cinta de capitán.',
    pieces: [
      { name: 'Capitán', kind: 'frame', route: 'camino' },
      { name: 'Pizarra', kind: 'icon', route: 'camino' },
      { name: 'Pizarra', kind: 'banner', route: 'camino' },
      { name: 'Suplente de lujo', kind: 'title', route: 'camino' },
      { name: 'Cinta', kind: 'icon', route: 'logro', achievement: 'col_pizarra_cinta' },
      { name: 'Túnel', kind: 'icon', route: 'logro', achievement: 'col_pizarra_tunel' },
      { name: 'Mapa de calor', kind: 'banner', route: 'logro', achievement: 'col_pizarra_mapa' },
      { name: 'DT de café', kind: 'title', route: 'logro', achievement: 'col_pizarra_dt' },
      { name: 'Pizarra magnética', kind: 'frame', route: 'premio' },
      { name: 'El Profe', kind: 'title', route: 'premio' },
    ],
  },
  {
    key: 'diadepartido', name: 'Día de partido', tier: 'profesional',
    blurb: 'Silbato, cámaras, VAR: todo lo que pasa un domingo de primera.',
    pieces: [
      { name: 'Silbato', kind: 'icon', route: 'camino' },
      { name: 'En vivo', kind: 'banner', route: 'camino' },
      { name: 'Banderín', kind: 'icon', route: 'logro', achievement: 'col_partido_banderin' },
      { name: 'Tarjeta roja', kind: 'icon', route: 'logro', achievement: 'col_partido_roja' },
      { name: 'Cronómetro', kind: 'icon', route: 'logro', achievement: 'col_partido_crono' },
      { name: 'Camiseta suplente', kind: 'icon', route: 'logro', achievement: 'col_partido_suplente' },
      { name: 'LED', kind: 'banner', route: 'logro', achievement: 'col_partido_led' },
      { name: 'VAR', kind: 'banner', route: 'logro', achievement: 'col_partido_var' },
      { name: 'Adentro del arco', kind: 'banner', route: 'premio' },
      { name: 'Figura del partido', kind: 'title', route: 'premio' },
    ],
  },
  {
    key: 'clasico', name: 'El Clásico', tier: 'crack',
    blurb: 'Bengalas, trapos gigantes y un gol sobre la hora.',
    pieces: [
      { name: 'Bengala', kind: 'icon', route: 'camino' },
      { name: 'El relato', kind: 'banner', route: 'camino' },
      { name: 'Sobre la hora', kind: 'title', route: 'camino' },
      { name: 'Trapo gigante', kind: 'icon', route: 'logro', achievement: 'col_clasico_trapo' },
      { name: 'Fuego', kind: 'banner', route: 'logro', achievement: 'col_clasico_fuego', legacy: 'banner_fire' },
    ],
  },
  {
    key: 'copa', name: 'Noches de Copa', tier: 'figura',
    blurb: 'Se prenden las luces: viajes, valijas y la copa.',
    pieces: [
      { name: 'Copa', kind: 'icon', route: 'camino' },
      { name: 'Se prenden las luces', kind: 'banner', route: 'camino' },
      { name: 'Valija', kind: 'icon', route: 'logro', achievement: 'col_copa_valija' },
      { name: 'Pelota de noche', kind: 'icon', route: 'logro', achievement: 'col_copa_pelota' },
      { name: 'Red de pases', kind: 'banner', route: 'logro', achievement: 'col_copa_red' },
    ],
  },
  {
    key: 'hinchada', name: 'La Hinchada', tier: 'idolo',
    blurb: 'Bombo, bufanda y la popular cantando tu nombre.',
    pieces: [
      { name: 'Bombo', kind: 'icon', route: 'camino' },
      { name: 'Recibimiento', kind: 'banner', route: 'camino' },
      { name: 'Hincha de ley', kind: 'title', route: 'camino' },
      { name: 'Bufanda', kind: 'icon', route: 'logro', achievement: 'col_hinchada_bufanda' },
      { name: 'Corneta', kind: 'icon', route: 'logro', achievement: 'col_hinchada_corneta' },
      { name: 'Tapa de diario', kind: 'banner', route: 'logro', achievement: 'col_hinchada_tapa' },
      { name: 'Bufanda', kind: 'frame', route: 'premio' },
      { name: 'De la popular', kind: 'title', route: 'premio' },
    ],
  },
  {
    key: 'bestias', name: 'Bestias', tier: 'icono',
    blurb: 'Ganaste el Balón de Oro: ahora te apodan como a las fieras.',
    pieces: [
      { name: 'León', kind: 'icon', route: 'camino' },
      { name: 'Lobo', kind: 'icon', route: 'logro', achievement: 'col_bestias_lobo' },
      { name: 'Toro', kind: 'icon', route: 'logro', achievement: 'col_bestias_toro' },
      { name: 'Águila', kind: 'icon', route: 'logro', achievement: 'col_bestias_aguila' },
      { name: 'Tiburón', kind: 'icon', route: 'logro', achievement: 'col_bestias_tiburon' },
      { name: 'Dragón', kind: 'icon', route: 'logro', achievement: 'col_bestias_dragon' },
      { name: 'Tormenta', kind: 'frame', route: 'premio' },
      { name: 'Fiera', kind: 'title', route: 'premio' },
    ],
  },
  {
    key: 'gloria', name: 'Gloria', tier: 'leyenda',
    blurb: 'Lo sostuviste años: pelota de oro, la 10 y laureles.',
    pieces: [
      { name: 'Pelota de oro', kind: 'icon', route: 'camino' },
      { name: 'Estrellas', kind: 'banner', route: 'camino' },
      { name: 'El que sabe', kind: 'title', route: 'camino' },
      { name: 'La 10', kind: 'icon', route: 'logro', achievement: 'col_gloria_diez' },
      { name: 'Botín alado', kind: 'icon', route: 'logro', achievement: 'col_gloria_botin' },
      { name: 'Laurel', kind: 'icon', route: 'logro', achievement: 'col_gloria_laurel', legacy: 'icon_laurel' },
      { name: 'Tres estrellas', kind: 'banner', route: 'premio' },
      { name: 'Leyenda del club', kind: 'title', route: 'premio' },
    ],
  },
  {
    key: 'album', name: 'Álbum completo', tier: 'goat',
    blurb: 'Las diez colecciones completas. El más grande.',
    pieces: [
      { name: 'GOAT', kind: 'icon', route: 'logro', achievement: null, legacy: 'icon_goat' },
      { name: 'Holográfico', kind: 'frame', route: 'premio' },
      { name: 'Hijo del fútbol', kind: 'title', route: 'premio' },
    ],
  },
]

function slug(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

/** Kit del rango como piezas de su colección (ya existen para los 6 primeros rangos). */
function kitPieces(tier, rarity) {
  const legacyFrame = { aficionado: 1, juvenil: 1, amateur: 1, reserva: 1, profesional: 1, crack: 1 }[tier.key]
  return [
    { name: `Ícono de rango ${tier.label}`, kind: 'icon', route: 'kit', level: tier.minLevel, rarity,
      code: `icon_rank_${tier.key}`, legacy: legacyFrame ? `icon_rank_${tier.key}` : null },
    { name: `Medallón ${tier.label}`, kind: 'frame', route: 'kit', level: tier.minLevel, rarity,
      code: `frame_rank_${tier.key}`, legacy: legacyFrame ? `frame_rank_${tier.key}` : null },
    { name: `Banner ${tier.label}`, kind: 'banner', route: 'kit', level: tier.minLevel, rarity,
      code: `banner_tier_${tier.key}`, legacy: legacyFrame ? `banner_tier_${tier.key}` : null },
  ]
}

export const COLLECTIONS = RAW.map(c => {
  const tier = TIERS.find(t => t.key === c.tier)
  const base = RARITY_BY_METAL[tier.kit.metal] || 'common'
  const pieces = c.pieces.map(p => {
    const level = p.route === 'camino' ? Math.min(tier.maxLevel, tier.minLevel + (PATH_OFFSET[p.kind] ?? 2)) : null
    const rarity = p.route === 'premio' ? 'legendary' : p.route === 'logro' ? BUMP[base] : base
    const code = p.legacy || `col_${c.key}_${p.kind}_${slug(p.name)}`
    return { ...p, level, rarity, code, achievement: p.achievement ?? null, legacy: p.legacy || null }
  })
  return {
    key: c.key,
    name: c.name,
    tierKey: tier.key,
    tierLabel: tier.label,
    minLevel: tier.minLevel,
    maxLevel: tier.maxLevel,
    blurb: c.blurb,
    pieces: [...kitPieces(tier, base), ...pieces],
  }
})

export function getCollection(key) { return COLLECTIONS.find(c => c.key === key) || null }
export function getCollectionForTier(tierKey) { return COLLECTIONS.find(c => c.tierKey === tierKey) || null }

/** Piezas en el camino (por nivel) de una colección, ordenadas por nivel. */
export function pathPieces(col) {
  return (col?.pieces || []).filter(p => p.route === 'kit' || p.route === 'camino').sort((a, b) => a.level - b.level)
}

/** Premio por completar (borde/banner + título). */
export function collectionPrize(col) {
  return (col?.pieces || []).filter(p => p.route === 'premio')
}

/** Progreso de una colección dado un Set de codes que el usuario tiene. */
export function collectionProgress(col, ownedCodes) {
  const owned = ownedCodes instanceof Set ? ownedCodes : new Set(ownedCodes || [])
  const needed = (col?.pieces || []).filter(p => p.route !== 'premio')
  const have = needed.filter(p => owned.has(p.code)).length
  return { have, total: needed.length, complete: needed.length > 0 && have === needed.length }
}
