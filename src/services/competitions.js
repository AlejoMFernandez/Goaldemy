/**
 * CATÁLOGO DE COMPETICIONES
 *
 * Fuente única de verdad para el HUB (/competiciones), el buscador y las páginas
 * de torneo (/leagues/:slug → CompetitionPage.vue). Cada entrada mapea a un id de
 * liga de FotMob. Agregar un torneo nuevo = agregar un objeto acá (la página es
 * genérica, no hay que tocar nada más).
 *
 * Campos:
 * - id:       id de liga en FotMob (getLeagueOverview / logo CDN)
 * - slug:     segmento de ruta bajo /leagues/<slug>
 * - name/short/country
 * - group:    'internacional' | 'continental' | 'ligas'
 * - status:   'live' → card linkeable | 'soon' → atenuada (sin link)
 * - accent:   'amber' (destacado) | 'emerald' (default)
 * - bracket:  true si el torneo tiene fase de eliminación
 * - tagline:  subtítulo opcional para el hero/página
 */

export const LEAGUE_LOGO = (id) =>
  `https://images.fotmob.com/image_resources/logo/leaguelogo/dark/${id}.png`

export const COMPETITIONS = [
  // ── Internacionales / Selecciones ──────────────────────────────────────
  { id: 77,  slug: 'world-cup', name: 'Copa del Mundo 2026', short: 'Mundial', country: 'FIFA', group: 'internacional', status: 'live', accent: 'amber', bracket: true, tagline: 'USA · Canadá · México' },

  // ── Copas continentales de clubes ──────────────────────────────────────
  { id: 42,  slug: 'champions-league', name: 'Champions League',   short: 'Champions',    country: 'UEFA',     group: 'continental', status: 'live', accent: 'emerald', bracket: true,  tagline: 'La élite de Europa' },
  { id: 73,  slug: 'europa-league',    name: 'Europa League',      short: 'Europa L.',    country: 'UEFA',     group: 'continental', status: 'live', accent: 'emerald', bracket: true },
  { id: 45,  slug: 'libertadores',     name: 'Copa Libertadores',  short: 'Libertadores', country: 'CONMEBOL', group: 'continental', status: 'live', accent: 'emerald', bracket: true,  tagline: 'La gloria eterna' },
  { id: 299, slug: 'sudamericana',     name: 'Copa Sudamericana',  short: 'Sudamericana', country: 'CONMEBOL', group: 'continental', status: 'live', accent: 'emerald', bracket: true },

  // ── Ligas domésticas ───────────────────────────────────────────────────
  { id: 47,  slug: 'premier-league', name: 'Premier League',   short: 'Premier',    country: 'Inglaterra', group: 'ligas', status: 'live', accent: 'emerald', bracket: false },
  { id: 87,  slug: 'la-liga',        name: 'LaLiga',           short: 'LaLiga',     country: 'España',     group: 'ligas', status: 'live', accent: 'emerald', bracket: false },
  { id: 55,  slug: 'serie-a',        name: 'Serie A',          short: 'Serie A',    country: 'Italia',     group: 'ligas', status: 'live', accent: 'emerald', bracket: false },
  { id: 54,  slug: 'bundesliga',     name: 'Bundesliga',       short: 'Bundesliga', country: 'Alemania',   group: 'ligas', status: 'live', accent: 'emerald', bracket: false },
  { id: 53,  slug: 'ligue-1',        name: 'Ligue 1',          short: 'Ligue 1',    country: 'Francia',    group: 'ligas', status: 'live', accent: 'emerald', bracket: false },
  { id: 112, slug: 'liga-argentina', name: 'Liga Profesional', short: 'Liga Arg.',  country: 'Argentina',  group: 'ligas', status: 'live', accent: 'emerald', bracket: true },
  { id: 268, slug: 'brasileirao',    name: 'Brasileirão',      short: 'Brasileirão', country: 'Brasil',    group: 'ligas', status: 'live', accent: 'emerald', bracket: false },
]

export const GROUPS = [
  { key: 'internacional', title: 'Copas internacionales', subtitle: 'Selecciones nacionales' },
  { key: 'continental',   title: 'Copas continentales',   subtitle: 'La élite de clubes' },
  { key: 'ligas',         title: 'Ligas domésticas',      subtitle: 'Las grandes ligas del mundo' },
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

/** Slugs con página propia disponible (status 'live'). */
export function isRoutedCompetition(slug) {
  const c = competitionBySlug(slug)
  return !!c && c.status === 'live'
}
