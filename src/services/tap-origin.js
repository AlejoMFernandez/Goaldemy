/**
 * Modales que salen DESDE EL BOTÓN (Moodboard 06).
 *
 * Se recuerda el último elemento tocado (botón, link) y, cuando se monta la
 * tarjeta de un modal con la directiva `v-pop`, la tarjeta crece desde ese punto
 * en 220 ms. Si no hubo un toque reciente, aparece con un zoom suave desde el centro.
 * Con movimiento reducido: solo un fundido corto.
 */
let last = null // { x, y, t }

export function installTapOrigin() {
  if (typeof window === 'undefined' || window.__fulvoTapOrigin) return
  window.__fulvoTapOrigin = true
  window.addEventListener('pointerdown', (e) => {
    const el = e.target?.closest?.('button, a, [role="button"]')
    if (!el) return
    const r = el.getBoundingClientRect()
    last = { x: r.left + r.width / 2, y: r.top + r.height / 2, t: Date.now() }
  }, { capture: true, passive: true })
}

export function popFrom(el, { duration = 220 } = {}) {
  if (!el?.animate) return
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (reduce) { el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, easing: 'ease-out' }); return }
  const r = el.getBoundingClientRect()
  const recent = last && Date.now() - last.t < 1500
  const ox = recent ? last.x - r.left : r.width / 2
  const oy = recent ? last.y - r.top : r.height / 2
  el.style.transformOrigin = `${ox}px ${oy}px`
  el.animate([
    { opacity: 0, transform: `scale(${recent ? 0.3 : 0.92})` },
    { opacity: 1, transform: 'scale(1.015)', offset: 0.75 },
    { opacity: 1, transform: 'scale(1)' },
  ], { duration: recent ? duration + 40 : duration, easing: 'cubic-bezier(.2, .9, .3, 1.15)' })
}

/** Directiva global: <div v-pop> en la tarjeta del modal. */
export const vPop = {
  mounted(el) { popFrom(el) },
}
