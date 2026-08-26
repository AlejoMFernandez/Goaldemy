/**
 * DUELO ASÍNCRONO (Reto del día vs. amigos)
 *
 * El Reto del día ya es EL MISMO desafío para todos (semilla por fecha, ver
 * daily-reto.js). Este servicio agrega la capa social: ver cómo les fue hoy
 * a tus amigos que ya jugaron, y mandarles un empujón si todavía no.
 */
import { supabase } from './supabase'
import { todayKey } from './daily-reto'
import { pushErrorToast, pushSuccessToast } from '../stores/notifications'

/**
 * Tablero de hoy: por cada amigo (conexión aceptada), su resultado del Reto
 * de hoy si ya jugó, o null si no. Ordenado: los que ya jugaron primero, por
 * mejor puntaje.
 * @returns {Promise<Array<{friendId,displayName,avatarUrl,corrects,total,played}>>}
 */
export async function getRetoDuelBoard() {
  const { data, error } = await supabase.rpc('get_reto_duel_board', { p_day_key: todayKey() })
  if (error) { console.warn('[duels] board error:', error.message); return [] }
  return (data || []).map(r => ({
    friendId: r.friend_id,
    displayName: r.display_name,
    avatarUrl: r.avatar_url,
    corrects: r.corrects,
    total: r.total,
    played: !!r.played,
  }))
}

/** Manda una notificación "te desafío al Reto de hoy" a un amigo. */
export async function sendDuelChallenge(friendId) {
  const { data, error } = await supabase.rpc('send_duel_challenge', { p_opponent_id: friendId, p_day_key: todayKey() })
  if (error) { pushErrorToast('No se pudo enviar el desafío'); return { ok: false } }
  if (!data?.ok) {
    if (data?.error === 'already_sent') pushErrorToast('Ya lo desafiaste hoy')
    else pushErrorToast('No se pudo enviar el desafío')
    return data
  }
  pushSuccessToast('¡Desafío enviado! ⚔️')
  return data
}
