<script setup>
// Un nivel del abono = una ENTRADA partida:
//   Popular (gratis) | número troquelado | Platea (PRO)
import { computed } from 'vue'
import PassStub from './PassStub.vue'
import { rewardOf, stubState } from './pass-rewards'

const props = defineProps({
  tier: { type: Object, required: true },
  isPremium: { type: Boolean, default: false },
  current: { type: Boolean, default: false },
  serialPrefix: { type: String, default: 'F' },
  busyKey: { type: String, default: '' },
  justClaimed: { type: Object, default: () => new Set() },
})
const emit = defineEmits(['claim', 'upgrade'])

const lvl = computed(() => props.tier.tier)
const popReward = computed(() => rewardOf(props.tier, 'free'))
const plaReward = computed(() => rewardOf(props.tier, 'premium'))
const popState = computed(() => stubState(props.tier, 'free', props.isPremium))
const plaState = computed(() => stubState(props.tier, 'premium', props.isPremium))
const anyReady = computed(() => popState.value === 'ready' || plaState.value === 'ready')
const locked = computed(() => !props.tier.unlocked)

const serial = computed(() => `N.º ${String(lvl.value).padStart(4, '0')}-${props.serialPrefix}`)
// Asiento decorativo (estable por nivel)
const seat = computed(() => `ASIENTO ${lvl.value * 3 + 4}`)

const strip = computed(() => {
  if (props.current) return { bg: 'linear-gradient(180deg,#fde68a,#f59e0b)', ink: '#451a03', num: '#451a03' }
  if (locked.value) return { bg: '#1e2738', ink: '#64748b', num: '#475569' }
  return { bg: '#dcc9a1', ink: '#6b4a22', num: '#0b1220' }
})

const key = (track) => `${lvl.value}_${track}`
</script>

<template>
  <div class="tk" :data-current="current ? '1' : '0'">
    <PassStub
      side="pop" :level="lvl" :reward="popReward" :state="popState"
      :topLeft="'POPULAR'" :topRight="serial"
      :busy="busyKey === key('free')" :justClaimed="justClaimed.has(key('free'))"
      @claim="(el) => emit('claim', tier, 'free', el)"
    />

    <div class="tk-strip" :style="{ background: strip.bg }" :aria-label="`Nivel ${lvl}${current ? ', estás acá' : ''}`" role="img">
      <span class="tk-strip-lbl" :style="{ color: strip.ink }">NIVEL</span>
      <span class="tk-strip-num" :style="{ color: strip.num }">{{ lvl }}</span>
      <span v-if="current" class="tk-strip-lbl tk-here">ESTÁS ACÁ</span>
    </div>

    <PassStub
      side="pla" :level="lvl" :reward="plaReward" :state="plaState"
      :topLeft="`FILA ${lvl}`" :topRight="seat"
      :busy="busyKey === key('premium')" :justClaimed="justClaimed.has(key('premium'))"
      @claim="(el) => emit('claim', tier, 'premium', el)"
      @upgrade="emit('upgrade')"
    />

    <span v-if="anyReady" class="tk-glow" aria-hidden="true"></span>
  </div>
</template>

<style scoped>
.tk {
  position: relative; height: 108px; display: grid; grid-template-columns: 1fr 54px 1fr;
  filter: drop-shadow(0 4px 8px rgba(0,0,0,0.45));
}
/* Troquel: muescas transparentes arriba/abajo (con máscara, así funciona sobre cualquier fondo) */
.tk-strip {
  position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center;
  border-left: 2px dashed rgba(60,35,15,0.45); border-right: 2px dashed rgba(60,35,15,0.45);
  -webkit-mask: radial-gradient(circle at 50% 0, transparent 9px, #000 9.5px) top / 100% 51% no-repeat,
                radial-gradient(circle at 50% 100%, transparent 9px, #000 9.5px) bottom / 100% 51% no-repeat;
          mask: radial-gradient(circle at 50% 0, transparent 9px, #000 9.5px) top / 100% 51% no-repeat,
                radial-gradient(circle at 50% 100%, transparent 9px, #000 9.5px) bottom / 100% 51% no-repeat;
}
.tk-strip-lbl { font-size: 7.5px; font-weight: 800; letter-spacing: 1px; }
.tk-here { margin-top: 2px; letter-spacing: 0.8px; color: #451a03; }
.tk-strip-num {
  font-family: var(--font-bug); font-weight: 800; font-style: italic; font-size: 30px; line-height: 1;
  text-shadow: 0 1px 0 rgba(255,255,255,0.45), 0 -1px 0 rgba(0,0,0,0.35);
}
.tk-glow { position: absolute; inset: 0; border-radius: 12px; pointer-events: none; animation: tk-glow 1.8s ease-in-out infinite; }
@keyframes tk-glow {
  0%,100% { box-shadow: 0 0 0 2px #fbbf24, 0 0 10px 1px rgba(251,191,36,0.45); }
  50% { box-shadow: 0 0 0 2px #fde68a, 0 0 22px 5px rgba(251,191,36,0.7); }
}
@media (prefers-reduced-motion: reduce) {
  .tk-glow { animation: none; box-shadow: 0 0 0 2px #fbbf24, 0 0 10px 1px rgba(251,191,36,0.45); }
}
</style>
