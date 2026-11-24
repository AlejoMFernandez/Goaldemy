/**
 * KIT DE RANGO v2 · escudos, medallones y banners generados por CÓDIGO.
 *
 * Criterio común (decisión de Alejo): estilo club, simple, SIN animación propia.
 * Cada categoría = 2 colores + dibujo de camiseta + emblema monolínea; el metal
 * del aro marca el escalón (bronce → plata → oro → diamante → holográfico) y la
 * forma del escudo también (redondeado 1–29 · punta 30–59 · almenado 60–89 ·
 * corona 90–99 · cuernos 100).
 *
 * Todo sale de un template + parámetros, en PARTES separadas (aro, campo,
 * medallón central, emblema, cinta, extra de forma) para que las escenas
 * (Forja en LevelUpOverlay) puedan animar cada pieza.
 *
 * Sin DOM: lo importa también el script de Node que genera
 * docs/relanzamiento/rangos-preview.html y public/badges/rangos/*.svg.
 */
import { TIERS } from './tiers.js'

// ── Metales ────────────────────────────────────────────────
export const METALS = {
  bronce:   { stops: ['#f6c08a', '#c97b3c', '#7a3d15', '#e0a06a'], ink: '#fde3c8', name: 'Bronce' },
  plata:    { stops: ['#ffffff', '#b6c2d1', '#5b6b80', '#e5ebf2'], ink: '#f1f5f9', name: 'Plata' },
  oro:      { stops: ['#fff6c2', '#f5c542', '#a26a07', '#fde68a'], ink: '#fff7d6', name: 'Oro' },
  diamante: { stops: ['#ffffff', '#c7f0ff', '#5fd3f3', '#eef9ff'], ink: '#ecfeff', name: 'Diamante' },
  holo:     { stops: ['#f9a8d4', '#c4b5fd', '#a5f3fc', '#bbf7d0', '#fde68a'], ink: '#ffffff', name: 'Holográfico' },
}

// ── Formas (viewBox 0 0 120 140) ───────────────────────────
// body: contorno del escudo · layout: centro del medallón y altura de la cinta
// extra: pieza aparte (corona / cuernos) que se dibuja en metal
export const SHAPES = {
  redondeado: {
    body: 'M10 16 Q10 8 18 8 H102 Q110 8 110 16 V70 Q110 112 60 134 Q10 112 10 70 Z',
    layout: { cy: 60, ribbonY: 96 },
  },
  punta: {
    body: 'M10 8 H110 V76 L60 134 L10 76 Z',
    layout: { cy: 58, ribbonY: 94 },
  },
  almenado: {
    body: 'M10 6 H30 V16 H50 V6 H70 V16 H90 V6 H110 V74 Q110 112 60 134 Q10 112 10 74 Z',
    layout: { cy: 62, ribbonY: 98 },
  },
  corona: {
    body: 'M12 30 H108 V82 Q108 116 60 136 Q12 116 12 82 Z',
    extra: 'M18 32 L14 8 L36 20 L60 2 L84 20 L106 8 L102 32 Z',
    extraDetail: '<circle cx="14" cy="8" r="3.4"/><circle cx="60" cy="3" r="3.8"/><circle cx="106" cy="8" r="3.4"/>',
    layout: { cy: 72, ribbonY: 104 },
  },
  cuernos: {
    body: 'M14 30 Q60 22 106 30 V82 Q106 116 60 136 Q14 116 14 82 Z',
    extra: 'M22 32 C6 26 0 12 8 0 C10 14 20 20 34 26 Z M98 32 C114 26 120 12 112 0 C110 14 100 20 86 26 Z',
    layout: { cy: 72, ribbonY: 104 },
  },
}

// ── Dibujos de camiseta (sobre el campo 0..120 × 0..140) ───
const W = 120, H = 140
const rect = (x, y, w, h, c) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`
function stripes(step, width, c) {
  let s = ''
  for (let x = (step - width) / 2; x < W; x += step) s += rect(x.toFixed(1), 0, width, H, c)
  return s
}
export const PATTERNS = {
  lisa: (a, b) => rect(0, 0, W, H, a) + rect(0, 0, W, 12, b) + rect(0, H - 22, W, 22, b) + `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#__UID__-shade)"/>`,
  bastones: (a, b) => rect(0, 0, W, H, a) + stripes(24, 11, b),
  banda: (a, b) => rect(0, 0, W, H, a) + `<path d="M-10 10 L14 -10 L130 128 L106 150 Z" fill="${b}"/>`,
  cuartos: (a, b) => rect(0, 0, W, H, a) + rect(60, 0, 60, 70, b) + rect(0, 70, 60, 70, b),
  franja: (a, b) => rect(0, 0, W, H, a) + rect(0, 44, W, 30, b),
  mitad: (a, b) => rect(0, 0, 60, H, a) + rect(60, 0, 60, H, b),
  rayas: (a, b) => rect(0, 0, W, H, a) + stripes(10, 3.4, b),
  'bastones-anchos': (a, b) => rect(0, 0, W, H, a) + stripes(44, 22, b),
  v: (a, b) => rect(0, 0, W, H, a) + `<path d="M0 0 H22 L60 54 L98 0 H120 V12 L60 80 L0 12 Z" fill="${b}"/>`,
  holo: () => `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#__UID__-holo)"/>` +
    `<path d="M-20 60 L60 -20 L84 -20 L-20 84 Z M10 150 L130 30 L130 54 L34 150 Z" fill="#ffffff" opacity=".35"/>`,
}
export const PATTERN_LABELS = {
  lisa: 'Lisa', bastones: 'Bastones', banda: 'Banda', cuartos: 'Cuartos', franja: 'Franja',
  mitad: 'Mitad y mitad', rayas: 'Rayas finas', 'bastones-anchos': 'Bastones anchos', v: 'V', holo: 'Holográfico',
}

// ── Emblemas monolínea (caja −16..16, trazo currentColor) ──
export const EMBLEMS = {
  // Pelota de trapo: bollo atado
  trapo: '<circle r="12"/><path d="M-11.5 -3 Q0 3 11.5 -3"/><path d="M-9 -8.5 Q-1 -3 8.5 -9"/><path d="M-9 8 Q0 2.5 9.5 7.5"/><path d="M0 -12 L-3 -16.5 M0 -12 L4 -16"/>',
  // Cono de entrenamiento
  cono: '<path d="M-14 13 H14"/><path d="M-8 13 L-2 -13 H2 L8 13"/><path d="M-5.6 3 H5.6"/><path d="M-3.8 -5 H3.8"/>',
  // Farol
  farol: '<path d="M0 -16 V-13"/><path d="M-7 -13 H7 L9 -9 H-9 Z"/><path d="M-6.5 -9 V8 M6.5 -9 V8"/><path d="M-9 8 H9 L7 12.5 H-7 Z"/><path d="M0 -4 Q3.5 0 0 4.5 Q-3.5 0 0 -4"/>',
  // Pizarra táctica X-O
  pizarra: '<rect x="-15" y="-11" width="30" height="22" rx="2.5"/><path d="M-10 -6 L-4 0 M-4 -6 L-10 0"/><circle cx="7" cy="-3" r="3.6"/><path d="M-7 6 Q1 9 7 3"/><path d="M4.2 2.6 L7 3 L6.8 5.8"/>',
  // Pantalla de TV (día de partido, en vivo)
  tv: '<rect x="-15" y="-11" width="30" height="20" rx="3"/><path d="M-6 13.5 H6 M0 9 V13.5"/><path d="M-5 -11 L-9 -16 M5 -11 L9 -16"/><path d="M-3 -5 L4.5 -1 L-3 3 Z"/><circle cx="10" cy="-6.5" r="1.2"/>',
  // Banderas cruzadas
  banderas: '<path d="M-11 15 L-3 -15"/><path d="M11 15 L3 -15"/><path d="M-3 -15 Q4 -17 10 -12.5 Q4 -9 -5.2 -6.8"/><path d="M3 -15 Q-4 -17 -10 -12.5 Q-4 -9 5.2 -6.8"/>',
  // Copa
  copa: '<path d="M-9 -13 H9 V-5 Q9 6 0 7 Q-9 6 -9 -5 Z"/><path d="M-9 -10 Q-15 -10 -14.5 -4 Q-14 1 -8.5 1"/><path d="M9 -10 Q15 -10 14.5 -4 Q14 1 8.5 1"/><path d="M0 7 V11"/><path d="M-4.5 11 H4.5 M-7 14.5 H7"/>',
  // Bufanda
  bufanda: '<path d="M-15 -5 L9 -14 L13 -8 L-11 1 Z"/><path d="M-11 1 L-9 12 L-3 10 L-5 -1.2"/><path d="M-9 12 L-10 15.5 M-6 11 L-6.6 14.6 M-3 10 L-3.2 13.6"/><path d="M-3 -9.6 L0.8 -3.6 M4 -12.2 L7.6 -6.2"/>',
  // Zarpazo
  zarpazo: '<path d="M-11 -14 Q-5 0 -10 14"/><path d="M-1.5 -16 Q4.5 0 0 16"/><path d="M8 -14 Q14 0 9 14"/>',
  // Pelota con laurel
  laurel: '<circle cy="-3" r="7"/><path d="M0 -6.5 L3 -4.3 L1.9 -0.8 H-1.9 L-3 -4.3 Z"/><path d="M-4 13 Q-14 8 -13 -6"/><path d="M4 13 Q14 8 13 -6"/><path d="M-11 4 l-4 -1.5 M-12.8 -1 l-3.6 -2.4 M-8 9.5 l-3.4 0.8 M11 4 l4 -1.5 M12.8 -1 l3.6 -2.4 M8 9.5 l3.4 0.8"/>',
  // Cabeza de cabra (GOAT)
  cabra: '<path d="M-6 -7 Q0 -10 6 -7 L5 4 Q3 11 0 13 Q-3 11 -5 4 Z"/><path d="M-5 -8 Q-15 -11 -14 -1"/><path d="M5 -8 Q15 -11 14 -1"/><path d="M-6 -3.5 L-12 -0.5 L-5.6 1 M6 -3.5 L12 -0.5 L5.6 1"/><path d="M-1.6 13 L0 16.5 L1.6 13"/><circle cx="-2.4" cy="-1.5" r=".6"/><circle cx="2.4" cy="-1.5" r=".6"/>',
}
export const EMBLEM_LABELS = {
  trapo: 'Pelota de trapo', cono: 'Cono', farol: 'Farol', pizarra: 'Pizarra X-O', tv: 'Pantalla TV',
  banderas: 'Banderas', copa: 'Copa', bufanda: 'Bufanda', zarpazo: 'Zarpazo', laurel: 'Pelota con laurel', cabra: 'Cabeza de cabra',
}

export const SHAPE_LABELS = {
  redondeado: 'Redondeado', punta: 'En punta', almenado: 'Almenado', corona: 'Con corona', cuernos: 'Con cuernos',
}

// Tamaños estándar (ancho en px). S = sin cinta (no se lee el nombre).
export const SIZES = { s: 40, m: 96, l: 180 }

let _uid = 0
/** id único para defs (gradientes/clips) cuando conviven varios SVG en la página. */
export function crestUid(prefix = 'rk') { _uid += 1; return `${prefix}${_uid}` }

/** Normaliza: acepta un tier, su key o un kit suelto { primary, secondary, pattern, metal, emblem, shape, label }. */
export function resolveKit(t) {
  const tier = typeof t === 'string' ? TIERS.find(x => x.key === t) : t
  if (!tier) return resolveKit(TIERS[0])
  const kit = tier.kit || tier
  return { key: tier.key || 'custom', label: tier.label || '', ...kit }
}

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }

function metalGradient(id, metal, vertical = false) {
  const m = METALS[metal] || METALS.bronce
  const n = m.stops.length - 1
  const stops = m.stops.map((c, i) => `<stop offset="${(i / n).toFixed(2)}" stop-color="${c}"/>`).join('')
  const dir = vertical ? 'x1="0" y1="0" x2="0" y2="1"' : 'x1="0" y1="0" x2="1" y2="1"'
  return `<linearGradient id="${id}" ${dir}>${stops}</linearGradient>`
}
function holoGradient(id) {
  return `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">` +
    ['#fbcfe8', '#ddd6fe', '#bae6fd', '#bbf7d0', '#fef08a', '#fbcfe8'].map((c, i) => `<stop offset="${(i / 5).toFixed(2)}" stop-color="${c}"/>`).join('') +
    '</linearGradient>'
}
function commonDefs(uid, kit) {
  return metalGradient(`${uid}-metal`, kit.metal) +
    metalGradient(`${uid}-metalv`, kit.metal, true) +
    holoGradient(`${uid}-holo`) +
    `<linearGradient id="${uid}-shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".14"/><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".28"/></linearGradient>` +
    `<radialGradient id="${uid}-disc" cx="50%" cy="35%" r="70%"><stop offset="0" stop-color="#1c2552"/><stop offset="1" stop-color="#070b1c"/></radialGradient>`
}
function patternMarkup(kit, uid) {
  const fn = PATTERNS[kit.pattern] || PATTERNS.lisa
  return fn(kit.primary, kit.secondary).replace(/__UID__/g, uid)
}

/**
 * Partes del ESCUDO (markup interno, sin <svg>):
 *  defs · extra (corona/cuernos) · rim (aro de metal) · field (campo con el dibujo) ·
 *  roundel (medallón central) · emblem · ribbon (cinta con el nombre)
 * Cada parte se puede poner en su propio <g> para animarla.
 */
export function crestParts(t, { uid = crestUid(), ribbon = true, name } = {}) {
  const kit = resolveKit(t)
  const shape = SHAPES[kit.shape] || SHAPES.redondeado
  const { cy, ribbonY } = shape.layout
  const metal = METALS[kit.metal] || METALS.bronce
  const label = (name ?? kit.label ?? '').toUpperCase()
  // Campo = contorno achicado (deja ver el aro de metal alrededor)
  const inset = 'translate(60 72) scale(.86) translate(-60 -72)'

  const defs = commonDefs(uid, kit) +
    `<clipPath id="${uid}-field"><path d="${shape.body}" transform="${inset}"/></clipPath>`

  const extra = shape.extra
    ? `<path d="${shape.extra}" fill="url(#${uid}-metal)" stroke="rgba(0,0,0,.45)" stroke-width="1.2" stroke-linejoin="round"/>` +
      (shape.extraDetail ? `<g fill="url(#${uid}-metalv)" stroke="rgba(0,0,0,.4)" stroke-width="1">${shape.extraDetail}</g>` : '')
    : ''

  const rim = `<path d="${shape.body}" fill="url(#${uid}-metal)" stroke="rgba(0,0,0,.5)" stroke-width="1.4" stroke-linejoin="round"/>` +
    `<path d="${shape.body}" transform="translate(60 72) scale(.93) translate(-60 -72)" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1"/>`

  const field = `<g clip-path="url(#${uid}-field)">${patternMarkup(kit, uid)}</g>` +
    `<path d="${shape.body}" transform="${inset}" fill="none" stroke="rgba(0,0,0,.45)" stroke-width="1.6"/>`

  const roundel = `<circle cx="60" cy="${cy}" r="24" fill="url(#${uid}-disc)" stroke="url(#${uid}-metal)" stroke-width="3.6"/>` +
    `<circle cx="60" cy="${cy}" r="19.5" fill="none" stroke="${metal.ink}" stroke-opacity=".22" stroke-width="1"/>`

  const emblem = `<g transform="translate(60 ${cy})" fill="none" stroke="${metal.ink}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${EMBLEMS[kit.emblem] || EMBLEMS.trapo}</g>`

  let rib = ''
  if (ribbon) {
    const y = ribbonY, h = 17
    const fs = label.length > 10 ? 10.5 : 12
    rib = `<path d="M14 ${y + 2} L1 ${y + 4} L7 ${y + 11} L1 ${y + 18} L14 ${y + h}" fill="#0a0f24" stroke="url(#${uid}-metal)" stroke-width="1.4" stroke-linejoin="round"/>` +
      `<path d="M106 ${y + 2} L119 ${y + 4} L113 ${y + 11} L119 ${y + 18} L106 ${y + h}" fill="#0a0f24" stroke="url(#${uid}-metal)" stroke-width="1.4" stroke-linejoin="round"/>` +
      `<rect x="12" y="${y}" width="96" height="${h}" rx="2" fill="#0f1533" stroke="url(#${uid}-metal)" stroke-width="1.6"/>` +
      `<text x="60" y="${y + h / 2 + fs * 0.36}" text-anchor="middle" font-family="'Barlow Condensed','Oswald','Arial Narrow',sans-serif" font-weight="800" font-size="${fs}" letter-spacing="1.2" fill="${metal.ink}">${esc(label)}</text>`
  }

  return { viewBox: '0 0 120 140', width: 120, height: 140, defs, extra, rim, field, roundel, emblem, ribbon: rib, kit }
}

/** SVG completo del escudo. size: 's' | 'm' | 'l' | número (ancho en px). */
export function crestSvg(t, { size = 'm', uid = crestUid(), ribbon, title } = {}) {
  const w = typeof size === 'number' ? size : (SIZES[size] || SIZES.m)
  const withRibbon = ribbon ?? (size !== 's' && w >= 64)
  const p = crestParts(t, { uid, ribbon: withRibbon })
  const h = Math.round(w * 140 / 120)
  const ttl = title ?? p.kit.label
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${p.viewBox}" width="${w}" height="${h}" role="img" aria-label="${esc(ttl)}">` +
    `<title>${esc(ttl)}</title><defs>${p.defs}</defs>${p.extra}${p.rim}${p.field}${p.roundel}${p.emblem}${p.ribbon}</svg>`
}

/**
 * MEDALLÓN (marco de avatar): aro con el dibujo de la camiseta + borde de metal + placa con el nombre.
 * viewBox 0 0 120 132. center: 'emblem' (dibuja el emblema) | 'empty' (hueco oscuro para el avatar).
 */
export function medallionParts(t, { uid = crestUid('md'), plaque = true, center = 'emblem' } = {}) {
  const kit = resolveKit(t)
  const metal = METALS[kit.metal] || METALS.bronce
  const defs = commonDefs(uid, kit) +
    `<clipPath id="${uid}-ring"><path fill-rule="evenodd" clip-rule="evenodd" d="M60 6 a54 54 0 1 1 -0.01 0 Z M60 22 a38 38 0 1 0 0.01 0 Z"/></clipPath>`
  const rim = `<circle cx="60" cy="60" r="57" fill="url(#${uid}-metal)" stroke="rgba(0,0,0,.5)" stroke-width="1.2"/>`
  const field = `<g clip-path="url(#${uid}-ring)"><g transform="translate(0 -10)">${patternMarkup(kit, uid)}</g></g>` +
    `<circle cx="60" cy="60" r="54" fill="none" stroke="rgba(0,0,0,.4)" stroke-width="1.2"/>`
  const inner = `<circle cx="60" cy="60" r="38" fill="${center === 'empty' ? '#070b1c' : `url(#${uid}-disc)`}" stroke="url(#${uid}-metal)" stroke-width="4"/>`
  const emblem = center === 'emblem'
    ? `<g transform="translate(60 60) scale(1.35)" fill="none" stroke="${metal.ink}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${EMBLEMS[kit.emblem] || ''}</g>`
    : ''
  const label = (kit.label || '').toUpperCase()
  const pl = plaque
    ? `<rect x="26" y="104" width="68" height="20" rx="4" fill="url(#${uid}-metalv)" stroke="rgba(0,0,0,.55)" stroke-width="1.2"/>` +
      `<rect x="29" y="107" width="62" height="14" rx="2.5" fill="#0f1533"/>` +
      `<text x="60" y="117.6" text-anchor="middle" font-family="'Barlow Condensed','Oswald','Arial Narrow',sans-serif" font-weight="800" font-size="${label.length > 9 ? 9 : 10.5}" letter-spacing="1" fill="${metal.ink}">${esc(label)}</text>`
    : ''
  return { viewBox: '0 0 120 132', width: 120, height: 132, defs, rim, field, inner, emblem, plaque: pl, kit }
}

export function medallionSvg(t, { size = 'm', uid = crestUid('md'), plaque, center = 'emblem' } = {}) {
  const w = typeof size === 'number' ? size : (SIZES[size] || SIZES.m)
  const withPlaque = plaque ?? (size !== 's' && w >= 64)
  const p = medallionParts(t, { uid, plaque: withPlaque, center })
  const vb = withPlaque ? p.viewBox : '0 0 120 120'
  const h = Math.round(w * (withPlaque ? 132 : 120) / 120)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${w}" height="${h}" role="img" aria-label="Medallón ${esc(p.kit.label)}">` +
    `<defs>${p.defs}</defs>${p.rim}${p.field}${p.inner}${p.emblem}${p.plaque}</svg>`
}

/**
 * BANNER: dibujo de la camiseta a todo el ancho + nombre + escudo a la derecha.
 * viewBox 0 0 360 96.
 */
export function bannerSvg(t, { size = 'm', uid = crestUid('bn'), subtitle } = {}) {
  const BW = { s: 180, m: 360, l: 640 }
  const w = typeof size === 'number' ? size : (BW[size] || BW.m)
  const h = Math.round(w * 96 / 360)
  const kit = resolveKit(t)
  const tier = typeof t === 'string' ? TIERS.find(x => x.key === t) : t
  const metal = METALS[kit.metal] || METALS.bronce
  const label = (kit.label || '').toUpperCase()
  const sub = subtitle ?? tier?.collection ?? ''
  const crestUidIn = `${uid}c`
  const cp = crestParts(t, { uid: crestUidIn, ribbon: false })
  // patrón estirado al ancho: el campo es 120×140, lo escalamos a 360×96 (3 × 0.6857)
  const pat = `<g transform="scale(3 0.6857)">${patternMarkup(kit, uid)}</g>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 96" width="${w}" height="${h}" role="img" aria-label="Banner ${esc(kit.label)}">` +
    `<defs>${commonDefs(uid, kit)}${cp.defs}` +
    `<clipPath id="${uid}-clip"><rect x="2" y="2" width="356" height="92" rx="12"/></clipPath>` +
    `<linearGradient id="${uid}-read" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#050816" stop-opacity=".88"/><stop offset=".55" stop-color="#050816" stop-opacity=".45"/><stop offset="1" stop-color="#050816" stop-opacity=".05"/></linearGradient>` +
    `</defs>` +
    `<g clip-path="url(#${uid}-clip)">${pat}<rect width="360" height="96" fill="url(#${uid}-read)"/></g>` +
    `<rect x="2" y="2" width="356" height="92" rx="12" fill="none" stroke="url(#${uid}-metal)" stroke-width="3"/>` +
    `<text x="22" y="54" font-family="'Barlow Condensed','Oswald','Arial Narrow',sans-serif" font-style="italic" font-weight="800" font-size="34" letter-spacing="1" fill="#ffffff">${esc(label)}</text>` +
    (sub ? `<text x="23" y="74" font-family="'Barlow Condensed','Oswald','Arial Narrow',sans-serif" font-weight="700" font-size="13" letter-spacing="2.4" fill="${metal.ink}" opacity=".9">${esc(sub.toUpperCase())}</text>` : '') +
    `<g transform="translate(282 4) scale(.62)">${cp.extra}${cp.rim}${cp.field}${cp.roundel}${cp.emblem}</g>` +
    `</svg>`
}
