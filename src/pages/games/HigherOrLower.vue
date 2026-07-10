<script>
import GameShell from '../../components/game/GameShell.vue'
import { getAllPlayersAsync, sampleDistinct } from '../../services/players'
import { initScoring } from '../../services/scoring'
import { awardXpBatch } from '../../services/game-xp'
import { createDailyRng } from '../../services/seeded-random'
import { celebrateCorrect, celebrateIncorrect, celebrateGameWin, announceGameLoss, celebrateGameLevelUp } from '../../services/game-celebrations'
import { playCorrectSound, playIncorrectSound } from '../../services/sounds'
import { getGameMetadata } from '../../services/games'
import GamePreviewModal from '../../components/game/GamePreviewModal.vue'
import GameSummaryPopup from '../../components/game/GameSummaryPopup.vue'
import StreakBadge from '../../components/game/StreakBadge.vue'
import { isChallengeAvailable, startChallengeSession, completeChallengeSession, fetchLifetimeMaxStreak } from '../../services/game-modes'
import { captureLevelSnapshot } from '../../services/xp'

const CATEGORIES = [
  { key: 'goals', label: 'Goles', field: p => p.stats?.goals ?? 0 },
  { key: 'assists', label: 'Asistencias', field: p => p.stats?.assists ?? 0 },
  { key: 'appearances', label: 'Apariciones', field: p => p.stats?.appearances ?? 0 },
  { key: 'age', label: 'Edad', field: p => p.age ?? 0 },
  { key: 'height', label: 'Altura (cm)', field: p => p.height ?? 0 },
  { key: 'transferValue', label: 'Valor de mercado', field: p => p.transferValue ?? 0 },
]

function formatStat(key, value) {
  if (key === 'transferValue') {
    if (value >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`
    if (value >= 1_000) return `€${(value / 1_000).toFixed(0)}K`
    return `€${value}`
  }
  return String(value)
}

export default {
  name: 'HigherOrLower',
  components: { GameShell, GamePreviewModal, GameSummaryPopup, StreakBadge },
  computed: {
    gameMetadata() { return getGameMetadata('higher-or-lower') },
    target() { return this.difficultyConfig?.target || 12 },
  },
  data() {
    return {
      allPlayers: [],
      leftPlayer: null,
      rightPlayer: null,
      currentCategory: null,
      chain: 0,
      revealed: false,
      gameOver: false,
      animating: false,
      loading: true,
      roundKey: 0,
      usedIds: new Set(),
      rng: null,
      // scoring
      ...initScoring(20),
      allowXp: true,
      xpEarned: 0,
      // modes
      mode: 'normal',
      reviewMode: false,
      overlayOpen: false,
      availability: { available: true, reason: null },
      sessionId: null,
      // summary / levels
      showSummary: false,
      lifetimeMaxStreak: 0,
      selectedDifficulty: 'normal',
      difficultyConfig: null,
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
  mounted() {
    const mode = (this.$route.query.mode || '').toString().toLowerCase()
    if (mode === 'free') this.mode = 'free'
    else if (mode === 'challenge') this.mode = 'challenge'
    else if (mode === 'review') { this.mode = 'challenge'; this.reviewMode = true }
    else this.mode = 'normal'
    if (this.mode === 'free') this.allowXp = false

    this.load()

    if (this.reviewMode) {
      import('../../services/game-modes').then(async (mod) => {
        const last = await mod.fetchTodayLastSession('higher-or-lower')
        if (last) {
          const m = last.metadata || {}
          this.chain = Number(m.chain || 0)
          this.corrects = Number(m.corrects || 0)
          this.score = Number(last.score_final || 0)
          this.maxStreak = Number(m.maxStreak || 0)
          this.gameOver = true
          const v = m.xpView || {}
          if (v && v.levelAfter != null) {
            this.levelBefore = v.levelBefore ?? null
            this.xpBeforeTotal = v.xpBeforeTotal ?? 0
            this.levelAfter = v.levelAfter ?? null
            this.xpAfterTotal = v.xpAfterTotal ?? 0
            this.beforePercent = v.beforePercent ?? 0
            this.afterPercent = v.afterPercent ?? 0
            this.xpToNextAfter = v.xpToNextAfter ?? null
            this.progressShown = this.afterPercent
          }
          try { this.lifetimeMaxStreak = Math.max(await mod.fetchLifetimeMaxStreak('higher-or-lower') || 0, this.maxStreak || 0) } catch {}
          this.showSummary = true
        }
      }).catch(() => {})
    } else if (this.mode === 'challenge') {
      this.overlayOpen = true
      this.checkAvailability()
    }
  },
  methods: {
    backPath() { return this.mode === 'free' ? '/play/free' : '/play/points' },

    async load() {
      const all = (await getAllPlayersAsync()).filter(p => p.age != null || p.height != null)
      this.allPlayers = all
      this.loading = false
      if (!this.reviewMode && this.mode !== 'challenge') this.startNewRound()
    },

    pickCategory(rng, left, right) {
      const rand = rng || Math.random
      const viable = CATEGORIES.filter(c => {
        const hasData = (left && c.field(left) !== 0) || (right && c.field(right) !== 0)
        return hasData
      })
      const pool = viable.length > 0 ? viable : CATEGORIES.filter(c => !['goals','assists','appearances'].includes(c.key))
      return pool[Math.floor(rand() * pool.length)]
    },

    pickPlayer(exclude, rng) {
      const result = sampleDistinct(this.allPlayers, 1, exclude, rng)
      return result.length ? result[0] : null
    },

    startNewRound() {
      if (!this.allPlayers.length) return
      const rand = this.rng || Math.random

      if (!this.leftPlayer) {
        const first = this.pickPlayer(this.usedIds, rand)
        if (first) this.usedIds.add(first.id)
        this.leftPlayer = first
      }

      let attempts = 0
      let cat, right
      do {
        right = this.pickPlayer(this.usedIds, rand)
        cat = this.pickCategory(rand, this.leftPlayer, right)
        attempts++
      } while (right && this.leftPlayer && cat.field(right) === cat.field(this.leftPlayer) && attempts < 20)

      if (right) this.usedIds.add(right.id)
      this.rightPlayer = right
      this.currentCategory = cat
      this.revealed = false
      this.roundKey++
    },

    guess(higher) {
      if (this.revealed || this.gameOver || this.animating) return
      this.revealed = true

      const leftVal = this.currentCategory.field(this.leftPlayer)
      const rightVal = this.currentCategory.field(this.rightPlayer)
      const isHigher = rightVal > leftVal
      const correct = (higher && isHigher) || (!higher && !isHigher)

      if (correct) {
        celebrateCorrect()
        this.chain++
        this.corrects++
        this.maxStreak = Math.max(this.maxStreak || 0, this.chain)
        if (this.allowXp) {
          this.xpEarned += (this.difficultyConfig?.xpPerCorrect || 20)
        }

        if (this.chain >= this.target) {
          // Win
          this.gameOver = true
          celebrateGameWin()
          if (this.allowXp && this.difficultyConfig?.xpCompletion) {
            this.xpEarned += this.difficultyConfig.xpCompletion
          }
          setTimeout(() => this.finishChallenge('win'), 800)
          return
        }

        // Transition: right becomes left, pick new right
        this.animating = true
        setTimeout(() => {
          this.leftPlayer = this.rightPlayer
          this.animating = false
          this.startNewRound()
        }, 600)
      } else {
        celebrateIncorrect()
        this.gameOver = true
        announceGameLoss()
        setTimeout(() => this.finishChallenge('loss'), 1000)
      }
    },

    leftStatDisplay() {
      if (!this.leftPlayer || !this.currentCategory) return ''
      return formatStat(this.currentCategory.key, this.currentCategory.field(this.leftPlayer))
    },

    rightStatDisplay() {
      if (!this.rightPlayer || !this.currentCategory) return '?'
      return formatStat(this.currentCategory.key, this.currentCategory.field(this.rightPlayer))
    },

    async checkAvailability() {
      this.availability = await isChallengeAvailable('higher-or-lower')
    },

    async startChallenge({ difficulty, config }) {
      if (!this.availability.available) return
      this.selectedDifficulty = difficulty
      this.difficultyConfig = config

      try {
        try {
          const snap = await captureLevelSnapshot()
          this.levelBefore = snap.level
          this.xpBeforeTotal = snap.xpTotal
          this.beforePercent = snap.percent
        } catch {}

        this.rng = createDailyRng('higher-or-lower')
        this.sessionId = await startChallengeSession('higher-or-lower', 0)
        this.overlayOpen = false
        this.chain = 0
        this.gameOver = false
        this.usedIds = new Set()
        this.leftPlayer = null
        this.xpEarned = 0
        this.corrects = 0
        this.startNewRound()
      } catch (e) {
        console.error('[HigherOrLower challenge start]', e)
      }
    },

    async finishChallenge(result) {
      this.score = this.chain * (this.difficultyConfig?.xpPerCorrect || 20)

      if (this.allowXp && this.xpEarned > 0) {
        await awardXpBatch({ gameCode: 'higher-or-lower', totalXp: this.xpEarned, corrects: this.corrects }).catch(() => {})
      }

      try {
        await completeChallengeSession(this.sessionId, this.score, this.xpEarned, {
          maxStreak: this.maxStreak, result, corrects: this.corrects, chain: this.chain
        })

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

        this.lifetimeMaxStreak = Math.max(await fetchLifetimeMaxStreak('higher-or-lower') || 0, this.maxStreak || 0)
        this.progressShown = this.beforePercent
        this.showSummary = true
        requestAnimationFrame(() => setTimeout(() => { this.progressShown = this.afterPercent }, 40))

        import('../../services/game-modes').then(mod => mod.checkAndUnlockDailyWins('higher-or-lower')).catch(() => {})
      } catch (e) {
        console.error('[HigherOrLower finish]', e)
      }
    },
  }
}
</script>

<template>
  <GameShell title="Mayor o Menor" :backPath="backPath()">
    <template #stat>
      <div class="inline-flex items-center gap-2 rounded-lg bg-slate-800/70 border border-white/12 px-2.5 py-1 shadow-lg shadow-black/20">
        <span class="text-slate-400 text-[10px] uppercase tracking-wider font-semibold">Cadena</span>
        <span class="font-display text-white font-extrabold text-base leading-none whitespace-nowrap">{{ chain }}/{{ target }}</span>
        <StreakBadge :streak="chain" />
      </div>
    </template>
    <GamePreviewModal
      :open="overlayOpen && mode === 'challenge' && !reviewMode"
      gameType="chain"
      gameName="Mayor o Menor"
      gameDescription="Adiviná si el stat del siguiente jugador es mayor o menor"
      :mechanic="gameMetadata.mechanic"
      :videoUrl="gameMetadata.videoUrl"
      :tips="gameMetadata.tips"
      @close="overlayOpen = false"
      @start="startChallenge"
    />
    <div class="space-y-4 w-full max-w-3xl">

      <div v-if="loading" class="text-center text-slate-300 py-12">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400"></div>
        <p class="mt-3">Cargando...</p>
      </div>

      <div v-else class="relative card p-6 ring-1 ring-white/5">
        <!-- Category badge -->
        <div class="flex justify-center mb-5">
          <span v-if="currentCategory" class="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/20 border border-indigo-400/30 px-4 py-1.5 text-sm font-semibold text-indigo-300">
            {{ currentCategory.label }}
          </span>
        </div>

        <!-- Player cards -->
        <Transition name="round-fade" mode="out-in">
          <div :key="roundKey" class="grid grid-cols-2 gap-4 sm:gap-6">
            <!-- Left player -->
            <div class="flex flex-col items-center text-center space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-6">
              <img v-if="leftPlayer" :src="leftPlayer.image" :alt="leftPlayer.name"
                class="w-28 h-28 sm:w-36 sm:h-36 object-cover rounded-2xl ring-1 ring-white/10 shadow-lg" />
              <p class="text-white font-semibold text-base sm:text-lg truncate max-w-[160px] sm:max-w-[200px]">{{ leftPlayer?.name }}</p>
              <div v-if="leftPlayer?.teamLogo" class="flex items-center gap-1.5">
                <img :src="leftPlayer.teamLogo" :alt="leftPlayer.teamName" class="w-5 h-5 object-contain" />
                <span class="text-slate-400 text-sm truncate max-w-[120px]">{{ leftPlayer?.teamName }}</span>
              </div>
              <div class="mt-1 text-3xl sm:text-4xl font-extrabold text-emerald-400 font-display">
                {{ leftStatDisplay() }}
              </div>
            </div>

            <!-- Right player -->
            <div class="flex flex-col items-center text-center space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-6">
              <img v-if="rightPlayer" :src="rightPlayer.image" :alt="rightPlayer.name"
                class="w-28 h-28 sm:w-36 sm:h-36 object-cover rounded-2xl ring-1 ring-white/10 shadow-lg" />
              <p class="text-white font-semibold text-base sm:text-lg truncate max-w-[160px] sm:max-w-[200px]">{{ rightPlayer?.name }}</p>
              <div v-if="rightPlayer?.teamLogo" class="flex items-center gap-1.5">
                <img :src="rightPlayer.teamLogo" :alt="rightPlayer.teamName" class="w-5 h-5 object-contain" />
                <span class="text-slate-400 text-sm truncate max-w-[120px]">{{ rightPlayer?.teamName }}</span>
              </div>
              <div class="mt-1 text-3xl sm:text-4xl font-extrabold font-display" :class="revealed ? 'text-amber-400' : 'text-slate-500'">
                {{ revealed ? rightStatDisplay() : '?' }}
              </div>

              <!-- Guess buttons -->
              <div v-if="!gameOver" class="flex gap-3 mt-3">
                <button @click="guess(true)" :disabled="revealed || animating"
                  class="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-6 py-2.5 text-sm font-bold text-emerald-300 hover:bg-emerald-500/20 transition active:scale-95 disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1.5">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7"/></svg>
                  Mayor
                </button>
                <button @click="guess(false)" :disabled="revealed || animating"
                  class="rounded-xl border border-red-500/30 bg-red-500/10 px-6 py-2.5 text-sm font-bold text-red-300 hover:bg-red-500/20 transition active:scale-95 disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1.5">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
                  Menor
                </button>
              </div>
            </div>
          </div>
        </Transition>

        <!-- VS divider -->
        <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <span class="text-xs font-bold text-slate-600 uppercase tracking-widest">VS</span>
        </div>

        <!-- Game over banner -->
        <Transition name="time-over-fade">
          <div v-if="gameOver && !showSummary" class="mt-5 flex items-center justify-center gap-2.5 rounded-xl border px-4 py-2.5"
            :class="chain >= target ? 'border-emerald-500/20 bg-emerald-500/10' : 'border-red-500/20 bg-red-500/10'">
            <span class="text-sm font-semibold" :class="chain >= target ? 'text-emerald-300' : 'text-red-300'">
              {{ chain >= target ? 'Cadena completada!' : 'Cadena rota' }}
            </span>
          </div>
        </Transition>

        <!-- Summary popup -->
        <GameSummaryPopup
          :show="showSummary"
          :corrects="chain"
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
          :winThreshold="target"
          :backPath="backPath()"
          @close="showSummary = false"
        />
      </div>
    </div>
  </GameShell>
</template>

<style scoped>
.round-fade-enter-active, .round-fade-leave-active {
  transition: opacity 250ms ease, transform 250ms ease;
}
.round-fade-enter-from { opacity: 0; transform: translateX(30px) scale(0.97); }
.round-fade-leave-to { opacity: 0; transform: translateX(-30px) scale(0.97); }

.time-over-fade-enter-active { transition: opacity 0.4s ease, transform 0.4s ease; }
.time-over-fade-enter-from { opacity: 0; transform: translateY(6px); }
</style>
