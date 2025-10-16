import { supabase } from './supabase';

// Fetch list of games from Supabase 'games' table
export async function fetchGames() {
  console.debug('[games.js] fetchGames start')
  const { data, error } = await supabase
    .from('games')
    .select('id,name,description,image,created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[games.js fetchGames] Error fetching games:', error);
    throw error;
  }
  console.debug('[games.js] fetchGames ok, rows:', data?.length ?? 0)
  return data || [];
}

// Optionally fetch a single game by id (useful later)
export async function fetchGameById(id) {
  const { data, error } = await supabase
    .from('games')
    .select('id,name,description,image,created_at')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('[games.js fetchGameById] Error fetching game:', error);
    throw error;
  }

  return data;
}

// Fetch multiple games by IDs and return a map
export async function fetchGamesByIds(ids = []) {
  if (!ids.length) return {}
  const { data, error } = await supabase
    .from('games')
    .select('id, name, cover_url')
    .in('id', ids)
  if (error) throw error
  const map = {}
  ;(data || []).forEach(g => { map[g.id] = g })
  return map
}

// Fetch XP events for a user and aggregate by game id
export async function getUserXpByGame(userId) {
  const { data: events, error } = await supabase
    .from('xp_events')
    .select('game_id, amount')
    .eq('user_id', userId)
  if (error) return { data: [], error }
  const totals = new Map()
  ;(events || []).forEach(e => {
    if (!e.game_id) return
    totals.set(e.game_id, (totals.get(e.game_id) || 0) + (e.amount || 0))
  })
  const gameIds = Array.from(totals.keys())
  const gamesById = await fetchGamesByIds(gameIds)
  const rows = gameIds.map(id => ({
    id,
    name: gamesById[id]?.name || 'Juego',
    cover_url: gamesById[id]?.cover_url || null,
    xp: totals.get(id) || 0,
  })).sort((a,b) => b.xp - a.xp)
  return { data: rows, error: null }
}
