/**
 * 🔄 GOALDEMY — REFRESCAR PLANTELES DESDE FOTMOB
 *
 * Regenera src/dataGAMES.json con los planteles ACTUALES de FotMob, manteniendo
 * exactamente la misma estructura (para que players.js siga funcionando igual).
 *
 * FotMob movió la data de los equipos a `pageProps.fallback['team-{id}']` dentro
 * de los JSON de _next/data (los endpoints /api/teams viejos devuelven 404). Este
 * script resuelve el buildId desde el HTML y baja el squad de cada equipo por ahí.
 *
 * - Conserva la misma lista de equipos (usa los ids del dataGAMES actual).
 * - Si un equipo falla, mantiene su data vieja (nunca perdemos equipos/jugadores).
 * - Hace backup en src/dataGAMES.backup-before-refresh.json antes de escribir.
 *
 * Uso:  node scripts/refresh-fotmob-squads.cjs
 */

const https = require('https')
const fs = require('fs')
const path = require('path')

const DATA_PATH = path.join(__dirname, '..', 'src', 'dataGAMES.json')
const BACKUP_PATH = path.join(__dirname, '..', 'src', 'dataGAMES.backup-before-refresh.json')

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': UA, Accept: '*/*' } }, (r) => {
      let d = ''
      r.on('data', (c) => (d += c))
      r.on('end', () => resolve({ status: r.statusCode, body: d }))
    }).on('error', reject)
  })
}
const delay = (ms) => new Promise((r) => setTimeout(r, ms))

let _buildId = null
async function getBuildId(force = false) {
  if (_buildId && !force) return _buildId
  const home = await get('https://www.fotmob.com/')
  const m = home.body.match(/"buildId"\s*:\s*"([^"]+)"/)
  if (!m) throw new Error('No se pudo resolver el buildId de FotMob')
  _buildId = m[1]
  return _buildId
}

async function fetchTeam(id) {
  const bid = await getBuildId()
  let res = await get(`https://www.fotmob.com/_next/data/${bid}/en/teams/${id}/squad.json`)
  if (res.status === 404) {
    // buildId rotó: refrescar y reintentar una vez
    const nbid = await getBuildId(true)
    res = await get(`https://www.fotmob.com/_next/data/${nbid}/en/teams/${id}/squad.json`)
  }
  if (res.status !== 200) throw new Error(`HTTP ${res.status}`)
  const pp = JSON.parse(res.body).pageProps || {}
  const team = (pp.fallback || {})[`team-${id}`]
  if (!team || !team.squad || !Array.isArray(team.squad.squad)) throw new Error('sin squad en fallback')
  return team
}

function mapMember(p) {
  return {
    id: p.id,
    name: p.name,
    shirtNumber: p.shirtNumber ?? null,
    cname: p.cname ?? null,
    ccode: p.ccode ? p.ccode.toLowerCase() : null,
    role: { key: p.role?.key || null, fallback: p.role?.fallback || null },
    positionId: p.positionId ?? 0,
    positionIdsDesc: p.positionIdsDesc || p.role?.fallback || '',
    height: p.height ?? null,
    age: p.age ?? null,
    dateOfBirth: p.dateOfBirth ?? null,
    transferValue: p.transferValue ?? null,
    stats: {
      appearances: p.rating != null ? 1 : 0,
      goals: p.goals ?? 0,
      assists: p.assists ?? 0,
      yellowCards: p.ycards ?? 0,
      redCards: p.rcards ?? 0,
      minutes: 0,
    },
  }
}

function buildTeam(id, raw, prev) {
  const squad = []
  let count = 0
  for (const section of raw.squad.squad) {
    if (section.title === 'coach') continue
    const members = (section.members || []).map(mapMember)
    if (members.length) {
      squad.push({ title: section.title, members })
      count += members.length
    }
  }
  return {
    team: {
      name: raw.details?.name || prev?.name || String(id),
      shortName: raw.details?.shortName || prev?.shortName || raw.details?.name || String(id),
      id,
      logo: `https://images.fotmob.com/image_resources/logo/teamlogo/${id}.png`,
      squad,
    },
    count,
  }
}

async function main() {
  console.log('🔄 Refrescando planteles desde FotMob\n' + '='.repeat(50))
  const current = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'))
  console.log(`Equipos actuales: ${current.length}`)

  fs.writeFileSync(BACKUP_PATH, JSON.stringify(current, null, 2))
  console.log(`Backup: ${path.basename(BACKUP_PATH)}\n`)

  await getBuildId()
  console.log(`buildId: ${_buildId}\n`)

  const out = []
  let refreshed = 0, kept = 0, totalPlayers = 0

  for (let i = 0; i < current.length; i++) {
    const prev = current[i]
    const id = prev.id
    process.stdout.write(`[${i + 1}/${current.length}] ${prev.name} (${id})… `)
    try {
      const raw = await fetchTeam(id)
      const { team, count } = buildTeam(id, raw, prev)
      if (count < 11) throw new Error(`solo ${count} jugadores`)
      out.push(team)
      totalPlayers += count
      refreshed++
      console.log(`✅ ${count} jugadores`)
    } catch (e) {
      out.push(prev) // conservar data vieja
      const c = prev.squad.reduce((s, sec) => s + sec.members.length, 0)
      totalPlayers += c
      kept++
      console.log(`⚠️  ${e.message} — se mantiene la data vieja`)
    }
    if (i < current.length - 1) await delay(450)
  }

  fs.writeFileSync(DATA_PATH, JSON.stringify(out, null, 2))
  console.log('\n' + '='.repeat(50))
  console.log(`✅ Listo — refrescados: ${refreshed}, conservados: ${kept}, jugadores: ${totalPlayers}`)
  console.log(`Escrito: src/dataGAMES.json`)
}

main().catch((e) => { console.error('❌', e.message); process.exit(1) })
