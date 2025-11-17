<!-- EJEMPLO DE USO DEL NUEVO SISTEMA -->
<!-- Este archivo muestra cómo NationalityGame.vue quedaría con el nuevo sistema -->

<script>
import AppH1 from '../../components/AppH1.vue'
import { initState, loadPlayers, nextRound, optionClass, pick, flag } from '../../services/nationality'
import { initScoring } from '../../services/scoring'
import { useChallengeGame } from '../../components/ChallengeGameWrapper.vue'
import GameSummaryPopup from '../../components/GameSummaryPopup.vue'

export default {
  name: 'NationalityGame',
  components: { AppH1, GameSummaryPopup },
  setup() {
    // ✅ TODO el manejo de challenge en una sola línea!
    const challenge = useChallengeGame('nationality', {
      winThreshold: 10,
      timerSeconds: 30
    })

    return { challenge }
  },
  data() {
    return { 
      ...initState(), 
      ...initScoring(),
      allowXp: true,
    }
  },
  mounted() {
    // Detectar modo
    if (this.challenge.mode.value === 'free') this.allowXp = false
    
    loadPlayers(this)
    nextRound(this)
    
    if (this.challenge.mode.value === 'challenge') {
      this.challenge.checkAvailability()
    }
  },
  methods: {
    nextRound() { nextRound(this) },
    backPath() { return this.challenge.mode.value === 'free' ? '/play/free' : '/play/points' },
    
    pick(option) { 
      if (this.challenge.timeOver.value || this.challenge.earlyWin.value) return
      pick(this, option, this.$refs.confettiHost)
      
      // Check early win para juegos TIMED
      if (this.challenge.mode.value === 'challenge' && 
          this.challenge.checkWinCondition(this.corrects)) {
        this.challenge.handleEarlyWin({
          score: this.score,
          xpEarned: this.xpEarned,
          corrects: this.corrects,
          maxStreak: this.maxStreak
        })
      } else {
        setTimeout(() => this.nextRound(), 1000)
      }
    },
    
    optionClass(opt) { return optionClass(this, opt) },
    flag(opt) { return flag(opt.code, 40) },
  },
  watch: {
    // Cuando termina el timer
    'challenge.timeLeft': function(val) {
      if (val === 0 && this.challenge.mode.value === 'challenge') {
        const result = this.corrects >= 10 ? 'win' : 'loss'
        this.challenge.finishChallenge(result, {
          score: this.score,
          xpEarned: this.xpEarned,
          corrects: this.corrects,
          maxStreak: this.maxStreak
        })
      }
    }
  }
}
</script>

<template>
  <!-- Preview Modal manejado automáticamente -->
  <component :is="'div'">
    <GamePreviewModal
      :open="challenge.overlayOpen.value && challenge.mode.value === 'challenge' && !challenge.reviewMode.value"
      gameName="Nacionalidad correcta"
      gameDescription="Identificá la nacionalidad correcta de cada jugador"
      :mechanic="challenge.gameMetadata.value.mechanic"
      :videoUrl="challenge.gameMetadata.value.videoUrl"
      :tips="challenge.gameMetadata.value.tips"
      @close="challenge.overlayOpen.value = false"
      @start="challenge.startChallenge"
    />
  </component>

  <section class="grid place-items-center">
    <div class="space-y-3 w-full max-w-4xl">
      <!-- Header del juego -->
      <div class="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-2 w-full">
        <AppH1 class="text-2xl md:text-4xl mb-1 sm:mb-0 flex-none">Nacionalidad correcta</AppH1>
        <div class="flex items-center gap-2">
          <router-link :to="backPath()" class="rounded-full border border-white/15 px-2 py-1 text-xs sm:text-sm text-slate-200 hover:bg-white/5">
            ← Volver
          </router-link>
          <div class="rounded-xl bg-slate-900/60 border border-white/15 px-2.5 py-1.5 flex items-center gap-2">
            <span class="text-slate-300 text-[10px] uppercase tracking-wider">Puntaje</span>
            <span class="text-white font-extrabold text-base sm:text-lg">{{ score }}/{{ attempts * 10 }}</span>
            <div v-if="streak > 0" class="rounded-full border border-green-500/60 bg-green-500/10 text-green-300 text-[11px] px-2 py-0.5 font-semibold">
              ×{{ streak }}
            </div>
          </div>
        </div>
      </div>

      <div v-if="loading" class="text-slate-300">Cargando…</div>
      <div v-else class="relative card p-4">
        <div ref="confettiHost" class="pointer-events-none absolute inset-0 overflow-hidden"></div>
        
        <!-- Timer (solo en challenge) -->
        <div v-if="challenge.mode.value === 'challenge'" class="pointer-events-none absolute left-3 top-3 z-10">
          <div :class="[
            'rounded-full px-3 py-1 text-sm font-bold shadow border',
            challenge.timeLeft.value >= 21 ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' :
            challenge.timeLeft.value >= 11 ? 'bg-amber-500/15 text-amber-300 border-amber-500/40' :
            'bg-red-500/15 text-red-300 border-red-500/40'
          ]">
            ⏱ {{ Math.max(0, challenge.timeLeft.value) }}s
          </div>
        </div>

        <!-- Contenido del juego -->
        <Transition name="round-fade" mode="out-in">
          <div :key="roundKey">
            <div class="flex flex-col items-center">
              <p class="text-slate-200 mb-2 text-center">
                ¿De qué país es <strong class="text-white">{{ current?.name }}</strong>?
              </p>
              <img v-if="current" :src="current.image" :alt="current.name" class="mb-3 w-32 h-32 object-cover rounded-lg" />
              <div class="w-full space-y-2">
                <button
                  v-for="opt in options"
                  :key="opt.value"
                  :class="optionClass(opt)"
                  :disabled="challenge.timeOver.value"
                  @click="pick(opt)"
                  class="w-full"
                >
                  <img :src="flag(opt)" :alt="opt.label" class="w-6 h-4 object-cover rounded" />
                  <span>{{ opt.label }}</span>
                </button>
              </div>
            </div>
          </div>
        </Transition>

        <!-- Summary Popup con componente reutilizable -->
        <GameSummaryPopup
          :show="challenge.showSummary.value"
          :corrects="corrects"
          :score="score"
          :maxStreak="maxStreak"
          :lifetimeMaxStreak="challenge.lifetimeMaxStreak.value"
          :levelBefore="challenge.levelBefore.value"
          :levelAfter="challenge.levelAfter.value"
          :xpBeforeTotal="challenge.xpBeforeTotal.value"
          :xpAfterTotal="challenge.xpAfterTotal.value"
          :beforePercent="challenge.beforePercent.value"
          :afterPercent="challenge.afterPercent.value"
          :progressShown="challenge.progressShown.value"
          :xpToNextAfter="challenge.xpToNextAfter.value"
          :winThreshold="10"
          :backPath="backPath()"
          @close="challenge.showSummary.value = false"
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
  transform: scale(0.98);
}
</style>
