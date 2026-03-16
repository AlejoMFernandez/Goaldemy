<script setup>
import { onMounted, reactive, computed } from 'vue'
import { RouterLink } from 'vue-router'
import { supabase } from '../services/supabase'
import { fetchGames, gameRouteForSlug } from '../services/games'
import { LEAGUES, getTodayMatches } from '../services/fotmob'

const state = reactive({ 
  isAuthenticated: false,
  loading: true,
  featuredGames: [],
  loadingToday: false,
  todayByLeague: []
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
    const leagueEntries = Object.values(LEAGUES)
    const results = await Promise.allSettled(
      leagueEntries.map(l => getTodayMatches(l.id).then(matches => ({ league: l, matches })))
    )
    state.todayByLeague = results
      .filter(r => r.status === 'fulfilled' && r.value.matches.length > 0)
      .map(r => r.value)
  } catch (e) {
    console.warn('[Landing] today matches error', e)
    state.todayByLeague = []
  } finally {
    state.loadingToday = false
  }
}

async function load() {
  state.loading = true
  
  // Check auth
  const { data: { user } } = await supabase.auth.getUser()
  state.isAuthenticated = !!user
  
  // Load last 4 games
  const allGames = await fetchGames()
  state.featuredGames = (allGames || [])
    .filter(g => !!g?.slug && gameRouteForSlug(g.slug) !== '/games')
    .slice(-4) // Últimos 4 juegos cargados
  
  state.loading = false

  // Load today matches in background (non-blocking)
  loadTodayByLeague()
}

onMounted(load)

function getGameRoute(slug) {
  return `${gameRouteForSlug(slug)}?mode=challenge`
}

function showComingSoon() {
  alert('Próximamente')
}
</script>

<template>
  <section class="relative min-h-screen overflow-hidden">
    <!-- Aurora background -->
    <div aria-hidden="true" class="aurora-root">
      <div class="accent"></div>
    </div>
    
    <!-- Header / CTA -->
    <div class="relative z-10 max-w-5xl mx-auto px-6 pt-10 pb-6">
      <template v-if="!state.isAuthenticated">
        <div class="text-center space-y-4">
          <h1 class="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Jugá. Aprendé. <span class="text-emerald-400">Dominá.</span>
          </h1>
          <p class="text-slate-400 max-w-lg mx-auto text-base">
            Micro-desafíos de fútbol diarios — ganás XP, subís de rango y competís con el mundo.
          </p>
          <div class="flex flex-wrap gap-3 justify-center pt-2">
            <RouterLink to="/register" class="rounded-xl bg-[oklch(0.62_0.21_270)] px-6 py-2.5 font-semibold text-white text-sm transition hover:bg-[oklch(0.55_0.21_270)] hover:scale-105 shadow-lg">
              Crear cuenta gratis
            </RouterLink>
            <RouterLink to="/login" class="rounded-xl border border-white/10 px-5 py-2.5 font-semibold text-slate-200 text-sm transition hover:border-white/20 hover:bg-white/5">
              Iniciar sesión
            </RouterLink>
          </div>
        </div>
      </template>
      <template v-else>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <p class="text-slate-200 font-semibold text-lg">Bienvenido de vuelta</p>
          <div class="flex flex-wrap gap-2">
            <RouterLink to="/play/points" class="rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-5 py-2 font-semibold text-white text-sm transition hover:scale-105 shadow-lg hover:shadow-emerald-500/40">
              Desafíos del día
            </RouterLink>
            <RouterLink to="/play/free" class="rounded-xl border border-white/10 px-5 py-2 font-semibold text-slate-200 text-sm transition hover:border-white/20 hover:bg-white/5">
              Modo libre
            </RouterLink>
            <RouterLink to="/leaderboards" class="rounded-xl border border-white/10 px-5 py-2 font-semibold text-slate-200 text-sm transition hover:border-white/20 hover:bg-white/5">
              Ranking
            </RouterLink>
          </div>
        </div>
      </template>
    </div>

    <!-- Partidos de Hoy -->
    <div v-if="hasTodayMatches || state.loadingToday" class="relative z-10 max-w-5xl mx-auto px-6 mb-10">
      <!-- Title outside, large -->
      <div class="flex items-center gap-3 mb-4">
        <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0"></span>
        <h2 class="text-2xl font-bold text-white tracking-tight">Partidos de Hoy</h2>
      </div>
      <!-- Loading skeleton -->
      <div v-if="state.loadingToday && !hasTodayMatches" class="space-y-2">
        <div v-for="i in 5" :key="i" class="h-12 rounded-xl bg-white/5 animate-pulse"></div>
      </div>
      <!-- Leagues -->
      <div v-else class="space-y-5">
        <div v-for="item in state.todayByLeague" :key="item.league.id">
          <!-- League separator -->
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
          <!-- Match rows - full width, stacked, score centered -->
          <div class="space-y-1">
            <div
              v-for="match in item.matches"
              :key="match.id"
              class="grid grid-cols-[1fr_72px_1fr_52px] items-center rounded-xl border border-white/5 bg-slate-900/50 hover:bg-slate-800/50 px-4 py-3 transition-colors"
              :class="isLive(match) ? 'border-emerald-500/20 bg-emerald-950/30' : ''"
            >
              <!-- Home team -->
              <div class="flex items-center justify-end gap-2 min-w-0">
                <span class="font-semibold text-sm text-white truncate text-right">{{ match.home?.name }}</span>
                <img
                  :src="`https://images.fotmob.com/image_resources/logo/teamlogo/${match.home?.id}_xsmall.png`"
                  class="w-7 h-7 object-contain flex-shrink-0"
                  :alt="match.home?.name"
                />
              </div>
              <!-- Score / Time — centered -->
              <div class="flex items-center justify-center">
                <span
                  class="font-bold tabular-nums"
                  :class="[
                    match.status?.finished ? 'text-sm text-slate-400' :
                    isLive(match) ? 'text-sm text-emerald-400' :
                    'text-xs text-slate-400'
                  ]"
                >
                  {{ match.status?.scoreStr || matchStatusText(match) }}
                </span>
              </div>
              <!-- Away team -->
              <div class="flex items-center gap-2 min-w-0">
                <img
                  :src="`https://images.fotmob.com/image_resources/logo/teamlogo/${match.away?.id}_xsmall.png`"
                  class="w-7 h-7 object-contain flex-shrink-0"
                  :alt="match.away?.name"
                />
                <span class="font-semibold text-sm text-white truncate">{{ match.away?.name }}</span>
              </div>
              <!-- EN VIVO badge -->
              <div class="flex items-center justify-end">
                <span v-if="isLive(match)" class="text-[9px] font-bold tracking-widest text-emerald-400 animate-pulse uppercase">EN VIVO</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Featured Games Section -->
    <div class="relative z-10 max-w-6xl mx-auto px-6 mb-20">
      <!-- Container Card -->
      <div class="relative rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/50 to-slate-800/30 backdrop-blur-sm p-8 md:pt-10 md:pb-6">
        <!-- Title Badge - "cortando" el borde superior -->
        <div class="absolute -top-4 left-1/2 -translate-x-1/2">
          <div class="px-6 py-1 rounded-full bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-white/20 shadow-xl backdrop-blur-sm">
            <h2 class="text-lg font-bold text-white whitespace-nowrap">Jugá</h2>
          </div>
        </div>

        <!-- Games Grid -->
      <div v-if="!state.loading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div 
          v-for="game in state.featuredGames" 
          :key="game.slug"
          class="relative group overflow-hidden rounded-2xl border bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 backdrop-blur-sm transition-all hover:scale-105"
          :class="state.isAuthenticated ? 'border-white/20 hover:border-emerald-400/40 hover:shadow-xl hover:shadow-emerald-500/20' : 'border-red-500/30'"
        >
          <!-- Locked Overlay -->
          <div v-if="!state.isAuthenticated" class="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-sm">
            <svg class="w-12 h-12 text-red-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <p class="text-sm font-semibold text-red-400 mb-1">Bloqueado</p>
            <p class="text-xs text-slate-400 text-center px-4">Iniciá sesión para jugar</p>
            <RouterLink 
              to="/login" 
              class="mt-4 rounded-lg bg-red-500/20 border border-red-400/30 px-4 py-2 text-xs font-semibold text-red-400 transition hover:bg-red-500/30"
            >
              Iniciar sesión
            </RouterLink>
          </div>

          <!-- Game Card Content -->
          <RouterLink 
            :to="state.isAuthenticated ? getGameRoute(game.slug) : '#'"
            :class="state.isAuthenticated ? '' : 'pointer-events-none'"
          >
            <!-- Game Icon -->
            <div class="relative h-32 bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 flex items-center justify-center overflow-hidden">
              <div class="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-cyan-500/5 group-hover:scale-110 transition-transform duration-500"></div>
              <img 
                v-if="game.icon" 
                :src="game.icon" 
                :alt="game.name"
                class="relative z-10 w-16 h-16 object-contain group-hover:scale-110 transition-transform"
              >
              <svg v-else class="relative z-10 w-16 h-16 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>

            <!-- Game Info -->
            <div class="p-4">
              <h3 class="text-lg font-bold text-white mb-2 line-clamp-1">{{ game.name }}</h3>
              <p class="text-xs text-slate-400 line-clamp-2 mb-3">{{ game.description || 'Desafío diario disponible' }}</p>
              
              <div v-if="state.isAuthenticated" class="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white transition group-hover:shadow-lg group-hover:shadow-emerald-500/50">
                <span>Jugar</span>
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                </svg>
              </div>
            </div>
          </RouterLink>
        </div>
      </div>

        <!-- Loading State -->
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div v-for="i in 4" :key="i" class="rounded-2xl border border-white/10 bg-slate-900/50 backdrop-blur-sm p-4 animate-pulse">
            <div class="h-32 bg-slate-700/50 rounded-lg mb-4"></div>
            <div class="h-4 bg-slate-700/50 rounded mb-2"></div>
            <div class="h-3 bg-slate-700/30 rounded"></div>
          </div>
        </div>

        <!-- Ver todos button -->
        <div class="mt-5 text-right">
          <RouterLink 
            to="/play/points" 
            class="group inline-flex items-center gap-1.5 rounded-full border border-white/20 px-4 py-1.5 text-xs font-medium text-slate-300 transition hover:border-emerald-400/40 hover:text-emerald-400 hover:bg-emerald-500/5"
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
