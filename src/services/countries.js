/**
 * SERVICIO DE PAÍSES Y BANDERAS
 * 
 * Maneja la conversión de nombres de países a códigos ISO y la generación de URLs de banderas.
 * 
 * FUENTE DE DATOS:
 * - codeCOUNTRYS.json: Mapa de códigos ISO a nombres (ej: { "ar": "Argentina", "br": "Brasil" })
 * - flagcdn.com: CDN de banderas con URLs predecibles
 * 
 * NORMALIZACIÓN:
 * - Convierte a minúsculas y elimina acentos/diacríticos
 * - Permite matchear "Mexico" con "México"
 * - Soporta aliases comunes ("Turkey" → "Türkiye", "Ivory Coast" → "Côte d'Ivoire")
 * 
 * MAPAS INVERSOS:
 * - nameToCode: Map que permite buscar código por nombre del país
 * - ALIASES: Map de nombres alternativos a códigos ISO
 * 
 * EJEMPLOS:
 * - countryCodeFromName("Argentina") → "ar"
 * - flagUrl("ar") → "https://flagcdn.com/w40/ar.png"
 */
import countryMap from '../codeCOUNTRYS.json';

/**
 * Normaliza un string: lowercase + sin acentos
 * Ej: "México" → "mexico"
 */
function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
}

// Build reverse maps from country name variants to code
const nameToCode = new Map();
for (const [code, name] of Object.entries(countryMap)) {
  const lc = String(name).toLowerCase()
  nameToCode.set(lc, code.toLowerCase())
  nameToCode.set(norm(name), code.toLowerCase())
}

// Common aliases and recent renames
const ALIASES = new Map([
  ['turkiye', 'tr'], ['türkiye', 'tr'], ['turkey', 'tr'],
  ['ivory coast', 'ci'], ["cote d'ivoire", 'ci'], ["cote d’ivoire", 'ci'],
  ['czech republic', 'cz'], ['eswatini', 'sz'], ['swaziland', 'sz'],
  ['macedonia', 'mk'], ['north macedonia', 'mk'],
  // Estados Unidos: el JSON solo tiene "United States", así que "USA"/español rompían la bandera.
  ['usa', 'us'], ['u.s.a.', 'us'], ['united states of america', 'us'],
  ['estados unidos', 'us'], ['ee.uu.', 'us'], ['ee. uu.', 'us'], ['eeuu', 'us'], ['america', 'us'],
  // Naciones británicas (códigos regionales de flagcdn) + nombres en español.
  ['england', 'gb-eng'], ['inglaterra', 'gb-eng'],
  ['scotland', 'gb-sct'], ['escocia', 'gb-sct'],
  ['wales', 'gb-wls'], ['gales', 'gb-wls'],
  ['northern ireland', 'gb-nir'], ['irlanda del norte', 'gb-nir'],
])

/**
 * Convierte un nombre de país a su código ISO de 2 letras
 * Soporta variantes, aliases y normalización de acentos
 * @param {string} name - Nombre del país (ej: "Argentina", "Türkiye", "Ivory Coast")
 * @returns {string|null} Código ISO en lowercase (ej: "ar", "tr", "ci") o null si no se encuentra
 */
export function countryCodeFromName(name) {
  if (!name) return null;
  const raw = String(name)
  const lc = raw.toLowerCase()
  const n = norm(raw)
  // direct
  if (nameToCode.has(lc)) return nameToCode.get(lc)
  if (nameToCode.has(n)) return nameToCode.get(n)
  // aliases
  if (ALIASES.has(n)) return ALIASES.get(n)
  return null;
}
/**
 * Genera la URL de la bandera de un país desde flagcdn.com
 * @param {string} code - Código ISO del país (ej: "ar", "br", "es")
 * @param {number} _width - Ancho (deprecado, siempre usa w40)
 * @returns {string|null} URL de la bandera o null si no hay código
 */
export function flagUrl(code, _width = 40) {
  if (!code) return null;
  // Always use w40 per requirement; size is controlled with CSS
  return `https://flagcdn.com/w40/${code.toLowerCase()}.png`;
}

// FotMob uses non-standard country codes; map them to ISO alpha-2 for flagcdn
const FOTMOB_TO_ISO = {
  geo: 'ge', eng: 'gb-eng', sco: 'gb-sct', wal: 'gb-wls',
  ger: 'de', por: 'pt', sui: 'ch', ned: 'nl', cro: 'hr',
  den: 'dk', gre: 'gr', aut: 'at', bos: 'ba', srb: 'rs',
  slk: 'sk', slo: 'si', cze: 'cz', mon: 'me', mkd: 'mk',
  tur: 'tr', rou: 'ro', bul: 'bg', ukr: 'ua', isl: 'is',
  nor: 'no', swe: 'se', fin: 'fi', pol: 'pl', hun: 'hu',
  irl: 'ie', chi: 'cl', par: 'py', uru: 'uy', ecu: 'ec',
  per: 'pe', bol: 'bo', ven: 've', col: 'co', bra: 'br',
  arg: 'ar', mex: 'mx', usa: 'us', can: 'ca', jam: 'jm',
  crc: 'cr', hon: 'hn', slv: 'sv', pan: 'pa', tri: 'tt',
  hai: 'ht', jpn: 'jp', kor: 'kr', irn: 'ir', ksa: 'sa',
  aus: 'au', chn: 'cn', irq: 'iq', qat: 'qa', uzb: 'uz',
  tha: 'th', nig: 'ng', sen: 'sn', cmr: 'cm', gha: 'gh',
  civ: 'ci', mar: 'ma', alg: 'dz', tun: 'tn', egy: 'eg',
  mli: 'ml', gui: 'gn', cod: 'cd', rsa: 'za', zam: 'zm',
  zim: 'zw', moz: 'mz', gab: 'ga', gnb: 'gw', eqg: 'gq',
  cpv: 'cv', com: 'km', gam: 'gm', sle: 'sl', tog: 'tg',
  ben: 'bj', cta: 'cf', cgo: 'cg', ang: 'ao', nir: 'gb-nir',
  esp: 'es', fra: 'fr', ita: 'it', alb: 'al', lux: 'lu',
}

/**
 * Derives a working flag URL for a player, handling FotMob's non-standard ccodes.
 * Tries countryCodeFromName(cname) first, then FOTMOB_TO_ISO mapping, then raw ccode.
 */
export function playerFlagUrl(player) {
  if (!player) return null
  const fromName = player.cname ? countryCodeFromName(player.cname) : null
  if (fromName) return flagUrl(fromName)
  const raw = (player.ccode || '').toLowerCase()
  const iso = FOTMOB_TO_ISO[raw]
  if (iso) return flagUrl(iso)
  if (raw.length === 2) return flagUrl(raw)
  return null
}
