<script setup>
// Un nivel del abono = una ENTRADA partida:
//   Popular (gratis) | número troquelado | Platea (PRO)
//
// Gestos sobre el diseño V4 (artifact "Abono de temporada"):
//  · punched  → el nivel ya alcanzado queda AGUJEREADO por el troquel.
//  · punching → el troquel baja ahora: el número se hunde con "¡CLAC!".
//  · Hitos 5/10/…/30: sello de goma (stamping = se estampa ahora).
//  · variant 'zero'     → nivel 0 de Platea (se cobra al activarla).
//  · variant 'overtime' → tiempo de descuento (talones extra después del 30).
import { computed } from 'vue'
import PassStub from './PassStub.vue'
import { rewardOf, stubState } from './pass-rewards'
import { isMilestone } from './pass-season'

const props = defineProps({
  tier: { type: Object, required: true },
  isPremium: { type: Boolean, default: false },
  current: { type: Boolean, default: false },
  serialPrefix: { type: String, default: 'F' },
  busyKey: { type: String, default: '' },
  justClaimed: { type: Object, default: () => new Set() },
  variant: { type: String, default: '' }, // '' | 'zero' | 'overtime'
  punched: { type: Boolean, default: false },
  punching: { type: Boolean, default: false },
  stamping: { type: Boolean, default: false },
  lights: { type: Boolean, default: false },   // se prende la Platea
  fxDelay: { type: Number, default: 0 },
  overtime: { type: Object, default: null },   // { earned, max }
})
const emit = defineEmits(['claim', 'upgrade'])

const lvl = computed(() => props.tier.tier)
const popReward = computed(() => rewardOf(props.tier, 'free'))
const plaReward = computed(() => rewardOf(props.tier, 'premium'))
const popState = computed(() => stubState(props.tier, 'free', props.isPremium))
const plaState = computed(() => stubState(props.tier, 'premium', props.isPremium))
const anyReady = computed(() => popState.value === 'ready' || plaState.value === 'ready')
const locked = computed(() => !props.tier.unlocked)

const isZero = computed(() => props.variant === 'zero')
const isOver = computed(() => props.variant === 'overtime')
const hito = computed(() => !props.variant && isMilestone(lvl.value))
const showHole = computed(() => !props.variant && props.punched)
const showSeal = computed(() => hito.value && props.punched)
const stripAria = computed(() => {
  if (isZero.value) return 'Nivel 0 de Platea: se cobra al activarla'
  if (isOver.value) return `Tiempo de descuento: ${props.overtime?.earned || 0} de ${props.overtime?.max || 10} talones extra`
  return `Nivel ${lvl.value}${hito.value ? ', hito' : ''}${props.current ? ', estás acá' : ''}`
})
const serialNum = computed(() => (isOver.value ? 'DESC' : String(lvl.value).padStart(4, '0')))
const serial = computed(() => `N.º ${serialNum.value}-${props.serialPrefix}`)
// Asiento decorativo (estable por nivel)
const seat = computed(() => (isOver.value ? 'TALÓN EXTRA' : `ASIENTO ${lvl.value * 3 + 4}`))

const strip = computed(() => {
  if (isZero.value || isOver.value) return { bg: 'linear-gradient(180deg,#fcd34d,#b45309)', ink: '#451a03', num: '#1c1206' }
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
      :note="isZero ? 'Platea arranca con un premio al activarla' : ''"
      @claim="(el) => emit('claim', tier, 'free', el)"
    />

    <div class="tk-strip" :class="{ 'tk-strip--punch': punching }" :style="{ background: strip.bg }" :aria-label="stripAria" role="img">
      <template v-if="isZero">
        <span class="tk-strip-lbl" :style="{ color: strip.ink }">NIVEL</span>
        <span class="tk-strip-num" :style="{ color: strip.num }">0</span>
        <span class="tk-strip-lbl tk-here">PLATEA</span>
      </template>
      <template v-else-if="isOver">
        <span class="tk-strip-lbl" :style="{ color: strip.ink }">DESC.</span>
        <span class="tk-strip-num tk-strip-num--sm" :style="{ color: strip.num }">{{ overtime?.earned || 0 }}</span>
        <span class="tk-strip-lbl tk-here">DE {{ overtime?.max || 10 }}</span>
      </template>
      <template v-else>
        <span v-if="showHole" class="tk-hole" :class="{ 'tk-hole--in': punching }" aria-hidden="true"></span>
        <span class="tk-strip-lbl" :style="{ color: strip.ink }">NIVEL</span>
        <span class="tk-strip-num" :style="{ color: strip.num }">{{ lvl }}</span>
        <span v-if="current" class="tk-strip-lbl tk-here">ESTÁS ACÁ</span>
        <span v-if="showSeal" class="tk-seal" :class="{ 'tk-seal--in': stamping }" aria-hidden="true"><span v-if="!current">HITO</span></span>
      </template>
    </div>

    <PassStub
      side="pla" :level="lvl" :reward="plaReward" :state="plaState"
      :topLeft="isOver ? 'PLATEA' : `FILA ${lvl}`" :topRight="seat"
      :busy="busyKey === key('premium')" :justClaimed="justClaimed.has(key('premium'))"
      :lights="lights" :drop="lights && plaState === 'ready'" :fxDelay="fxDelay"
      @claim="(el) => emit('claim', tier, 'premium', el)"
      @upgrade="emit('upgrade')"
    />

    <span v-if="anyReady" class="tk-glow" aria-hidden="true"></span>
    <!-- Fuera del troquel (que tiene máscara con muescas) para que no se recorte -->
    <span v-if="punching && !variant" class="tk-clac" aria-hidden="true">¡CLAC!</span>
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
.tk-strip-num--sm { font-size: 26px; }

/* Agujero del troquel (nivel alcanzado) */
.tk-hole {
  position: absolute; top: 13px; left: 50%; width: 9px; height: 9px; margin-left: -4.5px; border-radius: 50%;
  background: #0b1220; box-shadow: inset 0 2px 3px rgba(0,0,0,.9), 0 1px 0 rgba(255,255,255,.35);
}
.tk-hole--in { animation: tk-hole .55s ease-out both; }
@keyframes tk-hole { 0%, 30% { transform: scale(0); } 55% { transform: scale(1.4); } 100% { transform: scale(1); } }
/* El troquel baja: el número se hunde y rebota */
.tk-strip--punch .tk-strip-num { animation: tk-punch .55s ease-out; }
@keyframes tk-punch {
  0% { transform: scale(1); }
  25% { transform: scale(.6); color: #1c1206; }
  60% { transform: scale(1.15); }
  100% { transform: scale(1); }
}
.tk-strip--punch::after {
  content: ''; position: absolute; inset: 0; pointer-events: none; background: rgba(253,230,138,.85);
  animation: tk-flash .45s ease-out forwards;
}
@keyframes tk-flash { from { opacity: .9; } to { opacity: 0; } }
.tk-clac {
  position: absolute; top: -4px; left: 50%; z-index: 3; pointer-events: none; white-space: nowrap;
  font-family: var(--font-shout, var(--font-bug)); font-weight: 800; font-size: 13px; letter-spacing: .06em; color: #fde68a;
  text-shadow: 0 1px 0 #451a03, 0 0 8px rgba(0,0,0,.6);
  animation: tk-clac .8s ease-out forwards;
}
@keyframes tk-clac { 0% { opacity: 0; transform: translate(-50%, 4px) scale(.8); } 20% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%, -22px) scale(1.1); } }
/* Sello de goma de los hitos */
.tk-seal {
  position: absolute; left: 50%; top: 50%; width: 46px; height: 46px; margin: -23px 0 0 -23px; border-radius: 50%;
  border: 2.5px double rgba(185,28,28,.6); transform: rotate(-14deg); pointer-events: none;
  display: flex; align-items: flex-end; justify-content: center; mix-blend-mode: multiply;
}
.tk-seal span { margin-bottom: -7px; padding: 0 3px; background: rgba(185,28,28,.75); color: #fff7ed; border-radius: 3px;
  font-family: var(--font-bug); font-weight: 800; font-size: 9px; letter-spacing: 1px; line-height: 12px; }
.tk-seal--in { animation: tk-seal .42s cubic-bezier(.2,1.4,.5,1) both; }
@keyframes tk-seal { 0% { opacity: 0; transform: rotate(-14deg) scale(2.4); } 70% { opacity: 1; transform: rotate(-14deg) scale(.92); } 100% { opacity: 1; transform: rotate(-14deg) scale(1); } }

@media (prefers-reduced-motion: reduce) {
  .tk-hole--in, .tk-strip--punch .tk-strip-num, .tk-seal--in { animation: none; }
  .tk-strip--punch::after { animation-duration: 120ms; }
  .tk-clac { animation: tk-clac-fade .8s linear forwards; }
  @keyframes tk-clac-fade { 0% { opacity: 0; } 15%, 70% { opacity: 1; transform: translate(-50%, -8px); } 100% { opacity: 0; transform: translate(-50%, -8px); } }
  .tk-glow { animation: none; box-shadow: 0 0 0 2px #fbbf24, 0 0 10px 1px rgba(251,191,36,0.45); }
}
</style>
