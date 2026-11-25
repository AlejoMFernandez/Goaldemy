<script setup>
// Cabecera del Abono de temporada: nombre, días restantes, nivel N/30 con
// barra y, arriba de todo, las dos acciones: "Activar Platea" y "Cobrar todo".
import { computed } from 'vue'

const props = defineProps({
  seasonName: { type: String, default: '' },
  daysLeft: { type: Number, default: 0 },
  level: { type: Number, default: 0 },
  totalLevels: { type: Number, default: 0 },
  points: { type: Number, default: 0 },
  nextLevel: { type: Object, default: null }, // { tier, missing, into, span }
  finalPrize: { type: Object, default: null }, // { name, rarity }
  isPremium: { type: Boolean, default: false },
  readyCount: { type: Number, default: 0 },
  progress: { type: Object, default: null }, // { done, total } mientras cobra todo
})
const emit = defineEmits(['activate', 'claim-all'])

const pct = computed(() => (props.totalLevels ? Math.min(100, Math.round((props.level / props.totalLevels) * 100)) : 0))
const anyReady = computed(() => props.readyCount > 0)
const allLabel = computed(() => {
  if (props.progress) return `COBRANDO ${props.progress.done}/${props.progress.total}`
  return anyReady.value ? `COBRAR TODO (${props.readyCount})` : 'TODO COBRADO'
})
const daysText = computed(() => (props.daysLeft === 1 ? 'Queda 1 día' : `Quedan ${props.daysLeft} días`))

function onClaimAll() {
  if (!anyReady.value || props.progress) return
  emit('claim-all')
}
</script>

<template>
  <section class="hd" :aria-label="`Abono ${seasonName}`">
    <div class="hd-scan" aria-hidden="true"></div>
    <img class="hd-logo" src="/iconclaro.png" alt="" aria-hidden="true" />

    <div class="hd-row">
      <div class="hd-title">
        <span class="hd-kicker">ABONO DE TEMPORADA</span>
        <h2 class="hd-name">{{ seasonName }}</h2>
      </div>
      <span class="hd-days">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l3 2" /></svg>
        {{ daysText }}
      </span>
    </div>

    <div class="hd-lvl">
      <span class="hd-lvl-box" aria-hidden="true">
        <span class="hd-lvl-k">NIVEL</span>
        <span class="hd-lvl-n">{{ level }}</span>
      </span>
      <span class="hd-lvl-body">
        <span class="hd-lvl-top"><span>Tu nivel de abono</span><span class="hd-lvl-frac">{{ level }} / {{ totalLevels }}</span></span>
        <span class="hd-bar" role="progressbar" :aria-valuenow="level" aria-valuemin="0" :aria-valuemax="totalLevels" :aria-label="`Nivel ${level} de ${totalLevels}`">
          <span class="hd-bar-fill" :style="{ width: pct + '%' }"></span>
        </span>
        <span class="hd-sub">
          <template v-if="nextLevel">{{ nextLevel.into }} / {{ nextLevel.span }} puntos para el nivel {{ nextLevel.tier }}</template>
          <template v-else>¡Abono completo! {{ points }} puntos</template>
          <template v-if="finalPrize"> · premio final: <strong>{{ finalPrize.name }}</strong> ({{ finalPrize.rarity }})</template>
        </span>
      </span>
    </div>

    <div class="hd-actions">
      <button
        type="button" class="hd-btn hd-pro"
        :aria-pressed="isPremium ? 'true' : 'false'"
        :aria-disabled="isPremium ? 'true' : undefined"
        @click="!isPremium && emit('activate')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path :d="isPremium ? 'M5 12.5l4.5 4.5L19 7.5' : 'M6 11h12v10H6zM8 11V8a4 4 0 018 0v3'" />
        </svg>
        {{ isPremium ? 'PLATEA ACTIVA' : 'ACTIVAR PLATEA' }}
      </button>
      <button
        type="button" class="hd-btn hd-all" :class="{ 'hd-all--on': anyReady || progress }"
        :aria-disabled="!anyReady || progress ? 'true' : undefined"
        aria-live="polite"
        @click="onClaimAll"
      >
        <span v-if="anyReady && !progress" class="hd-shine" aria-hidden="true"></span>
        <span class="hd-all-lbl">{{ allLabel }}</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.hd {
  position: relative; border-radius: 20px; padding: 14px; overflow: hidden;
  background: linear-gradient(160deg, #4a2e14 0%, #2a1a0c 55%, #160e07 100%);
  border: 1px solid rgba(253,230,138,0.25);
}
.hd-scan { position: absolute; inset: 0; background: repeating-linear-gradient(0deg, rgba(255,255,255,0.025) 0 2px, transparent 2px 4px); pointer-events: none; }
.hd-logo { position: absolute; right: -22px; top: -18px; width: 130px; height: 130px; opacity: 0.16; filter: sepia(1); transform: rotate(-12deg); pointer-events: none; }
.hd-row { position: relative; display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
.hd-title { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.hd-kicker { font-size: 11px; font-weight: 800; letter-spacing: 1.4px; color: #d6b98a; }
.hd-name {
  margin: 0; font-family: var(--font-bug); font-weight: 800; font-style: italic; font-size: 34px; line-height: 0.95;
  letter-spacing: 0.5px; color: #f5e6c4; text-shadow: 0 2px 0 #7c4a1a; text-transform: uppercase; overflow-wrap: anywhere;
}
.hd-days {
  display: flex; align-items: center; gap: 5px; padding: 5px 10px; border-radius: 999px; background: rgba(0,0,0,0.35);
  font-family: var(--font-bug); font-weight: 700; font-size: 14px; color: #fde68a; white-space: nowrap; flex-shrink: 0;
}
.hd-lvl { position: relative; margin-top: 12px; display: flex; align-items: center; gap: 10px; }
.hd-lvl-box {
  width: 48px; height: 48px; flex-shrink: 0; box-sizing: border-box; border-radius: 12px; background: #f1e4c6;
  border: 2px dashed #8a5a2b; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #3b2410; line-height: 1;
}
.hd-lvl-k { font-size: 8px; font-weight: 800; letter-spacing: 1px; }
.hd-lvl-n { font-family: var(--font-bug); font-weight: 800; font-size: 24px; }
.hd-lvl-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px; }
.hd-lvl-top { display: flex; justify-content: space-between; font-size: 12px; font-weight: 700; color: #e7d3ad; }
.hd-lvl-frac { font-family: var(--font-bug); font-weight: 800; font-size: 15px; color: #fde68a; }
.hd-bar { position: relative; height: 12px; border-radius: 999px; background: rgba(0,0,0,0.4); overflow: hidden; display: block; }
.hd-bar-fill { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, #d97706, #fbbf24, #fde68a); transition: width 0.7s ease; }
.hd-sub { font-size: 11px; color: #c4a679; }
.hd-sub strong { color: #fbbf24; }

.hd-actions { position: relative; margin-top: 12px; display: flex; gap: 8px; }
.hd-btn {
  position: relative; overflow: hidden; flex: 1; min-height: 46px; border-radius: 14px; cursor: pointer;
  font-family: var(--font-bug); font-weight: 800; font-style: italic; letter-spacing: 0.5px;
  display: flex; align-items: center; justify-content: center; gap: 6px; -webkit-tap-highlight-color: transparent;
  transition: transform 0.12s ease, filter 0.15s ease;
}
.hd-btn:active { transform: translateY(1px) scale(0.98); }
.hd-btn:focus-visible { outline: 3px solid #fde68a; outline-offset: 2px; }
.hd-btn[aria-disabled="true"] { cursor: default; }
.hd-btn[aria-disabled="true"]:active { transform: none; }
.hd-pro { border: 1.5px solid #fbbf24; background: rgba(251,191,36,0.1); color: #fde68a; font-size: 17px; }
.hd-all { border: 0; border-bottom: 4px solid rgba(255,255,255,0.05); background: rgba(255,255,255,0.08); color: #64748b; font-size: 18px; }
.hd-all--on { border-bottom-color: #b45309; background: linear-gradient(180deg, #fcd34d, #f59e0b); color: #1c1206; }
.hd-all-lbl { position: relative; }
.hd-shine {
  position: absolute; top: 0; bottom: 0; left: 0; width: 40%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent);
  animation: hd-shine 2.6s ease-in-out infinite;
}
@keyframes hd-shine { 0% { transform: translateX(-120%) skewX(-20deg); } 60%,100% { transform: translateX(260%) skewX(-20deg); } }
@media (prefers-reduced-motion: reduce) {
  .hd-shine { animation: none; display: none; }
  .hd-btn:active { transform: none; }
  .hd-bar-fill { transition: none; }
}
</style>
