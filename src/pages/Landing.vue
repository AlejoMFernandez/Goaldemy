<script setup>
import { onMounted, reactive, computed } from 'vue'
import { RouterLink } from 'vue-router'
import { supabase } from '../services/supabase'
import { fetchGames, gameRouteForSlug } from '../services/games'
import { ACTIVE_LEAGUES, getTodayMatches, getUpcomingMatches } from '../services/fotmob'

const state = reactive({
  isAuthenticated: false,
  loading: true,
  featuredGames: [],
  loadingToday: false,
  todayByLeague: [],
  upcomingMatches: [],
})

const hasTodayMatches = computed(() => state.todayByLeague.some(l => l.matches.length > 0))

function formatKickoff(utcDate) {
  if (!utcDate) return ''
  try {
    return new Date(utcDate).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })
  } catch { return '' }
}

function matchStatusText(match) {
  const s = match.status
  if (!s) return ''
  if (s.finished) return 'FIN'
  if (s.started && s.liveTime?.short) return s.liveTime.short
  if (s.started) return 'EN VIVO'
  return formatKickoff(s.utcTime)
}

function isLive(match) {
  return match.status?.started && !match.status?.finished
}

async function loadTodayByLeague() {
  state.loadingToday = true
  try {
    const results = await Promise.allSettled(
      ACTIVE_LEAGUES.map(l => getTodayMatches(l.id).then(matches => ({ league: l, matches })))
    )
    state.todayByLeague = results
      .filter(r => r.status === 'fulfilled' && r.value.matches.length > 0)
      .map(r => r.value)

    if (!state.todayByLeague.length) {
      const upcoming = await getUpcomingMatches(ACTIVE_LEAGUES[0]?.id, 6).catch(() => [])
      state.upcomingMatches = upcoming
    }
  } catch (e) {
    console.warn('[Landing] today matches error', e)
    state.todayByLeague = []
  } finally {
    state.loadingToday = false
  }
}

async function load() {
  state.loading = true
  const { data: { user } } = await supabase.auth.getUser()
  state.isAuthenticated = !!user
  const allGames = await fetchGames()
  state.featuredGames = (allGames || [])
    .filter(g => !!g?.slug && gameRouteForSlug(g.slug) !== '/games')
    .slice(-4)
  state.loading = false
  loadTodayByLeague()
}

onMounted(load)

function getGameRoute(slug) {
  return `${gameRouteForSlug(slug)}?mode=challenge`
}
</script>

<template>
  <section class="relative min-h-screen overflow-hidden">
    <div aria-hidden="true" class="aurora-root">
      <div class="accent"></div>
    </div>

    <!-- Hero -->
    <div class="relative z-10 max-w-5xl mx-auto px-6 pt-10 pb-6">
      <template v-if="!state.isAuthenticated">
        <div class="text-center space-y-5">
          <div class="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-1.5 text-sm text-amber-300 font-medium slide-up">
            <span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            Copa del Mundo 2026 — EN VIVO
          </div>
          <h1 class="text-4xl sm:text-6xl font-extrabold text-white tracking-tight leading-[1.1]">
            Jugá. Aprendé. <span class="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">Dominá.</span>
          </h1>
          <p class="text-slate-400 max-w-lg mx-auto text-base leading-relaxed">
            Micro-desafíos de fútbol diarios — ganás XP, subís de rango y competís con el mundo.
          </p>
          <div class="flex flex-wrap gap-3 justify-center pt-2">
            <RouterLink to="/register" class="group rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-7 py-3 font-semibold text-white text-sm transition-all hover:shadow-lg hover:shadow-emerald-500/30 hover:scale-105 active:scale-95">
              Crear cuenta gratis
              <span class="inline-block ml-1 transition-transform group-hover:translate-x-0.5">→</span>
            </RouterLink>
            <RouterLink to="/login" class="rounded-xl border border-white/15 px-6 py-3 font-semibold text-slate-200 text-sm transition-all hover:border-white/25 hover:bg-white/5 active:scale-95">
              Iniciar sesión
            </RouterLink>
          </div>
        </div>
      </template>
      <template v-else>
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p class="text-slate-200 font-bold text-xl">Bienvenido de vuelta</p>
            <p class="text-slate-400 text-sm mt-0.5">¿Qué vas a jugar hoy?</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <RouterLink to="/play/points" class="group rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-5 py-2.5 font-semibold text-white text-sm transition-all hover:scale-105 hover:shadow-lg hover:shadow-emerald-500/30 active:scale-95">
              Desafíos del día
              <span class="inline-block ml-1 transition-transform group-hover:translate-x-0.5">→</span>
            </RouterLink>
            <RouterLink to="/play/free" class="rounded-xl border border-white/15 px-5 py-2.5 font-semibold text-slate-200 text-sm transition-all hover:border-white/25 hover:bg-white/5 active:scale-95">
              Modo libre
            </RouterLink>
            <RouterLink to="/leaderboards" class="rounded-xl border border-white/15 px-5 py-2.5 font-semibold text-slate-200 text-sm transition-all hover:border-white/25 hover:bg-white/5 active:scale-95">
              Ranking
            </RouterLink>
          </div>
        </div>
      </template>
    </div>

    <!-- World Cup Matches -->
    <div class="relative z-10 max-w-5xl mx-auto px-6 mb-10">
      <!-- Title -->
      <div class="flex items-center gap-3 mb-4">
        <div class="flex items-center gap-2">
          <span class="text-2xl">🏆</span>
          <h2 class="text-2xl font-bold text-white tracking-tight">Copa del Mundo 2026</h2>
        </div>
        <div class="flex-1 h-px bg-gradient-to-r from-amber-400/30 to-transparent"></div>
        <RouterLink to="/leagues/world-cup" class="text-xs text-amber-400 hover:text-amber-300 font-medium transition-colors">
          Ver todo →
        </RouterLink>
      </div>

      <!-- Loading skeleton -->
      <div v-if="state.loadingToday" class="space-y-2">
        <div v-for="i in 4" :key="i" class="h-14 rounded-xl bg-white/5 animate-pulse" :style="{ animationDelay: i * 0.1 + 's' }"></div>
      </div>

      <!-- Today's Matches -->
      <div v-else-if="hasTodayMatches" class="space-y-5">
        <div v-for="item in state.todayByLeague" :key="item.league.id">
          <div class="flex items-center gap-3 mb-2">
            <img
              :src="`https://images.fotmob.com/image_resources/logo/leaguelogo/${item.league.id}_xsmall.png`"
              class="w-5 h-5 object-contain flex-shrink-0"
              :alt="item.league.name"
              @error="$event.target.style.display='none'"
            />
            <span class="text-xs font-semibold uppercase tracking-wider text-slate-400">{{ item.league.name }}</span>
            <div class="flex-1 h-px bg-white/8"></div>
          </div>
          <div class="space-y-1.5">
            <div
              v-for="match in item.matches"
              :key="match.id"
              class="grid grid-cols-[1fr_80px_1fr_52px] items-center rounded-xl border px-4 py-3.5 transition-all duration-300"
              :class="isLive(match)
                ? 'border-emerald-500/30 bg-emerald-950/40 pulse-glow'
                : 'border-white/5 bg-slate-900/50 hover:bg-slate-800/60 hover:border-white/10'"
            >
              <div class="flex items-center justify-end gap-2.5 min-w-0">
                <span class="font-semibold text-sm text-white truncate text-right">{{ match.home?.name }}</span>
                <img
                  :src="`https://images.fotmob.com/image_resources/logo/teamlogo/${match.home?.id}_xsmall.png`"
                  class="w-7 h-7 object-contain flex-shrink-0"
                  :alt="match.home?.name"
                />
              </div>
              <div class="flex items-center justify-center">
                <span
                  class="font-bold tabular-nums px-2 py-0.5 rounded-lg"
                  :class="[
                    match.status?.finished ? 'text-sm text-slate-400 bg-slate-800/50' :
                    isLive(match) ? 'text-sm text-emerald-400 bg-emerald-500/15' :
                    'text-xs text-slate-400'
                  ]"
                >
                  {{ match.status?.scoreStr || matchStatusText(match) }}
                </span>
              </div>
              <div class="flex items-center gap-2.5 min-w-0">
                <img
                  :src="`https://images.fotmob.com/image_resources/logo/teamlogo/${match.away?.id}_xsmall.png`"
                  class="w-7 h-7 object-contain flex-shrink-0"
                  :alt="match.away?.name"
                />
                <span class="font-semibold text-sm text-white truncate">{{ match.away?.name }}</span>
              </div>
              <div class="flex items-center justify-end">
                <span v-if="isLive(match)" class="inline-flex items-center gap-1.5 text-[9px] font-bold tracking-widest text-emerald-400 uppercase">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  VIVO
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Upcoming matches fallback -->
      <div v-else-if="state.upcomingMatches.length" class="space-y-1.5">
        <p class="text-slate-400 text-sm mb-3">Próximos partidos</p>
        <div
          v-for="match in state.upcomingMatches"
          :key="match.id"
          class="grid grid-cols-[1fr_auto_1fr] items-center rounded-xl border border-white/5 bg-slate-900/50 hover:bg-slate-800/60 px-4 py-3 transition-all"
        >
          <div class="text-right text-sm font-semibold text-white truncate">{{ match.homeTeam }}</div>
          <div class="px-4 text-xs text-slate-400 tabular-nums whitespace-nowrap">
            {{ new Date(match.date).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }) }}
          </div>
          <div class="text-left text-sm font-semibold text-white truncate">{{ match.awayTeam }}</div>
        </div>
      </div>

      <!-- No matches -->
      <div v-else-if="!state.loadingToday" class="rounded-2xl border border-white/10 bg-slate-900/40 p-8 text-center">
        <span class="text-4xl mb-3 block">⚽</span>
        <p class="text-slate-300 font-medium">No hay partidos programados para hoy</p>
        <RouterLink to="/leagues/world-cup" class="inline-block mt-3 text-sm text-amber-400 hover:text-amber-300 transition-colors">
          Ver calendario completo →
        </RouterLink>
      </div>
    </div>

    <!-- Featured Games -->
    <div class="relative z-10 max-w-6xl mx-auto px-6 mb-20">
      <div class="relative rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/60 to-slate-800/30 backdrop-blur-sm p-8 md:pt-10 md:pb-6">
        <div class="absolute -top-4 left-1/2 -translate-x-1/2">
          <div class="px-6 py-1.5 rounded-full bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-white/20 shadow-xl backdrop-blur-sm">
            <h2 class="text-lg font-bold text-white whitespace-nowrap flex items-center gap-2">
              <svg class="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Jugá
            </h2>
          </div>
        </div>

        <div v-if="!state.loading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 stagger-grid">
          <div
            v-for="game in state.featuredGames"
            :key="game.slug"
            class="relative group overflow-hidden rounded-2xl border bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 backdrop-blur-sm transition-all duration-300 hover:scale-[1.03] active:scale-[0.98]"
            :class="state.isAuthenticated ? 'border-white/15 hover:border-emerald-400/40 hover:shadow-xl hover:shadow-emerald-500/15' : 'border-red-500/30'"
          >
            <div v-if="!state.isAuthenticated" class="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-sm">
              <svg class="w-10 h-10 text-red-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <p class="text-sm font-semibold text-red-400 mb-1">Bloqueado</p>
              <p class="text-xs text-slate-400 text-center px-4">Iniciá sesión para jugar</p>
              <RouterLink to="/login" class="mt-3 rounded-lg bg-red-500/20 border border-red-400/30 px-4 py-1.5 text-xs font-semibold text-red-400 transition hover:bg-red-500/30 active:scale-95">
                Iniciar sesión
              </RouterLink>
            </div>
            <RouterLink
              :to="state.isAuthenticated ? getGameRoute(game.slug) : '#'"
              :class="state.isAuthenticated ? '' : 'pointer-events-none'"
            >
              <div class="relative h-32 bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 flex items-center justify-center overflow-hidden">
                <div class="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-cyan-500/5 group-hover:scale-110 transition-transform duration-500"></div>
                <img v-if="game.icon" :src="game.icon" :alt="game.name" class="relative z-10 w-16 h-16 object-contain group-hover:scale-110 transition-transform duration-300" />
                <svg v-else class="relative z-10 w-16 h-16 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div class="p-4">
                <h3 class="text-lg font-bold text-white mb-1.5 line-clamp-1">{{ game.name }}</h3>
                <p class="text-xs text-slate-400 line-clamp-2 mb-3">{{ game.description || 'Desafío diario disponible' }}</p>
                <div v-if="state.isAuthenticated" class="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white transition-all group-hover:shadow-lg group-hover:shadow-emerald-500/40">
                  <span>Jugar</span>
                  <svg class="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                  </svg>
                </div>
              </div>
            </RouterLink>
          </div>
        </div>

        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div v-for="i in 4" :key="i" class="rounded-2xl border border-white/10 bg-slate-900/50 backdrop-blur-sm p-4 animate-pulse">
            <div class="h-32 bg-slate-700/50 rounded-lg mb-4"></div>
            <div class="h-4 bg-slate-700/50 rounded mb-2"></div>
            <div class="h-3 bg-slate-700/30 rounded"></div>
          </div>
        </div>

        <div class="mt-5 text-right">
          <RouterLink
            to="/play/points"
            class="group inline-flex items-center gap-1.5 rounded-full border border-white/20 px-4 py-1.5 text-xs font-medium text-slate-300 transition-all hover:border-emerald-400/40 hover:text-emerald-400 hover:bg-emerald-500/5"
          >
            Ver todos
            <svg class="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </RouterLink>
        </div>
      </div>
    </div>
  </section>
</template>
