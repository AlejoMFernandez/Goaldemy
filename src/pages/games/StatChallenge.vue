<script>
import AppH1 from '../../components/common/AppH1.vue'
import { getAllPlayersAsync } from '../../services/players'
import { initScoring, onCorrect, onIncorrect } from '../../services/scoring'
import { awardXpBatch } from '../../services/game-xp'
import { createDailyRng } from '../../services/seeded-random'
import { celebrateCorrect, celebrateIncorrect, celebrateGameWin, announceGameLoss, celebrateGameLevelUp } from '../../services/game-celebrations'
import { playTimeUpSound } from '../../services/sounds'
import { getGameMetadata } from '../../services/games'
import GamePreviewModal from '../../components/game/GamePreviewModal.vue'
import GameSummaryPopup from '../../components/game/GameSummaryPopup.vue'
import CircularTimer from '../../components/game/CircularTimer.vue'
import StreakBadge from '../../components/game/StreakBadge.vue'
import { isChallengeAvailable, startChallengeSession, completeChallengeSession, fetchLifetimeMaxStreak } from '../../services/game-modes'
import { captureLevelSnapshot } from '../../services/xp'

const POS_LABELS = { 0: 'Arquero', 1: 'Defensor', 2: 'Mediocampista', 3: 'Delantero' }

function generateRound(allPlayers, rng, usedIds) {
  const withStats = allPlayers.filter(p =>
    p.stats && (p.stats.goals > 0 || p.stats.assists > 0 || p.stats.appearances > 0) && !usedIds.has(p.id)
  )
  if (withStats.length < 4) return null

  const correctIdx = Math.floor(rng() * withStats.length)
  const correct = withStats[correctIdx]

  const samePos = withStats.filter(p => p.id !== correct.id && p.positionId === correct.positionId)
  const distractors = []
  const pool = samePos.length >= 3 ? samePos : withStats.filter(p => p.id !== correct.id)
  const shuffled = [...pool].sort(() => rng() - 0.5)
  for (const p of shuffled) {
    if (distractors.length >= 3) break
    if (p.id !== correct.id) distractors.push(p)
  }

  const options = [correct, ...distractors].sort(() => rng() - 0.5)
  return { correct, options }
}

export default {
  name: 'StatChallenge',
  components: { AppH1, GamePreviewModal, GameSummaryPopup, CircularTimer, StreakBadge },
  computed: {
    gameMetadata() { return getGameMetadata('stat-challenge') },
    posLabel() { return POS_LABELS[this.currentCorrect?.positionId] || 'Jugador' }
  },
  data() {
    return {
      allPlayers: [],
      loading: true,
      // Round state
      currentCorrect: null,
      options: [],
      answered: false,
      selectedId: null,
      roundKey: 0,
      usedIds: new Set(),
      // Scoring
      ...initScoring(15),
      streak: 0,
      maxStreak: 0,
      allowXp: true,
      xpEarned: 0,
      // Mode / challenge
      mode: 'normal',
      reviewMode: false,
      overlayOpen: false,
      availability: { available: true, reason: null },
      chosenSeconds: 45,
      timeLeft: 0,
      timeOver: false,
      timer: null,
      sessionId: null,
      // Summary
      showSummary: false,
      lifetimeMaxStreak: 0,
      // Difficulty
      selectedDifficulty: 'normal',
      difficultyConfig: null,
      // XP progress
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

    this.load().then(() => this.nextRound())

    if (this.reviewMode) {
      import('../../services/game-modes').then(async (mod) => {
        const last = await mod.fetchTodayLastSession('stat-challenge')
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
          try { this.lifetimeMaxStreak = Math.max(await mod.fetchLifetimeMaxStreak('stat-challenge') || 0, this.maxStreak || 0) } catch {}
          this.showSummary = true
        }
      }).catch(() => {})
    } else if (this.mode === 'challenge') {
      this.overlayOpen = true
      this.checkAvailability()
    }
  },
  methods: {
    async load() {
      const all = (await getAllPlayersAsync()).filter(p =>
        p.stats && (p.stats.goals > 0 || p.stats.assists > 0 || p.stats.appearances > 0)
      )
      this.allPlayers = all
      this.loading = false
    },
    nextRound() {
      if (!this.allPlayers.length) return
      const rng = this.rng || Math.random
      const round = generateRound(this.allPlayers, rng, this.usedIds)
      if (!round) { this.usedIds.clear(); return this.nextRound() }
      this.usedIds.add(round.correct.id)
      this.currentCorrect = round.correct
      this.options = round.options
      this.answered = false
      this.selectedId = null
      this.roundKey += 1
    },
    backPath() { return this.mode === 'free' ? '/play/free' : '/play/points' },
    optionClass(opt) {
      const base = 'flex items-center gap-3 rounded-xl border px-4 py-3 transition-transform duration-150'
      if (!this.answered) return base + ' border-white/10 hover:border-white/25 hover:bg-white/5 active:scale-[0.97]'
      const isCorrect = opt.id === this.currentCorrect.id
      const isSelected = opt.id === this.selectedId
      if (isCorrect) return base + ' border-green-500 bg-green-500/10 text-green-300'
      if (isSelected) return base + ' border-red-500 bg-red-500/10 text-red-300 shake'
      return base + ' border-white/10 opacity-50'
    },
    choose(opt) {
      if (this.timeOver || this.answered) return
      this.answered = true
      this.selectedId = opt.id
      const correct = opt.id === this.currentCorrect.id
      if (correct) {
        celebrateCorrect()
        const nextStreak = (this.streak || 0) + 1
        if (this.allowXp) this.xpEarned += (this.difficultyConfig?.xpPerCorrect || 15)
        onCorrect(this)
        this.streak = nextStreak
        this.maxStreak = Math.max(this.maxStreak || 0, nextStreak)
      } else {
        celebrateIncorrect()
        onIncorrect(this)
        this.streak = 0
      }
      setTimeout(() => this.nextRound(), 800)
    },
    async checkAvailability() { this.availability = await isChallengeAvailable('stat-challenge') },
    async startChallenge({ difficulty, config }) {
      if (!this.availability.available) return
      this.selectedDifficulty = difficulty
      this.difficultyConfig = config
      const timeLimit = config.time
      try {
        try {
          const snap = await captureLevelSnapshot()
          this.levelBefore = snap.level
          this.xpBeforeTotal = snap.xpTotal
          this.beforePercent = snap.percent
        } catch {}
        this.rng = createDailyRng('stat-challenge')
        this.sessionId = await startChallengeSession('stat-challenge', timeLimit)
        this.overlayOpen = false
        this.chosenSeconds = timeLimit
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
        console.error('[StatChallenge start]', e)
      }
    },
    async finishChallenge(result) {
      if (this.allowXp && this.xpEarned > 0) {
        await awardXpBatch({ gameCode: 'stat-challenge', totalXp: this.xpEarned, corrects: this.corrects }).catch(() => {})
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

        this.lifetimeMaxStreak = Math.max(await fetchLifetimeMaxStreak('stat-challenge') || 0, this.maxStreak || 0)
        this.progressShown = this.beforePercent
        this.showSummary = true
        requestAnimationFrame(() => setTimeout(() => { this.progressShown = this.afterPercent }, 40))

        import('../../services/game-modes').then(mod => mod.checkAndUnlockDailyWins('stat-challenge')).catch(() => {})
      } catch (e) {
        console.error('[StatChallenge finish]', e)
      }
    },
  }
}
</script>

<template>
  <section class="grid place-items-center min-h-[calc(100dvh-4rem)]">
    <GamePreviewModal
      :open="overlayOpen && mode === 'challenge' && !reviewMode"
      gameType="timed"
      gameName="Duelo de Stats"
      gameDescription="Identificá al jugador a partir de sus estadísticas reales"
      :mechanic="gameMetadata.mechanic"
      :videoUrl="gameMetadata.videoUrl"
      :tips="gameMetadata.tips"
      @close="overlayOpen = false"
      @start="startChallenge"
    />
    <div class="space-y-4 w-full max-w-4xl">
      <div class="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-3 w-full">
        <AppH1 class="text-3xl md:text-4xl flex-none">Duelo de Stats</AppH1>
        <div class="flex items-center gap-2 self-stretch sm:self-auto flex-none">
          <router-link :to="backPath()" class="rounded-full border border-white/15 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/5 transition">← Volver</router-link>
          <div class="rounded-xl bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-white/15 px-3 py-2 flex items-center gap-2 shadow-lg shadow-black/20">
            <span class="text-slate-400 text-xs uppercase tracking-wider font-semibold">Puntaje</span>
            <span class="font-display text-white font-extrabold text-lg leading-none whitespace-nowrap">{{ score }}/{{ attempts * 15 }}</span>
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

        <Transition name="round-fade" mode="out-in">
          <div :key="roundKey" v-if="currentCorrect">
            <!-- Stat card -->
            <div class="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-800 to-slate-900 p-6 sm:p-8 text-center space-y-5">
              <span class="inline-block rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm font-semibold text-slate-200">
                {{ posLabel }}
              </span>

              <div class="grid grid-cols-3 gap-3 sm:gap-5">
                <div class="rounded-xl bg-emerald-500/10 border border-emerald-500/15 py-3 px-2">
                  <div class="text-3xl sm:text-4xl font-display font-bold text-emerald-400">{{ currentCorrect.stats.goals }}</div>
                  <div class="text-[10px] sm:text-xs text-emerald-400/60 uppercase tracking-wider mt-1">Goles</div>
                </div>
                <div class="rounded-xl bg-sky-500/10 border border-sky-500/15 py-3 px-2">
                  <div class="text-3xl sm:text-4xl font-display font-bold text-sky-400">{{ currentCorrect.stats.assists }}</div>
                  <div class="text-[10px] sm:text-xs text-sky-400/60 uppercase tracking-wider mt-1">Asistencias</div>
                </div>
                <div class="rounded-xl bg-amber-500/10 border border-amber-500/15 py-3 px-2">
                  <div class="text-3xl sm:text-4xl font-display font-bold text-amber-400">{{ currentCorrect.stats.appearances }}</div>
                  <div class="text-[10px] sm:text-xs text-amber-400/60 uppercase tracking-wider mt-1">Apariciones</div>
                </div>
              </div>

              <p class="text-slate-300 text-sm">¿De quién son estas estadísticas?</p>
            </div>

            <!-- Options -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
              <button v-for="opt in options" :key="opt.id" @click="choose(opt)"
                :disabled="answered || timeOver"
                :class="optionClass(opt)">
                <img :src="opt.image" :alt="opt.name" class="w-12 h-12 rounded-xl object-cover shrink-0" />
                <div class="text-left min-w-0">
                  <div class="text-white font-medium truncate text-sm sm:text-base">{{ opt.name }}</div>
                  <div class="text-slate-400 text-xs truncate">{{ opt.teamName }}</div>
                </div>
              </button>
            </div>
          </div>
        </Transition>

        <!-- Summary -->
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

        <!-- Time over banner -->
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
