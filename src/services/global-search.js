/**
 * BÚSQUEDA GLOBAL DEL HEADER
 *
 * Agrupa resultados de varias fuentes en una sola búsqueda:
 * - Usuarios   → Supabase (searchPublicProfiles)   → /u/:id
 * - Jugadores  → dataGAMES.json (getAllPlayers)     → /team/:teamId (su club)
 * - Equipos    → dataGAMES.json (getAllTeams)        → /team/:id
 * - Competiciones → catálogo (competitions.js)       → /leagues/:slug o /competiciones
 */
import { getAllPlayers, getAllTeams } from './players'
import { COMPETITIONS, isRoutedCompetition } from './competitions'
import { searchPublicProfiles } from './user-profiles'

export function competitionRoute(c) {
  return isRoutedCompetition(c?.slug) ? `/leagues/${c.slug}` : '/competiciones'
}

function norm(s) {
  return (s || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
}

export async function searchAll(term, { limitEach = 5, currentUserId = null } = {}) {
  const q = norm(term)
  const empty = { users: [], players: [], teams: [], competitions: [] }
  if (q.length < 2) return empty

  // Usuarios (async). No bloquea a los demás si falla.
  let users = []
  try {
    const { data, error } = await searchPublicProfiles(term, limitEach + 3)
    if (!error) users = (data || []).filter(u => u.id !== currentUserId).slice(0, limitEach)
  } catch { /* ignore */ }

  // Jugadores y equipos (cliente, sobre el dataset local)
  let players = []
  let teams = []
  try {
    players = getAllPlayers().filter(p => norm(p.name).includes(q)).slice(0, limitEach)
  } catch { /* ignore */ }
  try {
    teams = getAllTeams().filter(t => norm(t.name).includes(q)).slice(0, limitEach)
  } catch { /* ignore */ }

  // Competiciones (catálogo)
  const competitions = COMPETITIONS
    .filter(c => norm(c.name).includes(q) || norm(c.short).includes(q) || norm(c.country).includes(q))
    .slice(0, limitEach)

  return { users, players, teams, competitions }
}

export function countResults(r) {
  if (!r) return 0
  return (r.users?.length || 0) + (r.players?.length || 0) + (r.teams?.length || 0) + (r.competitions?.length || 0)
}
