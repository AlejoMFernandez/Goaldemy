<script setup>
// PITAZO FINAL del abono (artifact "Abono de temporada"): primer ingreso del
// mes nuevo. El abono viejo recibe el sello "FINAL", se muestra el resumen del
// mes y se presenta la temporada nueva con su premio final.
//
// summary: { monthLabel, seasonName, level, totalLevels, claimed, points }
//   (sale de get_monthly_pass.previous si el servidor lo da; si no, de la foto
//    local que guarda MonthlyPass en cada visita).
import { onMounted, onBeforeUnmount, ref, nextTick } from 'vue'
import PassPrize from './PassPrize.vue'
import { soundManager } from '../../services/sounds'
import { heavy, tap } from '../../services/haptics'

const props = defineProps({
  summary: { type: Object, required: true },
  nextName: { type: String, default: '' },
  nextPrize: { type: Object, default: null }, // { name, rarity, cos }
})
const emit = defineEmits(['close'])

const phase = ref(0) // 0 entra · 1 sello · 2 resumen · 3 temporada nueva
const btn = ref(null)
const timers = []
const T = (fn, ms) => timers.push(setTimeout(fn, ms))
const fmt = (n) => Number(n || 0).toLocaleString('es-AR')

onMounted(() => {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
  soundManager.play('whistleFinal')
  if (reduce) {
    phase.value = 3
    T(() => { soundManager.play('stamp'); heavy() }, 300)
  } else {
    T(() => { phase.value = 1; soundManager.play('stamp'); heavy() }, 1100) // después del corto-corto-largo
    T(() => { phase.value = 2 }, 1550)
    T(() => { phase.value = 3 }, 2300)
  }
  nextTick(() => btn.value?.focus?.({ preventScroll: true }))
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => { timers.forEach(clearTimeout); window.removeEventListener('keydown', onKey) })

function onKey(e) { if (e.key === 'Escape') close() }
function close() { tap(); emit('close') }
</script>

<template>
  <Teleport to="body">
    <div class="pf" role="dialog" aria-modal="true" :aria-label="`Pitazo final de ${summary.seasonName}`">
      <div class="pf-card">
        <span class="pf-kicker">PITAZO FINAL</span>

        <!-- El abono viejo, con su sello -->
        <div class="pf-ticket">
          <span class="pf-scan" aria-hidden="true"></span>
          <span class="pf-t-eb">ABONO · {{ summary.monthLabel }}</span>
          <span class="pf-t-name">{{ summary.seasonName }}</span>
          <span class="pf-t-meta">Nivel <b>{{ summary.level }}</b> / {{ summary.totalLevels }}</span>
          <span v-if="phase >= 1" class="pf-stamp" role="img" aria-label="Final">
            <span>FINAL<small>{{ summary.monthShort }}</small></span>
          </span>
        </div>

        <!-- Resumen del mes -->
        <dl class="pf-sum" :class="{ in: phase >= 2 }">
          <div><dt>Nivel</dt><dd>{{ summary.level }}<small>/{{ summary.totalLevels }}</small></dd></div>
          <div><dt>Talones cortados</dt><dd>{{ fmt(summary.claimed) }}</dd></div>
          <div><dt>Puntos</dt><dd>{{ fmt(summary.points) }}</dd></div>
        </dl>
        <p v-if="summary.note" class="pf-note" :class="{ in: phase >= 2 }">{{ summary.note }}</p>

        <!-- La temporada nueva -->
        <div class="pf-next" :class="{ in: phase >= 3 }">
          <span class="pf-next-k">ARRANCA</span>
          <span class="pf-next-name">{{ nextName }}</span>
          <span v-if="nextPrize" class="pf-next-prize">
            <PassPrize :reward="{ kind: 'cosmetic', cos: nextPrize.cos, rarity: nextPrize.cos.rarity }" />
            <span>Premio final: <b>{{ nextPrize.name }}</b></span>
          </span>
        </div>

        <button ref="btn" type="button" class="pf-btn" @click="close">VER EL ABONO NUEVO</button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.pf {
  position: fixed; inset: 0; z-index: 70; display: grid; place-items: center; overflow-y: auto;
  padding: max(16px, env(safe-area-inset-top, 0px)) 16px max(16px, env(safe-area-inset-bottom, 0px));
  background: rgba(7,10,26,.9); animation: pf-in .3s ease both;
}
@keyframes pf-in { from { opacity: 0; } }
.pf-card {
  width: min(100%, 380px); display: flex; flex-direction: column; align-items: stretch; gap: 14px; text-align: center; color: #f1e4c6;
}
.pf-kicker { font-family: var(--font-shout, var(--font-bug)); font-weight: 800; font-size: 30px; letter-spacing: 1px; color: #fecaca; text-shadow: 0 0 18px rgba(239,68,68,.5); }

.pf-ticket {
  position: relative; overflow: hidden; display: flex; flex-direction: column; align-items: flex-start; gap: 2px; text-align: left;
  padding: 16px; border-radius: 16px; color: #3b2410; filter: sepia(.35);
  background: linear-gradient(160deg, #f1e4c6, #d9c7a3); box-shadow: 0 10px 28px rgba(0,0,0,.5);
  animation: pf-ticket .5s cubic-bezier(.16,1,.3,1) both;
}
@keyframes pf-ticket { from { opacity: 0; transform: translateY(18px) rotate(-2deg); } }
.pf-scan { position: absolute; inset: 0; background: repeating-linear-gradient(0deg, rgba(0,0,0,.04) 0 2px, transparent 2px 4px); pointer-events: none; }
.pf-t-eb { font-size: 10px; font-weight: 800; letter-spacing: 1.4px; color: #8a6a3c; }
.pf-t-name { font-family: var(--font-bug); font-weight: 800; font-style: italic; font-size: 30px; line-height: .95; text-transform: uppercase; }
.pf-t-meta { font-size: 13px; font-weight: 700; }
.pf-stamp {
  position: absolute; right: 14px; top: 50%; width: 96px; height: 96px; margin-top: -48px; border-radius: 50%;
  border: 4px double #dc2626; color: #dc2626; display: grid; place-items: center; transform: rotate(-12deg);
  font-family: var(--font-bug); font-weight: 800; font-size: 24px; line-height: .9; letter-spacing: .04em; background: rgba(255,255,255,.18);
  animation: pf-stamp .38s cubic-bezier(.2,1.4,.5,1) both;
}
.pf-stamp small { display: block; font-size: 10px; letter-spacing: .1em; margin-top: 3px; }
@keyframes pf-stamp { 0% { opacity: 0; transform: rotate(-12deg) scale(2.6); } 70% { opacity: 1; transform: rotate(-12deg) scale(.92); } 100% { opacity: 1; transform: rotate(-12deg) scale(1); } }

.pf-sum { margin: 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; opacity: 0; transform: translateY(8px); transition: opacity .35s, transform .35s; }
.pf-sum.in, .pf-note.in, .pf-next.in { opacity: 1; transform: none; }
.pf-sum div { padding: 10px 6px; border-radius: 12px; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.08); }
.pf-sum dt { font-size: 10.5px; font-weight: 700; color: #c4a679; }
.pf-sum dd { margin: 2px 0 0; font-family: var(--font-bug); font-weight: 800; font-size: 24px; color: #fde68a; font-variant-numeric: tabular-nums; }
.pf-sum dd small { font-size: 14px; color: #c4a679; }
.pf-note { margin: -4px 0 0; font-size: 12.5px; color: #c4a679; opacity: 0; transition: opacity .35s; }

.pf-next {
  display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 14px; border-radius: 16px;
  background: linear-gradient(160deg, #4a2e14, #160e07); border: 1px solid rgba(253,230,138,.3);
  opacity: 0; transform: translateY(10px); transition: opacity .4s, transform .4s;
}
.pf-next-k { font-size: 11px; font-weight: 800; letter-spacing: 1.4px; color: #d6b98a; }
.pf-next-name { font-family: var(--font-bug); font-weight: 800; font-style: italic; font-size: 28px; line-height: .95; text-transform: uppercase; color: #f5e6c4; text-shadow: 0 2px 0 #7c4a1a; }
.pf-next-prize { display: flex; align-items: center; gap: 10px; font-size: 12.5px; color: #e7d3ad; text-align: left; }
.pf-next-prize b { color: #fbbf24; }

.pf-btn {
  min-height: 52px; border: 0; border-bottom: 4px solid #b45309; border-radius: 14px; cursor: pointer;
  background: linear-gradient(180deg, #fcd34d, #f59e0b); color: #1c1206;
  font-family: var(--font-bug); font-weight: 800; font-style: italic; font-size: 19px; letter-spacing: .5px;
}
.pf-btn:active { transform: translateY(1px); }
.pf-btn:focus-visible { outline: 3px solid #fde68a; outline-offset: 2px; }

@media (prefers-reduced-motion: reduce) {
  .pf, .pf-ticket, .pf-stamp { animation-duration: 120ms; }
  .pf-stamp { animation-name: pf-in; }
  .pf-sum, .pf-next { transform: none; transition-duration: 120ms; }
  .pf-btn:active { transform: none; }
}
</style>
