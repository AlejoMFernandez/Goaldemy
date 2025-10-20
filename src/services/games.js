import { supabase } from './supabase';

function normalizeGame(row) {
  const cover = row?.cover_url ?? row?.image ?? null
  return {
    ...row,
    cover_url: cover,
    image: cover,
  }
}

// Fetch list of games from Supabase 'games' table
export async function fetchGames() {
  console.debug('[games.js] fetchGames start')
  // First try with cover_url
  let { data, error } = await supabase
    .from('games')
<<<<<<< HEAD
    .select('id, name, description, cover_url, created_at')
=======
    .select('id, slug, name, description, cover_url, created_at')
>>>>>>> d0aeee3 (Opciones en Registro, agregado de logros y fix de XP)
    .order('created_at', { ascending: false })

  // Fallback to legacy schema using image
  if (error && (error.code === '42703' || /column .* does not exist/i.test(error.message || ''))) {
    const res = await supabase
      .from('games')
<<<<<<< HEAD
      .select('id, name, description, image, created_at')
=======
      .select('id, slug, name, description, image, created_at')
>>>>>>> d0aeee3 (Opciones en Registro, agregado de logros y fix de XP)
      .order('created_at', { ascending: false })
    data = res.data; error = res.error
  }

  if (error) {
    console.error('[games.js fetchGames] Error fetching games:', error)
    throw error
  }
  console.debug('[games.js] fetchGames ok, rows:', data?.length ?? 0)
  return (data || []).map(normalizeGame)
}

// Optionally fetch a single game by id (useful later)
export async function fetchGameById(id) {
  let { data, error } = await supabase
    .from('games')
<<<<<<< HEAD
    .select('id, name, description, cover_url, created_at')
=======
    .select('id, slug, name, description, cover_url, created_at')
>>>>>>> d0aeee3 (Opciones en Registro, agregado de logros y fix de XP)
    .eq('id', id)
    .maybeSingle()

  if (error && (error.code === '42703' || /column .* does not exist/i.test(error.message || ''))) {
    const res = await supabase
      .from('games')
<<<<<<< HEAD
      .select('id, name, description, image, created_at')
=======
      .select('id, slug, name, description, image, created_at')
>>>>>>> d0aeee3 (Opciones en Registro, agregado de logros y fix de XP)
      .eq('id', id)
      .maybeSingle()
    data = res.data; error = res.error
  }

  if (error) {
    console.error('[games.js fetchGameById] Error fetching game:', error)
    throw error
  }

  return data ? normalizeGame(data) : null
}

// Fetch multiple games by IDs and return a map
export async function fetchGamesByIds(ids = []) {
  if (!ids.length) return {}
  let { data, error } = await supabase
    .from('games')
<<<<<<< HEAD
    .select('id, name, cover_url')
=======
    .select('id, slug, name, cover_url')
>>>>>>> d0aeee3 (Opciones en Registro, agregado de logros y fix de XP)
    .in('id', ids)
  if (error && (error.code === '42703' || /column .* does not exist/i.test(error.message || ''))) {
    const res = await supabase
      .from('games')
<<<<<<< HEAD
      .select('id, name, image')
=======
      .select('id, slug, name, image')
>>>>>>> d0aeee3 (Opciones en Registro, agregado de logros y fix de XP)
      .in('id', ids)
    data = res.data; error = res.error
  }
  if (error) throw error
  const map = {}
  ;(data || []).forEach(g => { map[g.id] = normalizeGame(g) })
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
