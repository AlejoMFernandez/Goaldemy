<script>
import GameShell from '../../components/game/GameShell.vue';
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
import PowerupBar from '../../components/game/PowerupBar.vue'

export default {
  name: 'NationalityGame',
  components: { GameShell, GamePreviewModal, GameSummaryPopup, CircularTimer, StreakBadge, PowerupBar },
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
    // Powerups
    shieldActive: false,
    eliminatedOptions: [],
    hintVisible: false,
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
    if (this.shieldActive && option.value !== this.current.cname) {
      this.shieldActive = false
      this.answered = true
      this.selected = option.value
      setTimeout(() => { this.nextRound(); this.eliminatedOptions = []; this.hintVisible = false }, 1000)
      return
    }
    const ok = pick(this, option, this.$refs.confettiHost)
    setTimeout(() => { this.nextRound(); this.eliminatedOptions = []; this.hintVisible = false }, 1000)
  },
  handlePowerup(type) {
    if (type === 'fifty_fifty' && this.options.length > 2) {
      const wrong = this.options.filter(o => o.value !== this.current.cname)
      this.eliminatedOptions = wrong.slice(0, 2).map(o => o.value)
    } else if (type === 'shield') {
      this.shieldActive = true
    } else if (type === 'extra_time') {
      this.timeLeft = Math.min(this.timeLeft + 15, 999)
    } else if (type === 'reveal_hint') {
      this.hintVisible = true
    }
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
      await completeChallengeSession(this.sessionId, this.score, this.xpEarned, { maxStreak: this.maxStreak, result, corrects: this.corrects, attempts: this.attempts, errors: Math.max(0, (this.attempts || 0) - (this.corrects || 0)), maxWrongStreak: this.maxWrongStreak || 0 }).catch(()=>{})
      
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
  <GameShell title="Nacionalidad correcta" :backPath="backPath()">
    <template #stat>
      <div class="inline-flex items-center gap-2 rounded-lg bg-slate-800/70 border border-white/12 px-2.5 py-1 shadow-lg shadow-black/20">
        <span class="text-slate-400 text-[10px] uppercase tracking-wider font-semibold">Puntaje</span>
        <span class="font-display text-white font-extrabold text-base leading-none whitespace-nowrap">{{ score }}/{{ attempts * 10 }}</span>
        <StreakBadge :streak="streak" />
      </div>
    </template>
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

      <div v-if="loading" class="text-center text-slate-300 py-12">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400"></div>
        <p class="mt-3">Cargando...</p>
      </div>
        <div v-else class="relative rounded-2xl border border-white/10 bg-gradient-to-b from-slate-800/70 to-slate-900/85 p-4 sm:p-5 overflow-hidden max-w-md mx-auto">
          <div ref="confettiHost" class="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"></div>
          <div class="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full opacity-20 blur-3xl" style="background: radial-gradient(circle, rgba(16,185,129,0.4), transparent 70%);"></div>
          <Transition name="round-fade" mode="out-in">
            <div :key="roundKey" class="relative">
              <div class="flex flex-col items-center gap-3 pt-5">
                <img v-if="current" :src="current.image" :alt="current.name" class="w-36 h-36 sm:w-44 sm:h-44 object-cover rounded-2xl ring-1 ring-white/10 shadow-xl" />
                <p class="text-slate-200 text-center text-base">¿De qué país es <strong class="text-white">{{ current?.name }}</strong>?</p>
                <Transition name="hint-fade">
                  <p v-if="hintVisible && current" class="text-center text-amber-300 text-sm font-medium">
                    Juega en {{ current.teamName }}
                  </p>
                </Transition>
              </div>
              <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button v-for="opt in options" :key="opt.label" @click="pick(opt)" :class="optionClass(opt)" :disabled="answered || timeOver || eliminatedOptions.includes(opt.value)" v-show="!eliminatedOptions.includes(opt.value)"
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
          <div v-if="shieldActive" class="absolute right-4 top-4 z-20 text-xl animate-pulse" title="Escudo activo">🛡️</div>

          <!-- Powerup Bar -->
          <PowerupBar
            v-if="mode === 'challenge' && !timeOver && !showSummary"
            :hide="overlayOpen"
            :disabled-types="answered ? ['fifty_fifty','shield','extra_time','reveal_hint'] : []"
            @use="handlePowerup"
          />
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
  </GameShell>
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


