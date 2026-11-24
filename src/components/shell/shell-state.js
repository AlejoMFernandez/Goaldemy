/**
 * ESTADO COMPARTIDO DEL SHELL MOBILE (top bar + tab bar + hoja de ajustes).
 *
 * Una sola fuente para lo que muestran a la vez varias piezas del shell, así no
 * se duplica lógica ni se abren dos canales realtime iguales:
 *  - AppNavBar ya mantiene el contador de notificaciones (con realtime + polling)
 *    y el usuario/cosméticos equipados → los ESPEJA acá y la TopBar solo los lee.
 *  - La billetera/racha/nivel se cargan una vez acá (loadShellStats) y se
 *    refrescan al navegar (con throttle), no en cada componente.
 *  - Pedidos entre componentes hermanos (abrir "Reportar un problema" o el popup
 *    de desafíos, que viven en FriendsDock) se hacen con contadores: el que
 *    escucha hace watch y reacciona a cada incremento.
 */
import { reactive } from 'vue'
import { getAuthUser } from '../../services/auth'
import { supabase } from '../../services/supabase'
import { getWallet } from '../../services/shop'
import { getUserLevel, computeProgressPercentSync, fetchLevelThresholds } from '../../services/xp'

export const shellState = reactive({
  // Espejo de AppNavBar
  user: { id: null, email: null, avatar_url: null, display_name: null },
  equipped: { frameKey: 'none', iconGlyph: '', iconBg: 'emerald', framePremium: false },
  notifCount: 0,
  isAdmin: false,
  // Stats propias del shell
  stats: { loaded: false, loading: false, error: false, level: 1, levelPct: 0, xpTotal: 0, streak: 0, fichas: 0, balones: 0 },
  // UI
  settingsOpen: false,
  bugRequest: 0,
  challengesRequest: 0,
  // Chat abierto dentro de /social (FriendsDock embebido): el dock global no
  // debe tirar un toast de DM de ese mismo chat.
  embeddedChatPeer: null,
})

let lastStatsAt = 0
let inflight = null

/** Nivel + % XP + racha diaria + billetera. Throttle de 15 s salvo force. */
export function loadShellStats(force = false) {
  const { id } = getAuthUser() || {}
  if (!id) {
    Object.assign(shellState.stats, { loaded: false, loading: false, error: false, level: 1, levelPct: 0, streak: 0, fichas: 0, balones: 0 })
    return Promise.resolve()
  }
  if (inflight) return inflight
  if (!force && Date.now() - lastStatsAt < 15000) return Promise.resolve()
  shellState.stats.loading = true
  inflight = (async () => {
    try {
      await fetchLevelThresholds()
      const [lvl, wallet, prof] = await Promise.all([
        getUserLevel(null),
        getWallet(),
        supabase.from('user_profiles').select('daily_streak').eq('id', id).single(),
      ])
      const info = Array.isArray(lvl?.data) ? lvl.data[0] : lvl?.data
      Object.assign(shellState.stats, {
        level: Number(info?.level) || 1,
        levelPct: computeProgressPercentSync(info) || 0,
        xpTotal: Number(info?.xp_total ?? info?.total_xp ?? info?.xp ?? 0) || 0,
        streak: prof?.data?.daily_streak || 0,
        fichas: Number(wallet?.fichas) || 0,
        balones: Number(wallet?.balones) || 0,
        loaded: true,
        error: false,
      })
      lastStatsAt = Date.now()
    } catch (e) {
      console.warn('[shell] stats:', e?.message)
      shellState.stats.error = true
    } finally {
      shellState.stats.loading = false
      inflight = null
    }
  })()
  return inflight
}

export function openSettings() { shellState.settingsOpen = true }
export function closeSettings() { shellState.settingsOpen = false }
export function requestBugReport() { shellState.bugRequest++ }
export function requestChallenges() { shellState.challengesRequest++ }

/** Vibración corta al tocar (Android; iOS Safari la ignora). */
export function tapHaptic(ms = 8) {
  try { navigator.vibrate?.(ms) } catch {}
}
