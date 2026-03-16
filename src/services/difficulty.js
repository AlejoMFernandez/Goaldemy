/**
 * DIFFICULTY SERVICE
 *
 * Controla qué jugadores se usan en los juegos según la dificultad elegida.
 *  - easy:   solo Premier League + La Liga (jugadores conocidos)
 *  - medium: las 5 grandes ligas europeas (sin Argentina)
 *  - hard:   todas las ligas configuradas
 *
 * La preferencia se guarda en localStorage y se aplica automáticamente
 * cuando el juego carga jugadores con getAllPlayersAsync().
 */

/** Definición de los niveles para mostrar en UI */
export const DIFFICULTIES = [
  { id: 'easy',   label: 'Fácil',    desc: 'Premier + LaLiga' },
  { id: 'medium', label: 'Medio',    desc: '5 grandes ligas' },
  { id: 'hard',   label: 'Difícil',  desc: 'Todas las ligas' },
]

/**
 * IDs de ligas de FotMob habilitadas por nivel.
 * null significa "sin filtro" (todas las ligas).
 */
export const DIFFICULTY_LEAGUES = {
  easy:   [47, 87],               // Premier League + La Liga española
  medium: [47, 87, 55, 54, 53],   // + Serie A + Bundesliga + Ligue 1
  hard:   null,                   // Todas las ligas (incl. Liga Argentina)
}

const STORAGE_KEY = 'goaldemy_difficulty'

/** Devuelve la dificultad actual guardada, o 'medium' por defecto */
export function getDifficulty() {
  try { return localStorage.getItem(STORAGE_KEY) || 'medium' } catch { return 'medium' }
}

/** Guarda una nueva dificultad en localStorage */
export function setDifficulty(d) {
  try { localStorage.setItem(STORAGE_KEY, d) } catch {}
}

/**
 * Filtra un array de jugadores según la dificultad indicada.
 * Si un jugador no tiene leagueId (datos del JSON estático), siempre pasa el filtro.
 */
export function filterPlayersByDifficulty(players, difficulty) {
  const leagues = DIFFICULTY_LEAGUES[difficulty ?? 'medium']
  if (!leagues) return players
  return players.filter(p => !p.leagueId || leagues.includes(p.leagueId))
}
