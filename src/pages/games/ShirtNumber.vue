<script>
import GameShell from '../../components/game/GameShell.vue'
import { getAllPlayers, getAllPlayersAsync } from '../../services/players'
import { initScoring, onCorrect, onIncorrect } from '../../services/scoring'
import { awardXpBatch } from '../../services/game-xp'
import { createDailyRng } from '../../services/seeded-random'
import { celebrateCorrect, celebrateIncorrect, celebrateGameLevelUp } from '../../services/game-celebrations'
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
import { shuffleArray } from '../../services/game-common'

export default {
  name: 'ShirtNumber',
  components: { GameShell, GamePreviewModal, GameSummaryPopup, PowerupBar, ScoreBug, KickoffOverlay, TimedEndOverlay },
  mixins: [timedChallenge],
  computed: {
    // Apellido para la espalda (última palabra del nombre)
    surname() {
      const n = String(this.current?.name || '').trim().split(/\s+/)
      return (n[n.length - 1] || '').toUpperCase()
    },
    // Colores de la camiseta: fijos por equipo (hash del nombre), sin depender de datos nuevos
    shirtStyle() {
      const t = String(this.current?.teamName || this.current?.name || '')
      let h = 0
      for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0
      const hue = h % 360, hue2 = (hue + 150 + (h >> 9) % 60) % 360
      return { '--sh1': `hsl(${hue} 62% 42%)`, '--sh2': `hsl(${hue2} 70% ${h % 2 ? 88 : 22}%)` }
    },
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
      if (this.timeOver || this.answered) return false
      const correct = Number(opt.value) === Number(this.current?.shirtNumber)
      if (this.shieldActive && !correct) {
        // El escudo frena el error: no cuenta y la racha se mantiene
        this.shieldActive = false
        this.answered = true
        this.selected = opt.value
        this.afterShieldSave()
        return false
      }
      const prevStreak = this.streak || 0
      let xpGained = 0
      this.answered = true
      this.selected = opt.value
      if (correct) {
        celebrateCorrect()
        const nextStreak = (this.streak || 0) + 1
        const nextCorrects = (this.corrects || 0) + 1
        if (this.allowXp) {
          xpGained = this.difficultyConfig?.xpPerCorrect || 10
          this.xpEarned += xpGained
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
      this.afterAnswer(correct, { optValue: opt.value, xpGained, prevStreak })
      return correct
    },
    isCorrectOption(opt) { return Number(opt.value) === Number(this.current?.shirtNumber) },
    handlePowerup(type, btnEl) { this.runPowerup(type, btnEl) },
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
        this.sessionId = await startChallengeSession('shirt-number', timeLimit, { difficulty: this.selectedDifficulty })
        this.overlayOpen = false
        this.beginClock(timeLimit)
      } catch (e) {
        console.error('[ShirtNumber challenge start]', e)
      }
    },
    async finishChallenge(result) {
      if (this.allowXp && this.xpEarned > 0) {
        await awardXpBatch({ gameCode: 'shirt-number', totalXp: this.xpEarned, corrects: this.corrects }).catch(() => {})
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
  <GameShell title="Número de camiseta" :backPath="backPath()">
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
                <!-- Cara del juego (Moodboard 05): la espalda de la camiseta, con el número tapado -->
                <div class="tq-photo tq-back" :style="shirtStyle">
                  <svg class="tq-shirt" viewBox="0 0 100 100" aria-hidden="true">
                    <path d="M30 8 L10 20 L2 42 L18 48 L20 38 L22 96 L78 96 L80 38 L82 48 L98 42 L90 20 L70 8 Q50 18 30 8 Z" fill="var(--sh1)" stroke="var(--sh2)" stroke-width="2.5" stroke-linejoin="round" />
                    <path d="M41 9 v86 M59 9 v86" stroke="var(--sh2)" stroke-width="6" opacity=".45" />
                    <path d="M30 8 Q50 18 70 8" fill="none" stroke="var(--sh2)" stroke-width="4" />
                  </svg>
                  <span class="tq-back-nm">{{ surname }}</span>
                  <span class="tq-back-num" :class="{ 'is-on': answered }">{{ answered ? current?.shirtNumber : '?' }}</span>
                  <img v-if="current" class="tq-back-face" :src="current.image" :alt="current.name" />
                </div>
                <div class="tq-who"><b>{{ current?.name }}</b><span>¿Qué número usa?</span></div>
              </div>
              <div class="tq-opts tq-opts--nums">
                <p class="tq-q">Elegí el número</p>
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
