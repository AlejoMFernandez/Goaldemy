/**
 * SERVICIO PRODE
 *
 * Capa fina sobre las RPCs de supabase/prode.sql. Los partidos y equipos NO se
 * vuelven a pedir acá: CompetitionPage.vue ya tiene `leagueData.allMatches`
 * cargado (getLeagueOverview), se lo pasa como prop a los componentes de PRODE.
 * Este servicio solo sabe leer/escribir picks y calcular la recompensa a mostrar
 * (los montos reales los otorga settle_prode_match_pick / settle_prode_champion_pick
 * server-side — estas constantes son solo para el preview visual, deben coincidir
 * con las que usa supabase/functions/settle-prode/index.ts).
 */
import { supabase } from './supabase'

export const PRODE_REWARDS = {
  exact: { points: 3, xp: 30, fichas: 15 },
  winner: { points: 1, xp: 10, fichas: 5 },
  champion: { xp: 500, fichas: 300, balones: 20 },
}

/** Equipos únicos (id + nombre) a partir de la lista de partidos ya cargada. */
export function deriveTeams(matches) {
  const map = new Map()
  for (const m of matches || []) {
    if (m.homeTeamId != null) map.set(String(m.homeTeamId), m.homeTeam)
    if (m.awayTeamId != null) map.set(String(m.awayTeamId), m.awayTeam)
  }
  return Array.from(map, ([id, name]) => ({ id, name }))
}

/** Kickoff del primer partido del torneo (ISO string), o null si no hay partidos. */
export function firstKickoff(matches) {
  const times = (matches || []).map(m => m.time).filter(Boolean).sort()
  return times[0] || null
}

export async function submitPick({ competition, matchId, homeTeam, awayTeam, homePick, awayPick, kickoffAt, round }) {
  const { data, error } = await supabase.rpc('submit_prode_pick', {
    p_competition: competition, p_match_id: String(matchId),
    p_home_team: homeTeam, p_away_team: awayTeam,
    p_home_pick: homePick, p_away_pick: awayPick,
    p_kickoff_at: kickoffAt, p_round: round || null,
  })
  if (error) return { ok: false, error: error.message }
  return data
}

export async function submitChampionPick({ competition, teamId, teamName, lockedAt }) {
  const { data, error } = await supabase.rpc('submit_prode_champion_pick', {
    p_competition: competition, p_team_id: String(teamId), p_team_name: teamName, p_locked_at: lockedAt,
  })
  if (error) return { ok: false, error: error.message }
  return data
}

/** Picks propios de una competición, indexados por match_id para lookup O(1) en la UI. */
export async function getMyPicks(competition) {
  const { data, error } = await supabase
    .from('prode_picks')
    .select('id, match_id, home_pick, away_pick, kickoff_at, points, xp_awarded, fichas_awarded, settled_at')
    .eq('competition', competition)
  if (error) { console.warn('[prode] getMyPicks error:', error.message); return {} }
  const byMatch = {}
  for (const row of data || []) byMatch[row.match_id] = row
  return byMatch
}

export async function getMyChampionPick(competition) {
  const { data, error } = await supabase
    .from('prode_champion_picks')
    .select('team_id, team_name, locked_at, result, xp_awarded, fichas_awarded, balones_awarded, settled_at')
    .eq('competition', competition)
    .maybeSingle()
  if (error) { console.warn('[prode] getMyChampionPick error:', error.message); return null }
  return data
}

export function isChampionPickEnabled(comp) {
  return !!comp?.bracket
}
