<script>
export default {
  name: 'GameResultBanner',
  props: {
    show: { type: Boolean, default: false },
    won: { type: Boolean, required: true },
    stats: { type: Object, default: () => ({}) }
  },
  computed: {
    resultIcon() {
      return this.won ? '🎉' : '💔'
    },
    resultTitle() {
      return this.won ? '¡GANASTE!' : '¡Casi!'
    },
    resultSubtitle() {
      if (this.won) {
        return 'Excelente trabajo, seguí así'
      } else {
        return 'No te rindas, intentalo de nuevo mañana'
      }
    },
    bgClass() {
      return this.won 
        ? 'from-emerald-500/20 to-cyan-500/20 border-emerald-500/50' 
        : 'from-red-500/20 to-orange-500/20 border-red-500/50'
    },
    textClass() {
      return this.won ? 'text-emerald-400' : 'text-red-400'
    }
  }
}
</script>

<template>
  <Transition name="banner">
    <div v-if="show" class="fixed top-20 left-1/2 -translate-x-1/2 z-40 w-full max-w-md px-4">
      <div 
        class="rounded-2xl border-2 backdrop-blur-lg shadow-2xl p-6 bg-gradient-to-br"
        :class="bgClass"
      >
        <div class="text-center">
          <!-- Icon -->
          <div class="text-6xl mb-3 animate-bounce">{{ resultIcon }}</div>
          
          <!-- Title -->
          <h3 class="text-3xl font-extrabold mb-2" :class="textClass">
            {{ resultTitle }}
          </h3>
          
          <!-- Subtitle -->
          <p class="text-slate-200 text-lg mb-4">{{ resultSubtitle }}</p>
          
          <!-- Stats -->
          <div v-if="stats.correct !== undefined" class="flex justify-center gap-4 text-sm">
            <div class="flex items-center gap-1">
              <span class="text-slate-400">Aciertos:</span>
              <span class="font-bold text-white">{{ stats.correct }}</span>
            </div>
            <div v-if="stats.total" class="flex items-center gap-1">
              <span class="text-slate-400">de</span>
              <span class="font-bold text-white">{{ stats.total }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.banner-enter-active,
.banner-leave-active {
  transition: all 0.3s ease;
}

.banner-enter-from {
  opacity: 0;
  transform: translate(-50%, -20px) scale(0.9);
}

.banner-leave-to {
  opacity: 0;
  transform: translate(-50%, -20px) scale(0.9);
}
</style>
