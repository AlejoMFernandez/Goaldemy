<script>
import GameShell from '../../components/game/GameShell.vue'
import GamePreviewModal from '../../components/game/GamePreviewModal.vue'
import GameSummaryPopup from '../../components/game/GameSummaryPopup.vue'
import ScoreBug from '../../components/game/ScoreBug.vue'
import PlayerSearch from '../../components/game/PlayerSearch.vue'
import { getAllPlayersAsync } from '../../services/players'
import { isChallengeAvailable, startChallengeSession, completeChallengeSession } from '../../services/game-modes'
import { captureLevelSnapshot } from '../../services/xp'
import { awardXpBatch } from '../../services/game-xp'
import { getAuthUser } from '../../services/auth'
import { setPendingGuestClaim } from '../../services/guest-play'
import { celebrateCorrect, celebrateGameWin, announceGameLoss, celebrateGameLevelUp } from '../../services/game-celebrations'
import { playCorrectSound, playIncorrectSound } from '../../services/sounds'
import { createDailyRng } from '../../services/seeded-random'
import { getGameMetadata } from '../../services/games'
import { countryCodeFromName, countryNameEs } from '../../services/countries'
import * as fx from '../../services/game-fx'

function surname(name) {
  const w = (name || '').trim().split(' ')
  if (w.length < 2) return name || ''
  if (/^(júnior|junior|jr\.?)$/i.test(w[w.length - 1])) return w[0]
  return w.slice(1).join(' ')
}

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
    return { type: 'country', value: country, label: countryNameEs(country), ccode: sample?.ccode || '' }
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
    : false
  const matchCol = colConstraint.type === 'team' ? player.teamName === colConstraint.value
    : colConstraint.type === 'country' ? player.cname === colConstraint.value
    : false
  return matchRow && matchCol
}

export default {
  name: 'FootballGrid',
  components: { GameShell, GamePreviewModal, GameSummaryPopup, ScoreBug, PlayerSearch },
  data() {
    return {
      loading: true,
      allPlayers: [],
      gridConfig: null,
      cells: Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => ({ player: null, guessesLeft: 3, failed: false, inLine: false }))),
      usedPlayerIds: new Set(),
      activeCell: null,
      stampKey: null, // "r-c" de la celda recién llenada (para que sólo ella gire)
      toastMsg: '',
      cellRefs: {},
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
    }
  },
  computed: {
    gameMetadata() { return getGameMetadata('football-grid') },
    isGuest() { return !getAuthUser()?.id },
    gameFinished() {
      if (!this.gridConfig) return false
      return this.cells.every(row => row.every(c => c.player || c.failed))
    },
    guessesPerCell() { return this.difficultyConfig?.guessesPerCell || 3 },
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
      this.initGrid()
    }
  },
  methods: {
    surname,
    setCellRef(r, c, el) { if (el) this.cellRefs[`${r}-${c}`] = el },
    showToast(msg) {
      this.toastMsg = msg
      clearTimeout(this._toastT)
      this._toastT = setTimeout(() => { this.toastMsg = '' }, 1700)
    },
    initGrid() {
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
        Array.from({ length: 3 }, () => ({ player: null, guessesLeft: this.guessesPerCell, failed: false, inLine: false }))
      )
      this.usedPlayerIds = new Set()
      this.corrects = 0
      this.score = 0
      this.xpEarned = 0
      this.loading = false
    },
    backPath() { if (this.isGuest) return '/'; return this.mode === 'free' ? '/play/free' : '/play/points' },
    openCell(r, c) {
      const cell = this.cells[r][c]
      if (cell.player || cell.failed || this.gameFinished) return
      this.activeCell = { row: r, col: c }
      this.$nextTick(() => this.$refs.search?.focus?.())
    },
    closeSheet() { this.activeCell = null },
    submitPlayer(player) {
      if (!this.activeCell || !player) return
      const { row, col } = this.activeCell
      const cell = this.cells[row][col]
      if (cell.player || cell.failed) return

      if (this.usedPlayerIds.has(player.id)) {
        this.showToast('Ya lo usaste en otra celda')
        this.$refs.search?.shake()
        return
      }

      const rowConstraint = this.gridConfig.rows[row]
      const colConstraint = this.gridConfig.cols[col]
      const valid = validatePlayer(player, rowConstraint, colConstraint)

      if (valid) {
        cell.player = player
        this.usedPlayerIds.add(player.id)
        this.corrects++
        const key = `${row}-${col}`
        this.stampKey = key
        setTimeout(() => { if (this.stampKey === key) this.stampKey = null }, 520)
        const cfg = this.difficultyConfig || { xpPerCell: 20 }
        const gained = cfg.xpPerCell || 20
        if (this.allowXp) this.xpEarned += gained
        this.score += 30
        playCorrectSound()
        celebrateCorrect()
        this.closeSheet()
        this.$nextTick(() => {
          const el = this.cellRefs[key]
          const bug = this.$refs.bug
          if (el) {
            const c = fx.center(el)
            fx.sparks(c.x, c.y, 14, ['#4ade80', '#fff'], 50)
            if (this.allowXp && gained > 0 && bug) {
              fx.flyTo({ from: el, to: bug.xpEl(), html: `+${gained} XP`, className: 'gfx-xp', duration: 500 })
                .then(() => bug.bumpXp())
            }
          }
          this.markLines()
        })
      } else {
        this.$refs.search?.shake()
        playIncorrectSound()
        cell.guessesLeft--
        this.showToast(`${surname(player.name)}: ${player.teamName} · ${countryNameEs(player.cname)}`)
        if (cell.guessesLeft <= 0) {
          cell.failed = true
          this.closeSheet()
        }
      }
    },
    // Tateti: fila o columna completa (las 3 celdas con jugador) se ilumina dorado.
    markLines() {
      for (let r = 0; r < 3; r++) {
        if (this.cells[r].every(c => c.player)) this.cells[r].forEach(c => { c.inLine = true })
      }
      for (let c = 0; c < 3; c++) {
        if (this.cells.every(row => row[c].player)) this.cells.forEach(row => { row[c].inLine = true })
      }
    },
    async endChallenge() {
      const allCorrect = this.corrects === 9
      if (allCorrect) {
        const cfg = this.difficultyConfig || { xpCompletion: 75 }
        if (this.allowXp) this.xpEarned += cfg.xpCompletion || 75
        setTimeout(() => celebrateGameWin(), 100)
      } else {
        setTimeout(() => announceGameLoss(), 100)
      }

      if (this.isGuest) {
        if (this.xpEarned > 0) {
          setPendingGuestClaim({ game: 'football-grid', corrects: this.corrects, total: 9, maxStreak: 0 })
        }
      } else if (this.allowXp && this.xpEarned > 0) {
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
        this.sessionId = await startChallengeSession('football-grid', null, { difficulty: this.selectedDifficulty })
        this.overlayOpen = false
        this.initGrid()
      } catch (e) { console.error('[FootballGrid start]', e) }
    },
    flagSrc(constraint) {
      if (constraint.type !== 'country') return ''
      const iso = countryCodeFromName(constraint.value)
      return iso ? `https://flagcdn.com/w80/${iso}.png` : ''
    },
    teamLogoForRow(ri) {
      const team = this.gridConfig?.rows[ri]
      if (!team || team.type !== 'team') return ''
      const p = this.allPlayers.find(pl => pl.teamName === team.value && pl.teamLogo)
      return p?.teamLogo || ''
    },
  }
}
</script>

<template>
  <GameShell title="La Grilla" :backPath="backPath()">
    <div v-if="loading" class="text-center text-slate-300 py-12">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-300"></div>
      <p class="mt-3">Cargando grilla...</p>
    </div>

    <div v-else-if="!gridConfig" class="text-center text-slate-400 py-12">
      <p>No se pudo generar la grilla hoy. Intentalo de nuevo.</p>
      <button @click="initGrid" class="mt-3 rounded-full bg-white/10 border border-white/15 px-4 py-2 text-sm text-slate-200 hover:bg-white/15 transition">Reintentar</button>
    </div>

    <div v-else class="relative w-full max-w-xl mx-auto self-start mt-3 space-y-3">
      <ScoreBug ref="bug" :timed="false" :corrects="corrects" :target="9" :xp="xpEarned" />

      <!-- GRID TABLE -->
      <div class="grid-table select-none">
        <div class="grid-corner"></div>
        <div v-for="(col, ci) in gridConfig.cols" :key="'ch-'+ci" class="grid-col-header">
          <img v-if="flagSrc(col)" :src="flagSrc(col)" alt="" class="grid-flag" />
          <span class="grid-label">{{ col.label }}</span>
        </div>

        <template v-for="(row, ri) in gridConfig.rows" :key="'r-'+ri">
          <div class="grid-row-header">
            <img v-if="teamLogoForRow(ri)" :src="teamLogoForRow(ri)" alt="" class="grid-logo" />
            <span class="grid-label">{{ row.label }}</span>
          </div>
          <div v-for="(col, ci) in gridConfig.cols" :key="'c-'+ri+'-'+ci" :ref="el => setCellRef(ri, ci, el)"
               :class="[
                 'grid-cell border rounded-lg transition-all duration-200',
                 cells[ri][ci].player ? 'bg-emerald-500/15 border-emerald-400/30' : cells[ri][ci].failed ? 'bg-red-500/10 border-red-400/20 opacity-60' : 'border-white/10 hover:border-white/25 hover:bg-white/5 cursor-pointer',
                 cells[ri][ci].inLine ? 'grid-cell-line' : '',
                 stampKey === `${ri}-${ci}` ? 'grid-cell-stamp' : '',
               ]"
               @click="openCell(ri, ci)">
            <template v-if="cells[ri][ci].player">
              <img :src="cells[ri][ci].player.image" :alt="cells[ri][ci].player.name"
                   class="grid-player-img" @error="e => e.target.style.display='none'" />
              <span class="grid-player-name">{{ surname(cells[ri][ci].player.name) }}</span>
            </template>
            <template v-else-if="cells[ri][ci].failed">
              <span class="text-2xl text-red-400/40">✕</span>
            </template>
            <template v-else>
              <div class="flex flex-col items-center gap-1.5">
                <div class="w-9 h-9 rounded-full border-2 border-dashed border-white/15 flex items-center justify-center">
                  <span class="text-lg text-slate-500">+</span>
                </div>
                <div class="flex items-center gap-1">
                  <i v-for="d in guessesPerCell" :key="d" class="grid-dot" :class="{ off: d > cells[ri][ci].guessesLeft }"></i>
                </div>
              </div>
            </template>
          </div>
        </template>
      </div>

      <!-- Sheet (consigna + buscador), sube desde abajo sin tapar la grilla entera -->
      <div class="grid-sheet" :class="{ on: activeCell }">
        <button class="grid-sheet-close" aria-label="Cerrar" @click="closeSheet">✕</button>
        <div v-if="activeCell" class="grid-sheet-q">
          <img v-if="teamLogoForRow(activeCell.row)" :src="teamLogoForRow(activeCell.row)" alt="" class="w-7 h-7 object-contain" />
          <span>{{ gridConfig.rows[activeCell.row].label }}</span>
          <span class="text-slate-500">+</span>
          <img v-if="flagSrc(gridConfig.cols[activeCell.col])" :src="flagSrc(gridConfig.cols[activeCell.col])" alt="" class="w-7 h-5 object-cover rounded-sm" />
          <span>{{ gridConfig.cols[activeCell.col].label }}</span>
        </div>
        <PlayerSearch v-if="activeCell" ref="search" :show-team="false" placeholder="¿Quién va acá? Escribí un jugador…" @pick="submitPlayer" />
      </div>
      <Transition name="fade"><div v-if="activeCell" class="grid-scrim" @click="closeSheet"></div></Transition>

      <!-- Toast -->
      <Transition name="fade">
        <div v-if="toastMsg" class="grid-toast">{{ toastMsg }}</div>
      </Transition>

      <!-- FINISHED BANNER (free/normal mode) -->
      <div v-if="gameFinished && mode !== 'challenge'" class="mt-4 text-center space-y-2">
        <p class="text-lg" :class="corrects === 9 ? 'text-emerald-300' : 'text-slate-300'">
          {{ corrects === 9 ? 'Completaste la grilla!' : `Lograste ${corrects}/9 celdas` }}
        </p>
        <p class="text-sm text-slate-400">Puntaje: {{ score }}</p>
      </div>
    </div>

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
      :guest="isGuest"
      :resultLine="isGuest ? (corrects === 9 ? 'Completé la grilla ✅' : `Completé ${corrects}/9 celdas`) : ''"
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
.grid-col-header, .grid-row-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4px 2px;
  min-width: 0;
}
.grid-label { font-size: 10px; line-height: 1.15; color: rgb(203, 213, 225); text-align: center; margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
@media (min-width: 640px) { .grid-label { font-size: 12px; } }
.grid-flag {
  width: 52px; height: 34px; object-fit: cover; border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35); outline: 1px solid rgba(255, 255, 255, 0.12);
}
.grid-logo { width: 46px; height: 46px; object-fit: contain; filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.4)); }
@media (min-width: 640px) {
  .grid-flag { width: 64px; height: 42px; }
  .grid-logo { width: 58px; height: 58px; }
}
.grid-cell {
  position: relative;
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 0;
  padding: 3px;
  perspective: 500px;
}
.grid-cell-line { box-shadow: 0 0 0 3px var(--play-400, #fcd34d), 0 0 18px rgba(252, 211, 77, 0.5); }
.grid-cell-stamp { animation: grid-stampin 0.5s cubic-bezier(.34,1.56,.64,1); }
@keyframes grid-stampin { from { transform: rotateY(90deg) scale(.8); } to { transform: none; } }
.grid-player-img { width: 78%; height: 78%; max-width: 88px; max-height: 88px; border-radius: 10px; object-fit: cover; }
.grid-player-name { position: absolute; left: 2px; right: 2px; bottom: 2px; font-size: 9px; font-weight: 700; text-transform: uppercase; color: #fff; text-align: center; background: linear-gradient(transparent, rgba(0,0,0,.85)); padding: 10px 2px 3px; border-radius: 0 0 8px 8px; }
.grid-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--play-400, #fcd34d); display: block; }
.grid-dot.off { background: rgba(255, 255, 255, 0.2); }

.grid-scrim { position: fixed; inset: 0; z-index: 39; background: rgba(0,0,0,.35); }
.grid-sheet {
  position: relative;
  z-index: 40;
  background: #141a38;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 16px;
  padding: 0;
  max-height: 0;
  overflow: hidden;
  opacity: 0;
  transform: translateY(12px);
  transition: transform 0.35s cubic-bezier(.16,1,.3,1), opacity 0.25s, max-height 0.35s cubic-bezier(.16,1,.3,1), padding 0.35s;
}
.grid-sheet.on { max-height: 220px; opacity: 1; transform: none; padding: 12px; }
.grid-sheet-close { position: absolute; right: 10px; top: 8px; background: none; border: 0; color: rgb(148,163,184); font-size: 16px; cursor: pointer; line-height: 1; }
.grid-sheet-q { display: flex; gap: 8px; align-items: center; font-weight: 800; text-transform: uppercase; font-size: 14px; color: #eef1ff; margin-bottom: 8px; padding-right: 20px; }

.grid-toast {
  position: sticky;
  bottom: 8px;
  z-index: 5;
  margin: 0 auto;
  width: fit-content;
  font-weight: 700;
  font-size: 13px;
  padding: 6px 14px;
  border-radius: 999px;
  background: #7f1d1d;
  color: #fff;
  box-shadow: 0 8px 20px rgba(0,0,0,.5);
  text-align: center;
}

.fade-enter-active, .fade-leave-active { transition: opacity 150ms ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
