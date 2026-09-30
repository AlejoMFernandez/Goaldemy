/**
 * EFECTOS DE PARTIDA (Moodboard 05 · "Jugar un juego")
 *
 * Utilidades imperativas para que el feedback "viaje" por la pantalla:
 * la pelota del acierto vuela a la fila de 10, el XP vuela al marcador,
 * el +15 s vuela al reloj, etc. Todo se dibuja en una capa fija sobre el
 * body (.gfx-layer) con coordenadas de getBoundingClientRect, así funciona
 * aunque el juego esté dentro de contenedores con overflow.
 *
 * Respeta prefers-reduced-motion: los vuelos resuelven al instante y no hay
 * partículas ni temblores.
 */

export const reducedMotion = typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

let layer = null
function getLayer() {
  if (!layer || !document.body.contains(layer)) {
    layer = document.createElement('div')
    layer.className = 'gfx-layer'
    layer.setAttribute('aria-hidden', 'true')
    document.body.appendChild(layer)
  }
  return layer
}

/**
 * Las escenas de recompensa (z 60) necesitan las chispas POR ENCIMA; durante la
 * partida la capa queda debajo del pitazo (z 57). Las escenas la suben y la bajan.
 */
let onTopCount = 0
export function fxOnTop(on) {
  onTopCount = Math.max(0, onTopCount + (on ? 1 : -1))
  getLayer().style.zIndex = onTopCount > 0 ? '75' : ''
}

export function center(el) {
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }
}

export const BALL_SVG = '<svg width="22" height="22" viewBox="-50 -50 100 100" aria-hidden="true"><defs><clipPath id="fulvo-ball-clip"><circle r="47"/></clipPath><radialGradient id="fulvo-ball-sh" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#fff"/><stop offset=".7" stop-color="#e2e8f0"/><stop offset="1" stop-color="#94a3b8"/></radialGradient></defs><circle r="47" fill="url(#fulvo-ball-sh)"/><g clip-path="url(#fulvo-ball-clip)"><g fill="#111827"><polygon points="0.0,-16.0 15.2,-4.9 9.4,12.9 -9.4,12.9 -15.2,-4.9"/><polygon points="0.0,-29.0 -16.2,-40.7 -10.0,-59.8 10.0,-59.8 16.2,-40.7"/><polygon points="27.6,-9.0 33.8,-28.0 53.7,-28.0 59.9,-9.0 43.7,2.8"/><polygon points="17.0,23.5 37.0,23.5 43.2,42.5 27.0,54.2 10.9,42.5"/><polygon points="-17.0,23.5 -10.9,42.5 -27.0,54.2 -43.2,42.5 -37.0,23.5"/><polygon points="-27.6,-9.0 -43.7,2.8 -59.9,-9.0 -53.7,-28.0 -33.8,-28.0"/></g><path d="M0.0 -16.0L0.0 -29.0M15.2 -4.9L27.6 -9.0M9.4 12.9L17.0 23.5M-9.4 12.9L-17.0 23.5M-15.2 -4.9L-27.6 -9.0M-16.2 -40.7L23.5 -32.4M16.2 -40.7L-23.5 -32.4M33.8 -28.0L38.0 12.4M43.7 2.8L23.5 -32.4M37.0 23.5L0.0 40.0M10.9 42.5L38.0 12.4M-10.9 42.5L-38.0 12.4M-37.0 23.5L0.0 40.0M-43.7 2.8L-23.5 -32.4M-33.8 -28.0L-38.0 12.4" stroke="#111827" stroke-width="2.6" fill="none" stroke-linecap="round"/></g><circle r="47" fill="none" stroke="#111827" stroke-width="2.5"/></svg>'

/**
 * Hace volar un elemento en arco desde `from` hasta `to` (elementos o {x,y}).
 * Devuelve una promesa que resuelve al llegar.
 */
export function flyTo({ from, to, html, className = '', duration = 500, arc = 60 }) {
  return new Promise((resolve) => {
    if (!from || !to) return resolve()
    const a = from.nodeType ? center(from) : from
    const b = to.nodeType ? center(to) : to
    if (reducedMotion) return resolve()
    const el = document.createElement('div')
    el.className = 'gfx-float ' + className
    el.innerHTML = html
    getLayer().appendChild(el)
    const w = el.offsetWidth / 2
    const h = el.offsetHeight / 2
    const cx = (a.x + b.x) / 2
    const cy = Math.min(a.y, b.y) - arc
    const frames = []
    for (let i = 0; i <= 14; i++) {
      const t = i / 14
      const x = (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * cx + t * t * b.x
      const y = (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * cy + t * t * b.y
      frames.push({ transform: `translate(${x - w}px, ${y - h}px) scale(${i < 2 ? 1.2 : 1 - t * 0.3})` })
    }
    const anim = el.animate(frames, { duration, easing: 'cubic-bezier(.45,0,.25,1)', fill: 'forwards' })
    anim.onfinish = () => { el.remove(); resolve() }
    anim.oncancel = () => { el.remove(); resolve() }
  })
}

/** Chispas que salen de un punto. */
export function sparks(x, y, n = 10, colors = ['#fcd34d', '#fff'], spread = 60) {
  if (reducedMotion) return
  const host = getLayer()
  for (let i = 0; i < n; i++) {
    const s = document.createElement('div')
    s.className = 'gfx-spark'
    const c = colors[i % colors.length]
    s.style.background = c
    s.style.boxShadow = `0 0 6px ${c}`
    host.appendChild(s)
    const ang = Math.random() * Math.PI * 2
    const d = spread * (0.4 + Math.random() * 0.8)
    s.animate([
      { transform: `translate(${x}px, ${y}px)`, opacity: 1 },
      { transform: `translate(${x + Math.cos(ang) * d}px, ${y + Math.sin(ang) * d}px) scale(.2)`, opacity: 0 },
    ], { duration: 500 + Math.random() * 400, easing: 'cubic-bezier(.16,1,.3,1)' }).onfinish = () => s.remove()
  }
}

/** Cartel chico que salta arriba de un elemento ("¡En racha! ×3", "¡Salvado!"). */
export function burstText(el, text, color = '#fcd34d') {
  if (!el) return
  const c = center(el)
  const b = document.createElement('div')
  b.className = 'gfx-burst'
  b.textContent = text
  b.style.color = color
  b.style.left = c.x + 'px'
  b.style.top = (c.y - c.h * 0.42) + 'px'
  getLayer().appendChild(b)
  const anim = reducedMotion
    ? b.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 900 })
    : b.animate([
      { opacity: 0, transform: 'translate(-50%,-50%) scale(.4) rotate(-6deg)' },
      { opacity: 1, transform: 'translate(-50%,-50%) scale(1.1) rotate(-4deg)', offset: 0.3 },
      { opacity: 1, transform: 'translate(-50%,-60%) scale(1) rotate(-4deg)', offset: 0.75 },
      { opacity: 0, transform: 'translate(-50%,-80%) scale(.9) rotate(-4deg)' },
    ], { duration: 1100, easing: 'ease-out' })
  anim.onfinish = () => b.remove()
}

/** Borde rojo de la pantalla un instante (respuesta incorrecta). */
export function flashEdge() {
  const e = document.createElement('div')
  e.className = 'gfx-edge'
  getLayer().appendChild(e)
  e.animate([{ opacity: 1 }, { opacity: 0 }], { duration: reducedMotion ? 200 : 450, easing: 'ease-out' }).onfinish = () => e.remove()
}

/** Tajo del 50/50 sobre una opción; resuelve cuando la opción terminó de caer. */
export function slashOut(el, delay = 0) {
  return new Promise((resolve) => {
    if (!el) return resolve()
    setTimeout(() => {
      if (reducedMotion) return resolve()
      const s = document.createElement('span')
      s.className = 'gfx-slash'
      el.appendChild(s)
      setTimeout(() => {
        el.classList.add('gfx-cut')
        setTimeout(() => { s.remove(); resolve() }, 460)
      }, 240)
    }, delay)
  })
}

/** Burbuja del escudo que se rompe. */
export function shatter(el) {
  if (!el) return
  const c = center(el)
  sparks(c.x, c.y, 30, ['#bae6fd', '#38bdf8', '#fff'], Math.max(80, c.w * 0.7))
}

/** Humo cuando se apaga la racha. */
export function smoke(el) {
  if (!el || reducedMotion) return
  const c = center(el)
  const host = getLayer()
  for (let i = 0; i < 10; i++) {
    const s = document.createElement('div')
    s.className = 'gfx-spark gfx-smoke'
    host.appendChild(s)
    s.animate([
      { transform: `translate(${c.x}px, ${c.y}px) scale(.5)`, opacity: 0.8 },
      { transform: `translate(${c.x + (Math.random() - 0.5) * 30}px, ${c.y - 40 - Math.random() * 30}px) scale(1.8)`, opacity: 0 },
    ], { duration: 800 }).onfinish = () => s.remove()
  }
}

/** Sacudida corta de un elemento (últimos 2 segundos del reloj). */
export function jolt(el) {
  if (!el || reducedMotion) return
  el.animate([
    { transform: 'translate(0,0)' }, { transform: 'translate(-6px,2px)' }, { transform: 'translate(5px,-2px)' },
    { transform: 'translate(-3px,1px)' }, { transform: 'translate(0,0)' },
  ], { duration: 320, easing: 'ease' })
}
