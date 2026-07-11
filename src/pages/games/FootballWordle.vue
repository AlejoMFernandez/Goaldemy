<script>
import GameShell from '../../components/game/GameShell.vue'
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
    dorsalResult: g.shirtNumber === t.shirtNumber ? 'green' : Math.abs((g.shirtNumber || 0) - (t.shirtNumber || 0)) <= 5 ? 'yellow' : 'gray',
    dorsalArrow: g.shirtNumber === t.shirtNumber ? '' : (g.shirtNumber || 0) < (t.shirtNumber || 0) ? '▲' : '▼',
  }
}

export default {
  name: 'FootballWordle',
  components: { GameShell, GamePreviewModal, GameSummaryPopup },
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
    // Historial con el intento más nuevo arriba (aparece bajo el input, animado).
    guessesReversed() { return this.guesses.slice().reverse() },
    // Atributos "revelados": si algún intento acertó (verde) equipo/liga/país/posición,
    // se muestra en la carta estilo who-are-ya.
    revealed() {
      const r = { team: false, league: false, country: false, position: false }
      for (const g of this.guesses) {
        if (g.teamResult === 'green') r.team = true
        if (g.leagueResult === 'green') r.league = true
        if (g.countryResult === 'green') r.country = true
        if (g.posResult === 'green') r.position = true
      }
      return r
    },
    targetLeagueLogo() { return this.target ? leagueLogoForId(this.target.leagueId) : null },
    targetPosLabel() { return this.target ? (POS_LABELS[this.target.positionId] || 'MED') : '' },
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
      // Tocar una sugerencia la manda directo (más ágil, estilo who-are-ya).
      if (!p) return
      this.submitPlayer(p)
    },
    moveSelection(dir) {
      const n = this.suggestions.length
      if (!n) return
      if (this.selectedIndex < 0) this.selectedIndex = 0
      else this.selectedIndex = (this.selectedIndex + dir + n) % n
      this.suggestOpen = true
    },
    onEnterKey() {
      // Si hay una sola coincidencia, Enter la manda directo.
      if (this.suggestions.length === 1) { this.submitPlayer(this.suggestions[0]); return }
      // Si hay una opción resaltada con las flechas, mandarla.
      if (this.suggestOpen && this.selectedIndex >= 0 && this.suggestions[this.selectedIndex]) {
        this.submitPlayer(this.suggestions[this.selectedIndex])
        return
      }
      this.submit()
    },
    submitPlayer(player) {
      if (this.gameOver || !player) return
      if (this.guessedIds.has(player.id)) { this.guess = ''; this.suggestOpen = false; this.selectedIndex = -1; return }

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
    submit() {
      if (this.gameOver) return
      const name = (this.guess || '').trim()
      if (!name || name.length < 3) return
      const norm = name.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
      const player = this.allPlayers.find(
        p => (p.name || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '') === norm
      )
      if (!player) return
      this.submitPlayer(player)
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
  <GameShell title="Adiviná el Crack" :backPath="backPath()">
    <template #stat>
      <div class="inline-flex items-center gap-2 rounded-lg bg-slate-800/70 border border-white/12 px-2.5 py-1 shadow-lg shadow-black/20">
        <span class="text-slate-400 text-[10px] uppercase tracking-wider font-semibold">Intentos</span>
        <span class="font-display text-white font-extrabold text-base leading-none">{{ guesses.length }}/{{ maxGuesses }}</span>
      </div>
    </template>
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
    <div class="w-full max-w-2xl mx-auto">

      <!-- Loading -->
      <div v-if="loading" class="text-center text-slate-300 py-12">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400"></div>
        <p class="mt-3">Cargando...</p>
      </div>

      <template v-else>
        <!-- CARTA MISTERIOSA estilo who-are-ya -->
        <div class="relative rounded-2xl border border-white/10 bg-gradient-to-b from-slate-800/70 to-slate-900/85 px-4 pt-9 pb-4 sm:px-5 overflow-hidden">
          <div class="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full opacity-20 blur-3xl" style="background: radial-gradient(circle, rgba(16,185,129,0.4), transparent 70%);"></div>

          <!-- Esquina: intentos restantes -->
          <div class="absolute top-2.5 left-3 z-10 flex items-center gap-1.5" title="Intentos restantes">
            <svg class="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            <div class="flex items-center gap-1">
              <span v-for="n in maxGuesses" :key="n" class="w-1.5 h-1.5 rounded-full transition-colors" :class="n <= remainingGuesses ? 'bg-emerald-400' : 'bg-white/15'"></span>
            </div>
          </div>

          <!-- Esquina: leyenda -->
          <div class="absolute top-2.5 right-3 z-10 flex items-center gap-2 text-[9px] text-slate-400">
            <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded bg-emerald-500/80 inline-block"></span>Exacto</span>
            <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded bg-yellow-500/80 inline-block"></span>Cerca</span>
            <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded bg-slate-500/70 inline-block"></span>Lejos</span>
          </div>

          <div class="relative flex flex-col items-center gap-2.5">
            <!-- Foto misteriosa -->
            <div class="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-slate-700/60 border border-white/10 overflow-hidden shadow-xl">
              <img v-if="gameOver && target" :src="target.image" :alt="target.name" class="w-full h-full object-cover reveal-img" />
              <img v-else-if="target" :src="target.image" alt="?" class="w-full h-full object-cover" style="filter: blur(18px) brightness(0.55);" draggable="false" />
            </div>

            <div v-if="gameOver" class="text-center">
              <p :class="won ? 'text-emerald-400' : 'text-white'" class="font-display font-extrabold text-lg leading-tight">{{ target.name }}</p>
              <p v-if="!won" class="text-red-400/80 text-xs mt-0.5">No lo adivinaste</p>
            </div>
            <p v-else class="text-slate-300 text-sm font-medium">¿Quién es el crack?</p>

            <!-- Chips revelados (se destapan al acertar en verde) -->
            <div class="grid grid-cols-4 gap-2 w-full max-w-md mt-1">
              <div class="reveal-chip" :class="(revealed.team || gameOver) ? 'on' : 'off'">
                <img v-if="(revealed.team || gameOver) && target.teamLogo" :src="target.teamLogo" class="w-6 h-6 object-contain" @error="e=>e.target.style.display='none'" />
                <span v-else-if="!(revealed.team || gameOver)" class="chip-lock">🔒</span>
                <span class="chip-lbl">{{ (revealed.team || gameOver) ? target.teamName : 'Equipo' }}</span>
              </div>
              <div class="reveal-chip" :class="(revealed.league || gameOver) ? 'on' : 'off'">
                <img v-if="(revealed.league || gameOver) && targetLeagueLogo" :src="targetLeagueLogo" class="w-6 h-6 object-contain" @error="e=>e.target.style.display='none'" />
                <span v-else-if="!(revealed.league || gameOver)" class="chip-lock">🔒</span>
                <span class="chip-lbl">Liga</span>
              </div>
              <div class="reveal-chip" :class="(revealed.country || gameOver) ? 'on' : 'off'">
                <img v-if="(revealed.country || gameOver) && playerFlagUrl(target)" :src="playerFlagUrl(target)" class="w-6 h-4 object-cover rounded-sm" />
                <span v-else-if="!(revealed.country || gameOver)" class="chip-lock">🔒</span>
                <span class="chip-lbl">{{ (revealed.country || gameOver) ? target.cname : 'País' }}</span>
              </div>
              <div class="reveal-chip" :class="(revealed.position || gameOver) ? 'on' : 'off'">
                <span v-if="(revealed.position || gameOver)" class="chip-pos">{{ targetPosLabel }}</span>
                <span v-else class="chip-lock">🔒</span>
                <span class="chip-lbl">Posición</span>
              </div>
            </div>
          </div>
        </div>

        <!-- INPUT (justo bajo la carta, siempre visible) -->
        <div v-if="!gameOver" class="mt-3">
          <form class="relative w-full max-w-md mx-auto" @submit.prevent="submit">
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
                class="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
              />
              <div v-if="suggestOpen && suggestions.length > 0" class="absolute z-30 mt-1 w-full rounded-xl border border-white/10 bg-slate-900/95 backdrop-blur shadow-2xl max-h-56 overflow-auto">
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
            <div class="flex items-center justify-center mt-2">
              <button type="submit" :disabled="(guess?.length || 0) < 3"
                      class="rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110 text-white px-6 py-2 text-sm font-bold disabled:opacity-40 transition shadow-lg shadow-emerald-500/20">
                Adivinar
              </button>
            </div>
          </form>
        </div>

        <!-- HISTORIAL (más nuevo arriba, revela stat por stat) -->
        <div v-if="guesses.length > 0" class="mt-4 overflow-x-auto">
          <div class="min-w-[460px]">
            <div class="grid grid-cols-[44px_repeat(7,minmax(38px,1fr))] gap-1 text-[9px] text-slate-500 font-semibold uppercase tracking-wider mb-1 px-0.5">
              <div></div>
              <div class="text-center">Equipo</div>
              <div class="text-center">Liga</div>
              <div class="text-center">País</div>
              <div class="text-center">Pos</div>
              <div class="text-center">Edad</div>
              <div class="text-center">Alt</div>
              <div class="text-center">Dorsal</div>
            </div>
            <TransitionGroup name="guess-row" tag="div" class="space-y-1">
              <div v-for="row in guessesReversed" :key="row.player.id"
                   class="grid grid-cols-[44px_repeat(7,minmax(38px,1fr))] gap-1">
                <!-- Jugador: solo imagen (sin nombre) -->
                <div class="rounded-lg bg-slate-700/40 overflow-hidden aspect-square" :title="row.player.name">
                  <img :src="row.player.image" :alt="row.player.name" class="w-full h-full object-cover" @error="e => e.target.style.display='none'" />
                </div>
                <!-- Equipo -->
                <div class="reveal-cell rounded-lg flex items-center justify-center aspect-square" :class="cellColor(row.teamResult)" style="animation-delay:0ms">
                  <img v-if="row.teamLogo" :src="row.teamLogo" alt="" class="w-6 h-6 object-contain" @error="e => e.target.style.display='none'" />
                </div>
                <!-- Liga: sin logo gris, sólo el fondo pintado -->
                <div class="reveal-cell rounded-lg flex items-center justify-center aspect-square" :class="cellColor(row.leagueResult)" style="animation-delay:110ms">
                  <img v-if="row.leagueResult === 'green' && row.leagueLogo" :src="row.leagueLogo" alt="" class="w-6 h-6 object-contain" @error="e => e.target.style.display='none'" />
                </div>
                <!-- País -->
                <div class="reveal-cell rounded-lg flex items-center justify-center aspect-square" :class="cellColor(row.countryResult)" style="animation-delay:220ms">
                  <img v-if="playerFlagUrl(row.player)" :src="playerFlagUrl(row.player)" class="w-5 h-4 object-cover rounded-sm" />
                </div>
                <!-- Pos -->
                <div class="reveal-cell rounded-lg flex items-center justify-center aspect-square text-[11px] font-bold" :class="cellColor(row.posResult)" style="animation-delay:330ms">
                  {{ row.posLabel }}
                </div>
                <!-- Edad -->
                <div class="reveal-cell rounded-lg flex items-center justify-center aspect-square text-[11px] font-mono" :class="cellColor(row.ageResult)" style="animation-delay:440ms">
                  {{ row.player.age }}<span v-if="row.ageArrow" class="ml-0.5">{{ row.ageArrow }}</span>
                </div>
                <!-- Altura -->
                <div class="reveal-cell rounded-lg flex items-center justify-center aspect-square text-[11px] font-mono" :class="cellColor(row.heightResult)" style="animation-delay:550ms">
                  {{ row.player.height || '?' }}<span v-if="row.heightArrow" class="ml-0.5">{{ row.heightArrow }}</span>
                </div>
                <!-- Dorsal -->
                <div class="reveal-cell rounded-lg flex items-center justify-center aspect-square text-[11px] font-mono" :class="cellColor(row.dorsalResult)" style="animation-delay:660ms">
                  {{ row.player.shirtNumber || '?' }}<span v-if="row.dorsalArrow" class="ml-0.5">{{ row.dorsalArrow }}</span>
                </div>
              </div>
            </TransitionGroup>
          </div>
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
      </template>
    </div>
  </GameShell>
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

/* Chips estilo carta: se destapan al acertar el atributo en verde */
.reveal-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  min-height: 54px;
  padding: 6px 4px;
  border-radius: 0.7rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  transition: border-color 0.3s ease, background-color 0.3s ease, opacity 0.3s ease;
}
.reveal-chip.off { opacity: 0.55; }
.reveal-chip.on {
  border-color: rgba(16, 185, 129, 0.4);
  background: rgba(16, 185, 129, 0.12);
  animation: chipPop 0.42s ease;
}
.chip-lbl {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: rgb(148, 163, 184);
  text-align: center;
  line-height: 1.1;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.reveal-chip.on .chip-lbl { color: rgb(209, 250, 229); font-weight: 600; }
.chip-lock { font-size: 13px; opacity: 0.5; filter: grayscale(1); }
.chip-pos {
  font-family: var(--font-display, inherit);
  font-size: 15px;
  font-weight: 800;
  color: #fff;
  line-height: 1;
}
@keyframes chipPop {
  0% { transform: scale(0.82); opacity: 0.4; }
  60% { transform: scale(1.08); }
  100% { transform: scale(1); opacity: 1; }
}

/* Reveal stat por stat al mandar un jugador (cada celda aparece con delay) */
.reveal-cell { animation: cellReveal 0.42s ease both; }
@keyframes cellReveal {
  0% { opacity: 0; transform: scale(0.55) rotate(-8deg); }
  60% { opacity: 1; transform: scale(1.08); }
  100% { opacity: 1; transform: scale(1); }
}
</style>
