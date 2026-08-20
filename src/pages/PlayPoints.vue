<script setup>
import { onMounted, reactive, computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { fetchGames, gameRouteForSlug } from '../services/games'
import { isChallengeAvailable, fetchDailyWinStreak } from '../services/game-modes'
import { getGameUnlockLevel, isGameUnlocked } from '../services/level-rewards'
import { getUserLevel } from '../services/xp'
import { POWERUP_GAME_SLUGS } from '../services/powerups'
import DailyStreakCalendar from '../components/rewards/DailyStreakCalendar.vue'
import DailyResetCountdown from '../components/DailyResetCountdown.vue'
import AyudasPanel from '../components/game/AyudasPanel.vue'
import GameCard from '../components/game/GameCard.vue'
import { supabase } from '../services/supabase'

const AYUDA_SLUGS = new Set(POWERUP_GAME_SLUGS)
const streakOpen = ref(false)

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

const playedCount = computed(() => Object.values(state.availability).filter(a => a?.available === false).length)
</script>

<template>
  <section class="mx-auto max-w-5xl">
    <!-- HERO compacto: título + subtítulo + reinicio, en una sola barra fina -->
    <div class="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 px-4 py-3.5 md:px-5 md:py-4 mb-3">
      <div class="pointer-events-none absolute -top-16 -right-10 w-64 h-64 rounded-full opacity-25 blur-3xl" style="background: radial-gradient(circle, rgba(99,102,241,0.35), transparent 70%);"></div>

      <div class="relative flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div class="min-w-0">
          <span class="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 ring-1 ring-violet-400/25 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-300 mb-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse"></span>
            Modo Puntos · 1 partida por día
          </span>
          <h1 class="font-display text-xl md:text-2xl font-bold text-white leading-tight">
            Elegí tu <span class="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">desafío</span>
          </h1>
        </div>
        <DailyResetCountdown class="shrink-0"/>
      </div>
    </div>

    <!-- Cards informativas: lo importante de un vistazo -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
      <!-- Jugados hoy -->
      <div class="rounded-2xl border border-white/10 bg-slate-900/50 px-3.5 py-2.5">
        <div class="text-[10px] uppercase tracking-wider text-slate-500">Jugados hoy</div>
        <div class="mt-0.5 font-display text-2xl font-bold text-white tabular-nums leading-none">
          {{ playedCount }}<span class="text-slate-600 text-base font-bold">/{{ state.loading ? '—' : state.games.length }}</span>
        </div>
      </div>
      <!-- Ganados -->
      <div class="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] px-3.5 py-2.5">
        <div class="text-[10px] uppercase tracking-wider text-emerald-400/80">Ganados hoy</div>
        <div class="mt-0.5 flex items-center gap-1.5 leading-none">
          <span class="text-emerald-400 text-lg font-extrabold">✓</span>
          <span class="font-display text-2xl font-bold text-white tabular-nums">{{ totals.win }}</span>
        </div>
      </div>
      <!-- Perdidos -->
      <div class="rounded-2xl border border-red-500/20 bg-red-500/[0.06] px-3.5 py-2.5">
        <div class="text-[10px] uppercase tracking-wider text-red-400/80">Perdidos hoy</div>
        <div class="mt-0.5 flex items-center gap-1.5 leading-none">
          <span class="text-red-400 text-lg font-extrabold">✕</span>
          <span class="font-display text-2xl font-bold text-white tabular-nums">{{ totals.loss }}</span>
        </div>
      </div>
      <!-- Racha (abre el calendario) -->
      <button
        @click="streakOpen = !streakOpen"
        class="text-left rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] px-3.5 py-2.5 hover:border-amber-400/40 transition"
      >
        <div class="text-[10px] uppercase tracking-wider text-amber-400/80 flex items-center justify-between gap-1">
          Racha diaria
          <svg class="w-3.5 h-3.5 text-amber-400/70 transition-transform duration-300" :class="streakOpen ? 'rotate-180' : ''" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.24 4.5a.75.75 0 01-1.08 0l-4.24-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd"/></svg>
        </div>
        <div class="mt-0.5 flex items-center gap-1.5 leading-none">
          <svg class="w-4 h-4 text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.5)]" viewBox="0 0 24 24" fill="currentColor"><path d="M12 23c-3.6 0-8-3.1-8-8.5C4 9 8 4 11.5 1c.2-.1.4-.1.5 0 .2.1.2.3.1.5C11 4 14 6 14 6s1-1.5 1.5-4c0-.2.2-.3.4-.3s.3.1.4.3C18 5 20 9 20 14.5 20 19.9 15.6 23 12 23z"/></svg>
          <span class="font-display text-2xl font-bold text-white tabular-nums">{{ state.dailyStreak.current }}</span>
        </div>
      </button>
    </div>

    <!-- Calendario de racha: se despliega desde la card de Racha -->
    <div class="streak-panel" :class="{ open: streakOpen }">
      <DailyStreakCalendar
        class="mb-4"
        :currentStreak="state.dailyStreak.current"
        :bestStreak="state.dailyStreak.best"
        :playedToday="playedCount > 0"
      />
    </div>

    <div class="flex items-center gap-2 mb-3">
      <h2 class="font-display text-lg font-bold text-white">Todos los juegos</h2>
      <span v-if="!state.loading" class="rounded-full bg-white/5 ring-1 ring-white/10 px-2 py-0.5 text-xs font-semibold text-slate-300 tabular-nums">{{ state.games.length }}</span>
    </div>

    <div v-if="state.loading" class="flex flex-col items-center justify-center py-20 gap-4">
      <div class="h-10 w-10 rounded-full border-4 border-violet-400/30 border-t-violet-400 animate-spin"></div>
      <span class="text-slate-400 text-sm">Cargando juegos…</span>
    </div>
    <div v-else>
      <!-- Game cards -->
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 stagger-grid">
        <template v-for="g in state.games" :key="g.slug">
          <GameCard
            :game="g"
            :unlocked="isGameUnlocked(g.slug, state.userLevel)"
            :unlock-level="getGameUnlockLevel(g.slug)"
            :availability="state.availability[g.slug]"
            :streak="state.streaks[g.slug] || 0"
            :show-ayudas="AYUDA_SLUGS.has(g.slug)"
            :to="toChallenge(g.slug)"
          />
        </template>
      </div>

      <!-- Panel de ayudas: qué tenés y en qué juegos aplican (secundario, bajo los juegos) -->
      <AyudasPanel class="mt-6" />
    </div>
  </section>
</template>

<style scoped>
/* Racha diaria: se expande al pasar el mouse por el botón o al fijarla con click */
.streak-panel {
  max-height: 0;
  overflow: hidden;
  opacity: 0;
  transition: max-height 0.35s ease, opacity 0.25s ease, margin-top 0.25s ease;
}
.streak-panel.open {
  max-height: 520px;
  opacity: 1;
}

</style>
