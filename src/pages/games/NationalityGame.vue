<script>
import AppH1 from '../../components/common/AppH1.vue';
import { initState, loadPlayers, nextRound, optionClass, pick, flag } from '../../services/nationality';
import { initScoring } from '../../services/scoring'
import { isChallengeAvailable, startChallengeSession, completeChallengeSession, fetchLifetimeMaxStreak } from '../../services/game-modes'
import { getUserLevel, captureLevelSnapshot } from '../../services/xp'
import { awardXpBatch } from '../../services/game-xp'
import { createDailyRng } from '../../services/seeded-random'
import { gameSummaryBlurb, getGameMetadata } from '../../services/games'
import { celebrateCorrect, celebrateGameWin, announceGameLoss, celebrateGameLevelUp, GAME_TYPES } from '../../services/game-celebrations'
import { playTimeUpSound } from '../../services/sounds'
import GamePreviewModal from '../../components/game/GamePreviewModal.vue'
import GameSummaryPopup from '../../components/game/GameSummaryPopup.vue'
import CircularTimer from '../../components/game/CircularTimer.vue'
import StreakBadge from '../../components/game/StreakBadge.vue'

export default {
  name: 'NationalityGame',
  components: { AppH1, GamePreviewModal, GameSummaryPopup, CircularTimer, StreakBadge },
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
    // Difficulty system
    selectedDifficulty: 'normal',
    difficultyConfig: null,
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
  async mounted() {
    // Detect mode from query
    const mode = (this.$route.query.mode || '').toString().toLowerCase()
    if (mode === 'free') this.mode = 'free'
    else if (mode === 'challenge') this.mode = 'challenge'
    else if (mode === 'review') { this.mode = 'challenge'; this.reviewMode = true }
    else this.mode = 'normal'

    // Free mode => no XP
    if (this.mode === 'free') this.allowXp = false

    await loadPlayers(this);
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
    async startChallenge({ difficulty, config }) {
      if (!this.availability.available) return
      
      // Guardar configuración de dificultad
      this.selectedDifficulty = difficulty
      this.difficultyConfig = config
      const timeLimit = config.time
      
      try {
        // capture XP/level before starting
        try {
          const snap = await captureLevelSnapshot()
          this.levelBefore = snap.level
          this.xpBeforeTotal = snap.xpTotal
          this.beforePercent = snap.percent
        } catch {}
        this.rng = createDailyRng('nationality')
        this.difficultyConfig = config
        this.sessionId = await startChallengeSession('nationality', timeLimit)
        this.overlayOpen = false
        this.timeLeft = timeLimit
        this.timeOver = false
        clearInterval(this.timer)
        this.timer = setInterval(() => {
          if (this.timeLeft > 0) this.timeLeft -= 1
          if (this.timeLeft <= 0) {
            this.timeOver = true
            clearInterval(this.timer)
            playTimeUpSound()

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
      if (this.allowXp && this.xpEarned > 0) {
        await awardXpBatch({ gameCode: 'nationality', totalXp: this.xpEarned, corrects: this.corrects }).catch(() => {})
      }
      await completeChallengeSession(this.sessionId, this.score, this.xpEarned, { maxStreak: this.maxStreak, result, corrects: this.corrects }).catch(()=>{})
      
      try {
        const snap = await captureLevelSnapshot()
        this.levelAfter = snap.level
        this.xpAfterTotal = snap.xpTotal
        this.afterPercent = snap.percent
        this.xpToNextAfter = snap.xpToNext
        if (snap.level && this.levelBefore && snap.level > this.levelBefore) {
          celebrateGameLevelUp(snap.level)
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
  <section class="grid place-items-center min-h-[600px]">
    <GamePreviewModal
      :open="overlayOpen && mode === 'challenge' && !reviewMode"
      gameType="timed"
      gameName="Nacionalidad correcta"
      gameDescription="Identificá la nacionalidad correcta de cada jugador"
      :mechanic="gameMetadata.mechanic"
      :videoUrl="gameMetadata.videoUrl"
      :tips="gameMetadata.tips"
      @close="overlayOpen = false"
      @start="startChallenge"
    />
    <div class="space-y-4 w-full max-w-4xl">
        <div class="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-3 w-full">
          <AppH1 class="text-3xl md:text-4xl flex-none">Nacionalidad correcta</AppH1>
          <div class="flex items-center gap-2 self-stretch sm:self-auto flex-none">
            <router-link :to="backPath()" class="rounded-full border border-white/15 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/5 transition">← Volver</router-link>
              <div class="rounded-xl bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-white/15 px-3 py-2 flex items-center gap-2 shadow-lg shadow-black/20">
              <span class="text-slate-400 text-xs uppercase tracking-wider font-semibold">Puntaje</span>
              <span class="font-display text-white font-extrabold text-lg leading-none whitespace-nowrap">{{ score }}/{{ attempts * 10 }}</span>
              <StreakBadge :streak="streak" />
            </div>
          </div>
        </div>

      <div v-if="loading" class="text-center text-slate-300 py-12">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400"></div>
        <p class="mt-3">Cargando...</p>
      </div>
        <div v-else class="relative card p-6 ring-1 ring-white/5">
          <div ref="confettiHost" class="pointer-events-none absolute inset-0 overflow-hidden rounded-xl"></div>
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
          <!-- Timer -->
          <div v-if="mode==='challenge'" class="absolute left-4 top-4 z-20 pointer-events-none">
            <CircularTimer :seconds="Math.max(0, timeLeft)" :total="chosenSeconds" />
          </div>
          <Transition name="time-over-fade">
            <div v-if="timeOver && mode==='challenge'" class="mt-4 flex items-center justify-center gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2.5">
              <svg class="w-5 h-5 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6l4 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span class="text-sm font-semibold text-amber-300">Tiempo agotado</span>
            </div>
          </Transition>
          
          <!-- Cinematic summary -->
          <GameSummaryPopup
            :show="showSummary"
            :corrects="corrects"
            :score="score"
            :maxStreak="maxStreak"
            :lifetimeMaxStreak="lifetimeMaxStreak"
            :levelBefore="levelBefore"
            :levelAfter="levelAfter"
            :xpBeforeTotal="xpBeforeTotal"
            :xpAfterTotal="xpAfterTotal"
            :beforePercent="beforePercent"
            :afterPercent="afterPercent"
            :progressShown="progressShown"
            :xpToNextAfter="xpToNextAfter"
            :xpEarned="xpEarned"
            :difficulty="selectedDifficulty"
            backPath="/play/points"
            @close="showSummary = false"
          />
        </div>
    </div>
  </section>
</template>

  <style scoped>
  .round-fade-enter-active, .round-fade-leave-active {
    transition: opacity 200ms ease, transform 200ms ease;
  }
  .round-fade-enter-from, .round-fade-leave-to {
    opacity: 0;
    transform: translateY(8px) scale(0.98);
  }
  .streak-enter-enter-active { transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
  .streak-enter-leave-active { transition: all 0.15s ease; }
  .streak-enter-enter-from { opacity: 0; transform: scale(0.5); }
  .streak-enter-leave-to { opacity: 0; transform: scale(0.8); }
  .time-over-fade-enter-active { transition: opacity 0.4s ease, transform 0.4s ease; }
  .time-over-fade-enter-from { opacity: 0; transform: translateY(6px); }
  </style>


