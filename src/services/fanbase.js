/**
 * PEÑAS POR EQUIPO
 *
 * Agrupa usuarios por user_profiles.favorite_team (dato que ya se pide al
 * registrarse) en vez de inventar un sistema de clanes desde cero. Dos vistas:
 * el ranking de qué hinchada suma más XP (get_fanbase_leaderboard) y el
 * ranking interno de una hinchada puntual (get_fanbase_members, en /team/:id).
 */
import { supabase } from './supabase'

/** Ranking de peñas por XP del período ('weekly' | 'monthly' | 'all_time'). */
export async function getFanbaseLeaderboard(period = 'weekly') {
  const { data, error } = await supabase.rpc('get_fanbase_leaderboard', { p_period: period })
  if (error) { console.warn('[fanbase] leaderboard error:', error.message); return [] }
  return (data || []).map(r => ({
    team: r.team,
    memberCount: Number(r.member_count) || 0,
    activeCount: Number(r.active_count) || 0,
    totalXp: Number(r.total_xp) || 0,
  }))
}

/** Ranking interno de una peña (los hinchas de `team`, por XP del período). */
export async function getFanbaseMembers(team, period = 'weekly') {
  if (!team) return []
  const { data, error } = await supabase.rpc('get_fanbase_members', { p_team: team, p_period: period })
  if (error) { console.warn('[fanbase] members error:', error.message); return [] }
  return (data || []).map(r => ({
    userId: r.user_id,
    displayName: r.display_name,
    avatarUrl: r.avatar_url,
    xp: Number(r.xp) || 0,
  }))
}
