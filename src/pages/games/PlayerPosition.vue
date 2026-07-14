<script>
import GameShell from '../../components/game/GameShell.vue';
import { initState, loadPlayers, nextRound, pickAnswer, optionClass } from '../../services/player-position';
import { getBroadPosition } from '../../services/game-common';
import { initScoring } from '../../services/scoring'
import { celebrateCorrect, celebrateGameWin, announceGameLoss, celebrateGameLevelUp } from '../../services/game-celebrations'
import { getGameMetadata } from '../../services/games'
import GamePreviewModal from '../../components/game/GamePreviewModal.vue'
import GameSummaryPopup from '../../components/game/GameSummaryPopup.vue'
import CircularTimer from '../../components/game/CircularTimer.vue'
import StreakBadge from '../../components/game/StreakBadge.vue'
import PowerupBar from '../../components/game/PowerupBar.vue'
import { isChallengeAvailable, startChallengeSession, completeChallengeSession, fetchLifetimeMaxStreak } from '../../services/game-modes'
import { getUserLevel, captureLevelSnapshot } from '../../services/xp'
import { awardXpBatch } from '../../services/game-xp'
import { createDailyRng } from '../../services/seeded-random'

export default {
  name: 'PlayerPosition',
  components: { GameShell, GamePreviewModal, GameSummaryPopup, CircularTimer, StreakBadge, PowerupBar },
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
      // XP summary fields
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
    gameMetadata() { return getGameMetadata('player-position') }
  },
  async mounted() {
    const mode = (this.$route.query.mode || '').toString().toLowerCase()
    if (mode === 'free') this.mode = 'free'
    else if (mode === 'challenge') this.mode = 'challenge'
    else if (mode === 'review') { this.mode = 'challenge'; this.reviewMode = true }
    else this.mode = 'normal'

    if (this.mode === 'free') this.allowXp = false

    await loadPlayers(this);
    nextRound(this);

    if (this.reviewMode) {
      import('../../services/game-modes').then(async (mod) => {
        const last = await mod.fetchTodayLastSession('player-position')
        if (last) {
          const m = last.metadata || {}
          this.score = Number(last.score_final || 0)
          this.maxStreak = Number(m.maxStreak || 0)
          this.corrects = Number(m.corrects || 0)
          this.timeOver = true
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
          try { this.lifetimeMaxStreak = Math.max(await mod.fetchLifetimeMaxStreak('player-position') || 0, this.maxStreak || 0) } catch {}
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
    async pick(option) {
      if (this.timeOver) return false
      if (this.shieldActive && option.value !== getBroadPosition(this.current)) {
        this.shieldActive = false
        this.answered = true
        this.selected = option.value
        setTimeout(() => { this.nextRound(); this.eliminatedOptions = []; this.hintVisible = false }, 1000)
        return false
      }
      const ok = await pickAnswer(this, option, this.$refs.confettiHost);
      setTimeout(() => { this.nextRound(); this.eliminatedOptions = []; this.hintVisible = false }, 1000);
      return ok
    },
    handlePowerup(type) {
      if (type === 'fifty_fifty' && this.options.length > 2) {
        const wrong = this.options.filter(o => o.value !== getBroadPosition(this.current))
        this.eliminatedOptions = wrong.slice(0, 2).map(o => o.value)
      } else if (type === 'shield') {
        this.shieldActive = true
      } else if (type === 'extra_time') {
        this.timeLeft = Math.min(this.timeLeft + 15, 999)
      } else if (type === 'reveal_hint') {
        this.hintVisible = true
      }
    },
    optionClass(opt) { return optionClass(this, opt); },
    async checkAvailability() { this.availability = await isChallengeAvailable('player-position') },
    async startChallenge({ difficulty, config }) {
      if (!this.availability.available) return
      
      // Guardar configuración de dificultad
      this.selectedDifficulty = difficulty
      this.difficultyConfig = config
      const timeLimit = config.time
      
      try {
        // capture XP before
        try {
          const snap = await captureLevelSnapshot()
          this.levelBefore = snap.level
          this.xpBeforeTotal = snap.xpTotal
          this.beforePercent = snap.percent
        } catch {}
        this.rng = createDailyRng('player-position')
        this.difficultyConfig = config
        this.sessionId = await startChallengeSession('player-position', timeLimit)
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
            if (result === 'win') celebrateGameWin()
            else announceGameLoss()
            this.finishChallenge(result)
          }
        }, 1000)
      } catch (e) {
        console.error('[PlayerPosition challenge start]', e)
      }
    },
    async finishChallenge(result) {
      if (this.allowXp && this.xpEarned > 0) {
        await awardXpBatch({ gameCode: 'player-position', totalXp: this.xpEarned, corrects: this.corrects }).catch(() => {})
      }
      try {
        await completeChallengeSession(this.sessionId, this.score, this.xpEarned, { maxStreak: this.maxStreak, result, corrects: this.corrects, attempts: this.attempts, errors: Math.max(0, (this.attempts || 0) - (this.corrects || 0)), maxWrongStreak: this.maxWrongStreak || 0 })

        const snap = await captureLevelSnapshot()
        this.levelAfter = snap.level
        this.xpAfterTotal = snap.xpTotal
        this.afterPercent = snap.percent
        this.xpToNextAfter = snap.xpToNext
        if ((this.levelAfter || 0) > (this.levelBefore || 0)) {
          celebrateGameLevelUp(this.levelAfter, 500)
        }
        
        // Save XP snapshot
        await completeChallengeSession(this.sessionId, this.score, this.xpEarned, {
          xpView: {
            levelBefore: this.levelBefore, xpBeforeTotal: this.xpBeforeTotal,
            levelAfter: this.levelAfter, xpAfterTotal: this.xpAfterTotal,
            beforePercent: this.beforePercent, afterPercent: this.afterPercent,
            xpToNextAfter: this.xpToNextAfter, xpEarned: this.xpEarned
          }
        })
        
        this.lifetimeMaxStreak = Math.max(await fetchLifetimeMaxStreak('player-position') || 0, this.maxStreak || 0)
        
        // Show summary
        this.progressShown = this.beforePercent
        this.showSummary = true
        requestAnimationFrame(() => setTimeout(() => { this.progressShown = this.afterPercent }, 40))
        
        import('../../services/game-modes').then(mod => mod.checkAndUnlockDailyWins('player-position')).catch(()=>{})
      } catch (e) {
        console.error('[PlayerPosition finish]', e)
      }
    }
  }
}
</script>

<template>
  <GameShell title="Posición del jugador" :backPath="backPath()">
    <template #stat>
      <div class="inline-flex items-center gap-2 rounded-lg bg-slate-800/70 border border-white/12 px-2.5 py-1 shadow-lg shadow-black/20">
        <span class="text-slate-400 text-[10px] uppercase tracking-wider font-semibold">Puntaje</span>
        <span class="font-display text-white font-extrabold text-base leading-none whitespace-nowrap">{{ score }}/{{ attempts * 10 }}</span>
        <StreakBadge :streak="streak" />
      </div>
    </template>
    <GamePreviewModal
      :open="overlayOpen && mode === 'challenge' && !reviewMode"
      gameName="Posición del jugador"
      gameDescription="Identificá la posición correcta del jugador mostrado"
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

        <!-- Timer -->
        <div v-if="mode==='challenge'" class="absolute left-4 top-4 z-20 pointer-events-none">
          <CircularTimer :seconds="Math.max(0, timeLeft)" :total="chosenSeconds" />
        </div>
        <div v-if="shieldActive" class="absolute right-4 top-4 z-20 text-xl animate-pulse" title="Escudo activo">🛡️</div>

        <Transition name="round-fade" mode="out-in">
          <div :key="roundKey" class="relative">
            <div class="flex flex-col items-center gap-3 pt-5">
              <img v-if="current" :src="current.image" :alt="current.name" class="w-36 h-36 sm:w-44 sm:h-44 object-cover rounded-2xl ring-1 ring-white/10 shadow-xl" />
              <p class="text-slate-200 text-center text-base">¿Cuál es la posición de <strong class="text-white">{{ current?.name }}</strong>?</p>
              <Transition name="hint-fade">
                <p v-if="hintVisible && current" class="text-center text-amber-300 text-sm font-medium">
                  Juega en {{ current.teamName }}
                </p>
              </Transition>
            </div>
            <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button v-for="opt in options" :key="opt.label" @click="pick(opt)" :class="optionClass(opt)" :disabled="answered || timeOver || eliminatedOptions.includes(opt.value)" v-show="!eliminatedOptions.includes(opt.value)"
                class="transition-transform duration-150 active:scale-[0.98]">
                {{ opt.label }}
              </button>
            </div>
          </div>
        </Transition>

        <!-- Ayudas (barra integrada, abajo de la tarjeta) -->
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
          :winThreshold="10"
          :backPath="backPath()"
          :xpEarned="xpEarned"
          :difficulty="selectedDifficulty"
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
</style>


