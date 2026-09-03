/**
 * MODO INVITADO EN JUEGOS REALES (piloto: Adivina el jugador)
 *
 * Mismo patrón que daily-reto.js y referral.js: el invitado juega el desafío real
 * sin cuenta, ve en el popup de resultado la XP/racha que "ganó", y esa recompensa
 * queda pendiente en localStorage hasta que se registra. Al loguearse por primera
 * vez con email confirmado, claimPendingGuestReward() la reclama DE VERDAD vía RPC
 * (otorga XP + Fichas server-side, 1 vez por usuario+juego+día). Se llama desde
 * App.vue igual que los otros tres reclamos pendientes.
 */
const PENDING_KEY = 'goaldemy_guest_play_pending'

function todayKey() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Guarda el resultado pendiente de un invitado al terminar un juego real. */
export function setPendingGuestClaim({ game, corrects, total, maxStreak = 0 }) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify({
      game, corrects, total, maxStreak, dayKey: todayKey(), at: Date.now(),
    }))
  } catch {}
}

export function getPendingGuestClaim() {
  try { return JSON.parse(localStorage.getItem(PENDING_KEY) || 'null') } catch { return null }
}

export function clearPendingGuestClaim() {
  try { localStorage.removeItem(PENDING_KEY) } catch {}
}

/**
 * Si hay un reclamo pendiente y el usuario ya está logueado + verificado, lo reclama
 * DE VERDAD vía la RPC claim_guest_game_reward (otorga XP + Fichas server-side).
 * Se llama al arrancar la app (App.vue) tras authReady.
 */
export async function claimPendingGuestReward() {
  const pending = getPendingGuestClaim()
  if (!pending) return null
  try {
    const { getAuthUser } = await import('./auth')
    const user = getAuthUser()
    if (!user?.id || !user?.email_confirmed_at) return null

    const { supabase } = await import('./supabase')
    const { data, error } = await supabase.rpc('claim_guest_game_reward', {
      p_game_slug: pending.game,
      p_corrects: pending.corrects,
      p_total: pending.total,
      p_max_streak: pending.maxStreak,
      p_day_key: pending.dayKey,
    })
    if (error) { console.warn('[guest-play] claim error:', error.message); return null }

    // Éxito o error de negocio (ya reclamado, etc.): limpiamos igual para no reintentar en loop
    clearPendingGuestClaim()
    if (!data?.ok) return null

    if (data.xp || data.fichas) {
      try {
        const { pushInfoToast } = await import('../stores/notifications')
        pushInfoToast(`🎁 ¡Reclamaste +${data.xp} XP y ${data.fichas} Fichas de tu partida como invitado!`)
      } catch {}
      try {
        const { detectAndToastLevelUp } = await import('./xp')
        await detectAndToastLevelUp()
      } catch {}
    }
    return { xp: data.xp, fichas: data.fichas }
  } catch (e) {
    console.warn('[guest-play] claim exception:', e?.message || e)
    return null
  }
}
