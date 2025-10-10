import countryMap from '../codeCOUNTRYS.json';

// Build a reverse map from Name -> code (lowercase)
const nameToCode = new Map(Object.entries(countryMap).map(([code, name]) => [name.toLowerCase(), code.toLowerCase()]));

export function countryCodeFromName(name) {
  if (!name) return null;
  const code = nameToCode.get(String(name).toLowerCase());
  return code || null;
}

export function flagUrl(code, width = 40) {
  if (!code) return null;
  // flagcdn expects lowercase iso-like codes
  return `https://flagcdn.com/w${width}/${code.toLowerCase()}.png`;
}
