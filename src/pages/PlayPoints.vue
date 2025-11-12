<script setup>
import { onMounted, reactive, computed } from 'vue'
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
    disabled ? 'card-hover' : 'card-hover'
  ]
}

function toChallenge(slug) {
  const av = state.availability[slug]
  if (av && av.available === false) {
    return `${gameRouteForSlug(slug)}?mode=review`
  }
  return `${gameRouteForSlug(slug)}?mode=challenge`
}

// Totals for today's statuses (wins, losses) based on availability/result
const totals = computed(() => {
  const vals = Object.values(state.availability || {})
  let win = 0, loss = 0
  for (const av of vals) {
    if (!av || av.available !== false) continue // count only games ya jugados hoy
    if (av.result === 'win') win++
    else if (av.result === 'loss') loss++
  }
  return { win, loss }
})
</script>

<template>
  <section class="container mx-auto px-4 py-4 md:py-8">
    <div class="flex items-start justify-between gap-3 mb-4">
      <div>
        <h1 class="text-2xl md:text-4xl font-bold text-white mb-1">Jugar por <span class="text-emerald-400 uppercase">PUNTOS</span></h1>
        <p class="text-slate-300">Modo por XP: jugá <strong class="text-slate-100 font-semibold">UNA VEZ POR DÍA</strong>.</p>
      </div>
      <!-- Right-side mini card with totals -->
      <div class="shrink-0 hidden sm:block">
        <div class="rounded-xl bg-slate-900/60 border border-white/15 px-3 py-2 text-slate-200">
          <div class="flex items-end gap-3">
            <!-- Wins -->
            <div class="flex flex-col items-center gap-1" title="✓ Ganados hoy">
              <div class="h-9 w-9 rounded-full grid place-items-center shadow-xl ring-2 ring-emerald-400/50 bg-emerald-500/20">
                <div class="text-emerald-400 text-2xl font-extrabold leading-none">✓</div>
              </div>
              <div class="text-m tabular-nums text-slate-100 font-semibold">{{ totals.win }}</div>
            </div>
            <!-- Losses -->
            <div class="flex flex-col items-center gap-1" title="✕ Perdidos hoy">
              <div class="h-9 w-9 rounded-full grid place-items-center shadow-xl ring-2 ring-red-400/50 bg-red-500/20">
                <div class="text-red-400 text-2xl font-extrabold leading-none">✕</div>
              </div>
              <div class="text-m tabular-nums text-slate-100 font-semibold">{{ totals.loss }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

  <div v-if="state.loading" class="text-slate-400">Cargando…</div>
  <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 gap-3">
      <RouterLink v-for="g in state.games" :key="g.slug" :to="toChallenge(g.slug)" class="rounded-xl overflow-hidden border border-white/10 bg-slate-900/40 hover:bg-white/5 transition shadow">
        <!-- Image box -->
        <div class="relative p-2 sm:p-3 bg-slate-900/50">
          <img v-if="g.cover_url" :src="g.cover_url" :alt="g.name" class="w-full h-48 object-contain" />
          <div v-else class="w-full h-48 grid place-items-center bg-white/5 text-slate-400 text-sm">{{ g.name }}</div>
          <!-- Blur/dim mask only over the image when already played -->
          <div v-if="state.availability[g.slug] && state.availability[g.slug].available === false" class="mask-dim"></div>
          <!-- Result icon centered over image -->
          <div v-if="state.availability[g.slug] && state.availability[g.slug].available === false" class="absolute inset-0 z-20 grid place-items-center pointer-events-none">
            <div v-if="state.availability[g.slug]?.result==='win'" class="h-12 w-12 rounded-full grid place-items-center ring-2 ring-emerald-400/50 bg-emerald-500/20">
              <div class="text-emerald-400 text-3xl font-extrabold">✓</div>
            </div>
            <div v-else-if="state.availability[g.slug]?.result==='loss'" class="h-12 w-12 rounded-full grid place-items-center ring-2 ring-red-400/50 bg-red-500/20">
              <div class="text-red-400 text-3xl font-extrabold">✕</div>
            </div>
          </div>
          <!-- Streak chip on top-right -->
          <div v-if="(state.streaks[g.slug] || 0) > 0" class="absolute top-2 right-2 z-20 pointer-events-none">
            <div class="inline-flex items-center gap-0.5 rounded-full px-2 py-1 ring-1 bg-orange-500/15 ring-orange-400/40 text-amber-200">
              <span class="leading-none">🔥</span>
              <span class="tabular-nums font-semibold text-sm leading-none">{{ state.streaks[g.slug] }}</span>
            </div>
          </div>
        </div>
        <!-- Bottom bar like Futbol11 -->
        <div class="px-3 py-3 bg-slate-900/70 border-t border-white/10 text-center">
          <div class="text-white text-lg font-extrabold tracking-wide">JUGAR</div>
          <div class="text-slate-300 text-xs">{{ g.name }}</div>
        </div>
      </RouterLink>
    </div>
  </section>
</template>

<style scoped>
/* Mask: remove colors and slightly darken with slight blur (applies over image box) */
.mask-dim { position: absolute; inset: 0; z-index: 10; pointer-events: none; }
.mask-dim::before {
  content: '';
  position: absolute; inset: 0; border-radius: inherit;
  -webkit-backdrop-filter: saturate(0) brightness(0.82);
  backdrop-filter: saturate(0) brightness(0.82) blur(1px);
}
</style>
