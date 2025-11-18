<script>
export default {
  name: 'DailyStreakBanner',
  props: {
    currentStreak: { type: Number, default: 0 },
    bestStreak: { type: Number, default: 0 }
  },
  data() {
    return {
      expanded: false
    }
  },
  computed: {
    streakEmoji() {
      if (this.currentStreak >= 30) return '👑'
      if (this.currentStreak >= 14) return '💎'
      if (this.currentStreak >= 7) return '⭐'
      if (this.currentStreak >= 3) return '🔥'
      return '✨'
    },
    streakMessage() {
      if (this.currentStreak === 0) return '¡Empezá tu racha hoy!'
      if (this.currentStreak === 1) return '¡Primera victoria!'
      if (this.currentStreak < 3) return '¡Seguí así!'
      if (this.currentStreak < 7) return '¡Estás en racha!'
      if (this.currentStreak < 14) return '¡Imparable!'
      if (this.currentStreak < 30) return '¡Leyenda viva!'
      return '¡DIOS DEL FÚTBOL!'
    },
    progressToNextMilestone() {
      const milestones = [3, 7, 14, 30]
      const next = milestones.find(m => m > this.currentStreak)
      if (!next) return 100
      const prev = milestones.filter(m => m <= this.currentStreak).pop() || 0
      return Math.round(((this.currentStreak - prev) / (next - prev)) * 100)
    },
    nextMilestone() {
      const milestones = [3, 7, 14, 30]
      return milestones.find(m => m > this.currentStreak) || null
    }
  }
}
</script>

<template>
  <div 
    v-if="currentStreak > 0"
    @mouseenter="expanded = true" 
    @mouseleave="expanded = false"
    class="fixed bottom-4 left-4 z-30 w-[300px] cursor-pointer"
  >
    <div class="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 backdrop-blur-xl shadow-2xl transition-all duration-300"
      :class="expanded ? 'border-emerald-400/40 shadow-emerald-500/20' : 'border-white/20 hover:border-emerald-400/30'"
    >
      <!-- Animated background effect -->
      <div class="absolute inset-0 opacity-20 pointer-events-none">
        <div class="absolute top-0 left-1/4 w-32 h-32 bg-emerald-500/30 rounded-full blur-3xl animate-pulse"></div>
        <div class="absolute bottom-0 right-1/4 w-40 h-40 bg-cyan-500/30 rounded-full blur-3xl animate-pulse" style="animation-delay: 1s"></div>
      </div>

      <div class="relative z-10 p-4">
        <!-- Expanded Details (shows on hover) -->
        <Transition name="streak-details">
          <div v-if="expanded" class="mb-3 space-y-2">
            <!-- Progress bar to next milestone -->
            <div v-if="nextMilestone">
              <div class="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                <span>Próximo: {{ nextMilestone }} días</span>
                <span class="font-semibold">{{ progressToNextMilestone }}%</span>
              </div>
              <div class="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div 
                  class="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400 transition-all duration-1000 shadow-lg"
                  :style="{ width: progressToNextMilestone + '%' }"
                ></div>
              </div>
            </div>

            <!-- Best streak -->
            <div v-if="bestStreak > currentStreak" class="flex items-center gap-2 text-xs">
              <span class="text-slate-400">Mejor racha:</span>
              <span class="font-semibold text-amber-400">{{ bestStreak }} días 🏆</span>
            </div>

            <!-- Motivation message -->
            <div class="p-2 rounded-lg bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-400/20">
              <p class="text-[10px] text-slate-200 leading-relaxed">
                <span v-if="currentStreak === 0">🎯 Jugá hoy para comenzar tu racha</span>
                <span v-else-if="currentStreak < 3">💪 ¡No rompas la racha! Volvé mañana</span>
                <span v-else-if="currentStreak < 7">🔥 {{ 7 - currentStreak }} días más para la semana perfecta</span>
                <span v-else-if="currentStreak < 14">⭐ ¡Vas camino a las 2 semanas!</span>
                <span v-else-if="currentStreak < 30">💎 Solo {{ 30 - currentStreak }} días para el mes legendario</span>
                <span v-else>👑 ¡Sos una leyenda absoluta!</span>
              </p>
            </div>
          </div>
        </Transition>

        <!-- Main Content (Always visible) -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="text-3xl animate-bounce" style="animation-duration: 2s">{{ streakEmoji }}</div>
            <div>
              <h3 class="text-base font-bold text-white">Racha actual</h3>
              <p class="text-[10px] text-slate-300">{{ streakMessage }}</p>
            </div>
          </div>
          <div class="text-right">
            <div class="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
              {{ currentStreak }}
            </div>
            <div class="text-[10px] text-slate-400">días</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
}

/* Transición suave para detalles expandidos */
.streak-details-enter-active,
.streak-details-leave-active {
  transition: all 0.3s ease;
}

.streak-details-enter-from,
.streak-details-leave-to {
  opacity: 0;
  max-height: 0;
  margin-bottom: 0;
}

.streak-details-enter-to,
.streak-details-leave-from {
  opacity: 1;
  max-height: 200px;
}
</style>
