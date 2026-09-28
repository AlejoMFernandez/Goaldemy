<script setup>
/**
 * RarityReveal — "Cada rareza, su escena" (Moodboard 02 · punto 03)
 *
 * La carta llega boca abajo (dorso FULVO) y se da vuelta con una escalera de rareza:
 *  · Común: sube con un barrido de luz, 12 chispas y un "pop" — sin temblor.
 *  · Rara: tiembla 0,4 s con un tono que sube, anillo y 16 chispas celestes.
 *  · Épica: tiembla 0,8 s, rayos girando, 32 chispas y el sello "ÉPICA".
 *  · Legendaria: se apaga la pantalla, las partículas se juntan en la carta
 *    mientras tiembla 1,3 s, flash blanco, rayos, 64 chispas y "LEGENDARIA".
 * Sin confeti: las partículas salen de la carta, del color de la rareza.
 * Ya revelada, la carta es holográfica y se inclina con el mouse / el dedo.
 * Emite `revealed` cuando termina la animación y `ready-to-advance` cuando ya
 * se sostuvo en pantalla lo mínimo (ver `minHold`) — quien la usa en una
 * secuencia "una por una" debería esperar ese segundo evento antes de dejar
 * avanzar a la próxima carta.
 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import PrizeCard from './PrizeCard.vue'
import { soundManager } from '@/services/sounds'
import { reducedMotion } from '@/services/game-fx'

const props = defineProps({
  prize: { type: Object, required: true },
  autoplay: { type: Boolean, default: true },
})
const emit = defineEmits(['revealed', 'ready-to-advance'])

const R = {
  common:    { c: '#cbd5e1', g: 'rgba(148,163,184,.45)', lbl: 'Común',      shake: 0,    parts: 12, minHold: 1500 },
  rare:      { c: '#38bdf8', g: 'rgba(56,189,248,.55)',  lbl: 'Rara',       shake: 400,  parts: 16, minHold: 1500 },
  epic:      { c: '#e879f9', g: 'rgba(232,121,249,.6)',  lbl: 'Épica',      shake: 800,  parts: 32, minHold: 1800 },
  legendary: { c: '#fbbf24', g: 'rgba(251,191,36,.7)',   lbl: 'Legendaria', shake: 1300, parts: 64, minHold: 2200 },
}
const rar = computed(() => R[props.prize?.rarity] ? props.prize.rarity : 'common')
const r = computed(() => R[rar.value])

const dim = ref(0)
const shaking = ref(false)
const flipped = ref(false)
const raysOn = ref(false)
const ringKey = ref(0)
const stampOn = ref(false)
const revealed = ref(false)
const flashKey = ref(0)
const riseOn = ref(false)
const tilt = ref({ x: 0, y: 0 })
const fxEl = ref(null)
const cardEl = ref(null)
let timers = []
function T(fn, ms) { timers.push(setTimeout(fn, reducedMotion ? Math.min(ms, 40) : ms)) }
onBeforeUnmount(() => timers.forEach(clearTimeout))

function cardCenter() {
  const c = cardEl.value?.getBoundingClientRect(), f = fxEl.value?.getBoundingClientRect()
  if (!c || !f) return { x: 0, y: 0, w: 0 }
  return { x: c.left - f.left + c.width / 2, y: c.top - f.top + c.height / 2, w: c.width }
}
function spark(x, y, color, frames, opts) {
  const s = document.createElement('i')
  s.className = 'rr-spark'
  s.style.background = color; s.style.boxShadow = `0 0 8px ${color}`
  fxEl.value?.appendChild(s)
  s.animate(frames, opts).onfinish = () => s.remove()
}
function burst(n, spread) {
  if (reducedMotion || !n) return
  const c = cardCenter()
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, d = spread * (0.4 + Math.random() * 0.8)
    const col = i % 3 === 0 ? '#ffffff' : r.value.c
    spark(0, 0, col, [
      { transform: `translate(${c.x}px,${c.y}px)`, opacity: 1 },
      { transform: `translate(${c.x + Math.cos(a) * d}px,${c.y + Math.sin(a) * d}px) scale(.2)`, opacity: 0 },
    ], { duration: 550 + Math.random() * 450, easing: 'cubic-bezier(.16,1,.3,1)' })
  }
}
// Legendaria: las partículas vienen de afuera y se juntan en la carta
function implode() {
  if (reducedMotion) return
  const c = cardCenter()
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * Math.PI * 2, d = 180 + Math.random() * 160
    spark(0, 0, r.value.c, [
      { transform: `translate(${c.x + Math.cos(a) * d}px,${c.y + Math.sin(a) * d}px)`, opacity: 0 },
      { opacity: 1, offset: 0.3 },
      { transform: `translate(${c.x}px,${c.y}px)`, opacity: 0.9 },
    ], { duration: R.legendary.shake - 100, delay: Math.random() * 200, easing: 'cubic-bezier(.55,0,.9,.4)', fill: 'forwards' })
  }
}

function play() {
  timers.forEach(clearTimeout); timers = []
  dim.value = 0; shaking.value = false; flipped.value = false; raysOn.value = false; stampOn.value = false; revealed.value = false; riseOn.value = false
  const L = rar.value === 'legendary'
  const isCommon = rar.value === 'common'
  let t = 250
  if (L) { T(() => { dim.value = 0.75; soundManager.play('pumSmall') }, 0); t = 600 }
  if (r.value.shake) {
    T(() => { shaking.value = true; soundManager.play(L ? 'riserLong' : 'riser') }, t)
    if (L) T(implode, t + 100)
    t += r.value.shake
  }
  T(() => {
    shaking.value = false; flipped.value = true
    if (r.value.parts) ringKey.value++
    if (L) { dim.value = 0.35; flashKey.value++ }
    if (rar.value === 'epic' || L) raysOn.value = true
    // Común no tiembla: en vez de eso sube con un barrido de luz + "pop".
    if (isCommon) riseOn.value = true
    soundManager.play(L ? 'cardLegendary' : rar.value === 'epic' ? 'cardEpic' : rar.value === 'rare' ? 'cardRare' : isCommon ? 'pop' : 'cardFlip')
    burst(r.value.parts, L ? 220 : 140)
  }, t)
  T(() => {
    revealed.value = true
    if (rar.value === 'epic' || L) { stampOn.value = true; soundManager.play('stamp') }
    emit('revealed')
  }, t + 700)
  T(() => emit('ready-to-advance'), t + r.value.minHold)
}
defineExpose({ play })
onMounted(() => { if (props.autoplay) play() })

// Holográfica: se inclina con el puntero
function onMove(e) {
  if (!revealed.value || !cardEl.value) return
  const b = cardEl.value.getBoundingClientRect()
  tilt.value = { x: (e.clientX - b.left) / b.width - 0.5, y: (e.clientY - b.top) / b.height - 0.5 }
}
function onLeave() { tilt.value = { x: 0, y: 0 } }
const cardStyle = computed(() => revealed.value
  ? { transform: `rotateY(${180 - tilt.value.x * 28}deg) rotateX(${tilt.value.y * 22}deg)`, '--hx': (50 + tilt.value.x * 90) + '%', '--hy': (50 + tilt.value.y * 90) + '%' }
  : null)
</script>

<template>
  <div class="rr" :class="['r-' + rar, { revealed }]" :style="{ '--rc': r.c, '--rg': r.g }" @pointermove="onMove" @pointerleave="onLeave">
    <div class="rr-dim" :style="{ opacity: dim }" aria-hidden="true"></div>
    <div class="rr-rays" :class="{ on: raysOn }" aria-hidden="true"></div>
    <div :key="'ring' + ringKey" class="rr-ring" :class="{ go: ringKey > 0 }" aria-hidden="true"></div>
    <div :key="'fl' + flashKey" class="rr-flash" :class="{ go: flashKey > 0 }" aria-hidden="true"></div>

    <div class="rr-scene" :class="{ rise: riseOn }">
      <div ref="cardEl" class="rr-card" :class="{ flip: flipped, shake: shaking }" :style="[{ '--sd': r.shake + 'ms' }, cardStyle]">
        <div class="rr-face back" aria-hidden="true"><span>F</span></div>
        <div class="rr-face front">
          <PrizeCard :prize="prize" :size="220" />
          <span class="rr-sweep" :class="{ on: riseOn }" aria-hidden="true"></span>
          <span class="rr-holo" aria-hidden="true"></span>
        </div>
      </div>
    </div>
    <div class="rr-stamp" :class="{ go: stampOn }">{{ r.lbl }}</div>
    <div ref="fxEl" class="rr-fx" aria-hidden="true"></div>
  </div>
</template>

<style scoped>
.rr { position: relative; width: 100%; height: min(420px, 62vh); display: grid; place-items: center; perspective: 900px; isolation: isolate; }
.rr-dim { position: absolute; inset: -200vmax; background: #000; transition: opacity .5s; z-index: 0; pointer-events: none; }
.rr-rays { position: absolute; left: 50%; top: 50%; width: min(1100px, 160vw); aspect-ratio: 1; transform: translate(-50%, -50%) scale(.3); opacity: 0; z-index: 1; pointer-events: none;
  background: repeating-conic-gradient(from 0deg, var(--rc) 0 6deg, transparent 6deg 18deg);
  -webkit-mask: radial-gradient(circle, #000 0%, transparent 55%); mask: radial-gradient(circle, #000 0%, transparent 55%);
  transition: opacity .5s, transform .8s cubic-bezier(.16, 1, .3, 1); }
.rr-rays.on { opacity: .45; transform: translate(-50%, -50%) scale(1); animation: rr-spin 14s linear infinite; }
@keyframes rr-spin { to { transform: translate(-50%, -50%) scale(1) rotate(360deg); } }
.rr-ring { position: absolute; left: 50%; top: 50%; width: 180px; aspect-ratio: 1; border-radius: 50%; border: 3px solid var(--rc); transform: translate(-50%, -50%) scale(.2); opacity: 0; z-index: 2; pointer-events: none; }
.rr-ring.go { animation: rr-ring .7s cubic-bezier(.16, 1, .3, 1); }
@keyframes rr-ring { 0% { opacity: .9; transform: translate(-50%, -50%) scale(.3); } 100% { opacity: 0; transform: translate(-50%, -50%) scale(3.2); } }
.rr-flash { position: absolute; inset: -200vmax; background: #fff; opacity: 0; z-index: 30; pointer-events: none; }
.rr-flash.go { animation: rr-flash .35s ease-out; }
@keyframes rr-flash { from { opacity: .8; } to { opacity: 0; } }
.rr-scene { position: relative; z-index: 3; }
.rr-card { position: relative; width: 220px; aspect-ratio: 5 / 7; transform-style: preserve-3d; transition: transform .75s cubic-bezier(.3, 1.4, .4, 1); }
.rr-card.flip { transform: rotateY(180deg); }
.rr.revealed .rr-card { transition: transform .15s ease-out; }
.rr-card.shake { animation: rr-shake var(--sd, .5s) ease-in both; }
@keyframes rr-shake {
  0% { transform: rotate(0) scale(1); }
  20% { transform: rotate(-2deg) scale(1.02); } 40% { transform: rotate(3deg) scale(1.04); }
  60% { transform: rotate(-4deg) scale(1.06); } 80% { transform: rotate(5deg) scale(1.08); }
  100% { transform: rotate(0) scale(1.1); filter: brightness(1.6); }
}
.rr-face { position: absolute; inset: 0; border-radius: 14px; backface-visibility: hidden; -webkit-backface-visibility: hidden; overflow: hidden; }
.rr-face.back { display: grid; place-items: center; border: 3px solid color-mix(in srgb, var(--rc) 60%, #fff);
  background: repeating-linear-gradient(45deg, rgba(255, 255, 255, .06) 0 10px, transparent 10px 20px), radial-gradient(circle at 50% 40%, #1f2a5e, #0b1024);
  box-shadow: 0 0 30px var(--rg), inset 0 0 30px rgba(0, 0, 0, .5); }
.rr-face.back span { font-family: var(--font-shout); font-weight: 800; font-style: italic; font-size: 110px; line-height: 1; color: #fcd34d; text-shadow: 0 5px 0 #b45309; }
.rr-face.front { transform: rotateY(180deg); display: grid; place-items: center; box-shadow: 0 0 44px var(--rg); }
.rr-sweep { position: absolute; inset: 0; z-index: 5; pointer-events: none;
  background: linear-gradient(115deg, transparent 35%, rgba(255, 255, 255, .65) 50%, transparent 65%); background-size: 250% 100%; background-position: 130% 0; opacity: 0; }
.rr-sweep.on { animation: rr-sweep .6s ease-out .05s both; }
@keyframes rr-sweep { 0% { opacity: 1; background-position: 130% 0; } 100% { opacity: 0; background-position: -30% 0; } }
.rr-scene.rise { animation: rr-rise .5s cubic-bezier(.34, 1.56, .64, 1) both; }
@keyframes rr-rise { 0% { transform: translateY(28px) scale(.9); opacity: .7; } 60% { transform: translateY(-6px) scale(1.03); opacity: 1; } 100% { transform: translateY(0) scale(1); opacity: 1; } }
.rr-holo { position: absolute; inset: 0; pointer-events: none; mix-blend-mode: color-dodge; opacity: 0; transition: opacity .3s;
  background: radial-gradient(circle at var(--hx, 50%) var(--hy, 50%), rgba(255, 255, 255, .5), transparent 45%),
    linear-gradient(115deg, transparent 20%, rgba(255, 0, 170, .25) 35%, rgba(0, 220, 255, .25) 50%, rgba(255, 230, 0, .25) 65%, transparent 80%); }
.rr.revealed.r-rare .rr-holo, .rr.revealed.r-epic .rr-holo, .rr.revealed.r-legendary .rr-holo { opacity: .55; }
.rr-stamp { position: absolute; left: 50%; bottom: 0; transform: translateX(-50%); z-index: 6; font-family: var(--font-shout); font-weight: 800; font-style: italic; text-transform: uppercase; font-size: clamp(30px, 7vw, 46px); letter-spacing: .04em; color: var(--rc); opacity: 0; white-space: nowrap; text-shadow: 0 0 20px var(--rg), 0 3px 0 rgba(0, 0, 0, .5); pointer-events: none; }
.rr-stamp.go { animation: rr-stamp .45s cubic-bezier(.2, 1.6, .4, 1) both; }
@keyframes rr-stamp { 0% { opacity: 0; transform: translateX(-50%) scale(2.4) rotate(-8deg); } 100% { opacity: 1; transform: translateX(-50%) scale(1) rotate(-4deg); } }
.rr-fx { position: absolute; inset: 0; z-index: 7; pointer-events: none; overflow: visible; }
.rr-fx :deep(.rr-spark) { position: absolute; left: 0; top: 0; width: 6px; height: 6px; margin: -3px 0 0 -3px; border-radius: 50%; }
@media (max-width: 420px) { .rr-card { width: 190px; } .rr-face.back span { font-size: 90px; } }
@media (prefers-reduced-motion: reduce) { .rr-rays.on, .rr-card.shake, .rr-scene.rise, .rr-sweep.on { animation: none; } }
</style>
