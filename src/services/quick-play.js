/**
 * JUGAR RÁPIDO — elige el próximo desafío diario disponible y arma su ruta.
 *
 * Reglas (mismas fuentes que el índice de juegos / PlayPoints):
 *  - Juegos = fetchGames() (ya excluye pausados) con ruta real.
 *  - Solo los desbloqueados por nivel (level-rewards).
 *  - Orden: primero los de DAILY_GAMES (los "clásicos", partida corta) en ese
 *    orden, después el resto en el orden del catálogo.
 *  - Disponible = isChallengeAvailable(slug).available (game-modes, solo lectura).
 *  - Ruta = gameRouteForSlug(slug) + '?mode=challenge' (igual que el índice).
 *
 * Devuelve { next, total, played, won, resetAt } donde next es
 * { slug, name, to } o null si ya se jugó todo lo de hoy ("¡Jornada completa!").
 */
import { fetchGames, gameRouteForSlug } from './games'
import { DAILY_GAMES, isChallengeAvailable } from './game-modes'
import { isGameUnlocked } from './level-rewards'

/** Próxima medianoche local (los desafíos se reinician a las 00:00). */
export function nextResetAt(now = new Date()) {
  const d = new Date(now)
  d.setHours(24, 0, 0, 0)
  return d
}

/** "3 h 12 min" / "12 min" / "45 s" hasta la fecha dada. */
export function formatCountdown(target, now = Date.now()) {
  const ms = Math.max(0, new Date(target).getTime() - now)
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  if (h > 0) return `${h} h ${String(m).padStart(2, '0')} min`
  if (m > 0) return `${m} min`
  return `${s} s`
}

export async function getNextQuickPlay({ level = 1 } = {}) {
  const all = await fetchGames()
  const games = (all || []).filter(g => g?.slug && gameRouteForSlug(g.slug) !== '/games' && isGameUnlocked(g.slug, level))
  const rank = (slug) => {
    const i = DAILY_GAMES.indexOf(slug)
    return i === -1 ? DAILY_GAMES.length : i
  }
  const ordered = games.map((g, i) => ({ g, i })).sort((a, b) => rank(a.g.slug) - rank(b.g.slug) || a.i - b.i).map(x => x.g)
  const avs = await Promise.all(ordered.map(async g => [g, await isChallengeAvailable(g.slug).catch(() => null)]))
  let next = null, played = 0, won = 0
  for (const [g, av] of avs) {
    if (av && av.available === false) {
      played++
      if (av.result === 'win') won++
      continue
    }
    if (!next && av) next = { slug: g.slug, name: g.name, cover: g.cover_url || null, to: `${gameRouteForSlug(g.slug)}?mode=challenge` }
  }
  return { next, total: ordered.length, played, won, resetAt: nextResetAt() }
}
