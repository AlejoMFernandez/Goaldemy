import countryMap from '../codeCOUNTRYS.json';

// Normalization helpers (lowercase + strip diacritics)
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
  ['macedonia', 'mk'], ['north macedonia', 'mk']
])

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
export function flagUrl(code, _width = 40) {
  if (!code) return null;
  // Always use w40 per requirement; size is controlled with CSS
  return `https://flagcdn.com/w40/${code.toLowerCase()}.png`;
}
