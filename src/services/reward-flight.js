/**
 * RECOMPENSA QUE VIAJA (Moodboard 02)
 *
 * Al reclamar, la recompensa sale del botón y vuela en arco hasta donde vive:
 * el XP en orbes dorados hacia tu avatar/nivel del menú, las ayudas como su
 * botón de color. El destino rebota al recibir cada una. El toast queda solo de
 * respaldo: si no hay destino visible (ej. menú oculto), devuelve false y el
 * que llama muestra el toast de siempre.
 *
 * Destinos: el primer elemento VISIBLE con [data-reward-anchor="xp|powerup"]
 * o, si no hay, con [data-avatar-anchor].
 */
import { flyTo, center, sparks, reducedMotion } from './game-fx'
import { soundManager } from './sounds'

const PU_COLORS = { fifty_fifty: '#e879f9', shield: '#38bdf8', extra_time: '#fbbf24', reveal_hint: '#34d399' }
const PU_GLYPH = { fifty_fifty: '50/50', shield: '🛡', extra_time: '+15', reveal_hint: '💡' }

function visibleAnchor(kind) {
  const list = [
    ...document.querySelectorAll(`[data-reward-anchor="${kind}"]`),
    ...document.querySelectorAll('[data-avatar-anchor]'),
  ]
  for (const el of list) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight) return el
  }
  return null
}

function bounce(el) {
  el?.animate?.([
    { transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(.94)' }, { transform: 'scale(1)' },
  ], { duration: 380, easing: 'cubic-bezier(.34,1.56,.64,1)' })
}

function floatLabel(el, text, color = '#fcd34d') {
  const c = center(el)
  const d = document.createElement('div')
  d.className = 'gfx-burst'
  d.textContent = text
  d.style.color = color
  d.style.left = c.x + 'px'
  d.style.top = (c.y + c.h * 0.9) + 'px'
  let layer = document.querySelector('.gfx-layer')
  if (!layer) { layer = document.createElement('div'); layer.className = 'gfx-layer'; document.body.appendChild(layer) }
  layer.appendChild(d)
  d.animate([
    { opacity: 0, transform: 'translate(-50%,-30%) scale(.6)' },
    { opacity: 1, transform: 'translate(-50%,-50%) scale(1.05)', offset: 0.25 },
    { opacity: 1, transform: 'translate(-50%,-60%) scale(1)', offset: 0.75 },
    { opacity: 0, transform: 'translate(-50%,-80%) scale(.95)' },
  ], { duration: 1200, easing: 'ease-out' }).onfinish = () => d.remove()
}

/** ¿Hay a dónde volar? (si no, el que llama muestra el toast de respaldo) */
export function hasRewardAnchor(kind = 'xp') {
  return typeof document !== 'undefined' && !!visibleAnchor(kind === 'powerup' ? 'powerup' : 'xp')
}

/**
 * @param {Element} fromEl  botón o tarjeta desde donde sale
 * @param {{ kind:'xp'|'powerup'|'other', amount?:number, powerup?:string, delay?:number }} opts
 * @returns {Promise<boolean>} true si encontró destino (no hace falta toast)
 */
export async function flyReward(fromEl, { kind = 'xp', amount = 0, powerup = '', delay = 0 } = {}) {
  if (typeof document === 'undefined' || !fromEl) return false
  const target = visibleAnchor(kind === 'powerup' ? 'powerup' : 'xp')
  if (!target) return false
  if (delay) await new Promise(r => setTimeout(r, delay))
  if (reducedMotion) {
    bounce(target)
    floatLabel(target, kind === 'powerup' ? `+${PU_GLYPH[powerup] || 'Ayuda'}` : `+${amount} XP`)
    return true
  }
  if (kind === 'powerup') {
    const col = PU_COLORS[powerup] || '#94a3b8'
    const html = `<span style="display:grid;place-items:center;width:34px;height:34px;border-radius:9px;font:800 12px/1 var(--font-bug);color:#fff;background:color-mix(in srgb,${col} 30%,#0b1024);border:2px solid ${col};box-shadow:0 0 14px ${col}">${PU_GLYPH[powerup] || '★'}</span>`
    await flyTo({ from: fromEl, to: target, html, duration: 650, arc: 90 })
    soundManager.play('coin')
    bounce(target)
    const c = center(target); sparks(c.x, c.y, 10, [col, '#fff'], 40)
    return true
  }
  // XP: varios orbes en cascada, cada uno hace "tic" al llegar
  const n = Math.max(3, Math.min(9, 3 + Math.round((amount || 0) / 60)))
  // Chispas doradas en rombo (no esferas): mismo idioma que la chapa de XP de la carta
  const orb = '<span style="display:block;width:11px;height:11px;transform:rotate(45deg);border-radius:2px;background:linear-gradient(135deg,#fff7cc,#fcd34d 55%,#d97706);box-shadow:0 0 10px rgba(252,211,77,.8)"></span>'
  const flights = []
  for (let i = 0; i < n; i++) {
    flights.push(new Promise(res => setTimeout(() => {
      const a = center(fromEl)
      const from = { x: a.x + (Math.random() - 0.5) * Math.min(60, a.w), y: a.y + (Math.random() - 0.5) * 16 }
      flyTo({ from, to: target, html: orb, duration: 520 + Math.random() * 160, arc: 60 + Math.random() * 60 })
        .then(() => { soundManager.play('coin'); bounce(target); res() })
    }, i * 70)))
  }
  await Promise.all(flights)
  const c = center(target); sparks(c.x, c.y, 14, ['#fcd34d', '#fff'], 46)
  if (amount) floatLabel(target, `+${amount} XP`)
  return true
}
