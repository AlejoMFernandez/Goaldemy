<script setup>
// Una MITAD de la entrada: Popular (gratis, izquierda) o Platea (PRO, derecha).
// El premio va en grande; abajo sólo la etiqueta mínima + estado.
//  ready    → toda la mitad es un botón (brilla, rebota, chip "Cobrar" DEBAJO del premio)
//  pro-lock → toda la mitad lleva a /pricing (candado PRO)
//  claimed  → sello "COBRADO" en la esquina
//  locked   → gris
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

function onTap() {
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
    :class="[isPla ? 'stub--pla' : 'stub--pop', { 'stub--ready': ready, 'stub--tap': interactive }]"
    :style="{ background: paper, color: ink }"
    @click="onTap"
  >
    <span class="stub-rule" aria-hidden="true" :style="{ borderColor: rule }"></span>

    <span class="stub-top" aria-hidden="true"><span>{{ topLeft }}</span><span>{{ topRight }}</span></span>

    <span class="stub-prize" :class="{ 'pass-bob': ready }" :style="{ filter: prizeFilter }">
      <PassPrize v-if="reward" :reward="reward" :muted="locked" />
      <span v-else class="stub-empty" aria-hidden="true">—</span>
    </span>

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
.stub--ready { box-shadow: inset 0 0 0 2px #fbbf24, inset 0 0 18px rgba(251,191,36,0.55); }

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
  .pass-bob, .stub-stamp--in { animation: none; }
  .stub--tap:active { transform: none; }
}
</style>
