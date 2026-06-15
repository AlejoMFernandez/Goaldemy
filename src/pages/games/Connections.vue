<script>
import AppH1 from '../../components/common/AppH1.vue'
import GamePreviewModal from '../../components/game/GamePreviewModal.vue'
import GameSummaryPopup from '../../components/game/GameSummaryPopup.vue'
import { getAllPlayersAsync } from '../../services/players'
import { getGameMetadata, gameSummaryBlurb } from '../../services/games'
import { isChallengeAvailable, startChallengeSession, completeChallengeSession, fetchLifetimeMaxStreak } from '../../services/game-modes'
import { captureLevelSnapshot } from '../../services/xp'
import { awardXpBatch } from '../../services/game-xp'
import { createDailyRng } from '../../services/seeded-random'
import { celebrateCorrect, celebrateGameWin, announceGameLoss, celebrateGameLevelUp } from '../../services/game-celebrations'
import { playCorrectSound, playIncorrectSound } from '../../services/sounds'

const GROUP_COLORS = [
  { bg: 'bg-yellow-500/90', text: 'text-yellow-950', border: 'border-yellow-400' },
  { bg: 'bg-emerald-500/90', text: 'text-emerald-950', border: 'border-emerald-400' },
  { bg: 'bg-sky-500/90', text: 'text-sky-950', border: 'border-sky-400' },
  { bg: 'bg-violet-500/90', text: 'text-violet-950', border: 'border-violet-400' },
]

const LEAGUE_NAMES = {
  47: 'Premier League', 87: 'La Liga', 55: 'Serie A',
  54: 'Bundesliga', 53: 'Ligue 1', 77: 'World Cup',
}

const GROUP_GENERATORS = [
  { type: 'league', generate(players, rng) {
    const map = {}
    players.forEach(p => {
      const lid = p.leagueId
      if (lid && LEAGUE_NAMES[lid]) (map[lid] = map[lid] || []).push(p)
    })
    const valid = Object.entries(map).filter(([, a]) => a.length >= 4)
    if (!valid.length) return null
    const [lid, arr] = valid[Math.floor(rng() * valid.length)]
    return { label: `Juegan en la ${LEAGUE_NAMES[lid]}`, players: [...arr].sort(() => rng() - 0.5).slice(0, 4) }
  }},
  { type: 'country', generate(players, rng) {
    const map = {}
    players.forEach(p => { if (p.cname) (map[p.cname] = map[p.cname] || []).push(p) })
    const valid = Object.entries(map).filter(([, a]) => a.length >= 4)
    if (!valid.length) return null
    const [country, arr] = valid[Math.floor(rng() * valid.length)]
    return { label: `Selección de ${country}`, players: [...arr].sort(() => rng() - 0.5).slice(0, 4) }
  }},
  { type: 'team', generate(players, rng) {
    const map = {}
    players.forEach(p => { if (p.teamName) (map[p.teamName] = map[p.teamName] || []).push(p) })
    const valid = Object.entries(map).filter(([, a]) => a.length >= 4)
    if (!valid.length) return null
    const [team, arr] = valid[Math.floor(rng() * valid.length)]
    return { label: `Juegan en ${team}`, players: [...arr].sort(() => rng() - 0.5).slice(0, 4) }
  }},
  { type: 'position', generate(players, rng) {
    const posLabels = { 0: 'Arqueros', 1: 'Defensores', 2: 'Mediocampistas', 3: 'Delanteros' }
    const byPos = { 0: [], 1: [], 2: [], 3: [] }
    players.forEach(p => { if (p.positionId != null) byPos[p.positionId].push(p) })
    const valid = Object.entries(byPos).filter(([, a]) => a.length >= 4)
    if (!valid.length) return null
    const [posId, arr] = valid[Math.floor(rng() * valid.length)]
    return { label: posLabels[posId], players: [...arr].sort(() => rng() - 0.5).slice(0, 4) }
  }},
  { type: 'shirtSingleDigit', generate(players, rng) {
    const single = players.filter(p => p.shirtNumber && p.shirtNumber >= 1 && p.shirtNumber <= 9)
    if (single.length < 4) return null
    return { label: 'Dorsal de un solo dígito', players: [...single].sort(() => rng() - 0.5).slice(0, 4) }
  }},
  { type: 'shirtHighNumber', generate(players, rng) {
    const high = players.filter(p => p.shirtNumber && p.shirtNumber >= 20)
    if (high.length < 4) return null
    return { label: 'Dorsal 20+', players: [...high].sort(() => rng() - 0.5).slice(0, 4) }
  }},
  { type: 'goalScorers', generate(players, rng) {
    const scorers = players.filter(p => p.stats?.goals != null && p.stats.goals >= 10)
    if (scorers.length < 4) return null
    return { label: 'Goleadores (10+ goles)', players: [...scorers].sort(() => rng() - 0.5).slice(0, 4) }
  }},
  { type: 'assistProviders', generate(players, rng) {
    const assisters = players.filter(p => p.stats?.assists != null && p.stats.assists >= 5)
    if (assisters.length < 4) return null
    return { label: 'Asistidores (5+ asistencias)', players: [...assisters].sort(() => rng() - 0.5).slice(0, 4) }
  }},
]

function generateGroups(allPlayers, rng) {
  const groups = []
  const usedIds = new Set()
  const usedTypes = new Set()
  const shuffledGens = [...GROUP_GENERATORS].sort(() => rng() - 0.5)
  for (const gen of shuffledGens) {
    if (groups.length >= 4) break
    if (usedTypes.has(gen.type)) continue
    const available = allPlayers.filter(p => !usedIds.has(p.id))
    const result = gen.generate(available, rng)
    if (!result) continue
    const ids = result.players.map(p => p.id)
    if (ids.some(id => usedIds.has(id))) continue
    ids.forEach(id => usedIds.add(id))
    usedTypes.add(gen.type)
    groups.push(result)
  }
  return groups.length === 4 ? groups : null
}

export default {
  name: 'Connections',
  components: { AppH1, GamePreviewModal, GameSummaryPopup },
  computed: {
    gameMetadata() { return getGameMetadata('connections') },
    selectedCount() { return this.selected.size },
    canVerify() { return this.selected.size === 4 && !this.gameOver },
    mistakesRemaining() { return this.maxMistakes - this.mistakes },
  },
  data() {
    return {
      loading: true,
      allPlayers: [],
      groups: [],
      remainingPlayers: [],
      solvedGroups: [],
      selected: new Set(),
      mistakes: 0,
      maxMistakes: 3,
      gameOver: false,
      won: false,
      shaking: false,
      almostGroup: null,
      almostTimer: null,
      // mode / challenge
      mode: 'normal',
      reviewMode: false,
      overlayOpen: false,
      availability: { available: true, reason: null },
      sessionId: null,
      // XP
      allowXp: true,
      xpEarned: 0,
      score: 0,
      corrects: 0,
      // summary / levels
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
        const last = await mod.fetchTodayLastSession('connections')
        if (last) {
          const m = last.metadata || {}
          this.score = Number(last.score_final || 0)
          this.corrects = Number(m.corrects || 0)
          const v = m.xpView || {}
          if (v.levelAfter != null) {
            this.levelBefore = v.levelBefore ?? null
            this.xpBeforeTotal = v.xpBeforeTotal ?? 0
            this.levelAfter = v.levelAfter ?? null
            this.xpAfterTotal = v.xpAfterTotal ?? 0
            this.beforePercent = v.beforePercent ?? 0
            this.afterPercent = v.afterPercent ?? 0
            this.xpToNextAfter = v.xpToNextAfter ?? null
            this.progressShown = this.afterPercent
          }
          try { this.lifetimeMaxStreak = Math.max(await mod.fetchLifetimeMaxStreak('connections') || 0, 0) } catch {}
          this.gameOver = true
          this.showSummary = true
        }
      }).catch(() => {})
    } else if (this.mode === 'challenge') {
      this.overlayOpen = true
      this.checkAvailability()
    }
  },
  methods: {
    blurb() { return gameSummaryBlurb('connections') },
    backPath() { return this.mode === 'free' ? '/play/free' : '/play/points' },
    async load() {
      this.allPlayers = await getAllPlayersAsync()
      this.loading = false
      if (this.mode !== 'challenge') this.setupBoard(Math.random)
    },
    setupBoard(rng) {
      let attempts = 0
      let result = null
      while (!result && attempts < 10) {
        result = generateGroups(this.allPlayers, rng)
        attempts++
      }
      if (!result) { this.gameOver = true; return }
      this.groups = result
      this.solvedGroups = []
      this.selected = new Set()
      this.mistakes = 0
      this.gameOver = false
      this.won = false
      this.xpEarned = 0
      this.score = 0
      this.corrects = 0
      const all = result.flatMap(g => g.players)
      this.remainingPlayers = [...all].sort(() => rng() - 0.5)
    },
    toggleSelect(player) {
      if (this.gameOver) return
      const next = new Set(this.selected)
      if (next.has(player.id)) next.delete(player.id)
      else if (next.size < 4) next.add(player.id)
      this.selected = next
    },
    isSelected(player) { return this.selected.has(player.id) },
    clearSelection() { this.selected = new Set() },
    verify() {
      if (this.selected.size !== 4 || this.gameOver) return
      const selIds = [...this.selected]
      const match = this.groups.find(g => {
        const gIds = new Set(g.players.map(p => p.id))
        return selIds.every(id => gIds.has(id)) && gIds.size === 4
      })
      if (match) {
        playCorrectSound()
        celebrateCorrect()
        const color = GROUP_COLORS[this.solvedGroups.length] || GROUP_COLORS[0]
        this.solvedGroups.push({ ...match, color })
        this.remainingPlayers = this.remainingPlayers.filter(p => !this.selected.has(p.id))
        this.selected = new Set()
        this.corrects++
        if (this.allowXp) this.xpEarned += (this.difficultyConfig?.xpPerGroup || 50)
        this.score += 50
        if (this.solvedGroups.length === 4) {
          this.won = true
          this.gameOver = true
          if (this.allowXp) this.xpEarned += (this.difficultyConfig?.xpCompletion || 150)
          setTimeout(() => celebrateGameWin(), 200)
          if (this.mode === 'challenge') this.finishChallenge('win')
        }
      } else {
        playIncorrectSound()
        this.mistakes++
        this.shaking = true
        setTimeout(() => { this.shaking = false }, 500)
        // Check for "almost" — 3 of 4 correct in any group
        if (this.almostTimer) clearTimeout(this.almostTimer)
        this.almostGroup = null
        const selSet = new Set(selIds)
        for (const g of this.groups) {
          const gIds = g.players.map(p => p.id)
          const overlap = gIds.filter(id => selSet.has(id)).length
          if (overlap === 3) { this.almostGroup = g.label; break }
        }
        if (this.almostGroup) {
          this.almostTimer = setTimeout(() => { this.almostGroup = null; this.almostTimer = null }, 2000)
        }
        if (this.mistakes >= this.maxMistakes) {
          this.gameOver = true
          this.won = false
          this.revealRemaining()
          setTimeout(() => announceGameLoss(), 200)
          if (this.mode === 'challenge') this.finishChallenge('loss')
        } else {
          this.selected = new Set()
        }
      }
    },
    revealRemaining() {
      const solved = new Set(this.solvedGroups.flatMap(g => g.players.map(p => p.id)))
      for (const g of this.groups) {
        if (g.players.every(p => solved.has(p.id))) continue
        const color = GROUP_COLORS[this.solvedGroups.length] || GROUP_COLORS[0]
        this.solvedGroups.push({ ...g, color })
      }
      this.remainingPlayers = []
    },
    async checkAvailability() { this.availability = await isChallengeAvailable('connections') },
    async startChallenge({ difficulty, config }) {
      if (!this.availability.available) return
      this.selectedDifficulty = difficulty
      this.difficultyConfig = config
      this.maxMistakes = config.mistakes
      try {
        try {
          const snap = await captureLevelSnapshot()
          this.levelBefore = snap.level
          this.xpBeforeTotal = snap.xpTotal
          this.beforePercent = snap.percent
        } catch {}
        const rng = createDailyRng('connections')
        this.sessionId = await startChallengeSession('connections', null)
        this.overlayOpen = false
        this.setupBoard(rng)
      } catch (e) { console.error('[Connections start]', e) }
    },
    async finishChallenge(result) {
      if (this.allowXp && this.xpEarned > 0) {
        await awardXpBatch({ gameCode: 'connections', totalXp: this.xpEarned, corrects: this.corrects }).catch(() => {})
      }
      try {
        await completeChallengeSession(this.sessionId, this.score, this.xpEarned, { result, corrects: this.corrects })
        const snap = await captureLevelSnapshot()
        this.levelAfter = snap.level
        this.xpAfterTotal = snap.xpTotal
        this.afterPercent = snap.percent
        this.xpToNextAfter = snap.xpToNext
        if ((this.levelAfter || 0) > (this.levelBefore || 0)) celebrateGameLevelUp(this.levelAfter, 500)
        await completeChallengeSession(this.sessionId, this.score, this.xpEarned, {
          xpView: { levelBefore: this.levelBefore, xpBeforeTotal: this.xpBeforeTotal, levelAfter: this.levelAfter, xpAfterTotal: this.xpAfterTotal, beforePercent: this.beforePercent, afterPercent: this.afterPercent, xpToNextAfter: this.xpToNextAfter, xpEarned: this.xpEarned }
        })
        this.lifetimeMaxStreak = Math.max(await fetchLifetimeMaxStreak('connections') || 0, 0)
        this.progressShown = this.beforePercent
        this.showSummary = true
        requestAnimationFrame(() => setTimeout(() => { this.progressShown = this.afterPercent }, 40))
        import('../../services/game-modes').then(mod => mod.checkAndUnlockDailyWins('connections')).catch(() => {})
      } catch (e) { console.error('[Connections finish]', e) }
    },
  }
}
</script>

<template>
  <section class="grid place-items-center min-h-[calc(100dvh-4rem)]">
    <GamePreviewModal
      :open="overlayOpen && mode === 'challenge' && !reviewMode"
      gameName="Conexiones"
      gameDescription="Agrupá 16 jugadores en 4 grupos por rasgo compartido"
      gameType="puzzle"
      :mechanic="gameMetadata.mechanic"
      :videoUrl="gameMetadata.videoUrl"
      :tips="gameMetadata.tips"
      @close="overlayOpen = false"
      @start="startChallenge"
    />
    <div class="space-y-3 w-full max-w-lg sm:max-w-xl">
      <div class="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-3 w-full">
        <AppH1 class="text-3xl md:text-4xl flex-none">Conexiones</AppH1>
        <div class="flex items-center gap-2 self-stretch sm:self-auto flex-none">
          <router-link :to="backPath()" class="rounded-full border border-white/15 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/5 transition">&larr; Volver</router-link>
        </div>
      </div>

      <div v-if="loading" class="text-center text-slate-300 py-12">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400"></div>
        <p class="mt-3">Cargando jugadores...</p>
      </div>

      <div v-else class="space-y-3">
        <!-- Solved groups -->
        <TransitionGroup name="solved" tag="div" class="space-y-2">
          <div v-for="(sg, i) in solvedGroups" :key="'sg-' + i"
               :class="[sg.color.bg, sg.color.border, 'rounded-xl border px-4 py-3 solved-row']">
            <div :class="[sg.color.text, 'text-sm font-bold uppercase tracking-wide mb-1']">{{ sg.label }}</div>
            <div class="flex items-center gap-3">
              <div v-for="p in sg.players" :key="p.id" class="flex items-center gap-1.5">
                <img :src="p.image" :alt="p.name"
                     class="w-8 h-8 rounded-full object-cover ring-1 ring-black/20 bg-slate-700 flex-shrink-0"
                     @error="e => e.target.style.display = 'none'" />
                <span :class="[sg.color.text, 'text-xs font-medium hidden sm:inline truncate max-w-[80px]']">{{ p.name }}</span>
              </div>
            </div>
          </div>
        </TransitionGroup>

        <!-- 4x4 grid -->
        <div v-if="remainingPlayers.length" class="grid grid-cols-4 gap-1.5">
          <button v-for="p in remainingPlayers" :key="p.id"
                  :class="[
                    'group relative aspect-square rounded-xl overflow-hidden border-2 transition-all duration-150',
                    isSelected(p)
                      ? 'border-emerald-400 ring-2 ring-emerald-400/50 scale-[1.04] z-10'
                      : 'border-white/10 hover:border-white/25',
                    shaking && isSelected(p) ? 'shake' : '',
                    gameOver ? 'pointer-events-none opacity-60' : 'cursor-pointer active:scale-95'
                  ]"
                  @click="toggleSelect(p)">
            <img :src="p.image" :alt="p.name"
                 class="w-full h-full object-cover bg-slate-700"
                 @error="e => e.target.src = ''" />
            <div class="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none"></div>
            <div class="absolute inset-x-0 bottom-0 bg-black/60 backdrop-blur-sm px-2 py-1.5
                        opacity-0 group-hover:opacity-100 sm:opacity-0 max-sm:opacity-100 transition-opacity">
              <span class="text-white text-xs font-medium truncate block">{{ p.name }}</span>
            </div>
            <div v-if="isSelected(p)"
                 class="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-emerald-400 flex items-center justify-center">
              <svg class="w-3 h-3 text-emerald-950" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </button>
        </div>

        <!-- Almost feedback toast -->
        <Transition name="almost-toast">
          <div v-if="almostGroup"
               class="text-center rounded-lg bg-amber-500/20 border border-amber-400/30 px-4 py-2">
            <span class="text-amber-300 text-sm font-medium">¡Casi! 3 de 4 pertenecen a: {{ almostGroup }}</span>
          </div>
        </Transition>

        <!-- Controls -->
        <div v-if="!gameOver" class="flex flex-col items-center gap-3">
          <div class="text-sm text-slate-400">{{ selectedCount }}/4 seleccionados</div>
          <div class="flex items-center gap-2">
            <button @click="clearSelection" :disabled="!selectedCount"
                    class="rounded-full border border-white/15 px-4 py-2 text-sm text-slate-200 hover:bg-white/5 transition disabled:opacity-40">
              Deseleccionar
            </button>
            <button @click="verify" :disabled="!canVerify"
                    class="rounded-full bg-[oklch(0.62_0.21_270)] hover:brightness-110 border border-white/10 text-white px-5 py-2 text-sm font-semibold transition disabled:opacity-40">
              Verificar
            </button>
          </div>
          <!-- Mistakes dots -->
          <div class="flex items-center gap-2">
            <span class="text-xs text-slate-400 mr-1">Errores:</span>
            <span v-for="i in maxMistakes" :key="'m-' + i"
                  :class="['h-3 w-3 rounded-full inline-block transition-colors duration-300',
                            i <= mistakes ? 'bg-red-400' : 'bg-white/20']"></span>
          </div>
        </div>

        <!-- Game over message -->
        <div v-if="gameOver && !showSummary" class="text-center py-4">
          <div v-if="won" class="text-emerald-300 text-lg font-bold">Encontraste los 4 grupos</div>
          <div v-else class="text-red-300 text-lg font-bold">Se acabaron los intentos</div>
          <div class="text-slate-400 text-sm mt-1">{{ corrects }}/4 grupos encontrados &middot; Puntaje: {{ score }}</div>
          <button v-if="mode !== 'challenge'" @click="setupBoard(Math.random)"
                  class="mt-3 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 px-5 py-2 text-sm text-slate-200 transition">
            Jugar de nuevo
          </button>
        </div>

        <!-- Summary Popup -->
        <GameSummaryPopup
          :show="showSummary"
          :corrects="corrects"
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
          :winThreshold="4"
          :backPath="backPath()"
          @close="showSummary = false"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.shake {
  animation: shake 400ms ease-in-out;
}
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-6px); }
  40% { transform: translateX(6px); }
  60% { transform: translateX(-4px); }
  80% { transform: translateX(4px); }
}

.solved-enter-active {
  transition: all 350ms ease;
}
.solved-enter-from {
  opacity: 0;
  transform: translateY(12px) scale(0.96);
}
.solved-leave-active {
  transition: all 200ms ease;
}
.solved-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

.solved-row {
  animation: solvedPop 350ms ease;
}
@keyframes solvedPop {
  0% { opacity: 0; transform: translateY(12px) scale(0.96); }
  60% { transform: translateY(-2px) scale(1.01); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}

.almost-toast-enter-active { transition: all 250ms ease-out; }
.almost-toast-leave-active { transition: all 200ms ease-in; }
.almost-toast-enter-from { opacity: 0; transform: translateY(8px); }
.almost-toast-leave-to { opacity: 0; transform: translateY(-4px); }
</style>
