<script>
import AppH1 from '../../components/AppH1.vue';
import { initState, loadPlayers, nextRound, optionClass, pick, flag } from '../../services/nationality';
import { initScoring } from '../../services/scoring'
import { isChallengeAvailable, startChallengeSession, completeChallengeSession, fetchLifetimeMaxStreak } from '../../services/game-modes'
import { getUserLevel } from '../../services/xp'
import { gameSummaryBlurb, getGameMetadata } from '../../services/games'
import { celebrateCorrect, celebrateGameWin, announceGameLoss, celebrateGameLevelUp } from '../../services/game-celebrations'
import GamePreviewModal from '../../components/GamePreviewModal.vue'

export default {
  name: 'NationalityGame',
  components: { AppH1, GamePreviewModal },
  data() {
  return { 
    ...initState(), 
    ...initScoring(),
    mode: 'normal', // normal | free | challenge
    reviewMode: false,
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
  computed: {
    gameMetadata() {
      return getGameMetadata('nationality')
    }
  },
  mounted() {
    // Detect mode from query
    const mode = (this.$route.query.mode || '').toString().toLowerCase()
    if (mode === 'free') this.mode = 'free'
    else if (mode === 'challenge') this.mode = 'challenge'
    else if (mode === 'review') { this.mode = 'challenge'; this.reviewMode = true }
    else this.mode = 'normal'

    // Free mode => no XP
    if (this.mode === 'free') this.allowXp = false

    loadPlayers(this);
    nextRound(this);

    // Challenge: show overlay and check availability or load review
    if (this.reviewMode) {
      import('../../services/game-modes').then(async (mod) => {
        const last = await mod.fetchTodayLastSession('nationality')
        if (last) {
          // In review we show the summary immediately; the round history UI isn't persisted for MCQ, so we present aggregate
          this.score = Number(last.score_final || 0)
          const m = last.metadata || {}
          this.corrects = Number(m.corrects || 0)
          this.maxStreak = Number(m.maxStreak || 0)
          this.timeOver = true
          // XP snapshot if stored
          const v = m.xpView || {}
          if (v && (v.levelAfter != null)) {
            this.levelBefore = v.levelBefore ?? null
            this.xpBeforeTotal = v.xpBeforeTotal ?? 0
            this.levelAfter = v.levelAfter ?? null
            this.xpAfterTotal = v.xpAfterTotal ?? 0
            this.beforePercent = v.beforePercent ?? 0
            this.afterPercent = v.afterPercent ?? 0
            this.xpToNextAfter = v.xpToNextAfter ?? null
            this.progressShown = this.afterPercent
          }
          try { this.lifetimeMaxStreak = Math.max(await mod.fetchLifetimeMaxStreak('nationality') || 0, this.maxStreak || 0) } catch {}
          this.showSummary = true
        }
      }).catch(()=>{})
    } else if (this.mode === 'challenge') {
      this.overlayOpen = true
      this.checkAvailability()
    }
  },
  methods: {
    nextRound() { nextRound(this); },
    backPath() { return this.mode === 'free' ? '/play/free' : '/play/points' },
    blurb() { return gameSummaryBlurb('nationality') },
  pick(option) { 
    if (this.timeOver) return
    const ok = pick(this, option, this.$refs.confettiHost)
    setTimeout(() => this.nextRound(), 1000)
  },
    optionClass(opt) { return optionClass(this, opt) },
    flag(opt) { return flag(opt.code, 40) },
    async checkAvailability() {
      this.availability = await isChallengeAvailable('nationality')
      if (this.availability.available && this.mode === 'challenge' && !this.reviewMode) {
        this.overlayOpen = true
      }
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
            
            // Determine result and celebrate
            const result = (this.corrects || 0) >= 10 ? 'win' : 'loss'
            
            if (result === 'win') {
              celebrateGameWin()
            } else {
              announceGameLoss()
            }
            
            // Finish challenge after brief delay
            setTimeout(() => this.finishChallenge(result), 1000)
          }
        }, 1000)
      } catch (e) {
        console.error('[Nationality challenge start]', e)
      }
    },
    async finishChallenge(result) {
      // No need to hide banner since we're not showing it anymore
      
      // Complete session
      await completeChallengeSession(this.sessionId, this.score, this.xpEarned, { maxStreak: this.maxStreak, result, corrects: this.corrects }).catch(()=>{})
      
      // Fetch level after
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
        
        // Check level up
        if (this.levelAfter && this.levelBefore && this.levelAfter > this.levelBefore) {
          celebrateGameLevelUp(this.levelAfter)
        }
      } catch {}
      
      // Save XP snapshot
      try {
        await completeChallengeSession(this.sessionId, this.score, this.xpEarned, {
          xpView: {
            levelBefore: this.levelBefore, xpBeforeTotal: this.xpBeforeTotal,
            levelAfter: this.levelAfter, xpAfterTotal: this.xpAfterTotal,
            beforePercent: this.beforePercent, afterPercent: this.afterPercent,
            xpToNextAfter: this.xpToNextAfter, xpEarned: this.xpEarned
          }
        })
      } catch {}
      
      // Show summary
      this.progressShown = this.beforePercent
      this.showSummary = true
      requestAnimationFrame(() => setTimeout(() => { this.progressShown = this.afterPercent }, 40))
      
      // Fetch lifetime streak
      fetchLifetimeMaxStreak('nationality').then(v => this.lifetimeMaxStreak = Math.max(v || 0, this.maxStreak || 0)).catch(()=>{})
      
      // Unlock daily achievements
      import('../../services/game-modes').then(mod => mod.checkAndUnlockDailyWins('nationality')).catch(()=>{})
    }
  }
}
</script>

<template>
  <!-- Game Preview Modal (pre-game info) -->
  <GamePreviewModal
    :open="overlayOpen && mode === 'challenge' && !reviewMode"
    gameName="Nacionalidad correcta"
    gameDescription="Identificá la nacionalidad correcta de cada jugador"
    :mechanic="gameMetadata.mechanic"
    :videoUrl="gameMetadata.videoUrl"
    :tips="gameMetadata.tips"
    @close="overlayOpen = false"
    @start="startChallenge"
  />
  
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
          <!-- Timer in top-left inside card (opposite to +10 XP) -->
          <div v-if="mode==='challenge'" class="pointer-events-none absolute left-3 top-3 z-20">
            <div :class="['rounded-full px-3 py-1 text-sm font-bold shadow border',
              timeLeft>=21 ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' :
              timeLeft>=11 ? 'bg-amber-500/15 text-amber-300 border-amber-500/40' :
                             'bg-red-500/15 text-red-300 border-red-500/40']">
              ⏱ {{ Math.max(0, timeLeft) }}s
            </div>
          </div>
          <div v-if="timeOver && mode==='challenge'" class="mt-3 text-center text-amber-300 text-sm">Tiempo agotado. ¡Buen intento!</div>
          
          <!-- End-of-game summary with prominent result -->
          <div v-if="showSummary" class="absolute inset-0 z-30 grid place-items-center bg-slate-900/80 backdrop-blur rounded-xl p-4">
            <div class="w-full max-w-lg rounded-2xl border border-white/20 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden shadow-2xl">
              
              <!-- RESULTADO DESTACADO - Verde si gana, Rojo si pierde -->
              <div :class="[
                'p-5 text-center border-b',
                (corrects >= 10) 
                  ? 'bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border-emerald-500/30' 
                  : 'bg-gradient-to-br from-red-500/20 to-orange-500/20 border-red-500/30'
              ]">
                <div class="text-4xl mb-2">{{ (corrects >= 10) ? '🎉' : '💪' }}</div>
                <h2 :class="[
                  'text-3xl font-extrabold mb-1',
                  (corrects >= 10) ? 'text-emerald-400' : 'text-red-400'
                ]">
                  {{ (corrects >= 10) ? '¡GANASTE!' : '¡PERDISTE!' }}
                </h2>
                <p class="text-white text-base font-medium mb-3">
                  {{ (corrects >= 10) 
                    ? 'Excelente trabajo, seguí así' 
                    : 'No te rindas, volvé a intentarlo mañana' 
                  }}
                </p>
                <!-- Stats principales -->
                <div class="flex justify-center gap-3">
                  <div class="rounded-xl bg-black/20 backdrop-blur px-3 py-1.5 border border-white/10">
                    <div class="text-[10px] uppercase tracking-wider text-slate-300">Aciertos</div>
                    <div class="text-xl font-bold text-white">{{ corrects }}<span class="text-slate-400 text-base">/10</span></div>
                  </div>
                  <div class="rounded-xl bg-black/20 backdrop-blur px-3 py-1.5 border border-white/10">
                    <div class="text-[10px] uppercase tracking-wider text-slate-300">Puntaje</div>
                    <div class="text-xl font-bold text-white">{{ score }}</div>
                  </div>
                </div>
              </div>

              <!-- Sección de detalles -->
              <div class="p-6">
                <!-- Rachas -->
                <div class="grid grid-cols-2 gap-3 mb-5">
                  <div class="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
                    <div class="text-xs uppercase tracking-wider text-slate-400 mb-1">Racha hoy</div>
                    <div class="text-emerald-300 font-bold text-xl">×{{ maxStreak || 0 }}</div>
                  </div>
                  <div class="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
                    <div class="text-xs uppercase tracking-wider text-slate-400 mb-1">Histórica</div>
                    <div class="text-indigo-300 font-bold text-xl">×{{ lifetimeMaxStreak || 0 }}</div>
                  </div>
                </div>

                <!-- Progreso XP -->
                <div class="rounded-xl bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/30 p-4 mb-5">
                  <div class="flex items-center justify-between text-sm text-slate-300 mb-2">
                    <span class="font-semibold">Progreso de XP</span>
                    <span class="tabular-nums">
                      <span class="text-slate-400">{{ xpBeforeTotal }}</span> → 
                      <span class="text-white font-bold">{{ xpAfterTotal }}</span> 
                      <span class="text-emerald-400 font-bold">(+{{ Math.max(0, (xpAfterTotal - xpBeforeTotal) || 0) }})</span>
                    </span>
                  </div>
                  <div class="h-3 rounded-full bg-black/30 overflow-hidden mb-2">
                    <div 
                      class="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400 transition-all duration-700 shadow-lg" 
                      :style="{ width: (progressShown||0) + '%' }"
                    ></div>
                  </div>
                  <div class="flex items-center justify-between text-xs">
                    <span class="text-slate-400">
                      Nivel <span class="text-white font-semibold">{{ levelBefore ?? '—' }}</span> → 
                      <span :class="(levelAfter||0)>(levelBefore||0)?'text-yellow-300 font-bold':'text-slate-300'">
                        {{ levelAfter ?? '—' }}
                      </span>
                    </span>
                    <span v-if="(xpToNextAfter ?? null) !== null" class="text-slate-400">
                      Faltan <span class="text-white font-semibold">{{ xpToNextAfter }} XP</span>
                    </span>
                  </div>
                </div>

                <!-- Botones -->
                <div class="flex gap-3">
                  <button 
                    @click="showSummary=false" 
                    class="flex-1 rounded-xl border border-white/20 hover:bg-white/5 text-white py-3 font-semibold transition"
                  >
                    Cerrar
                  </button>
                  <router-link 
                    to="/play/points" 
                    class="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110 text-white py-3 font-bold transition text-center shadow-lg shadow-emerald-500/25"
                  >
                    Volver a juegos
                  </router-link>
                </div>
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
