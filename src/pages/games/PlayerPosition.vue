<script>
import AppH1 from '../../components/AppH1.vue';
import { initState, loadPlayers, nextRound, pickAnswer, optionClass } from '../../services/player-position';
import { initScoring } from '../../services/scoring'
import { celebrateCorrect, celebrateGameWin, announceGameLoss, celebrateGameLevelUp } from '../../services/game-celebrations'
import { getGameMetadata } from '../../services/games'
import GamePreviewModal from '../../components/GamePreviewModal.vue'
import GameSummaryPopup from '../../components/GameSummaryPopup.vue'
import { isChallengeAvailable, startChallengeSession, completeChallengeSession, fetchLifetimeMaxStreak } from '../../services/game-modes'
import { getUserLevel } from '../../services/xp'

export default {
  name: 'PlayerPosition',
  components: { AppH1, GamePreviewModal, GameSummaryPopup },
  data() {
    return { 
      ...initState(), 
      ...initScoring(),
      mode: 'normal',
      reviewMode: false,
      overlayOpen: false,
      chosenSeconds: 30,
      timeLeft: 0,
      timer: null,
      sessionId: null,
      timeOver: false,
      availability: { available: true, reason: null },
      showSummary: false,
      lifetimeMaxStreak: 0,
      // XP summary fields
      levelBefore: null,
      levelAfter: null,
      xpBeforeTotal: 0,
      xpAfterTotal: 0,
      beforePercent: 0,
      afterPercent: 0,
      progressShown: 0,
      xpToNextAfter: null,
    };
  },
  computed: {
    gameMetadata() { return getGameMetadata('player-position') }
  },
  mounted() {
    const mode = (this.$route.query.mode || '').toString().toLowerCase()
    if (mode === 'free') this.mode = 'free'
    else if (mode === 'challenge') this.mode = 'challenge'
    else if (mode === 'review') { this.mode = 'challenge'; this.reviewMode = true }
    else this.mode = 'normal'

    if (this.mode === 'free') this.allowXp = false

    loadPlayers(this);
    nextRound(this);

    if (this.reviewMode) {
      import('../../services/game-modes').then(async (mod) => {
        const last = await mod.fetchTodayLastSession('player-position')
        if (last) {
          const m = last.metadata || {}
          this.score = Number(last.score_final || 0)
          this.maxStreak = Number(m.maxStreak || 0)
          this.corrects = Number(m.corrects || 0)
          this.timeOver = true
          const v = m.xpView || {}
          if (v && (v.levelAfter != null)) {
            this.levelBefore = v.levelBefore ?? null
            this.xpBeforeTotal = v.xpBeforeTotal ?? 0
            this.levelAfter = v.levelAfter ?? null
            this.xpAfterTotal = v.xpAfterTotal ?? 0
            this.beforePercent = v.beforePercent ?? 0
            this.afterPercent = v.afterPercent ?? 0
            this.xpToNextAfter = v.xpToNextAfter ?? null
            this.progressShown = this.afterPercent
          }
          try { this.lifetimeMaxStreak = Math.max(await mod.fetchLifetimeMaxStreak('player-position') || 0, this.maxStreak || 0) } catch {}
          this.showSummary = true
        }
      }).catch(()=>{})
    } else if (this.mode === 'challenge') {
      this.overlayOpen = true
      this.checkAvailability()
    }
  },
  methods: {
    nextRound() { nextRound(this); },
    backPath() { return this.mode === 'free' ? '/play/free' : '/play/points' },
    async pick(option) {
      if (this.timeOver) return false
      const ok = await pickAnswer(this, option, this.$refs.confettiHost);
      setTimeout(() => this.nextRound(), 1000);
      return ok
    },
    optionClass(opt) { return optionClass(this, opt); },
    async checkAvailability() { this.availability = await isChallengeAvailable('player-position') },
    async startChallenge() {
      if (!this.availability.available) return
      try {
        // capture XP before
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
        this.sessionId = await startChallengeSession('player-position', 30)
        this.overlayOpen = false
        this.timeLeft = 30
        this.timeOver = false
        clearInterval(this.timer)
        this.timer = setInterval(() => {
          if (this.timeLeft > 0) this.timeLeft -= 1
          if (this.timeLeft <= 0) {
            this.timeOver = true
            clearInterval(this.timer)
            const result = (this.corrects || 0) >= 10 ? 'win' : 'loss'
            if (result === 'win') celebrateGameWin()
            else announceGameLoss()
            this.finishChallenge(result)
          }
        }, 1000)
      } catch (e) {
        console.error('[PlayerPosition challenge start]', e)
      }
    },
    async finishChallenge(result) {
      try {
        await completeChallengeSession(this.sessionId, this.score, this.xpEarned, { maxStreak: this.maxStreak, result, corrects: this.corrects })
        
        // Get XP after
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
        
        // Save XP snapshot
        await completeChallengeSession(this.sessionId, this.score, this.xpEarned, {
          xpView: {
            levelBefore: this.levelBefore, xpBeforeTotal: this.xpBeforeTotal,
            levelAfter: this.levelAfter, xpAfterTotal: this.xpAfterTotal,
            beforePercent: this.beforePercent, afterPercent: this.afterPercent,
            xpToNextAfter: this.xpToNextAfter, xpEarned: this.xpEarned
          }
        })
        
        this.lifetimeMaxStreak = Math.max(await fetchLifetimeMaxStreak('player-position') || 0, this.maxStreak || 0)
        
        // Show summary
        this.progressShown = this.beforePercent
        this.showSummary = true
        requestAnimationFrame(() => setTimeout(() => { this.progressShown = this.afterPercent }, 40))
        
        import('../../services/game-modes').then(mod => mod.checkAndUnlockDailyWins('player-position')).catch(()=>{})
      } catch (e) {
        console.error('[PlayerPosition finish]', e)
      }
    }
  }
}
</script>

<template>
  <GamePreviewModal
    :open="overlayOpen && mode === 'challenge' && !reviewMode"
    gameName="Posición del jugador"
    gameDescription="Identificá la posición correcta del jugador mostrado"
    :mechanic="gameMetadata.mechanic"
    :videoUrl="gameMetadata.videoUrl"
    :tips="gameMetadata.tips"
    @close="overlayOpen = false"
    @start="startChallenge"
  />

  <section class="grid place-items-center h-full">
    <div class="space-y-3 w-full max-w-4xl">
      <div class="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-2 w-full">
        <AppH1 class="text-2xl md:text-4xl mb-1 sm:mb-0 flex-none">Posición del jugador</AppH1>
        <div class="flex items-center gap-2 self-stretch sm:self-auto flex-none">
          <router-link :to="backPath()" class="rounded-full border border-white/15 px-2 py-1 text-xs sm:text-sm text-slate-200 hover:bg-white/5">← Volver</router-link>
          <div class="rounded-xl bg-slate-900/60 border border-white/15 px-2.5 py-1.5 flex items-center gap-2">
            <span class="text-slate-300 text-[10px] uppercase tracking-wider">Puntaje</span>
            <span class="text-white font-extrabold text-base sm:text-lg leading-none whitespace-nowrap">{{ score }}/{{ attempts * 10 }}</span>
            <div v-if="streak > 0" class="rounded-full border border-green-500/60 bg-green-500/10 text-green-300 text-[11px] sm:text-xs px-2 py-0.5 sm:px-2.5 sm:py-1 font-semibold">
              ×{{ streak }}
            </div>
          </div>
        </div>
      </div>

      <div v-if="loading" class="text-slate-300">Cargando…</div>
      <div v-else class="relative card p-4">
        <div ref="confettiHost" class="pointer-events-none absolute inset-0 overflow-hidden"></div>
        
        <!-- Timer -->
        <div v-if="mode==='challenge'" class="pointer-events-none absolute left-3 top-3 z-10">
          <div :class="['rounded-full px-3 py-1 text-sm font-bold shadow border',
            timeLeft>=21 ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' :
            timeLeft>=11 ? 'bg-amber-500/15 text-amber-300 border-amber-500/40' :
                           'bg-red-500/15 text-red-300 border-red-500/40']">
            ⏱ {{ Math.max(0, timeLeft) }}s
          </div>
        </div>

        <Transition name="round-fade" mode="out-in">
          <div :key="roundKey">
            <div class="flex flex-col items-center">
              <p class="text-slate-200 mb-2 text-center text-base">¿Cuál es la posición de este jugador?</p>
              <img v-if="current" :src="current.image" :alt="current.name" class="mb-3 w-32 h-32 sm:w-36 sm:h-36 object-cover rounded-lg" />
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button v-for="opt in options" :key="opt.label" @click="pick(opt)" :class="optionClass(opt)" :disabled="answered || timeOver"
                class="transition-transform duration-150 active:scale-[0.98]">
                {{ opt.label }}
              </button>
            </div>
          </div>
        </Transition>

        <!-- Summary Popup -->
        <GameSummaryPopup
          :show="showSummary"
          :corrects="corrects"
          :score="score"
          :maxStreak="maxStreak"
          :lifetimeMaxStreak="lifetimeMaxStreak"
          :levelBefore="levelBefore"
          :levelAfter="levelAfter"
          :xpBeforeTotal="xpBeforeTotal"
          :xpAfterTotal="xpAfterTotal"
          :beforePercent="beforePercent"
          :afterPercent="afterPercent"
          :progressShown="progressShown"
          :xpToNextAfter="xpToNextAfter"
          :winThreshold="10"
          :backPath="backPath()"
          @close="showSummary = false"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.round-fade-enter-active, .round-fade-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}
.round-fade-enter-from, .round-fade-leave-to {
  opacity: 0;
  transform: translateY(6px) scale(0.99);
}
</style>
