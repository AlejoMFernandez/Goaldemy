<script>
import GameShell from '../../components/game/GameShell.vue'
import { getAllPlayersAsync, sampleDistinct } from '../../services/players'
import { isChallengeAvailable, startChallengeSession, completeChallengeSession } from '../../services/game-modes'
import { initScoring } from '../../services/scoring'
import { getUserLevel, captureLevelSnapshot } from '../../services/xp'
import { awardXpBatch } from '../../services/game-xp'
import { createDailyRng } from '../../services/seeded-random'
import { celebrateGameWin, announceGameLoss, celebrateGameLevelUp } from '../../services/game-celebrations'
import { getGameMetadata } from '../../services/games'
import GamePreviewModal from '../../components/game/GamePreviewModal.vue'
import GameSummaryPopup from '../../components/game/GameSummaryPopup.vue'
import OrderLadder from '../../components/game/OrderLadder.vue'

export default {
  name: 'AgeOrder',
  components: { GameShell, GamePreviewModal, GameSummaryPopup, OrderLadder },
  computed: {
    gameMetadata() { return getGameMetadata('age-order') }
  },
  data() {
    return {
  mode: 'normal',
  reviewMode: false,
  locked: false,
      overlayOpen: false,
      availability: { available: true, reason: null },
      items: [],
      slots: [null, null, null, null, null],
      selectedIndex: null,
      // tablero OrderLadder (Moodboard 04)
      ladderResult: null,
      ladderInstant: false,
      revealDone: false,
      afterRevealQueue: [],
      ...initScoring(10),
      answered: false,
      showSummary: false,
      sessionId: null,
      xpEarned: 0,
      allowXp: true,
      desiredOrder: [],
      correctness: [],
  selectedFromSlot: null,
  hoveredSlot: null,
      // summary
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
    if (this.mode === 'free') this.allowXp = false
    this.setup().catch(() => {})
    if (this.reviewMode) {
      import('../../services/game-modes').then(async (mod) => {
        const last = await mod.fetchTodayLastSession('age-order')
          if (last?.metadata?.finalOrder && Array.isArray(last.metadata.finalOrder)) {
            this.locked = true
          const saved = last.metadata
          this.items = saved.items || this.items
          this.slots = saved.finalOrder
          this.correctness = saved.correctness || []
          this.ladderInstant = true
          this.revealDone = true
          this.ladderResult = { correctness: [...this.correctness], desiredOrder: this.desiredFor(this.items) }
          this.answered = true
          this.score = Number(last.score_final || 0)
          this.corrects = saved.corrects ?? this.correctness.filter(Boolean).length
          this.showSummary = true
            this.xpEarned = Number(last.xp_earned || 0)
            this.locked = true
        }
      }).catch(()=>{})
    } else if (this.mode === 'challenge') { this.overlayOpen = true; this.checkAvailability() }
  },
  methods: {
    async setup() {
      this.locked = false
      const all = (await getAllPlayersAsync()).filter(p => Number.isFinite(p?.age))
      const count = this.difficultyConfig?.itemCount || 5
      const picks = sampleDistinct(all, count, new Set(), this.rng)
      this.items = picks
      this.slots = this.shuffledOrder(picks)
      this.ladderResult = null; this.ladderInstant = false; this.revealDone = false; this.afterRevealQueue = []
      this.answered = false
      this.showSummary = false
      this.selectedIndex = null
      this.score = 0; this.attempts = 0; this.corrects = 0
    },
    blurb() { return gameSummaryBlurb('age-order') },
    shuffledOrder(list) {
      const n = list.length
      const o = Array.from({ length: n }, (_, i) => i)
      const sortedKey = [...o].sort((a, b) => this.metric(list[b]) - this.metric(list[a])).map(i => this.metric(list[i])).join()
      for (let tries = 0; tries < 8; tries++) {
        for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [o[i], o[j]] = [o[j], o[i]] }
        if (n < 2 || o.map(i => this.metric(list[i])).join() !== sortedKey) break
      }
      return o
    },
    desiredFor(list) { return list.map((_, i) => i).sort((a, b) => this.metric(list[b]) - this.metric(list[a])) },
    formatValue: v => Math.round(v) + (Math.round(v) === 1 ? ' año' : ' años'),
    // Lo que depende del final de la revelación espera a que el tablero termine
    afterReveal(fn, ms = 0) {
      const run = () => setTimeout(fn, ms)
      if (this.revealDone) run(); else this.afterRevealQueue.push(run)
    },
    onLadderDone() {
      this.revealDone = true
      const q = this.afterRevealQueue; this.afterRevealQueue = []
      q.forEach(f => f())
    },
    metric(p) { return Number(p?.age || 0) },
  selectCard(i) { if (this.locked) return; this.selectedIndex = i },
    clickSlot(pos) {
      if (this.locked) return
      if (this.selectedIndex != null) {
        if (this.slots[pos] == null) { this.slots[pos] = this.selectedIndex; this.selectedIndex = null }
        return
      }
      if (this.selectedFromSlot != null) {
        const from = this.selectedFromSlot
        if (from !== pos) {
          const a = this.slots[from]
          const b = this.slots[pos]
          this.slots[pos] = a
          this.slots[from] = b
        }
        this.selectedFromSlot = null
        return
      }
      if (this.slots[pos] != null) { this.selectedFromSlot = pos }
    },
    isPlaced(i) { return this.slots.includes(i) },
    onDragStartFromList(e, i) { if (this.locked) { e.preventDefault(); return } e.dataTransfer.setData('text/plain', JSON.stringify({ from: 'list', index: i })) },
    onDragStartFromSlot(e, pos) { if (this.locked) { e.preventDefault(); return } const idx = this.slots[pos]; if (idx==null) return; e.dataTransfer.setData('text/plain', JSON.stringify({ from: 'slot', pos, index: idx })) },
    onDragOverSlot(e) { e.preventDefault() },
    onDropOnSlot(e, pos) {
      if (this.locked) { e.preventDefault(); return }
      e.preventDefault();
      try { const payload = JSON.parse(e.dataTransfer.getData('text/plain')||'{}'); if (!payload) return;
        if (payload.from==='list') { if (this.slots[pos]==null) this.slots[pos] = payload.index }
        else if (payload.from==='slot') {
          const fromPos = payload.pos; const moving = this.slots[fromPos]; const dest = this.slots[pos];
          this.slots[pos] = moving; this.slots[fromPos] = dest ?? null
        }
      } catch {}
    },
    async check() {
      if (this.locked) return
      if (this.slots.some(x => x == null)) return
      // Sort desc by age, but allow ties to be interchangeable
      const sorted = [...this.items].map((p, idx) => ({ idx, v: this.metric(p) }))
        .sort((a,b) => b.v - a.v)
      const groups = []
      for (const entry of sorted) {
        const last = groups[groups.length - 1]
        if (last && last.v === entry.v) last.indices.push(entry.idx)
        else groups.push({ v: entry.v, indices: [entry.idx] })
      }
      const allowedByPos = []
      let posCursor = 0
      for (const g of groups) {
        for (let k = 0; k < g.indices.length; k++) {
          allowedByPos[posCursor++] = new Set(g.indices)
        }
      }
      this.desiredOrder = sorted.map(x => x.idx)
      this.correctness = this.slots.map((idx, pos) => Boolean(allowedByPos[pos] && allowedByPos[pos].has(idx)))
      const correctPositions = this.correctness.reduce((acc, ok) => acc + (ok ? 1 : 0), 0)
      this.corrects = correctPositions
      this.attempts = this.slots.length
      this.score = correctPositions * 20
      this.answered = true
      this.locked = true
      this.revealDone = false
      this.afterRevealQueue = []
      this.ladderResult = { correctness: [...this.correctness], desiredOrder: [...this.desiredOrder] }
      // award XP based on difficulty
      const xpFull = this.difficultyConfig?.xpCompletion || 100
      this.xpEarned = this.allowXp ? Math.round(xpFull * (correctPositions / Math.max(1, this.slots.length))) : 0
      if (this.mode === 'challenge') {
        const winThreshold = this.slots.length
        const result = correctPositions === winThreshold ? 'win' : 'loss'
        this.afterReveal(() => { if (result === 'win') celebrateGameWin(); else announceGameLoss() })
        if (this.allowXp && this.xpEarned > 0) {
          try { await awardXpBatch({ gameCode: 'age-order', totalXp: this.xpEarned, corrects: correctPositions }) } catch {}
        }
        try { await completeChallengeSession(this.sessionId, this.score, this.xpEarned, { result, correctPositions, finalOrder: [...this.slots], correctness: [...this.correctness], items: this.items, corrects: correctPositions }) } catch {}
        try { const mod = await import('../../services/game-modes'); await mod.checkAndUnlockDailyWins('age-order') } catch {}
        try {
          const snap = await captureLevelSnapshot()
          this.levelAfter = snap.level
          this.xpAfterTotal = snap.xpTotal
          this.afterPercent = snap.percent
          this.xpToNextAfter = snap.xpToNext
          if ((this.levelAfter || 0) > (this.levelBefore || 0)) {
            const lv = this.levelAfter; this.afterReveal(() => celebrateGameLevelUp(lv, 500), 600)
          }
        } catch {}
          this.afterReveal(() => { this.progressShown = this.beforePercent; this.showSummary = true; requestAnimationFrame(()=> setTimeout(()=>{ this.progressShown = this.afterPercent }, 40)) }, 700)
          this.locked = true
      } else if (this.mode === 'free') {
        this.afterReveal(() => { this.setup() }, 1400)
      }
    },
    async checkAvailability() { this.availability = await isChallengeAvailable('age-order') },
    async startChallenge({ difficulty, config }) {
      if (!this.availability.available) return
      
      // Guardar configuración de dificultad
      this.selectedDifficulty = difficulty
      this.difficultyConfig = config
      const itemCount = config.itemCount
      
      try {
        try {
          const snap = await captureLevelSnapshot()
          this.levelBefore = snap.level
          this.xpBeforeTotal = snap.xpTotal
          this.beforePercent = snap.percent
        } catch {}
        this.rng = createDailyRng('age-order')
        this.sessionId = await startChallengeSession('age-order', null, { difficulty: this.selectedDifficulty })
        this.overlayOpen = false
        // Ajustar el número de slots según la dificultad
        this.slots = new Array(itemCount).fill(null)
        this.setup()
      } catch {}
    },
    backPath() { return this.mode === 'free' ? '/play/free' : '/play/points' },
  }
}
</script>

<template>
  <GameShell title="Ordenar por edad" :backPath="backPath()">
    <template #stat>
      <div class="inline-flex items-center gap-2 rounded-lg bg-slate-800/70 border border-white/12 px-2.5 py-1 shadow-lg shadow-black/20">
        <span class="text-slate-400 text-[10px] uppercase tracking-wider font-semibold">Puntaje</span>
        <span class="font-display text-white font-bold text-base leading-none">{{ score }}/100</span>
      </div>
    </template>
    <GamePreviewModal
      :open="overlayOpen && mode === 'challenge' && !reviewMode"
      gameName="Ordenar por edad"
      gameType="ordering"
      gameDescription="Ordená 5 jugadores del más viejo al más joven"
      :mechanic="gameMetadata.mechanic"
      :videoUrl="gameMetadata.videoUrl"
      :tips="gameMetadata.tips"
      @close="overlayOpen = false"
      @start="startChallenge"
    />
    <div class="space-y-4 w-full max-w-2xl">

      <div class="relative surface-solid p-4 sm:p-6 ring-1 ring-white/5" ref="confettiHost">
        <OrderLadder
          v-if="items.length && slots.length === items.length && slots.every(x => x != null)"
          :key="items.map(p => p.id).join()"
          v-model:order="slots"
          :items="items"
          variant="timeline"
          :metric="metric"
          :format="formatValue"
          start-label="Más veterano"
          end-label="Más joven"
          :locked="locked"
          :result="ladderResult"
          :instant="ladderInstant"
          @done="onLadderDone"
        />

        <div class="mt-4 flex items-center justify-center">
          <button @click="check" :disabled="locked || !items.length"
                  class="rounded-full bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 border border-white/10 text-slate-900 px-6 py-2.5 text-sm font-bold shadow-lg shadow-amber-500/25 disabled:opacity-40 disabled:shadow-none transition-all active:scale-95">
            Comprobar
          </button>
        </div>

        <GameSummaryPopup
          :show="showSummary && mode==='challenge'"
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
          :winThreshold="slots.length"
          :backPath="backPath()"
          @close="showSummary = false"
        />
      </div>
    </div>
  </GameShell>
</template>

<style scoped>
.board-fade-enter-active, .board-fade-leave-active {
  transition: opacity 250ms ease, transform 250ms ease;
}
.board-fade-enter-from { opacity: 0; transform: translateY(10px) scale(0.97); }
.board-fade-leave-to { opacity: 0; transform: translateY(-6px) scale(0.98); }
.slot-correct { animation: slotPop 350ms cubic-bezier(0.34,1.56,0.64,1); }
@keyframes slotPop { 0% { transform: scale(1); } 50% { transform: scale(1.08); } 100% { transform: scale(1); } }
.line-clamp-1 { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; }
.line-clamp-2 { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
</style>
