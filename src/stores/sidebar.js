/**
 * Estado UI compartido de la SIDEBAR social (estilo LoL, derecha, ESTÁTICA).
 * App.vue reserva el ancho de la barra en desktop (para que el contenido "corte"
 * en ella y no quede por debajo). La barra ya no se esconde ni se contrae.
 */
import { reactive } from 'vue'

export const sidebarState = reactive({
  hasUser: false,     // hay sesión → mostrar barra + reservar ancho en desktop
})

export function setSidebarUser(v) { sidebarState.hasUser = !!v }
