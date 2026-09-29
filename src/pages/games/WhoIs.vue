<script>
import GameShell from '../../components/game/GameShell.vue'
import PlayerSearch from '../../components/game/PlayerSearch.vue'
import ScoreBug from '../../components/game/ScoreBug.vue'
import { initState, loadPlayers, nextRound, submitGuess, posLabel, countryFlag, teamLogo } from '../../services/guess-player-typing'
import { countryNameEs } from '../../services/countries'
import { initScoring, GAME_SCORING } from '../../services/scoring'
import { getUserLevel, captureLevelSnapshot } from '../../services/xp'
import { awardXpBatch } from '../../services/game-xp'
import { getAuthUser } from '../../services/auth'
import { setPendingGuestClaim } from '../../services/guest-play'
import { createDailyRng } from '../../services/seeded-random'
import { isChallengeAvailable, startChallengeSession, completeChallengeSession } from '../../services/game-modes'
import { gameSummaryBlurb } from '../../services/games'
import { celebrateCorrect, celebrateGameWin, announceGameLoss, celebrateGameLevelUp } from '../../services/game-celebrations'
import { getGameMetadata } from '../../services/games'
import GamePreviewModal from '../../components/game/GamePreviewModal.vue'
import GameSummaryPopup from '../../components/game/GameSummaryPopup.vue'
import * as fx from '../../services/game-fx'

export default {
  name: 'WhoIs',
  components: { GameShell, GamePreviewModal, GameSummaryPopup, PlayerSearch, ScoreBug },
  data() {
    return {
      ...initState(),
      ...initScoring(GAME_SCORING['who-is']?.pointsPerCorrect || 50),
      mode: 'normal',
      reviewMode: false,
      overlayOpen: false,
      sessionId: null,
      availability: { available: true, reason: null },
      showSummary: false,
      lifetimeMaxStreak: 0,
      timeOver: false,
      // XP progress summary
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
      gameWon: false,
    }
  },
  computed: {
    gameMetadata() { return getGameMetadata('who-is') },
    isGuest() { return !getAuthUser()?.id },
  },
  watch: {},
  async mounted() {
    const mode = (this.$route.query.mode || '').toString().toLowerCase()
    if (mode === 'free') this.mode = 'free'
    else if (mode === 'challenge') this.mode = 'challenge'
    else if (mode === 'review') { this.mode = 'challenge'; this.reviewMode = true }
    else this.mode = 'normal'

    if (this.mode === 'free') this.allowXp = false

    await loadPlayers(this)
    this.nextRound()

    if (this.reviewMode) {
      import('../../services/game-modes').then(async (mod) => {
        const last = await mod.fetchTodayLastSession('who-is')
        if (last) {
          const m = last.metadata || {}
          this.showSummary = true
          this.maxStreak = Number(m.maxStreak || 0)
          try { this.lifetimeMaxStreak = Math.max(await mod.fetchLifetimeMaxStreak('who-is') || 0, this.maxStreak || 0) } catch {}
          try {
            const { getAllPlayers } = await import('../../services/players')
            const p = getAllPlayers().find((pl) => pl.id === m.playerId)
            if (p) { this.current = p; this.lit = true; this.answered = true }
          } catch {}
        }
      }).catch(() => {})
    } else if (this.mode === 'challenge') {
      this.overlayOpen = true
      this.checkAvailability()
    }
  },
  methods: {
    nextRound() {
      this.gameWon = false
      nextRound(this)
    },
    blurb() { return gameSummaryBlurb('who-is') },
    backPath() { if (this.isGuest) return '/'; return this.mode === 'free' ? '/play/free' : '/play/points' },
    posBadge() { return this.current ? posLabel(this.current) : '' },
    flagSrc() { return this.current ? countryFlag(this.current, 36) : '' },
    countryLabel() { return this.current ? countryNameEs(this.current.cname) : '' },
    teamLogoSrc() { return this.current ? teamLogo(this.current) : '' },
    hintText(key) {
      if (key === 'age') return this.hintsShown.includes('age') ? `${this.current?.age ?? '—'} años` : 'Edad'
      return this.hintsShown.includes('shirt') ? `Dorsal ${this.current?.shirtNumber ?? '—'}` : 'Dorsal'
    },
    async checkAvailability() { this.availability = await isChallengeAvailable('who-is') },
    async onPick(player) {
      if (!player || this.answered) return
      const card = this.$refs.card
      const bug = this.$refs.bug
      const ok = submitGuess(this, player)

      if (ok) {
        celebrateCorrect()
        if (card) {
          const c = fx.center(card)
          fx.sparks(c.x, c.y, 28, ['#fff', '#fcd34d', '#4ade80'], c.w * 0.6)
        }
        const xp = this._lastXpGained || 0
        if (xp > 0 && card && bug) {
          fx.flyTo({ from: card, to: bug.xpEl(), html: `+${xp} XP`, className: 'gfx-xp', duration: 550 })
            .then(() => bug.bumpXp())
        }
        this.gameWon = true
        this.afterRoundResult('win')
      } else {
        this.$refs.search?.shake()
        if (this.lives <= 0) this.afterRoundResult('loss')
      }
    },
    afterRoundResult(result) {
      if (this.mode === 'challenge') {
        setTimeout(() => this.finishRound(result), result === 'win' ? 1300 : 1600)
      } else {
        setTimeout(() => this.nextRound(), result === 'win' ? 1300 : 1800)
      }
    },
    async finishRound(result) {
      if (result === 'win') setTimeout(() => celebrateGameWin(), 100)
      else setTimeout(() => announceGameLoss(), 100)

      if (this.isGuest) {
        if (this.xpEarned > 0) {
          setPendingGuestClaim({ game: 'who-is', corrects: this.gameWon ? 1 : 0, total: 1, maxStreak: this.maxStreak })
        }
      } else if (this.allowXp && this.xpEarned > 0) {
        await awardXpBatch({ gameCode: 'who-is', totalXp: this.xpEarned, corrects: this.corrects }).catch(() => {})
      }
      try {
        await completeChallengeSession(this.sessionId, this.score, this.xpEarned, { result, maxStreak: this.maxStreak, playerId: this.current?.id })
      } catch (e) { console.error('[WhoIs complete]', e) }
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
      const delayMs = GAME_SCORING['who-is']?.summaryDelayMs ?? 1200
      setTimeout(() => {
        this.progressShown = this.beforePercent
        this.showSummary = true
        requestAnimationFrame(() => setTimeout(() => { this.progressShown = this.afterPercent }, 40))
      }, delayMs)
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
      try { const mod = await import('../../services/game-modes'); const v = await mod.fetchLifetimeMaxStreak('who-is'); this.lifetimeMaxStreak = Math.max(v || 0, this.maxStreak || 0) } catch (_) {}
      try { const mod = await import('../../services/game-modes'); await mod.checkAndUnlockDailyWins('who-is') } catch {}
    },
    async startChallenge({ difficulty, config }) {
      if (!this.availability.available) return
      this.selectedDifficulty = difficulty
      this.difficultyConfig = config
      this.maxLives = config.lives
      try {
        try {
          const snap = await captureLevelSnapshot()
          this.levelBefore = snap.level
          this.xpBeforeTotal = snap.xpTotal
          this.beforePercent = snap.percent
        } catch {}
        this.rng = createDailyRng('who-is')
        this.sessionId = await startChallengeSession('who-is', null, { difficulty: this.selectedDifficulty })
        this.overlayOpen = false
        this.nextRound()
      } catch (e) {
        console.error('[WhoIs challenge start]', e)
      }
    }
  }
}
</script>

<template>
  <GameShell title="¿Quién es?" :backPath="backPath()">
    <GamePreviewModal
      :open="overlayOpen && mode === 'challenge' && !reviewMode"
      gameName="¿Quién es?"
      gameDescription="Adiviná el jugador con pistas de club, país y posición"
      gameType="lives"
      :mechanic="gameMetadata.mechanic"
      :videoUrl="gameMetadata.videoUrl"
      :tips="gameMetadata.tips"
      @close="overlayOpen = false"
      @start="startChallenge"
    />
    <div class="w-full max-w-md mx-auto self-start mt-3">

      <div v-if="loading" class="text-center text-slate-300 py-12">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-300"></div>
        <p class="mt-3">Cargando...</p>
      </div>
      <div v-else class="space-y-3">
        <ScoreBug
          ref="bug"
          :timed="false"
          :livesMode="true"
          :lives="lives"
          :maxLives="maxLives"
          :xp="xpEarned"
        />

        <Transition name="round-fade" mode="out-in">
          <div :key="roundKey" ref="card" class="wi-card">
            <div class="wi-sil" :class="{ lit }">
              <img
                v-if="current"
                :src="current.image"
                :alt="lit ? current.name : 'Jugador misterioso'"
                :style="{ filter: lit ? 'none' : 'brightness(0) opacity(.55)' }"
                draggable="false" @dragstart.prevent @contextmenu.prevent
              />
              <span v-if="!lit" class="wi-q">?</span>
              <i v-if="lit" class="wi-sweep"></i>
            </div>
            <div class="wi-data">
              <div v-if="current" class="wi-row">
                <img v-if="teamLogoSrc()" :src="teamLogoSrc()" alt="" class="wi-crest" />
                <span class="wi-t">{{ current.teamName }}</span>
              </div>
              <div v-if="current" class="wi-row">
                <img v-if="flagSrc()" :src="flagSrc()" alt="" class="wi-flag" />
                <span class="wi-t">{{ countryLabel() }}</span>
              </div>
              <div v-if="current" class="wi-row">
                <span class="wi-pos">{{ posBadge() }}</span>
              </div>
              <div class="wi-extra">
                <span :class="{ on: hintsShown.includes('age') }">{{ hintText('age') }}</span>
                <span :class="{ on: hintsShown.includes('shirt') }">{{ hintText('shirt') }}</span>
              </div>
            </div>
            <div class="wi-name" :class="{ on: answered, lost }">{{ current?.name }}</div>
          </div>
        </Transition>

        <div v-if="!answered" class="mt-1">
          <PlayerSearch ref="search" :show-team="false" @pick="onPick" />
          <div v-if="tried.length" class="wi-tried">
            <span v-for="p in tried" :key="p.id">{{ p.name }}</span>
          </div>
        </div>
        <div v-else-if="mode !== 'challenge'" class="text-center">
          <button class="rounded-full bg-white/10 hover:bg-white/15 border border-white/15 px-5 py-2 text-sm text-slate-200 transition" @click="nextRound">
            Otro jugador
          </button>
        </div>

        <GameSummaryPopup
          :show="showSummary"
          :corrects="gameWon ? 1 : 0"
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
          :winThreshold="1"
          :guest="isGuest"
          :resultLine="isGuest ? (gameWon ? 'Adiviné al jugador ✅' : 'No lo adiviné esta vez') : ''"
          :backPath="backPath()"
          @close="showSummary = false"
        />
      </div>
    </div>
  </GameShell>
</template>

<style scoped>
.round-fade-enter-active, .round-fade-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}
.round-fade-enter-from, .round-fade-leave-to {
  opacity: 0;
  transform: translateY(6px) scale(0.99);
}

.wi-card {
  position: relative;
  width: 100%;
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr);
  gap: 12px;
  padding: 12px;
  border-radius: 16px;
  background: linear-gradient(160deg, #1f2a5e, #0b1024);
  border: 2px solid rgba(255, 255, 255, 0.14);
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.45);
  overflow: hidden;
}
@media (max-width: 400px) {
  .wi-card { grid-template-columns: 92px minmax(0, 1fr); }
}

.wi-sil {
  position: relative;
  aspect-ratio: 3 / 4;
  border-radius: 12px;
  overflow: hidden;
  background: radial-gradient(circle at 50% 30%, #2d3a7c, #0b1024);
}
.wi-sil img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transition: filter 0.5s; user-select: none; }
.wi-sil .wi-q { position: absolute; inset: 0; display: grid; place-items: center; font-family: var(--font-display, inherit); font-size: 40px; font-weight: 800; color: rgba(255, 255, 255, 0.3); }
.wi-sweep {
  position: absolute; inset: -20%;
  background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,.75) 50%, transparent 60%);
  transform: translateX(-120%);
  pointer-events: none;
  animation: wi-sweep 0.8s ease-out;
}
@keyframes wi-sweep { to { transform: translateX(120%); } }

.wi-data { display: grid; gap: 7px; align-content: center; min-width: 0; }
.wi-row { display: flex; align-items: center; gap: 9px; min-width: 0; font-weight: 800; text-transform: uppercase; font-size: 16px; letter-spacing: 0.02em; color: #eef1ff; }
.wi-crest { width: 26px; height: 26px; object-fit: contain; flex: none; }
.wi-flag { width: 30px; height: 20px; object-fit: cover; border-radius: 3px; flex: none; }
.wi-t { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.wi-pos { font-weight: 400; font-size: 15px; background: #fff; color: #0b1024; padding: 2px 10px; border-radius: 6px; font-weight: 800; }

.wi-extra { display: flex; gap: 6px; flex-wrap: wrap; }
.wi-extra span { font-weight: 800; text-transform: uppercase; font-size: 12px; padding: 3px 9px; border-radius: 6px; border: 1.5px dashed rgba(255, 255, 255, 0.2); color: #5b6388; }
.wi-extra span.on { border: 0; background: #fef3c7; color: #422006; transform: rotate(-3deg); animation: wi-stick 0.45s cubic-bezier(.34,1.56,.64,1); }
@keyframes wi-stick { from { transform: scale(0) rotate(-12deg); } to { transform: scale(1) rotate(-3deg); } }

.wi-name {
  position: absolute; left: 12px; width: 96px; bottom: 12px;
  padding: 14px 4px 6px; border-radius: 0 0 12px 12px; text-align: center;
  font-family: var(--font-display, inherit); font-size: 16px; line-height: 1.05; text-transform: uppercase; color: #fff;
  background: linear-gradient(transparent, rgba(0,0,0,.85));
  opacity: 0; pointer-events: none;
}
.wi-name.on { animation: wi-slam 0.45s cubic-bezier(.16,1,.3,1) forwards; animation-delay: 0.2s; }
.wi-name.lost { color: #fca5a5; }
@keyframes wi-slam { from { opacity: 0; transform: scale(2.2); filter: blur(8px); } to { opacity: 1; transform: none; filter: none; } }

.wi-tried { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; margin-top: 8px; }
.wi-tried span { font-size: 12.5px; font-weight: 600; padding: 3px 9px; border-radius: 999px; background: rgba(239,68,68,.14); color: #fca5a5; text-decoration: line-through; }
</style>
