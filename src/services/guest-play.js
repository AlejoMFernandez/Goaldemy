/**
 * MODO INVITADO EN JUEGOS REALES
 *
 * El invitado juega un desafío real sin cuenta, ve en el popup de resultado
 * la XP/Fichas que "ganó", y esa recompensa queda pendiente en localStorage
 * hasta que se registra. Si juega varios juegos sin registrarse, se acumulan
 * TODOS (un mapa por juego — rejugar el mismo juego antes de registrarse
 * actualiza esa entrada, no la duplica ni la suma). Al loguearse por primera
 * vez con email confirmado, claimPendingGuestReward() los reclama DE VERDAD
 * vía RPC (otorga XP + Fichas server-side, 1 vez por usuario+juego+día). Se
 * llama desde App.vue igual que los otros reclamos pendientes.
 */
const PENDING_KEY = 'goaldemy_guest_play_pending'

function todayKey() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function readMap() {
  try { return JSON.parse(localStorage.getItem(PENDING_KEY) || '{}') } catch { return {} }
}
function writeMap(map) {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(map)) } catch {}
}

/** Guarda (o actualiza) el resultado pendiente de un invitado para UN juego. */
export function setPendingGuestClaim({ game, corrects, total, maxStreak = 0 }) {
  if (!game) return
  const map = readMap()
  map[game] = { corrects, total, maxStreak, dayKey: todayKey(), at: Date.now() }
  writeMap(map)
}

/**
 * Recompensas "que ganó" el invitado con un resultado. Misma fórmula que usa
 * el RPC claim_guest_game_reward server-side (ver supabase/guest-game-claim.sql)
 * para que el preview que ve el invitado coincida con lo que realmente reclama.
 */
export function computeGuestRewards(corrects = 0, total = 0) {
  const t = Math.min(Math.max(total || 0, 1), 20)
  const c = Math.min(Math.max(corrects || 0, 0), t)
  const perfect = c >= t
  const xp = Math.min(c * 10 + (perfect ? 50 : 0), 150)
  const fichas = Math.min(c * 4 + (perfect ? 20 : 0), 60)
  const xpForLevel2 = 100
  const pct = Math.min(100, Math.round((xp / xpForLevel2) * 100))
  const levelUp = xp >= xpForLevel2
  const remaining = Math.max(0, xpForLevel2 - xp)
  return { xp, fichas, perfect, xpForLevel2, pct, levelUp, remaining }
}

/**
 * Resumen de TODO lo pendiente: cuántos juegos, y el total acumulado sumando
 * la recompensa-preview de cada uno. Para mostrar "ya llevás N juegos".
 */
export function getPendingGuestSummary() {
  const map = readMap()
  const games = Object.keys(map)
  let xp = 0, fichas = 0
  for (const slug of games) {
    const r = computeGuestRewards(map[slug].corrects, map[slug].total)
    xp += r.xp
    fichas += r.fichas
  }
  return { count: games.length, games, xp, fichas }
}

function getPendingGuestClaim(game) {
  const map = readMap()
  return game ? (map[game] || null) : map
}

function clearPendingGuestClaim(game) {
  if (!game) { writeMap({}); return }
  const map = readMap()
  delete map[game]
  writeMap(map)
}

/**
 * Si hay reclamos pendientes y el usuario ya está logueado + verificado, los
 * reclama DE VERDAD vía la RPC claim_guest_game_reward (una llamada por
 * juego pendiente, otorga XP + Fichas server-side). Se llama al arrancar la
 * app (App.vue) tras authReady.
 */
export async function claimPendingGuestReward() {
  const map = getPendingGuestClaim()
  const games = Object.keys(map)
  if (!games.length) return null
  try {
    const { getAuthUser } = await import('./auth')
    const user = getAuthUser()
    if (!user?.id || !user?.email_confirmed_at) return null

    const { supabase } = await import('./supabase')
    let totalXp = 0, totalFichas = 0
    for (const slug of games) {
      const pending = map[slug]
      const { data, error } = await supabase.rpc('claim_guest_game_reward', {
        p_game_slug: slug,
        p_corrects: pending.corrects,
        p_total: pending.total,
        p_max_streak: pending.maxStreak,
        p_day_key: pending.dayKey,
      })
      if (error) {
        // Error de transporte/servidor: dejamos el pendiente para reintentar en la próxima carga.
        console.warn('[guest-play] claim error:', slug, error.message)
        continue
      }
      // La RPC respondió (éxito o rechazo de negocio, ej. "ya reclamado"): ya no hay nada que reintentar.
      clearPendingGuestClaim(slug)
      if (data?.ok) { totalXp += data.xp || 0; totalFichas += data.fichas || 0 }
    }

    if (totalXp || totalFichas) {
      try {
        const { pushInfoToast } = await import('../stores/notifications')
        pushInfoToast(`🎁 ¡Reclamaste +${totalXp} XP y ${totalFichas} Fichas de tus partidas como invitado!`)
      } catch {}
      try {
        const { detectAndToastLevelUp } = await import('./xp')
        await detectAndToastLevelUp()
      } catch {}
    }
    return (totalXp || totalFichas) ? { xp: totalXp, fichas: totalFichas } : null
  } catch (e) {
    console.warn('[guest-play] claim exception:', e?.message || e)
    return null
  }
}
