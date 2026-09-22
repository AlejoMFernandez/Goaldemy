/**
 * Estado UI compartido de la SIDEBAR social (estilo LoL, derecha, ESTÁTICA).
 * App.vue reserva el ancho de la barra en desktop (para que el contenido "corte"
 * en ella y no quede por debajo). La barra ya no se esconde ni se contrae.
 */
import { reactive } from 'vue'

export const sidebarState = reactive({
  hasUser: false,     // hay sesión → mostrar barra + reservar ancho en desktop
  openChatRequest: null, // { peerId, ts } → pedido de abrir un chat puntual (ej: click en toast de DM)
})

export function setSidebarUser(v) { sidebarState.hasUser = !!v }

// Pide a FriendsDock que abra el chat con este peer (ej: al clickear una notificación de DM).
export function requestOpenChat(peerId) {
  sidebarState.openChatRequest = { peerId, ts: Date.now() }
}
