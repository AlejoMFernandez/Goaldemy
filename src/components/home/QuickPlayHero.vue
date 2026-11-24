<script setup>
/**
 * JUGAR RÁPIDO — héroe de la home logueada (moodboard 10 v2).
 * Muestra el PÓSTER real del próximo desafío (GamePoster) y el botón dorado que
 * lo arranca directo (services/quick-play.js). La jornada (14 pósters con ✓/✕)
 * va debajo, en la home. Con todo jugado queda un cartel chico con la cuenta regresiva.
 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { tapHaptic } from '../shell/shell-state'
import HubState from '../shell/HubState.vue'
import GamePoster from '../game/GamePoster.vue'
import { GAME_POSTER_META } from '../../services/game-art'

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
  <div class="qp-card relative overflow-hidden rounded-2xl border p-3 sm:p-4" :class="done ? 'is-done border-emerald-400/30' : 'border-white/[0.07]'">

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
      <div class="relative flex items-center gap-3">
        <span class="w-12 h-12 shrink-0 grid place-items-center rounded-full bg-emerald-500 text-white">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
        </span>
        <div class="min-w-0">
          <div class="font-shout font-extrabold text-xl leading-none text-white uppercase">Jugaste los {{ data.total }} de hoy</div>
          <div class="text-[12px] text-slate-300 mt-1">{{ data.won }} ganados · nuevos en <span class="font-bold text-amber-200 tabular-nums">{{ countdown }}</span></div>
        </div>
      </div>
    </template>
  </div>
</template>
<style scoped>
.qp-card { background: #111a2e; }
.qp-card.is-done { background: linear-gradient(135deg, rgba(34,197,94,.16), #111a2e 60%); }
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

@media (prefers-reduced-motion: reduce) {
  .qp-btn, .qp-trophy { animation: none; }
}
</style>
