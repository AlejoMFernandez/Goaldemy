<script>
import AppH1 from '../../components/common/AppH1.vue'
import { getAllPlayers, getAllPlayersAsync } from '../../services/players'
import { initScoring, onCorrect, onIncorrect } from '../../services/scoring'
import { awardXpBatch } from '../../services/game-xp'
import { createDailyRng } from '../../services/seeded-random'
import { celebrateCorrect, celebrateIncorrect, checkEarlyWin, celebrateGameWin, announceGameLoss, celebrateGameLevelUp } from '../../services/game-celebrations'
import { playTimeUpSound } from '../../services/sounds'
import { getGameMetadata } from '../../services/games'
import GamePreviewModal from '../../components/game/GamePreviewModal.vue'
import GameSummaryPopup from '../../components/game/GameSummaryPopup.vue'
import CircularTimer from '../../components/game/CircularTimer.vue'
import StreakBadge from '../../components/game/StreakBadge.vue'
import PowerupBar from '../../components/game/PowerupBar.vue'
import { isChallengeAvailable, startChallengeSession, completeChallengeSession, fetchLifetimeMaxStreak } from '../../services/game-modes'
import { getUserLevel, captureLevelSnapshot } from '../../services/xp'
import { shuffleArray } from '../../services/game-common'

export default {
  name: 'ShirtNumber',
  components: { AppH1, GamePreviewModal, GameSummaryPopup, CircularTimer, StreakBadge, PowerupBar },
  computed: {
    gameMetadata() { return getGameMetadata('shirt-number') }
  },
  data() {
    return {
      // pool
      allPlayers: [],
      current: null,
      options: [], // { label, value: number }
      answered: false,
      selected: null,
      feedback: null,
      roundKey: 0,
      loading: true,
      // scoring
      ...initScoring(10),
      streak: 0,
      maxStreak: 0,
      allowXp: true,
      xpEarned: 0,
      // modes / challenge timing
  mode: 'normal',
  reviewMode: false,
      overlayOpen: false,
      availability: { available: true, reason: null },
      chosenSeconds: 30,
      timeLeft: 0,
      timeOver: false,
      earlyWin: false,
      timer: null,
      sessionId: null,
      // summary/levels
      showSummary: false,
      lifetimeMaxStreak: 0,
      levelBefore: null,
      levelAfter: null,
      xpBeforeTotal: 0,
      xpAfterTotal: 0,
      beforePercent: 0,
      afterPercent: 0,
      progressShown: 0,
      xpToNextAfter: null,
      // difficulty
      selectedDifficulty: 'normal',
      difficultyConfig: null,
      // Powerups
      shieldActive: false,
      eliminatedOptions: [],
      hintVisible: false,
    }
  },
  mounted() {
    const mode = (this.$route.query.mode || '').toString().toLowerCase()
    if (mode === 'free') this.mode = 'free'
    else if (mode === 'challenge') this.mode = 'challenge'
    else if (mode === 'review') { this.mode = 'challenge'; this.reviewMode = true }
    else this.mode = 'normal'
    if (this.mode === 'free') this.allowXp = false

    this.load().then(() => this.nextRound())

    if (this.reviewMode) {
      import('../../services/game-modes').then(async (mod) => {
        const last = await mod.fetchTodayLastSession('shirt-number')
        if (last) {
          const m = last.metadata || {}
          this.score = Number(last.score_final || 0)
          this.maxStreak = Number(m.maxStreak || 0)
          this.corrects = Number(m.corrects || 0)
          this.timeOver = true
          // Populate XP summary from snapshot if available
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
          // Lifetime best for header
          try { this.lifetimeMaxStreak = Math.max(await mod.fetchLifetimeMaxStreak('shirt-number') || 0, this.maxStreak || 0) } catch {}
          this.showSummary = true
        }
      }).catch(()=>{})
    } else if (this.mode === 'challenge') {
      this.overlayOpen = true
      this.checkAvailability()
    }
  },
  methods: {
    blurb() { return gameSummaryBlurb('shirt-number') },
    async load() {
      // Only players with a valid shirt number
      const all = (await getAllPlayersAsync()).filter(p => Number.isFinite(p?.shirtNumber))
      this.allPlayers = all
      this.loading = false
    },
    buildOptions(correct) {
      const rand = this.rng || Math.random
      const used = new Set([Number(correct.shirtNumber)])
      const nums = []
      for (const p of this.allPlayers) {
        const n = Number(p.shirtNumber)
        if (!Number.isFinite(n)) continue
        if (!used.has(n)) { used.add(n); nums.push(n) }
        if (nums.length >= 20) break
      }
      const distractors = []
      while (distractors.length < 3 && nums.length > 0) {
        const i = Math.floor(rand() * nums.length)
        distractors.push(nums.splice(i, 1)[0])
      }
      const opts = [Number(correct.shirtNumber), ...distractors].slice(0,4).map(n => ({ label: String(n), value: n }))
      return shuffleArray(opts, this.rng)
    },
    nextRound() {
      if (!this.allPlayers.length) return
      const rand = this.rng || Math.random
      const idx = Math.floor(rand() * this.allPlayers.length)
      this.current = this.allPlayers[idx]
      this.options = this.buildOptions(this.current)
      this.answered = false
      this.selected = null
      this.feedback = null
      this.roundKey += 1
    },
    backPath() { return this.mode === 'free' ? '/play/free' : '/play/points' },
    optionClass(opt) {
      const base = 'rounded-lg border px-4 py-2 text-slate-200 transition text-left'
      if (!this.answered) return base + ' border-white/10 hover:border-white/25 hover:bg-white/5 active:scale-[0.97]'
      const isCorrect = Number(opt.value) === Number(this.current.shirtNumber)
      const isSelected = Number(opt.value) === Number(this.selected)
      if (isCorrect) return base + ' border-green-500 bg-green-500/10 text-green-300 option-correct'
      if (isSelected) return base + ' border-red-500 bg-red-500/10 text-red-300 shake'
      return base + ' border-white/10 opacity-50'
    },
    choose(opt) {
      if (this.timeOver || this.earlyWin) return false
      if (this.answered) return false
      const correct = Number(opt.value) === Number(this.current?.shirtNumber)
      if (this.shieldActive && !correct) {
        this.shieldActive = false
        this.answered = true
        this.selected = opt.value
        setTimeout(() => { this.nextRound(); this.eliminatedOptions = []; this.hintVisible = false }, 800)
        return false
      }
      this.answered = true
      this.selected = opt.value
      if (correct) {
        celebrateCorrect()
        const nextStreak = (this.streak || 0) + 1
        const nextCorrects = (this.corrects || 0) + 1
        if (this.allowXp) {
          this.xpEarned += (this.difficultyConfig?.xpPerCorrect || 10)
        }
        onCorrect(this)
        this.streak = nextStreak
        this.corrects = nextCorrects
        this.maxStreak = Math.max(this.maxStreak || 0, nextStreak)
      } else {
        celebrateIncorrect()
        onIncorrect(this)
        this.streak = 0
      }
      setTimeout(() => { this.nextRound(); this.eliminatedOptions = []; this.hintVisible = false }, 800)
      return correct
    },
    handlePowerup(type) {
      if (type === 'fifty_fifty' && this.options.length > 2) {
        const wrong = this.options.filter(o => Number(o.value) !== Number(this.current.shirtNumber))
        this.eliminatedOptions = wrong.slice(0, 2).map(o => o.value)
      } else if (type === 'shield') {
        this.shieldActive = true
      } else if (type === 'extra_time') {
        this.timeLeft = Math.min(this.timeLeft + 15, 999)
      } else if (type === 'reveal_hint') {
        this.hintVisible = true
      }
    },
    async checkAvailability() { this.availability = await isChallengeAvailable('shirt-number') },
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
        this.rng = createDailyRng('shirt-number')
        this.sessionId = await startChallengeSession('shirt-number', timeLimit)
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
            if (result === 'win') celebrateGameWin()
            else announceGameLoss()
            this.finishChallenge(result)
          }
        }, 1000)
      } catch (e) {
        console.error('[ShirtNumber challenge start]', e)
      }
    },
    async finishChallenge(result) {
      if (this.allowXp && this.xpEarned > 0) {
        await awardXpBatch({ gameCode: 'shirt-number', totalXp: this.xpEarned, corrects: this.corrects }).catch(() => {})
      }
      try {
        await completeChallengeSession(this.sessionId, this.score, this.xpEarned, { maxStreak: this.maxStreak, result, corrects: this.corrects })
        
        const snap = await captureLevelSnapshot()
        this.levelAfter = snap.level
        this.xpAfterTotal = snap.xpTotal
        this.afterPercent = snap.percent
        this.xpToNextAfter = snap.xpToNext

        if ((this.levelAfter || 0) > (this.levelBefore || 0)) {
          celebrateGameLevelUp(this.levelAfter, 500)
        }
        
        await completeChallengeSession(this.sessionId, this.score, this.xpEarned, {
          xpView: {
            levelBefore: this.levelBefore, xpBeforeTotal: this.xpBeforeTotal,
            levelAfter: this.levelAfter, xpAfterTotal: this.xpAfterTotal,
            beforePercent: this.beforePercent, afterPercent: this.afterPercent,
            xpToNextAfter: this.xpToNextAfter, xpEarned: this.xpEarned
          }
        })
        
        this.lifetimeMaxStreak = Math.max(await fetchLifetimeMaxStreak('shirt-number') || 0, this.maxStreak || 0)
        this.progressShown = this.beforePercent
        this.showSummary = true
        requestAnimationFrame(() => setTimeout(() => { this.progressShown = this.afterPercent }, 40))
        
        import('../../services/game-modes').then(mod => mod.checkAndUnlockDailyWins('shirt-number')).catch(()=>{})
      } catch (e) {
        console.error('[ShirtNumber finish]', e)
      }
    },
  }
}
</script>

<template>
  <section class="grid place-items-center min-h-[calc(100dvh-4rem)]">
    <GamePreviewModal
      :open="overlayOpen && mode === 'challenge' && !reviewMode"
      gameName="Número de camiseta"
      gameDescription="Identificá el número de camiseta correcto del jugador"
      :mechanic="gameMetadata.mechanic"
      :videoUrl="gameMetadata.videoUrl"
      :tips="gameMetadata.tips"
      @close="overlayOpen = false"
      @start="startChallenge"
    />
    <div class="space-y-4 w-full max-w-4xl">
      <div class="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-3 w-full">
        <AppH1 class="text-3xl md:text-4xl flex-none">Número de camiseta</AppH1>
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
        
        <Transition name="round-fade" mode="out-in">
          <div :key="roundKey">
            <div class="flex flex-col items-center gap-2">
              <p class="text-slate-200 text-center text-base">Elegí el número de camiseta correcto</p>
              <img v-if="current" :src="current.image" :alt="current.name" class="mb-3 w-32 h-32 sm:w-36 sm:h-36 object-cover rounded-lg" />
              <div class="text-slate-300 text-sm">{{ current?.name }}</div>
            </div>
            <Transition name="hint-fade">
              <p v-if="hintVisible && current" class="text-center text-amber-300 text-sm font-medium mt-1">
                Juega en {{ current.teamName }}
              </p>
            </Transition>
            <div class="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button v-for="opt in options" :key="opt.value" :class="optionClass(opt)" :disabled="timeOver || eliminatedOptions.includes(opt.value)" v-show="!eliminatedOptions.includes(opt.value)" @click="choose(opt)">#{{ opt.label }}</button>
            </div>
          </div>
        </Transition>

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
