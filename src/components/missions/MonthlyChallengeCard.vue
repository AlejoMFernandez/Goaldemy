<script setup>
/**
 * "Desafío FULVO del mes" (diseño V4 Misiones, bloque índigo de arriba).
 * Hoy no hay desafíos mensuales en el servidor: se alimenta con el reto
 * progresivo activo más grande (ver pickMonthly). No muestra cuenta regresiva
 * porque ese reto no vence a fin de mes — sería un dato inventado.
 */
import { computed } from 'vue'
import PowerupIcon from '../rewards/PowerupIcon.vue'
import { BALL_SVG } from '../../services/game-art'
import { appMonthName } from './missions'

const props = defineProps({
  mission: { type: Object, required: true }, // misión normalizada (kind progressive)
  busy: { type: Boolean, default: false },
})
const emit = defineEmits(['claim'])

const month = computed(() => appMonthName())
const pct = computed(() => Math.round(100 * Math.min(props.mission.progress, props.mission.target) / props.mission.target) + '%')
const full = computed(() => props.mission.progress >= props.mission.target)
</script>

<template>
  <section class="mcard" aria-label="Desafío FULVO del mes">
    <span class="mcard-ball" aria-hidden="true" v-html="BALL_SVG"></span>
    <span v-if="month" class="mcard-chip">{{ month.toUpperCase() }}</span>
    <h2 class="mcard-title">Desafío FULVO de {{ month }}</h2>
    <p class="mcard-sub">
      <span aria-hidden="true">{{ mission.icon }}</span> {{ mission.title }} · Nivel {{ mission.tier }}
      <span v-if="mission.description" class="block font-semibold opacity-80">{{ mission.description }}</span>
    </p>

    <div class="mcard-track">
      <span class="mcard-bar" role="progressbar" :aria-valuenow="mission.progress" aria-valuemin="0" :aria-valuemax="mission.target">
        <span class="mcard-fill" :style="{ width: pct }" :class="{ 'is-full': full }"></span>
        <span class="mcard-count">{{ mission.progress }} / {{ mission.target }}</span>
      </span>

      <button v-if="mission.state === 'claim'" type="button" class="mcard-claim" :disabled="busy" @click="emit('claim', $event)">
        COBRAR
      </button>
      <span v-else class="mcard-prize" :aria-label="`Premio: ${mission.xp} XP${mission.powerup ? ' y power-up' : ''}`">
        <PowerupIcon v-if="mission.powerup && mission.powerupQty > 0" :type="mission.powerup" :size="22" />
        <span v-else class="mcard-xp">+{{ mission.xp }}<small>XP</small></span>
      </span>
    </div>
    <p v-if="mission.powerup && mission.powerupQty > 0 && mission.state !== 'claim'" class="mcard-foot">+{{ mission.xp }} XP y un power-up al completarlo</p>
  </section>
</template>

<style scoped>
.mcard {
  position: relative; overflow: hidden; border-radius: 20px; padding: 18px 16px 16px;
  background: linear-gradient(160deg, #4338ca 0%, #312e81 60%, #1e1b4b 100%);
  box-shadow: 0 10px 30px rgba(49,46,129,.35);
}
.mcard-ball {
  position: absolute; right: -24px; top: -14px; width: 150px; height: 150px; opacity: .18;
  transform: rotate(18deg); pointer-events: none; animation: mcard-spin 40s linear infinite;
}
.mcard-ball :deep(svg) { width: 100%; height: 100%; }
@keyframes mcard-spin { from { transform: rotate(18deg); } to { transform: rotate(378deg); } }
.mcard-chip {
  display: inline-block; padding: 4px 10px; border-radius: 8px; background: #fff; color: #3730a3;
  font-family: var(--font-bug); font-weight: 800; font-size: 14px; letter-spacing: 1px;
}
.mcard-title {
  position: relative; margin: 8px 0 0; max-width: 260px;
  font-family: var(--font-display); font-weight: 700; font-size: 22px; line-height: 1.15; color: #fff;
}
.mcard-sub { position: relative; margin: 4px 0 0; font-size: 12px; font-weight: 700; color: #c7d2fe; }
.mcard-track {
  position: relative; margin-top: 14px; border-radius: 16px; background: rgba(2,6,23,.55);
  padding: 12px; display: flex; align-items: center; gap: 10px;
}
.mcard-bar { position: relative; flex: 1; height: 18px; border-radius: 999px; background: rgba(255,255,255,.12); overflow: hidden; display: block; }
.mcard-fill { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, #818cf8, #a5b4fc); transition: width .7s cubic-bezier(.22,1,.36,1); }
.mcard-fill.is-full { background: linear-gradient(90deg, #fbbf24, #fde68a); }
.mcard-count {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  font-family: var(--font-bug); font-weight: 800; font-size: 14px; color: #fff; font-variant-numeric: tabular-nums;
  text-shadow: 0 1px 2px rgba(0,0,0,.4);
}
.mcard-prize {
  width: 46px; height: 46px; flex-shrink: 0; border-radius: 50%;
  background: radial-gradient(circle at 50% 35%, #a5b4fc, #4f46e5); border: 3px solid #c7d2fe;
  display: grid; place-items: center; color: #fff;
}
.mcard-xp { font-family: var(--font-bug); font-weight: 800; font-size: 13px; line-height: 1; text-align: center; }
.mcard-xp small { display: block; font-size: 9px; opacity: .85; }
.mcard-foot { position: relative; margin: 8px 0 0; font-size: 11px; color: #a5b4fc; }
.mcard-claim {
  min-height: 44px; padding: 0 14px; border: 0; border-radius: 12px; background: #22c55e; box-shadow: 0 4px 0 #15803d;
  color: #fff; font-family: var(--font-bug); font-weight: 800; font-size: 17px; cursor: pointer; transform: translateY(-2px);
  transition: transform .08s ease, box-shadow .08s ease;
}
.mcard-claim:active { transform: translateY(2px); box-shadow: 0 0 0 #15803d; }
.mcard-claim:disabled { filter: saturate(.5) brightness(.85); }
@media (prefers-reduced-motion: reduce) {
  .mcard-ball { animation: none; }
  .mcard-fill, .mcard-claim { transition: none; }
}
</style>
