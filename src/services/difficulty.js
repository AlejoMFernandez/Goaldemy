/**
 * DIFFICULTY SERVICE
 *
 * Controla qué jugadores pueden ser TARGET/RESPUESTA/OPCIÓN en los juegos,
 * según la dificultad elegida y la fama del jugador (src/data/player-fame.json):
 *  - easy:   solo fame 1 (cracks)
 *  - medium: fame 1 y 2 (cracks + conocidos)
 *  - hard:   fame 1 y 2 (cracks + conocidos)
 *
 * Fame 3 ("del plantel") NUNCA es elegible como target/respuesta/opción en
 * ningún nivel de dificultad — sólo puede aparecer como sugerencia/acierto
 * tipeado en los juegos "donde se escribe" (ver services/players.js).
 *
 * La preferencia se guarda en localStorage y se aplica automáticamente
 * cuando el juego carga jugadores con getAllPlayersAsync().
 */

/** Definición de los niveles para mostrar en UI */
export const DIFFICULTIES = [
  { id: 'easy',   label: 'Fácil',    desc: 'Solo cracks' },
  { id: 'medium', label: 'Medio',    desc: 'Cracks + conocidos' },
  { id: 'hard',   label: 'Difícil',  desc: 'Cracks + conocidos' },
]

/**
 * Niveles de fama habilitados por dificultad (1 crack, 2 conocido, 3 del plantel).
 * 3 nunca está incluido: eso es lo que garantiza que un jugador del plantel
 * jamás sea elegido como respuesta/opción por el juego.
 */
export const DIFFICULTY_FAME = {
  easy:   [1],
  medium: [1, 2],
  hard:   [1, 2],
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
 * Filtra un array de jugadores según la dificultad indicada, por fama.
 * Un jugador sin `fame` (no debería pasar, players.js siempre lo asigna)
 * se trata como fame 3 y queda afuera.
 */
export function filterPlayersByDifficulty(players, difficulty) {
  const allowed = DIFFICULTY_FAME[difficulty ?? 'medium'] || DIFFICULTY_FAME.medium
  return players.filter(p => allowed.includes(p.fame ?? 3))
}
