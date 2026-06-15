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

const GROUP_GENERATORS = [
  { type: 'country', generate(players, rng) {
    const map = {}
    players.forEach(p => { if (p.cname) (map[p.cname] = map[p.cname] || []).push(p) })
    const valid = Object.entries(map).filter(([, a]) => a.length >= 4)
    if (!valid.length) return null
    const [country, arr] = valid[Math.floor(rng() * valid.length)]
    return { label: `Jugadores de ${country}`, players: [...arr].sort(() => rng() - 0.5).slice(0, 4) }
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
  { type: 'age', generate(players, rng) {
    const young = players.filter(p => p.age && p.age <= 23)
    const veteran = players.filter(p => p.age && p.age >= 30)
    if (rng() > 0.5 && young.length >= 4) return { label: 'Menores de 24 años', players: [...young].sort(() => rng() - 0.5).slice(0, 4) }
    if (veteran.length >= 4) return { label: 'Mayores de 29 años', players: [...veteran].sort(() => rng() - 0.5).slice(0, 4) }
    if (young.length >= 4) return { label: 'Menores de 24 años', players: [...young].sort(() => rng() - 0.5).slice(0, 4) }
    return null
  }},
  { type: 'shirt', generate(players, rng) {
    const single = players.filter(p => p.shirtNumber && p.shirtNumber <= 9)
    const double = players.filter(p => p.shirtNumber && p.shirtNumber >= 20)
    if (rng() > 0.5 && single.length >= 4) return { label: 'Dorsal del 1 al 9', players: [...single].sort(() => rng() - 0.5).slice(0, 4) }
    if (double.length >= 4) return { label: 'Dorsal 20 o mayor', players: [...double].sort(() => rng() - 0.5).slice(0, 4) }
    return null
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
  <section class="grid place-items-center min-h-[600px]">
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
    <div class="space-y-4 w-full max-w-2xl">
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
            <div class="flex flex-wrap gap-2">
              <span v-for="p in sg.players" :key="p.id" :class="[sg.color.text, 'text-sm font-medium']">{{ p.name }}</span>
            </div>
          </div>
        </TransitionGroup>

        <!-- 4x4 grid -->
        <div v-if="remainingPlayers.length" class="grid grid-cols-4 gap-2">
          <button v-for="p in remainingPlayers" :key="p.id"
                  :class="[
                    'relative flex flex-col items-center gap-1 rounded-lg border p-2 transition-all duration-150',
                    isSelected(p)
                      ? 'border-white/50 bg-white/15 ring-2 ring-white/30 scale-[1.03]'
                      : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20',
                    shaking && isSelected(p) ? 'shake' : '',
                    gameOver ? 'pointer-events-none opacity-60' : 'cursor-pointer active:scale-95'
                  ]"
                  @click="toggleSelect(p)">
            <img :src="p.image" :alt="p.name"
                 class="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover bg-slate-700"
                 @error="e => e.target.style.display = 'none'" />
            <span class="text-[11px] sm:text-xs text-slate-200 text-center leading-tight line-clamp-2 w-full">{{ p.name }}</span>
          </button>
        </div>

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

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
