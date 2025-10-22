<script setup>
import { onMounted, reactive } from 'vue'
import { RouterLink } from 'vue-router'
import { fetchGames, gameRouteForSlug } from '../services/games'
import { isChallengeAvailable, fetchDailyWinStreak } from '../services/game-modes'

const state = reactive({ games: [], availability: {}, streaks: {}, loading: true })

async function load() {
  state.loading = true
  const all = await fetchGames()
  // Only include games with a route we support
  const list = (all || []).filter(g => !!g?.slug && gameRouteForSlug(g.slug) !== '/games')
  state.games = list
  // Check daily availability per game
  const entriesAv = await Promise.all(list.map(async g => [g.slug, await isChallengeAvailable(g.slug)]))
  state.availability = Object.fromEntries(entriesAv)
  // Fetch daily win streak per game (only relevant for games with result, but safe for all)
  const entriesSt = await Promise.all(list.map(async g => [g.slug, await fetchDailyWinStreak(g.slug)]))
  state.streaks = Object.fromEntries(entriesSt)
  state.loading = false
}

onMounted(load)

function cardClasses(slug) {
  const av = state.availability[slug]
  const disabled = av && av.available === false
  return [
    'relative card p-4 transition',
    disabled ? 'pointer-events-none select-none' : 'card-hover'
  ]
}

function toChallenge(slug) {
  return `${gameRouteForSlug(slug)}?mode=challenge`
}
</script>

<template>
  <section class="container mx-auto px-4 py-8">
  <h1 class="text-2xl md:text-4xl font-bold text-white mb-1">Jugar por <span class="text-emerald-400 uppercase">PUNTOS</span></h1>
  <p class="text-slate-300 mb-4">Modo por XP: jugá <strong class="text-slate-100 font-semibold">UNA VEZ POR DÍA</strong>.</p>

    <div v-if="state.loading" class="text-slate-400">Cargando…</div>
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      <RouterLink v-for="g in state.games" :key="g.slug" :to="toChallenge(g.slug)" :class="cardClasses(g.slug)">
        <!-- Mask overlay only dims/blurs the card content -->
  <div v-if="state.availability[g.slug] && state.availability[g.slug].available === false" class="absolute inset-0 z-10 rounded-xl bg-black/25 backdrop-blur-md pointer-events-none"></div>
        <!-- Result icon above the mask so it stays vivid -->
        <div v-if="state.availability[g.slug] && state.availability[g.slug].available === false" class="absolute inset-0 z-20 grid place-items-center pointer-events-none">
          <div v-if="state.availability[g.slug]?.result==='win'"
               class="h-12 w-12 rounded-full grid place-items-center shadow-xl ring-2 ring-emerald-400/50 bg-emerald-500/20">
            <div class="text-emerald-400 text-3xl font-extrabold">✓</div>
          </div>
          <div v-else-if="state.availability[g.slug]?.result==='loss'"
               class="h-12 w-12 rounded-full grid place-items-center shadow-xl ring-2 ring-red-400/50 bg-red-500/20">
            <div class="text-red-400 text-3xl font-extrabold">✕</div>
          </div>
          <div v-else
               class="h-12 w-12 rounded-full grid place-items-center shadow-xl ring-2 ring-slate-400/40 bg-white/10">
            <div class="text-slate-300 text-3xl font-extrabold">–</div>
          </div>
        </div>
        <!-- Daily win streak: flame chip at top-right ABOVE blur mask -->
        <div v-if="(state.streaks[g.slug] || 0) > 0" class="absolute top-2 right-2 z-20 pointer-events-none">
          <div class="inline-flex items-center gap-0.5 rounded-full px-2 py-1 ring-1 bg-orange-500/15 ring-orange-400/40 text-amber-200">
            <span class="leading-none">🔥</span>
            <span class="tabular-nums font-semibold text-sm leading-none">{{ state.streaks[g.slug] }}</span>
          </div>
        </div>
        <div class="rounded-lg overflow-hidden mb-2">
          <img v-if="g.cover_url" :src="g.cover_url" :alt="g.name" class="w-full h-36 object-cover" />
          <div v-else class="w-full h-36 grid place-items-center bg-white/5 text-slate-400 text-sm">{{ g.name }}</div>
        </div>
        <h3 class="text-white font-medium">{{ g.name }}</h3>
        <p class="text-slate-400 text-xs mt-2">{{ g.description || 'Desafío diario' }}</p>
        <!-- Centered played badge handled by overlay above -->
      </RouterLink>
    </div>
  </section>
</template>
