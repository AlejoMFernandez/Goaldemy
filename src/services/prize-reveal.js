/**
 * Reparto de cartas "Desbloqueaste" (Moodboards 02 · escalera de rareza y 08).
 *
 * Las cartas entran boca abajo y se dan vuelta DE A UNA. Cuanto más rara la
 * carta, más espera antes de darse vuelta (suspenso) y más fuerte suena.
 * Común ~0,25 s · Rara ~0,5 s · Épica ~0,8 s · Legendaria ~1,3 s (con temblor).
 */
import { soundManager } from './sounds'
import { reducedMotion, sparks, center } from './game-fx'

export const RARITY_WAIT = { common: 250, rare: 500, epic: 800, legendary: 1300 }
export const RARITY_SOUND = { common: 'cardFlip', rare: 'cardRare', epic: 'cardEpic', legendary: 'cardLegendary' }
export const RARITY_COLOR = { common: '#cbd5e1', rare: '#38bdf8', epic: '#e879f9', legendary: '#fbbf24' }
const RARITY_SPARKS = { common: 0, rare: 16, epic: 32, legendary: 64 }
const RARITY_SHAKE = { common: 0, rare: 400, epic: 800, legendary: 1300 }
const RARITY_LABEL = { epic: 'Épica', legendary: 'Legendaria' }

// Anillo que se expande desde la carta (rara en adelante)
function ringAt(el, color) {
  const r = el.getBoundingClientRect()
  const d = document.createElement('div')
  d.style.cssText = `position:fixed;left:${r.left + r.width / 2}px;top:${r.top + r.height / 2}px;width:${r.width}px;height:${r.width}px;margin:${-r.width / 2}px 0 0 ${-r.width / 2}px;border-radius:50%;border:3px solid ${color};pointer-events:none;z-index:9998`
  document.body.appendChild(d)
  d.animate([{ transform: 'scale(.3)', opacity: .9 }, { transform: 'scale(2.6)', opacity: 0 }], { duration: 700, easing: 'cubic-bezier(.16,1,.3,1)' }).onfinish = () => d.remove()
}
// Sello "ÉPICA" / "LEGENDARIA" que golpea arriba de la carta
function stampAt(el, text, color) {
  const r = el.getBoundingClientRect()
  const d = document.createElement('div')
  d.textContent = text
  d.style.cssText = `position:fixed;left:${r.left + r.width / 2}px;top:${r.top - 6}px;transform:translate(-50%,-100%) rotate(-6deg);font-family:var(--font-shout),sans-serif;font-weight:800;font-style:italic;text-transform:uppercase;font-size:${Math.max(18, r.width * 0.2)}px;color:${color};text-shadow:0 0 16px ${color},0 3px 0 rgba(0,0,0,.5);pointer-events:none;z-index:9998;white-space:nowrap`
  document.body.appendChild(d)
  d.animate([
    { transform: 'translate(-50%,-100%) scale(2.4) rotate(-10deg)', opacity: 0 },
    { transform: 'translate(-50%,-100%) scale(1) rotate(-6deg)', opacity: 1, offset: .25 },
    { transform: 'translate(-50%,-100%) scale(1) rotate(-6deg)', opacity: 1, offset: .8 },
    { transform: 'translate(-50%,-140%) scale(.9) rotate(-6deg)', opacity: 0 },
  ], { duration: 1500, easing: 'ease-out' }).onfinish = () => d.remove()
}
// Flash de pantalla (legendaria)
function flashScreen() {
  const d = document.createElement('div')
  d.style.cssText = 'position:fixed;inset:0;background:#fff;pointer-events:none;z-index:9997'
  document.body.appendChild(d)
  d.animate([{ opacity: .75 }, { opacity: 0 }], { duration: 380 }).onfinish = () => d.remove()
}

/**
 * @param {Array<{rarity:string}>} prizes
 * @param {(i:number)=>void} flip      da vuelta la carta i (el componente cambia faceDown)
 * @param {(i:number)=>Element|null} elOf  elemento de la carta i (para las chispas)
 * @param {{ startDelay?:number, gap?:number, onDone?:Function }} opts
 * @returns {Function} cancelar
 */
export function revealPrizes(prizes, flip, elOf, { startDelay = 300, gap = 380, onDone } = {}) {
  const timers = []
  const T = (fn, ms) => timers.push(setTimeout(fn, ms))
  if (reducedMotion) {
    prizes.forEach((_, i) => flip(i))
    T(() => onDone && onDone(), 50)
    return () => timers.forEach(clearTimeout)
  }
  let t = startDelay
  prizes.forEach((p, i) => {
    const r = p?.rarity || 'common'
    const shake = RARITY_SHAKE[r] || 0
    // Escalera de rareza (moodboard 02 · 03): cuanto más rara, más tiembla y más tarda
    if (shake) {
      T(() => {
        const el = elOf(i)
        soundManager.play(r === 'legendary' ? 'riserLong' : 'riser')
        const amp = r === 'legendary' ? 5 : r === 'epic' ? 3.5 : 2
        el?.animate?.([
          { transform: 'rotate(0) scale(1)', filter: 'brightness(1)' },
          { transform: `rotate(${-amp}deg) scale(1.03)` }, { transform: `rotate(${amp}deg) scale(1.05)` },
          { transform: `rotate(${-amp}deg) scale(1.07)` }, { transform: `rotate(${amp}deg) scale(1.09)` },
          { transform: 'rotate(0) scale(1.1)', filter: 'brightness(1.7)' },
        ], { duration: shake, easing: 'ease-in' })
      }, t)
    }
    t += Math.max(RARITY_WAIT[r] || 250, shake)
    T(() => {
      flip(i)
      soundManager.play(RARITY_SOUND[r] || 'cardFlip')
      const el = elOf(i)
      if (el) {
        const c = center(el)
        if (RARITY_SPARKS[r]) sparks(c.x, c.y, RARITY_SPARKS[r], [RARITY_COLOR[r] || '#fff', '#ffffff'], Math.max(60, c.w * (r === 'legendary' ? 1.3 : 0.9)))
        if (r !== 'common') ringAt(el, RARITY_COLOR[r])
        if (r === 'legendary') flashScreen()
        if (RARITY_LABEL[r]) setTimeout(() => stampAt(el, RARITY_LABEL[r], RARITY_COLOR[r]), 250)
      }
    }, t)
    t += gap + (r === 'epic' || r === 'legendary' ? 500 : 0)
  })
  T(() => onDone && onDone(), t)
  return () => timers.forEach(clearTimeout)
}
