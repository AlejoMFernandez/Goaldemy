<script setup>
/**
 * RETO DEL DÍA — página pública /reto (sin login)
 *
 * Funnel de marketing: cualquiera juega el reto del día sin cuenta. Al terminar ve una
 * pantalla de recompensas GRÁFICA (XP, Fichas, precisión, racha, progreso de nivel) que
 * "ganó" pero que SOLO puede reclamar creando una cuenta → el botón "Reclamar" abre el
 * muro de registro. Aversión a la pérdida: le mostramos el premio y después el candado.
 */
import { reactive, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { getTodaysReto, getRetoResult, saveRetoResult, computeRetoRewards, setPendingRetoClaim, RETO_SHARE_NAME } from '../services/daily-reto'
import { buildShareText, shareOrCopy } from '../services/share'

const state = reactive({
  phase: 'loading',      // loading | intro | playing | result
  game: null,
  questions: [],
  total: 0,
  index: 0,
  corrects: 0,
  maxStreak: 0,
  _streak: 0,
  answers: [],
  selected: null,
  locked: false,
  imgError: false,
  shareMsg: '',
  claimGate: false,      // muro de registro (tras tocar "Reclamar")
  // Valores animados (count-up) para la pantalla de recompensas
  animXp: 0,
  animFichas: 0,
  animBar: 0,
})

const current = computed(() => state.questions[state.index] || null)
const accuracy = computed(() => state.total ? Math.round((state.corrects / state.total) * 100) : 0)
const won = computed(() => state.corrects >= Math.ceil(state.total * 0.6))
const progressPct = computed(() => state.total ? Math.round((state.index / state.total) * 100) : 0)
const rewards = computed(() => computeRetoRewards(state.corrects, state.total))

onMounted(async () => {
  try {
    const reto = await getTodaysReto()
    state.game = reto.game
    state.questions = reto.questions
    state.total = reto.total
    const saved = getRetoResult(reto.dayKey)
    if (saved && saved.total) {
      state.corrects = saved.corrects || 0
      state.total = saved.total
      state.maxStreak = saved.maxStreak || 0
      state.answers = Array.isArray(saved.answers) ? saved.answers : []
      state.game = { ...state.game, label: saved.gameLabel || state.game.label }
      enterResult()
    } else {
      state.phase = 'intro'
    }
  } catch (e) {
    console.error('[reto] load error:', e)
    state.phase = 'intro'
  }
})

function start() {
  Object.assign(state, {
    phase: 'playing', index: 0, corrects: 0, maxStreak: 0, _streak: 0,
    answers: [], selected: null, locked: false, imgError: false, claimGate: false,
  })
}

function answer(opt) {
  if (state.locked) return
  state.locked = true
  state.selected = opt
  const ok = opt === current.value.correct
  state.answers.push(ok)
  if (ok) {
    state.corrects++
    state._streak++
    if (state._streak > state.maxStreak) state.maxStreak = state._streak
  } else {
    state._streak = 0
  }
  setTimeout(next, 950)
}

function next() {
  if (state.index + 1 >= state.total) {
    saveRetoResult({
      corrects: state.corrects, total: state.total, maxStreak: state.maxStreak,
      answers: state.answers.slice(), gameLabel: state.game?.label || '',
    })
    enterResult()
  } else {
    state.index++
    state.selected = null
    state.locked = false
    state.imgError = false
  }
}

// Entra a la pantalla de resultado y anima los contadores de recompensas
function enterResult() {
  state.phase = 'result'
  // Dejar el reclamo pendiente: al crear cuenta (o loguearse) se otorga de verdad
  setPendingRetoClaim(state.corrects, state.total)
  const r = computeRetoRewards(state.corrects, state.total)
  animateTo(r.xp, v => { state.animXp = v })
  animateTo(r.fichas, v => { state.animFichas = v })
  animateTo(r.pct, v => { state.animBar = v }, 1100)
}

function animateTo(target, setter, ms = 900) {
  const start = performance.now()
  function step(now) {
    const t = Math.min((now - start) / ms, 1)
    const e = 1 - Math.pow(1 - t, 3)
    setter(Math.round(target * e))
    if (t < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

async function share() {
  const text = buildShareText({
    gameName: RETO_SHARE_NAME, corrects: state.corrects, total: state.total,
    accuracy: accuracy.value, maxStreak: state.maxStreak, won: won.value,
  })
  const r = await shareOrCopy(text)
  if (r === 'copied') { state.shareMsg = '¡Copiado! Pegalo donde quieras'; setTimeout(() => state.shareMsg = '', 2400) }
  else if (r === 'shared') { state.shareMsg = '¡Gracias por compartir! 🙌'; setTimeout(() => state.shareMsg = '', 2400) }
}

function optionClass(opt) {
  if (!state.locked) return 'border-white/10 bg-white/[0.04] hover:border-cyan-400/40 hover:bg-white/[0.07] active:scale-[0.98]'
  if (opt === current.value.correct) return 'border-emerald-400/50 bg-emerald-500/15 text-emerald-300'
  if (opt === state.selected) return 'border-red-400/50 bg-red-500/15 text-red-300'
  return 'border-white/10 bg-white/[0.02] opacity-50'
}
</script>

<template>
  <section class="mx-auto max-w-lg px-1">

    <!-- LOADING -->
    <div v-if="state.phase === 'loading'" class="flex flex-col items-center justify-center py-24 gap-4">
      <div class="h-10 w-10 rounded-full border-4 border-cyan-400/30 border-t-cyan-400 animate-spin"></div>
      <span class="text-slate-400 text-sm">Preparando el reto de hoy…</span>
    </div>

    <!-- INTRO -->
    <div v-else-if="state.phase === 'intro'" class="text-center py-8">
      <div class="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-cyan-300 mb-5">
        <span class="relative flex h-2 w-2">
          <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75"></span>
          <span class="relative inline-flex h-2 w-2 rounded-full bg-cyan-400"></span>
        </span>
        Reto del día
      </div>
      <h1 class="font-display text-4xl md:text-5xl font-extrabold text-white leading-tight mb-3">{{ state.game?.label }}</h1>
      <p class="text-slate-300 text-base mb-1">{{ state.total }} preguntas · sin cuenta · un intento por día</p>
      <p class="text-slate-500 text-sm mb-8">Todos juegan <strong class="text-slate-300">el mismo reto</strong> hoy. ¿Cuánto sacás?</p>
      <button @click="start" class="w-full max-w-xs mx-auto rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110 text-white py-4 text-lg font-bold transition shadow-lg shadow-emerald-500/25 active:scale-[0.98]">
        Jugar ahora
      </button>
      <p class="text-slate-500 text-xs mt-6">¿Ya tenés cuenta? <RouterLink to="/login" class="text-cyan-400 hover:underline">Iniciá sesión</RouterLink></p>
    </div>

    <!-- PLAYING -->
    <div v-else-if="state.phase === 'playing' && current" class="py-4">
      <div class="flex items-center justify-between mb-3">
        <span class="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">{{ state.game?.label }}</span>
        <span class="font-display text-sm font-bold text-white">{{ state.index + 1 }}<span class="text-slate-500">/{{ state.total }}</span></span>
      </div>
      <div class="h-1.5 rounded-full bg-black/30 overflow-hidden mb-6">
        <div class="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all duration-300" :style="{ width: progressPct + '%' }"></div>
      </div>
      <div class="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 text-center mb-5 shadow-2xl">
        <div class="w-28 h-28 mx-auto mb-4 rounded-2xl overflow-hidden bg-slate-800/60 border border-white/10 grid place-items-center">
          <img v-if="current.player.image && !state.imgError" :src="current.player.image" :alt="current.player.name" class="w-full h-full object-cover" @error="state.imgError = true" />
          <span v-else class="font-display text-3xl font-bold text-slate-500">{{ (current.player.name || '?').slice(0,1) }}</span>
        </div>
        <h2 class="font-display text-2xl font-extrabold text-white leading-tight">{{ current.player.name }}</h2>
        <p v-if="current.player.teamName" class="text-slate-400 text-sm mt-0.5">{{ current.player.teamName }}</p>
        <p class="text-cyan-300/90 text-sm mt-3 font-semibold">{{ state.game?.prompt }}</p>
      </div>
      <div class="grid grid-cols-1 gap-2.5">
        <button v-for="opt in current.options" :key="opt" @click="answer(opt)" :disabled="state.locked"
          :class="['rounded-xl border py-3.5 px-4 text-left text-white font-semibold transition-all duration-200', optionClass(opt)]">
          {{ opt }}
        </button>
      </div>
    </div>

    <!-- RESULT -->
    <div v-else-if="state.phase === 'result'" class="py-6">
      <div class="rounded-2xl border border-white/15 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden shadow-2xl">
        <!-- Banner -->
        <div :class="['px-5 py-4 text-center border-b', won ? 'bg-gradient-to-r from-emerald-500/15 to-cyan-500/10 border-emerald-500/25' : 'bg-gradient-to-r from-amber-500/15 to-orange-500/10 border-amber-500/25']">
          <p class="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Reto del día · {{ state.game?.label }}</p>
          <h2 :class="['font-display text-3xl font-extrabold', won ? 'text-emerald-400' : 'text-amber-400']">{{ won ? '¡Bien jugado!' : '¡Casi!' }}</h2>
          <div class="font-display text-lg font-bold text-white mt-1">{{ state.corrects }}<span class="text-slate-500">/{{ state.total }}</span></div>
          <div class="flex flex-wrap justify-center gap-1 mt-2">
            <span v-for="(ok, i) in state.answers" :key="i" class="text-base leading-none">{{ ok ? '🟩' : '⬛' }}</span>
          </div>
        </div>

        <div class="p-5 space-y-4">
          <!-- RECOMPENSAS (el gancho) -->
          <div class="flex items-center justify-between">
            <span class="text-[11px] uppercase tracking-wider text-amber-300 font-bold">Tus recompensas</span>
            <span class="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400">
              <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 118 0v4"/></svg>
              por reclamar
            </span>
          </div>

          <!-- XP + Fichas (grandes, con glow) -->
          <div class="grid grid-cols-2 gap-3">
            <div class="reward-card rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-center">
              <div class="text-[10px] uppercase tracking-wider text-emerald-300/80 mb-1">XP ganada</div>
              <div class="font-display text-3xl font-extrabold text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.35)]">+{{ state.animXp }}</div>
            </div>
            <div class="reward-card rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-center">
              <div class="text-[10px] uppercase tracking-wider text-amber-300/80 mb-1">Fichas</div>
              <div class="font-display text-3xl font-extrabold text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.35)]">
                <span class="mr-0.5">🪙</span>+{{ state.animFichas }}
              </div>
            </div>
          </div>

          <!-- Progreso de nivel (teaser) -->
          <div class="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <span class="text-xs text-slate-400">Nivel</span>
                <span class="font-display text-sm font-bold text-white">1</span>
                <svg class="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
                <span :class="['font-display text-sm font-bold', rewards.levelUp ? 'text-yellow-400' : 'text-slate-500']">2</span>
              </div>
              <span v-if="rewards.levelUp" class="text-[10px] font-bold text-yellow-400 bg-yellow-500/15 border border-yellow-500/25 rounded-full px-2 py-0.5">¡SUBÍS DE NIVEL!</span>
              <span v-else class="text-[10px] text-slate-500">faltan {{ rewards.remaining }} XP</span>
            </div>
            <div class="h-2.5 rounded-full bg-black/40 overflow-hidden">
              <div class="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400" :style="{ width: state.animBar + '%', transition: 'width 0.3s' }"></div>
            </div>
          </div>

          <!-- Precisión + Racha -->
          <div class="grid grid-cols-2 gap-3">
            <div class="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
              <div class="text-[10px] uppercase tracking-wider text-slate-400 mb-0.5">Precisión</div>
              <div class="font-display text-xl font-bold text-white">🎯 {{ accuracy }}%</div>
            </div>
            <div class="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
              <div class="text-[10px] uppercase tracking-wider text-slate-400 mb-0.5">Mejor racha</div>
              <div class="font-display text-xl font-bold text-white">🔥 x{{ state.maxStreak }}</div>
            </div>
          </div>

          <!-- MURO DE RECLAMO -->
          <template v-if="!state.claimGate">
            <button @click="state.claimGate = true"
              class="claim-btn w-full rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-900 py-4 text-base font-extrabold uppercase tracking-wide transition hover:brightness-105 active:scale-[0.98] shadow-lg shadow-amber-500/30 flex items-center justify-center gap-2">
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M5 3h14l-1.5 5H20a1 1 0 011 1v1a5 5 0 01-3.5 4.77V16a1 1 0 01-1 1h-1.1l.6 3H8l.6-3H7.5a1 1 0 01-1-1v-1.23A5 5 0 013 10V9a1 1 0 011-1h2.5L5 3z"/></svg>
              Reclamar mis recompensas
            </button>
          </template>

          <!-- Overlay del muro: mostramos el candado tras el clic -->
          <div v-else class="rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-500/10 to-slate-900/40 p-5 text-center gate-in">
            <div class="w-14 h-14 mx-auto mb-3 rounded-2xl bg-amber-500/15 border border-amber-400/30 grid place-items-center">
              <svg class="w-7 h-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 118 0v4"/></svg>
            </div>
            <h3 class="font-display text-xl font-extrabold text-white mb-1">Tus recompensas te esperan</h3>
            <p class="text-slate-300 text-sm mb-4">
              Creá tu cuenta gratis y reclamá
              <strong class="text-emerald-400">+{{ rewards.xp }} XP</strong>,
              <strong class="text-amber-400">{{ rewards.fichas }} Fichas</strong>
              y guardá tu racha para siempre.
            </p>
            <RouterLink to="/register" class="block w-full rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110 text-white py-3 text-sm font-bold transition shadow-lg shadow-emerald-500/25 mb-2">
              Crear cuenta gratis y reclamar
            </RouterLink>
            <RouterLink to="/login" class="block text-slate-400 hover:text-white text-xs">Ya tengo cuenta</RouterLink>
          </div>

          <!-- Compartir + volver mañana -->
          <button @click="share"
            :class="['w-full rounded-xl py-2.5 text-sm font-bold transition flex items-center justify-center gap-2', state.shareMsg ? 'bg-emerald-500/15 border border-emerald-400/40 text-emerald-300' : 'border border-white/15 text-slate-300 hover:bg-white/5']">
            <svg v-if="!state.shareMsg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
            {{ state.shareMsg || 'Compartir mi resultado' }}
          </button>
          <p class="text-center text-slate-500 text-xs">Volvé mañana por un reto nuevo ⚽</p>
        </div>
      </div>
    </div>

  </section>
</template>

<style scoped>
.reward-card { animation: reward-pop 0.5s var(--ease-bounce, cubic-bezier(0.34,1.56,0.64,1)) both; }
@keyframes reward-pop { from { opacity: 0; transform: scale(0.9) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
.claim-btn { animation: claim-glow 1.8s ease-in-out infinite; }
@keyframes claim-glow {
  0%, 100% { box-shadow: 0 8px 24px rgba(245,158,11,0.30); }
  50% { box-shadow: 0 8px 34px rgba(245,158,11,0.55); }
}
.gate-in { animation: gate-in 0.35s var(--ease-out-expo, cubic-bezier(0.16,1,0.3,1)) both; }
@keyframes gate-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
</style>
