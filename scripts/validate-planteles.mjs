// Valida src/dataGAMES.json antes de abrir el PR automático de planteles.
//
//   node scripts/validate-planteles.mjs [archivo-nuevo] [ref-git-anterior]
//   (por defecto: src/dataGAMES.json contra HEAD)
//
// Falla (exit 1) si:
//   - el JSON no parsea o no es un array de equipos con { id, name, squad[] }
//   - la cantidad de equipos cae más de un 10% respecto de la versión anterior
//   - la cantidad de jugadores cae más de un 10% (señal de scrapeo roto)
// Sin red, sin secretos: sólo lee el archivo y `git show <ref>:<archivo>`.
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const FILE = process.argv[2] || 'src/dataGAMES.json'
const REF = process.argv[3] || 'HEAD'
const MAX_DROP = 0.10

function fail(msg) {
  console.error(`✗ ${msg}`)
  process.exit(1)
}

function stats(teams, label) {
  if (!Array.isArray(teams)) fail(`${label}: no es un array de equipos`)
  let players = 0
  teams.forEach((t, i) => {
    if (!t || t.id == null || !t.name || !Array.isArray(t.squad)) {
      fail(`${label}: equipo #${i} sin id/name/squad[] (${JSON.stringify(t)?.slice(0, 120)})`)
    }
    for (const section of t.squad) players += Array.isArray(section?.members) ? section.members.length : 0
  })
  return { teams: teams.length, players }
}

let next
try { next = JSON.parse(readFileSync(FILE, 'utf8')) } catch (e) { fail(`${FILE} no es JSON válido: ${e.message}`) }
const now = stats(next, 'nuevo')
if (now.teams === 0 || now.players === 0) fail('el archivo nuevo no tiene equipos/jugadores')

let prev = null
try {
  const raw = execFileSync('git', ['show', `${REF}:${FILE}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  prev = stats(JSON.parse(raw), 'anterior')
} catch {
  console.warn(`! no se pudo leer ${REF}:${FILE}; sólo se valida el formato`)
}

console.log(`equipos: ${prev?.teams ?? '?'} → ${now.teams} · jugadores: ${prev?.players ?? '?'} → ${now.players}`)

if (prev) {
  if (now.teams < prev.teams * (1 - MAX_DROP)) fail(`cayeron los equipos más de un ${MAX_DROP * 100}% (${prev.teams} → ${now.teams})`)
  if (now.players < prev.players * (1 - MAX_DROP)) fail(`cayeron los jugadores más de un ${MAX_DROP * 100}% (${prev.players} → ${now.players})`)
}
console.log('✓ dataGAMES.json válido')
