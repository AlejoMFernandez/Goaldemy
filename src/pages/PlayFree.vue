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
  <section class="py-4 md:py-6 mx-auto max-w-4xl">
  <h1 class="text-2xl md:text-4xl font-bold text-white mb-1">Jugar <span class="text-sky-400 uppercase">LIBRE</span></h1>
  <p class="text-slate-300 mb-4">Modo Free: jugá <strong class="text-slate-100 font-semibold">TODO LO QUE QUIERAS</strong>.</p>
    <div v-if="state.loading" class="text-slate-400">Cargando…</div>
  <div v-else class="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 gap-3">
      <RouterLink v-for="g in state.games" :key="g.slug" :to="toFree(g.slug)" class="rounded-xl overflow-hidden border border-white/10 bg-slate-900/40 hover:bg-white/5 transition shadow">
        <div class="relative p-2 sm:p-3 bg-slate-900/50">
          <img v-if="g.cover_url" :src="g.cover_url" :alt="g.name" class="w-full h-48 object-contain" />
          <div v-else class="w-full h-48 grid place-items-center bg-white/5 text-slate-400 text-sm">{{ g.name }}</div>
        </div>
        <div class="px-3 py-3 bg-slate-900/70 border-t border-white/10 text-center">
          <div class="text-white text-lg font-extrabold tracking-wide">JUGAR</div>
          <div class="text-slate-300 text-xs">{{ g.name }}</div>
        </div>
      </RouterLink>
    </div>
  </section>
</template>
