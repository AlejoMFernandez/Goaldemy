<script>
import AppH1 from '../../components/common/AppH1.vue'
import { initState, loadPlayers, nextRound, pickAnswer, optionClass } from '../../services/guess-player-mcq'
import { initScoring } from '../../services/scoring'
import { isChallengeAvailable, startChallengeSession, completeChallengeSession, fetchLifetimeMaxStreak } from '../../services/game-modes'
import { getUserLevel, captureLevelSnapshot } from '../../services/xp'
import { awardXpBatch } from '../../services/game-xp'
import { createDailyRng } from '../../services/seeded-random'
import { celebrateCorrect, checkEarlyWin, celebrateGameWin, announceGameLoss, celebrateGameLevelUp } from '../../services/game-celebrations'

import { getGameMetadata } from '../../services/games'
import GamePreviewModal from '../../components/game/GamePreviewModal.vue'
import GameSummaryPopup from '../../components/game/GameSummaryPopup.vue'
import CircularTimer from '../../components/game/CircularTimer.vue'
import StreakBadge from '../../components/game/StreakBadge.vue'

export default {
  name: 'GuessPlayer',
  components: { AppH1, GamePreviewModal, GameSummaryPopup, CircularTimer, StreakBadge },
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
      const ok = await pickAnswer(this, opt, this.$refs.confettiHost)
      
      // 🎉 Celebrate correct answer
      if (ok && this.mode === 'challenge') {
        celebrateCorrect()
      }
      
      setTimeout(() => this.nextRound(), 800)
      return ok
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
            const result = (this.corrects || 0) >= 10 ? 'win' : 'loss'
            
            // 🎉 Celebrate based on result
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
      await completeChallengeSession(this.sessionId, this.score, this.xpEarned, { maxStreak: this.maxStreak, result, corrects: this.corrects }).catch(()=>{})
      
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
  <section class="grid place-items-center min-h-[600px]">
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
            <div class="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button v-for="opt in options" :key="opt.value" :class="optionClass(opt)" :disabled="timeOver" @click="choose(opt)">{{ opt.label }}</button>
            </div>
          </div>
        </Transition>
        <!-- Timer in top-left inside card -->
        <div v-if="mode==='challenge'" class="pointer-events-none absolute left-3 top-3 z-20">
          <CircularTimer :seconds="Math.max(0, timeLeft)" :total="chosenSeconds" />
        </div>
        
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
        
        <div v-if="timeOver && mode==='challenge'" class="mt-4 text-center text-amber-300 text-sm font-medium">⏱ Tiempo agotado. ¡Buen intento!</div>
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
</style>


