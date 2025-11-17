<script setup>
import { onMounted, reactive } from 'vue'
import { RouterLink } from 'vue-router'
import { fetchGames, gameRouteForSlug } from '../services/games'

const state = reactive({ games: [], loading: true })

async function load() {
  state.loading = true
  const all = await fetchGames()
  state.games = (all || []).filter(g => !!g?.slug && gameRouteForSlug(g.slug) !== '/games')
  state.loading = false
}
onMounted(load)

function toFree(slug) {
  return `${gameRouteForSlug(slug)}?mode=free`
}
</script>

<template>
  <section class="mx-auto max-w-4xl">
  <h1 class="text-2xl md:text-4xl font-bold text-white mb-1">Jugar <span class="text-sky-400 uppercase">LIBRE</span></h1>
  <p class="text-slate-300 mb-4">Modo Free: jugá <strong class="text-slate-100 font-semibold">TODO LO QUE QUIERAS</strong>.</p>
    <div v-if="state.loading" class="text-slate-400">Cargando…</div>
  <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 gap-4">
      <RouterLink 
        v-for="g in state.games" 
        :key="g.slug" 
        :to="toFree(g.slug)" 
        class="group relative rounded-2xl overflow-hidden border border-white/10 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 hover:border-white/20 shadow-xl hover:shadow-2xl transition-all duration-300"
      >
        <!-- Glow effect on hover -->
        <div class="absolute inset-0 bg-gradient-to-br from-sky-500/0 to-cyan-500/0 group-hover:from-sky-500/5 group-hover:to-cyan-500/5 transition-all duration-300 pointer-events-none"></div>
        
        <!-- Image box -->
        <div class="relative p-3 bg-gradient-to-br from-slate-800 to-slate-900 grid place-items-center min-h-[180px]">
          <img 
            v-if="g.cover_url" 
            :src="g.cover_url" 
            :alt="g.name" 
            class="w-full h-36 object-contain group-hover:scale-105 transition-transform duration-300" 
          />
          <div v-else class="w-full h-36 grid place-items-center bg-white/5 text-slate-400 text-sm">{{ g.name }}</div>
          
          <!-- Gradient overlay -->
          <div class="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent opacity-40"></div>
        </div>
        
        <!-- Bottom bar with gradient -->
        <div class="relative px-3 py-3 bg-gradient-to-br from-slate-900/90 to-slate-800/90 border-t border-white/10 text-center backdrop-blur-sm">
          <div class="text-white text-base font-extrabold tracking-wide mb-0.5 flex items-center justify-center gap-2">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>JUGAR</span>
          </div>
          <div class="text-slate-300 text-xs font-medium">{{ g.name }}</div>
        </div>
      </RouterLink>
    </div>
  </section>
</template>
