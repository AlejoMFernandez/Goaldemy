/**
 * CATÁLOGO DE COMPETICIONES
 *
 * Fuente única de verdad para el HUB (/competiciones) y el header.
 * Cada entrada mapea a un id de liga de FotMob (mismo id que usan las páginas
 * de liga y fotmob.js). Agregar un torneo nuevo = agregar un objeto acá.
 *
 * Campos:
 * - id:       id de liga en FotMob (para getLeagueOverview / logo CDN)
 * - slug:     segmento de ruta bajo /leagues/<slug> (debe existir en el router)
 * - name:     nombre visible
 * - short:    nombre corto (chips/mobile)
 * - country:  país o confederación
 * - group:    'internacional' | 'ligas' | 'continental'
 * - status:   'live'  → card linkeable, badge EN VIVO
 *             'soon'  → card atenuada, badge Próximamente (sin link)
 * - accent:   'amber' (destacado) | 'emerald' (default)
 * - bracket:  true si el torneo tiene fase de eliminación (para el <Bracket>)
 */

export const LEAGUE_LOGO = (id) =>
  `https://images.fotmob.com/image_resources/logo/leaguelogo/dark/${id}.png`

export const COMPETITIONS = [
  // ── Internacionales / Copas ────────────────────────────────────────────
  {
    id: 77, slug: 'world-cup', name: 'Copa del Mundo 2026', short: 'Mundial',
    country: 'FIFA', group: 'internacional', status: 'live', accent: 'amber',
    bracket: true, tagline: 'USA · Canadá · México',
  },

  // ── Ligas domésticas ───────────────────────────────────────────────────
  { id: 47,  slug: 'premier-league', name: 'Premier League',  short: 'Premier',    country: 'Inglaterra', group: 'ligas', status: 'soon', accent: 'emerald', bracket: false },
  { id: 87,  slug: 'la-liga',        name: 'LaLiga',          short: 'LaLiga',     country: 'España',     group: 'ligas', status: 'soon', accent: 'emerald', bracket: false },
  { id: 55,  slug: 'serie-a',        name: 'Serie A',         short: 'Serie A',    country: 'Italia',     group: 'ligas', status: 'soon', accent: 'emerald', bracket: false },
  { id: 54,  slug: 'bundesliga',     name: 'Bundesliga',      short: 'Bundesliga', country: 'Alemania',   group: 'ligas', status: 'soon', accent: 'emerald', bracket: false },
  { id: 53,  slug: 'ligue-1',        name: 'Ligue 1',         short: 'Ligue 1',    country: 'Francia',    group: 'ligas', status: 'soon', accent: 'emerald', bracket: false },
  { id: 112, slug: 'liga-argentina', name: 'Liga Profesional', short: 'Liga Arg.', country: 'Argentina', group: 'ligas', status: 'soon', accent: 'emerald', bracket: false },

  // ── Copas continentales (futuras) ──────────────────────────────────────
  { id: 42, slug: 'champions-league', name: 'Champions League', short: 'Champions',    country: 'UEFA',    group: 'continental', status: 'soon', accent: 'emerald', bracket: true },
  { id: 73, slug: 'europa-league',    name: 'Europa League',    short: 'Europa L.',    country: 'UEFA',    group: 'continental', status: 'soon', accent: 'emerald', bracket: true },
  { id: 45, slug: 'libertadores',     name: 'Copa Libertadores', short: 'Libertadores', country: 'CONMEBOL', group: 'continental', status: 'soon', accent: 'emerald', bracket: true },
]

export const GROUPS = [
  { key: 'internacional', title: 'Copas internacionales', subtitle: 'Selecciones nacionales' },
  { key: 'ligas',         title: 'Ligas domésticas',      subtitle: 'Las grandes ligas del mundo' },
  { key: 'continental',   title: 'Copas continentales',   subtitle: 'La élite de clubes' },
]

/** Competiciones agrupadas y en orden, listo para renderizar el HUB. */
export function competitionsByGroup() {
  return GROUPS
    .map(g => ({ ...g, items: COMPETITIONS.filter(c => c.group === g.key) }))
    .filter(g => g.items.length > 0)
}

/** La competición destacada (primera 'live', fallback a la primera). */
export function featuredCompetition() {
  return COMPETITIONS.find(c => c.status === 'live') || COMPETITIONS[0]
}

export function competitionBySlug(slug) {
  return COMPETITIONS.find(c => c.slug === slug) || null
}
