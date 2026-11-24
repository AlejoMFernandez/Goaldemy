/**
 * HÁPTICA (vibración) — un solo API para nativo y web.
 *
 *   import { tap, success, error, heavy } from '@/services/haptics'
 *   tap()      // toque liviano (botones, selección)
 *   success()  // acierto / premio
 *   error()    // error / respuesta incorrecta
 *   heavy()    // impacto fuerte (gol, level up)
 *
 * En la app nativa usa @capacitor/haptics (Taptic Engine en iOS). En web cae a
 * navigator.vibrate cuando existe (Android Chrome; iOS Safari no lo soporta y
 * simplemente no vibra). Respeta prefers-reduced-motion. Nunca tira.
 */
import { isNative } from './native'

let _plugin = null
function plugin() {
  if (!_plugin) _plugin = import('@capacitor/haptics').catch(() => null)
  return _plugin
}

function reducedMotion() {
  try { return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches } catch { return false }
}

function vibrate(pattern) {
  try { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(pattern) } catch { /* noop */ }
}

async function run(nativeFn, webPattern) {
  try {
    if (reducedMotion()) return
    if (isNative()) {
      const m = await plugin()
      if (m) { await nativeFn(m); return }
    }
    vibrate(webPattern)
  } catch { /* la háptica nunca puede romper el juego */ }
}

export const tap = () => run(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Light }), 10)
export const success = () => run(({ Haptics, NotificationType }) => Haptics.notification({ type: NotificationType.Success }), [12, 40, 18])
export const error = () => run(({ Haptics, NotificationType }) => Haptics.notification({ type: NotificationType.Error }), [30, 50, 30])
export const heavy = () => run(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Heavy }), 35)

export default { tap, success, error, heavy }
