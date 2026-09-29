<script>
import GameShell from '../../components/game/GameShell.vue';
import { initState, loadPlayers, nextRound, optionClass, pick, flag } from '../../services/nationality';
import { initScoring } from '../../services/scoring'
import { isChallengeAvailable, startChallengeSession, completeChallengeSession, fetchLifetimeMaxStreak } from '../../services/game-modes'
import { getUserLevel, captureLevelSnapshot } from '../../services/xp'
import { awardXpBatch } from '../../services/game-xp'
import { createDailyRng } from '../../services/seeded-random'
import { gameSummaryBlurb, getGameMetadata } from '../../services/games'
import { celebrateCorrect, celebrateGameLevelUp, GAME_TYPES } from '../../services/game-celebrations'
import GamePreviewModal from '../../components/game/GamePreviewModal.vue'
import GameSummaryPopup from '../../components/game/GameSummaryPopup.vue'
import ScoreBug from '../../components/game/ScoreBug.vue'
import KickoffOverlay from '../../components/game/KickoffOverlay.vue'
import TimedEndOverlay from '../../components/game/TimedEndOverlay.vue'
import timedChallenge from '../../mixins/timedChallenge'
import PowerupBar from '../../components/game/PowerupBar.vue'

export default {
  name: 'NationalityGame',
  components: { GameShell, GamePreviewModal, GameSummaryPopup, PowerupBar, ScoreBug, KickoffOverlay, TimedEndOverlay },
  mixins: [timedChallenge],
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
    if (this.timeOver || this.answered) return
    if (this.shieldActive && option.value !== this.current.cname) {
      // El escudo frena el error: no cuenta y la racha se mantiene
      this.shieldActive = false
      this.answered = true
      this.selected = option.value
      this.afterShieldSave()
      return
    }
    const prevStreak = this.streak
    const prevXp = this.xpEarned
    const ok = pick(this, option, null)
    this.afterAnswer(ok, { optValue: option.value, xpGained: this.xpEarned - prevXp, prevStreak })
  },
  isCorrectOption(opt) { return opt.value === this.current?.cname },
  handlePowerup(type, btnEl) { this.runPowerup(type, btnEl) },
    optionClass(opt) { return optionClass(this, opt) },
    // Bandera grande: se pide en 160 px para que se vea nítida a ~90 px en pantallas densas
    flag(opt) { return opt?.code ? `https://flagcdn.com/w160/${String(opt.code).toLowerCase()}.png` : flag(opt?.code, 40) },
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
        this.sessionId = await startChallengeSession('nationality', timeLimit, { difficulty: this.selectedDifficulty })
        this.overlayOpen = false
        this.beginClock(timeLimit)
      } catch (e) {
        console.error('[Nationality challenge start]', e)
      }
    },
    async finishChallenge(result) {
      if (this.allowXp && this.xpEarned > 0) {
        await awardXpBatch({ gameCode: 'nationality', totalXp: this.xpEarned, corrects: this.corrects }).catch(() => {})
      }
      await completeChallengeSession(this.sessionId, this.score, this.xpEarned, { maxStreak: this.maxStreak, result, corrects: this.corrects, attempts: this.attempts, errors: Math.max(0, (this.attempts || 0) - (this.corrects || 0)), maxWrongStreak: this.maxWrongStreak || 0, timeBonus: this.timeBonusInfo, ...this.timedStats() }).catch(()=>{})
      
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
                  <img v-if="current" :src="current.image" :alt="current.name" />
                </div>
                <div class="tq-who"><b>{{ current?.name }}</b><span>¿De qué país es?</span></div>
              </div>
              <div class="tq-opts tq-opts--flags">
                <p class="tq-q">Elegí la bandera</p>
                <button
                  v-for="opt in options"
                  :key="opt.label"
                  :data-opt="String(opt.value)"
                  :class="['tq-opt', optionClass(opt)]"
                  :disabled="timeOver || answered || eliminatedOptions.includes(opt.value)"
                  v-show="!eliminatedOptions.includes(opt.value)"
                  @click="pick(opt)"
                >
                  <span class="tq-flag"><img v-if="opt.code" :src="flag(opt)" alt="" draggable="false" /></span>
                  <span class="tq-flag-nm">{{ opt.label }}</span>
                </button>
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
            backPath="/play/points"
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
  .streak-enter-enter-active { transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
  .streak-enter-leave-active { transition: all 0.15s ease; }
  .streak-enter-enter-from { opacity: 0; transform: scale(0.5); }
  .streak-enter-leave-to { opacity: 0; transform: scale(0.8); }
  .time-over-fade-enter-active { transition: opacity 0.4s ease, transform 0.4s ease; }
  .time-over-fade-enter-from { opacity: 0; transform: translateY(6px); }
  </style>


