<script setup>
import { onMounted, reactive, computed } from 'vue'
import { RouterLink } from 'vue-router'
import { fetchGames, gameRouteForSlug } from '../services/games'
import { isChallengeAvailable, fetchDailyWinStreak } from '../services/game-modes'
import DailyStreakCalendar from '../components/rewards/DailyStreakCalendar.vue'
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
  const list = (all || []).filter(g => !!g?.slug && gameRouteForSlug(g.slug) !== '/games')
  state.games = list
  const entriesAv = await Promise.all(list.map(async g => [g.slug, await isChallengeAvailable(g.slug)]))
  state.availability = Object.fromEntries(entriesAv)
  const entriesSt = await Promise.all(list.map(async g => [g.slug, await fetchDailyWinStreak(g.slug)]))
  state.streaks = Object.fromEntries(entriesSt)
  
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

function toChallenge(slug) {
  const av = state.availability[slug]
  if (av && av.available === false) return `${gameRouteForSlug(slug)}?mode=review`
  return `${gameRouteForSlug(slug)}?mode=challenge`
}

const totals = computed(() => {
  const vals = Object.values(state.availability || {})
  let win = 0, loss = 0
  for (const av of vals) {
    if (!av || av.available !== false) continue
    if (av.result === 'win') win++
    else if (av.result === 'loss') loss++
  }
  return { win, loss }
})

const GAME_META = {
  'guess-player':    { topBar: 'bg-emerald-400/50', iconBg: 'bg-emerald-400/10 ring-1 ring-emerald-400/20', iconColor: 'text-emerald-400', hoverBorder: 'hover:border-emerald-400/25',
    paths: ['M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z'] },
  'who-is':          { topBar: 'bg-violet-400/50', iconBg: 'bg-violet-400/10 ring-1 ring-violet-400/20', iconColor: 'text-violet-400', hoverBorder: 'hover:border-violet-400/25',
    paths: ['M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z', 'M15 12a3 3 0 11-6 0 3 3 0 016 0z'] },
  'nationality':     { topBar: 'bg-cyan-400/50', iconBg: 'bg-cyan-400/10 ring-1 ring-cyan-400/20', iconColor: 'text-cyan-400', hoverBorder: 'hover:border-cyan-400/25',
    paths: ['M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418'] },
  'player-position': { topBar: 'bg-sky-400/50', iconBg: 'bg-sky-400/10 ring-1 ring-sky-400/20', iconColor: 'text-sky-400', hoverBorder: 'hover:border-sky-400/25',
    paths: ['M15 10.5a3 3 0 11-6 0 3 3 0 016 0z', 'M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z'] },
  'value-order':     { topBar: 'bg-amber-400/50', iconBg: 'bg-amber-400/10 ring-1 ring-amber-400/20', iconColor: 'text-amber-400', hoverBorder: 'hover:border-amber-400/25',
    paths: ['M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z'] },
  'age-order':       { topBar: 'bg-rose-400/50', iconBg: 'bg-rose-400/10 ring-1 ring-rose-400/20', iconColor: 'text-rose-400', hoverBorder: 'hover:border-rose-400/25',
    paths: ['M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z'] },
  'height-order':    { topBar: 'bg-teal-400/50', iconBg: 'bg-teal-400/10 ring-1 ring-teal-400/20', iconColor: 'text-teal-400', hoverBorder: 'hover:border-teal-400/25',
    paths: ['M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5'] },
  'shirt-number':    { topBar: 'bg-indigo-400/50', iconBg: 'bg-indigo-400/10 ring-1 ring-indigo-400/20', iconColor: 'text-indigo-400', hoverBorder: 'hover:border-indigo-400/25',
    paths: ['M5.25 8.25h15m-16.5 7.5h15m-1.8-13.5l-3.9 19.5m-2.1-19.5l-3.9 19.5'] },
  'once-ideal':      { topBar: 'bg-orange-400/50', iconBg: 'bg-orange-400/10 ring-1 ring-orange-400/20', iconColor: 'text-orange-400', hoverBorder: 'hover:border-orange-400/25',
    paths: ['M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z'] },
}

</script>

<template>
  <section class="mx-auto max-w-4xl">
    <div class="flex items-start justify-between gap-3 mb-4">
      <div>
        <h1 class="font-display text-2xl md:text-4xl font-extrabold text-white mb-1">Jugar por <span class="text-emerald-400 uppercase">PUNTOS</span></h1>
        <p class="text-slate-300">Modo por XP: jugá <strong class="text-slate-100 font-semibold">UNA VEZ POR DÍA</strong>.</p>
        <DailyResetCountdown class="my-4"/>
      </div>
      <div class="shrink-0 hidden sm:flex sm:flex-col sm:gap-2 sm:items-end">
        <div class="rounded-xl bg-slate-900/60 border border-white/15 px-3 py-2 text-slate-200">
          <div class="flex items-end gap-3">
            <div class="flex flex-col items-center gap-1" title="✓ Ganados hoy">
              <div class="h-9 w-9 rounded-full grid place-items-center shadow-xl ring-2 ring-emerald-400/50 bg-emerald-500/20">
                <div class="text-emerald-400 text-2xl font-extrabold leading-none">✓</div>
              </div>
              <div class="text-m tabular-nums text-slate-100 font-semibold">{{ totals.win }}</div>
            </div>
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

    <DailyStreakCalendar
      :currentStreak="state.dailyStreak.current"
      :bestStreak="state.dailyStreak.best"
      :playedToday="Object.values(state.availability).some(a => a?.available === false)"
      class="mb-4"
    />

    <div v-if="state.loading" class="text-slate-400">Cargando…</div>
    <div v-else>
      <!-- Game cards -->
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 stagger-grid">
        <RouterLink
          v-for="g in state.games"
          :key="g.slug"
          :to="toChallenge(g.slug)"
          class="group relative flex flex-col rounded-2xl overflow-hidden border border-white/10 bg-gradient-to-b from-slate-800/80 to-slate-900 transition-all duration-300 hover:shadow-xl hover:shadow-white/5 hover:-translate-y-1 hover:scale-[1.02] active:scale-[0.98]"
          :class="[
            state.availability[g.slug]?.result === 'win'
              ? 'border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
              : state.availability[g.slug]?.result === 'loss'
              ? 'border-red-500/40 shadow-[0_0_20px_rgba(239,68,68,0.15)]'
              : 'hover:border-white/20'
          ]"
        >
          <!-- Cover image area -->
          <div class="relative flex items-center justify-center h-36 bg-slate-800/60">
            <!-- Win/Loss overlay -->
            <div
              v-if="state.availability[g.slug]?.available === false"
              class="absolute inset-0 flex items-center justify-center bg-black/50 z-10"
            >
              <div
                v-if="state.availability[g.slug]?.result === 'win'"
                class="w-14 h-14 rounded-full flex items-center justify-center ring-2 ring-emerald-400/70 bg-emerald-500/30"
              >
                <span class="text-emerald-400 text-3xl font-extrabold leading-none">✓</span>
              </div>
              <div
                v-else
                class="w-14 h-14 rounded-full flex items-center justify-center ring-2 ring-red-400/70 bg-red-500/30"
              >
                <span class="text-red-400 text-3xl font-extrabold leading-none">✕</span>
              </div>
            </div>
            <!-- Game cover image -->
            <img
              v-if="g.cover_url"
              :src="g.cover_url"
              :alt="g.name"
              class="w-24 h-24 object-contain transition-transform duration-300 group-hover:scale-110"
              :class="state.availability[g.slug]?.available === false ? 'opacity-30' : 'opacity-90'"
            />
            <!-- Streak chip -->
            <div v-if="(state.streaks[g.slug] || 0) > 0" class="absolute top-2.5 right-2.5 z-20 flex items-center gap-1 rounded-full bg-slate-900/90 ring-1 ring-white/10 px-2 py-0.5">
              <span class="text-[11px] leading-none">🔥</span>
              <span class="text-amber-300 font-bold text-[11px] leading-none tabular-nums">{{ state.streaks[g.slug] }}</span>
            </div>
          </div>
          <!-- Footer -->
          <div class="bg-slate-900/90 px-3 py-3 border-t border-white/5 text-center">
            <div class="font-display font-bold text-white text-xs tracking-widest uppercase">JUGAR</div>
            <div class="text-slate-400 text-xs mt-0.5 truncate">{{ g.name }}</div>
          </div>
        </RouterLink>
      </div>
    </div>
  </section>
</template>

<style scoped>
.backdrop-grayscale {
  -webkit-backdrop-filter: saturate(0) brightness(0.75);
  backdrop-filter: saturate(0) brightness(0.75);
}
</style>


