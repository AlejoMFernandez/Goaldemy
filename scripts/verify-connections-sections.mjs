/**
 * Verifica el catálogo de Conexiones (src/services/connections-sections.js):
 * - 30 días seguidos sin repetir sección dentro de una ventana de 3 días
 * - ningún jugador cumple 2 de las 4 secciones del tablero de un día
 * - ningún tablero "imposible" (null) en la muestra
 *
 * Reconstruye el mismo array de jugadores que players.js expone (con fame
 * adjunto), pero via `require` (no `import`) porque los .json de src/ no
 * declaran `with { type: 'json' }` — así el script corre con `node` sin tocar
 * esos archivos. Uso: node scripts/verify-connections-sections.mjs
 */
import { createRequire } from 'module'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

const teams = require(path.join(root, 'src/dataGAMES.json'))
const fameData = require(path.join(root, 'src/data/player-fame.json'))
const FAME_BY_ID = new Map(Object.entries(fameData.players).map(([id, v]) => [Number(id), v.fame]))
const EXCLUDED_TEAMS = new Set(['Boca Juniors', 'River Plate', 'Racing Club'])
const MIN_TRANSFER_VALUE = 500_000
const TEAM_LEAGUE_MAP = {
  8455: 47, 8586: 47, 10260: 47, 8650: 47, 9825: 47, 8456: 47,
  8634: 87, 9906: 87, 8633: 87,
  8564: 55, 9875: 55, 8636: 55,
  9789: 54, 9823: 54,
  9847: 53,
}

function isNotablePlayer(p) {
  const tv = p.transferValue ?? 0
  if (tv >= MIN_TRANSFER_VALUE) return true
  return (p.stats?.appearances ?? 0) >= 10
}

// Mismo pool que expone players.js#getAllPlayers()
const allPlayers = []
for (const team of teams) {
  const teamExcluded = EXCLUDED_TEAMS.has(team.name)
  for (const section of team.squad) {
    for (const member of section.members) {
      if (teamExcluded && !member.fromExtra) continue
      const p = {
        id: member.id,
        name: member.name,
        teamId: team.id,
        teamName: team.name,
        teamLogo: team.logo,
        ccode: member.ccode,
        cname: member.cname,
        positionId: member.positionId,
        position: member.positionIdsDesc,
        height: member.height ?? null,
        age: member.age ?? null,
        transferValue: member.transferValue ?? null,
        shirtNumber: member.shirtNumber ?? null,
        image: `https://images.fotmob.com/image_resources/playerimages/${member.id}.png`,
        stats: member.stats || null,
        leagueId: TEAM_LEAGUE_MAP[team.id] ?? null,
      }
      if (!isNotablePlayer(p)) continue
      p.fame = FAME_BY_ID.get(p.id) ?? 3
      allPlayers.push(p)
    }
  }
}

const {
  buildCatalog, getEligibleSections, fameEligiblePlayers, computeBoardForDate,
} = await import(pathToFileURL(path.join(root, 'src/services/connections-sections.js')))

const players = fameEligiblePlayers(allPlayers)
const catalog = buildCatalog(players)
const eligible = getEligibleSections(catalog, players)

console.log(`Pool fame 1-2: ${players.length} jugadores`)
console.log(`Catálogo: ${catalog.length} secciones totales, ${eligible.length} elegibles (>=8) hoy`)
const byType = {}
for (const s of eligible) byType[s.type] = (byType[s.type] || 0) + 1
console.log('Elegibles por tipo:', byType)

function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

const START_DATE = '2026-09-27'
const DAYS = 30
const history = [] // { date, board }
let failures = 0
let impossible = 0
let ambiguousFound = 0
let repeatWithin3 = 0

const memo = new Map()
for (let i = 0; i < DAYS; i++) {
  const date = addDays(START_DATE, i)
  const { board, sectionIds } = computeBoardForDate(allPlayers, date, memo)
  if (!board) { impossible++; console.log(`❌ ${date}: tablero imposible`); continue }

  // tipos distintos
  const types = board.map(g => g.type)
  if (new Set(types).size !== 4) { failures++; console.log(`❌ ${date}: tipos repetidos`, types) }

  // ningún jugador en 2+ grupos
  const idCount = new Map()
  for (const g of board) for (const p of g.players) idCount.set(p.id, (idCount.get(p.id) || 0) + 1)
  const dupPlayers = [...idCount.values()].filter(c => c > 1)
  if (dupPlayers.length) { ambiguousFound++; console.log(`❌ ${date}: jugador repetido entre grupos`) }

  // cada jugador cumple SOLO la sección de su grupo (no otra de las 4 elegidas)
  for (const g of board) {
    for (const p of g.players) {
      const matchesOther = board.filter(o => o.id !== g.id).some(o => catalog.find(c => c.id === o.id)?.test(p))
      if (matchesOther) { ambiguousFound++; console.log(`❌ ${date}: ${p.name} cumple más de una sección`) }
    }
  }

  // no repetir sección usada en los 3 días previos
  for (let back = 1; back <= 3; back++) {
    const prevDate = addDays(date, -back)
    const prev = history.find(h => h.date === prevDate)
    if (!prev) continue
    const overlap = sectionIds.filter(id => prev.sectionIds.includes(id))
    if (overlap.length) { repeatWithin3++; console.log(`❌ ${date}: repite sección de ${prevDate} ->`, overlap) }
  }

  history.push({ date, sectionIds })
  console.log(`✅ ${date}: ${board.map(g => `${g.type}:${g.label}`).join(' | ')}`)
}

console.log('\n' + '='.repeat(60))
console.log(`Días simulados: ${DAYS}`)
console.log(`Tableros imposibles: ${impossible}`)
console.log(`Fallas de tipos distintos: ${failures}`)
console.log(`Jugadores ambiguos detectados: ${ambiguousFound}`)
console.log(`Repeticiones dentro de 3 días: ${repeatWithin3}`)
console.log(impossible + failures + ambiguousFound + repeatWithin3 === 0 ? '✅ TODO OK' : '❌ HAY FALLAS')

console.log('\n📋 3 tableros de ejemplo:')
for (const date of [history[0].date, history[10].date, history[29].date]) {
  const { board } = computeBoardForDate(allPlayers, date, memo)
  console.log(`\n-- ${date} --`)
  for (const g of board) {
    console.log(`[${g.type}] ${g.label}: ${g.players.map(p => p.name).join(', ')}`)
  }
}
