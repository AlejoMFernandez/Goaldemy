<script>
import AppH1 from '../../components/common/AppH1.vue'
import { getAllPlayersAsync, sampleDistinct } from '../../services/players'
import { isChallengeAvailable, startChallengeSession, completeChallengeSession } from '../../services/game-modes'
import { initScoring } from '../../services/scoring'
import { getUserLevel, captureLevelSnapshot } from '../../services/xp'
import { awardXpBatch } from '../../services/game-xp'
import { createDailyRng } from '../../services/seeded-random'
import { spawnXpBadge } from '../../services/ui-effects'
import { celebrateGameWin, announceGameLoss, celebrateGameLevelUp } from '../../services/game-celebrations'
import { getGameMetadata } from '../../services/games'
import GamePreviewModal from '../../components/game/GamePreviewModal.vue'
import GameSummaryPopup from '../../components/game/GameSummaryPopup.vue'

export default {
  name: 'HeightOrder',
  components: { AppH1, GamePreviewModal, GameSummaryPopup },
  computed: {
    gameMetadata() { return getGameMetadata('height-order') }
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
      ...initScoring(10),
      answered: false,
      showSummary: false,
      sessionId: null,
      xpEarned: 0,
      allowXp: true,
      desiredOrder: [],
      correctness: [],
      // summary
      levelBefore: null,
      levelAfter: null,
      xpBeforeTotal: 0,
      xpAfterTotal: 0,
      beforePercent: 0,
      afterPercent: 0,
      progressShown: 0,
      xpToNextAfter: null,
      selectedFromSlot: null,
      hoveredSlot: null,
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
        const last = await mod.fetchTodayLastSession('height-order')
        if (last?.metadata?.finalOrder && Array.isArray(last.metadata.finalOrder)) {
          const saved = last.metadata
          this.items = saved.items || this.items
          this.slots = saved.finalOrder
          this.correctness = saved.correctness || []
          this.answered = true
          this.score = Number(last.score_final || 0)
          this.xpEarned = Number(last.xp_earned || 0)
          this.corrects = saved.corrects ?? this.correctness.filter(Boolean).length
          this.showSummary = true
          this.locked = true
        }
      }).catch(()=>{})
    } else if (this.mode === 'challenge') { this.overlayOpen = true; this.checkAvailability() }
  },
  methods: {
    async setup() {
      this.locked = false
      const all = (await getAllPlayersAsync()).filter(p => Number.isFinite(p?.height))
      const count = this.difficultyConfig?.itemCount || 5
      const picks = sampleDistinct(all, count, new Set(), this.rng)
      this.items = picks
      this.slots = new Array(count).fill(null)
      this.answered = false
      this.showSummary = false
      this.selectedIndex = null
      this.score = 0; this.attempts = 0; this.corrects = 0
    },
    blurb() { return gameSummaryBlurb('height-order') },
    metric(p) { return Number(p?.height || 0) },
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
      // Sort desc by height, but allow ties interchangeable
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
      // award XP based on difficulty
      const xpPerCorrect = this.difficultyConfig?.xpPerCorrect || 20
      this.xpEarned = this.allowXp ? (correctPositions * xpPerCorrect) : 0
      if (this.allowXp && this.xpEarned > 0) {
        spawnXpBadge(this.$refs.confettiHost, `+${this.xpEarned} XP`, { position: 'top-right' })
      }
      const delayMs = 1200
      if (this.mode === 'challenge') {
        const winThreshold = this.slots.length
        const result = correctPositions === winThreshold ? 'win' : 'loss'
        if (result === 'win') celebrateGameWin()
        else announceGameLoss()
        if (this.allowXp && this.xpEarned > 0) {
          try { await awardXpBatch({ gameCode: 'height-order', totalXp: this.xpEarned, corrects: correctPositions }) } catch {}
        }
        try { await completeChallengeSession(this.sessionId, this.score, this.xpEarned, { result, correctPositions, finalOrder: [...this.slots], correctness: [...this.correctness], items: this.items, corrects: correctPositions }) } catch {}
        try { const mod = await import('../../services/game-modes'); await mod.checkAndUnlockDailyWins('height-order') } catch {}
        try {
          const snap = await captureLevelSnapshot()
          this.levelAfter = snap.level
          this.xpAfterTotal = snap.xpTotal
          this.afterPercent = snap.percent
          this.xpToNextAfter = snap.xpToNext
          if ((this.levelAfter || 0) > (this.levelBefore || 0)) {
            celebrateGameLevelUp(this.levelAfter, 500)
          }
        } catch {}
        setTimeout(() => { this.progressShown = this.beforePercent; this.showSummary = true; requestAnimationFrame(()=> setTimeout(()=>{ this.progressShown = this.afterPercent }, 40)) }, delayMs)
        this.locked = true
      } else if (this.mode === 'free') {
        setTimeout(() => { this.setup() }, delayMs)
      }
    },
    async checkAvailability() { this.availability = await isChallengeAvailable('height-order') },
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
        this.rng = createDailyRng('height-order')
        this.sessionId = await startChallengeSession('height-order', null)
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
  <section class="grid place-items-center min-h-[calc(100dvh-4rem)]">
    <GamePreviewModal
      :open="overlayOpen && mode === 'challenge' && !reviewMode"
      gameName="Ordenar por altura"
      gameType="ordering"
      gameDescription="Ordená 5 jugadores del más alto al más bajo"
      :mechanic="gameMetadata.mechanic"
      :videoUrl="gameMetadata.videoUrl"
      :tips="gameMetadata.tips"
      @close="overlayOpen = false"
      @start="startChallenge"
    />
    <div class="space-y-4 w-full max-w-2xl">
      <div class="flex items-center justify-between">
        <AppH1 class="text-2xl md:text-3xl">Ordenar por altura</AppH1>
        <div class="flex items-center gap-2">
          <router-link :to="backPath()" class="rounded-full border border-white/15 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/5 transition">← Volver</router-link>
          <div class="rounded-xl bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-white/15 px-3 py-2 flex items-center gap-2 shadow-lg shadow-black/20">
            <span class="text-slate-400 text-xs uppercase tracking-wider font-semibold">Puntaje</span>
            <span class="font-display text-white font-extrabold text-lg leading-none">{{ score }}/100</span>
          </div>
        </div>
      </div>

      <div class="relative card p-4 sm:p-6 ring-1 ring-white/5" ref="confettiHost">
        <div class="flex items-center justify-between text-[11px] text-slate-400 mb-2 px-1">
          <span class="flex items-center gap-1">⬆ Más alto</span>
          <span class="flex items-center gap-1">Más bajo ⬇</span>
        </div>

        <Transition name="board-fade" mode="out-in">
          <div :key="items.map(p=>p.id).join()">
            <!-- Ranking vertical (más visual: foto grande + nombre legible) -->
            <div class="flex flex-col gap-2 mb-5">
              <button v-for="(slot, i) in slots" :key="'slot'+i" @click="clickSlot(i)" @dragover="onDragOverSlot" @drop="onDropOnSlot($event, i)" @mouseenter="hoveredSlot=i" @mouseleave="hoveredSlot=null"
                      class="w-full rounded-xl border-2 transition-all duration-200 flex items-center gap-3 px-3 py-2"
                      :class="[
                        answered ? (correctness[i] ? 'border-emerald-500 bg-emerald-500/10 slot-correct' : 'border-red-500 bg-red-500/10 shake') : (slot != null ? 'border-white/15 bg-white/5' : 'border-dashed border-white/15 bg-white/[0.03] hover:border-white/25'),
                        (selectedFromSlot===i) ? 'ring-2 ring-sky-400 border-sky-400' : '',
                        (hoveredSlot===i && (selectedIndex!=null || selectedFromSlot!=null)) ? 'ring-2 ring-amber-400 border-amber-400' : '',
                        locked ? 'cursor-not-allowed' : 'cursor-pointer'
                      ]">
                <div class="shrink-0 w-8 h-8 rounded-full grid place-items-center font-display font-extrabold text-sm"
                     :class="slot != null ? 'bg-white/10 text-white' : 'border-2 border-dashed border-white/15 text-slate-500'">{{ i+1 }}</div>
                <template v-if="slot != null">
                  <div class="w-12 h-12 rounded-full overflow-hidden ring-2 shrink-0"
                       :class="answered ? (correctness[i] ? 'ring-emerald-400/60' : 'ring-red-400/60') : 'ring-white/20'">
                    <img :src="items[slot].image" :alt="items[slot].name" class="w-full h-full object-cover" :draggable="!locked" @dragstart="onDragStartFromSlot($event, i)" />
                  </div>
                  <div class="flex-1 min-w-0 font-semibold text-white truncate">{{ items[slot].name }}</div>
                  <div v-if="answered" class="shrink-0 text-xs font-bold px-2.5 py-1 rounded-full" :class="correctness[i] ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'">
                    {{ items[slot].height }} cm
                  </div>
                </template>
                <template v-else>
                  <span class="text-slate-500 text-sm">Tocá un jugador para ponerlo en el puesto {{ i+1 }}</span>
                </template>
              </button>
            </div>

            <!-- Pool: chips que envuelven, fotos y nombres más grandes -->
            <div class="flex flex-wrap justify-center gap-2">
              <button v-for="(p,i) in items" :key="p.id" :disabled="isPlaced(i) || locked" @click="selectCard(i)" :draggable="!locked" @dragstart="onDragStartFromList($event, i)"
                      class="w-[92px] rounded-xl border p-2 transition-all duration-150"
                      :class="[selectedIndex===i ? 'ring-2 ring-sky-400 border-sky-400/50 bg-sky-500/10 scale-[1.03]' : 'border-white/10 bg-white/5', (isPlaced(i) || locked) ? 'opacity-30 cursor-not-allowed scale-95' : 'hover:bg-white/10 hover:scale-[1.03] active:scale-[0.97] cursor-pointer']">
                <div class="flex flex-col items-center gap-1.5">
                  <img :src="p.image" :alt="p.name" class="h-12 w-12 object-cover rounded-full ring-1 ring-white/10" />
                  <div class="text-slate-200 text-[11px] leading-tight text-center line-clamp-2 font-medium">{{ p.name }}</div>
                </div>
              </button>
            </div>
          </div>
        </Transition>

        <div class="mt-4 flex items-center justify-center">
          <button @click="check" :disabled="slots.some(x=>x==null) || locked"
                  class="rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110 border border-white/10 text-white px-6 py-2.5 text-sm font-bold shadow-lg shadow-emerald-500/20 disabled:opacity-40 disabled:shadow-none transition-all active:scale-95">
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
  </section>
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
