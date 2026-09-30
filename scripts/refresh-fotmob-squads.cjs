/**
 * 🔄 GOALDEMY — REFRESCAR PLANTELES Y STATS DESDE FOTMOB
 *
 * Regenera src/dataGAMES.json con los planteles ACTUALES de FotMob, manteniendo
 * exactamente la misma estructura (para que players.js siga funcionando igual),
 * y además refresca las stats de temporada REALES de cada jugador (partidos,
 * minutos, goles, asistencias, amarillas, rojas) desde su página individual.
 *
 * FUENTES:
 * - Plantel del equipo:  pageProps.fallback['team-{id}']            (squad.json)
 * - Stats de temporada:  pageProps.fallback['player:{id}'].mainLeague (p.json)
 *   `mainLeague` es exactamente el bloque "Season stats" que se ve en la
 *   página del jugador (liga principal, temporada en curso), verificado a
 *   mano contra fotmob.com para varios jugadores.
 *
 * FotMob movió la data a `_next/data/{buildId}/...` (los endpoints /api viejos
 * devuelven 404). Este script resuelve el buildId desde el HTML y reintenta si
 * rota durante la corrida.
 *
 * GARANTÍAS:
 * - Si el plantel de un equipo falla, se conserva el equipo viejo completo.
 * - Si las stats de un jugador puntual fallan, se conserva SU stat vieja
 *   (o se deja en cero si nunca tuvo una) — nunca se pierde a los demás.
 * - Se respeta a FotMob con un delay entre pedidos y reintentos acotados.
 *
 * ARCHIVOS QUE ESCRIBE:
 * - src/dataGAMES.json                 (igual estructura de siempre)
 * - src/dataGAMES.backup-before-refresh.json  (backup antes de pisar)
 * - src/dataGAMES.meta.json            (temporada + fecha del último refresco)
 *
 * JUGADORES SUELTOS (src/data/players-extra.json):
 * Lista de IDs de FotMob de jugadores que se quieren incluir aunque su club no
 * esté en la lista de equipos de arriba. Se refrescan igual (mismo pipeline de
 * stats) y se insertan en el equipo real al que pertenecen (creándolo si hace
 * falta). Vacía por default: no hace nada hasta que se le carguen IDs.
 *
 * Uso:  npm run refresh:players   (alias: npm run refresh:data)
 *       node scripts/refresh-fotmob-squads.cjs
 *
 * Automático: .github/workflows/refresh-data.yml lo corre todos los lunes.
 */

const https = require('https')
const fs = require('fs')
const path = require('path')

const DATA_PATH = path.join(__dirname, '..', 'src', 'dataGAMES.json')
const BACKUP_PATH = path.join(__dirname, '..', 'src', 'dataGAMES.backup-before-refresh.json')
const META_PATH = path.join(__dirname, '..', 'src', 'dataGAMES.meta.json')
const EXTRA_PLAYERS_PATH = path.join(__dirname, '..', 'src', 'data', 'players-extra.json')

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'

const TEAM_DELAY_MS = 450
const PLAYER_DELAY_MS = 350
const RETRY_DELAY_MS = 1200

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

async function getWithRetry(url, tries = 3) {
  let lastErr
  for (let i = 0; i < tries; i++) {
    try {
      return await get(url)
    } catch (e) {
      lastErr = e
      await delay(RETRY_DELAY_MS)
    }
  }
  throw lastErr
}

let _buildId = null
async function getBuildId(force = false) {
  if (_buildId && !force) return _buildId
  const home = await getWithRetry('https://www.fotmob.com/')
  const m = home.body.match(/"buildId"\s*:\s*"([^"]+)"/)
  if (!m) throw new Error('No se pudo resolver el buildId de FotMob')
  _buildId = m[1]
  return _buildId
}

async function fetchTeam(id) {
  const bid = await getBuildId()
  let res = await getWithRetry(`https://www.fotmob.com/_next/data/${bid}/en/teams/${id}/squad.json`)
  if (res.status === 404) {
    // buildId rotó: refrescar y reintentar una vez
    const nbid = await getBuildId(true)
    res = await getWithRetry(`https://www.fotmob.com/_next/data/${nbid}/en/teams/${id}/squad.json`)
  }
  if (res.status !== 200) throw new Error(`HTTP ${res.status}`)
  const pp = JSON.parse(res.body).pageProps || {}
  const team = (pp.fallback || {})[`team-${id}`]
  if (!team || !team.squad || !Array.isArray(team.squad.squad)) throw new Error('sin squad en fallback')
  return team
}

/** Baja la página individual de un jugador (bio + stats de temporada en mainLeague). */
async function fetchPlayer(id) {
  const bid = await getBuildId()
  let res = await getWithRetry(`https://www.fotmob.com/_next/data/${bid}/en/players/${id}/p.json`)
  if (res.status === 404) {
    const nbid = await getBuildId(true)
    res = await getWithRetry(`https://www.fotmob.com/_next/data/${nbid}/en/players/${id}/p.json`)
  }
  if (res.status !== 200) throw new Error(`HTTP ${res.status}`)
  const pp = JSON.parse(res.body).pageProps || {}
  const player = (pp.fallback || {})[`player:${id}`]
  if (!player) throw new Error('sin datos de jugador en fallback')
  return player
}

/**
 * Convierte el bloque `mainLeague` (liga principal, temporada en curso) de la
 * página del jugador en el objeto `stats` que consumen los juegos.
 * Usa `localizedTitleId` (no el título traducible) para que sea estable.
 */
function statsFromMainLeague(mainLeague) {
  if (!mainLeague || !Array.isArray(mainLeague.stats)) return null
  const byId = {}
  for (const s of mainLeague.stats) byId[s.localizedTitleId] = s.value
  const num = (v) => (typeof v === 'number' ? v : 0)
  return {
    appearances: num(byId.matches_uppercase),
    minutes: num(byId.minutes_played),
    goals: num(byId.goals),
    assists: num(byId.assists),
    yellowCards: num(byId.yellow_cards),
    redCards: num(byId.red_cards),
    competition: mainLeague.leagueName || null,
    season: mainLeague.season || null,
  }
}

function emptyStats(updatedAt) {
  return {
    appearances: 0, minutes: 0, goals: 0, assists: 0, yellowCards: 0, redCards: 0,
    competition: null, season: null, updatedAt,
  }
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
    stats: null, // se completa en la segunda pasada (refreshPlayerStats)
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

/** Mapea la posición principal (texto libre de FotMob) al positionId 0-3 que usan los juegos. */
const POSITION_GROUP_BY_KEY = {
  goalkeeper: 0,
  centreback: 1, leftback: 1, rightback: 1, leftwingback: 1, rightwingback: 1, defender: 1,
  defensivemidfielder: 2, centralmidfielder: 2, centerattackingmidfielder: 2, attackingmidfielder: 2,
  leftmidfielder: 2, rightmidfielder: 2, midfielder: 2,
  leftwinger: 3, rightwinger: 3, striker: 3, centerforward: 3, forward: 3,
}
const SECTION_TITLE_BY_GROUP = { 0: 'keepers', 1: 'defenders', 2: 'midfielders', 3: 'attackers' }

/** Club actual del jugador. Si `primaryTeam` viene vacío (pasa con algunos free
 * agents recién salidos de un club), usa la entrada más reciente de su carrera. */
function currentTeamOf(player) {
  if (player.primaryTeam?.teamId) {
    return { teamId: player.primaryTeam.teamId, teamName: player.primaryTeam.teamName }
  }
  const entries = player.careerHistory?.careerItems?.senior?.teamEntries
  if (Array.isArray(entries) && entries.length) {
    return { teamId: entries[0].teamId, teamName: entries[0].team }
  }
  return { teamId: null, teamName: null }
}

/** Convierte la página completa de un jugador "suelto" en un member + a qué equipo pertenece. */
function mapExtraPlayer(player, updatedAt) {
  const posKey = player.positionDescription?.primaryPosition?.key || null
  const positionId = POSITION_GROUP_BY_KEY[posKey] ?? 3
  const infoByKey = {}
  for (const info of player.playerInformation || []) infoByKey[info.translationKey] = info
  const countryInfo = infoByKey.country_sentencecase
  const positionsDesc = (player.positionDescription?.positions || [])
    .map((p) => p.strPosShort?.label).filter(Boolean).join(',')
    || player.positionDescription?.primaryPosition?.label || ''
  const stats = statsFromMainLeague(player.mainLeague)

  const member = {
    id: player.id,
    name: player.name,
    shirtNumber: infoByKey.shirt?.value?.numberValue ?? null,
    cname: countryInfo?.value?.fallback ?? null,
    ccode: countryInfo?.countryCode ? countryInfo.countryCode.toLowerCase() : null,
    role: { key: posKey, fallback: player.positionDescription?.primaryPosition?.label || null },
    positionId,
    positionIdsDesc: positionsDesc,
    height: infoByKey.height_sentencecase?.value?.numberValue ?? null,
    age: infoByKey.age_sentencecase?.value?.numberValue ?? null,
    dateOfBirth: player.birthDate ? String(player.birthDate).slice(0, 10) : null,
    transferValue: infoByKey.transfer_value?.value?.numberValue ?? null,
    stats: stats ? { ...stats, updatedAt } : emptyStats(updatedAt),
    // Viene de players-extra.json: siempre entra al pool de juego aunque su
    // club esté en EXCLUDED_TEAMS (ver players.js).
    fromExtra: true,
  }
  const { teamId, teamName } = currentTeamOf(player)
  return { member, teamId, teamName }
}

/** Segunda pasada: refresca stats.* de cada jugador de `members`, con fallback a su stat vieja. */
async function refreshPlayerStats(members, prevStatsById, nowIso) {
  let ok = 0, fallback = 0
  for (let i = 0; i < members.length; i++) {
    const m = members[i]
    process.stdout.write(`  [${i + 1}/${members.length}] ${m.name}… `)
    try {
      const player = await fetchPlayer(m.id)
      const stats = statsFromMainLeague(player.mainLeague)
      if (!stats) throw new Error('sin mainLeague')
      m.stats = { ...stats, updatedAt: nowIso }
      ok++
      console.log(`✅ ${stats.season || 's/d'} ${stats.competition || ''} — ${stats.appearances} PJ, ${stats.minutes}min, ${stats.goals}g/${stats.assists}a`)
    } catch (e) {
      const prev = prevStatsById.get(m.id)
      if (prev) {
        m.stats = prev
        fallback++
        console.log(`⚠️  ${e.message} — se mantiene stat vieja (${prev.season || 's/d'})`)
      } else {
        m.stats = emptyStats(nowIso)
        fallback++
        console.log(`⚠️  ${e.message} — sin dato previo, stats en 0`)
      }
    }
    if (i < members.length - 1) await delay(PLAYER_DELAY_MS)
  }
  return { ok, fallback }
}

/** Suma los jugadores sueltos de players-extra.json al array de equipos `out`. */
async function mergeExtraPlayers(out, nowIso) {
  let ids = []
  try {
    ids = JSON.parse(fs.readFileSync(EXTRA_PLAYERS_PATH, 'utf8'))
  } catch {
    ids = []
  }
  if (!Array.isArray(ids) || ids.length === 0) return { added: 0, failed: 0 }

  console.log(`\nJugadores sueltos (players-extra.json): ${ids.length}\n` + '-'.repeat(50))
  let added = 0, failed = 0
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]
    process.stdout.write(`[${i + 1}/${ids.length}] id ${id}… `)
    try {
      const player = await fetchPlayer(id)
      const { member, teamId, teamName } = mapExtraPlayer(player, nowIso)
      if (!teamId) throw new Error('sin equipo actual (primaryTeam)')

      let team = out.find((t) => t.id === teamId)
      if (!team) {
        team = {
          name: teamName || String(teamId),
          shortName: teamName || String(teamId),
          id: teamId,
          logo: `https://images.fotmob.com/image_resources/logo/teamlogo/${teamId}.png`,
          squad: [],
        }
        out.push(team)
      }
      // Si ya está en el plantel real del equipo (fetch normal del paso 1), NO
      // duplicar: el plantel real ya lo trae con su sección/posición correcta.
      // Buscar en TODAS las secciones, no sólo en la que heurísticamente le
      // asignaríamos acá (evita duplicados cuando la sección no coincide).
      let existing = null
      for (const sec of team.squad) {
        const idx = sec.members.findIndex((mm) => mm.id === member.id)
        if (idx >= 0) { existing = { sec, idx }; break }
      }
      if (existing) {
        existing.sec.members[existing.idx] = { ...existing.sec.members[existing.idx], stats: member.stats, fromExtra: true }
        added++
        console.log(`= ${member.name} (${teamName}) ya estaba en el plantel — stats actualizadas`)
      } else {
        const sectionTitle = SECTION_TITLE_BY_GROUP[member.positionId]
        let section = team.squad.find((s) => s.title === sectionTitle)
        if (!section) {
          section = { title: sectionTitle, members: [] }
          team.squad.push(section)
        }
        section.members.push(member)
        added++
        console.log(`✅ ${member.name} (${teamName})`)
      }
    } catch (e) {
      failed++
      console.log(`⚠️  ${e.message} — se omite`)
    }
    if (i < ids.length - 1) await delay(PLAYER_DELAY_MS)
  }
  return { added, failed }
}

function mode(values) {
  const counts = new Map()
  for (const v of values) {
    if (!v) continue
    counts.set(v, (counts.get(v) || 0) + 1)
  }
  let best = null, bestCount = 0
  for (const [v, c] of counts) if (c > bestCount) { best = v; bestCount = c }
  return best
}

async function main() {
  console.log('🔄 Refrescando planteles + stats desde FotMob\n' + '='.repeat(50))
  const current = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'))
  console.log(`Equipos actuales: ${current.length}`)

  fs.writeFileSync(BACKUP_PATH, JSON.stringify(current, null, 2))
  console.log(`Backup: ${path.basename(BACKUP_PATH)}\n`)

  // Stats viejas por id de jugador, para usar de fallback si el refresco individual falla
  const prevStatsById = new Map()
  for (const t of current) {
    for (const sec of t.squad || []) {
      for (const m of sec.members || []) {
        if (m.stats) prevStatsById.set(m.id, m.stats)
      }
    }
  }

  await getBuildId()
  console.log(`buildId: ${_buildId}\n`)

  const nowIso = new Date().toISOString()
  const out = []
  const freshMembers = [] // solo de equipos refrescados esta corrida (para la segunda pasada de stats)
  let refreshed = 0, kept = 0

  console.log('Paso 1/2 — planteles\n' + '-'.repeat(50))
  for (let i = 0; i < current.length; i++) {
    const prev = current[i]
    const id = prev.id
    process.stdout.write(`[${i + 1}/${current.length}] ${prev.name} (${id})… `)
    try {
      const raw = await fetchTeam(id)
      const { team, count } = buildTeam(id, raw, prev)
      if (count < 11) throw new Error(`solo ${count} jugadores`)
      out.push(team)
      for (const sec of team.squad) for (const m of sec.members) freshMembers.push(m)
      refreshed++
      console.log(`✅ ${count} jugadores`)
    } catch (e) {
      out.push(prev) // conservar equipo viejo completo (plantel Y stats)
      kept++
      console.log(`⚠️  ${e.message} — se mantiene la data vieja`)
    }
    if (i < current.length - 1) await delay(TEAM_DELAY_MS)
  }

  console.log(`\nPaso 2/2 — stats de temporada de ${freshMembers.length} jugadores\n` + '-'.repeat(50))
  const { ok: statsOk, fallback: statsFallback } = await refreshPlayerStats(freshMembers, prevStatsById, nowIso)

  const { added: extraAdded, failed: extraFailed } = await mergeExtraPlayers(out, nowIso)

  fs.writeFileSync(DATA_PATH, JSON.stringify(out, null, 2))

  const totalPlayers = out.reduce((s, t) => s + t.squad.reduce((a, sec) => a + sec.members.length, 0), 0)
  const season = mode(freshMembers.map((m) => m.stats?.season)) || null
  const meta = {
    season,
    generatedAt: nowIso,
    source: 'FotMob player page mainLeague (temporada/liga principal de cada jugador)',
    teams: { refreshed, kept },
    players: { total: totalPlayers, statsUpdated: statsOk, statsFallback, extraAdded, extraFailed },
  }
  fs.writeFileSync(META_PATH, JSON.stringify(meta, null, 2))

  console.log('\n' + '='.repeat(50))
  console.log(`✅ Equipos — refrescados: ${refreshed}, conservados: ${kept}`)
  console.log(`✅ Stats — actualizadas: ${statsOk}, con fallback: ${statsFallback}`)
  if (extraAdded || extraFailed) console.log(`✅ Sueltos — agregados: ${extraAdded}, fallidos: ${extraFailed}`)
  console.log(`✅ Total jugadores en el archivo: ${totalPlayers}`)
  console.log(`Escrito: src/dataGAMES.json, src/dataGAMES.meta.json (temporada: ${season || 's/d'})`)

  // Muestra de 10 jugadores para revisar a ojo
  const sample = freshMembers.filter((m) => m.stats?.season).slice(0, 10)
  if (sample.length) {
    console.log('\n📋 Muestra de 10 jugadores con stats nuevas:\n' + '-'.repeat(50))
    for (const m of sample) {
      console.log(`${m.name.padEnd(24)} ${(m.stats.competition || '').padEnd(16)} ${m.stats.season}  PJ:${m.stats.appearances}  min:${m.stats.minutes}  g:${m.stats.goals}  a:${m.stats.assists}  TA:${m.stats.yellowCards}  TR:${m.stats.redCards}`)
    }
  }
}

main().catch((e) => { console.error('❌', e.message); process.exit(1) })
