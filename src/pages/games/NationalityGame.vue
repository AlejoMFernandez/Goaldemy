<script>
import AppH1 from '../../components/AppH1.vue';
import { initState, loadPlayers, nextRound, optionClass, pick, flag } from '../../services/nationality';
import { initScoring } from '../../services/scoring'
import { isChallengeAvailable, startChallengeSession, completeChallengeSession, fetchLifetimeMaxStreak } from '../../services/game-modes'
import { getUserLevel } from '../../services/xp'

export default {
  name: 'NationalityGame',
  components: { AppH1 },
  data() {
  return { 
    ...initState(), 
    ...initScoring(),
    mode: 'normal', // normal | free | challenge
    overlayOpen: false,
    chosenSeconds: 30,
    timeLeft: 0,
    timer: null,
    sessionId: null,
    timeOver: false,
    availability: { available: true, reason: null },
    showSummary: false,
    lifetimeMaxStreak: 0,
    // XP progress for summary
    levelBefore: null,
    levelAfter: null,
    xpBeforeTotal: 0,
    xpAfterTotal: 0,
    beforePercent: 0,
    afterPercent: 0,
    progressShown: 0,
    xpToNextAfter: null,
  };
  },
  mounted() {
    // Detect mode from query
    const mode = (this.$route.query.mode || '').toString().toLowerCase()
    if (mode === 'free') this.mode = 'free'
    else if (mode === 'challenge') this.mode = 'challenge'
    else this.mode = 'normal'

    // Free mode => no XP
    if (this.mode === 'free') this.allowXp = false

    loadPlayers(this);
    nextRound(this);

    // Challenge: show overlay and check availability
    if (this.mode === 'challenge') {
      this.overlayOpen = true
      this.checkAvailability()
    }
  },
  methods: {
    nextRound() { nextRound(this); },
    backPath() { return this.mode === 'free' ? '/play/free' : '/play/points' },
  pick(option) { if (this.timeOver) return; const ok = pick(this, option, this.$refs.confettiHost); setTimeout(() => this.nextRound(), 1000); },
    optionClass(opt) { return optionClass(this, opt) },
    flag(opt) { return flag(opt.code, 40) },
    async checkAvailability() {
      this.availability = await isChallengeAvailable('nationality')
    },
    async startChallenge() {
      if (!this.availability.available) return
      try {
        // capture XP/level before starting
        try {
          const { data } = await getUserLevel(null)
          const info = Array.isArray(data) ? data[0] : data
          this.levelBefore = info?.level ?? null
          this.xpBeforeTotal = info?.xp_total ?? 0
          const next = info?.next_level_xp || 0
          const toNext = info?.xp_to_next ?? 0
          const completed = next ? (next - toNext) : next
          this.beforePercent = next ? Math.max(0, Math.min(100, Math.round((completed / next) * 100))) : 100
        } catch {}
        this.sessionId = await startChallengeSession('nationality', 30)
        this.overlayOpen = false
        this.timeLeft = 30
        this.timeOver = false
        clearInterval(this.timer)
        this.timer = setInterval(() => {
          if (this.timeLeft > 0) this.timeLeft -= 1
          if (this.timeLeft <= 0) {
            this.timeOver = true
            clearInterval(this.timer)
            // Complete session with score/xp and store run metadata
            completeChallengeSession(this.sessionId, this.score, this.xpEarned, { maxStreak: this.maxStreak }).catch(()=>{})
            ;(async () => {
              try {
                const { data } = await getUserLevel(null)
                const info = Array.isArray(data) ? data[0] : data
                this.levelAfter = info?.level ?? null
                this.xpAfterTotal = info?.xp_total ?? 0
                const next = info?.next_level_xp || 0
                const toNext = info?.xp_to_next ?? 0
                const completed = next ? (next - toNext) : next
                this.afterPercent = next ? Math.max(0, Math.min(100, Math.round((completed / next) * 100))) : 100
                this.xpToNextAfter = toNext ?? null
              } catch {}
              this.progressShown = this.beforePercent
              this.showSummary = true
              requestAnimationFrame(() => setTimeout(() => { this.progressShown = this.afterPercent }, 40))
            })()
            fetchLifetimeMaxStreak('nationality').then(v => this.lifetimeMaxStreak = Math.max(v || 0, this.maxStreak || 0)).catch(()=>{})
          }
        }, 1000)
      } catch (e) {
        console.error('[Nationality challenge start]', e)
      }
    }
  }
}
</script>

<template>
  <section class="grid place-items-center">
    <div class="space-y-3 w-full max-w-4xl">
        <div class="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-2 w-full">
          <AppH1 class="text-2xl md:text-4xl mb-1 sm:mb-0 flex-none">Nacionalidad correcta</AppH1>
          <div class="flex items-center gap-2 self-stretch sm:self-auto flex-none">
            <router-link :to="backPath()" class="rounded-full border border-white/15 px-2 py-1 text-xs sm:text-sm text-slate-200 hover:bg-white/5">← Volver</router-link>
              <div class="rounded-xl bg-slate-900/60 border border-white/15 px-2.5 py-1.5 flex items-center gap-2">
              <span class="text-slate-300 text-[10px] uppercase tracking-wider">Puntaje</span>
              <span class="text-white font-extrabold text-base sm:text-lg leading-none whitespace-nowrap">{{ score }}/{{ attempts * 10 }}</span>
              <div v-if="streak > 0" class="rounded-full border border-green-500/60 bg-green-500/10 text-green-300 text-[11px] sm:text-xs px-2 py-0.5 sm:px-2.5 sm:py-1 font-semibold">
                ×{{ streak }}
              </div>
            </div>
          </div>
        </div>

      <div v-if="loading" class="text-slate-300">Cargando…</div>
        <div v-else class="relative card p-4">
          <div ref="confettiHost" class="pointer-events-none absolute inset-0 overflow-hidden"></div>
          <div class="absolute right-3 top-3 z-10" v-if="streak > 0">
          </div>
          <!-- Removed extra feedback chip; options indicate correcto/incorrecto -->
          <Transition name="round-fade" mode="out-in">
            <div :key="roundKey">
              <div class="flex flex-col items-center">
                <p class="text-slate-200 mb-2 text-center text-base">¿De qué país es <strong class="text-white">{{ current?.name }}</strong>?</p>
                <img v-if="current" :src="current.image" :alt="current.name" class="mb-3 w-32 h-32 sm:w-36 sm:h-36 object-cover rounded-lg" />
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button v-for="opt in options" :key="opt.label" @click="pick(opt)" :class="optionClass(opt)" :disabled="answered || timeOver"
                  class="transition-transform duration-150 active:scale-[0.98]">
                  <img v-if="opt.code" :src="flag(opt)" :alt="opt.label" width="40" height="28" class="rounded ring-1 ring-white/10 object-cover" style="aspect-ratio: 20/14;" />
                  <span class="truncate">{{ opt.label }}</span>
                </button>
              </div>
            </div>
          </Transition>
          <!-- Challenge overlay -->
          <div v-if="overlayOpen" class="absolute inset-0 z-20 grid place-items-center bg-slate-900/80 backdrop-blur rounded-xl">
            <div class="w-full max-w-md rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/95 to-slate-900/80 p-5 shadow-2xl">
              <h3 class="text-white text-xl font-semibold">Desafío diario</h3>
              <p class="text-slate-300 text-sm mt-1">Tenés 30 segundos para sumar la mayor cantidad de aciertos.</p>
              <ul class="mt-3 text-xs text-slate-400 space-y-1 list-disc list-inside">
                <li>4 opciones por pregunta</li>
                <li>Ganá XP por cada acierto</li>
                <li>Mejorá tu racha del día</li>
              </ul>
              <div class="mt-4 flex items-center justify-end gap-2">
                <span class="text-xs text-slate-400" v-if="!availability.available">{{ availability.reason }}</span>
                <button @click="startChallenge" :disabled="!availability.available" class="rounded-full bg-[oklch(0.62_0.21_270)] hover:brightness-110 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed">¡Jugar!</button>
              </div>
            </div>
          </div>
          <!-- Timer in top-left inside card (opposite to +10 XP) -->
          <div v-if="mode==='challenge'" class="pointer-events-none absolute left-3 top-3 z-10">
            <div :class="['rounded-full px-3 py-1 text-sm font-bold shadow border',
              timeLeft>=21 ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' :
              timeLeft>=11 ? 'bg-amber-500/15 text-amber-300 border-amber-500/40' :
                             'bg-red-500/15 text-red-300 border-red-500/40']">
              ⏱ {{ Math.max(0, timeLeft) }}s
            </div>
          </div>
          <div v-if="timeOver && mode==='challenge'" class="mt-3 text-center text-amber-300 text-sm">Tiempo agotado. ¡Buen intento!</div>
          <!-- End-of-game summary with XP progress -->
          <div v-if="showSummary" class="absolute inset-0 z-30 grid place-items-center bg-slate-900/80 backdrop-blur rounded-xl">
            <div class="w-full max-w-md rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/95 to-slate-900/80 p-5 shadow-2xl text-center">
              <h3 class="text-white text-xl font-semibold mb-1">¡Buen juego!</h3>
              <p class="text-slate-300 text-sm mb-3">Así te fue en el desafío de hoy.</p>
              <div class="grid grid-cols-3 gap-2 mb-4">
                <div class="rounded-lg bg-white/5 border border-white/10 p-2">
                  <div class="text-[10px] uppercase tracking-wider text-slate-400">Puntaje</div>
                  <div class="text-white font-bold text-lg">{{ score }}</div>
                </div>
                <div class="rounded-lg bg-white/5 border border-white/10 p-2">
                  <div class="text-[10px] uppercase tracking-wider text-slate-400">Racha hoy</div>
                  <div class="text-emerald-300 font-bold text-lg">×{{ maxStreak || 0 }}</div>
                </div>
                <div class="rounded-lg bg-white/5 border border-white/10 p-2">
                  <div class="text-[10px] uppercase tracking-wider text-slate-400">Histórica</div>
                  <div class="text-indigo-300 font-bold text-lg">×{{ lifetimeMaxStreak || 0 }}</div>
                </div>
              </div>
              <div class="text-left">
                <div class="flex items-center justify-between text-xs text-slate-400">
                  <span>Progreso de XP</span>
                  <span class="tabular-nums">{{ xpBeforeTotal }} → <span class="text-white font-semibold">{{ xpAfterTotal }}</span> <span class="text-emerald-300">(+{{ Math.max(0, (xpAfterTotal - xpBeforeTotal) || 0) }})</span></span>
                </div>
                <div class="mt-1 h-2 rounded-full bg-white/10 overflow-hidden">
                  <div class="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400 transition-all duration-700" :style="{ width: (progressShown||0) + '%' }"></div>
                </div>
                <div class="mt-1 text-xs text-slate-400">Nivel {{ levelBefore ?? '—' }} → <span :class="(levelAfter||0)>(levelBefore||0)?'text-yellow-300 font-semibold':'text-slate-300'">{{ levelAfter ?? '—' }}</span></div>
                <div v-if="(xpToNextAfter ?? null) !== null" class="mt-1 text-xs text-slate-400">Te faltan <span class="text-white font-medium">{{ xpToNextAfter }}</span> XP para el próximo nivel.</div>
              </div>
              <div class="mt-4 flex justify-center gap-2">
                <router-link to="/play/points" class="rounded-full bg-[oklch(0.62_0.21_270)] hover:brightness-110 text-white px-4 py-2">Volver a los juegos</router-link>
              </div>
            </div>
          </div>
        </div>
    </div>
  </section>
</template>

  <style scoped>
  .round-fade-enter-active, .round-fade-leave-active {
    transition: opacity 180ms ease, transform 180ms ease;
  }
  .round-fade-enter-from, .round-fade-leave-to {
    opacity: 0;
    transform: translateY(6px) scale(0.99);
  }

  /* reserved for game local styles */
  </style>
