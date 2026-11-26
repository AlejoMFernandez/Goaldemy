/**
 * SOCIAL (v4) — datos para el hub Social, el ranking y el chat.
 *
 * No agrega lógica de negocio nueva: junta lo que ya existe (connections,
 * user-profiles, cosmetics, xp, presence, referral) en la forma que necesitan
 * las pantallas v4. Todo es de SOLO LECTURA salvo lo que ya hacían los
 * services originales (aceptar/rechazar pedido, mandar mensaje).
 */
import { supabase } from './supabase'
import { listConnections, listIncomingRequests } from './connections'
import { getPublicProfilesByIds } from './user-profiles'
import { getEquippedCosmeticsBatch } from './cosmetics'
import { getLeaderboard, getUserLevel, fetchLevelThresholds } from './xp'
import { getTierForLevel } from './tiers'

/**
 * Premio real del referido (supabase/referrals.sql → claim_referral):
 * 150 Fichas para quien invita y 80 de bienvenida para quien se suma, cuando
 * el invitado confirma su email. Si cambia el SQL, cambiar acá.
 */
export const REFERRAL_FICHAS = { referrer: 150, referred: 80 }

/** Nombre público: nunca mostramos el email completo de otro usuario. */
export function publicName(p) {
  const n = (p?.display_name || '').trim()
  if (n && !n.includes('@')) return n
  const raw = n || p?.username || p?.email || ''
  if (raw.includes('@')) return raw.split('@')[0]
  return raw || 'Jugador'
}

export function initialOf(name) {
  return ((name || '?').trim()[0] || '?').toUpperCase()
}

/** Cuánto falta para que termine el período del ranking (el server usa date_trunc en UTC). */
export function periodEndsAt(period, now = new Date()) {
  if (period === 'weekly') {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const dow = (d.getUTCDay() + 6) % 7 // lunes = 0
    d.setUTCDate(d.getUTCDate() - dow + 7)
    return d
  }
  if (period === 'monthly') return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
  return null
}

/** "2d 6h" / "5h 12m" / "12m". */
export function shortCountdown(target, now = Date.now()) {
  if (!target) return ''
  const ms = Math.max(0, new Date(target).getTime() - now)
  const d = Math.floor(ms / 86400000)
  const h = Math.floor((ms % 86400000) / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

async function levelsFor(ids) {
  const out = {}
  await Promise.all(ids.slice(0, 60).map(async (id) => {
    try {
      const { data } = await getUserLevel(id)
      const info = Array.isArray(data) ? data[0] : data
      if (info?.level != null) out[id] = Number(info.level)
    } catch { /* sin nivel → se muestra sin chip */ }
  }))
  return out
}

/**
 * Mis amigos con perfil público, cosméticos equipados y nivel.
 * Devuelve [{ id, name, avatar_url, level, tier, cos }].
 */
export async function loadFriends(meId) {
  if (!meId) return []
  const { data: conns, error } = await listConnections(meId)
  if (error) throw error
  const ids = (conns || []).map(r => (r.user_a === meId ? r.user_b : r.user_a)).filter(Boolean)
  if (!ids.length) return []
  await fetchLevelThresholds().catch(() => null)
  const [{ data: profiles }, cos, levels] = await Promise.all([
    getPublicProfilesByIds(ids),
    getEquippedCosmeticsBatch(ids).catch(() => ({})),
    levelsFor(ids),
  ])
  return (profiles || []).map(p => {
    const level = levels[p.id] ?? null
    return {
      id: p.id,
      name: publicName(p),
      avatar_url: p.avatar_url || '',
      level,
      tier: level != null ? getTierForLevel(level) : null,
      cos: cos?.[p.id] || {},
    }
  })
}

/** Pedidos de amistad entrantes, con perfil del que los mandó. */
export async function loadIncomingRequests() {
  const { data } = await listIncomingRequests()
  const reqs = data || []
  if (!reqs.length) return []
  const ids = reqs.map(r => r.user_a)
  const [{ data: profiles }, cos] = await Promise.all([
    getPublicProfilesByIds(ids),
    getEquippedCosmeticsBatch(ids).catch(() => ({})),
  ])
  const map = Object.fromEntries((profiles || []).map(p => [p.id, p]))
  return reqs.map(r => {
    const p = map[r.user_a] || { id: r.user_a }
    return { connectionId: r.id, id: r.user_a, name: publicName(p), avatar_url: p.avatar_url || '', cos: cos?.[r.user_a] || {}, created_at: r.created_at }
  })
}

function mapLeaderRow(r, idx, offset = 0) {
  const level = r.user_level ?? r.level ?? null
  return {
    rank: r.rank ?? (offset + idx + 1),
    user_id: r.user_id,
    display_name: publicName(r),
    avatar_url: r.avatar_url || null,
    level,
    tier: level != null ? getTierForLevel(level) : null,
    total_xp: Number(r.xp_total ?? 0) || 0,
  }
}

/** Ranking global paginado (get_leaderboard) en la forma de la lista v4. */
export async function loadLeaderboardPage({ period = 'all_time', gameId = null, limit = 25, offset = 0 } = {}) {
  const { data, error } = await getLeaderboard({ period, gameId, limit, offset })
  if (error) throw error
  const base = Array.isArray(data) ? data : (data ? [data] : [])
  return base.map((r, i) => mapLeaderRow(r, i, offset))
}

/**
 * Ranking entre amigos (yo + mis amigos). Usa la RPC get_friends_leaderboard
 * si existe (supabase/pendientes/2026-11-26-ranking-amigos.sql); si todavía no
 * está aplicada, filtra el top 500 de get_leaderboard (los que estén más abajo
 * no aparecen: es la limitación del fallback).
 * La RPC se usa solo con VITE_FRIENDS_LEADERBOARD=1, para no tirar un 404 en
 * consola mientras el SQL no esté aplicado.
 */
const FRIENDS_RPC = import.meta.env.VITE_FRIENDS_LEADERBOARD === '1'
export async function loadFriendsLeaderboard({ period = 'weekly', gameId = null, meId, friendIds = [] } = {}) {
  if (FRIENDS_RPC) {
    const { data, error } = await supabase.rpc('get_friends_leaderboard', { p_period: period, p_game_id: gameId })
    if (!error && Array.isArray(data)) return data.map((r, i) => ({ ...mapLeaderRow(r, i), rank: i + 1 }))
  }
  const ids = new Set([meId, ...friendIds].filter(Boolean))
  const top = await loadLeaderboardPage({ period, gameId, limit: 500, offset: 0 })
  return top.filter(r => ids.has(r.user_id)).map((r, i) => ({ ...r, rank: i + 1 }))
}

/** Cosméticos para pintar filas de ranking (ícono + borde). */
export async function withCosmetics(rows) {
  try {
    const cos = await getEquippedCosmeticsBatch(rows.map(r => r.user_id))
    return rows.map(r => ({ ...r, cos: cos?.[r.user_id] || {} }))
  } catch { return rows.map(r => ({ ...r, cos: {} })) }
}

