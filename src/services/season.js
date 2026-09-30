/**
 * TEMPORADA ACTUAL (compartido entre Duelo de Stats y Mayor o Menor)
 *
 * "Temporada actual" = la que domina el último refresco (dataGAMES.meta.json,
 * ver scripts/refresh-fotmob-squads.cjs), o un año suelto (MLS, etc.) que
 * coincida con el año de ese refresco. Un jugador con stats de una temporada
 * vieja (todavía no jugó nada esta) NO cuenta como "temporada actual".
 */
import dataMeta from '../dataGAMES.meta.json'

const META_SEASON = dataMeta?.season || null
const META_YEAR = dataMeta?.generatedAt ? new Date(dataMeta.generatedAt).getFullYear() : null

/** "2026/2027" → "Temp. 26/27"; un año suelto ("2026", MLS) se muestra tal cual. */
export function seasonLabel(season) {
  if (!season) return ''
  const m = String(season).match(/^(\d{4})\/(\d{4})$/)
  if (m) return `Temp. ${m[1].slice(2)}/${m[2].slice(2)}`
  return String(season)
}

/** ¿Las stats de este jugador son de la temporada en curso (la de su liga)? */
export function isCurrentSeason(stats) {
  const season = stats?.season
  if (!season) return false
  if (META_SEASON && season === META_SEASON) return true
  const bareYear = String(season).match(/^(\d{4})$/)
  return !!(bareYear && META_YEAR && Number(bareYear[1]) === META_YEAR)
}
