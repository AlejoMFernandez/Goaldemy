<script setup>
import { onMounted, reactive, computed } from 'vue'
import { RouterLink } from 'vue-router'
import { fetchGames, gameRouteForSlug } from '../services/games'
import { isChallengeAvailable, fetchDailyWinStreak } from '../services/game-modes'
import { getGameUnlockLevel, isGameUnlocked } from '../services/level-rewards'
import { getUserLevel } from '../services/xp'
import DailyStreakCalendar from '../components/rewards/DailyStreakCalendar.vue'
import DailyResetCountdown from '../components/DailyResetCountdown.vue'
import { supabase } from '../services/supabase'

const state = reactive({
  games: [],
  availability: {},
  streaks: {},
  loading: true,
  dailyStreak: { current: 0, best: 0 },
  userLevel: 1,
})

async function load() {
  state.loading = true
  try {
    const all = await fetchGames()
    const list = (all || []).filter(g => !!g?.slug && gameRouteForSlug(g.slug) !== '/games')
    state.games = list
    const entriesAv = await Promise.all(list.map(async g => [g.slug, await isChallengeAvailable(g.slug)]))
    state.availability = Object.fromEntries(entriesAv)
    const entriesSt = await Promise.all(list.map(async g => [g.slug, await fetchDailyWinStreak(g.slug)]))
    state.streaks = Object.fromEntries(entriesSt)

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const [profileRes, levelRes] = await Promise.all([
        supabase.from('user_profiles').select('daily_streak, best_daily_streak').eq('id', user.id).single(),
        getUserLevel(null),
      ])
      if (profileRes.data) {
        state.dailyStreak.current = profileRes.data.daily_streak || 0
        state.dailyStreak.best = profileRes.data.best_daily_streak || 0
      }
      const lvlInfo = Array.isArray(levelRes.data) ? levelRes.data[0] : levelRes.data
      state.userLevel = Number(lvlInfo?.level) || 1
    }
  } catch (e) {
    console.error('PlayPoints load error:', e)
  } finally {
    state.loading = false
  }
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

    <div v-if="state.loading" class="flex flex-col items-center justify-center py-20 gap-4">
      <div class="h-10 w-10 rounded-full border-4 border-emerald-400/30 border-t-emerald-400 animate-spin"></div>
      <span class="text-slate-400 text-sm">Cargando juegos…</span>
    </div>
    <div v-else>
      <!-- Game cards -->
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 stagger-grid">
        <template v-for="g in state.games" :key="g.slug">
          <!-- Locked game -->
          <div
            v-if="!isGameUnlocked(g.slug, state.userLevel)"
            class="relative flex flex-col rounded-2xl overflow-hidden border border-white/5 bg-gradient-to-b from-slate-800/40 to-slate-900/60 opacity-60 cursor-not-allowed select-none"
          >
            <div class="relative flex items-center justify-center h-36 bg-slate-800/40">
              <img
                v-if="g.cover_url"
                :src="g.cover_url"
                :alt="g.name"
                class="w-24 h-24 object-contain opacity-20 grayscale"
              />
              <div class="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/40">
                <svg class="w-10 h-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                <span class="text-[10px] text-slate-400 font-semibold text-center px-2 leading-tight">
                  Nivel {{ getGameUnlockLevel(g.slug) }}
                </span>
              </div>
            </div>
            <div class="bg-slate-900/90 px-3 py-3 border-t border-white/5 text-center">
              <div class="font-display font-bold text-slate-500 text-xs tracking-widest uppercase">BLOQUEADO</div>
              <div class="text-slate-500 text-xs mt-0.5 truncate">{{ g.name }}</div>
            </div>
          </div>

          <!-- Unlocked game -->
          <RouterLink
            v-else
            :to="toChallenge(g.slug)"
            class="group relative flex flex-col rounded-2xl overflow-hidden border border-white/10 bg-gradient-to-b from-slate-800/80 to-slate-900 transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] active:scale-[0.98]"
            :class="[
              state.availability[g.slug]?.result === 'win'
                ? 'border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                : state.availability[g.slug]?.result === 'loss'
                ? 'border-red-500/40 shadow-[0_0_20px_rgba(239,68,68,0.15)]'
                : 'hover:border-emerald-400/30 hover:shadow-[0_10px_34px_rgba(16,185,129,0.18)]'
            ]"
          >
            <!-- Brand accent line -->
            <div class="absolute top-0 inset-x-0 h-0.5 z-20 bg-gradient-to-r from-emerald-400/70 via-cyan-400/70 to-transparent opacity-50 group-hover:opacity-100 transition-opacity duration-300"></div>

            <div class="relative flex items-center justify-center h-36 bg-slate-800/60 overflow-hidden">
              <!-- Hover brand glow -->
              <div class="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style="background: radial-gradient(60% 60% at 50% 42%, rgba(16,185,129,0.20), transparent 70%);"></div>
              <div
                v-if="state.availability[g.slug]?.available === false"
                class="absolute inset-0 flex items-center justify-center bg-black/50 z-10"
              >
                <div
                  v-if="state.availability[g.slug]?.result === 'win'"
                  class="w-14 h-14 rounded-2xl flex items-center justify-center ring-1 ring-emerald-400/40 bg-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                >
                  <span class="text-emerald-400 text-3xl font-extrabold leading-none">✓</span>
                </div>
                <div
                  v-else
                  class="w-14 h-14 rounded-2xl flex items-center justify-center ring-1 ring-red-400/40 bg-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.3)]"
                >
                  <span class="text-red-400 text-3xl font-extrabold leading-none">✕</span>
                </div>
              </div>
              <img
                v-if="g.cover_url"
                :src="g.cover_url"
                :alt="g.name"
                class="relative w-24 h-24 object-contain transition-transform duration-300 group-hover:scale-110"
                :class="state.availability[g.slug]?.available === false ? 'opacity-30' : 'opacity-90'"
              />
              <div v-if="(state.streaks[g.slug] || 0) > 0" class="absolute top-2.5 right-2.5 z-20 flex items-center gap-1 rounded-full bg-slate-900/90 ring-1 ring-amber-400/30 shadow-[0_0_12px_rgba(251,191,36,0.25)] px-2 py-0.5">
                <svg class="w-3 h-3 text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.5)]" viewBox="0 0 24 24" fill="currentColor"><path d="M12 23c-3.6 0-8-3.1-8-8.5C4 9 8 4 11.5 1c.2-.1.4-.1.5 0 .2.1.2.3.1.5C11 4 14 6 14 6s1-1.5 1.5-4c0-.2.2-.3.4-.3s.3.1.4.3C18 5 20 9 20 14.5 20 19.9 15.6 23 12 23z"/></svg>
                <span class="text-amber-300 font-bold text-[11px] leading-none tabular-nums">{{ state.streaks[g.slug] }}</span>
              </div>
            </div>
            <div class="bg-slate-900/90 px-3 py-3 border-t border-white/5 text-center">
              <div class="font-display font-bold text-white text-xs tracking-widest uppercase group-hover:text-emerald-300 transition-colors">JUGAR</div>
              <div class="text-slate-400 text-xs mt-0.5 truncate">{{ g.name }}</div>
            </div>
          </RouterLink>
        </template>
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


