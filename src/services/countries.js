import countryMap from '../codeCOUNTRYS.json';

// Build a reverse map from Name -> code (lowercase)
const nameToCode = new Map(Object.entries(countryMap).map(([code, name]) => [name.toLowerCase(), code.toLowerCase()]));

export function countryCodeFromName(name) {
  if (!name) return null;
  const code = nameToCode.get(String(name).toLowerCase());
  return code || null;
}

<<<<<<< HEAD
export function flagUrl(code, width = 40) {
  if (!code) return null;
  // flagcdn expects lowercase iso-like codes
  return `https://flagcdn.com/w${width}/${code.toLowerCase()}.png`;
=======
export function flagUrl(code, _width = 40) {
  if (!code) return null;
  // Always use w40 per requirement; size is controlled with CSS
  return `https://flagcdn.com/w40/${code.toLowerCase()}.png`;
>>>>>>> d0aeee3 (Opciones en Registro, agregado de logros y fix de XP)
}
