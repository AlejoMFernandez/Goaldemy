<script>
import AppH1 from '../../components/common/AppH1.vue'
import { getAllPlayers, sampleDistinct } from '../../services/players'
import { isChallengeAvailable, startChallengeSession, completeChallengeSession } from '../../services/game-modes'
import { initScoring } from '../../services/scoring'
import { getUserLevel } from '../../services/xp'
import { awardXpForCorrect } from '../../services/game-xp'
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
    this.setup()
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
    setup() {
      this.locked = false
      const all = getAllPlayers().filter(p => Number.isFinite(p?.height))
      const picks = sampleDistinct(all, 5)
      this.items = picks
      this.slots = [null, null, null, null, null]
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
        try {
          await awardXpForCorrect({ gameCode: 'height-order', amount: this.xpEarned, attemptIndex: 0, streak: 0, corrects: correctPositions })
          spawnXpBadge(this.$refs.confettiHost, `+${this.xpEarned} XP`, { position: 'top-right' })
        } catch {}
      }
      const delayMs = 1200
      if (this.mode === 'challenge') {
        const winThreshold = this.slots.length
        const result = correctPositions === winThreshold ? 'win' : 'loss'
        if (result === 'win') celebrateGameWin()
        else announceGameLoss()
        try { await completeChallengeSession(this.sessionId, this.score, this.xpEarned, { result, correctPositions, finalOrder: [...this.slots], correctness: [...this.correctness], items: this.items, corrects: correctPositions }) } catch {}
        try { const mod = await import('../../services/game-modes'); await mod.checkAndUnlockDailyWins('height-order') } catch {}
        try {
          const { data } = await getUserLevel(null)
          const info = Array.isArray(data) ? data[0] : data
          this.levelAfter = info?.level ?? null
          this.xpAfterTotal = info?.xp_total ?? 0
          const next = info?.next_level_xp || 0
          const toNext = info?.xp_to_next ?? 0
          const completed = next ? (next - toNext) : next
          this.afterPercent = next ? Math.max(0, Math.min(100, Math.round((completed / next) * 100))) : 100
          this.xpToNextAfter = toNext ?? null
          
          // Level up celebration
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
          const { data } = await getUserLevel(null)
          const info = Array.isArray(data) ? data[0] : data
          this.levelBefore = info?.level ?? null
          this.xpBeforeTotal = info?.xp_total ?? 0
          const next = info?.next_level_xp || 0
          const toNext = info?.xp_to_next ?? 0
          const completed = next ? (next - toNext) : next
          this.beforePercent = next ? Math.max(0, Math.min(100, Math.round((completed / next) * 100))) : 100
        } catch {}
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
  <GamePreviewModal
    :open="overlayOpen && mode === 'challenge' && !reviewMode"
    gameName="Ordenar por altura"
    gameDescription="Ordená 5 jugadores del más alto al más bajo"
    :mechanic="gameMetadata.mechanic"
    :videoUrl="gameMetadata.videoUrl"
    :tips="gameMetadata.tips"
    @close="overlayOpen = false"
    @start="startChallenge"
  />

  <section class="grid place-items-center">
    <div class="space-y-3 w-full max-w-4xl">
      <div class="flex items-center justify-between">
        <AppH1>Ordenar por altura</AppH1>
        <div class="flex items-center gap-2">
          <div class="rounded-xl bg-slate-900/60 border border-white/15 px-2.5 py-1.5 flex items-center gap-2">
            <span class="text-slate-300 text-[10px] uppercase tracking-wider">Puntaje</span>
            <span class="text-white font-extrabold text-base leading-none">{{ score }}/50</span>
          </div>
          <router-link :to="backPath()" class="rounded-full border border-white/15 px-2 py-1 text-xs sm:text-sm text-slate-200 hover:bg-white/5">← Volver</router-link>
        </div>
      </div>

  <div class="relative card p-4" ref="confettiHost">
        <div class="flex items-center justify-between text-[11px] text-slate-400 mb-1 px-1">
          <span>Más alto (+)</span>
          <span>Más bajo (−)</span>
        </div>
        <div class="grid grid-cols-5 gap-2 mb-3">
          <button v-for="(slot, i) in slots" :key="'slot'+i" @click="clickSlot(i)" @dragover="onDragOverSlot" @drop="onDropOnSlot($event, i)" @mouseenter="hoveredSlot=i" @mouseleave="hoveredSlot=null" class="h-40 rounded-lg border bg-white/5 transition ring-offset-1" :class="[
            answered ? (correctness[i] ? 'border-green-500 bg-green-500/10' : 'border-red-500 bg-red-500/10') : 'border-white/15 text-slate-400',
            (selectedFromSlot===i) ? 'ring-2 ring-sky-400' : '',
            (hoveredSlot===i && (selectedIndex!=null || selectedFromSlot!=null)) ? 'ring-2 ring-amber-400' : '',
            locked ? 'cursor-not-allowed' : ''
          ]">
            <template v-if="slot != null">
              <div class="flex flex-col items-center justify-center h-full text-slate-200">
                <img :src="items[slot].image" :alt="items[slot].name" class="h-16 w-16 object-cover rounded mb-2" :draggable="!locked" @dragstart="onDragStartFromSlot($event, i)" />
                <div class="text-slate-100 text-sm sm:text-base text-center leading-tight px-1 whitespace-normal break-words">{{ items[slot].name }}</div>
                <div v-if="answered" class="text-[12px] mt-1" :class="correctness[i] ? 'text-emerald-300' : 'text-red-300'">
                  {{ items[slot].height }} cm
                </div>
              </div>
            </template>
            <template v-else>
              <span class="text-sm text-slate-400 font-semibold">#{{ i+1 }}</span>
            </template>
          </button>
        </div>

        <div class="grid grid-cols-5 gap-2">
          <button v-for="(p,i) in items" :key="p.id" :disabled="isPlaced(i) || locked" @click="selectCard(i)" :draggable="!locked" @dragstart="onDragStartFromList($event, i)" :class="['rounded-lg border p-2 bg-white/5 text-left', selectedIndex===i ? 'ring-2 ring-sky-400 border-white/20' : 'border-white/15', (isPlaced(i) || locked) ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white/10']">
            <div class="flex items-center gap-2 flex-col">
              <img :src="p.image" :alt="p.name" class="h-10 w-10 object-cover rounded" />
              <div class="min-w-0">
                <div class="text-slate-100 text-sm leading-tight whitespace-normal break-words">{{ p.name }}</div>
              </div>
            </div>
          </button>
        </div>

        <div class="mt-4 flex items-center justify-center">
          <button @click="check" :disabled="slots.some(x=>x==null) || locked" class="rounded-full bg-[oklch(0.62_0.21_270)] hover:brightness-110 border border-white/10 text-white px-5 py-2 text-sm font-semibold disabled:opacity-50">Comprobar</button>
        </div>

        <!-- Summary Popup -->
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


