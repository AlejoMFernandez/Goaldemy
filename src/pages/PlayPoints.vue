<script setup>
import { onMounted, reactive, computed } from 'vue'
import { RouterLink } from 'vue-router'
import { fetchGames, gameRouteForSlug } from '../services/games'
import { isChallengeAvailable, fetchDailyWinStreak } from '../services/game-modes'
import DailyStreakBanner from '../components/DailyStreakBanner.vue'
import DailyResetCountdown from '../components/DailyResetCountdown.vue'
import { supabase } from '../services/supabase'

const state = reactive({ 
  games: [], 
  availability: {}, 
  streaks: {}, 
  loading: true,
  dailyStreak: { current: 0, best: 0 }
})

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
  
  // Fetch daily login streak
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data } = await supabase
      .from('user_profiles')
      .select('daily_streak, best_daily_streak')
      .eq('id', user.id)
      .single()
    if (data) {
      state.dailyStreak.current = data.daily_streak || 0
      state.dailyStreak.best = data.best_daily_streak || 0
    }
  }
  
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
  <section class="mx-auto max-w-4xl">
    <div class="flex items-start justify-between gap-3 mb-4">
      <div>
        <h1 class="text-2xl md:text-4xl font-bold text-white mb-1">Jugar por <span class="text-emerald-400 uppercase">PUNTOS</span></h1>
        <p class="text-slate-300">Modo por XP: jugá <strong class="text-slate-100 font-semibold">UNA VEZ POR DÍA</strong>.</p>
      </div>
      <!-- Right-side mini card with totals and countdown -->
      <div class="shrink-0 hidden sm:flex sm:flex-col sm:gap-2 sm:items-end">
        <DailyResetCountdown />
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

    <!-- Daily Streak Banner -->
    <DailyStreakBanner 
      v-if="state.dailyStreak.current > 0"
      :currentStreak="state.dailyStreak.current"
      :bestStreak="state.dailyStreak.best"
      class="mb-6"
    />

  <div v-if="state.loading" class="text-slate-400">Cargando…</div>
  <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 gap-4">
      <RouterLink 
        v-for="g in state.games" 
        :key="g.slug" 
        :to="toChallenge(g.slug)" 
        class="group relative rounded-2xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 hover:shadow-2xl transition-all duration-300"
        :class="[
          state.availability[g.slug]?.available === false && state.availability[g.slug]?.result === 'win' 
            ? 'border-2 border-emerald-500/60 shadow-lg shadow-emerald-500/20' 
            : state.availability[g.slug]?.available === false && state.availability[g.slug]?.result === 'loss'
            ? 'border-2 border-red-500/60 shadow-lg shadow-red-500/20'
            : 'border border-white/10 hover:border-white/20 shadow-xl'
        ]"
      >
        <!-- Glow effect on hover -->
        <div class="absolute inset-0 bg-gradient-to-br from-emerald-500/0 to-cyan-500/0 group-hover:from-emerald-500/5 group-hover:to-cyan-500/5 transition-all duration-300 pointer-events-none"></div>
        
        <!-- Image box -->
        <div class="relative p-3 bg-gradient-to-br from-slate-800 to-slate-900 grid place-items-center min-h-[180px]">
          <img 
            v-if="g.cover_url" 
            :src="g.cover_url" 
            :alt="g.name" 
            class="h-36 object-contain group-hover:scale-105 transition-transform duration-300" 
            style="width: 85px;"
          />
          <div v-else class="w-full h-36 grid place-items-center bg-white/5 text-slate-400 text-sm">{{ g.name }}</div>
          
          <!-- Gradient overlay -->
          <div class="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent opacity-40"></div>
          
          <!-- Blur/dim mask only over the image when already played -->
          <div v-if="state.availability[g.slug] && state.availability[g.slug].available === false" class="mask-dim"></div>
          
          <!-- Result icon centered over image -->
          <div v-if="state.availability[g.slug] && state.availability[g.slug].available === false" class="absolute inset-0 z-20 grid place-items-center pointer-events-none">
            <div v-if="state.availability[g.slug]?.result==='win'" class="h-14 w-14 rounded-full grid place-items-center ring-2 ring-emerald-400/50 bg-emerald-500/20 backdrop-blur-sm shadow-lg">
              <div class="text-emerald-400 text-3xl font-extrabold">✓</div>
            </div>
            <div v-else-if="state.availability[g.slug]?.result==='loss'" class="h-14 w-14 rounded-full grid place-items-center ring-2 ring-red-400/50 bg-red-500/20 backdrop-blur-sm shadow-lg">
              <div class="text-red-400 text-3xl font-extrabold">✕</div>
            </div>
          </div>
          
          <!-- Streak chip on top-right -->
          <div v-if="(state.streaks[g.slug] || 0) > 0" class="absolute top-2 right-2 z-20 pointer-events-none">
            <div class="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 ring-1 bg-gradient-to-br from-orange-500/20 to-amber-500/20 ring-orange-400/50 text-amber-200 shadow-lg backdrop-blur-sm">
              <span class="leading-none text-base">🔥</span>
              <span class="tabular-nums font-bold text-sm leading-none">{{ state.streaks[g.slug] }}</span>
            </div>
          </div>
        </div>
        
        <!-- Bottom bar with gradient -->
        <div class="relative px-3 py-3 bg-gradient-to-br from-slate-900/90 to-slate-800/90 border-t border-white/10 text-center backdrop-blur-sm">
          <div class="text-white text-base font-extrabold tracking-wide mb-0.5">JUGAR</div>
          <div class="text-slate-300 text-xs font-medium">{{ g.name }}</div>
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
