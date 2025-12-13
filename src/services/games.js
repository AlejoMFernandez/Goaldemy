import { supabase } from './supabase';
import { getAuthUser } from './auth';
import { GAME_TYPES } from './game-celebrations';

// ============================================
// SISTEMA DE DIFICULTAD
// ============================================

export const DIFFICULTY_LEVELS = {
  EASY: 'easy',
  NORMAL: 'normal',
  HARD: 'hard'
};

// Configuración de dificultad para juegos TIMED (con tiempo límite)
export const TIMED_DIFFICULTY_CONFIG = {
  [DIFFICULTY_LEVELS.EASY]: {
    label: 'Fácil',
    icon: '🟢',
    time: 60, // 60 segundos
    targetCorrect: 10,
    xpPerCorrect: 10, // 10 XP por cada respuesta correcta
    xpCompletion: 50, // 50 XP bonus por completar el juego
    description: '60 segundos para completar'
  },
  [DIFFICULTY_LEVELS.NORMAL]: {
    label: 'Normal',
    icon: '🟡',
    time: 45, // 45 segundos
    targetCorrect: 10,
    xpPerCorrect: 20, // 20 XP por cada respuesta correcta
    xpCompletion: 100, // 100 XP bonus por completar el juego
    description: '45 segundos para completar'
  },
  [DIFFICULTY_LEVELS.HARD]: {
    label: 'Difícil',
    icon: '🔴',
    time: 30, // 30 segundos
    targetCorrect: 10,
    xpPerCorrect: 30, // 30 XP por cada respuesta correcta
    xpCompletion: 200, // 200 XP bonus por completar el juego
    description: '30 segundos para completar'
  }
};

// Configuración de dificultad para juegos ORDERING (ordenar elementos)
export const ORDERING_DIFFICULTY_CONFIG = {
  [DIFFICULTY_LEVELS.EASY]: {
    label: 'Fácil',
    icon: '🟢',
    itemCount: 3, // Ordenar solo 3 jugadores
    xpCompletion: 30,
    description: 'Ordenar 3 jugadores'
  },
  [DIFFICULTY_LEVELS.NORMAL]: {
    label: 'Normal',
    icon: '🟡',
    itemCount: 5, // Ordenar 5 jugadores (default)
    xpCompletion: 75,
    description: 'Ordenar 5 jugadores'
  },
  [DIFFICULTY_LEVELS.HARD]: {
    label: 'Difícil',
    icon: '🔴',
    itemCount: 7, // Ordenar 7 jugadores
    xpCompletion: 150,
    description: 'Ordenar 7 jugadores'
  }
};

// Configuración de dificultad para juegos LIVES (con sistema de vidas)
export const LIVES_DIFFICULTY_CONFIG = {
  [DIFFICULTY_LEVELS.EASY]: {
    label: 'Fácil',
    icon: '🟢',
    lives: 5, // 5 vidas
    xpPerCorrect: 10,
    xpCompletion: 75,
    description: '5 vidas disponibles'
  },
  [DIFFICULTY_LEVELS.NORMAL]: {
    label: 'Normal',
    icon: '🟡',
    lives: 3, // 3 vidas (default)
    xpPerCorrect: 15,
    xpCompletion: 125,
    description: '3 vidas disponibles'
  },
  [DIFFICULTY_LEVELS.HARD]: {
    label: 'Difícil',
    icon: '🔴',
    lives: 1, // Solo 1 vida
    xpPerCorrect: 30,
    xpCompletion: 250,
    description: '1 vida (modo extremo)'
  }
};

/**
 * Obtiene la configuración de dificultad según el tipo de juego
 */
export function getDifficultyConfig(gameType, difficulty = DIFFICULTY_LEVELS.NORMAL) {
  if (gameType === GAME_TYPES.TIMED) {
    return TIMED_DIFFICULTY_CONFIG[difficulty] || TIMED_DIFFICULTY_CONFIG[DIFFICULTY_LEVELS.NORMAL];
  } else if (gameType === GAME_TYPES.ORDERING) {
    return ORDERING_DIFFICULTY_CONFIG[difficulty] || ORDERING_DIFFICULTY_CONFIG[DIFFICULTY_LEVELS.NORMAL];
  } else if (gameType === GAME_TYPES.LIVES) {
    return LIVES_DIFFICULTY_CONFIG[difficulty] || LIVES_DIFFICULTY_CONFIG[DIFFICULTY_LEVELS.NORMAL];
  }
  // Fallback: usar configuración TIMED por defecto
  return TIMED_DIFFICULTY_CONFIG[difficulty] || TIMED_DIFFICULTY_CONFIG[DIFFICULTY_LEVELS.NORMAL];
}

const FALLBACK_NAMES = {
  'guess-player': 'Adivina el jugador',
  'who-is': '¿Quién es?',
  // mantener compatibilidad histórica si existieran eventos con este slug
  'quien-es': '¿Quién es?',
  'nationality': 'Nacionalidad correcta',
  'player-position': 'Posición correcta',
  'name-correct': 'Nombre correcto',
  'value-order': 'Valor de mercado',
  'age-order': 'Ordenar por edad',
  'height-order': 'Ordenar por altura',
  'shirt-number': 'Número de camiseta',
}

const FALLBACK_DESC = {
  'guess-player': 'El clásico: adiviná el jugador',
  'who-is': 'Escribe el nombre a partir de la foto borrosa y pistas',
  'quien-es': 'Escribe el nombre a partir de la foto borrosa y pistas',
  'nationality': 'Selecciona la nacionalidad correcta del jugador',
  'player-position': 'Elegí la posición correcta del jugador mostrado',
  'name-correct': 'Elegí el nombre correcto del jugador mostrado',
  'value-order': 'Ordená 5 jugadores de más caro a más barato',
  'age-order': 'Ordená 5 jugadores del más viejo al más joven',
  'height-order': 'Ordená 5 jugadores del más alto al más bajo',
  'shirt-number': 'Elegí el número de camiseta correcto',
}

// Metadata extendida: tipo de juego, mecánica, video preview, tips
const GAME_METADATA = {
  'nationality': {
    type: GAME_TYPES.TIMED,
    mechanic: 'Hacé 10 aciertos antes de que se acabe el tiempo',
    videoUrl: '', // Agregar URL cuando grabes el video
    tips: [
      'Mirá bien las banderas y pensá rápido',
      'Los jugadores top suelen ser más conocidos',
      'Confiá en tu intuición'
    ]
  },
  'player-position': {
    type: GAME_TYPES.TIMED,
    mechanic: 'Hacé 10 aciertos antes de que se acabe el tiempo',
    videoUrl: '',
    tips: [
      'Fijate en la contextura física del jugador',
      'Los delanteros suelen ser más veloces',
      'Los defensores son más robustos'
    ]
  },
  'shirt-number': {
    type: GAME_TYPES.TIMED,
    mechanic: 'Hacé 10 aciertos antes de que se acabe el tiempo',
    videoUrl: '',
    tips: [
      'Recordá los números icónicos (10, 7, 9)',
      'Algunos jugadores son muy conocidos por su número'
    ]
  },
  'value-order': {
    type: GAME_TYPES.ORDERING,
    mechanic: 'Ordená correctamente todos los jugadores para ganar',
    videoUrl: '',
    tips: [
      'Los jugadores más jóvenes y talentosos valen más',
      'Fijate en los equipos: jugadores de top clubes valen más'
    ]
  },
  'age-order': {
    type: GAME_TYPES.ORDERING,
    mechanic: 'Ordená correctamente todos los jugadores para ganar',
    videoUrl: '',
    tips: [
      'Mirá las fotos: las arrugas y canas son pistas',
      'Jugadores legendarios suelen ser mayores'
    ]
  },
  'height-order': {
    type: GAME_TYPES.ORDERING,
    mechanic: 'Ordená correctamente todos los jugadores para ganar',
    videoUrl: '',
    tips: [
      'Los arqueros suelen ser los más altos',
      'Los extremos veloces suelen ser más bajos'
    ]
  },
  'who-is': {
    type: GAME_TYPES.LIVES,
    mechanic: 'Adiviná jugadores sin perder todas las vidas',
    videoUrl: '',
    tips: [
      'La imagen se va desblurreando con cada error',
      'Usá las pistas: posición, nacionalidad, equipo',
      'El buscador te ayuda con sugerencias'
    ]
  },
  'guess-player': {
    type: GAME_TYPES.TIMED,
    mechanic: 'Hacé 10 aciertos antes de que se acabe el tiempo',
    videoUrl: '',
    tips: [
      'Mirá todas las pistas antes de elegir',
      'Eliminá opciones imposibles primero',
      'Confiá en tu intuición y responde rápido'
    ]
  }
}

const KNOWN_GAMES = [
  { slug: 'nationality', name: FALLBACK_NAMES['nationality'], description: FALLBACK_DESC['nationality'], cover_url: '/games/nationality.png' },
  { slug: 'player-position', name: FALLBACK_NAMES['player-position'], description: FALLBACK_DESC['player-position'], cover_url: '/games/player-position.png' },
  { slug: 'guess-player', name: FALLBACK_NAMES['guess-player'], description: FALLBACK_DESC['guess-player'], cover_url: '/games/guess-player.png' },
  { slug: 'who-is', name: FALLBACK_NAMES['who-is'], description: FALLBACK_DESC['who-is'], cover_url: '/games/who-is.png' },
  { slug: 'value-order', name: FALLBACK_NAMES['value-order'], description: FALLBACK_DESC['value-order'], cover_url: '/games/value-order.png' },
  { slug: 'age-order', name: FALLBACK_NAMES['age-order'], description: FALLBACK_DESC['age-order'], cover_url: '/games/age-order.png' },
  { slug: 'height-order', name: FALLBACK_NAMES['height-order'], description: FALLBACK_DESC['height-order'], cover_url: '/games/height-order.png' },
  { slug: 'shirt-number', name: FALLBACK_NAMES['shirt-number'], description: FALLBACK_DESC['shirt-number'], cover_url: '/games/shirt-number.png' },
]

function fallbackCoverForSlug(slug) {
  const k = KNOWN_GAMES.find(g => g.slug === slug)
  return k?.cover_url || null
}

export function friendlyNameForSlug(slug) {
  return FALLBACK_NAMES[slug] || 'Juego'
}

export function friendlyDescForSlug(slug) {
  return FALLBACK_DESC[slug] || 'Próximamente…'
}

export function gameSummaryBlurb(slug) {
  const base = friendlyDescForSlug(slug)
  // Mensaje genérico de lo que se gana; los juegos puntuales ya muestran métricas en el popup
  return `${base}. Ganás XP por acierto y sumás a tu racha diaria.`
}

/**
 * Obtiene metadata extendida del juego (tipo, mecánica, video, tips)
 */
export function getGameMetadata(slug) {
  return GAME_METADATA[slug] || {
    type: null,
    mechanic: '',
    videoUrl: '',
    tips: []
  }
}

// Map slug to in-app route
export function gameRouteForSlug(slug) {
  switch ((slug || '').toString()) {
    case 'guess-player': return '/games/guess-player'
    case 'nationality': return '/games/nationality'
    case 'player-position': return '/games/player-position'
    case 'who-is': return '/games/who-is'
    case 'value-order': return '/games/value-order'
    case 'age-order': return '/games/age-order'
    case 'height-order': return '/games/height-order'
    case 'shirt-number': return '/games/shirt-number'
    default: return '/games'
  }
}

function normalizeGame(row) {
  const slug = row?.slug || ''
  const cover = row?.cover_url ?? row?.image ?? fallbackCoverForSlug(slug) ?? null
  return {
    ...row,
    id: (row && row.id != null) ? row.id : (slug || undefined),
    cover_url: cover,
    image: cover,
    name: row?.name || friendlyNameForSlug(slug),
    description: row?.description || friendlyDescForSlug(slug),
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
  const normalized = (data || []).map(normalizeGame)
  // Ensure baseline known games also appear in client UI (filter, etc.)
  const bySlug = new Map(normalized.map(g => [g.slug, g]))
  for (const kg of KNOWN_GAMES) {
    if (!bySlug.has(kg.slug)) {
      bySlug.set(kg.slug, normalizeGame({ id: kg.slug, slug: kg.slug, name: kg.name, description: kg.description, cover_url: kg.cover_url ?? null }))
    }
  }
  return Array.from(bySlug.values())
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

// Fetch a single game by slug (to resolve UUIDs for modes/sessions)
export async function fetchGameBySlug(slug) {
  if (!slug) return null
  let { data, error } = await supabase
    .from('games')
    .select('id, slug, name, description, cover_url, created_at')
    .eq('slug', slug)
    .maybeSingle()

  if (error && (error.code === '42703' || /column .* does not exist/i.test(error.message || ''))) {
    const res = await supabase
      .from('games')
      .select('id, slug, name, description, image, created_at')
      .eq('slug', slug)
      .maybeSingle()
    data = res.data; error = res.error
  }
  if (error) return null
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
      .select('game_id, amount, reason')
      .eq('user_id', authId)
    if (evErr) return { data: [], error: evErr }

    const sums = new Map()
    for (const e of (events || [])) {
      if (!e) continue
      // Excluir XP de logros del gráfico por juego
      if ((e.reason || '') === 'achievement') continue
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
        const g = map[gid]
        const name = g?.name || friendlyNameForSlug(gid)
        rows.push({ id: gid, name, cover_url: g?.cover_url || null, xp })
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
