/**
 * FOTMOB PLAYERS SERVICE
 *
 * Obtiene todos los jugadores de las ligas configuradas en LEAGUES usando la
 * API de FotMob: league standings → team IDs → squad por equipo.
 *
 * Cachea el resultado en localStorage por 24 horas.
 * Si la API falla, devuelve null y el caller usa el JSON estático de respaldo.
 */
import { LEAGUES, getLeagueTable, getTeamDetails } from './fotmob'

const CACHE_KEY = 'goaldemy_players_v2'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 horas

/**
 * Extrae IDs de equipos de un resultado de getLeagueTable
 */
function extractTeamIds(leagueTableResult) {
  const ids = new Set()
  // Tabla única (casi todos los leagues)
  if (Array.isArray(leagueTableResult?.table)) {
    leagueTableResult.table.forEach(t => { if (t?.id) ids.add(t.id) })
  }
  // Múltiples tablas (Liga Argentina)
  if (Array.isArray(leagueTableResult?.tables)) {
    leagueTableResult.tables.forEach(zone => {
      if (Array.isArray(zone?.teams)) {
        zone.teams.forEach(t => { if (t?.id) ids.add(t.id) })
      }
    })
  }
  return [...ids]
}

/**
 * Normaliza un miembro del squad de FotMob al formato que usan los juegos.
 * Incluye leagueId para que el sistema de dificultad pueda filtrar por liga.
 */
function normalizeMember(member, team, leagueId = null) {
  return {
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
    leagueId,
    stats: member.stats || null,
  }
}

/**
 * Carga TODOS los jugadores desde FotMob y los cachea en localStorage.
 * @returns {Promise<Array>} Array plano de jugadores normalizados
 */
export async function loadPlayersFromFotMob() {
  // 1. Revisar caché
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (raw) {
      const { ts, data } = JSON.parse(raw)
      if (Date.now() - ts < CACHE_TTL_MS && Array.isArray(data) && data.length > 0) {
        return data
      }
    }
  } catch { /* caché corrupto, reconstruir */ }

  // 2. Obtener standings de las ligas marcadas para alimentar el pool de jugadores.
  //    OJO: se filtra por `playersPool`, NO por `active`. `active` marca qué
  //    competición está "en vivo" en el sitio (hoy: el Mundial), pero las
  //    selecciones nacionales NO deben entrar a los juegos de clubes. Mientras
  //    ninguna liga tenga `playersPool:true`, este fetch es un no-op y los juegos
  //    corren sobre dataGAMES.json (refrescado con scripts/refresh-fotmob-squads.cjs).
  const leagueList = Object.values(LEAGUES).filter(l => l.playersPool)
  const tables = await Promise.allSettled(
    leagueList.map(l => getLeagueTable(l.id))
  )

  // 3. Extraer IDs únicos de equipos y mapearlos a su liga
  const teamIdToLeague = new Map() // teamId → leagueId
  tables.forEach((r, idx) => {
    if (r.status === 'fulfilled') {
      const leagueId = leagueList[idx]?.id ?? null
      extractTeamIds(r.value).forEach(id => teamIdToLeague.set(id, leagueId))
    }
  })

  if (teamIdToLeague.size === 0) {
    console.warn('[fotmob-players] No se obtuvieron IDs de equipos')
    return null
  }

  // 4. Obtener detalles de cada equipo (squad) en paralelo
  const teamIdsArray = [...teamIdToLeague.keys()]
  const teamDetails = await Promise.allSettled(
    teamIdsArray.map(id => getTeamDetails(id))
  )

  // 5. Aplanar miembros del squad
  const players = []
  teamDetails.forEach((r, idx) => {
    if (r.status !== 'fulfilled' || !r.value?.squad?.squad) return
    const td = r.value
    const leagueId = teamIdToLeague.get(teamIdsArray[idx]) ?? null
    const team = { id: td.id, name: td.name, logo: td.logo }
    td.squad.squad.forEach(section => {
      if (!Array.isArray(section.members)) return
      section.members.forEach(m => {
        if (m?.id) players.push(normalizeMember(m, team, leagueId))
      })
    })
  })

  if (players.length === 0) {
    console.warn('[fotmob-players] Squad vacío tras fetch')
    return null
  }

  // 6. Guardar en caché
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: players }))
  } catch (e) {
    console.warn('[fotmob-players] No se pudo guardar en localStorage', e)
  }

  return players
}

/**
 * Limpia el caché de jugadores (útil desde admin o para forzar refresco)
 */
export function clearPlayersCache() {
  try { localStorage.removeItem(CACHE_KEY) } catch {}
}
