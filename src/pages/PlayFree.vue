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
  <section class="container mx-auto px-4 py-8">
  <h1 class="text-2xl md:text-4xl font-bold text-white mb-1">Jugar <span class="text-sky-400 uppercase">LIBRE</span></h1>
  <p class="text-slate-300 mb-4">Modo Free: jugá <strong class="text-slate-100 font-semibold">TODO LO QUE QUIERAS</strong>.</p>
    <div v-if="state.loading" class="text-slate-400">Cargando…</div>
  <div v-else class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      <RouterLink v-for="g in state.games" :key="g.slug" :to="toFree(g.slug)" class="card card-hover p-4">
        <div class="rounded-lg overflow-hidden mb-2">
          <img v-if="g.cover_url" :src="g.cover_url" :alt="g.name" class="w-full h-36 object-cover" />
          <div v-else class="w-full h-36 grid place-items-center bg-white/5 text-slate-400 text-sm">{{ g.name }}</div>
        </div>
        <h3 class="text-white font-medium">{{ g.name }}</h3>
        <p class="text-slate-400 text-xs mt-2">{{ g.description || 'Modo libre' }}</p>
      </RouterLink>
    </div>
  </section>
</template>
