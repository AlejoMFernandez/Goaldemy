<script>
export default {
  name: 'GameSummaryPopup',
  props: {
    show: { type: Boolean, default: false },
    corrects: { type: Number, default: 0 },
    score: { type: Number, default: 0 },
    maxStreak: { type: Number, default: 0 },
    lifetimeMaxStreak: { type: Number, default: 0 },
    levelBefore: { type: Number, default: null },
    levelAfter: { type: Number, default: null },
    xpBeforeTotal: { type: Number, default: 0 },
    xpAfterTotal: { type: Number, default: 0 },
    beforePercent: { type: Number, default: 0 },
    afterPercent: { type: Number, default: 0 },
    progressShown: { type: Number, default: 0 },
    xpToNextAfter: { type: Number, default: null },
    winThreshold: { type: Number, default: 10 },
    backPath: { type: String, default: '/play/points' },
    // Nuevos props para dificultad
    xpEarned: { type: Number, default: 0 },
    difficulty: { type: String, default: 'normal' }
  },
  emits: ['close'],
  computed: {
    won() {
      return this.corrects >= this.winThreshold
    },
    difficultyMultiplier() {
      // Multiplicador basado en la dificultad
      if (this.difficulty === 'easy') return '×1'
      if (this.difficulty === 'hard') return '×3'
      return '×2' // normal
    },
    difficultyColor() {
      if (this.difficulty === 'easy') return 'text-green-400'
      if (this.difficulty === 'hard') return 'text-red-400'
      return 'text-yellow-400' // normal
    }
  }
}
</script>

<template>
  <Transition name="summary-overlay">
    <div v-if="show" class="absolute inset-0 z-30 grid place-items-center bg-slate-900/80 backdrop-blur rounded-xl p-4">
      <div class="summary-card w-full max-w-lg rounded-2xl border border-white/20 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden shadow-2xl">

      <!-- RESULTADO DESTACADO -->
      <div :class="[
        'p-5 text-center border-b',
        won
          ? 'bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border-emerald-500/30'
          : 'bg-gradient-to-br from-red-500/20 to-orange-500/20 border-red-500/30'
      ]">
        <div class="text-5xl mb-2 result-icon">{{ won ? '🎉' : '💪' }}</div>
        <h2 :class="[
          'text-3xl font-extrabold mb-1',
          won ? 'text-emerald-400' : 'text-red-400'
        ]">
          {{ won ? '¡GANASTE!' : '¡PERDISTE!' }}
        </h2>
        <p class="text-white text-base font-medium mb-3">
          {{ won 
            ? 'Excelente trabajo, seguí así' 
            : 'No te rindas, volvé a intentarlo mañana' 
          }}
        </p>
        <!-- Stats principales -->
        <div class="flex justify-center gap-3">
          <div class="rounded-xl bg-black/20 backdrop-blur px-3 py-1.5 border border-white/10">
            <div class="text-[10px] uppercase tracking-wider text-slate-300">Aciertos</div>
            <div class="text-xl font-bold text-white">{{ corrects }}<span class="text-slate-400 text-base">/{{ winThreshold }}</span></div>
          </div>
          <div class="rounded-xl bg-black/20 backdrop-blur px-3 py-1.5 border border-white/10">
            <div class="text-[10px] uppercase tracking-wider text-slate-300">XP Ganado</div>
            <div class="flex items-baseline gap-1">
              <span class="text-lg font-semibold text-white">{{ xpEarned || score }}</span>
              <span :class="['text-xl font-bold', difficultyColor]">{{ difficultyMultiplier }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Sección de detalles -->
      <div class="p-6">
        <!-- Rachas -->
        <div class="grid grid-cols-2 gap-3 mb-5">
          <div class="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
            <div class="text-xs uppercase tracking-wider text-slate-400 mb-1">Racha hoy</div>
            <div class="text-emerald-300 font-bold text-xl">×{{ maxStreak || 0 }}</div>
          </div>
          <div class="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
            <div class="text-xs uppercase tracking-wider text-slate-400 mb-1">Histórica</div>
            <div class="text-indigo-300 font-bold text-xl">×{{ lifetimeMaxStreak || 0 }}</div>
          </div>
        </div>

        <!-- Progreso XP -->
        <div class="rounded-xl bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/30 p-4 mb-5">
          <div class="flex items-center justify-between text-sm text-slate-300 mb-2">
            <span class="font-semibold">Progreso de XP</span>
            <span class="tabular-nums">
              <span class="text-slate-400">{{ xpBeforeTotal }}</span> → 
              <span class="text-white font-bold">{{ xpAfterTotal }}</span> 
              <span class="text-emerald-400 font-bold">(+{{ Math.max(0, (xpAfterTotal - xpBeforeTotal) || 0) }})</span>
            </span>
          </div>
          <div class="h-3 rounded-full bg-black/30 overflow-hidden mb-2">
            <div 
              class="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400 transition-all duration-700 shadow-lg" 
              :style="{ width: (progressShown||0) + '%' }"
            ></div>
          </div>
          <div class="flex items-center justify-between text-xs">
            <span class="text-slate-400">
              Nivel <span class="text-white font-semibold">{{ levelBefore ?? '—' }}</span> → 
              <span :class="(levelAfter||0)>(levelBefore||0)?'text-yellow-300 font-bold':'text-slate-300'">
                {{ levelAfter ?? '—' }}
              </span>
            </span>
            <span v-if="(xpToNextAfter ?? null) !== null" class="text-slate-400">
              Faltan <span class="text-white font-semibold">{{ xpToNextAfter }} XP</span>
            </span>
          </div>
        </div>

        <!-- Botones -->
        <div class="flex gap-3">
          <button 
            @click="$emit('close')" 
            class="flex-1 rounded-xl border border-white/20 hover:bg-white/5 text-white py-3 font-semibold transition"
          >
            Cerrar
          </button>
          <router-link 
            :to="backPath" 
            class="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110 text-white py-3 font-bold transition text-center shadow-lg shadow-emerald-500/25"
          >
            Volver a juegos
          </router-link>
        </div>
      </div>

      </div>
    </div>
  </Transition>
</template>

<style scoped>
.summary-overlay-enter-active { transition: opacity 0.3s ease; }
.summary-overlay-leave-active { transition: opacity 0.2s ease; }
.summary-overlay-enter-from, .summary-overlay-leave-to { opacity: 0; }
.summary-card {
  animation: summary-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes summary-pop {
  from { opacity: 0; transform: scale(0.9) translateY(12px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
.result-icon {
  animation: result-bounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s both;
}
@keyframes result-bounce {
  from { transform: scale(0); }
  to { transform: scale(1); }
}
</style>

