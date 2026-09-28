/**
 * Normaliza texto para búsquedas: minúsculas, sin tildes/diacríticos, sin
 * espacios de borde. Usar en cualquier filtro de búsqueda de la app para que
 * "julian" encuentre "Julián" (ver services/players.js, countries.js y
 * global-search.js, que ya hacían esto mismo de forma duplicada).
 */
export function normalizeSearch(s) {
  return (s || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
}
