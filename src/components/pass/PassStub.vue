<script setup>
// Una MITAD de la entrada: Popular (gratis, izquierda) o Platea (PRO, derecha).
// El premio va en grande; abajo sólo la etiqueta mínima + estado.
//  ready    → toda la mitad es un botón (brilla, rebota, chip "Cobrar" DEBAJO del premio)
//  pro-lock → toda la mitad lleva a /pricing (candado PRO)
//  claimed  → sello "COBRADO" en la esquina
//  locked   → gris
//
// Gestos del abono (artifact "Abono de temporada"):
//  · Cortar el talón: tocar o ARRASTRAR la mitad lista hacia afuera de la
//    entrada. Al cobrarse queda con borde dentado del lado del troquel.
//  · Se prende la Platea: `lights` la enciende como un reflector (con
//    `fxDelay` para ir de arriba abajo) y `drop` hace caer el premio ganado.
import { computed, ref } from 'vue'
import PassPrize from './PassPrize.vue'
import { rarityColors } from './pass-rewards'

const props = defineProps({
  side: { type: String, required: true }, // 'pop' | 'pla'
  level: { type: Number, required: true },
  reward: { type: Object, default: null },
  state: { type: String, required: true }, // empty|claimed|locked|pro-lock|ready
  topLeft: { type: String, default: '' },
  topRight: { type: String, default: '' },
  busy: { type: Boolean, default: false },
  justClaimed: { type: Boolean, default: false },
  lights: { type: Boolean, default: false },
  drop: { type: Boolean, default: false },
  fxDelay: { type: Number, default: 0 }, // ms
  note: { type: String, default: '' },   // texto en lugar del premio (fila 0 de Popular)
})
const emit = defineEmits(['claim', 'upgrade'])
const root = ref(null)

const isPla = computed(() => props.side === 'pla')
const locked = computed(() => props.state === 'locked')
const ready = computed(() => props.state === 'ready')
const proLock = computed(() => props.state === 'pro-lock')
const claimed = computed(() => props.state === 'claimed')
const interactive = computed(() => ready.value || proLock.value)

const paper = computed(() => {
  if (locked.value) return '#273246'
  if (ready.value) return isPla.value ? '#ffe0d1' : '#fff3d6'
  return isPla.value ? '#f2cdbd' : '#f1e4c6'
})
const ink = computed(() => (locked.value ? '#7c8aa3' : isPla.value ? '#4a1a10' : '#3b2410'))
const rule = computed(() => (locked.value ? 'rgba(255,255,255,0.08)' : isPla.value ? 'rgba(122,40,24,0.3)' : 'rgba(120,80,30,0.3)'))
const prizeFilter = computed(() => {
  if (locked.value) return 'grayscale(0.85) brightness(0.7)'
  if (claimed.value) return 'saturate(0.5) brightness(0.92)'
  if (proLock.value) return 'saturate(0.45) brightness(0.85)'
  return 'none'
})
const isCos = computed(() => props.reward?.kind === 'cosmetic')
const tagStyle = computed(() => {
  if (locked.value) return { background: 'rgba(255,255,255,0.06)', color: '#7c8aa3' }
  if (isCos.value) {
    const rc = rarityColors(props.reward.rarity)
    return { background: rc[0], color: props.reward.rarity === 'legendary' ? '#1c1206' : '#fff' }
  }
  return { background: 'rgba(0,0,0,0.12)', color: ink.value }
})

const trackName = computed(() => (isPla.value ? 'Platea' : 'Popular'))
const aria = computed(() => {
  const name = props.reward?.name || 'premio'
  if (ready.value) return `Cobrar ${name}, nivel ${props.level} ${trackName.value}`
  if (proLock.value) return `${name}, nivel ${props.level} Platea. Activá Platea para cobrarlo`
  return undefined
})

// ── Cortar el talón arrastrando (hacia afuera de la entrada) ──
const CUT_AT = 38 // px
const dragX = ref(0)
let drag = null
let swallowClick = false
const outward = (dx) => (isPla.value ? dx : -dx) // positivo = alejándose del troquel
function onDown(e) {
  if (!ready.value || props.busy || e.button > 0) return
  drag = { x: e.clientX, y: e.clientY, id: e.pointerId, on: false }
}
function onMove(e) {
  if (!drag || e.pointerId !== drag.id) return
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y
  if (!drag.on) {
    if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return
    drag.on = true
    try { root.value?.setPointerCapture?.(e.pointerId) } catch { /* noop */ }
  }
  dragX.value = Math.max(0, Math.min(56, outward(dx)))
  if (dragX.value >= CUT_AT) {
    drag = null
    swallowClick = true
    emit('claim', root.value)
    setTimeout(() => { dragX.value = 0 }, 60)
  }
}
function onUp() {
  if (drag?.on) swallowClick = true
  drag = null
  dragX.value = 0
}
const dragStyle = computed(() => {
  if (!dragX.value) return null
  const d = isPla.value ? dragX.value : -dragX.value
  return { transform: `translateX(${d * 0.6}px) rotate(${d * 0.08}deg)`, transition: 'none' }
})

function onTap() {
  if (swallowClick) { swallowClick = false; return }
  if (props.busy) return
  if (ready.value) emit('claim', root.value)
  else if (proLock.value) emit('upgrade')
}
defineExpose({ el: root })
</script>

<template>
  <component
    :is="interactive ? 'button' : 'div'"
    ref="root"
    :type="interactive ? 'button' : undefined"
    :aria-label="aria"
    :aria-busy="busy ? 'true' : undefined"
    class="stub"
    :class="[isPla ? 'stub--pla' : 'stub--pop', { 'stub--ready': ready, 'stub--tap': interactive, 'stub--cut': claimed, 'stub--tearing': justClaimed, 'stub--lights': lights }]"
    :style="[{ background: paper, color: ink, '--fx-d': fxDelay + 'ms' }, dragStyle]"
    @click="onTap"
    @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp" @pointercancel="onUp"
  >
    <span class="stub-rule" aria-hidden="true" :style="{ borderColor: rule }"></span>

    <span class="stub-top" aria-hidden="true"><span>{{ topLeft }}</span><span>{{ topRight }}</span></span>

    <span v-if="note && !reward" class="stub-note">{{ note }}</span>
    <span v-else class="stub-prize" :class="{ 'pass-bob': ready && !drop, 'stub-drop': drop }" :style="{ filter: prizeFilter }">
      <PassPrize v-if="reward" :reward="reward" :muted="locked" />
      <span v-else class="stub-empty" aria-hidden="true">—</span>
    </span>
    <span v-if="lights" class="stub-beam" aria-hidden="true"></span>

    <span v-if="reward" class="stub-foot">
      <span class="stub-tag" :style="tagStyle">{{ reward.tag }}</span>
      <span v-if="claimed" class="stub-stamp" :class="{ 'stub-stamp--in': justClaimed }" role="img" aria-label="Cobrado">COBRADO</span>
      <span v-else-if="ready" class="stub-cta" aria-hidden="true">{{ busy ? '…' : 'COBRAR' }}</span>
      <svg v-else-if="locked" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" role="img" aria-label="Bloqueado"><path d="M6 11h12v10H6zM8 11V8a4 4 0 018 0v3" /></svg>
      <span v-else-if="proLock" class="stub-pro" aria-hidden="true">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"><path d="M6 11h12v10H6zM8 11V8a4 4 0 018 0v3" /></svg>PRO
      </span>
    </span>
  </component>
</template>

<style scoped>
.stub {
  position: relative; display: flex; flex-direction: column; align-items: center;
  min-width: 0; height: 100%; box-sizing: border-box; padding: 7px 8px 6px; overflow: hidden;
  border: 0; margin: 0; font: inherit; text-align: center; -webkit-tap-highlight-color: transparent;
  transition: transform 0.12s ease;
}
.stub--pop { border-radius: 12px 0 0 12px; }
.stub--pla { border-radius: 0 12px 12px 0; }
.stub--tap { cursor: pointer; }
.stub--tap:active { transform: scale(0.97); }
.stub--tap:focus-visible { outline: 3px solid #fde68a; outline-offset: -3px; }
.stub--ready { box-shadow: inset 0 0 0 2px #fbbf24, inset 0 0 18px rgba(251,191,36,0.55); touch-action: pan-y; }

/* Talón cortado: borde dentado del lado del troquel */
.stub--pop.stub--cut { clip-path: polygon(0 0, 100% 0, 96% 8%, 100% 17%, 96% 25%, 100% 33%, 96% 42%, 100% 50%, 96% 58%, 100% 67%, 96% 75%, 100% 83%, 96% 92%, 100% 100%, 0 100%); }
.stub--pla.stub--cut { clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%, 4% 92%, 0 83%, 4% 75%, 0 67%, 4% 58%, 0 50%, 4% 42%, 0 33%, 4% 25%, 0 17%, 4% 8%); }
.stub--pop.stub--tearing { animation: stub-tear-l .45s cubic-bezier(.3,.7,.4,1); }
.stub--pla.stub--tearing { animation: stub-tear-r .45s cubic-bezier(.3,.7,.4,1); }
@keyframes stub-tear-l { 40% { transform: translateX(-12px) rotate(-4deg); } 100% { transform: none; } }
@keyframes stub-tear-r { 40% { transform: translateX(12px) rotate(4deg); } 100% { transform: none; } }

/* Se prende la Platea: reflector de arriba abajo y el premio cae */
.stub--lights { animation: stub-lights .62s ease-out var(--fx-d, 0ms) both; }
@keyframes stub-lights { 0% { filter: brightness(.35) saturate(.6); } 45% { filter: brightness(1.7) saturate(1.2); } 100% { filter: none; } }
.stub-beam {
  position: absolute; inset: -20% 10% 30%; pointer-events: none; opacity: 0;
  background: radial-gradient(60% 80% at 50% 0%, rgba(255,247,214,.85), rgba(253,230,138,.25) 55%, transparent 75%);
  animation: stub-beam .9s ease-out var(--fx-d, 0ms) both;
}
@keyframes stub-beam { 0% { opacity: 0; } 30% { opacity: 1; } 100% { opacity: 0; } }
.stub-drop { animation: stub-drop .55s cubic-bezier(.3,1.5,.5,1) calc(var(--fx-d, 0ms) + 380ms) both; }
@keyframes stub-drop { 0% { transform: translateY(-46px) scale(.8); opacity: 0; } 60% { opacity: 1; } 100% { transform: none; opacity: 1; } }
.stub-note {
  position: relative; margin: auto 0; max-width: 130px; font-size: 11px; font-weight: 700; line-height: 1.25; opacity: .75;
}

.stub-rule { position: absolute; border: 1px solid; pointer-events: none; }
.stub--pop .stub-rule { inset: 4px 0 4px 4px; border-right: 0; border-radius: 9px 0 0 9px; }
.stub--pla .stub-rule { inset: 4px 4px 4px 0; border-left: 0; border-radius: 0 9px 9px 0; }

.stub-top {
  position: relative; align-self: stretch; display: flex; justify-content: space-between; gap: 4px;
  font-size: 8px; font-weight: 800; letter-spacing: 1.1px; opacity: 0.7; white-space: nowrap;
}
.stub-top span:last-child { overflow: hidden; text-overflow: ellipsis; }

.stub-prize {
  position: relative; margin-top: 4px; min-width: 56px; height: 56px;
  display: flex; align-items: center; justify-content: center;
}
.stub-empty { font-size: 20px; opacity: 0.35; font-weight: 700; }

.stub-stamp {
  display: inline-block; transform: rotate(-8deg); padding: 0 5px; line-height: 15px;
  border: 2px solid rgba(185,28,28,0.75); border-radius: 5px; background: rgba(255,255,255,0.35);
  color: rgba(185,28,28,0.9); font-family: var(--font-bug); font-weight: 800; font-size: 11px; letter-spacing: 1.2px;
}
.stub-stamp--in { animation: stub-stamp-in 0.38s cubic-bezier(.2,1.4,.5,1) both; }
@keyframes stub-stamp-in {
  0% { opacity: 0; transform: rotate(-8deg) scale(2.2); }
  70% { opacity: 1; transform: rotate(-8deg) scale(0.92); }
  100% { opacity: 1; transform: rotate(-8deg) scale(1); }
}

.stub-foot { position: relative; margin-top: auto; height: 20px; display: flex; align-items: center; justify-content: center; gap: 5px; }
.stub-tag, .stub-cta, .stub-pro {
  border-radius: 6px; font-family: var(--font-bug); font-weight: 800; line-height: 18px; white-space: nowrap;
}
.stub-tag { padding: 0 6px; font-size: 14px; letter-spacing: 0.3px; }
.stub-cta { padding: 0 7px; background: #22c55e; box-shadow: 0 2px 0 #15803d; color: #fff; font-size: 13px; letter-spacing: 0.5px; }
.stub-pro { display: flex; align-items: center; gap: 3px; padding: 0 6px; background: rgba(11,18,32,0.85); color: #fde68a; font-size: 12px; letter-spacing: 0.4px; }

.pass-bob { animation: pass-bob 1.6s ease-in-out infinite; }
@keyframes pass-bob { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-3px) scale(1.06); } }

@media (prefers-reduced-motion: reduce) {
  .pass-bob, .stub-stamp--in, .stub--tearing, .stub--lights, .stub-drop { animation: none; }
  .stub-beam { display: none; }
  .stub--tap:active { transform: none; }
}
</style>
