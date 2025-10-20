import { supabase } from './supabase';
import { getAuthUser } from './auth';

function normalizeGame(row) {
  const cover = row?.cover_url ?? row?.image ?? null
  const slug = row?.slug || ''
  const fallbackNames = {
    'guess-player': 'Adivina el jugador',
    'nationality': 'Nacionalidad correcta',
    'player-position': 'Posición del jugador',
  }
  const fallbackDesc = {
    'guess-player': 'Adivina el nombre del jugador a partir de su foto',
    'nationality': 'Selecciona la nacionalidad correcta del jugador',
    'player-position': 'Elegí la posición correcta del jugador mostrado',
  }
  return {
    ...row,
    cover_url: cover,
    image: cover,
    name: row?.name || fallbackNames[slug] || 'Juego',
    description: row?.description || fallbackDesc[slug] || 'Próximamente…',
  }
}

// Fetch list of games from Supabase 'games' table
export async function fetchGames() {
  console.debug('[games.js] fetchGames start')
  // First try with cover_url
  let { data, error } = await supabase
    .from('games')
    .select('id, slug, name, description, cover_url, created_at')
    .order('created_at', { ascending: false })

  // Fallback to legacy schema using image
  if (error && (error.code === '42703' || /column .* does not exist/i.test(error.message || ''))) {
    const res = await supabase
      .from('games')
      .select('id, slug, name, description, image, created_at')
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
    .select('id, slug, name, description, cover_url, created_at')
    .eq('id', id)
    .maybeSingle()

  if (error && (error.code === '42703' || /column .* does not exist/i.test(error.message || ''))) {
    const res = await supabase
      .from('games')
      .select('id, slug, name, description, image, created_at')
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
    .select('id, slug, name, cover_url')
    .in('id', ids)
  if (error && (error.code === '42703' || /column .* does not exist/i.test(error.message || ''))) {
    const res = await supabase
      .from('games')
      .select('id, slug, name, image')
      .in('id', ids)
    data = res.data; error = res.error
  }
  if (error) throw error
  const map = {}
  ;(data || []).forEach(g => { map[g.id] = normalizeGame(g) })
  return map
}

// Fetch XP events for a user and aggregate by game id
// Cache whether the RPC exists to avoid spamming 404s
let xpByGameRpcAvailable;

export async function getUserXpByGame(userId) {
  // If we already know RPC is missing, skip calling it
  if (xpByGameRpcAvailable === false) {
    return await fallbackAggregateForCurrentUser(userId)
  }

  // First, try the RPC (preferred: works for any user due to SECURITY DEFINER)
  const { data, error } = await supabase.rpc('get_user_xp_by_game', { p_user_id: userId })
  // If RPC exists and worked, return mapped rows
  if (!error) {
    xpByGameRpcAvailable = true
    const rows = (data || []).map(r => ({
      id: r.game_id ?? 'unknown',
      name: (r?.name ?? null) || (r?.game_id ? 'Juego' : 'Otros'),
      cover_url: r?.cover_url ?? null,
      xp: r?.xp ?? 0,
    }))
    return { data: rows, error: null }
  }

  // If RPC is missing (404/PGRST202), fall back for the CURRENT user only using xp_events (RLS allows own rows)
  const rpcMissing = error && (
    error.code === 'PGRST202' || /Could not find the function/i.test(error.message || '') || /schema cache/i.test(error.details || '')
  )
  if (!rpcMissing) {
    // Some other error: bubble up
    return { data: [], error }
  }
  // Mark as missing to skip future failing calls
  xpByGameRpcAvailable = false
  return await fallbackAggregateForCurrentUser(userId)
}

async function fallbackAggregateForCurrentUser(userId) {
  try {
    const { id: authId } = getAuthUser()
    const targetId = userId || authId
    if (!authId || !targetId || targetId !== authId) {
      // Not authenticated or requesting other user's breakdown: cannot read without the RPC
      return { data: [], error: null }
    }

    // Client-side aggregate: sum amounts by game_id for current user
    const { data: events, error: evErr } = await supabase
      .from('xp_events')
      .select('game_id, amount')
      .eq('user_id', authId)
    if (evErr) return { data: [], error: evErr }

    const sums = new Map()
    for (const e of (events || [])) {
      if (!e) continue
      const gid = e.game_id || null
      const prev = sums.get(gid) || 0
      sums.set(gid, prev + (e.amount || 0))
    }

    // Enrich with game names/covers for non-null game ids
    const ids = Array.from(sums.keys()).filter(k => k)
    const map = await fetchGamesByIds(ids)

    const rows = []
    for (const [gid, xp] of sums.entries()) {
      if (gid) {
        const g = map[gid] || { name: 'Juego', cover_url: null }
        rows.push({ id: gid, name: g.name || 'Juego', cover_url: g.cover_url || null, xp })
      } else if (xp > 0) {
        // Bucket for events without game_id
        rows.push({ id: 'unknown', name: 'Otros', cover_url: null, xp })
      }
    }

    // Sort desc by xp to mimic RPC ordering
    rows.sort((a, b) => (b.xp || 0) - (a.xp || 0))
    return { data: rows, error: null }
  } catch (e) {
    return { data: [], error: e }
  }
}
