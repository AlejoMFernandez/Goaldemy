/**
 * BIENVENIDA (onboarding) — se muestra UNA sola vez por dispositivo.
 * El router manda a /bienvenida en la primera visita de un invitado a "/"
 * (ver router.js). Al entrar a la pantalla se marca como vista.
 */
const KEY = 'fulvo:bienvenida_vista'

export function welcomeSeen() {
  try { return localStorage.getItem(KEY) === '1' } catch { return true }
}

export function markWelcomeSeen() {
  try { localStorage.setItem(KEY, '1') } catch {}
}

/**
 * ¿Mandar a la bienvenida? Solo en la PRIMERA navegación de la sesión (no al
 * volver al inicio), a "/", sin cuenta, y nunca a bots/automatización (SEO y
 * tests siguen viendo la landing).
 */
export function shouldShowWelcome(to, from, userId) {
  if (userId || to.path !== '/' || from?.matched?.length) return false
  if (Object.keys(to.query || {}).length) return false
  try {
    if (navigator.webdriver) return false
    if (/bot|crawl|spider|slurp|lighthouse|headless/i.test(navigator.userAgent || '')) return false
  } catch { return false }
  return !welcomeSeen()
}
