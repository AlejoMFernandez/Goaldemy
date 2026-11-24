/**
 * PUENTE NATIVO (Capacitor)
 *
 * - isNative(): true dentro de la app de Android/iOS (no en web ni en la PWA).
 * - platform(): 'android' | 'ios' | 'web'.
 * - initNative(router): llamar una vez desde main.js. En web no hace nada.
 *     · Status bar: overlay sobre el webview, íconos claros (fondo oscuro).
 *       El contenido tiene que respetar env(safe-area-inset-*).
 *     · Oculta el splash nativo cuando la app ya montó.
 *     · Botón "atrás" de Android: router.back() si hay historial; en la raíz
 *       minimiza/cierra la app (comportamiento esperado por Google Play).
 *
 * Los plugins se importan dinámicamente sólo en nativo, así el bundle web no
 * carga código que nunca va a usar. Nunca tira: cualquier error se loguea.
 */
import { Capacitor } from '@capacitor/core'

export function isNative() {
  try { return Capacitor.isNativePlatform() } catch { return false }
}

export function platform() {
  try { return Capacitor.getPlatform() } catch { return 'web' }
}

let _initialized = false

export async function initNative(router) {
  if (_initialized || !isNative()) return
  _initialized = true
  document.documentElement.classList.add('is-native', `is-${platform()}`)

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    await StatusBar.setOverlaysWebView({ overlay: true })
    await StatusBar.setStyle({ style: Style.Dark }) // texto/íconos claros
  } catch (e) { console.warn('[native] status bar', e) }

  try {
    const { App } = await import('@capacitor/app')
    App.addListener('backButton', ({ canGoBack }) => {
      const atRoot = router?.currentRoute?.value?.path === '/'
      if (!atRoot && (canGoBack || window.history.length > 1)) router.back()
      else App.exitApp()
    })
  } catch (e) { console.warn('[native] back button', e) }

  try {
    const { SplashScreen } = await import('@capacitor/splash-screen')
    // Esperar a la primera navegación para no mostrar un flash vacío.
    if (router?.isReady) await router.isReady()
    await SplashScreen.hide({ fadeOutDuration: 200 })
  } catch (e) { console.warn('[native] splash', e) }
}
