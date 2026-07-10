<script>
import GameShell from '../../components/game/GameShell.vue'
import GamePreviewModal from '../../components/game/GamePreviewModal.vue'
import GameSummaryPopup from '../../components/game/GameSummaryPopup.vue'
import { getAllPlayersAsync } from '../../services/players'
import { isChallengeAvailable, startChallengeSession, completeChallengeSession } from '../../services/game-modes'
import { captureLevelSnapshot } from '../../services/xp'
import { awardXpBatch } from '../../services/game-xp'
import { celebrateCorrect, celebrateGameWin, announceGameLoss, celebrateGameLevelUp } from '../../services/game-celebrations'
import { playCorrectSound, playIncorrectSound } from '../../services/sounds'
import { createDailyRng } from '../../services/seeded-random'
import { getGameMetadata } from '../../services/games'
import { countryCodeFromName } from '../../services/countries'

const POS_LABELS = { 0: 'Arquero', 1: 'Defensor', 2: 'Mediocampista', 3: 'Delantero' }

function generateGrid(allPlayers, rng) {
  const teamCounts = {}
  allPlayers.forEach(p => { if (p.teamName) teamCounts[p.teamName] = (teamCounts[p.teamName] || 0) + 1 })
  const validTeams = Object.keys(teamCounts).filter(t => teamCounts[t] >= 5)
  const shuffledTeams = validTeams.sort(() => rng() - 0.5)
  const rowTeams = shuffledTeams.slice(0, 3)
  if (rowTeams.length < 3) return null

  const colCountries = []
  const usedCountries = new Set()
  for (let attempts = 0; attempts < 50 && colCountries.length < 3; attempts++) {
    const countries = {}
    allPlayers.forEach(p => {
      if (rowTeams.includes(p.teamName) && p.cname && !usedCountries.has(p.cname)) {
        countries[p.cname] = (countries[p.cname] || 0) + 1
      }
    })
    const viable = Object.entries(countries)
      .filter(([country]) => {
        const teamsWithCountry = rowTeams.filter(team =>
          allPlayers.some(p => p.teamName === team && p.cname === country)
        )
        return teamsWithCountry.length >= 2
      })
      .sort(() => rng() - 0.5)
    if (viable.length) {
      const [country] = viable[0]
      colCountries.push(country)
      usedCountries.add(country)
    }
  }
  if (colCountries.length < 3) return null

  const rows = rowTeams.map(team => ({ type: 'team', value: team, label: team }))
  const cols = colCountries.map(country => {
    const sample = allPlayers.find(p => p.cname === country)
    return { type: 'country', value: country, label: country, ccode: sample?.ccode || '' }
  })

  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const valid = allPlayers.some(p => p.teamName === rows[r].value && p.cname === cols[c].value)
      if (!valid) return null
    }
  }
  return { rows, cols }
}

function validatePlayer(player, rowConstraint, colConstraint) {
  const matchRow = rowConstraint.type === 'team' ? player.teamName === rowConstraint.value
    : rowConstraint.type === 'country' ? player.cname === rowConstraint.value
    : rowConstraint.type === 'position' ? player.positionId === rowConstraint.value
    : false
  const matchCol = colConstraint.type === 'team' ? player.teamName === colConstraint.value
    : colConstraint.type === 'country' ? player.cname === colConstraint.value
    : colConstraint.type === 'position' ? player.positionId === colConstraint.value
    : false
  return matchRow && matchCol
}

export default {
  name: 'FootballGrid',
  components: { GameShell, GamePreviewModal, GameSummaryPopup },
  data() {
    return {
      loading: true,
      allPlayers: [],
      gridConfig: null,
      cells: Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => ({ player: null, guessesLeft: 3, failed: false }))),
      usedPlayerIds: new Set(),
      activeCell: null,
      searchQuery: '',
      flashCell: null,
      // mode
      mode: 'normal',
      reviewMode: false,
      overlayOpen: false,
      sessionId: null,
      availability: { available: true, reason: null },
      showSummary: false,
      // scoring
      score: 0,
      corrects: 0,
      xpEarned: 0,
      allowXp: true,
      // XP progress
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
      // autocomplete
      selectedIndex: -1,
    }
  },
  computed: {
    gameMetadata() { return getGameMetadata('football-grid') },
    gameFinished() {
      if (!this.gridConfig) return false
      return this.cells.every(row => row.every(c => c.player || c.failed))
    },
    totalCells() { return 9 },
    suggestions() {
      const q = (this.searchQuery || '').trim()
      if (q.length < 3) return []
      const nq = q.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
      const out = []
      const seen = new Set()
      for (const p of this.allPlayers) {
        if (this.usedPlayerIds.has(p.id)) continue
        const n = (p.name || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
        if (n.includes(nq) && !seen.has(p.id)) {
          seen.add(p.id)
          out.push(p)
        }
        if (out.length >= 12) break
      }
      return out
    },
    teamLogoForRow() {
      if (!this.gridConfig) return () => ''
      return (row) => {
        const team = this.gridConfig.rows[row]
        if (team.type !== 'team') return ''
        const p = this.allPlayers.find(pl => pl.teamName === team.value && pl.teamLogo)
        return p?.teamLogo || ''
      }
    },
  },
  watch: {
    gameFinished(fin) {
      if (fin && this.mode === 'challenge') this.endChallenge()
    }
  },
  async mounted() {
    const mode = (this.$route.query.mode || '').toString().toLowerCase()
    if (mode === 'free') this.mode = 'free'
    else if (mode === 'challenge') this.mode = 'challenge'
    else if (mode === 'review') { this.mode = 'challenge'; this.reviewMode = true }
    else this.mode = 'normal'
    if (this.mode === 'free') this.allowXp = false

    this.allPlayers = await getAllPlayersAsync()

    if (this.reviewMode) {
      import('../../services/game-modes').then(async (mod) => {
        const last = await mod.fetchTodayLastSession('football-grid')
        if (last) {
          const m = last.metadata || {}
          this.corrects = m.corrects || 0
          this.score = m.score || 0
          this.xpEarned = m.xpEarned || 0
          this.showSummary = true
        }
      }).catch(() => {})
      this.loading = false
    } else if (this.mode === 'challenge') {
      this.overlayOpen = true
      this.checkAvailability()
      this.loading = false
    } else {
      this.initGrid(3)
    }
  },
  methods: {
    initGrid(guessesPerCell) {
      const rng = createDailyRng('football-grid')
      let grid = null
      for (let i = 0; i < 80; i++) {
        grid = generateGrid(this.allPlayers, rng)
        if (grid) break
      }
      if (!grid) {
        this.loading = false
        return
      }
      this.gridConfig = grid
      this.cells = Array.from({ length: 3 }, () =>
        Array.from({ length: 3 }, () => ({ player: null, guessesLeft: guessesPerCell, failed: false }))
      )
      this.usedPlayerIds = new Set()
      this.corrects = 0
      this.score = 0
      this.xpEarned = 0
      this.loading = false
    },
    backPath() { return this.mode === 'free' ? '/play/free' : '/play/points' },
    openCell(r, c) {
      const cell = this.cells[r][c]
      if (cell.player || cell.failed || this.gameFinished) return
      this.activeCell = { row: r, col: c }
      this.searchQuery = ''
      this.selectedIndex = -1
      this.$nextTick(() => {
        const input = this.$refs.searchInput
        if (input) input.focus()
      })
    },
    closeAutocomplete() {
      this.activeCell = null
      this.searchQuery = ''
      this.selectedIndex = -1
    },
    moveSelection(dir) {
      const n = this.suggestions.length
      if (!n) return
      if (this.selectedIndex < 0) this.selectedIndex = 0
      else this.selectedIndex = (this.selectedIndex + dir + n) % n
    },
    onEnterKey() {
      if (this.selectedIndex >= 0 && this.suggestions[this.selectedIndex]) {
        this.submitPlayer(this.suggestions[this.selectedIndex])
      }
    },
    submitPlayer(player) {
      if (!this.activeCell || !player) return
      const { row, col } = this.activeCell
      const cell = this.cells[row][col]
      if (cell.player || cell.failed) return

      if (this.usedPlayerIds.has(player.id)) return

      const rowConstraint = this.gridConfig.rows[row]
      const colConstraint = this.gridConfig.cols[col]
      const valid = validatePlayer(player, rowConstraint, colConstraint)

      if (valid) {
        cell.player = player
        this.usedPlayerIds.add(player.id)
        this.corrects++
        const cfg = this.difficultyConfig || { xpPerCell: 20 }
        this.xpEarned += cfg.xpPerCell || 20
        this.score += 30
        playCorrectSound()
        celebrateCorrect()
        this.closeAutocomplete()
      } else {
        cell.guessesLeft--
        playIncorrectSound()
        this.flashCell = `${row}-${col}`
        setTimeout(() => { this.flashCell = null }, 500)
        if (cell.guessesLeft <= 0) {
          cell.failed = true
          this.closeAutocomplete()
        } else {
          this.searchQuery = ''
          this.selectedIndex = -1
        }
      }
    },
    async endChallenge() {
      const allCorrect = this.corrects === 9
      if (allCorrect) {
        const cfg = this.difficultyConfig || { xpCompletion: 75 }
        this.xpEarned += cfg.xpCompletion || 75
        setTimeout(() => celebrateGameWin(), 100)
      } else {
        setTimeout(() => announceGameLoss(), 100)
      }

      if (this.allowXp && this.xpEarned > 0) {
        await awardXpBatch({ gameCode: 'football-grid', totalXp: this.xpEarned, corrects: this.corrects }).catch(() => {})
      }
      try {
        const result = allCorrect ? 'win' : 'loss'
        await completeChallengeSession(this.sessionId, this.score, this.xpEarned, {
          result, corrects: this.corrects, mode: 'challenge',
        })
      } catch (e) { console.error('[FootballGrid complete]', e) }

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

      setTimeout(() => {
        this.progressShown = this.beforePercent
        this.showSummary = true
        requestAnimationFrame(() => setTimeout(() => { this.progressShown = this.afterPercent }, 40))
      }, 1500)

      try { const mod = await import('../../services/game-modes'); await mod.checkAndUnlockDailyWins('football-grid') } catch {}
    },
    async checkAvailability() { this.availability = await isChallengeAvailable('football-grid') },
    async startChallenge({ difficulty, config }) {
      if (!this.availability.available) return
      this.selectedDifficulty = difficulty
      this.difficultyConfig = config
      try {
        const snap = await captureLevelSnapshot()
        this.levelBefore = snap.level
        this.xpBeforeTotal = snap.xpTotal
        this.beforePercent = snap.percent
      } catch {}
      try {
        this.sessionId = await startChallengeSession('football-grid', null)
        this.overlayOpen = false
        this.initGrid(config.guessesPerCell || 3)
      } catch (e) { console.error('[FootballGrid start]', e) }
    },
    flagSrc(constraint) {
      if (constraint.type !== 'country') return ''
      const iso = countryCodeFromName(constraint.value)
      return iso ? `https://flagcdn.com/w40/${iso}.png` : ''
    },
    cellClass(r, c) {
      const cell = this.cells[r][c]
      const flash = this.flashCell === `${r}-${c}`
      if (cell.player) return 'bg-emerald-500/15 border-emerald-400/30'
      if (cell.failed) return 'bg-red-500/10 border-red-400/20 opacity-60'
      if (flash) return 'bg-red-500/20 border-red-400/40 shake'
      return 'border-white/10 hover:border-white/25 hover:bg-white/5 hover:shadow-[inset_0_0_20px_rgba(255,255,255,0.05)] cursor-pointer'
    },
  }
}
</script>

<template>
  <GameShell title="La Grilla" :backPath="backPath()">
    <template #stat>
      <div class="inline-flex items-center gap-1.5 rounded-lg bg-slate-800/70 border border-white/12 px-2.5 py-1 shadow-lg shadow-black/20">
        <span class="text-slate-400 text-[10px] uppercase tracking-wider font-semibold">Celdas</span>
        <span class="font-display text-white font-extrabold text-base leading-none whitespace-nowrap">{{ corrects }}/9</span>
      </div>
    </template>

    <div v-if="loading" class="text-center text-slate-300 py-12">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400"></div>
      <p class="mt-3">Cargando grilla...</p>
    </div>

    <div v-else-if="!gridConfig" class="text-center text-slate-400 py-12">
      <p>No se pudo generar la grilla hoy. Intentalo de nuevo.</p>
      <button @click="initGrid(difficultyConfig?.guessesPerCell || 3)" class="mt-3 rounded-full bg-white/10 border border-white/15 px-4 py-2 text-sm text-slate-200 hover:bg-white/15 transition">Reintentar</button>
    </div>

    <div v-else class="relative w-full max-w-xl mx-auto">
      <!-- GRID TABLE -->
      <div class="grid-table select-none">
        <!-- Header row: empty corner + 3 column headers -->
        <div class="grid-corner"></div>
        <div v-for="(col, ci) in gridConfig.cols" :key="'ch-'+ci" class="grid-col-header">
          <img v-if="flagSrc(col)" :src="flagSrc(col)" alt="" class="grid-flag" />
          <span class="text-[10px] sm:text-xs text-slate-300 leading-tight text-center block mt-1 truncate max-w-full">{{ col.label }}</span>
        </div>

        <!-- 3 data rows -->
        <template v-for="(row, ri) in gridConfig.rows" :key="'r-'+ri">
          <!-- Row header -->
          <div class="grid-row-header">
            <img v-if="teamLogoForRow(ri)" :src="teamLogoForRow(ri)" alt="" class="grid-logo" />
            <span class="text-[10px] sm:text-xs text-slate-300 leading-tight text-center block mt-1 truncate max-w-full">{{ row.label }}</span>
          </div>
          <!-- 3 cells -->
          <div v-for="(col, ci) in gridConfig.cols" :key="'c-'+ri+'-'+ci"
               :class="['grid-cell border rounded-lg transition-all duration-200', cellClass(ri, ci)]"
               @click="openCell(ri, ci)">
            <!-- Filled: solo la foto del jugador (sin nombre) -->
            <template v-if="cells[ri][ci].player">
              <img :src="cells[ri][ci].player.image" :alt="cells[ri][ci].player.name"
                   class="grid-player-img" @error="e => e.target.style.display='none'" />
            </template>
            <!-- Failed -->
            <template v-else-if="cells[ri][ci].failed">
              <span class="text-2xl text-red-400/40">✕</span>
            </template>
            <!-- Empty -->
            <template v-else>
              <div class="flex flex-col items-center gap-1">
                <div class="w-9 h-9 rounded-full border-2 border-dashed border-white/15 flex items-center justify-center">
                  <span class="text-lg text-slate-500">+</span>
                </div>
                <span v-if="cells[ri][ci].guessesLeft < (difficultyConfig?.guessesPerCell || 3)" class="text-[10px] text-slate-500">
                  {{ cells[ri][ci].guessesLeft }} restantes
                </span>
              </div>
            </template>
          </div>
        </template>
      </div>

      <!-- FINISHED BANNER (free/normal mode) -->
      <div v-if="gameFinished && mode !== 'challenge'" class="mt-4 text-center space-y-2">
        <p class="text-lg" :class="corrects === 9 ? 'text-emerald-300' : 'text-slate-300'">
          {{ corrects === 9 ? 'Completaste la grilla!' : `Lograste ${corrects}/9 celdas` }}
        </p>
        <p class="text-sm text-slate-400">Puntaje: {{ score }}</p>
      </div>
    </div>

    <!-- OVERLAYS (fixed / teleport): fuera del flujo del cuerpo -->
    <GamePreviewModal
      :open="overlayOpen && mode === 'challenge' && !reviewMode"
      gameName="La Grilla"
      gameDescription="Completá la grilla 3x3 con jugadores que cumplan ambas condiciones"
      gameType="grid"
      :mechanic="gameMetadata.mechanic"
      :videoUrl="gameMetadata.videoUrl"
      :tips="gameMetadata.tips"
      @close="overlayOpen = false"
      @start="startChallenge"
    />

    <!-- AUTOCOMPLETE OVERLAY -->
    <Transition name="fade">
      <div v-if="activeCell" class="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm" @click.self="closeAutocomplete">
        <div class="w-full max-w-sm mx-4 rounded-2xl border border-white/15 bg-slate-900/95 shadow-2xl p-4 space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-sm text-slate-300 flex items-center gap-2">
              <img v-if="teamLogoForRow(activeCell.row)" :src="teamLogoForRow(activeCell.row)" alt="" class="w-6 h-6 object-contain" />
              <span class="text-white font-medium">{{ gridConfig.rows[activeCell.row].label }}</span>
              <span class="text-slate-500">+</span>
              <img v-if="flagSrc(gridConfig.cols[activeCell.col])" :src="flagSrc(gridConfig.cols[activeCell.col])" alt="" class="w-6 h-4 object-cover rounded-sm" />
              <span class="text-white font-medium">{{ gridConfig.cols[activeCell.col].label }}</span>
            </span>
            <button @click="closeAutocomplete" class="text-slate-400 hover:text-white text-lg leading-none">&times;</button>
          </div>
          <input ref="searchInput" v-model="searchQuery" type="text" placeholder="Escribi al menos 3 letras..."
                 @keydown.down.prevent="moveSelection(1)" @keydown.up.prevent="moveSelection(-1)"
                 @keydown.enter.prevent="onEnterKey" @keydown.escape="closeAutocomplete"
                 class="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-white/20 text-sm" />
          <div v-if="suggestions.length" class="rounded-xl border border-white/10 bg-slate-800/80 max-h-56 overflow-auto">
            <ul>
              <li v-for="(p, idx) in suggestions" :key="p.id" @click="submitPlayer(p)"
                  :class="['px-3 py-2 cursor-pointer text-slate-200 flex items-center gap-2.5 text-sm', idx === selectedIndex ? 'bg-white/10' : 'hover:bg-white/5']">
                <img :src="p.image" :alt="p.name" class="h-7 w-7 object-cover rounded-full flex-none" @error="e => e.target.style.display='none'" />
                <div class="min-w-0 flex-1">
                  <span class="block truncate">{{ p.name }}</span>
                  <span class="text-[11px] text-slate-500">{{ p.teamName }}</span>
                </div>
              </li>
            </ul>
          </div>
          <p v-else-if="searchQuery.length >= 3" class="text-sm text-slate-500 text-center py-2">Sin resultados</p>
        </div>
      </div>
    </Transition>

    <!-- Summary Popup -->
    <GameSummaryPopup
      :show="showSummary"
      :corrects="corrects"
      :score="score"
      :maxStreak="0"
      :lifetimeMaxStreak="0"
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
      :winThreshold="9"
      :backPath="backPath()"
      @close="showSummary = false"
    />
  </GameShell>
</template>

<style scoped>
.grid-table {
  display: grid;
  grid-template-columns: 68px repeat(3, minmax(0, 1fr));
  gap: 6px;
  width: 100%;
}
@media (min-width: 640px) {
  .grid-table { grid-template-columns: 92px repeat(3, minmax(0, 1fr)); gap: 8px; }
}
.grid-corner { /* empty top-left cell */ }
.grid-col-header, .grid-row-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4px 2px;
  min-width: 0;
}
/* Bandera y logo del equipo: la materia prima del juego, bien grandes */
.grid-flag {
  width: 52px;
  height: 34px;
  object-fit: cover;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
  outline: 1px solid rgba(255, 255, 255, 0.12);
}
.grid-logo {
  width: 46px;
  height: 46px;
  object-fit: contain;
  filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.4));
}
@media (min-width: 640px) {
  .grid-flag { width: 64px; height: 42px; }
  .grid-logo { width: 58px; height: 58px; }
}
.grid-cell {
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 0;
  padding: 3px;
}
.grid-player-img {
  width: 84%;
  height: 84%;
  max-width: 92px;
  max-height: 92px;
  border-radius: 12px;
  object-fit: cover;
}

/* Transitions */
.fade-enter-active, .fade-leave-active { transition: opacity 150ms ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* Shake animation for wrong guesses */
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-4px); }
  40% { transform: translateX(4px); }
  60% { transform: translateX(-3px); }
  80% { transform: translateX(3px); }
}
.shake { animation: shake 0.35s ease; }
</style>
