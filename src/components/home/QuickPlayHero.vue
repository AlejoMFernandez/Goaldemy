<script setup>
/**
 * JUGAR RÁPIDO — héroe de la home logueada.
 * Un solo botón gigante dorado que arranca directo el próximo desafío diario
 * disponible (services/quick-play.js). Debajo, la jornada de hoy: una pelota
 * por juego (verde ganado · roja perdido · vacía pendiente).
 * Si ya jugó todo: "¡Jornada completa!" + cuenta regresiva al reinicio (00:00)
 * y link a la jornada (/play/points).
 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { tapHaptic } from '../shell/shell-state'
import HubState from '../shell/HubState.vue'

const props = defineProps({
  level: { type: Number, default: 1 },
})
const emit = defineEmits(['loaded'])

const router = useRouter()
const loading = ref(true)
const error = ref(false)
const data = ref(null) // { next, total, played, won, resetAt }
const now = ref(Date.now())
let fmt = null
let timer = null

async function load() {
  loading.value = true
  error.value = false
  try {
    // Import diferido: game-modes arrastra un grafo pesado que no va en el chunk inicial.
    const mod = await import('../../services/quick-play')
    fmt = mod.formatCountdown
    data.value = await mod.getNextQuickPlay({ level: props.level })
    emit('loaded', data.value)
  } catch (e) {
    console.warn('[QuickPlay] load error', e)
    error.value = true
  } finally {
    loading.value = false
  }
}

const done = computed(() => !!data.value && !data.value.next)
const lost = computed(() => Math.max(0, (data.value?.played || 0) - (data.value?.won || 0)))
const balls = computed(() => {
  const d = data.value
  if (!d) return []
  return Array.from({ length: d.total }, (_, i) => (i < d.won ? 'win' : i < d.won + lost.value ? 'loss' : 'todo'))
})
const countdown = computed(() => (data.value?.resetAt && fmt) ? fmt(data.value.resetAt, now.value) : '')

function play() {
  if (!data.value?.next) return
  tapHaptic(12)
  router.push(data.value.next.to)
}

onMounted(() => {
  load()
  timer = setInterval(() => {
    now.value = Date.now()
    // Pasó la medianoche con la pantalla abierta → nueva jornada.
    if (data.value?.resetAt && now.value >= new Date(data.value.resetAt).getTime()) load()
  }, 1000)
})
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <div class="qp-card relative overflow-hidden rounded-3xl border border-amber-400/25 p-5 sm:p-6">
    <div class="qp-rays pointer-events-none absolute inset-0" aria-hidden="true"></div>

    <HubState v-if="loading" loading :rows="1" />
    <HubState v-else-if="error" error message="No pudimos armar tu jornada." @retry="load" />

    <template v-else-if="!done">
      <div class="relative text-center">
        <div class="text-[11px] font-bold uppercase tracking-[0.22em] text-amber-200/80">Desafío del día</div>
        <div class="mt-1 font-display text-lg font-bold text-white truncate">{{ data.next.name }}</div>
      </div>
      <button type="button" class="qp-btn relative mt-4 w-full" aria-label="Jugar rápido: arrancar el próximo desafío" @click="play">
        <span class="qp-btn-face">
          <svg class="w-7 h-7" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15a1 1 0 001.5.86l12.5-7.5a1 1 0 000-1.72L8.5 3.64A1 1 0 007 4.5z"/></svg>
          JUGAR RÁPIDO
        </span>
      </button>
    </template>

    <template v-else>
      <div class="relative text-center py-2">
        <div class="qp-trophy mx-auto w-14 h-14 grid place-items-center rounded-full bg-amber-400/15 border border-amber-300/40 text-amber-300">
          <svg viewBox="0 0 24 24" fill="currentColor" class="w-7 h-7"><path d="M5 3h14l-1.5 5H20a1 1 0 011 1v1a5 5 0 01-3.5 4.77V16a1 1 0 01-1 1h-1.1l.6 3H8l.6-3H7.5a1 1 0 01-1-1v-1.23A5 5 0 013 10V9a1 1 0 011-1h2.5L5 3z"/></svg>
        </div>
        <div class="mt-3 font-display text-2xl font-bold text-white">¡Jornada completa!</div>
        <p class="text-slate-300 text-sm mt-1">Nuevos desafíos en <span class="font-bold text-amber-200 tabular-nums">{{ countdown }}</span></p>
        <RouterLink to="/play/points" class="mt-4 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-amber-400/40 bg-amber-500/10 px-5 text-sm font-bold text-amber-100 active:scale-95 transition">
          Ver la jornada
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4"><path d="M9 6l6 6-6 6"/></svg>
        </RouterLink>
      </div>
    </template>

    <!-- Jornada de hoy -->
    <RouterLink v-if="!loading && !error && data?.total" to="/play/points" class="relative mt-5 block" aria-label="Ver la jornada de hoy">
      <div class="flex items-center justify-between text-[11.5px] font-semibold">
        <span class="text-slate-300">Jornada de hoy</span>
        <span class="text-slate-400 tabular-nums"><span class="text-white font-bold">{{ data.played }}</span>/{{ data.total }} jugados · <span class="text-emerald-300">{{ data.won }} ganados</span></span>
      </div>
      <div class="mt-2 flex flex-wrap gap-1.5" aria-hidden="true">
        <i v-for="(b, i) in balls" :key="i" class="qp-ball" :class="'is-' + b"></i>
      </div>
    </RouterLink>
  </div>
</template>

<style scoped>
.qp-card {
  background:
    radial-gradient(120% 80% at 50% 0%, rgba(251,191,36,.18), transparent 60%),
    linear-gradient(180deg, #111a2e, #0b1220);
  box-shadow: 0 18px 40px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.05);
}
.qp-rays {
  background: repeating-conic-gradient(from 0deg at 50% 38%, rgba(251,191,36,.06) 0deg 8deg, transparent 8deg 20deg);
  mask-image: radial-gradient(circle at 50% 38%, #000 0%, transparent 65%);
  -webkit-mask-image: radial-gradient(circle at 50% 38%, #000 0%, transparent 65%);
  animation: qp-spin 40s linear infinite;
}
@keyframes qp-spin { to { transform: rotate(360deg); } }

/* Botón gigante dorado con "cara" 3D y latido */
.qp-btn { display: block; border-radius: 22px; padding-bottom: 6px; background: #92400e; -webkit-tap-highlight-color: transparent; animation: qp-pulse 1.8s ease-in-out infinite; }
.qp-btn-face {
  display: flex; align-items: center; justify-content: center; gap: 10px;
  min-height: 72px; border-radius: 22px;
  font-family: var(--font-display); font-weight: 900; font-size: 24px; letter-spacing: .04em; color: #1c1206;
  background: linear-gradient(180deg, #fff3b0 0%, #fcd34d 38%, #f59e0b 100%);
  box-shadow: inset 0 2px 0 rgba(255,255,255,.7), inset 0 -3px 0 rgba(180,83,9,.35);
  transform: translateY(-6px);
  transition: transform .09s ease;
  text-shadow: 0 1px 0 rgba(255,255,255,.4);
}
.qp-btn:active .qp-btn-face { transform: translateY(-1px); }
@keyframes qp-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(251,191,36,.0), 0 10px 26px rgba(245,158,11,.35); transform: scale(1); }
  50% { box-shadow: 0 0 0 8px rgba(251,191,36,.12), 0 12px 34px rgba(245,158,11,.55); transform: scale(1.02); }
}
.qp-trophy { animation: qp-bob 2.4s ease-in-out infinite; }
@keyframes qp-bob { 50% { transform: translateY(-4px); } }

.qp-ball { width: 16px; height: 16px; border-radius: 9999px; display: block; border: 2px solid rgba(255,255,255,.15); background: rgba(255,255,255,.04); }
.qp-ball.is-win { background: radial-gradient(circle at 35% 30%, #a7f3d0, #10b981); border-color: #34d399; box-shadow: 0 0 8px rgba(16,185,129,.5); }
.qp-ball.is-loss { background: radial-gradient(circle at 35% 30%, #fecaca, #ef4444); border-color: #f87171; }

@media (prefers-reduced-motion: reduce) {
  .qp-rays, .qp-btn, .qp-trophy { animation: none; }
}
</style>
