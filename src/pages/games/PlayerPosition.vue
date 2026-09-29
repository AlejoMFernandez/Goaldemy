<script>
import GameShell from '../../components/game/GameShell.vue';
import { initState, loadPlayers, nextRound, pickAnswer, optionClass } from '../../services/player-position';
import { getBroadPosition } from '../../services/game-common';
import { initScoring } from '../../services/scoring'
import { celebrateCorrect, celebrateGameLevelUp } from '../../services/game-celebrations'
import { getGameMetadata } from '../../services/games'
import GamePreviewModal from '../../components/game/GamePreviewModal.vue'
import GameSummaryPopup from '../../components/game/GameSummaryPopup.vue'
import ScoreBug from '../../components/game/ScoreBug.vue'
import KickoffOverlay from '../../components/game/KickoffOverlay.vue'
import TimedEndOverlay from '../../components/game/TimedEndOverlay.vue'
import timedChallenge from '../../mixins/timedChallenge'
import PowerupBar from '../../components/game/PowerupBar.vue'
import { isChallengeAvailable, startChallengeSession, completeChallengeSession, fetchLifetimeMaxStreak } from '../../services/game-modes'
import { getUserLevel, captureLevelSnapshot } from '../../services/xp'
import { awardXpBatch } from '../../services/game-xp'
import { createDailyRng } from '../../services/seeded-random'

export default {
  name: 'PlayerPosition',
  components: { GameShell, GamePreviewModal, GameSummaryPopup, PowerupBar, ScoreBug, KickoffOverlay, TimedEndOverlay },
  mixins: [timedChallenge],
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
    gameMetadata() { return getGameMetadata('player-position') },
    // La cancha siempre en el mismo orden: el arco rival arriba, el nuestro abajo
    pitchOptions() {
      const order = { FW: 0, MF: 1, DF: 2, GK: 3 }
      return [...(this.options || [])].sort((a, b) => (order[a.value] ?? 9) - (order[b.value] ?? 9))
    },
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
      if (this.timeOver || this.answered) return false
      if (this.shieldActive && option.value !== getBroadPosition(this.current)) {
        // El escudo frena el error: no cuenta y la racha se mantiene
        this.shieldActive = false
        this.answered = true
        this.selected = option.value
        this.afterShieldSave()
        return false
      }
      const prevStreak = this.streak
      const prevXp = this.xpEarned
      const ok = await pickAnswer(this, option, null)
      this.afterAnswer(ok, { optValue: option.value, xpGained: this.xpEarned - prevXp, prevStreak })
      return ok
    },
    isCorrectOption(opt) { return opt.value === getBroadPosition(this.current) },
    handlePowerup(type, btnEl) { this.runPowerup(type, btnEl) },
    optionClass(opt) { return optionClass(this, opt); },
    zoneState(opt) {
      if (this.eliminatedOptions.includes(opt.value)) return 'is-out'
      if (!this.answered) return ''
      if (this.isCorrectOption(opt)) return 'is-ok'
      if (opt.value === this.selected) return 'is-bad'
      return 'is-dim'
    },
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
        this.sessionId = await startChallengeSession('player-position', timeLimit, { difficulty: this.selectedDifficulty })
        this.overlayOpen = false
        this.beginClock(timeLimit)
      } catch (e) {
        console.error('[PlayerPosition challenge start]', e)
      }
    },
    async finishChallenge(result) {
      if (this.allowXp && this.xpEarned > 0) {
        await awardXpBatch({ gameCode: 'player-position', totalXp: this.xpEarned, corrects: this.corrects }).catch(() => {})
      }
      try {
        await completeChallengeSession(this.sessionId, this.score, this.xpEarned, { maxStreak: this.maxStreak, result, corrects: this.corrects, attempts: this.attempts, errors: Math.max(0, (this.attempts || 0) - (this.corrects || 0)), maxWrongStreak: this.maxWrongStreak || 0, timeBonus: this.timeBonusInfo, ...this.timedStats() })

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
                <div class="tq-who"><b>{{ current?.name }}</b><span>¿En qué posición juega?</span></div>
              </div>
              <!-- Cara del juego (Moodboard 05): tocás la zona de la cancha donde juega -->
              <div class="tq-opts tq-opts--pitch">
                <p class="tq-q">Tocá dónde juega</p>
                <div class="tq-pitch">
                  <i class="tq-pitch-lines" aria-hidden="true"></i>
                  <button
                    v-for="opt in pitchOptions"
                    :key="opt.value"
                    :data-opt="String(opt.value)"
                    class="tq-opt tq-zone"
                    :class="['z-' + opt.value, zoneState(opt)]"
                    :disabled="timeOver || answered || eliminatedOptions.includes(opt.value)"
                    @click="pick(opt)"
                  >
                    <span class="tq-zone-lb">{{ opt.label }}</span>
                    <img v-if="answered && isCorrectOption(opt) && current" class="tq-zone-dot" :src="current.image" alt="" />
                  </button>
                </div>
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
          :winThreshold="10"
          :backPath="backPath()"
          :xpEarned="xpEarned"
          :difficulty="selectedDifficulty"
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


