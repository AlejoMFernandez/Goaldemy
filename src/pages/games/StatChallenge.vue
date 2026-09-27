<script>
import GameShell from '../../components/game/GameShell.vue'
import { getAllPlayersAsync } from '../../services/players'
import { initScoring, onCorrect, onIncorrect } from '../../services/scoring'
import { awardXpBatch } from '../../services/game-xp'
import { createDailyRng } from '../../services/seeded-random'
import { celebrateCorrect } from '../../services/game-celebrations'
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
import { isChallengeAvailable, startChallengeSession, completeChallengeSession, fetchLifetimeMaxStreak } from '../../services/game-modes'
import { captureLevelSnapshot } from '../../services/xp'
import { seasonLabel, isCurrentSeason } from '../../services/season'

const POS_LABELS = { 0: 'ARQ', 1: 'DEF', 2: 'MED', 3: 'DEL' }
// Cuánto tarda cada stat en "contar" hasta su valor cuando arranca la ronda
// (moodboard 09, sección 07 "Duelo de stats").
const COUNT_MS = 700
// El cromo se da vuelta en dos tiempos: se pliega (200ms) y se despliega ya
// mostrando la cara (250ms) — mismos tiempos que el moodboard.
const FLIP_OUT_MS = 200
const FLIP_IN_MS = 250

// Sólo cracks/conocidos, sin arqueros (con sus stats no hay forma de armar un
// cromo adivinable), con volumen real y de la temporada en curso — nunca fame 3.
function eligiblePlayers(allPlayers) {
  return allPlayers.filter((p) =>
    (p.fame === 1 || p.fame === 2) &&
    p.positionId !== 0 &&
    (p.stats?.appearances ?? 0) >= 3 &&
    ((p.stats?.goals ?? 0) + (p.stats?.assists ?? 0)) >= 2 &&
    isCurrentSeason(p.stats)
  )
}

function generateRound(allPlayers, rng, usedIds) {
  const pool = eligiblePlayers(allPlayers).filter(p => !usedIds.has(p.id))
  if (pool.length < 4) return null
  const correct = pool[Math.floor(rng() * pool.length)]
  const samePos = pool.filter(p => p.id !== correct.id && p.positionId === correct.positionId)
  const rest = pool.filter(p => p.id !== correct.id)
  const distractorPool = samePos.length >= 3 ? samePos : rest
  const shuffled = [...distractorPool].sort(() => rng() - 0.5)
  const distractors = shuffled.slice(0, 3)
  if (distractors.length < 3) return null
  const options = [correct, ...distractors].sort(() => rng() - 0.5).map(p => ({ ...p, value: String(p.id) }))
  return { correct, options }
}

export default {
  name: 'StatChallenge',
  components: { GameShell, GamePreviewModal, GameSummaryPopup, PowerupBar, ScoreBug, KickoffOverlay, TimedEndOverlay },
  mixins: [timedChallenge],
  computed: {
    gameMetadata() { return getGameMetadata('stat-challenge') },
    isGuest() { return !getAuthUser()?.id },
    posLabel() { return POS_LABELS[this.currentCorrect?.positionId] ?? 'MED' },
    seasonText() { return seasonLabel(this.currentCorrect?.stats?.season) },
  },
  data() {
    return {
      allPlayers: [],
      loading: true,
      currentCorrect: null,
      options: [],
      answered: false,
      selectedValue: null,
      showFace: false,
      roundKey: 0,
      usedIds: new Set(),
      noData: false,
      animGoals: 0,
      animAssists: 0,
      animApps: 0,
      ...initScoring(),
      streak: 0,
      maxStreak: 0,
      allowXp: true,
      xpEarned: 0,
      mode: 'normal',
      reviewMode: false,
      overlayOpen: false,
      chosenSeconds: 45,
      timeLeft: 0,
      timeOver: false,
      timer: null,
      sessionId: null,
      showSummary: false,
      lifetimeMaxStreak: 0,
      selectedDifficulty: 'normal',
      difficultyConfig: null,
      // Powerups (mixins/timedChallenge.js)
      shieldActive: false,
      eliminatedOptions: [],
      hintVisible: false,
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
      const all = await getAllPlayersAsync()
      this.allPlayers = all
      this.loading = false
    },
    animateStat(key, to) {
      const t0 = performance.now()
      const step = (now) => {
        const k = Math.min(1, (now - t0) / COUNT_MS)
        this[key] = Math.round(to * (1 - Math.pow(1 - k, 3)))
        if (k < 1) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    },
    nextRound() {
      if (!this.allPlayers.length) return
      const rng = this.rng || Math.random
      let round = generateRound(this.allPlayers, rng, this.usedIds)
      if (!round) {
        // Se agotó el pool sin repetir: reintentamos UNA vez con usedIds vacío.
        this.usedIds.clear()
        round = generateRound(this.allPlayers, rng, this.usedIds)
      }
      if (!round) {
        this.noData = true
        this.currentCorrect = null
        return
      }
      this.usedIds.add(round.correct.id)
      this.currentCorrect = round.correct
      this.options = round.options
      this.answered = false
      this.selectedValue = null
      this.showFace = false
      this.animGoals = 0
      this.animAssists = 0
      this.animApps = 0
      this.roundKey += 1
      this.animateStat('animGoals', round.correct.stats?.goals ?? 0)
      this.animateStat('animAssists', round.correct.stats?.assists ?? 0)
      this.animateStat('animApps', round.correct.stats?.appearances ?? 0)
    },
    backPath() { return this.mode === 'free' ? '/play/free' : '/play/points' },
    isCorrectOption(opt) { return opt.value === String(this.currentCorrect?.id) },
    optionClass(opt) {
      const base = 'ds-op'
      if (!this.answered) return base
      const isCorrect = this.isCorrectOption(opt)
      const isSelected = opt.value === this.selectedValue
      if (isCorrect) return base + ' is-ok'
      if (isSelected) return base + ' is-bad shake'
      return base + ' is-dim'
    },
    flipCard() {
      const el = this.$refs.cromo
      if (!el || typeof el.animate !== 'function') { this.showFace = true; return }
      el.animate([{ transform: 'rotateY(0)' }, { transform: 'rotateY(90deg)' }], { duration: FLIP_OUT_MS, easing: 'ease' })
        .onfinish = () => {
          this.showFace = true
          el.animate([{ transform: 'rotateY(-90deg)' }, { transform: 'rotateY(0)' }], { duration: FLIP_IN_MS, easing: 'ease' })
        }
    },
    choose(opt) {
      if (this.timeOver || this.answered) return
      if (this.shieldActive && opt.value !== String(this.currentCorrect.id)) {
        this.shieldActive = false
        this.answered = true
        this.selectedValue = opt.value
        this.afterShieldSave()
        return
      }
      this.answered = true
      this.selectedValue = opt.value
      const prevStreak = this.streak
      const prevXp = this.xpEarned
      const ok = opt.value === String(this.currentCorrect.id)
      if (ok) {
        this.flipCard()
        if (this.mode === 'challenge') celebrateCorrect()
        const nextStreak = (this.streak || 0) + 1
        if (this.allowXp) this.xpEarned += (this.difficultyConfig?.xpPerCorrect || 15)
        onCorrect(this)
        this.streak = nextStreak
        this.maxStreak = Math.max(this.maxStreak || 0, nextStreak)
      } else {
        onIncorrect(this)
        this.streak = 0
      }
      this.afterAnswer(ok, { optValue: opt.value, xpGained: this.xpEarned - prevXp, prevStreak })
    },
    handlePowerup(type, btnEl) { this.runPowerup(type, btnEl) },
    async checkAvailability() { this.availability = await isChallengeAvailable('stat-challenge') },
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
        this.rng = createDailyRng('stat-challenge')
        this.sessionId = await startChallengeSession('stat-challenge', config.time)
        this.overlayOpen = false
        this.beginClock(config.time)
      } catch (e) {
        console.error('[StatChallenge start]', e)
      }
    },
    async finishChallenge(result) {
      if (this.isGuest) {
        if (this.xpEarned > 0) {
          setPendingGuestClaim({ game: 'stat-challenge', corrects: this.corrects, total: 10, maxStreak: this.maxStreak })
        }
      } else if (this.allowXp && this.xpEarned > 0) {
        await awardXpBatch({ gameCode: 'stat-challenge', totalXp: this.xpEarned, corrects: this.corrects }).catch(() => {})
      }
      try {
        await completeChallengeSession(this.sessionId, this.score, this.xpEarned, { maxStreak: this.maxStreak, result, corrects: this.corrects, timeBonus: this.timeBonusInfo }).catch(() => {})

        const snap = await captureLevelSnapshot()
        this.levelAfter = snap.level
        this.xpAfterTotal = snap.xpTotal
        this.afterPercent = snap.percent
        this.xpToNextAfter = snap.xpToNext

        await completeChallengeSession(this.sessionId, this.score, this.xpEarned, {
          maxStreak: this.maxStreak, result, corrects: this.corrects,
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
  <GameShell title="Duelo de Stats" :backPath="backPath()">
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
    <div class="w-full max-w-3xl mx-auto self-start mt-3">
      <div v-if="loading" class="text-center text-slate-300 py-12">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-300"></div>
        <p class="mt-3">Cargando...</p>
      </div>
      <div v-else-if="noData" class="text-center text-slate-300 py-12">
        <p>No hay suficientes jugadores con estadísticas para armar este desafío ahora mismo.</p>
      </div>
      <div v-else class="ds-stage" :class="{ 'is-frozen': frozen }">
        <ScoreBug
          ref="bug"
          :timed="mode === 'challenge'"
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
          <div :key="roundKey" v-if="currentCorrect" class="ds-grid">
            <div ref="cromo" class="ds-cromo">
              <div class="ds-top">
                <span class="ds-pos">{{ posLabel }}</span>
                <span v-if="seasonText">{{ seasonText }}</span>
              </div>
              <div class="ds-mys" :class="{ 'is-lit': showFace }">
                <img v-if="showFace" :src="currentCorrect.image" :alt="currentCorrect.name" />
                <span v-else class="ds-q">?</span>
              </div>
              <div class="ds-sts">
                <div class="ds-st"><b>{{ animGoals }}</b><span>Goles</span></div>
                <div class="ds-st"><b>{{ animAssists }}</b><span>Asist.</span></div>
                <div class="ds-st"><b>{{ animApps }}</b><span>Partidos</span></div>
              </div>
            </div>

            <div class="ds-ops">
              <Transition name="ds-hint">
                <span v-if="hintVisible" class="ds-hint">Juega en {{ currentCorrect.teamName }}</span>
              </Transition>
              <button
                v-for="opt in options"
                :key="opt.id"
                :data-opt="opt.value"
                :class="optionClass(opt)"
                :disabled="answered || timeOver || eliminatedOptions.includes(opt.value)"
                v-show="!eliminatedOptions.includes(opt.value)"
                @click="choose(opt)"
              >
                <img :src="opt.image" :alt="opt.name" class="ds-op-av" />
                <span class="ds-op-name">{{ opt.name }}</span>
              </button>
            </div>
          </div>
        </Transition>

        <PowerupBar
          v-if="mode === 'challenge' && !timeOver && !showSummary"
          :hide="overlayOpen || kickoff"
          :disabled-types="answered ? ['fifty_fifty','shield','extra_time','reveal_hint'] : []"
          :active-types="shieldActive ? ['shield'] : []"
          @use="handlePowerup"
        />

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

.ds-stage { display: grid; gap: 14px; container-type: inline-size; }
.ds-stage.is-frozen { filter: grayscale(0.6) brightness(0.85); pointer-events: none; }

.ds-grid {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  gap: 16px;
  align-items: center;
}
@container (max-width: 560px) { .ds-grid { grid-template-columns: 1fr; } }

.ds-cromo {
  position: relative;
  justify-self: center;
  width: min(240px, 100%);
  aspect-ratio: 5 / 7;
  border-radius: 16px;
  padding: 14px;
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 10px;
  background: linear-gradient(160deg, #fcd34d, #b45309 60%, #78350f);
  color: #1f1303;
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.5), inset 0 0 0 3px rgba(255, 255, 255, 0.35);
  perspective: 600px;
  backface-visibility: hidden;
}
.ds-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: var(--font-display, inherit);
  font-weight: 800;
  text-transform: uppercase;
  font-size: 12px;
  letter-spacing: 0.04em;
}
.ds-pos { font-size: 20px; font-weight: 800; }
.ds-mys {
  display: grid;
  place-items: center;
  border-radius: 12px;
  background: rgba(31, 19, 3, 0.25);
  overflow: hidden;
}
.ds-mys .ds-q { font-size: 56px; font-weight: 800; color: rgba(31, 19, 3, 0.45); }
.ds-mys.is-lit { background: transparent; }
.ds-mys img { width: 100%; height: 100%; object-fit: cover; }
.ds-sts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.ds-st {
  display: grid;
  justify-items: center;
  padding: 6px 2px;
  border-radius: 8px;
  background: rgba(31, 19, 3, 0.18);
}
.ds-st b { font-size: 24px; line-height: 1; font-variant-numeric: tabular-nums; font-weight: 800; }
.ds-st span { font-weight: 800; text-transform: uppercase; font-size: 10px; letter-spacing: 0.06em; }

.ds-ops { position: relative; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 8px; min-width: 0; }
.ds-hint {
  grid-column: 1 / -1;
  justify-self: center;
  font-size: 12.5px;
  font-weight: 700;
  padding: 4px 12px;
  border-radius: 999px;
  background: rgba(74, 222, 128, 0.18);
  color: #bbf7d0;
  margin-bottom: 2px;
}
.ds-hint-enter-active, .ds-hint-leave-active { transition: opacity 0.2s ease; }
.ds-hint-enter-from, .ds-hint-leave-to { opacity: 0; }

.ds-op {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  min-width: 0;
  max-width: 100%;
  border-radius: 14px;
  background: rgba(22, 29, 69, 0.7);
  border: 2px solid rgba(255, 255, 255, 0.1);
  color: #eef1ff;
  cursor: pointer;
  text-align: left;
  font-weight: 600;
  font-size: 14px;
  transition: border-color 0.2s, background 0.2s, opacity 0.3s;
}
.ds-op:hover:not(:disabled) { border-color: rgba(255, 255, 255, 0.3); }
.ds-op:disabled { cursor: default; }
.ds-op-av { width: 42px; height: 42px; border-radius: 50%; object-fit: cover; background: #2d3a7c; flex: none; }
.ds-op-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ds-op.is-ok { background: rgba(74, 222, 128, 0.2); border-color: #4ade80; }
.ds-op.is-bad { background: rgba(239, 68, 68, 0.2); border-color: #ef4444; }
.ds-op.is-dim { opacity: 0.35; }

.shake { animation: ds-shake 0.38s; }
@keyframes ds-shake {
  20% { transform: translateX(-6px); }
  40% { transform: translateX(5px); }
  60% { transform: translateX(-3px); }
  80% { transform: translateX(2px); }
}
</style>
