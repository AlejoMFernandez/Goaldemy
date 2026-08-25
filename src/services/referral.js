/**
 * SERVICIO DE REFERIDOS (motor viral, parte 2)
 *
 * share.js ya generaba un resultado compartible sin nada a cambio. Este servicio le
 * pone el incentivo: cada usuario tiene un código propio, y quien se registra con el
 * link de otro le da Fichas a los dos (server-side vía RPC claim_referral, ver
 * supabase/referrals.sql).
 *
 * FLUJO:
 * 1. Alguien entra a la app con ?ref=CODIGO (compartido desde el resultado de un juego
 *    o desde su perfil) → captureReferralFromUrl() lo guarda en localStorage.
 * 2. Se registra y confirma su email.
 * 3. Al loguearse por primera vez, claimPendingReferral() llama a la RPC y reparte
 *    las Fichas. Se llama desde App.vue, igual que claimPendingRetoReward().
 */
import { shareBaseUrl } from './share'

const PENDING_KEY = 'goaldemy_ref_pending'

/**
 * Si la URL actual trae ?ref=CODIGO, lo guarda para reclamarlo más adelante y limpia
 * el parámetro de la barra de direcciones. No pisa un código ya guardado (el primer
 * link que trajo al usuario es el que cuenta).
 */
export function captureReferralFromUrl() {
  try {
    const url = new URL(window.location.href)
    const code = url.searchParams.get('ref')
    if (!code) return
    if (!localStorage.getItem(PENDING_KEY)) {
      localStorage.setItem(PENDING_KEY, code.trim().toUpperCase())
    }
    url.searchParams.delete('ref')
    window.history.replaceState({}, '', url.pathname + url.search + url.hash)
  } catch {}
}

/** Link listo para compartir con el código de un usuario. */
export function buildReferralLink(code) {
  if (!code) return shareBaseUrl()
  return `${shareBaseUrl()}/register?ref=${encodeURIComponent(code)}`
}

/**
 * Si hay un código pendiente y el usuario ya está logueado + verificado, lo reclama
 * DE VERDAD vía la RPC claim_referral (otorga Fichas a ambos lados, 1 vez por cuenta).
 * Se llama al arrancar la app (App.vue) tras authReady, igual que el reclamo del Reto.
 */
export async function claimPendingReferral() {
  let code
  try { code = localStorage.getItem(PENDING_KEY) } catch { return null }
  if (!code) return null

  try {
    const { getAuthUser } = await import('./auth')
    const user = getAuthUser()
    if (!user?.id || !user?.email_confirmed_at) return null

    const { supabase } = await import('./supabase')
    const { data, error } = await supabase.rpc('claim_referral', { p_code: code })
    if (error) { console.warn('[referral] claim error:', error.message); return null }

    // Éxito o cualquier error de negocio (ya reclamado, código propio, código inválido):
    // limpiamos igual para no reintentar en loop en cada carga de la app.
    try { localStorage.removeItem(PENDING_KEY) } catch {}
    if (!data?.ok) return null

    try {
      const { pushInfoToast } = await import('../stores/notifications')
      pushInfoToast(`🎁 ¡Bienvenido! Sumaste ${data.fichas_referred} Fichas por venir invitado`)
    } catch {}
    return data
  } catch (e) {
    console.warn('[referral] claim exception:', e?.message || e)
    return null
  }
}

/** Código propio + cantidad de amigos invitados exitosamente. */
export async function getReferralStats() {
  try {
    const { supabase } = await import('./supabase')
    const { data, error } = await supabase.rpc('get_referral_stats')
    if (error) throw error
    return { code: data?.referral_code || null, invitedCount: data?.invited_count || 0 }
  } catch (e) {
    console.warn('[referral] stats error:', e?.message || e)
    return { code: null, invitedCount: 0 }
  }
}
