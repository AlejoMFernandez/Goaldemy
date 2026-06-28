/**
 * PRESENCIA EN VIVO (estilo LoL)
 *
 * Canal global de Supabase Realtime Presence. Cada cliente "trackea" su estado
 * { user_id, game } y recibe el estado de todos los conectados. La barra de
 * amigos (FriendsDock) filtra a tus amigos y deriva:
 *   - playing  → está conectado y `game` tiene un slug (está jugando ese juego)
 *   - online   → está conectado, sin juego
 *   - offline  → no aparece en el canal
 *
 * No necesita esquema en la DB: la presencia es efímera (vive mientras el socket
 * está abierto). Al cerrar la pestaña, Supabase la da de baja sola.
 */
import { ref } from 'vue'
import { supabase } from './supabase'
import { getAuthUser, subscribeToAuthStateChanges } from './auth'

// Map reactivo { [userId]: { game } } de todos los usuarios conectados.
export const presenceState = ref({})

let channel = null
let currentGame = null
let installed = false

function rebuild() {
  if (!channel) { presenceState.value = {}; return }
  let raw = {}
  try { raw = channel.presenceState() } catch { raw = {} }
  const map = {}
  for (const key in raw) {
    const metas = raw[key] || []
    const meta = metas[metas.length - 1] || {}
    const uid = meta.user_id || key
    map[uid] = { game: meta.game || null }
  }
  presenceState.value = map
}

async function join() {
  const uid = getAuthUser()?.id
  if (!uid || channel) return
  channel = supabase.channel('presence:lobby', { config: { presence: { key: uid } } })
  channel
    .on('presence', { event: 'sync' }, rebuild)
    .on('presence', { event: 'join' }, rebuild)
    .on('presence', { event: 'leave' }, rebuild)
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        try { await channel.track({ user_id: uid, game: currentGame }) } catch {}
        rebuild()
      }
    })
}

async function leave() {
  if (!channel) return
  const ch = channel
  channel = null
  try { await ch.untrack() } catch {}
  try { await supabase.removeChannel(ch) } catch {}
  presenceState.value = {}
}

/** Cambia el juego actual (slug o null) y re-trackea. Llamar al cambiar de ruta. */
export async function setPresenceGame(slug) {
  const g = slug || null
  if (g === currentGame) return
  currentGame = g
  if (channel) {
    try { await channel.track({ user_id: getAuthUser()?.id, game: currentGame }) } catch {}
  }
}

/** Instala el manejo automático login/logout. Llamar una sola vez (App.vue). */
export function installPresence() {
  if (installed) return
  installed = true
  subscribeToAuthStateChanges((u) => {
    if (u?.id) join()
    else leave()
  })
}
