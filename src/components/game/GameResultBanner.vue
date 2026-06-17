<script>
export default {
  name: 'GameResultBanner',
  props: {
    show: { type: Boolean, default: false },
    won: { type: Boolean, required: true },
    stats: { type: Object, default: () => ({}) }
  },
  computed: {
    resultTitle() {
      return this.won ? '¡GANASTE!' : '¡Casi!'
    },
    resultSubtitle() {
      return this.won
        ? 'Excelente trabajo, seguí así'
        : 'No te rindas, intentalo de nuevo mañana'
    }
  }
}
</script>

<template>
  <Transition name="banner">
    <div v-if="show" class="fixed top-20 left-1/2 -translate-x-1/2 z-40 w-full max-w-sm px-4">
      <div
        class="flex items-center gap-4 rounded-2xl border backdrop-blur-lg shadow-2xl shadow-black/40 px-5 py-4 bg-gradient-to-r"
        :class="won
          ? 'from-emerald-500/15 to-cyan-500/10 border-emerald-500/30'
          : 'from-red-500/15 to-orange-500/10 border-red-500/30'"
      >
        <!-- Icon tile -->
        <div
          class="w-12 h-12 rounded-2xl grid place-items-center border shrink-0"
          :class="won ? 'bg-emerald-500/15 border-emerald-400/30' : 'bg-red-500/15 border-red-400/30'"
          style="animation: scale-spring 0.5s var(--ease-bounce) both"
        >
          <svg v-if="won" class="w-6 h-6 text-emerald-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M5 3h14l-1.5 5H20a1 1 0 011 1v1a5 5 0 01-3.5 4.77V16a1 1 0 01-1 1h-1.1l.6 3H8l.6-3H7.5a1 1 0 01-1-1v-1.23A5 5 0 013 10V9a1 1 0 011-1h2.5L5 3z"/>
          </svg>
          <svg v-else class="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
        </div>

        <!-- Text -->
        <div class="flex-1 min-w-0">
          <h3 class="font-display text-xl font-extrabold leading-tight" :class="won ? 'text-emerald-400' : 'text-red-400'">
            {{ resultTitle }}
          </h3>
          <p class="text-slate-400 text-xs mt-0.5">{{ resultSubtitle }}</p>
        </div>

        <!-- Stats -->
        <div v-if="stats.correct !== undefined" class="shrink-0 text-right">
          <div class="font-display text-2xl font-extrabold text-white leading-none">
            {{ stats.correct }}<span v-if="stats.total" class="text-slate-500 text-sm font-bold">/{{ stats.total }}</span>
          </div>
          <div class="text-[10px] uppercase tracking-wider text-slate-500 mt-1">aciertos</div>
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
