/**
 * CATÁLOGO DE SECCIONES — CONEXIONES
 *
 * Reemplaza al viejo GROUP_GENERATORS de Connections.vue. Puro (no importa
 * players.js ni JSON): recibe la lista de jugadores desde afuera, así se
 * puede testear con Node sin pasar por Vite.
 *
 * REGLAS
 * - Sólo cuentan jugadores con fame 1-2 (nunca fame 3, sea cual sea la dificultad).
 * - 10 tipos de sección: hitos, pais, club, liga, temporada, fisico, edad,
 *   dorsal, puesto, valor. Un tablero usa como máximo 1 sección de cada tipo.
 * - Una sección entra al sorteo del día sólo si tiene 8 o más jugadores que
 *   la cumplen (con el pool de fame 1-2 vigente).
 * - Sorteo diario (createDailyRng/createRngForDate): 4 secciones de tipos
 *   distintos. Una sección que salió en cualquiera de los 3 días anteriores
 *   no puede volver a salir hoy. Como no hay base de datos, esos días
 *   anteriores se RECALCULAN corriendo el mismo algoritmo con la semilla de
 *   esa fecha (y, a su vez, con sus propios 3 días previos excluidos).
 * - Un jugador que cumple más de una de las 4 secciones elegidas queda
 *   afuera del tablero entero (no se usa en ninguna de las dos).
 */

import { createRngForDate, seededShuffle, seededSample } from './seeded-random.js'

export const GAME_SLUG = 'connections'
export const MIN_SECTION_SIZE = 8
export const BOARD_TYPES = 4
export const GROUP_SIZE = 4
const LOOKBACK_DAYS = 3
// Profundidad de recálculo histórico: de sobra para que la ventana de 3 días
// converja; ir más atrás no cambia nada porque el pool de hoy es el mismo.
const MAX_HISTORY_DEPTH = 10
const MAX_ATTEMPTS_PER_DAY = 80

export const TYPES = {
  HITOS: 'hitos',
  PAIS: 'pais',
  CLUB: 'club',
  LIGA: 'liga',
  TEMPORADA: 'temporada',
  FISICO: 'fisico',
  EDAD: 'edad',
  DORSAL: 'dorsal',
  PUESTO: 'puesto',
  VALOR: 'valor',
}

const NATIONALITIES = [
  { code: 'arg', label: 'Argentinos' },
  { code: 'bra', label: 'Brasileños' },
  { code: 'fra', label: 'Franceses' },
  { code: 'eng', label: 'Ingleses' },
  { code: 'esp', label: 'Españoles' },
  { code: 'ita', label: 'Italianos' },
  { code: 'ger', label: 'Alemanes' },
  { code: 'ned', label: 'Neerlandeses' },
  { code: 'por', label: 'Portugueses' },
  { code: 'bel', label: 'Belgas' },
  { code: 'uru', label: 'Uruguayos' },
]

const LEAGUE_NAMES = { 47: 'Premier League', 87: 'La Liga', 55: 'Serie A', 54: 'Bundesliga', 53: 'Ligue 1' }

// ── Secciones armadas a mano (por ID de FotMob) ─────────────────────────────
// La lista completa de cada plantel no importa: sólo entran al tablero los
// que además estén en el pool vigente con fame 1-2 (los demás se ignoran solos).

// Selección de Argentina campeona en Qatar 2022 (26 convocados; se listan los
// que siguen trackeados hoy con fame 1-2 — Messi, Di María, Otamendi, etc.)
const WC2022_ARGENTINA_IDS = [
  268375, // Emiliano Martínez
  245555, // Gerónimo Rulli
  726345, // Nahuel Molina
  687008, // Gonzalo Montiel
  789066, // Cristian Romero
  174321, // Nicolás Otamendi
  847983, // Lisandro Martínez
  195750, // Nicolás Tagliafico
  324578, // Rodrigo De Paul
  237606, // Leandro Paredes
  831489, // Alexis Mac Allister
  1137705, // Enzo Fernández
  693599, // Exequiel Palacios
  30981, // Lionel Messi
  46509, // Ángel Di María
  974753, // Julián Álvarez
  690230, // Lautaro Martínez
  325916, // Paulo Dybala
  955271, // Thiago Almada
]

// Selección de España, campeona del Mundial 2026 (1-0 a Argentina). Plantel
// REAL de los 26 convocados (no el plantel actual de la selección).
const WC2026_SPAIN_IDS = [
  660625, // Unai Simón
  562727, // David Raya
  1167220, // Joan García
  873289, // Marc Cucurella
  288406, // Alejandro Grimaldo
  1532137, // Pau Cubarsí
  411617, // Aymeric Laporte
  1323897, // Marc Pubill
  940573, // Eric García
  602563, // Marcos Llorente
  941573, // Pedro Porro
  1083323, // Pedri
  605654, // Fabián Ruiz
  1031325, // Martín Zubimendi
  1279040, // Gavi
  675088, // Rodri
  942372, // Álex Baena
  574645, // Mikel Merino
  678234, // Mikel Oyarzabal
  614834, // Dani Olmo
  1202110, // Nico Williams
  1047676, // Yeremy Pino (no trackeado hoy en el pool — queda afuera solo)
  881771, // Ferran Torres
  609505, // Borja Iglesias (no trackeado hoy en el pool — queda afuera solo)
  1553105, // Víctor Muñoz
  1467236, // Lamine Yamal
]

// Fichajes verificados por encima de los 100 M€ de FICHA (no de valor de
// mercado — eso es la sección automática "valen 80 M€+"). Se dejan afuera
// casos frontera que no pude confirmar con certeza (Núñez, Antony, Gvardiol,
// Osimhen a Galatasaray, etc.) para no listar un monto inventado.
const TRANSFERS_OVER_100M_IDS = [
  19533, // Neymar — PSG 2017, ~€222M (récord mundial)
  701154, // Kylian Mbappé — PSG 2018 (ex-Mónaco), ~€180M
  30893, // Cristiano Ronaldo — Juventus 2018, ~€100-117M
  184138, // Antoine Griezmann — Barcelona 2019, €120M
  1137705, // Enzo Fernández — Chelsea 2023, €121M (récord inglés al momento)
  1137668, // Moisés Caicedo — Chelsea 2023, ~€133M
  654096, // Declan Rice — Arsenal 2023, ~€121M
  1077894, // Jude Bellingham — Real Madrid 2023, ~€103M (+bonus)
  690107, // Alexander Isak — Liverpool 2025, récord inglés (~€145M)
  1152455, // Florian Wirtz — Liverpool 2025, ~€125-150M
  194165, // Harry Kane — Bayern 2023, ~€100M (récord del club)
]

function idSetTest(ids) {
  const set = new Set(ids)
  return (p) => set.has(p.id)
}

// ── Catálogo automático (test por función) ──────────────────────────────────
function buildAutoSections(players) {
  const sections = []

  for (const { code, label } of NATIONALITIES) {
    sections.push({ id: `pais:${code}`, label, type: TYPES.PAIS, test: (p) => (p.ccode || '').toLowerCase() === code })
  }

  const clubs = new Set(players.map((p) => p.teamName).filter(Boolean))
  for (const club of [...clubs].sort()) {
    sections.push({ id: `club:${club}`, label: `Juegan en ${club}`, type: TYPES.CLUB, test: (p) => p.teamName === club })
  }

  for (const [lid, name] of Object.entries(LEAGUE_NAMES)) {
    const id = Number(lid)
    sections.push({ id: `liga:${id}`, label: `Juegan en la ${name}`, type: TYPES.LIGA, test: (p) => p.leagueId === id })
  }

  sections.push({ id: 'temporada:goles3', label: 'Goleadores de la temporada (3+)', type: TYPES.TEMPORADA, test: (p) => (p.stats?.goals ?? 0) >= 3 })
  sections.push({ id: 'temporada:asist2', label: 'Asistidores de la temporada (2+)', type: TYPES.TEMPORADA, test: (p) => (p.stats?.assists ?? 0) >= 2 })

  sections.push({ id: 'fisico:alto190', label: 'Miden 1,90 o más', type: TYPES.FISICO, test: (p) => (p.height ?? 0) >= 190 })
  sections.push({ id: 'fisico:bajo172', label: 'Miden 1,72 o menos', type: TYPES.FISICO, test: (p) => !!p.height && p.height <= 172 })

  sections.push({ id: 'edad:21menos', label: '21 años o menos', type: TYPES.EDAD, test: (p) => (p.age ?? 999) <= 21 })
  sections.push({ id: 'edad:33mas', label: '33 años o más', type: TYPES.EDAD, test: (p) => (p.age ?? 0) >= 33 })

  sections.push({ id: 'dorsal:10', label: 'Usan la camiseta 10', type: TYPES.DORSAL, test: (p) => p.shirtNumber === 10 })
  sections.push({ id: 'dorsal:9', label: 'Usan la camiseta 9', type: TYPES.DORSAL, test: (p) => p.shirtNumber === 9 })
  sections.push({ id: 'dorsal:7', label: 'Usan la camiseta 7', type: TYPES.DORSAL, test: (p) => p.shirtNumber === 7 })

  sections.push({ id: 'puesto:arqueros', label: 'Son arqueros', type: TYPES.PUESTO, test: (p) => p.positionId === 0 })

  sections.push({ id: 'valor:80m', label: 'Valen 80 M€ o más', type: TYPES.VALOR, test: (p) => (p.transferValue ?? 0) >= 80_000_000 })

  return sections
}

function buildManualSections() {
  return [
    { id: 'hitos:arg2022', label: 'Campeones del Mundo 2022 (Argentina)', type: TYPES.HITOS, test: idSetTest(WC2022_ARGENTINA_IDS) },
    { id: 'hitos:esp2026', label: 'Campeones del Mundo 2026 (España)', type: TYPES.HITOS, test: idSetTest(WC2026_SPAIN_IDS) },
    { id: 'valor:fichajes100m', label: 'Fichajes de más de 100 M€', type: TYPES.VALOR, test: idSetTest(TRANSFERS_OVER_100M_IDS) },
  ]
}

/** Catálogo completo (automático + a mano), sin filtrar por elegibilidad todavía. */
export function buildCatalog(players) {
  return [...buildAutoSections(players), ...buildManualSections()]
}

/** Sólo las secciones con 8+ jugadores que las cumplen, dado el pool vigente. */
export function getEligibleSections(catalog, players) {
  return catalog.filter((s) => players.filter(s.test).length >= MIN_SECTION_SIZE)
}

/** Filtra el pool completo a sólo fame 1-2 (nunca fame 3), regla fija de este juego. */
export function fameEligiblePlayers(allPlayers) {
  return allPlayers.filter((p) => p.fame === 1 || p.fame === 2)
}

// Arma un tablero a partir de 4 secciones ya elegidas: saca a los jugadores
// que cumplen más de una (quedan afuera del todo), y si a alguna sección le
// quedan <4 jugadores limpios, el intento falla (null) y el caller reintenta.
function buildBoardFromSections(sections, players, rng) {
  const matchesBySection = sections.map((s) => players.filter(s.test))
  const matchCount = new Map()
  for (const arr of matchesBySection) {
    for (const p of arr) matchCount.set(p.id, (matchCount.get(p.id) || 0) + 1)
  }
  const ambiguousIds = new Set([...matchCount].filter(([, c]) => c > 1).map(([id]) => id))
  const cleaned = matchesBySection.map((arr) => arr.filter((p) => !ambiguousIds.has(p.id)))
  if (cleaned.some((arr) => arr.length < GROUP_SIZE)) return null

  const usedIds = new Set()
  const groups = []
  for (let i = 0; i < sections.length; i++) {
    const pool = cleaned[i].filter((p) => !usedIds.has(p.id))
    if (pool.length < GROUP_SIZE) return null
    const picked = seededSample(pool, GROUP_SIZE, rng)
    picked.forEach((p) => usedIds.add(p.id))
    groups.push({ id: sections[i].id, label: sections[i].label, type: sections[i].type, players: picked })
  }
  return groups
}

/**
 * Sortea un tablero de 4 secciones de tipos distintos, sin usar ninguna de
 * `excludeSectionIds`, y sin jugadores ambiguos. Reintenta con la misma rng
 * (determinístico) hasta MAX_ATTEMPTS_PER_DAY veces; null si no logró armar uno.
 */
export function drawBoard(eligibleSections, players, rng, excludeSectionIds = new Set()) {
  const byType = new Map()
  for (const s of eligibleSections) {
    if (excludeSectionIds.has(s.id)) continue
    if (!byType.has(s.type)) byType.set(s.type, [])
    byType.get(s.type).push(s)
  }
  const typeKeys = [...byType.keys()]
  if (typeKeys.length < BOARD_TYPES) return null

  for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_DAY; attempt++) {
    const chosenTypes = seededShuffle(typeKeys, rng).slice(0, BOARD_TYPES)
    const chosenSections = chosenTypes.map((t) => {
      const bag = byType.get(t)
      return bag[Math.floor(rng() * bag.length)]
    })
    const board = buildBoardFromSections(chosenSections, players, rng)
    if (board) return board
  }
  return null
}

function shiftDateStr(dateStr, deltaDays) {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + deltaDays)
  return d.toISOString().slice(0, 10)
}

/**
 * Tablero determinístico del día `dateStr`, recalculando (sin DB) los 3 días
 * previos para saber qué secciones no pueden repetirse. Memoiza por fecha
 * dentro de una misma llamada para no explotar la recursión.
 */
export function computeBoardForDate(allPlayers, dateStr, memo = new Map()) {
  return computeBoardForDateInternal(allPlayers, dateStr, MAX_HISTORY_DEPTH, memo)
}

function computeBoardForDateInternal(allPlayers, dateStr, depth, memo) {
  if (memo.has(dateStr)) return memo.get(dateStr)
  const players = fameEligiblePlayers(allPlayers)
  const catalog = buildCatalog(players)
  const eligible = getEligibleSections(catalog, players)

  const excludeIds = new Set()
  if (depth > 0) {
    for (let back = 1; back <= LOOKBACK_DAYS; back++) {
      const pastDate = shiftDateStr(dateStr, -back)
      const pastResult = computeBoardForDateInternal(allPlayers, pastDate, depth - 1, memo)
      for (const id of pastResult.sectionIds) excludeIds.add(id)
    }
  }

  const rng = createRngForDate(dateStr, GAME_SLUG)
  const board = drawBoard(eligible, players, rng, excludeIds)
  const result = { date: dateStr, board, sectionIds: board ? board.map((g) => g.id) : [] }
  memo.set(dateStr, result)
  return result
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

/** Tablero del día de hoy (el que usan los desafíos diarios). */
export function generateDailyBoard(allPlayers) {
  return computeBoardForDate(allPlayers, todayIso()).board
}

/**
 * Tablero "libre": mismas reglas (fame 1-2, tipos distintos, sin ambiguos)
 * pero con cualquier rng (por defecto Math.random) y sin historial de días
 * previos — para "jugar de nuevo" en modo libre, donde cada partida es nueva.
 */
export function generateRandomBoard(allPlayers, rng = Math.random) {
  const players = fameEligiblePlayers(allPlayers)
  const catalog = buildCatalog(players)
  const eligible = getEligibleSections(catalog, players)
  return drawBoard(eligible, players, rng)
}
