<script>
import defaultImg from '../assets/goaldemy.png';

export default {
  name: 'Game',
  props: {
    game: {
      type: Object,
      required: true,
    }
  },
  emits: ['play'],
  computed: {
    cover() {
      return this.game.image || defaultImg;
    }
  },
  methods: {
    onPlay() {
      this.$emit('play', this.game);
    }
  }
}
</script>

<template>
  <article class="group relative rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden shadow-xl hover:shadow-2xl hover:border-white/20 transition-all duration-300 h-full flex flex-col">
    <!-- Glow effect on hover -->
    <div class="absolute inset-0 bg-gradient-to-br from-emerald-500/0 to-cyan-500/0 group-hover:from-emerald-500/5 group-hover:to-cyan-500/5 transition-all duration-300 pointer-events-none"></div>
    
    <!-- Image container with overlay -->
    <div class="relative h-44 bg-gradient-to-br from-slate-800 to-slate-900 overflow-hidden flex items-center justify-center">
      <img :src="cover" :alt="game.name" class="w-full h-full object-contain p-6 group-hover:scale-105 transition-transform duration-300" />
      <!-- Subtle gradient overlay -->
      <div class="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent opacity-60"></div>
    </div>
    
    <!-- Content -->
    <div class="relative flex flex-col flex-1 p-5">
      <!-- Title with icon -->
      <div class="flex items-start gap-2 mb-2">
        <div class="shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 flex items-center justify-center">
          <span class="text-lg">⚽</span>
        </div>
        <h3 class="text-lg font-bold text-white leading-tight flex-1">{{ game.name }}</h3>
      </div>
      
      <!-- Description -->
      <p class="text-sm text-slate-400 line-clamp-3 flex-1 mb-4">{{ game.description }}</p>
      
      <!-- Action button -->
      <button 
        @click="onPlay" 
        class="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110 text-white py-3 px-4 font-bold transition-all duration-200 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
      >
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>Jugar ahora</span>
      </button>
    </div>
  </article>
</template>

<style scoped>
/* Fallback if tailwind line-clamp not present */
.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  line-clamp: 3;
  overflow: hidden;
}
</style>
