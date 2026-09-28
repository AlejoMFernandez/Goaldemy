<script>
import GameShell from '../../components/game/GameShell.vue'
import ScoreBug from '../../components/game/ScoreBug.vue'
import { getAllPlayersAsync, sampleDistinct } from '../../services/players'
import { seasonLabel, isCurrentSeason } from '../../services/season'
import { initScoring } from '../../services/scoring'
import { awardXpBatch } from '../../services/game-xp'
import { getAuthUser } from '../../services/auth'
import { setPendingGuestClaim } from '../../services/guest-play'
import { createDailyRng } from '../../services/seeded-random'
import { celebrateCorrect, celebrateIncorrect, celebrateGameWin, announceGameLoss, celebrateGameLevelUp } from '../../services/game-celebrations'
import { playTickSound } from '../../services/sounds'
import { getGameMetadata } from '../../services/games'
import GamePreviewModal from '../../components/game/GamePreviewModal.vue'
import GameSummaryPopup from '../../components/game/GameSummaryPopup.vue'
import { isChallengeAvailable, startChallengeSession, completeChallengeSession, fetchLifetimeMaxStreak } from '../../services/game-modes'
import { captureLevelSnapshot } from '../../services/xp'
import * as fx from '../../services/game-fx'

// Mismas 6 categorías del moodboard 09 (sección 02) + "Partidos" que pidió
// Alejo. goals/assists/appearances son de temporada — necesitan stats.season
// == temporada actual (services/season.js), igual que Duelo de Stats.
const CATEGORIES = [
  { key: 'goals', label: 'Goles', field: (p) => p.stats?.goals ?? 0, seasonal: true, unit: '' },
  { key: 'height', label: 'Altura', field: (p) => p.height ?? 0, seasonal: false, unit: 'cm' },
  { key: 'assists', label: 'Asistencias', field: (p) => p.stats?.assists ?? 0, seasonal: true, unit: '' },
  { key: 'appearances', label: 'Partidos', field: (p) => p.stats?.appearances ?? 0, seasonal: true, unit: '' },
  { key: 'transferValue', label: 'Valor', field: (p) => Math.round((p.transferValue ?? 0) / 1_000_000), seasonal: false, unit: 'M€' },
  { key: 'age', label: 'Edad', field: (p) => p.age ?? 0, seasonal: false, unit: 'años' },
]

// Cuenta el número del lado derecho al revelar (moodboard: 650ms, con "tics").
const COUNT_MS = 650

function surname(name) {
  const w = (name || '').trim().split(' ')
  if (w.length < 2) return name || ''
  if (/^(júnior|junior|jr\.?)$/i.test(w[w.length - 1])) return w[0]
  return w.slice(1).join(' ')
}

function categoryPool(allPlayers, cat) {
  return allPlayers.filter((p) => {
    if (cat.seasonal) return isCurrentSeason(p.stats)
    if (cat.key === 'height') return p.height != null
    if (cat.key === 'age') return p.age != null
    if (cat.key === 'transferValue') return (p.transferValue ?? 0) > 0
    return true
  })
}

// Restart de una animación CSS por clase (forzar reflow) — mismo truco que
// usa el moodboard para poder repetir el "catflip" en rondas seguidas.
function restartAnim(el, cls) {
  if (!el) return
  el.classList.remove(cls)
  void el.offsetWidth
  el.classList.add(cls)
}

export default {
  name: 'HigherOrLower',
  components: { GameShell, GamePreviewModal, GameSummaryPopup, ScoreBug },
  computed: {
    gameMetadata() { return getGameMetadata('higher-or-lower') },
    target() { return this.difficultyConfig?.target || 12 },
    isGuest() { return !getAuthUser()?.id },
    currentCategory() { return CATEGORIES[this.round % CATEGORIES.length] },
    seasonTag() { return this.currentCategory.seasonal ? seasonLabel(this.leftPlayer?.stats?.season) : '' },
  },
  data() {
    return {
      allPlayers: [],
      round: 0,
      leftPlayer: null,
      rightPlayer: null,
      chain: 0,
      revealed: false,
      animRightVal: 0,
      leftBarPct: 0,
      rightBarPct: 0,
      resultClass: '',
      shaking: false,
      gameOver: false,
      animating: false,
      won: false,
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
    backPath() { if (this.isGuest) return '/'; return this.mode === 'free' ? '/play/free' : '/play/points' },
    surname,

    async load() {
      const all = (await getAllPlayersAsync()).filter((p) => {
        if (p.age == null && p.height == null) return false
        const apps = p.stats?.appearances ?? 0
        const goals = p.stats?.goals ?? 0
        const assists = p.stats?.assists ?? 0
        const tv = p.transferValue ?? 0
        return apps >= 3 || goals > 0 || assists > 0 || tv >= 1_000_000
      })
      this.allPlayers = all
      this.loading = false
      if (!this.reviewMode && this.mode !== 'challenge') this.startNewRound()
    },

    barPct(value, max) {
      return Math.min(100, (value / (max || 1)) * 80)
    },

    // Busca, arrancando en la categoría de esta ronda y rotando (moodboard:
    // "la stat cambia cada ronda"), la primera que tenga un rival válido para
    // `left` — nunca valores iguales, y en las de temporada, ambos con
    // stats de la temporada en curso.
    pickRound(leftPlayer, rand) {
      for (let offset = 0; offset < CATEGORIES.length; offset++) {
        const idx = (this.round + offset) % CATEGORIES.length
        const cat = CATEGORIES[idx]
        if (cat.seasonal && !isCurrentSeason(leftPlayer.stats)) continue
        const leftVal = cat.field(leftPlayer)
        const pool = categoryPool(this.allPlayers, cat).filter(
          (p) => p.id !== leftPlayer.id && !this.usedIds.has(p.id) && cat.field(p) !== leftVal
        )
        if (pool.length) {
          const right = pool[Math.floor(rand() * pool.length)]
          return { idx, cat, right }
        }
      }
      return null
    },

    startNewRound() {
      if (!this.allPlayers.length) return
      const rand = this.rng || Math.random

      if (!this.leftPlayer) {
        const seasonalPool = this.allPlayers.filter((p) => isCurrentSeason(p.stats))
        const basePool = seasonalPool.length >= 8 ? seasonalPool : this.allPlayers
        const first = sampleDistinct(basePool, 1, this.usedIds, rand)[0]
        if (first) { this.usedIds.add(first.id); this.leftPlayer = first }
      }
      if (!this.leftPlayer) { this.gameOver = true; return }

      let result = this.pickRound(this.leftPlayer, rand)
      if (!result) {
        // Este "left" no combina con ninguna categoría (rarísimo): probar otro.
        this.usedIds.add(this.leftPlayer.id)
        const alt = sampleDistinct(this.allPlayers, 1, this.usedIds, rand)[0]
        if (!alt) { this.gameOver = true; return }
        this.leftPlayer = alt
        result = this.pickRound(this.leftPlayer, rand)
        if (!result) { this.gameOver = true; return }
      }

      const catChanged = result.idx !== this.round
      this.round = result.idx
      this.usedIds.add(result.right.id)
      this.rightPlayer = result.right
      this.revealed = false
      this.resultClass = ''
      this.animRightVal = 0
      const leftVal = result.cat.field(this.leftPlayer)
      const rightVal = result.cat.field(this.rightPlayer)
      const maxVal = Math.max(leftVal, rightVal) || 1
      this.leftBarPct = this.barPct(leftVal, maxVal)
      this.rightBarPct = 0
      this.roundKey++
      if (catChanged) this.$nextTick(() => restartAnim(this.$refs.catBox, 'flip'))
    },

    animateReveal(to) {
      const t0 = performance.now()
      let lastTick = 0
      const step = (now) => {
        const k = Math.min(1, (now - t0) / COUNT_MS)
        this.animRightVal = Math.round(to * (1 - Math.pow(1 - k, 3)))
        if (now - lastTick > 90) { playTickSound(); lastTick = now }
        if (k < 1) requestAnimationFrame(step)
        else this.animRightVal = to
      }
      requestAnimationFrame(step)
    },

    guess(higher) {
      if (this.revealed || this.gameOver || this.animating) return
      this.revealed = true
      this.animating = true

      const cat = this.currentCategory
      const leftVal = cat.field(this.leftPlayer)
      const rightVal = cat.field(this.rightPlayer)
      const maxVal = Math.max(leftVal, rightVal) || 1
      this.rightBarPct = this.barPct(rightVal, maxVal)
      this.animateReveal(rightVal)

      setTimeout(() => this.resolveGuess(higher, leftVal, rightVal), COUNT_MS + 30)
    },

    resolveGuess(higher, leftVal, rightVal) {
      const isHigher = rightVal > leftVal
      const correct = (higher && isHigher) || (!higher && !isHigher)
      const rightCard = this.$refs.rightCard
      const bug = this.$refs.bug

      if (correct) {
        this.resultClass = 'ok'
        celebrateCorrect()
        this.chain++
        this.corrects++
        this.maxStreak = Math.max(this.maxStreak || 0, this.chain)
        let gained = 0
        if (this.allowXp) {
          gained = this.difficultyConfig?.xpPerCorrect || 20
          this.xpEarned += gained
        }
        if (rightCard) {
          const c = fx.center(rightCard)
          fx.sparks(c.x, c.y, 14, ['#4ade80', '#fff'], 60)
        }
        if (gained > 0 && rightCard && bug) {
          fx.flyTo({ from: rightCard, to: bug.xpEl(), html: `+${gained} XP`, className: 'gfx-xp', duration: 520 })
            .then(() => bug.bumpXp())
        }

        if (this.chain >= this.target) {
          this.gameOver = true
          this.won = true
          celebrateGameWin()
          if (this.allowXp && this.difficultyConfig?.xpCompletion) this.xpEarned += this.difficultyConfig.xpCompletion
          setTimeout(() => this.finishChallenge('win'), 900)
          return
        }

        setTimeout(() => {
          this.leftPlayer = this.rightPlayer
          this.round++
          this.animating = false
          this.startNewRound()
        }, 700)
      } else {
        this.resultClass = 'bad'
        this.shaking = true
        setTimeout(() => { this.shaking = false }, 450)
        celebrateIncorrect()
        this.won = false
        this.gameOver = true
        bug?.breakChain?.()
        announceGameLoss()
        const breakDelay = 320 + this.chain * 40
        setTimeout(() => { this.chain = 0 }, breakDelay)
        setTimeout(() => this.finishChallenge('loss'), breakDelay + 500)
      }
    },

    statDisplay(value, unit) {
      return unit ? `${value} ${unit}` : String(value)
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
        this.sessionId = await startChallengeSession('higher-or-lower', 0, { difficulty: this.selectedDifficulty })
        this.overlayOpen = false
        this.round = 0
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

      if (this.isGuest) {
        if (this.xpEarned > 0) {
          setPendingGuestClaim({ game: 'higher-or-lower', corrects: this.chain, total: this.target, maxStreak: this.maxStreak })
        }
      } else if (this.allowXp && this.xpEarned > 0) {
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
    <div class="w-full max-w-xl mx-auto self-start mt-3">

      <div v-if="loading" class="text-center text-slate-300 py-12">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-300"></div>
        <p class="mt-3">Cargando...</p>
      </div>

      <div v-else class="hl-stage">
        <ScoreBug ref="bug" :timed="false" chainMode :corrects="chain" :target="target" :xp="xpEarned" />

        <!-- Zócalo: qué se compara, gira al cambiar de stat -->
        <div ref="catBox" class="hl-catbox">
          <span class="hl-cat-a">Comparan</span>
          <span class="hl-cat-b">{{ currentCategory.label }}</span>
          <span v-if="seasonTag" class="hl-cat-c">{{ seasonTag }}</span>
        </div>

        <!-- Cara a cara diagonal -->
        <Transition name="round-fade" mode="out-in">
          <div :key="roundKey" class="hl-vs" :class="{ shake: shaking }">
            <div class="hl-side hl-side-l">
              <i class="hl-bar" :style="{ height: leftBarPct + '%' }"></i>
              <img v-if="leftPlayer" :src="leftPlayer.image" :alt="leftPlayer.name" class="hl-photo" @error="e => e.target.style.visibility = 'hidden'" />
              <span class="hl-name">{{ surname(leftPlayer?.name) }}</span>
              <span v-if="leftPlayer?.teamLogo" class="hl-team">
                <img :src="leftPlayer.teamLogo" :alt="leftPlayer.teamName" />
                <span>{{ leftPlayer.teamName }}</span>
              </span>
              <span class="hl-val">{{ statDisplay(currentCategory.field(leftPlayer), currentCategory.unit) }}</span>
            </div>

            <div ref="rightCard" class="hl-side hl-side-r" :class="resultClass">
              <i class="hl-bar" :style="{ height: rightBarPct + '%' }"></i>
              <img v-if="rightPlayer" :src="rightPlayer.image" :alt="rightPlayer.name" class="hl-photo" @error="e => e.target.style.visibility = 'hidden'" />
              <span class="hl-name">{{ surname(rightPlayer?.name) }}</span>
              <span v-if="rightPlayer?.teamLogo" class="hl-team">
                <img :src="rightPlayer.teamLogo" :alt="rightPlayer.teamName" />
                <span>{{ rightPlayer.teamName }}</span>
              </span>
              <span class="hl-val" :class="{ q: !revealed }">{{ revealed ? statDisplay(animRightVal, currentCategory.unit) : '?' }}</span>
            </div>

            <span class="hl-mid">VS</span>
            <i class="hl-divider" aria-hidden="true"></i>
          </div>
        </Transition>

        <!-- Botones -->
        <div v-if="!gameOver" class="flex flex-col items-center gap-3">
          <p class="text-slate-300 text-sm text-center px-2">
            ¿<span class="text-white font-semibold">{{ surname(rightPlayer?.name) }}</span> tiene más o menos que <span class="text-white font-semibold">{{ surname(leftPlayer?.name) }}</span>?
          </p>
          <div class="flex gap-3">
            <button class="hl-btn hl-btn-up" @click="guess(true)" :disabled="revealed || animating">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7"/></svg>
              Mayor
            </button>
            <button class="hl-btn hl-btn-dn" @click="guess(false)" :disabled="revealed || animating">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
              Menor
            </button>
          </div>
        </div>

        <!-- Game over banner -->
        <Transition name="time-over-fade">
          <div v-if="gameOver && !showSummary" class="mt-1 flex items-center justify-center gap-2.5 rounded-xl border px-4 py-2.5"
            :class="won ? 'border-emerald-500/20 bg-emerald-500/10' : 'border-red-500/20 bg-red-500/10'">
            <span class="text-sm font-semibold" :class="won ? 'text-emerald-300' : 'text-red-300'">
              {{ won ? '¡Cadena completada!' : 'Cadena rota' }}
            </span>
          </div>
        </Transition>

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
          :guest="isGuest"
          :resultLine="isGuest ? `Racha de ${chain} 🔥` : ''"
          :backPath="backPath()"
          @close="showSummary = false"
        />
      </div>
    </div>
  </GameShell>
</template>

<style scoped>
.round-fade-enter-active, .round-fade-leave-active { transition: opacity 200ms ease; }
.round-fade-enter-from, .round-fade-leave-to { opacity: 0; }
.time-over-fade-enter-active { transition: opacity 0.4s ease, transform 0.4s ease; }
.time-over-fade-enter-from { opacity: 0; transform: translateY(6px); }

.hl-stage { display: grid; gap: 12px; }

/* Zócalo "Comparan: X" — gira al cambiar de categoría */
.hl-catbox {
  justify-self: center;
  display: flex;
  align-items: stretch;
  font-weight: 800;
  text-transform: uppercase;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
  perspective: 400px;
}
.hl-catbox.flip { animation: hl-catflip 0.5s ease; }
@keyframes hl-catflip {
  0% { transform: rotateX(0); }
  45% { transform: rotateX(90deg); }
  55% { transform: rotateX(-90deg); }
  100% { transform: rotateX(0); }
}
.hl-cat-a, .hl-cat-b, .hl-cat-c { padding: 6px 12px; display: flex; align-items: center; }
.hl-cat-a { background: var(--play-400); color: #141005; font-size: 12px; letter-spacing: 0.1em; }
.hl-cat-b { background: #fff; color: #070a1a; font-size: 17px; }
.hl-cat-c { background: var(--mb-900, #0b1024); color: #38bdf8; font-size: 11px; letter-spacing: 0.08em; }

/* Cara a cara diagonal */
.hl-vs {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  border-radius: 16px;
  overflow: hidden;
  min-height: 230px;
}
.hl-vs.shake { animation: hl-shake 0.38s; }
@keyframes hl-shake {
  20% { translate: -6px 0; } 40% { translate: 5px 0; } 60% { translate: -3px 0; } 80% { translate: 2px 0; }
}
.hl-side {
  position: relative;
  display: grid;
  align-content: end;
  justify-items: center;
  padding: 12px 10px 14px;
  gap: 4px;
  overflow: hidden;
  transition: box-shadow 0.2s;
}
.hl-side-l { background: linear-gradient(160deg, #1e3a8a, var(--mb-900, #0b1024)); }
.hl-side-r { background: linear-gradient(200deg, #7f1d1d, var(--mb-900, #0b1024)); }
.hl-side.ok { box-shadow: inset 0 0 0 3px var(--mb-success, #4ade80); }
.hl-side.bad { box-shadow: inset 0 0 0 3px var(--mb-danger, #ef4444); }
.hl-bar {
  position: absolute;
  left: 0;
  bottom: 0;
  width: 100%;
  height: 0;
  background: linear-gradient(0deg, rgba(252, 211, 77, 0.35), transparent);
  transition: height 0.7s cubic-bezier(0.16, 1, 0.3, 1);
  pointer-events: none;
}
.hl-photo { position: relative; width: 72px; height: 72px; object-fit: cover; border-radius: 12px; box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4); }
.hl-name { position: relative; font-weight: 800; text-transform: uppercase; font-size: 16px; color: #fff; text-shadow: 0 2px 6px #000; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hl-team { position: relative; display: flex; align-items: center; gap: 5px; font-size: 12px; color: #c5cbe8; font-weight: 600; background: rgba(0, 0, 0, 0.4); padding: 1px 8px 1px 4px; border-radius: 999px; max-width: 100%; }
.hl-team img { width: 16px; height: 16px; object-fit: contain; flex: none; }
.hl-team span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hl-val { position: relative; font-weight: 800; font-size: 2.4rem; line-height: 1; color: #fff; text-shadow: 0 3px 0 rgba(0, 0, 0, 0.4); font-variant-numeric: tabular-nums; }
.hl-val.q { color: var(--play-400); }

.hl-mid {
  position: absolute; left: 50%; top: 44%; transform: translate(-50%, -50%) skewX(-10deg); z-index: 3;
  background: #fff; color: #070a1a; font-weight: 800; font-size: 22px; padding: 2px 14px; box-shadow: 0 6px 16px rgba(0, 0, 0, 0.5);
}
.hl-divider {
  position: absolute; top: 0; bottom: 0; left: calc(50% - 2px); width: 4px; background: #fff; transform: skewX(-10deg); z-index: 2;
}

.hl-btn {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 12px 32px; border-radius: 12px; border: 0; cursor: pointer;
  font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; font-size: 15px; color: #fff;
  transition: transform 0.15s, filter 0.15s;
}
.hl-btn svg { width: 18px; height: 18px; }
.hl-btn:active:not(:disabled) { transform: scale(0.96); }
.hl-btn:disabled { opacity: 0.4; pointer-events: none; }
.hl-btn-up { background: linear-gradient(180deg, #16a34a, #15803d); }
.hl-btn-dn { background: linear-gradient(180deg, #dc2626, #991b1b); }
</style>
