<script setup>
/**
 * JUGAR RÁPIDO — héroe de la home logueada (moodboard 10 v2).
 * Muestra el PÓSTER real del próximo desafío (GamePoster) y el botón dorado que
 * lo arranca directo (services/quick-play.js). Debajo, la jornada de hoy con la
 * pelota de FULVO (BALL_SVG): pelota = ganado · pelota apagada = perdido ·
 * círculo punteado = pendiente.
 * Si ya jugó todo: "¡Jornada completa!" + cuenta regresiva al reinicio (00:00)
 * y link a la jornada (/play/points).
 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { tapHaptic } from '../shell/shell-state'
import HubState from '../shell/HubState.vue'
import GamePoster from '../game/GamePoster.vue'
import { BALL_SVG, GAME_POSTER_META } from '../../services/game-art'

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
const nextSub = computed(() => GAME_POSTER_META[data.value?.next?.slug]?.sub || '')
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
  <div class="qp-card relative overflow-hidden rounded-2xl border border-white/[0.07] p-3 sm:p-4">

    <HubState v-if="loading" loading :rows="1" />
    <HubState v-else-if="error" error message="No pudimos armar tu jornada." @retry="load" />

    <template v-else-if="!done">
      <div class="relative flex items-stretch gap-3">
        <GamePoster class="qp-poster" :slug="data.next.slug" :name="data.next.name" :sub="nextSub" />
        <div class="min-w-0 flex-1 flex flex-col justify-center gap-1.5">
          <div class="text-[11px] font-bold uppercase tracking-[0.14em] text-cyan-300">Te toca · {{ data.played + 1 }} de {{ data.total }}</div>
          <div class="font-display text-lg font-bold text-white leading-tight">{{ data.next.name }}</div>
          <div v-if="nextSub" class="text-[13px] text-slate-400">{{ nextSub }}</div>
        </div>
      </div>
      <button type="button" class="qp-btn relative mt-3 w-full" aria-label="Jugar rápido: arrancar el próximo desafío" @click="play">
        <span class="qp-btn-face">
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15a1 1 0 001.5.86l12.5-7.5a1 1 0 000-1.72L8.5 3.64A1 1 0 007 4.5z"/></svg>
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
      <div class="mt-2 qp-balls" aria-hidden="true">
        <span v-for="(b, i) in balls" :key="i" class="qp-ball" :class="'is-' + b" v-html="b === 'todo' ? '' : BALL_SVG"></span>
      </div>
    </RouterLink>
  </div>
</template>

<style scoped>
.qp-card { background: #111a2e; }
.qp-poster { width: 112px; flex: none; }

/* Botón dorado con "cara" 3D y un latido suave */
.qp-btn { display: block; border-radius: 16px; padding-bottom: 4px; background: #b45309; -webkit-tap-highlight-color: transparent; animation: qp-pulse 2s ease-in-out infinite; }
.qp-btn-face {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  min-height: 52px; border-radius: 16px;
  font-family: var(--font-shout); font-style: italic; font-weight: 800; font-size: 24px; letter-spacing: .04em; color: #1c1206;
  background: linear-gradient(180deg, #fcd34d 0%, #f59e0b 100%);
  box-shadow: inset 0 2px 0 rgba(255,255,255,.55);
  transform: translateY(-4px);
  transition: transform .09s ease;
}
.qp-btn:active .qp-btn-face { transform: translateY(-1px); }
@keyframes qp-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(251,191,36,.45); }
  50% { box-shadow: 0 0 0 8px rgba(251,191,36,0); }
}
.qp-trophy { animation: qp-bob 2.4s ease-in-out infinite; }
@keyframes qp-bob { 50% { transform: translateY(-4px); } }

.qp-balls { display: grid; grid-template-columns: repeat(auto-fill, minmax(18px, 1fr)); gap: 4px; max-width: 100%; }
.qp-ball { display: block; aspect-ratio: 1; border-radius: 9999px; }
.qp-ball :deep(svg) { width: 100%; height: 100%; display: block; }
.qp-ball.is-loss { filter: grayscale(1) brightness(.45); }
.qp-ball.is-todo { border: 1.5px dashed rgba(255,255,255,.2); }

@media (prefers-reduced-motion: reduce) {
  .qp-btn, .qp-trophy { animation: none; }
}
</style>
