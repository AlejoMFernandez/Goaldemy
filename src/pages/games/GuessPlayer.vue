<script>
import AppH1 from '../../components/common/AppH1.vue'
import { initState, loadPlayers, nextRound, pickAnswer, optionClass } from '../../services/guess-player-mcq'
import { initScoring } from '../../services/scoring'
import { isChallengeAvailable, startChallengeSession, completeChallengeSession, fetchLifetimeMaxStreak } from '../../services/game-modes'
import { getUserLevel, captureLevelSnapshot } from '../../services/xp'
import { awardXpBatch } from '../../services/game-xp'
import { createDailyRng } from '../../services/seeded-random'
import { celebrateCorrect, checkEarlyWin, celebrateGameWin, announceGameLoss, celebrateGameLevelUp } from '../../services/game-celebrations'
import { playTimeUpSound } from '../../services/sounds'

import { getGameMetadata } from '../../services/games'
import GamePreviewModal from '../../components/game/GamePreviewModal.vue'
import GameSummaryPopup from '../../components/game/GameSummaryPopup.vue'
import CircularTimer from '../../components/game/CircularTimer.vue'
import StreakBadge from '../../components/game/StreakBadge.vue'
import PowerupBar from '../../components/game/PowerupBar.vue'

export default {
  name: 'GuessPlayer',
  components: { AppH1, GamePreviewModal, GameSummaryPopup, CircularTimer, StreakBadge, PowerupBar },
  computed: {
    gameMetadata() {
      return getGameMetadata('guess-player')
    }
  },
  data() {
    return { 
      ...initState(), 
      ...initScoring(),
      mode: 'normal',
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
      xpEarned: 0,
      // Powerups
      shieldActive: false,
      eliminatedOptions: [],
      hintVisible: false,
      // XP progress for summary
      levelBefore: null,
      levelAfter: null,
      xpBeforeTotal: 0,
      xpAfterTotal: 0,
      beforePercent: 0,
      afterPercent: 0,
      progressShown: 0,
      xpToNextAfter: null,
    }
  },
  async mounted() {
    const mode = (this.$route.query.mode || '').toString().toLowerCase()
    if (mode === 'free') this.mode = 'free'
    else if (mode === 'challenge') this.mode = 'challenge'
    else if (mode === 'review') { this.mode = 'challenge'; this.reviewMode = true }
    else this.mode = 'normal'

    if (this.mode === 'free') this.allowXp = false

    await loadPlayers(this)
    nextRound(this)

    if (this.reviewMode) {
      import('../../services/game-modes').then(async (mod) => {
        const last = await mod.fetchTodayLastSession('guess-player')
        if (last) {
          const m = last.metadata || {}
          this.score = Number(last.score_final || 0)
          this.maxStreak = Number(m.maxStreak || 0)
          this.corrects = Number(m.corrects || 0)
          this.timeOver = true
          // Restore XP summary if snapshot exists
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
          try { this.lifetimeMaxStreak = Math.max(await mod.fetchLifetimeMaxStreak('guess-player') || 0, this.maxStreak || 0) } catch {}
          this.showSummary = true
        }
      }).catch(()=>{})
    } else if (this.mode === 'challenge') {
      this.overlayOpen = true
      this.checkAvailability()
    }
  },
  methods: {
    nextRound() { nextRound(this) },
    backPath() {
      return this.mode === 'free' ? '/play/free' : '/play/points'
    },
    async choose(opt) {
      if (this.timeOver) return false
      if (this.shieldActive && opt.value !== this.current.name) {
        this.shieldActive = false
        this.answered = true
        this.selected = opt.value
        setTimeout(() => { this.nextRound(); this.eliminatedOptions = []; this.hintVisible = false }, 800)
        return false
      }
      const ok = await pickAnswer(this, opt, this.$refs.confettiHost)
      if (ok && this.mode === 'challenge') celebrateCorrect()
      setTimeout(() => { this.nextRound(); this.eliminatedOptions = []; this.hintVisible = false }, 800)
      return ok
    },
    handlePowerup(type) {
      if (type === 'fifty_fifty' && this.options.length > 2) {
        const wrong = this.options.filter(o => o.value !== this.current.name)
        const toRemove = wrong.slice(0, 2).map(o => o.value)
        this.eliminatedOptions = toRemove
      } else if (type === 'shield') {
        this.shieldActive = true
      } else if (type === 'extra_time') {
        this.timeLeft = Math.min(this.timeLeft + 15, 999)
      } else if (type === 'reveal_hint') {
        this.hintVisible = true
      }
    },
    optionClass(opt) { return optionClass(this, opt) },
    async checkAvailability() { this.availability = await isChallengeAvailable('guess-player') },
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
        this.rng = createDailyRng('guess-player')
        this.difficultyConfig = config
        this.sessionId = await startChallengeSession('guess-player', timeLimit)
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
              setTimeout(() => celebrateGameWin(), 100)
            } else {
              setTimeout(() => announceGameLoss(), 100)
            }

            this.finishChallenge(result)
          }
        }, 1000)
      } catch (e) {
        console.error('[GuessPlayer challenge start]', e)
      }
    },
    async finishChallenge(result) {
      if (this.allowXp && this.xpEarned > 0) {
        await awardXpBatch({ gameCode: 'guess-player', totalXp: this.xpEarned, corrects: this.corrects }).catch(() => {})
      }
      await completeChallengeSession(this.sessionId, this.score, this.xpEarned, { maxStreak: this.maxStreak, result, corrects: this.corrects, attempts: this.attempts, errors: Math.max(0, (this.attempts || 0) - (this.corrects || 0)), maxWrongStreak: this.maxWrongStreak || 0 }).catch(()=>{})

      try {
        const snap = await captureLevelSnapshot()
        this.levelAfter = snap.level
        this.xpAfterTotal = snap.xpTotal
        this.afterPercent = snap.percent
        this.xpToNextAfter = snap.xpToNext
        if (snap.level && this.levelBefore && snap.level > this.levelBefore) {
          setTimeout(() => celebrateGameLevelUp(snap.level), 500)
        }
      } catch {}
      
      // Save xpView snapshot
      try {
        await completeChallengeSession(this.sessionId, this.score, this.xpEarned, {
          maxStreak: this.maxStreak, result, corrects: this.corrects,
          xpView: {
            levelBefore: this.levelBefore, xpBeforeTotal: this.xpBeforeTotal,
            levelAfter: this.levelAfter, xpAfterTotal: this.xpAfterTotal,
            beforePercent: this.beforePercent, afterPercent: this.afterPercent,
            xpToNextAfter: this.xpToNextAfter, xpEarned: this.xpEarned
          }
        })
      } catch {}
      
      this.progressShown = this.beforePercent
      this.showSummary = true
      
      // Trigger animation to after percent
      requestAnimationFrame(() => setTimeout(() => { this.progressShown = this.afterPercent }, 40))
      
      // Fetch lifetime max streak
      fetchLifetimeMaxStreak('guess-player').then(v => this.lifetimeMaxStreak = Math.max(v || 0, this.maxStreak || 0)).catch(()=>{})
      
      // Check daily wins achievement
      import('../../services/game-modes').then(mod => mod.checkAndUnlockDailyWins('guess-player')).catch(()=>{})
    }
  }
}
</script>

<template>
  <section class="grid place-items-center min-h-[calc(100dvh-4rem)]">
    <GamePreviewModal
      :open="overlayOpen && mode === 'challenge' && !reviewMode"
      gameName="Adivina el jugador"
      gameDescription="Hacé 10 aciertos en 30 segundos para ganar"
      :mechanic="gameMetadata.mechanic"
      :videoUrl="gameMetadata.videoUrl"
      :tips="gameMetadata.tips"
      @close="overlayOpen = false"
      @start="startChallenge"
    />
  <div class="space-y-4 w-full max-w-4xl">
      <div class="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-3 w-full">
        <AppH1 class="text-3xl md:text-4xl flex-none">Adivina el jugador</AppH1>
        <div class="flex items-center gap-2 self-stretch sm:self-auto flex-none">
          <router-link :to="backPath()" class="rounded-full border border-white/15 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/5 transition">← Volver</router-link>
          <div class="rounded-xl bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-white/15 px-3 py-2 flex items-center gap-2 shadow-lg shadow-black/20">
            <span class="text-slate-400 text-xs uppercase tracking-wider font-semibold">Puntaje</span>
            <span class="font-display text-white font-extrabold text-lg leading-none whitespace-nowrap">{{ score }}/{{ attempts * 10 }}</span>
            <StreakBadge :streak="streak" />
          </div>
        </div>
      </div>

      <div v-if="loading" class="text-slate-300">Cargando…</div>
      <div v-else class="relative card p-4">
        <div ref="confettiHost" class="pointer-events-none absolute inset-0 overflow-hidden"></div>
        <Transition name="round-fade" mode="out-in">
          <div :key="roundKey">
            <div class="flex flex-col items-center gap-2">
              <p class="text-slate-200 text-center text-base">Adivina el jugador</p>
              <img v-if="current" :src="current.image" :alt="current.name" class="mb-3 w-32 h-32 sm:w-36 sm:h-36 object-cover rounded-lg" />
            </div>
            <Transition name="hint-fade">
              <p v-if="hintVisible && current" class="text-center text-amber-300 text-sm font-medium mb-1">
                Juega en {{ current.teamName }}
              </p>
            </Transition>
            <div class="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button v-for="opt in options" :key="opt.value" :class="optionClass(opt)" :disabled="timeOver || eliminatedOptions.includes(opt.value)" v-show="!eliminatedOptions.includes(opt.value)" @click="choose(opt)">{{ opt.label }}</button>
            </div>
          </div>
        </Transition>
        <!-- Timer in top-left inside card -->
        <div v-if="mode==='challenge'" class="pointer-events-none absolute left-3 top-3 z-20">
          <CircularTimer :seconds="Math.max(0, timeLeft)" :total="chosenSeconds" />
        </div>
        <div v-if="shieldActive" class="absolute right-3 top-3 z-20 text-xl animate-pulse" title="Escudo activo">🛡️</div>

        <!-- Powerup Bar -->
        <PowerupBar
          v-if="mode === 'challenge' && !timeOver && !showSummary"
          :hide="overlayOpen"
          :disabled-types="answered ? ['fifty_fifty','shield','extra_time','reveal_hint'] : []"
          @use="handlePowerup"
        />
        
        <!-- Summary Popup -->
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
          :winThreshold="10"
          :backPath="backPath()"
          @close="showSummary = false"
        />
        
        <Transition name="time-over-fade">
          <div v-if="timeOver && mode==='challenge'" class="mt-4 flex items-center justify-center gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2.5">
            <svg class="w-5 h-5 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6l4 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span class="text-sm font-semibold text-amber-300">Tiempo agotado</span>
          </div>
        </Transition>
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
.time-over-fade-enter-active { transition: opacity 0.4s ease, transform 0.4s ease; }
.time-over-fade-enter-from { opacity: 0; transform: translateY(6px); }
</style>


