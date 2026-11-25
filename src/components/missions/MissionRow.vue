<script setup>
/**
 * Fila de misión (diseño V4 Misiones): ícono · título + barra "1 / 2" · premio
 * a la derecha, o COBRAR (verde con borde inferior) cuando está completa.
 * Estados: 'progress' | 'claim' | 'done' (tachada, premio en gris).
 * Recibe una misión ya normalizada (ver missions.js). Emite `claim` con el evento
 * para que la recompensa pueda volar desde el botón.
 */
import { computed } from 'vue'
import PowerupIcon from '../rewards/PowerupIcon.vue'
import { powerupLabel } from '../../services/rewards'

const props = defineProps({
  mission: { type: Object, required: true },
  busy: { type: Boolean, default: false },
  compact: { type: Boolean, default: false },
})
const emit = defineEmits(['claim'])

const m = computed(() => props.mission)
const full = computed(() => m.value.progress >= m.value.target)
const pct = computed(() => Math.round(100 * Math.min(m.value.progress, m.value.target) / m.value.target) + '%')
const barFill = computed(() => full.value ? 'linear-gradient(90deg,#fbbf24,#fde68a)' : m.value.bar)
const rewardLabel = computed(() => {
  const parts = []
  if (m.value.xp > 0) parts.push(`${m.value.xp} XP`)
  if (m.value.powerup && m.value.powerupQty > 0) parts.push(`${powerupLabel(m.value.powerup)} ×${m.value.powerupQty}`)
  return parts.join(' y ')
})
</script>

<template>
  <div class="mrow" :class="['is-' + m.state, { 'is-compact': compact }]">
    <span class="mrow-ic" :style="{ background: m.iconBg }" aria-hidden="true">{{ m.icon }}</span>

    <span class="mrow-body">
      <span class="mrow-title">
        {{ m.title }}
        <span v-if="m.kind === 'progressive'" class="mrow-tier">Nv {{ m.tier }}</span>
      </span>
      <span class="mrow-bar" role="progressbar" :aria-valuenow="m.progress" aria-valuemin="0" :aria-valuemax="m.target" :aria-label="`${m.title}: ${m.progress} de ${m.target}`">
        <span class="mrow-fill" :style="{ width: pct, background: barFill }"></span>
        <span class="mrow-count" :class="{ 'is-full': full }">{{ m.progress }} / {{ m.target }}</span>
      </span>
    </span>

    <button v-if="m.state === 'claim'" type="button" class="mrow-claim" :disabled="busy"
            :aria-label="`Cobrar ${rewardLabel}`" @click="emit('claim', $event)">
      COBRAR
    </button>
    <span v-else class="mrow-prize" :aria-label="`Premio: ${rewardLabel}`">
      <PowerupIcon v-if="m.powerup && m.powerupQty > 0" :type="m.powerup" :size="22" />
      <span v-if="m.xp > 0" class="mrow-xp">+{{ m.xp }}<small>XP</small></span>
      <span v-else-if="m.powerup && m.powerupQty > 0" class="mrow-xp">×{{ m.powerupQty }}</span>
    </span>
  </div>
</template>

<style scoped>
.mrow {
  display: flex; align-items: center; gap: 12px; padding: 12px 14px;
  border-bottom: 1px solid rgba(255,255,255,0.07); transition: background-color .3s ease;
}
.mrow:last-child { border-bottom: 0; }
.mrow.is-claim { background: rgba(34,197,94,0.1); }
.mrow-ic {
  width: 44px; height: 44px; flex-shrink: 0; border-radius: 12px;
  display: grid; place-items: center; font-size: 24px; line-height: 1;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.18);
}
.is-done .mrow-ic { filter: grayscale(.85) brightness(.7); }
.mrow-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.mrow-title {
  display: flex; align-items: center; gap: 6px; min-width: 0;
  font-weight: 700; font-size: 14px; color: #f1f5f9; line-height: 1.2;
}
.is-done .mrow-title { text-decoration: line-through; color: #64748b; }
.mrow-tier {
  flex-shrink: 0; padding: 1px 6px; border-radius: 999px; background: rgba(251,191,36,.14);
  color: #fcd34d; font-family: var(--font-bug); font-weight: 800; font-size: 11px; letter-spacing: .02em;
  text-decoration: none;
}
.mrow-bar {
  position: relative; display: block; height: 16px; border-radius: 999px;
  background: rgba(255,255,255,0.08); overflow: hidden;
}
.mrow-fill { display: block; height: 100%; border-radius: 999px; transition: width .6s cubic-bezier(.22,1,.36,1); }
.is-done .mrow-fill { filter: grayscale(1) brightness(.6); }
.mrow-count {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  font-family: var(--font-bug); font-weight: 800; font-size: 12px; color: #fff; font-variant-numeric: tabular-nums;
}
.mrow-count.is-full { color: #451a03; }
.is-done .mrow-count { color: #cbd5e1; }

.mrow-prize {
  width: 56px; flex-shrink: 0; display: flex; flex-direction: column; align-items: center; gap: 2px;
  font-family: var(--font-bug); font-weight: 800; font-size: 14px; color: #fcd34d; text-align: center;
}
.mrow-xp small { font-size: 10px; margin-left: 1px; opacity: .85; }
.is-done .mrow-prize { filter: grayscale(1) brightness(.6); }

.mrow-claim {
  min-height: 44px; min-width: 76px; padding: 0 14px; border: 0; border-radius: 12px;
  background: #22c55e; box-shadow: 0 4px 0 #15803d; color: #fff;
  font-family: var(--font-bug); font-weight: 800; font-size: 17px; letter-spacing: .02em; cursor: pointer;
  transform: translateY(-2px); transition: transform .08s ease, box-shadow .08s ease, filter .15s ease;
  animation: mrow-pulse 1.8s ease-in-out infinite;
}
.mrow-claim:active { transform: translateY(2px); box-shadow: 0 0 0 #15803d; }
.mrow-claim:disabled { filter: saturate(.5) brightness(.85); animation: none; }
.mrow-claim:focus-visible { outline: 2px solid #bbf7d0; outline-offset: 2px; }
@keyframes mrow-pulse { 0%,100% { filter: brightness(1); } 50% { filter: brightness(1.15); } }

.is-compact { padding: 10px 12px; }

@media (prefers-reduced-motion: reduce) {
  .mrow-fill, .mrow { transition: none; }
  .mrow-claim { animation: none; transition: none; }
}
</style>
