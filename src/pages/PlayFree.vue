<script setup>
import { onMounted, reactive } from 'vue'
import { RouterLink } from 'vue-router'
import { fetchGames, gameRouteForSlug } from '../services/games'

const state = reactive({ games: [], loading: true })

async function load() {
  state.loading = true
  try {
    const all = await fetchGames()
    state.games = (all || []).filter(g => !!g?.slug && gameRouteForSlug(g.slug) !== '/games')
  } catch (e) {
    console.error('PlayFree load error:', e)
  } finally {
    state.loading = false
  }
}
onMounted(load)

function toFree(slug) {
  return `${gameRouteForSlug(slug)}?mode=free`
}

</script>

<template>
  <section class="mx-auto max-w-4xl">
    <h1 class="text-2xl md:text-4xl font-bold text-white mb-1">Jugar <span class="text-sky-400 uppercase">LIBRE</span></h1>
    <p class="text-slate-300 mb-6">Modo Free: jugá <strong class="text-slate-100 font-semibold">TODO LO QUE QUIERAS</strong>.</p>
    <div v-if="state.loading" class="flex flex-col items-center justify-center py-20 gap-4">
      <div class="h-10 w-10 rounded-full border-4 border-sky-400/30 border-t-sky-400 animate-spin"></div>
      <span class="text-slate-400 text-sm">Cargando juegos…</span>
    </div>
    <div v-else>
      <!-- Game cards -->
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 stagger-grid">
        <RouterLink
          v-for="g in state.games"
          :key="g.slug"
          :to="toFree(g.slug)"
          class="group relative flex flex-col rounded-2xl overflow-hidden border border-white/10 bg-gradient-to-b from-slate-800/80 to-slate-900 transition-all duration-300 hover:border-cyan-400/30 hover:shadow-[0_10px_34px_rgba(34,211,238,0.18)] hover:-translate-y-1 hover:scale-[1.02] active:scale-[0.98]"
        >
          <!-- Brand accent line -->
          <div class="absolute top-0 inset-x-0 h-0.5 z-20 bg-gradient-to-r from-cyan-400/70 via-emerald-400/70 to-transparent opacity-50 group-hover:opacity-100 transition-opacity duration-300"></div>

          <!-- Cover image area -->
          <div class="relative flex items-center justify-center h-36 bg-slate-800/60 overflow-hidden">
            <!-- Hover brand glow -->
            <div class="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style="background: radial-gradient(60% 60% at 50% 42%, rgba(34,211,238,0.20), transparent 70%);"></div>
            <img
              v-if="g.cover_url"
              :src="g.cover_url"
              :alt="g.name"
              class="relative w-24 h-24 object-contain opacity-90 transition-transform duration-300 group-hover:scale-110"
            />
          </div>
          <!-- Footer -->
          <div class="bg-slate-900/90 px-3 py-3 border-t border-white/5 text-center">
            <div class="font-display font-bold text-white text-xs tracking-widest uppercase group-hover:text-cyan-300 transition-colors">JUGAR</div>
            <div class="text-slate-400 text-xs mt-0.5 truncate">{{ g.name }}</div>
          </div>
        </RouterLink>
      </div>
    </div>
  </section>
</template>


