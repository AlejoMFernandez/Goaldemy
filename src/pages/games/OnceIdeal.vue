<script>
import GameShell from '../../components/game/GameShell.vue'
import GamePreviewModal from '../../components/game/GamePreviewModal.vue'
import GameSummaryPopup from '../../components/game/GameSummaryPopup.vue'
import ScoreBug from '../../components/game/ScoreBug.vue'
import KickoffOverlay from '../../components/game/KickoffOverlay.vue'
import PlayerSearch from '../../components/game/PlayerSearch.vue'
import { getAllPlayers } from '../../services/players'
import { countryNameEs } from '../../services/countries'
import { awardXpBatch } from '../../services/game-xp'
import { captureLevelSnapshot } from '../../services/xp'
import { isChallengeAvailable, startChallengeSession, completeChallengeSession } from '../../services/game-modes'
import { celebrateGameWin, announceGameLoss, celebrateGameLevelUp } from '../../services/game-celebrations'
import { getGameMetadata } from '../../services/games'
import * as fx from '../../services/game-fx'

const TOTAL_TIME = 180

// Formación 4-3-3 con posiciones % en la cancha y su posición amplia
// (0 POR / 1 DEF / 2 MED / 3 DEL, mismo esquema que positionId de los jugadores).
const FORMATION = [
  { id: 0, label: 'POR', full: 'Arquero', x: 50, y: 87, broad: 0 },
  { id: 1, label: 'LD', full: 'Lateral derecho', x: 13, y: 69, broad: 1 },
  { id: 2, label: 'DFC', full: 'Defensor central', x: 37, y: 72, broad: 1 },
  { id: 3, label: 'DFC', full: 'Defensor central', x: 63, y: 72, broad: 1 },
  { id: 4, label: 'LI', full: 'Lateral izquierdo', x: 87, y: 69, broad: 1 },
  { id: 5, label: 'MC', full: 'Mediocampista', x: 18, y: 52, broad: 2 },
  { id: 6, label: 'MC', full: 'Mediocampista', x: 50, y: 50, broad: 2 },
  { id: 7, label: 'MC', full: 'Mediocampista', x: 82, y: 52, broad: 2 },
  { id: 8, label: 'EI', full: 'Extremo izquierdo', x: 24, y: 28, broad: 3 },
  { id: 9, label: 'DC', full: 'Delantero centro', x: 50, y: 22, broad: 3 },
  { id: 10, label: 'ED', full: 'Extremo derecho', x: 76, y: 28, broad: 3 },
]
// Líneas del dibujo de la formación: se iluminan cuando AMBOS extremos están llenos.
const LINKS = [[0, 2], [0, 3], [2, 3], [2, 1], [3, 4], [1, 5], [4, 7], [5, 6], [6, 7], [5, 8], [7, 10], [6, 9], [8, 9], [9, 10]]
const BROAD_LABEL = { 0: 'arquero', 1: 'defensor', 2: 'mediocampista', 3: 'delantero' }

const LEAGUE_INFO = {
  47: { name: 'Premier League', logo: 'https://images.fotmob.com/image_resources/logo/leaguelogo/47.png' },
  87: { name: 'La Liga', logo: 'https://images.fotmob.com/image_resources/logo/leaguelogo/87.png' },
  55: { name: 'Serie A', logo: 'https://images.fotmob.com/image_resources/logo/leaguelogo/55.png' },
  54: { name: 'Bundesliga', logo: 'https://images.fotmob.com/image_resources/logo/leaguelogo/54.png' },
  53: { name: 'Ligue 1', logo: 'https://images.fotmob.com/image_resources/logo/leaguelogo/53.png' },
}

function surname(name) {
  const w = (name || '').trim().split(' ')
  if (w.length < 2) return name || ''
  return w.slice(1).join(' ')
}

export default {
  name: 'OnceIdeal',
  components: { GameShell, GamePreviewModal, GameSummaryPopup, ScoreBug, KickoffOverlay, PlayerSearch },
  data() {
    return {
      loading: true,
      allPlayers: [],
      slots: FORMATION.map(f => ({ ...f, filled: null })),
      constraint: null,
      pendingPlayer: null,
      toastMsg: '',
      dropId: null,
      slotRefs: {},
      // reloj
      kickoff: false,
      clockRunning: false,
      timeLeft: TOTAL_TIME,
      timer: null,
      // estado de partida
      gameOver: false,
      won: false,
      // modos & sesión
      mode: 'free',
      reviewMode: false,
      overlayOpen: false,
      sessionId: null,
      availability: { available: true, reason: null },
      allowXp: true,
      selectedDifficulty: 'normal',
      difficultyConfig: null,
      // XP & resumen
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
    }
  },
  computed: {
    gameMetadata() { return getGameMetadata('once-ideal') },
    filledCount() { return this.slots.filter(s => s.filled).length },
    usedIds() { return this.slots.filter(s => s.filled).map(s => s.filled.id) },
    // Puestos vacíos cuya posición amplia matchea al jugador pendiente.
    candidateIds() {
      if (!this.pendingPlayer) return []
      return this.slots.filter(s => !s.filled && s.broad === this.pendingPlayer.positionId).map(s => s.id)
    },
    linkLines() {
      return LINKS.map(([a, b]) => ({
        x1: this.slots[a].x, y1: this.slots[a].y,
        x2: this.slots[b].x, y2: this.slots[b].y,
        on: !!(this.slots[a].filled && this.slots[b].filled),
      }))
    },
  },
  watch: {
    filledCount(n) {
      if (n === 11 && !this.gameOver) this.finishGame('win')
    },
  },
  async mounted() {
    const m = (this.$route.query.mode || '').toString().toLowerCase()
    if (m === 'challenge') this.mode = 'challenge'
    else if (m === 'review') { this.mode = 'challenge'; this.reviewMode = true }
    else this.mode = 'free'
    if (this.mode === 'free') this.allowXp = false

    this.allPlayers = getAllPlayers()
    this.loading = false

    if (this.reviewMode) {
      import('../../services/game-modes').then(async (mod) => {
        const last = await mod.fetchTodayLastSession('once-ideal')
        if (last) {
          const mm = last.metadata || {}
          this.xpEarned = Number(mm.xpEarned || 0)
          this.won = !!mm.won
          this.score = Number(last.score_final || 0)
          this.showSummary = true
        }
      }).catch(() => {})
    } else if (this.mode === 'challenge') {
      this.overlayOpen = true
      this.checkAvailability()
    } else {
      this.generateConstraint()
      this.beginClock()
    }
  },
  beforeUnmount() {
    clearInterval(this.timer)
  },
  methods: {
    surname,
    countryNameEs,
    setSlotRef(id, el) { if (el) this.slotRefs[id] = el },
    backPath() { return this.mode === 'free' ? '/play/free' : '/play/points' },
    showToast(msg) {
      this.toastMsg = msg
      clearTimeout(this._toastT)
      this._toastT = setTimeout(() => { this.toastMsg = '' }, 1900)
    },

    generateConstraint() {
      const players = this.allPlayers
      if (!players.length) return
      const roll = Math.random()

      if (roll < 0.4) {
        const byTeam = {}
        players.forEach(p => {
          if (!byTeam[p.teamId]) byTeam[p.teamId] = { id: p.teamId, name: p.teamName, logo: p.teamLogo, count: 0 }
          byTeam[p.teamId].count++
        })
        const eligible = Object.values(byTeam).filter(t => t.count >= 11)
        if (eligible.length) {
          const t = eligible[Math.floor(Math.random() * eligible.length)]
          this.constraint = { type: 'team', id: t.id, label: t.name, logo: t.logo }
          return
        }
      }

      if (roll < 0.7) {
        const byNat = {}
        players.forEach(p => {
          const code = (p.ccode || '').toLowerCase()
          if (!code) return
          if (!byNat[code]) byNat[code] = { code, name: p.cname, count: 0 }
          byNat[code].count++
        })
        const eligible = Object.values(byNat).filter(n => n.count >= 11)
        if (eligible.length) {
          const n = eligible[Math.floor(Math.random() * eligible.length)]
          this.constraint = { type: 'nationality', code: n.code, label: countryNameEs(n.name), flag: `https://flagcdn.com/w80/${n.code}.png` }
          return
        }
      }

      const byLeague = {}
      players.forEach(p => {
        const lid = p.leagueId
        if (!lid || !LEAGUE_INFO[lid]) return
        if (!byLeague[lid]) byLeague[lid] = { id: lid, ...LEAGUE_INFO[lid], count: 0 }
        byLeague[lid].count++
      })
      const eligibleLeague = Object.values(byLeague).filter(l => l.count >= 11)
      if (eligibleLeague.length) {
        const l = eligibleLeague[Math.floor(Math.random() * eligibleLeague.length)]
        this.constraint = { type: 'league', id: l.id, label: l.name, logo: l.logo }
        return
      }

      const byNat2 = {}
      players.forEach(p => {
        const code = (p.ccode || '').toLowerCase()
        if (!code) return
        if (!byNat2[code]) byNat2[code] = { code, name: p.cname, count: 0 }
        byNat2[code].count++
      })
      const natEligible = Object.values(byNat2).filter(n => n.count >= 11)
      if (natEligible.length) {
        const n = natEligible[Math.floor(Math.random() * natEligible.length)]
        this.constraint = { type: 'nationality', code: n.code, label: countryNameEs(n.name), flag: `https://flagcdn.com/w80/${n.code}.png` }
      }
    },

    satisfiesConstraint(player) {
      const c = this.constraint
      if (!c) return false
      if (c.type === 'team') return player.teamId === c.id
      if (c.type === 'league') return player.leagueId === c.id
      return (player.ccode || '').toLowerCase() === c.code.toLowerCase()
    },

    // ── Flujo: escribir jugador → validar constraint → elegir puesto ──
    chooseTyped(player) {
      if (this.gameOver || !player) return
      if (this.usedIds.includes(player.id)) {
        this.showToast('Ya lo usaste')
        this.$refs.search?.shake()
        return
      }
      if (!this.satisfiesConstraint(player)) {
        this.showToast(`${surname(player.name)} no juega en ${this.constraint?.label}`)
        this.$refs.search?.shake()
        return
      }
      const cands = this.slots.filter(s => !s.filled && s.broad === player.positionId)
      if (!cands.length) {
        this.showToast(`No te quedan lugares de ${BROAD_LABEL[player.positionId] || 'esa posición'}`)
        this.$refs.search?.shake()
        return
      }
      this.pendingPlayer = player
    },
    cancelPending() { this.pendingPlayer = null },

    place(slotId) {
      if (!this.pendingPlayer || this.gameOver) return
      const slot = this.slots.find(s => s.id === slotId)
      if (!slot || slot.filled || slot.broad !== this.pendingPlayer.positionId) return

      slot.filled = this.pendingPlayer
      this.pendingPlayer = null
      this.dropId = slotId
      setTimeout(() => { if (this.dropId === slotId) this.dropId = null }, 520)

      this.$nextTick(() => {
        const el = this.slotRefs[slotId]
        const bug = this.$refs.bug
        if (el) {
          const c = fx.center(el)
          fx.sparks(c.x, c.y, 12, ['#fcd34d', '#fff'], 46)
          const idx = this.filledCount - 1
          if (bug && idx >= 0) {
            fx.flyTo({ from: el, to: bug.ballEl(idx), html: fx.BALL_SVG, className: 'gfx-ball', duration: 450 })
              .then(() => bug.popBall(idx))
          }
        }
      })
    },

    // ── Reloj / kickoff ──
    beginClock() {
      clearInterval(this.timer)
      this.timeLeft = TOTAL_TIME
      this.gameOver = false
      this.clockRunning = false
      this.kickoff = true
    },
    onKickoffDone() {
      this.kickoff = false
      this.clockRunning = true
      clearInterval(this.timer)
      this.timer = setInterval(() => {
        if (this.timeLeft > 0) this.timeLeft--
        if (this.timeLeft <= 0) {
          clearInterval(this.timer)
          this.clockRunning = false
          if (!this.gameOver) this.finishGame('loss')
        }
      }, 1000)
    },

    async checkAvailability() { this.availability = await isChallengeAvailable('once-ideal') },
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
      this.slots = FORMATION.map(f => ({ ...f, filled: null }))
      this.pendingPlayer = null
      this.xpEarned = 0
      this.score = 0
      this.generateConstraint()
      try {
        this.sessionId = await startChallengeSession('once-ideal', TOTAL_TIME, { difficulty: this.selectedDifficulty })
      } catch (e) { console.error('[OnceIdeal start]', e) }
      this.overlayOpen = false
      this.beginClock()
    },

    async finishGame(result) {
      if (this.gameOver) return
      this.gameOver = true
      this.won = result === 'win'
      clearInterval(this.timer)
      this.clockRunning = false

      if (this.won) {
        if (this.allowXp) this.xpEarned += this.difficultyConfig?.xpCompletion || 175
        this.score = this.filledCount * 10
        setTimeout(() => celebrateGameWin(), 100)
      } else {
        this.score = this.filledCount * 10
        setTimeout(() => announceGameLoss(), 100)
      }

      if (this.mode !== 'challenge') return

      if (this.allowXp && this.xpEarned > 0) {
        await awardXpBatch({ gameCode: 'once-ideal', totalXp: this.xpEarned, corrects: this.filledCount }).catch(() => {})
      }
      try {
        await completeChallengeSession(this.sessionId, this.score, this.xpEarned, {
          result, won: this.won, corrects: this.filledCount,
          // Segundos que sobraron (logro "Once de gala"): el reloj ya está frenado acá.
          secondsLeft: Math.max(0, this.timeLeft),
        })
        const snap = await captureLevelSnapshot()
        this.levelAfter = snap.level
        this.xpAfterTotal = snap.xpTotal
        this.afterPercent = snap.percent
        this.xpToNextAfter = snap.xpToNext
        if (snap.level && this.levelBefore && snap.level > this.levelBefore) {
          setTimeout(() => celebrateGameLevelUp(snap.level), 500)
        }
        await completeChallengeSession(this.sessionId, this.score, this.xpEarned, {
          result, won: this.won, corrects: this.filledCount,
          xpView: {
            levelBefore: this.levelBefore, xpBeforeTotal: this.xpBeforeTotal,
            levelAfter: this.levelAfter, xpAfterTotal: this.xpAfterTotal,
            beforePercent: this.beforePercent, afterPercent: this.afterPercent,
            xpToNextAfter: this.xpToNextAfter, xpEarned: this.xpEarned,
          }
        })
      } catch (e) { console.error('[OnceIdeal finish]', e) }

      setTimeout(() => {
        this.progressShown = this.beforePercent
        this.showSummary = true
        requestAnimationFrame(() => setTimeout(() => { this.progressShown = this.afterPercent }, 40))
      }, this.won ? 1400 : 600)

      import('../../services/game-modes').then(mod => mod.checkAndUnlockDailyWins('once-ideal')).catch(() => {})
    },
  }
}
</script>

<template>
  <GameShell title="Once Ideal" :backPath="backPath()">
    <GamePreviewModal
      :open="overlayOpen && mode === 'challenge' && !reviewMode"
      gameName="Once Ideal"
      gameType="squad"
      gameDescription="Armá tu once ideal con una restricción de equipo, liga o selección"
      :mechanic="gameMetadata.mechanic"
      :videoUrl="gameMetadata.videoUrl"
      :tips="gameMetadata.tips"
      @close="overlayOpen = false"
      @start="startChallenge"
    />

    <div v-if="loading" class="text-center text-slate-300 py-12">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-300"></div>
      <p class="mt-3">Cargando...</p>
    </div>

    <div v-else class="w-full max-w-sm mx-auto self-start mt-3 space-y-3">
      <ScoreBug ref="bug" :timed="true" :seconds="Math.max(0, timeLeft)" :running="clockRunning" :corrects="filledCount" :target="11" :xp="xpEarned" />

      <!-- Restricción -->
      <div v-if="constraint" class="rounded-xl border border-white/10 bg-slate-800/50 px-3.5 py-2.5 flex items-center gap-3">
        <img v-if="constraint.logo" :src="constraint.logo" class="w-9 h-9 object-contain flex-shrink-0" />
        <img v-else-if="constraint.flag" :src="constraint.flag" class="h-7 rounded shadow flex-shrink-0" />
        <div class="min-w-0">
          <p class="text-[9px] text-slate-400 uppercase tracking-widest font-semibold">
            {{ constraint.type === 'team' ? 'Equipo' : constraint.type === 'league' ? 'Liga' : 'Selección' }}
          </p>
          <p class="text-sm font-bold text-white truncate">{{ constraint.label }}</p>
        </div>
      </div>

      <!-- Cancha -->
      <div class="oi-pitch">
        <svg class="oi-links" viewBox="0 0 100 100" preserveAspectRatio="none">
          <line v-for="(l, i) in linkLines" :key="i" :x1="l.x1" :y1="l.y1" :x2="l.x2" :y2="l.y2" :class="{ on: l.on }" />
        </svg>

        <button
          v-for="slot in slots" :key="slot.id"
          type="button"
          class="oi-slot"
          :class="{
            filled: slot.filled,
            cand: pendingPlayer && slot.broad === pendingPlayer.positionId && !slot.filled,
            dim: pendingPlayer && !(slot.broad === pendingPlayer.positionId && !slot.filled),
            drop: dropId === slot.id,
          }"
          :style="{ left: slot.x + '%', top: slot.y + '%' }"
          :ref="el => setSlotRef(slot.id, el)"
          @click="slot.filled ? null : place(slot.id)"
        >
          <div v-if="slot.filled" class="oi-chip">
            <img :src="slot.filled.image" :alt="slot.filled.name" @error="e => e.target.style.visibility = 'hidden'" />
            <span>{{ surname(slot.filled.name) }}</span>
          </div>
          <span v-else class="oi-empty">{{ slot.label }}</span>
        </button>
      </div>

      <!-- Toast -->
      <Transition name="fade"><div v-if="toastMsg" class="oi-toast">{{ toastMsg }}</div></Transition>

      <!-- Buscador / picker de puesto -->
      <div v-if="!gameOver">
        <template v-if="pendingPlayer">
          <div class="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2.5">
            <p class="text-xs text-amber-200 mb-2">¿Dónde ponés a <b>{{ pendingPlayer.name }}</b>?</p>
            <div class="flex flex-wrap gap-1.5">
              <button v-for="id in candidateIds" :key="id" class="oi-pick-btn" @click="place(id)">{{ slots[id].full }}</button>
              <button class="oi-pick-cancel" @click="cancelPending">Cancelar</button>
            </div>
          </div>
        </template>
        <template v-else>
          <PlayerSearch ref="search" placeholder="Escribí un jugador…" @pick="chooseTyped" />
        </template>
      </div>

      <!-- Once completo -->
      <div v-if="gameOver && won" class="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-amber-600/10 p-5 text-center">
        <div class="text-4xl mb-2">🏆</div>
        <h2 class="text-xl font-bold text-amber-300 mb-1">¡Once completo!</h2>
        <p class="text-slate-300 text-sm">Armaste el once de <span class="font-bold text-white">{{ constraint?.label }}</span></p>
      </div>
      <div v-else-if="gameOver && !won" class="rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-center">
        <div class="text-3xl mb-2">⏱️</div>
        <h2 class="text-lg font-bold text-red-300 mb-1">¡Se acabó el tiempo!</h2>
        <p class="text-slate-300 text-sm">Llenaste {{ filledCount }}/11 puestos</p>
      </div>
    </div>

    <KickoffOverlay v-if="kickoff" @done="onKickoffDone" />

    <GameSummaryPopup
      :show="showSummary"
      :corrects="filledCount"
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
      :winThreshold="11"
      :backPath="backPath()"
      @close="showSummary = false"
    />
  </GameShell>
</template>

<style scoped>
.oi-pitch {
  position: relative;
  width: 100%;
  aspect-ratio: 3/4;
  border-radius: 1rem;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0,0,0,0.4);
  background: linear-gradient(180deg, #064e3b 0%, #065f46 40%, #064e3b 100%),
              repeating-linear-gradient(0deg, transparent, transparent 58px, rgba(255,255,255,0.03) 58px, rgba(255,255,255,0.03) 59px);
}
.oi-pitch::before {
  content: '';
  position: absolute; inset: 5%;
  border: 1px solid rgba(255,255,255,0.12);
  pointer-events: none;
}
.oi-links { position: absolute; inset: 0; width: 100%; height: 100%; }
.oi-links line { stroke: transparent; stroke-width: 0.6; transition: stroke 0.5s ease; }
.oi-links line.on { stroke: var(--play-400, #fcd34d); filter: drop-shadow(0 0 3px rgba(252,211,77,0.6)); }

.oi-slot {
  position: absolute;
  transform: translate(-50%, -50%);
  display: flex; align-items: center; justify-content: center;
  border: 0; background: none; cursor: pointer; padding: 0;
  transition: transform 0.15s ease;
}
.oi-empty {
  display: flex; align-items: center; justify-content: center;
  width: 40px; height: 30px; border-radius: 0.5rem;
  border: 1px dashed rgba(255,255,255,0.3);
  background: rgba(15,23,42,0.55);
  font-size: 10px; font-weight: 800; color: rgb(203,213,225);
}
.oi-slot.cand .oi-empty { border: 2px solid var(--play-400, #fcd34d); animation: oiPulse 0.9s ease-in-out infinite; }
.oi-slot.dim { opacity: 0.35; pointer-events: none; }
@keyframes oiPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(252,211,77,0.5); } 50% { box-shadow: 0 0 0 6px rgba(252,211,77,0); } }

.oi-chip { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.oi-chip img { width: 34px; height: 34px; border-radius: 50%; object-fit: cover; border: 2px solid rgba(252,211,77,0.7); box-shadow: 0 4px 10px rgba(0,0,0,0.5); }
.oi-chip span { font-size: 8px; font-weight: 800; color: #fff; background: rgba(2,6,23,0.85); padding: 1px 4px; border-radius: 4px; max-width: 60px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.oi-slot.drop .oi-chip { animation: oiDrop 0.5s cubic-bezier(.34,1.56,.64,1); }
@keyframes oiDrop { from { transform: translateY(-40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

.oi-toast {
  text-align: center; font-weight: 700; font-size: 12.5px;
  padding: 6px 14px; border-radius: 999px; background: #7f1d1d; color: #fff;
  box-shadow: 0 8px 20px rgba(0,0,0,.5); width: fit-content; margin: 0 auto;
}
.oi-pick-btn {
  border-radius: 999px; border: 1px solid rgba(252,211,77,0.5); background: rgba(252,211,77,0.12);
  color: #fde68a; font-size: 12px; font-weight: 700; padding: 5px 11px; cursor: pointer;
}
.oi-pick-cancel {
  border-radius: 999px; border: 1px solid rgba(255,255,255,0.15); background: none;
  color: rgb(148,163,184); font-size: 12px; padding: 5px 11px; cursor: pointer;
}
.fade-enter-active, .fade-leave-active { transition: opacity 150ms ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
