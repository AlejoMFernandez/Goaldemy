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
/**
 * COLECCIONES · una por categoría (rango). Relanzamiento 1–100.
 *
 * Fuente: artifact "El camino 1–100" (Alejo, 02/10), posterior al Kit de rango.
 *
 * Cada pieza:
 *   name    → nombre visible
 *   kind    → 'icon' | 'banner' | 'title' | 'frame'
 *   route   → cómo se consigue:
 *     'kit'    → el kit del rango (ícono de rango, medallón, banner) al llegar al rango
 *     'camino' → por NIVEL dentro del rango: 4 piezas por rango en los niveles x2, x4, x6 y x8
 *                (ícono, título, banner y borde, en ese orden)
 *     'logro'  → por un logro relacionado (`achievement`: código PROPUESTO si `how` es nuevo)
 *     'premio' → al completar la colección (borde/banner + título)
 *   legacy  → code de un cosmético que YA existe con ese nombre (no se duplica: se le asigna la colección)
 *   how     → texto del logro (del artifact)
 *
 * Rareza por tramo de la carrera (no por metal): Aficionado y Juvenil común; Amateur a
 * Profesional raro; Crack a Ídolo épico; Ícono, Leyenda y GOAT legendario. Las piezas de
 * logro suben un escalón; las de premio son legendarias.
 *
 * Choques resueltos (Camino): Gloria va a Ícono (80–89) y Bestias a Leyenda (90–99);
 * Pelota de oro → Botín de oro; "La 10" → "Diez de diez"; la cabra (GOAT) pasa del nivel
 * 55 al 100; títulos "Figura del partido" → "Jugador del partido" y "Leyenda del club" →
 * "Bandera del club". Placa de nivel, Capitán (título) y Símbolo del club van a la tienda.
 *
 * El SQL (supabase/pendientes/2026-11-24-11-colecciones.sql) se genera desde acá:
 *   node scripts/progresion-colecciones.mjs
 */
import { TIERS } from '../services/tiers.js'

/** Rareza base de cada rango (tramo de la carrera). */
export const TIER_RARITY = {
  aficionado: 'common', juvenil: 'common',
  amateur: 'rare', reserva: 'rare', profesional: 'rare',
  crack: 'epic', figura: 'epic', idolo: 'epic',
  icono: 'legendary', leyenda: 'legendary', goat: 'legendary',
}
const BUMP = { common: 'rare', rare: 'epic', epic: 'legendary', legendary: 'legendary' }

// Nivel (desde el minLevel del rango) de cada pieza del camino: 2 ícono, 4 título, 6 banner, 8 borde
export const PATH_OFFSET = { icon: 2, title: 4, banner: 6, frame: 8 }

const RAW = [
  {
    key: 'potrero', name: 'El Potrero', tier: 'aficionado',
    blurb: 'Donde empezó todo: tierra, alambrado y una pelota de trapo.',
    pieces: [
      { name: 'Pelota de trapo', kind: 'icon', route: 'camino' },
      { name: 'Pibe de potrero', kind: 'title', route: 'camino' },
      { name: 'Cuero', kind: 'banner', route: 'camino' },
      { name: 'Tiza', kind: 'frame', route: 'camino' },
      { name: 'Zapatillas', kind: 'icon', route: 'logro', achievement: 'col_potrero_zapatillas', how: 'Jugá tus primeros 10 partidos' },
      { name: 'Arco oxidado', kind: 'icon', route: 'logro', achievement: 'col_potrero_arco', how: 'Perdé 10 partidos y seguí jugando' },
      { name: 'Escudo del potrero', kind: 'icon', route: 'logro', achievement: 'col_potrero_escudo', how: 'Ganá tu primera jornada completa' },
      { name: 'Alambrado', kind: 'frame', route: 'logro', achievement: 'col_potrero_alambrado', how: 'Jugá 30 partidos' },
      { name: 'Gajos de pelota', kind: 'frame', route: 'premio' },
      { name: 'Potrero puro', kind: 'title', route: 'premio' },
    ],
  },
  {
    key: 'inferiores', name: 'Las Inferiores', tier: 'juvenil',
    blurb: 'Conos, pechera y bolso: la escuelita del club.',
    pieces: [
      { name: 'Conos', kind: 'icon', route: 'camino' },
      { name: 'Enganche', kind: 'title', route: 'camino' },
      { name: 'Cancha cortada', kind: 'banner', route: 'camino' },
      { name: 'Césped', kind: 'frame', route: 'camino' },
      { name: 'Punto penal', kind: 'banner', route: 'logro', achievement: 'col_inferiores_penal', how: 'Ganá 3 partidos de Adiviná el jugador sin ayudas' },
      { name: 'Red de arco', kind: 'frame', route: 'logro', achievement: 'col_inferiores_red', how: 'Llegá a 100 aciertos' },
      { name: 'Pechera', kind: 'icon', route: 'logro', achievement: 'col_inferiores_pechera', how: 'Jugá todos los juegos al menos una vez' },
      { name: 'Bolso', kind: 'icon', route: 'logro', achievement: 'col_inferiores_bolso', how: 'Entrá 10 días distintos' },
    ],
  },
  {
    key: 'ascenso', name: 'El Ascenso', tier: 'amateur',
    blurb: 'Noches de lluvia, tablones y reflectores que tiemblan.',
    pieces: [
      { name: 'Botín embarrado', kind: 'icon', route: 'camino' },
      { name: 'Ascendido', kind: 'title', route: 'camino' },
      { name: 'Noche de lluvia', kind: 'banner', route: 'camino' },
      { name: 'Reflectores', kind: 'frame', route: 'camino' },
      { name: 'Marcador del estadio', kind: 'banner', route: 'logro', achievement: 'col_ascenso_marcador', how: 'Terminá 50 partidos' },
      { name: 'Tablón', kind: 'icon', route: 'logro', achievement: 'col_ascenso_tablon', how: 'Racha de 3 días' },
      { name: 'Farol', kind: 'icon', route: 'logro', achievement: 'col_ascenso_farol', how: 'Ganá 3 partidos en difícil' },
    ],
  },
  {
    key: 'pizarra', name: 'La Pizarra', tier: 'reserva',
    blurb: 'El banco, la charla técnica y la cinta de capitán.',
    pieces: [
      { name: 'Túnel', kind: 'icon', route: 'camino' },
      { name: 'Suplente de lujo', kind: 'title', route: 'camino' },
      { name: 'Mapa de calor', kind: 'banner', route: 'camino' },
      { name: 'Capitán', kind: 'frame', route: 'camino' },
      { name: 'Pizarra', kind: 'icon', route: 'logro', achievement: 'col_pizarra_icono', how: 'Experto en posiciones' },
      { name: 'Pizarra', kind: 'banner', route: 'logro', achievement: 'col_pizarra_banner', how: 'Experto en posiciones' },
      { name: 'Cinta de capitán', kind: 'icon', route: 'logro', achievement: 'col_pizarra_cinta', how: 'Jugá 20 días distintos' },
      { name: 'DT de café', kind: 'title', route: 'logro', achievement: 'col_pizarra_dt', how: 'Ordená 10 tableros perfectos' },
      { name: 'Pizarra magnética', kind: 'frame', route: 'premio' },
      { name: 'El Profe', kind: 'title', route: 'premio' },
    ],
  },
  {
    key: 'diadepartido', name: 'Día de partido', tier: 'profesional',
    blurb: 'Silbato, cámaras, VAR: todo lo que pasa un domingo de primera.',
    pieces: [
      { name: 'Silbato', kind: 'icon', route: 'camino' },
      { name: 'Titular indiscutido', kind: 'title', route: 'camino' },
      { name: 'En vivo', kind: 'banner', route: 'camino' },
      { name: 'LED', kind: 'frame', route: 'camino' },
      { name: 'Cronómetro', kind: 'icon', route: 'logro', achievement: 'col_partido_crono', how: 'Ni la mitad' },
      { name: 'Banderín', kind: 'icon', route: 'logro', achievement: 'col_partido_banderin', how: 'Jugá 100 partidos' },
      { name: 'Tarjeta roja', kind: 'icon', route: 'logro', achievement: 'col_partido_roja', how: 'Errá 3 seguidas y ganá igual' },
      { name: 'VAR', kind: 'banner', route: 'logro', achievement: 'col_partido_var', how: 'Ganá 10 partidos sin errores' },
      { name: 'Camiseta suplente', kind: 'banner', route: 'logro', achievement: 'col_partido_suplente', how: 'Jugá 5 juegos distintos en un día' },
      { name: 'Adentro del arco', kind: 'banner', route: 'premio' },
      { name: 'Jugador del partido', kind: 'title', route: 'premio' },
    ],
  },
  {
    key: 'clasico', name: 'El Clásico', tier: 'crack',
    blurb: 'Bengalas, trapos gigantes y un gol sobre la hora.',
    pieces: [
      { name: 'Bengala', kind: 'icon', route: 'camino' },
      { name: 'Sobre la hora', kind: 'title', route: 'camino' },
      { name: 'Clásico dividido', kind: 'banner', route: 'camino' },
      { name: 'Humo de colores', kind: 'frame', route: 'camino' },
      { name: 'El relato', kind: 'banner', route: 'logro', achievement: 'col_clasico_relato', how: 'Tiempo de descuento' },
      { name: 'Fuego', kind: 'banner', route: 'logro', achievement: 'col_clasico_fuego', legacy: 'banner_fire', how: 'Racha de 14 días' },
      { name: 'Trapo gigante', kind: 'icon', route: 'logro', achievement: 'col_clasico_trapo', how: 'Ganá 7 jornadas seguidas' },
    ],
  },
  {
    key: 'copa', name: 'Noches de Copa', tier: 'figura',
    blurb: 'Se prenden las luces: viajes, valijas y la copa.',
    pieces: [
      { name: 'Pelota de noche', kind: 'icon', route: 'camino' },
      { name: 'Rey de copas', kind: 'title', route: 'camino' },
      { name: 'Se prenden las luces', kind: 'banner', route: 'camino' },
      { name: 'Noche de copa', kind: 'frame', route: 'camino' },
      { name: 'Red de pases', kind: 'banner', route: 'logro', achievement: 'col_copa_red', how: 'Trotamundos' },
      { name: 'Valija', kind: 'icon', route: 'logro', achievement: 'col_copa_valija', how: 'Jugá 30 días distintos' },
    ],
  },
  {
    key: 'hinchada', name: 'La Hinchada', tier: 'idolo',
    blurb: 'Bombo, bufanda y la popular cantando tu nombre.',
    pieces: [
      { name: 'Bufanda', kind: 'icon', route: 'camino' },
      { name: 'Hincha de ley', kind: 'title', route: 'camino' },
      { name: 'Banderazo', kind: 'banner', route: 'camino' },
      { name: 'Trapos colgados', kind: 'frame', route: 'camino' },
      { name: 'Bombo', kind: 'icon', route: 'logro', achievement: 'col_hinchada_bombo', how: 'Racha de 5 días' },
      { name: 'Recibimiento', kind: 'banner', route: 'logro', achievement: 'col_hinchada_recibimiento', how: 'Ganá todas las jornadas' },
      { name: 'Tapa de diario', kind: 'banner', route: 'logro', achievement: 'col_hinchada_tapa', how: 'Ganá 5 jornadas' },
      { name: 'Corneta', kind: 'icon', route: 'logro', achievement: 'col_hinchada_corneta', how: 'Jugá 60 días distintos' },
      { name: 'Bufanda', kind: 'frame', route: 'premio' },
      { name: 'De la popular', kind: 'title', route: 'premio' },
    ],
  },
  {
    key: 'gloria', name: 'Gloria', tier: 'icono',
    blurb: 'Ganaste el Balón de Oro: alfombra roja, laureles y la 10.',
    pieces: [
      { name: 'Botín de oro', kind: 'icon', route: 'camino' },
      { name: 'El que sabe', kind: 'title', route: 'camino' },
      { name: 'Alfombra roja', kind: 'banner', route: 'camino' },
      { name: 'Laurel dorado', kind: 'frame', route: 'camino' },
      { name: 'Diez de diez', kind: 'icon', route: 'logro', achievement: 'col_gloria_diez', how: 'Decena perfecta' },
      { name: 'Botín alado', kind: 'icon', route: 'logro', achievement: 'col_gloria_botin', how: 'Relámpago' },
      { name: 'Estrellas', kind: 'frame', route: 'logro', achievement: 'col_gloria_estrellas', how: 'Invicto toda la temporada' },
      { name: 'Tres estrellas', kind: 'banner', route: 'premio' },
      { name: 'Bandera del club', kind: 'title', route: 'premio' },
    ],
  },
  {
    key: 'bestias', name: 'Bestias', tier: 'leyenda',
    blurb: 'Las leyendas del fútbol, apodadas como fieras.',
    pieces: [
      { name: 'León', kind: 'icon', route: 'camino' },
      { name: 'Indomable', kind: 'title', route: 'camino' },
      { name: 'Rugido', kind: 'banner', route: 'camino' },
      { name: 'Garras', kind: 'frame', route: 'camino' },
      { name: 'Águila', kind: 'icon', route: 'logro', achievement: 'col_bestias_aguila', how: 'Hat-trick' },
      { name: 'Tiburón', kind: 'icon', route: 'logro', achievement: 'col_bestias_tiburon', how: 'Invicto' },
      { name: 'Dragón', kind: 'icon', route: 'logro', achievement: 'col_bestias_dragon', how: 'Invicto toda la temporada' },
      { name: 'Lobo', kind: 'icon', route: 'logro', achievement: 'col_bestias_lobo', how: 'Ganá 5 jornadas seguidas' },
      { name: 'Toro', kind: 'icon', route: 'logro', achievement: 'col_bestias_toro', how: 'Racha de 30 días' },
      { name: 'Tormenta', kind: 'frame', route: 'premio' },
      { name: 'Fiera', kind: 'title', route: 'premio' },
    ],
  },
  {
    key: 'album', name: 'Álbum completo', tier: 'goat',
    blurb: 'Las diez colecciones completas. El más grande.',
    pieces: [
      // La cabra se muda del nivel 55 al 100 (quien ya la tiene la conserva: ver el SQL)
      { name: 'GOAT', kind: 'icon', route: 'camino', level: 100, legacy: 'icon_goat' },
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
  const legacy = { aficionado: 1, juvenil: 1, amateur: 1, reserva: 1, profesional: 1, crack: 1 }[tier.key]
  return [
    { name: `Ícono de rango ${tier.label}`, kind: 'icon', route: 'kit', level: tier.minLevel, rarity,
      code: `icon_rank_${tier.key}`, legacy: legacy ? `icon_rank_${tier.key}` : null },
    { name: `Medallón ${tier.label}`, kind: 'frame', route: 'kit', level: tier.minLevel, rarity,
      code: `frame_rank_${tier.key}`, legacy: legacy ? `frame_rank_${tier.key}` : null },
    { name: `Banner ${tier.label}`, kind: 'banner', route: 'kit', level: tier.minLevel, rarity,
      code: `banner_tier_${tier.key}`, legacy: legacy ? `banner_tier_${tier.key}` : null },
  ]
}

export const COLLECTIONS = RAW.map(c => {
  const tier = TIERS.find(t => t.key === c.tier)
  const base = TIER_RARITY[tier.key] || 'common'
  const pieces = c.pieces.map(p => {
    const level = p.route === 'camino' ? (p.level ?? Math.min(tier.maxLevel, tier.minLevel + (tier.minLevel === 1 ? PATH_OFFSET[p.kind] - 1 : PATH_OFFSET[p.kind]))) : null
    const rarity = p.route === 'premio' ? 'legendary' : p.route === 'logro' ? BUMP[base] : base
    const code = p.legacy || `col_${c.key}_${p.kind}_${slug(p.name)}`
    return { ...p, level, rarity, code, achievement: p.achievement ?? null, legacy: p.legacy || null, how: p.how || null }
  })
  return {
    key: c.key,
    name: c.name,
    tierKey: tier.key,
    tierLabel: tier.label,
    minLevel: tier.minLevel,
    maxLevel: tier.maxLevel,
    rarity: base,
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
