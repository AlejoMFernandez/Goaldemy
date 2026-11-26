<script setup>
/**
 * Segmento "Misiones" del hub de Pase (diseño V4 Misiones, aprobado):
 *  1. Desafío FULVO del mes — solo si hay un reto progresivo activo (el más grande).
 *  2. Misiones del día — retos diarios reales, con "SE RENUEVAN EN X H" (hora Argentina).
 *  3. En curso — el resto de los retos progresivos (no existen misiones semanales
 *     en el servidor; propuesta en supabase/pendientes/2026-11-25-misiones-semanales.sql).
 * No reclama nada por su cuenta: emite y el padre usa los services de siempre.
 */
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import MissionRow from './MissionRow.vue'
import MonthlyChallengeCard from './MonthlyChallengeCard.vue'
import { normalizeDaily, normalizeProgressive, sortMissions, pickMonthly } from './missions'
import { msUntilAppMidnight } from '../../services/app-date'

const props = defineProps({
  challenges: { type: Array, default: () => [] },
  progressive: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  claiming: { type: String, default: null },
})
const emit = defineEmits(['claim-daily', 'claim-progressive'])

const daily = computed(() => sortMissions(props.challenges.map(normalizeDaily)))
const allDone = computed(() => daily.value.length > 0 && daily.value.every(m => m.state === 'done'))

const monthlyRaw = computed(() => pickMonthly(props.progressive))
const monthly = computed(() => monthlyRaw.value ? normalizeProgressive(monthlyRaw.value) : null)
const ongoing = computed(() => sortMissions(
  props.progressive.filter(c => c !== monthlyRaw.value).map(normalizeProgressive)
))

// Reloj "se renuevan en X h" — se refresca cada minuto
const msLeft = ref(msUntilAppMidnight())
let timer = null
onMounted(() => { timer = setInterval(() => { msLeft.value = msUntilAppMidnight() }, 60_000) })
onBeforeUnmount(() => clearInterval(timer))
const renewLabel = computed(() => {
  const mins = Math.max(1, Math.ceil(msLeft.value / 60_000))
  if (mins < 60) return `SE RENUEVAN EN ${mins} MIN`
  return `SE RENUEVAN EN ${Math.floor(mins / 60)} H`
})

function busyDaily(m) { return props.claiming === m.code }
function busyProg(m) { return props.claiming === 'prog_' + m.code }
</script>

<template>
  <div class="mp">
    <!-- 1 · Desafío del mes -->
    <div v-if="loading" class="mp-skel h-[168px] rounded-[20px]"></div>
    <MonthlyChallengeCard v-else-if="monthly" :mission="monthly" :busy="busyProg(monthly)"
      @claim="(ev) => emit('claim-progressive', monthly.raw, ev)" />

    <!-- 2 · Misiones del día -->
    <div class="mp-head">
      <h2 class="mp-h">Misiones del día</h2>
      <span class="mp-clock">{{ renewLabel }}</span>
    </div>

    <div v-if="loading" class="mp-list">
      <div v-for="i in 4" :key="i" class="mp-skel h-[68px] border-b border-white/5"></div>
    </div>
    <template v-else-if="daily.length">
      <TransitionGroup tag="div" name="mp-move" class="mp-list">
        <MissionRow v-for="m in daily" :key="m.key" :mission="m" :busy="busyDaily(m)"
          @claim="(ev) => emit('claim-daily', m.raw, ev)" />
      </TransitionGroup>
      <p v-if="allDone" class="mp-done">¡Cobraste todas las de hoy! Mañana hay misiones nuevas.</p>
    </template>
    <div v-else class="mp-empty">Hoy no hay misiones del día. Jugá una partida y volvé a mirar.</div>

    <!-- 3 · En curso (retos progresivos) -->
    <template v-if="!loading && ongoing.length">
      <div class="mp-head mt-1">
        <h2 class="mp-h">En curso</h2>
        <span class="mp-clock is-muted">SUBEN DE NIVEL</span>
      </div>
      <TransitionGroup tag="div" name="mp-move" class="mp-list">
        <MissionRow v-for="m in ongoing" :key="m.key" :mission="m" :busy="busyProg(m)"
          @claim="(ev) => emit('claim-progressive', m.raw, ev)" />
      </TransitionGroup>
      <p class="mp-note">Al cobrar, la misión sube de nivel: más difícil y con más premio.</p>
    </template>
  </div>
</template>

<style scoped>
.mp { display: flex; flex-direction: column; gap: 12px; }
.mp-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; padding: 0 2px; }
.mp-h { margin: 0; font-family: var(--font-display); font-weight: 700; font-size: 20px; color: #f1f5f9; }
.mp-clock { font-family: var(--font-bug); font-weight: 800; font-size: 12.5px; flex-shrink: 0; color: #fbbf24; white-space: nowrap; }
.mp-clock.is-muted { color: #94a3b8; }
.mp-list { border-radius: 18px; border: 1px solid rgba(255,255,255,0.1); overflow: hidden; background: rgba(255,255,255,0.015); }
.mp-done, .mp-note { margin: 0; padding: 0 4px; font-size: 12px; color: #94a3b8; }
.mp-done { color: #86efac; font-weight: 600; }
.mp-empty { border-radius: 18px; border: 1px solid rgba(255,255,255,0.1); padding: 24px 16px; text-align: center; font-size: 14px; color: #94a3b8; }
.mp-skel { background: rgba(255,255,255,0.05); animation: mp-pulse 1.4s ease-in-out infinite; }
@keyframes mp-pulse { 50% { opacity: .55; } }
.mp-move-move { transition: transform .35s cubic-bezier(.22,1,.36,1); }
@media (prefers-reduced-motion: reduce) {
  .mp-skel { animation: none; }
  .mp-move-move { transition: none; }
}
</style>
