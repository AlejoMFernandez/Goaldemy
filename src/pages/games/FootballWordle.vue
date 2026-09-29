<script>
import GameShell from '../../components/game/GameShell.vue'
import { getAllPlayers, getAllPlayersAsync, sampleDistinct } from '../../services/players'
import { playerFlagUrl, countryNameEs } from '../../services/countries'
import { captureLevelSnapshot } from '../../services/xp'
import { awardXpBatch } from '../../services/game-xp'
import { createDailyRng } from '../../services/seeded-random'
import { isChallengeAvailable, startChallengeSession, completeChallengeSession } from '../../services/game-modes'
import { celebrateGameWin, announceGameLoss, celebrateGameLevelUp } from '../../services/game-celebrations'
import { getGameMetadata } from '../../services/games'
import { GAME_SCORING } from '../../services/scoring'
import { colorsForTeam } from '../../services/team-colors'
import GamePreviewModal from '../../components/game/GamePreviewModal.vue'
import GameSummaryPopup from '../../components/game/GameSummaryPopup.vue'
import ScoreBug from '../../components/game/ScoreBug.vue'
import PlayerSearch from '../../components/game/PlayerSearch.vue'

const CONTINENTS = {
  south_america: ['Argentina','Brazil','Uruguay','Colombia','Chile','Paraguay','Ecuador','Peru','Venezuela','Bolivia'],
  europe: ['Spain','France','Germany','England','Italy','Portugal','Netherlands','Belgium','Croatia','Serbia','Poland','Austria','Switzerland','Denmark','Norway','Sweden','Scotland','Wales','Ireland','Turkey','Greece','Czech Republic','Ukraine','Romania','Hungary','Slovenia','Slovakia','North Macedonia','Albania','Bosnia and Herzegovina','Montenegro','Finland','Iceland'],
  africa: ['Nigeria','Senegal','Cameroon','Ghana','Ivory Coast','Morocco','Algeria','Tunisia','Egypt','Mali','Guinea','DR Congo','Burkina Faso','South Africa','Zambia','Zimbabwe','Mozambique','Gabon','Equatorial Guinea','Cape Verde','Comoros','Gambia','Sierra Leone','Togo','Benin','Central African Republic','Congo'],
  asia: ['Japan','South Korea','Iran','Saudi Arabia','Australia','China','Iraq','Qatar','Uzbekistan','Thailand'],
  north_america: ['Mexico','United States','Canada','Jamaica','Honduras','Costa Rica','Panama','El Salvador','Trinidad and Tobago','Haiti','Curaçao'],
}

function getContinent(countryName) {
  for (const [cont, countries] of Object.entries(CONTINENTS)) {
    if (countries.includes(countryName)) return cont
  }
  return 'other'
}

const POS_LABELS = { 0: 'POR', 1: 'DEF', 2: 'MED', 3: 'DEL' }

const LEAGUE_LOGOS = { 47: 'https://images.fotmob.com/image_resources/logo/leaguelogo/47.png', 87: 'https://images.fotmob.com/image_resources/logo/leaguelogo/87.png', 55: 'https://images.fotmob.com/image_resources/logo/leaguelogo/55.png', 54: 'https://images.fotmob.com/image_resources/logo/leaguelogo/54.png', 53: 'https://images.fotmob.com/image_resources/logo/leaguelogo/53.png' }
function leagueLogoForId(id) { return LEAGUE_LOGOS[id] || null }

function evaluateGuess(g, t) {
  return {
    player: g,
    teamResult: g.teamName === t.teamName ? 'green' : 'gray',
    teamLogo: g.teamLogo,
    leagueResult: g.leagueId === t.leagueId ? 'green' : 'gray',
    leagueLogo: leagueLogoForId(g.leagueId),
    countryResult: g.cname === t.cname ? 'green' : getContinent(g.cname) === getContinent(t.cname) ? 'yellow' : 'gray',
    posResult: g.positionId === t.positionId ? 'green' : 'gray',
    posLabel: POS_LABELS[g.positionId] || 'MED',
    ageResult: g.age === t.age ? 'green' : Math.abs(g.age - t.age) <= 2 ? 'yellow' : 'gray',
    ageArrow: g.age === t.age ? '' : g.age < t.age ? '▲' : '▼',
    heightResult: g.height === t.height ? 'green' : Math.abs((g.height || 0) - (t.height || 0)) <= 3 ? 'yellow' : 'gray',
    heightArrow: g.height === t.height ? '' : (g.height || 0) < (t.height || 0) ? '▲' : '▼',
    dorsalResult: g.shirtNumber === t.shirtNumber ? 'green' : Math.abs((g.shirtNumber || 0) - (t.shirtNumber || 0)) <= 3 ? 'yellow' : 'gray',
    dorsalArrow: g.shirtNumber === t.shirtNumber ? '' : (g.shirtNumber || 0) < (t.shirtNumber || 0) ? '▲' : '▼',
  }
}

export default {
  name: 'FootballWordle',
  components: { GameShell, GamePreviewModal, GameSummaryPopup, ScoreBug, PlayerSearch },
  data() {
    return {
      loading: true,
      allPlayers: [],
      allPlayersFull: [],
      target: null,
      guesses: [],
      won: false,
      gameOver: false,
      maxGuesses: 6,
      // mode & session
      mode: 'normal',
      reviewMode: false,
      overlayOpen: false,
      sessionId: null,
      availability: { available: true, reason: null },
      rng: null,
      // difficulty
      selectedDifficulty: 'normal',
      difficultyConfig: null,
      // XP & summary
      xpEarned: 0,
      score: 0,
      showSummary: false,
      levelBefore: null,
      levelAfter: null,
      xpBeforeTotal: 0,
      xpAfterTotal: 0,
      beforePercent: 0,
      afterPercent: 0,
      progressShown: 0,
      xpToNextAfter: null,
      lifetimeMaxStreak: 0,
    }
  },
  computed: {
    gameMetadata() { return getGameMetadata('football-wordle') },
    guessedIds() {
      const s = new Set()
      for (const g of this.guesses) s.add(g.player.id)
      return s
    },
    remainingGuesses() { return this.maxGuesses - this.guesses.length },
    // Historial con el intento más nuevo arriba (aparece bajo el buscador, animado).
    guessesReversed() { return this.guesses.slice().reverse() },
    // Atributos "revelados": si algún intento acertó (verde) equipo/liga/país/posición/dorsal,
    // se muestra en la ficha del misterioso.
    revealed() {
      const r = { team: false, league: false, country: false, position: false, dorsal: false }
      for (const g of this.guesses) {
        if (g.teamResult === 'green') r.team = true
        if (g.leagueResult === 'green') r.league = true
        if (g.countryResult === 'green') r.country = true
        if (g.posResult === 'green') r.position = true
        if (g.dorsalResult === 'green') r.dorsal = true
      }
      return r
    },
    targetLeagueLogo() { return this.target ? leagueLogoForId(this.target.leagueId) : null },
    targetPosLabel() { return this.target ? (POS_LABELS[this.target.positionId] || 'MED') : '' },
    shirtColors() {
      const dim = { primary: 'hsl(220 14% 30%)', secondary: 'hsl(220 14% 45%)' }
      if (!this.target) return dim
      return (this.revealed.team || this.gameOver) ? colorsForTeam(this.target.teamId) : dim
    },
  },
  async mounted() {
    const mode = (this.$route.query.mode || '').toString().toLowerCase()
    if (mode === 'free') this.mode = 'free'
    else if (mode === 'challenge') this.mode = 'challenge'
    else if (mode === 'review') { this.mode = 'challenge'; this.reviewMode = true }
    else this.mode = 'normal'

    this.allPlayers = await getAllPlayersAsync()
    this.allPlayersFull = getAllPlayers()
    this.loading = false

    if (this.reviewMode) {
      import('../../services/game-modes').then(async (mod) => {
        const last = await mod.fetchTodayLastSession('football-wordle')
        if (last) {
          const m = last.metadata || {}
          this.showSummary = true
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
          this.xpEarned = Number(m.xpEarned || 0)
          this.won = !!m.won
          this.score = Number(last.score_final || 0)
          try { this.lifetimeMaxStreak = await mod.fetchLifetimeMaxStreak('football-wordle') || 0 } catch {}
          try {
            const p = this.allPlayersFull.find(pl => pl.id === m.targetId)
            if (p) { this.target = p; this.gameOver = true }
          } catch {}
        }
      }).catch(() => {})
    } else if (this.mode === 'challenge') {
      this.overlayOpen = true
      this.checkAvailability()
    } else {
      this.rng = createDailyRng('football-wordle')
      this.pickTarget()
    }
  },
  methods: {
    playerFlagUrl,
    countryNameEs,
    backPath() { return this.mode === 'free' ? '/play/free' : '/play/points' },
    pickTarget() {
      const [t] = sampleDistinct(this.allPlayers, 1, new Set(), this.rng)
      this.target = t
    },
    cellColor(result) {
      if (result === 'green') return 'bg-emerald-500/80 text-white'
      if (result === 'yellow') return 'bg-yellow-500/80 text-white'
      return 'bg-slate-600/80 text-slate-300'
    },
    submitPlayer(player) {
      if (this.gameOver || !player) return
      if (this.guessedIds.has(player.id)) { this.$refs.search?.shake(); return }

      const row = evaluateGuess(player, this.target)
      this.guesses.push(row)

      if (player.id === this.target.id) {
        this.won = true
        this.gameOver = true
        this.score = (GAME_SCORING['football-wordle']?.pointsPerCorrect || 150)
        if (this.mode === 'challenge') this.finishChallenge('win')
      } else if (this.guesses.length >= this.maxGuesses) {
        this.gameOver = true
        if (this.mode === 'challenge') this.finishChallenge('loss')
      }
    },
    async checkAvailability() {
      this.availability = await isChallengeAvailable('football-wordle')
    },
    async startChallenge({ difficulty, config }) {
      if (!this.availability.available) return
      this.selectedDifficulty = difficulty
      this.difficultyConfig = config
      this.maxGuesses = config.guesses
      try {
        const snap = await captureLevelSnapshot()
        this.levelBefore = snap.level
        this.xpBeforeTotal = snap.xpTotal
        this.beforePercent = snap.percent
      } catch {}
      this.rng = createDailyRng('football-wordle')
      this.pickTarget()
      try {
        this.sessionId = await startChallengeSession('football-wordle', null, { difficulty: this.selectedDifficulty })
      } catch (e) { console.error('[FootballWordle start]', e) }
      this.overlayOpen = false
    },
    async finishChallenge(result) {
      if (result === 'win') {
        this.xpEarned = this.difficultyConfig?.xpCompletion || 175
        setTimeout(() => celebrateGameWin(), 100)
      } else {
        this.xpEarned = 0
        setTimeout(() => announceGameLoss(), 100)
      }
      if (this.xpEarned > 0) {
        await awardXpBatch({ gameCode: 'football-wordle', totalXp: this.xpEarned, corrects: this.won ? 1 : 0 }).catch(() => {})
      }
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
      try {
        await completeChallengeSession(this.sessionId, this.score, this.xpEarned, {
          result, won: this.won, targetId: this.target?.id, guessCount: this.guesses.length,
          xpView: {
            levelBefore: this.levelBefore, xpBeforeTotal: this.xpBeforeTotal,
            levelAfter: this.levelAfter, xpAfterTotal: this.xpAfterTotal,
            beforePercent: this.beforePercent, afterPercent: this.afterPercent,
            xpToNextAfter: this.xpToNextAfter, xpEarned: this.xpEarned,
          }
        })
      } catch {}
      const delayMs = GAME_SCORING['football-wordle']?.summaryDelayMs ?? 2000
      setTimeout(() => {
        this.progressShown = this.beforePercent
        this.showSummary = true
        requestAnimationFrame(() => setTimeout(() => { this.progressShown = this.afterPercent }, 40))
      }, delayMs)
      import('../../services/game-modes').then(async (mod) => {
        try { this.lifetimeMaxStreak = await mod.fetchLifetimeMaxStreak('football-wordle') || 0 } catch {}
        try { await mod.checkAndUnlockDailyWins('football-wordle') } catch {}
      }).catch(() => {})
    },
  }
}
</script>

<template>
  <GameShell title="Adiviná el Crack" :backPath="backPath()">
    <GamePreviewModal
      :open="overlayOpen && mode === 'challenge' && !reviewMode"
      gameName="Adiviná el Crack"
      gameDescription="Adiviná al jugador misterioso con pistas de colores"
      gameType="wordle"
      :mechanic="gameMetadata.mechanic"
      :videoUrl="gameMetadata.videoUrl"
      :tips="gameMetadata.tips"
      @close="overlayOpen = false"
      @start="startChallenge"
    />

    <div class="w-full max-w-2xl mx-auto self-start mt-3">
      <div v-if="loading" class="text-center text-slate-300 py-12">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-300"></div>
        <p class="mt-3">Cargando...</p>
      </div>

      <template v-else>
        <ScoreBug :timed="false" livesMode :lives="remainingGuesses" :maxLives="maxGuesses" :xp="xpEarned" class="mb-3" />

        <div class="wd-layout">
          <!-- FICHA DEL MISTERIOSO -->
          <div class="wd-ficha">
            <div class="wd-shirt" :style="{ '--shirt-color': shirtColors.primary, '--shirt-secondary': shirtColors.secondary }">
              <span class="wd-shirt-num">{{ (revealed.dorsal || gameOver) ? (target.shirtNumber || '?') : '?' }}</span>
            </div>
            <p v-if="gameOver" class="text-center" :class="won ? 'text-emerald-400' : 'text-white'">
              <span class="font-display font-bold text-base leading-tight block">{{ target.name }}</span>
              <span v-if="!won" class="text-red-400/80 text-xs">No lo adivinaste</span>
            </p>
            <p v-else class="text-slate-300 text-xs font-medium text-center">¿Quién es el crack?</p>

            <div class="wd-icons">
              <div class="wd-icon" :class="(revealed.team || gameOver) ? 'on' : ''">
                <img v-if="(revealed.team || gameOver) && target.teamLogo" :src="target.teamLogo" alt="" @error="e=>e.target.style.display='none'" />
                <span v-else class="wd-icon-lock">🔒</span>
                <span class="wd-icon-lbl">{{ (revealed.team || gameOver) ? target.teamName : 'Equipo' }}</span>
              </div>
              <div class="wd-icon" :class="(revealed.league || gameOver) ? 'on' : ''">
                <img v-if="(revealed.league || gameOver) && targetLeagueLogo" :src="targetLeagueLogo" alt="" />
                <span v-else class="wd-icon-lock">🔒</span>
                <span class="wd-icon-lbl">Liga</span>
              </div>
              <div class="wd-icon" :class="(revealed.country || gameOver) ? 'on' : ''">
                <img v-if="(revealed.country || gameOver) && playerFlagUrl(target)" :src="playerFlagUrl(target)" class="!rounded-sm" />
                <span v-else class="wd-icon-lock">🔒</span>
                <span class="wd-icon-lbl">{{ (revealed.country || gameOver) ? countryNameEs(target.cname) : 'País' }}</span>
              </div>
              <div class="wd-icon" :class="(revealed.position || gameOver) ? 'on' : ''">
                <span v-if="(revealed.position || gameOver)" class="wd-icon-pos">{{ targetPosLabel }}</span>
                <span v-else class="wd-icon-lock">🔒</span>
                <span class="wd-icon-lbl">Posición</span>
              </div>
            </div>
          </div>

          <!-- BUSCADOR + HISTORIAL -->
          <div class="wd-main">
            <div v-if="!gameOver" class="mb-3">
              <PlayerSearch ref="search" placeholder="Escribí el nombre del jugador…" @pick="submitPlayer" />
            </div>

            <div v-if="guesses.length > 0" class="wd-table">
              <div class="wd-row wd-row-head">
                <div></div>
                <div class="text-center">Club</div>
                <div class="text-center">Liga</div>
                <div class="text-center">País</div>
                <div class="text-center">Pos</div>
                <div class="text-center">Edad</div>
                <div class="text-center">Alt</div>
                <div class="text-center">Dorsal</div>
              </div>
              <TransitionGroup name="guess-row" tag="div">
                <div v-for="row in guessesReversed" :key="row.player.id" class="wd-row">
                  <div class="wd-avatar" :title="row.player.name">
                    <img :src="row.player.image" :alt="row.player.name" @error="e => e.target.style.display='none'" />
                  </div>
                  <div class="wd-flap" :class="cellColor(row.teamResult)" style="animation-delay:0ms">
                    <img v-if="row.teamLogo" :src="row.teamLogo" alt="" @error="e => e.target.style.display='none'" />
                  </div>
                  <div class="wd-flap" :class="cellColor(row.leagueResult)" style="animation-delay:130ms">
                    <img v-if="row.leagueResult === 'green' && row.leagueLogo" :src="row.leagueLogo" alt="" />
                  </div>
                  <div class="wd-flap" :class="cellColor(row.countryResult)" style="animation-delay:260ms">
                    <img v-if="playerFlagUrl(row.player)" :src="playerFlagUrl(row.player)" class="!rounded-sm" />
                  </div>
                  <div class="wd-flap text-[11px] font-bold" :class="cellColor(row.posResult)" style="animation-delay:390ms">{{ row.posLabel }}</div>
                  <div class="wd-flap text-[11px] font-mono" :class="cellColor(row.ageResult)" style="animation-delay:520ms">{{ row.player.age }}<span v-if="row.ageArrow">{{ row.ageArrow }}</span></div>
                  <div class="wd-flap text-[11px] font-mono" :class="cellColor(row.heightResult)" style="animation-delay:650ms">{{ row.player.height || '?' }}<span v-if="row.heightArrow">{{ row.heightArrow }}</span></div>
                  <div class="wd-flap text-[11px] font-mono" :class="cellColor(row.dorsalResult)" style="animation-delay:780ms">{{ row.player.shirtNumber || '?' }}<span v-if="row.dorsalArrow">{{ row.dorsalArrow }}</span></div>
                </div>
              </TransitionGroup>
            </div>
          </div>
        </div>

        <GameSummaryPopup
          :show="showSummary"
          :corrects="won ? 1 : 0"
          :score="score"
          :maxStreak="0"
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
          :backPath="backPath()"
          @close="showSummary = false"
        />
      </template>
    </div>
  </GameShell>
</template>

<style scoped>
.wd-layout { display: flex; flex-direction: column; gap: 12px; width: 100%; min-width: 0; }
@media (min-width: 640px) {
  .wd-layout { display: grid; grid-template-columns: 170px minmax(0, 1fr); align-items: start; }
}

.wd-ficha {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 14px 10px;
  border-radius: 1rem;
  border: 1px solid rgba(255,255,255,0.1);
  background: linear-gradient(180deg, rgba(30,41,59,0.7), rgba(15,23,42,0.85));
}
.wd-shirt {
  --shirt-color: hsl(220 14% 30%);
  --shirt-secondary: hsl(220 14% 45%);
  position: relative;
  box-sizing: border-box;
  width: 76px;
  height: 74px;
  background: var(--shirt-color);
  border: 3px solid var(--shirt-secondary);
  clip-path: polygon(30% 0%, 70% 0%, 100% 18%, 84% 30%, 78% 24%, 78% 100%, 22% 100%, 22% 24%, 16% 30%, 0% 18%);
  transition: background-color 0.5s ease, border-color 0.5s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 16px rgba(0,0,0,0.35);
}
.wd-shirt-num { font-family: var(--font-display, inherit); font-weight: 800; font-size: 22px; color: #fff; margin-top: 10px; text-shadow: 0 1px 3px rgba(0,0,0,0.5); }
.wd-icons { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; width: 100%; margin-top: 2px; }
.wd-icon {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
  min-height: 48px; padding: 5px 2px; border-radius: 0.6rem;
  border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.03);
  opacity: 0.55; transition: opacity 0.3s ease, border-color 0.3s ease, background-color 0.3s ease;
}
.wd-icon.on { opacity: 1; border-color: rgba(16,185,129,0.4); background: rgba(16,185,129,0.12); animation: wdIconPop 0.4s ease; }
.wd-icon img { width: 20px; height: 20px; object-fit: contain; }
.wd-icon-lock { font-size: 12px; filter: grayscale(1); opacity: 0.6; }
.wd-icon-pos { font-family: var(--font-display, inherit); font-weight: 700; font-size: 13px; color: #fff; }
.wd-icon-lbl { font-size: 8px; text-transform: uppercase; letter-spacing: 0.03em; color: rgb(148,163,184); text-align: center; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wd-icon.on .wd-icon-lbl { color: rgb(209,250,229); }
@keyframes wdIconPop { 0% { transform: scale(0.8); } 60% { transform: scale(1.08); } 100% { transform: scale(1); } }

.wd-main { min-width: 0; }
.wd-table { display: flex; flex-direction: column; gap: 4px; width: 100%; }
.wd-row { display: grid; grid-template-columns: 34px repeat(7, minmax(0, 1fr)); gap: 3px; }
.wd-row-head { font-size: 9px; color: rgb(100,116,139); text-transform: uppercase; letter-spacing: 0.03em; font-weight: 700; margin-bottom: 2px; }
.wd-avatar { border-radius: 0.5rem; overflow: hidden; aspect-ratio: 1; background: rgba(51,65,85,0.4); }
.wd-avatar img { width: 100%; height: 100%; object-fit: cover; }
.wd-flap {
  border-radius: 0.5rem; display: flex; align-items: center; justify-content: center;
  aspect-ratio: 1; perspective: 300px; animation: wdFlap 0.5s ease both;
}
.wd-flap img { width: 20px; height: 20px; object-fit: contain; }
@keyframes wdFlap {
  0% { transform: rotateX(0deg); opacity: 1; }
  49% { transform: rotateX(90deg); opacity: 0.25; }
  51% { transform: rotateX(-90deg); opacity: 0.25; }
  100% { transform: rotateX(0deg); opacity: 1; }
}

.guess-row-enter-active { transition: opacity 250ms ease, transform 250ms ease; }
.guess-row-enter-from { opacity: 0; transform: translateY(8px) scale(0.97); }
.guess-row-leave-active { transition: opacity 150ms ease; }
.guess-row-leave-to { opacity: 0; }
</style>
