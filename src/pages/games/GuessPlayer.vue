<script>
import GameShell from '../../components/game/GameShell.vue'
import { initState, loadPlayers, nextRound, pickAnswer, optionClass } from '../../services/guess-player-mcq'
import { initScoring } from '../../services/scoring'
import { isChallengeAvailable, startChallengeSession, completeChallengeSession, fetchLifetimeMaxStreak } from '../../services/game-modes'
import { getUserLevel, captureLevelSnapshot } from '../../services/xp'
import { awardXpBatch } from '../../services/game-xp'
import { createDailyRng } from '../../services/seeded-random'
import { celebrateCorrect, celebrateGameLevelUp } from '../../services/game-celebrations'

import { getGameMetadata } from '../../services/games'

import { getAuthUser } from '../../services/auth'
import { setPendingGuestClaim } from '../../services/guest-play'
import GamePreviewModal from '../../components/game/GamePreviewModal.vue'
import GameSummaryPopup from '../../components/game/GameSummaryPopup.vue'
import ScoreBug from '../../components/game/ScoreBug.vue'
import KickoffOverlay from '../../components/game/KickoffOverlay.vue'
import TimedEndOverlay from '../../components/game/TimedEndOverlay.vue'
import timedChallenge from '../../mixins/timedChallenge'
import PowerupBar from '../../components/game/PowerupBar.vue'

// "La foto se aclara": la imagen arranca borrosa y se aclara rápido (el reloj
// de la partida no da para esperar: en Difícil son 3 s por jugador).
// Segundos hasta que la foto queda nítida, por dificultad. La curva es rápida
// al principio (a la mitad del tiempo ya casi se reconoce).
// Acertar antes de que esté nítida multiplica el XP del acierto: 2× al
// instante, baja hasta 1× cuando la foto ya está nítida (nunca menos que hoy).
const REVEAL_BY_DIFFICULTY = { easy: 2.2, normal: 1.8, hard: 1.3 }
const MAX_BLUR_PX = 10

export default {
  name: 'GuessPlayer',
  components: { GameShell, GamePreviewModal, GameSummaryPopup, PowerupBar, ScoreBug, KickoffOverlay, TimedEndOverlay },
  mixins: [timedChallenge],
  computed: {
    gameMetadata() {
      return getGameMetadata('guess-player')
    },
    isGuest() {
      return !getAuthUser()?.id
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
      // Foto que se aclara
      roundStartedAt: 0,
      blurPx: MAX_BLUR_PX,
      potentialXp: 0,
      xpMultiplier: 1,
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
    this.nextRound()
    this.startBlurLoop()

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
  beforeUnmount() {
    cancelAnimationFrame(this._blurRaf)
  },
  methods: {
    nextRound() {
      nextRound(this)
      this.roundStartedAt = performance.now()
      this.blurPx = MAX_BLUR_PX
    },
    elapsedSeconds() {
      return Math.max(0, (performance.now() - (this.roundStartedAt || performance.now())) / 1000)
    },
    revealSeconds() { return REVEAL_BY_DIFFICULTY[this.selectedDifficulty] || REVEAL_BY_DIFFICULTY.normal },
    speedMultiplier() {
      const s = this.elapsedSeconds(), R = this.revealSeconds()
      return 1 + Math.max(0, (R - s) / R)
    },
    startBlurLoop() {
      const loop = () => {
        // Con el modal previo o el pitazo inicial en pantalla, la foto queda borrosa y la ronda no corre
        if (this.kickoff || this.overlayOpen) this.roundStartedAt = performance.now()
        if (this.answered || !this.current) {
          if (this.blurPx !== 0) this.blurPx = 0
        } else {
          const s = this.elapsedSeconds()
          const k = Math.min(1, s / this.revealSeconds())
          const b = Math.round(MAX_BLUR_PX * Math.pow(1 - k, 2) * 2) / 2 // ease-out: se aclara rápido
          if (b !== this.blurPx) this.blurPx = b
          const base = this.difficultyConfig?.xpPerCorrect || 10
          const xp = Math.round(base * this.speedMultiplier())
          if (xp !== this.potentialXp) this.potentialXp = xp
        }
        this._blurRaf = requestAnimationFrame(loop)
      }
      cancelAnimationFrame(this._blurRaf)
      this._blurRaf = requestAnimationFrame(loop)
    },
    backPath() {
      return this.mode === 'free' ? '/play/free' : '/play/points'
    },
    async choose(opt) {
      if (this.timeOver || this.answered) return false
      if (this.shieldActive && opt.value !== this.current.name) {
        // El escudo frena el error: no cuenta y la racha se mantiene
        this.shieldActive = false
        this.answered = true
        this.selected = opt.value
        this.afterShieldSave()
        return false
      }
      const prevStreak = this.streak
      const prevXp = this.xpEarned
      this.xpMultiplier = this.speedMultiplier()
      const ok = await pickAnswer(this, opt, null)
      if (ok && this.mode === 'challenge') celebrateCorrect()
      this.afterAnswer(ok, { optValue: opt.value, xpGained: this.xpEarned - prevXp, prevStreak })
      return ok
    },
    isCorrectOption(opt) { return opt.value === this.current?.name },
    handlePowerup(type, btnEl) { this.runPowerup(type, btnEl) },
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
        this.sessionId = await startChallengeSession('guess-player', timeLimit, { difficulty: this.selectedDifficulty })
        this.overlayOpen = false
        this.beginClock(timeLimit)
      } catch (e) {
        console.error('[GuessPlayer challenge start]', e)
      }
    },
    async finishChallenge(result) {
      if (this.isGuest) {
        // Sin cuenta: no hay a quién otorgarle XP server-side. Guardamos el resultado
        // para reclamarlo de verdad si se registra (ver services/guest-play.js).
        if (this.xpEarned > 0) {
          setPendingGuestClaim({ game: 'guess-player', corrects: this.corrects, total: 10, maxStreak: this.maxStreak })
        }
      } else if (this.allowXp && this.xpEarned > 0) {
        await awardXpBatch({ gameCode: 'guess-player', totalXp: this.xpEarned, corrects: this.corrects }).catch(() => {})
      }
      await completeChallengeSession(this.sessionId, this.score, this.xpEarned, { maxStreak: this.maxStreak, result, corrects: this.corrects, attempts: this.attempts, errors: Math.max(0, (this.attempts || 0) - (this.corrects || 0)), maxWrongStreak: this.maxWrongStreak || 0, timeBonus: this.timeBonusInfo, ...this.timedStats() }).catch(()=>{})

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
  <GameShell title="Adivina el jugador" :backPath="backPath()">
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
  <div class="w-full max-w-3xl mx-auto">

      <div v-if="loading" class="tq-skel" aria-busy="true" aria-label="Cargando">
        <div class="tq-grid">
          <div class="tq-card"><div class="tq-photo sk-box"></div><div class="tq-who"><i class="sk-line"></i><i class="sk-line sk-short"></i></div></div>
          <div class="tq-opts"><i v-for="k in 4" :key="k" class="sk-opt"></i></div>
        </div>
      </div>
      <div v-else class="tq" :class="{ 'tq--frozen': frozen }">
        <div class="tq-stage">
          <!-- Marcador tipo TV: reloj, aciertos, escudo, XP, fila de 10 pelotas y racha -->
          <ScoreBug
            v-if="mode === 'challenge' && !reviewMode"
            ref="bug"
            :seconds="Math.max(0, timeLeft)"
            :running="clockRunning"
            :corrects="corrects"
            :target="10"
            :xp="xpEarned"
            :streak="streak"
            :shield="shieldActive"
            :finished="endOverlay ? endOverlay.kind : ''"
          />
          <Transition name="round-fade" mode="out-in">
            <div :key="roundKey" class="tq-grid">
              <div ref="card" class="tq-card" :class="{ 'is-shielded': shieldActive }">
                <span v-if="shieldActive" class="tq-bubble" aria-hidden="true"></span>
                <Transition name="tq-hint">
                  <span v-if="hintVisible && current" class="tq-hint">Juega en {{ current.teamName }}</span>
                </Transition>
                <div class="tq-photo">
                  <img v-if="current" :src="current.image" :alt="answered ? current.name : 'Jugador misterioso'" :style="{ filter: blurPx ? `blur(${blurPx}px)` : 'none' }" />
                  <span v-if="mode === 'challenge' && allowXp && !answered" class="tq-xpchip">+{{ potentialXp }} XP</span>
                </div>
                <div class="tq-who"><b>{{ answered ? current?.name : '¿Quién es?' }}</b><span>{{ answered ? current?.teamName : 'La foto se va aclarando' }}</span></div>
              </div>
              <div class="tq-opts">
                <p class="tq-q">Elegí el jugador</p>
                <button
                  v-for="opt in options"
                  :key="opt.value"
                  :data-opt="String(opt.value)"
                  :class="['tq-opt', optionClass(opt)]"
                  :disabled="timeOver || answered || eliminatedOptions.includes(opt.value)"
                  v-show="!eliminatedOptions.includes(opt.value)"
                  @click="choose(opt)"
                >{{ opt.label }}</button>
              </div>
            </div>
          </Transition>
        </div>

        <!-- Ayudas: cada una se ve actuar (ver mixins/timedChallenge.js → runPowerup) -->
        <PowerupBar
          v-if="mode === 'challenge' && !timeOver && !showSummary"
          :hide="overlayOpen || kickoff"
          :disabled-types="answered ? ['fifty_fifty','shield','extra_time','reveal_hint'] : []"
          :active-types="shieldActive ? ['shield'] : []"
          @use="handlePowerup"
        />

        <!-- Resumen: se abre recién cuando termina el cartel de SIN TIEMPO / ¡BASTA! -->
        <GameSummaryPopup
          :show="showSummary && !endOverlay"
          :errors="summaryErrors"
          :xp-breakdown="xpBreakdown"
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
          :guest="isGuest"
          @close="showSummary = false"
        />
      </div>

      <!-- Pitazo inicial (el reloj arranca cuando termina) y final de partida -->
      <KickoffOverlay v-if="kickoff" @done="onKickoffDone" />
      <TimedEndOverlay v-if="endOverlay" v-bind="endOverlay" @done="onEndOverlayDone" />
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


