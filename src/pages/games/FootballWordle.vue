<script>
import AppH1 from '../../components/common/AppH1.vue'
import { getAllPlayersAsync, sampleDistinct } from '../../services/players'
import { getBroadPosition } from '../../services/game-common'
import { playerFlagUrl } from '../../services/countries'
import { captureLevelSnapshot } from '../../services/xp'
import { awardXpBatch } from '../../services/game-xp'
import { createDailyRng } from '../../services/seeded-random'
import { isChallengeAvailable, startChallengeSession, completeChallengeSession } from '../../services/game-modes'
import { celebrateGameWin, announceGameLoss, celebrateGameLevelUp } from '../../services/game-celebrations'
import { getGameMetadata, gameSummaryBlurb } from '../../services/games'
import { GAME_SCORING } from '../../services/scoring'
import GamePreviewModal from '../../components/game/GamePreviewModal.vue'
import GameSummaryPopup from '../../components/game/GameSummaryPopup.vue'

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

function positionClose(a, b) {
  return Math.abs(a - b) === 1
}

const POS_LABELS = { 0: 'POR', 1: 'DEF', 2: 'MED', 3: 'DEL' }

const LEAGUE_NAMES = { 47: 'Premier', 87: 'La Liga', 55: 'Serie A', 54: 'Bundesliga', 53: 'Ligue 1', 77: 'Mundial' }
function leagueNameForId(id) { return LEAGUE_NAMES[id] || 'Otra' }

function evaluateGuess(g, t) {
  return {
    player: g,
    teamResult: g.teamName === t.teamName ? 'green' : 'gray',
    teamLogo: g.teamLogo,
    leagueResult: g.leagueId === t.leagueId ? 'green' : 'gray',
    leagueLabel: leagueNameForId(g.leagueId),
    countryResult: g.cname === t.cname ? 'green' : getContinent(g.cname) === getContinent(t.cname) ? 'yellow' : 'gray',
    countryLabel: g.cname,
    posResult: g.positionId === t.positionId ? 'green' : positionClose(g.positionId, t.positionId) ? 'yellow' : 'gray',
    posLabel: POS_LABELS[g.positionId] || 'MED',
    ageResult: g.age === t.age ? 'green' : Math.abs(g.age - t.age) <= 2 ? 'yellow' : 'gray',
    ageArrow: g.age === t.age ? '' : g.age < t.age ? '▲' : '▼',
    heightResult: g.height === t.height ? 'green' : Math.abs((g.height || 0) - (t.height || 0)) <= 3 ? 'yellow' : 'gray',
    heightArrow: g.height === t.height ? '' : (g.height || 0) < (t.height || 0) ? '▲' : '▼',
    dorsalResult: g.shirtNumber === t.shirtNumber ? 'green' : Math.abs((g.shirtNumber || 0) - (t.shirtNumber || 0)) <= 5 ? 'yellow' : 'gray',
    dorsalArrow: g.shirtNumber === t.shirtNumber ? '' : (g.shirtNumber || 0) < (t.shirtNumber || 0) ? '▲' : '▼',
  }
}

export default {
  name: 'FootballWordle',
  components: { AppH1, GamePreviewModal, GameSummaryPopup },
  data() {
    return {
      loading: true,
      allPlayers: [],
      target: null,
      guesses: [],
      guess: '',
      won: false,
      gameOver: false,
      maxGuesses: 6,
      // autocomplete
      suggestOpen: false,
      selectedIndex: -1,
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
    suggestions() {
      const q = (this.guess || '').toString().trim()
      if (!q || q.length < 3) return []
      const nq = q.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
      const out = []
      const seen = new Set()
      for (const p of this.allPlayers) {
        if (this.guessedIds.has(p.id)) continue
        const n = (p?.name || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
        if (n.includes(nq) && !seen.has(n)) {
          seen.add(n)
          out.push(p)
        }
        if (out.length >= 12) break
      }
      return out
    },
    remainingGuesses() { return this.maxGuesses - this.guesses.length },
  },
  async mounted() {
    const mode = (this.$route.query.mode || '').toString().toLowerCase()
    if (mode === 'free') this.mode = 'free'
    else if (mode === 'challenge') this.mode = 'challenge'
    else if (mode === 'review') { this.mode = 'challenge'; this.reviewMode = true }
    else this.mode = 'normal'

    this.allPlayers = await getAllPlayersAsync()
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
          // Restore target for reveal
          try {
            const p = this.allPlayers.find(pl => pl.id === m.targetId)
            if (p) { this.target = p; this.gameOver = true }
          } catch {}
        }
      }).catch(() => {})
    } else if (this.mode === 'challenge') {
      this.overlayOpen = true
      this.checkAvailability()
    } else {
      // Free / normal mode: pick target with daily seed
      this.rng = createDailyRng('football-wordle')
      this.pickTarget()
    }
  },
  methods: {
    playerFlagUrl,
    backPath() { return this.mode === 'free' ? '/play/free' : '/play/points' },
    blurb() { return gameSummaryBlurb('football-wordle') },
    pickTarget() {
      const [t] = sampleDistinct(this.allPlayers, 1, new Set(), this.rng)
      this.target = t
    },
    cellColor(result) {
      if (result === 'green') return 'bg-emerald-500/80 text-white'
      if (result === 'yellow') return 'bg-yellow-500/80 text-white'
      return 'bg-slate-600/80 text-slate-300'
    },
    chooseSuggestion(p) {
      if (!p) return
      this.guess = p.name || ''
      this.suggestOpen = false
      this.selectedIndex = -1
    },
    moveSelection(dir) {
      const n = this.suggestions.length
      if (!n) return
      if (this.selectedIndex < 0) this.selectedIndex = 0
      else this.selectedIndex = (this.selectedIndex + dir + n) % n
      this.suggestOpen = true
    },
    onEnterKey() {
      if (this.suggestOpen && this.selectedIndex >= 0 && this.suggestions[this.selectedIndex]) {
        this.chooseSuggestion(this.suggestions[this.selectedIndex])
        return
      }
      this.submit()
    },
    submit() {
      if (this.gameOver) return
      const name = (this.guess || '').trim()
      if (!name || name.length < 3) return
      const norm = name.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
      const player = this.allPlayers.find(
        p => (p.name || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '') === norm
      )
      if (!player) return
      if (this.guessedIds.has(player.id)) return

      const row = evaluateGuess(player, this.target)
      this.guesses.push(row)
      this.guess = ''
      this.suggestOpen = false
      this.selectedIndex = -1

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
        this.sessionId = await startChallengeSession('football-wordle', null)
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
      await completeChallengeSession(this.sessionId, this.score, this.xpEarned, {
        result, won: this.won, targetId: this.target?.id, guessCount: this.guesses.length,
      }).catch(() => {})
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
      // Lifetime streak & daily wins
      import('../../services/game-modes').then(async (mod) => {
        try { this.lifetimeMaxStreak = await mod.fetchLifetimeMaxStreak('football-wordle') || 0 } catch {}
        try { await mod.checkAndUnlockDailyWins('football-wordle') } catch {}
      }).catch(() => {})
    },
  }
}
</script>

<template>
  <section class="grid place-items-center min-h-[calc(100dvh-4rem)]">
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
    <div class="space-y-4 w-full max-w-4xl">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <AppH1 class="text-3xl md:text-4xl flex-none">Adiviná el Crack</AppH1>
        <div class="flex items-center gap-2 self-stretch sm:self-auto flex-none">
          <router-link :to="backPath()" class="rounded-full border border-white/15 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/5 transition">← Volver</router-link>
          <div class="rounded-xl bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-white/15 px-3 py-2 flex items-center gap-2 shadow-lg shadow-black/20">
            <span class="text-slate-400 text-xs uppercase tracking-wider font-semibold">Intentos</span>
            <span class="font-display text-white font-extrabold text-lg leading-none">{{ guesses.length }}/{{ maxGuesses }}</span>
          </div>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="text-center text-slate-300 py-12">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400"></div>
        <p class="mt-3">Cargando...</p>
      </div>

      <div v-else class="relative card p-4 sm:p-6 ring-1 ring-white/5">
        <!-- Mystery player icon -->
        <div class="flex flex-col items-center gap-2 mb-4">
          <div class="w-24 h-24 sm:w-28 sm:h-28 rounded-xl bg-slate-700/60 border border-white/10 flex items-center justify-center overflow-hidden">
            <template v-if="gameOver && target">
              <img :src="target.image" :alt="target.name" class="w-full h-full object-cover reveal-img" />
            </template>
            <template v-else>
              <svg class="w-12 h-12 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
              </svg>
            </template>
          </div>
          <p v-if="!gameOver" class="text-slate-300 text-sm text-center">Adiviná al jugador misterioso</p>
          <div v-if="gameOver && won" class="text-center">
            <p class="text-emerald-400 font-bold text-lg">{{ target.name }}</p>
            <p class="text-slate-400 text-sm flex items-center justify-center gap-1">
              <span>{{ target.teamName }} -</span>
              <img v-if="playerFlagUrl(target)" :src="playerFlagUrl(target)" class="w-4 h-3 object-cover rounded-sm" />
              <span>{{ target.cname }}</span>
            </p>
          </div>
          <div v-else-if="gameOver && !won" class="text-center">
            <p class="text-red-400 font-semibold text-sm">No adivinaste. Era:</p>
            <p class="text-white font-bold text-lg">{{ target.name }}</p>
            <p class="text-slate-400 text-sm flex items-center justify-center gap-1">
              <span>{{ target.teamName }} -</span>
              <img v-if="playerFlagUrl(target)" :src="playerFlagUrl(target)" class="w-4 h-3 object-cover rounded-sm" />
              <span>{{ target.cname }}</span>
            </p>
          </div>
        </div>

        <!-- Color legend -->
        <div class="flex items-center justify-center gap-3 mb-3 text-xs text-slate-400">
          <span class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-emerald-500/80 inline-block"></span> Exacto</span>
          <span class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-yellow-500/80 inline-block"></span> Cerca</span>
          <span class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-slate-600/80 inline-block"></span> Lejos</span>
        </div>

        <!-- Guess grid -->
        <div v-if="guesses.length > 0" class="overflow-x-auto mb-4">
          <!-- Column headers -->
          <div class="grid grid-cols-[minmax(90px,1fr)_repeat(7,minmax(48px,1fr))] gap-1 text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1 px-1 min-w-[500px]">
            <div>Jugador</div>
            <div class="text-center">Equipo</div>
            <div class="text-center">Liga</div>
            <div class="text-center">País</div>
            <div class="text-center">Pos</div>
            <div class="text-center">Edad</div>
            <div class="text-center">Altura</div>
            <div class="text-center">Dorsal</div>
          </div>
          <!-- Rows -->
          <TransitionGroup name="guess-row" tag="div" class="space-y-1">
            <div v-for="(row, idx) in guesses" :key="idx"
                 class="grid grid-cols-[minmax(90px,1fr)_repeat(7,minmax(48px,1fr))] gap-1 min-w-[500px]">
              <!-- Player name + image -->
              <div class="flex items-center gap-2 rounded-lg bg-slate-700/40 px-2 py-1.5 min-w-0">
                <img :src="row.player.image" :alt="row.player.name" class="w-7 h-7 rounded object-cover flex-shrink-0" @error="e => e.target.style.display='none'" />
                <span class="text-white text-sm truncate">{{ row.player.name }}</span>
              </div>
              <!-- Team -->
              <div :class="['rounded-lg flex items-center justify-center px-1 py-1.5 text-center', cellColor(row.teamResult)]">
                <img v-if="row.teamLogo" :src="row.teamLogo" alt="" class="w-6 h-6 object-contain" @error="e => e.target.style.display='none'" />
              </div>
              <!-- League -->
              <div :class="['rounded-lg flex items-center justify-center px-1 py-1.5 text-xs text-center leading-tight', cellColor(row.leagueResult)]">
                {{ row.leagueLabel }}
              </div>
              <!-- Country -->
              <div :class="['rounded-lg flex items-center justify-center gap-1 px-1 py-1.5 text-xs text-center leading-tight', cellColor(row.countryResult)]">
                <img v-if="playerFlagUrl(row.player)" :src="playerFlagUrl(row.player)" class="w-4 h-3 object-cover rounded-sm shrink-0" />
                <span class="truncate">{{ row.countryLabel }}</span>
              </div>
              <!-- Position -->
              <div :class="['rounded-lg flex items-center justify-center px-1 py-1.5 text-xs font-bold text-center', cellColor(row.posResult)]">
                {{ row.posLabel }}
              </div>
              <!-- Age -->
              <div :class="['rounded-lg flex items-center justify-center px-1 py-1.5 text-xs font-mono text-center', cellColor(row.ageResult)]">
                {{ row.player.age }} <span v-if="row.ageArrow" class="ml-0.5">{{ row.ageArrow }}</span>
              </div>
              <!-- Height -->
              <div :class="['rounded-lg flex items-center justify-center px-1 py-1.5 text-xs font-mono text-center', cellColor(row.heightResult)]">
                {{ row.player.height || '?' }} <span v-if="row.heightArrow" class="ml-0.5">{{ row.heightArrow }}</span>
              </div>
              <!-- Dorsal -->
              <div :class="['rounded-lg flex items-center justify-center px-1 py-1.5 text-xs font-mono text-center', cellColor(row.dorsalResult)]">
                {{ row.player.shirtNumber || '?' }} <span v-if="row.dorsalArrow" class="ml-0.5">{{ row.dorsalArrow }}</span>
              </div>
            </div>
          </TransitionGroup>
        </div>

        <!-- Input area -->
        <div v-if="!gameOver" class="flex flex-col items-center gap-2">
          <form class="relative w-full max-w-md" @submit.prevent="submit">
            <div class="relative">
              <input
                v-model="guess"
                @focus="suggestOpen = true"
                @input="suggestOpen = (guess?.length || 0) >= 3; selectedIndex = -1"
                @keydown.down.prevent="moveSelection(1)"
                @keydown.up.prevent="moveSelection(-1)"
                @keydown.enter.prevent="onEnterKey"
                type="text"
                placeholder="Escribí el nombre del jugador..."
                class="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-white/20"
              />
              <!-- Autocomplete dropdown -->
              <div v-if="suggestOpen && suggestions.length > 0" class="absolute z-20 mt-1 w-full rounded-xl border border-white/10 bg-slate-900/95 backdrop-blur shadow-lg max-h-64 overflow-auto">
                <ul>
                  <li v-for="(p, idx) in suggestions" :key="p.id" @click.prevent="chooseSuggestion(p)"
                      :class="['px-3 py-2 cursor-pointer text-slate-200 flex items-center gap-2', idx === selectedIndex ? 'bg-white/10' : 'hover:bg-white/5']">
                    <img :src="p.image" :alt="p.name" class="h-6 w-6 object-cover rounded flex-shrink-0" @error="e => e.target.style.display='none'" />
                    <span class="truncate">{{ p.name }}</span>
                    <span class="text-slate-500 text-xs ml-auto flex-shrink-0">{{ p.teamName }}</span>
                  </li>
                </ul>
              </div>
            </div>
            <div class="flex items-center justify-center gap-3 mt-2">
              <button type="submit" :disabled="(guess?.length || 0) < 3"
                      class="rounded-full bg-[oklch(0.62_0.21_270)] hover:brightness-110 border border-white/10 text-white px-5 py-2 text-sm font-semibold disabled:opacity-50 transition">
                Adivinar
              </button>
              <span class="text-slate-500 text-xs">{{ remainingGuesses }} intento{{ remainingGuesses === 1 ? '' : 's' }} restante{{ remainingGuesses === 1 ? '' : 's' }}</span>
            </div>
          </form>
        </div>

        <!-- Summary Popup -->
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
      </div>
    </div>
  </section>
</template>

<style scoped>
.guess-row-enter-active {
  transition: opacity 250ms ease, transform 250ms ease;
}
.guess-row-enter-from {
  opacity: 0;
  transform: translateY(8px) scale(0.97);
}
.guess-row-leave-active {
  transition: opacity 150ms ease;
}
.guess-row-leave-to {
  opacity: 0;
}
.reveal-img {
  animation: revealPop 400ms ease both;
}
@keyframes revealPop {
  0% { transform: scale(0.7); opacity: 0; }
  60% { transform: scale(1.05); }
  100% { transform: scale(1); opacity: 1; }
}
</style>
