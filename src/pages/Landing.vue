<script setup>
import { onMounted, onUnmounted, reactive, computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { supabase } from '../services/supabase'
import { getAuthUser } from '../services/auth'
import { fetchGames, gameRouteForSlug } from '../services/games'
import { ACTIVE_LEAGUES, getTodayMatches, getUpcomingMatches } from '../services/fotmob'
import { getDailyChallenges, getDailyReward, getMonthlyPass } from '../services/rewards'
import { getUserLevel } from '../services/xp'
import MatchDetailModal from '../components/match/MatchDetailModal.vue'
import MonthlyPass from '../components/rewards/MonthlyPass.vue'

const state = reactive({
  isAuthenticated: !!(getAuthUser()?.id),
  loading: true,
  featuredGames: [],
  totalGames: 0,
  loadingToday: false,
  todayByLeague: [],
  upcomingMatches: [],
})

// Dashboard del usuario logueado
const home = reactive({
  loading: true,
  name: '', avatarUrl: '', level: 1, dailyStreak: 0,
  playedToday: 0,
  rewardsToClaim: 0,
  passPoints: 0, passPercent: 0, passNextLabel: '', isPremium: false,
})
const showPassModal = ref(false)

const selectedMatch = ref(null)
const matchModalOpen = ref(false)

function openMatch(match) {
  selectedMatch.value = match
  matchModalOpen.value = true
}

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
  try {
    state.isAuthenticated = !!(getAuthUser()?.id)
    const allGames = await fetchGames()
    const playable = (allGames || []).filter(g => !!g?.slug && gameRouteForSlug(g.slug) !== '/games')
    state.featuredGames = playable.slice(-4)
    state.totalGames = playable.length
  } catch (e) {
    console.error('Landing load error:', e)
  } finally {
    state.loading = false
  }
  loadTodayByLeague()
}

async function loadUserHome() {
  const { id } = getAuthUser() || {}
  if (!id) { home.loading = false; return }
  try {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const [profileRes, lvlRes, challenges, daily, pass, sessionsRes] = await Promise.all([
      supabase.from('user_profiles').select('display_name, avatar_url, daily_streak').eq('id', id).single(),
      getUserLevel(null),
      getDailyChallenges(),
      getDailyReward(),
      getMonthlyPass(),
      supabase.from('game_sessions').select('game_id').eq('user_id', id).gte('started_at', todayStart.toISOString()),
    ])
    home.playedToday = new Set((sessionsRes?.data || []).map(s => s.game_id)).size
    if (profileRes.data) {
      home.name = profileRes.data.display_name || ''
      home.avatarUrl = profileRes.data.avatar_url || ''
      home.dailyStreak = profileRes.data.daily_streak || 0
    }
    const lvlInfo = Array.isArray(lvlRes?.data) ? lvlRes.data[0] : lvlRes?.data
    home.level = Number(lvlInfo?.level) || 1

    const chArr = Array.isArray(challenges) ? challenges : []
    const chClaimable = chArr.filter(c => !c.claimed && c.progress >= c.target).length
    const dailyAvail = daily?.available ? 1 : 0

    const tiers = Array.isArray(pass?.tiers) ? pass.tiers : []
    home.isPremium = !!pass?.is_premium
    home.passPoints = pass?.points || 0
    let passClaimable = 0
    for (const t of tiers) {
      if (t.unlocked && !t.free_claimed && (t.free_xp > 0 || t.free_powerup)) passClaimable++
      if (t.unlocked && home.isPremium && !t.premium_claimed && (t.premium_xp > 0 || t.premium_powerup)) passClaimable++
    }
    const nextTier = tiers.find(t => !t.unlocked)
    if (nextTier) {
      const idx = tiers.findIndex(t => t.tier === nextTier.tier)
      const prevReq = idx > 0 ? tiers[idx - 1].points_required : 0
      const span = Math.max(1, nextTier.points_required - prevReq)
      home.passPercent = Math.min(100, Math.round(((home.passPoints - prevReq) / span) * 100))
      home.passNextLabel = `Nivel ${nextTier.tier} · faltan ${Math.max(0, nextTier.points_required - home.passPoints)} pts`
    } else {
      home.passPercent = 100
      home.passNextLabel = '¡Pase completo!'
    }

    home.rewardsToClaim = chClaimable + dailyAvail + passClaimable
  } catch (e) {
    console.warn('[Landing] home load error', e)
  } finally {
    home.loading = false
  }
}

let pollTimer = null
onMounted(() => {
  load()
  if (state.isAuthenticated) loadUserHome()
  // Refrescar partidos del día cada 60s (marcador + minuto en vivo)
  pollTimer = setInterval(() => loadTodayByLeague(), 60000)
})
onUnmounted(() => { if (pollTimer) clearInterval(pollTimer) })

function getGameRoute(slug) {
  return `${gameRouteForSlug(slug)}?mode=challenge`
}
</script>

<template>
  <section class="relative min-h-screen overflow-hidden">
    <!-- Hero -->
    <div class="relative z-10 max-w-5xl mx-auto px-6 pt-12 pb-8">
      <template v-if="!state.isAuthenticated">
        <div class="text-center space-y-6">
          <div class="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-sm text-amber-300 font-medium slide-up">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
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
        <!-- Status bar -->
        <div class="flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/40 p-4 sm:p-5">
          <div class="relative shrink-0">
            <div class="size-14 rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-500 to-cyan-500 grid place-items-center text-white font-extrabold text-xl ring-2 ring-white/10">
              <img v-if="home.avatarUrl" :src="home.avatarUrl" alt="" class="w-full h-full object-cover" />
              <span v-else>{{ (home.name || '?')[0]?.toUpperCase() }}</span>
            </div>
            <div class="absolute -bottom-1 -right-1 rounded-full bg-slate-900 border border-emerald-400/60 px-1.5 py-0.5 text-[11px] font-extrabold text-emerald-400 leading-none">{{ home.level }}</div>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-white font-bold text-lg leading-tight truncate">Hola{{ home.name ? ', ' + home.name : '' }}</p>
            <div class="flex items-center gap-2.5 text-sm text-slate-400 mt-0.5">
              <span class="inline-flex items-center gap-1">
                <svg class="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="currentColor"><path d="M12 23c-3.6 0-8-3.1-8-8.5C4 9 8 4 11.5 1c.2-.1.4-.1.5 0 .2.1.2.3.1.5C11 4 14 6 14 6s1-1.5 1.5-4c0-.2.2-.3.4-.3s.3.1.4.3C18 5 20 9 20 14.5 20 19.9 15.6 23 12 23z"/></svg>
                <span class="text-slate-200 font-semibold">{{ home.dailyStreak }}</span> días
              </span>
              <span class="text-slate-600">·</span>
              <span>Nivel {{ home.level }}</span>
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            <RouterLink to="/play/points" class="group rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-5 py-2.5 font-semibold text-white text-sm transition-all hover:scale-105 hover:shadow-lg hover:shadow-emerald-500/30 active:scale-95">
              Jugar
              <span class="inline-block ml-1 transition-transform group-hover:translate-x-0.5">→</span>
            </RouterLink>
            <RouterLink to="/leaderboards" class="rounded-xl border border-white/15 px-4 py-2.5 font-semibold text-slate-200 text-sm transition-all hover:border-white/25 hover:bg-white/5 active:scale-95">
              Ranking
            </RouterLink>
          </div>
        </div>

        <!-- Tu día -->
        <div class="grid grid-cols-3 gap-3 mt-4">
          <RouterLink to="/play/points" class="rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:p-4 hover:border-emerald-400/30 hover:bg-emerald-500/[0.04] transition-all">
            <div class="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Jugados hoy</div>
            <div class="font-display text-xl font-extrabold text-white">{{ home.playedToday }}<span class="text-slate-600 text-sm">/{{ state.totalGames || '—' }}</span></div>
          </RouterLink>
          <div class="rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:p-4">
            <div class="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Racha</div>
            <div class="font-display text-xl font-extrabold text-white">{{ home.dailyStreak }} <span class="text-slate-500 text-sm font-semibold">días</span></div>
          </div>
          <RouterLink to="/rewards" class="relative rounded-2xl border p-3 sm:p-4 transition-all" :class="home.rewardsToClaim > 0 ? 'border-amber-500/40 bg-amber-500/[0.07] hover:bg-amber-500/[0.12]' : 'border-white/10 bg-white/[0.03]'">
            <div class="text-[10px] uppercase tracking-wider mb-1" :class="home.rewardsToClaim > 0 ? 'text-amber-300' : 'text-slate-500'">Recompensas</div>
            <div class="font-display text-xl font-extrabold" :class="home.rewardsToClaim > 0 ? 'text-amber-300' : 'text-white'">{{ home.rewardsToClaim }}</div>
            <span v-if="home.rewardsToClaim > 0" class="absolute top-2.5 right-2.5 w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
          </RouterLink>
        </div>
      </template>
    </div>

    <!-- World Cup Matches -->
    <div class="relative z-10 max-w-5xl mx-auto px-6 mb-16">
      <div class="flex items-center gap-3 mb-5">
        <div class="flex items-center gap-2.5">
          <img src="https://images.fotmob.com/image_resources/logo/leaguelogo/77.png" alt="Copa del Mundo 2026" class="w-7 h-7 object-contain" @error="$event.target.style.display='none'" />
          <h2 class="text-2xl font-bold text-white tracking-tight">Copa del Mundo 2026</h2>
        </div>
        <div class="flex-1 h-px bg-white/10"></div>
        <RouterLink to="/leagues/world-cup" class="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 transition-colors">
          Ver todo →
        </RouterLink>
      </div>

      <!-- Loading skeleton -->
      <div v-if="state.loadingToday" class="space-y-2">
        <div v-for="i in 4" :key="i" class="h-14 rounded-xl bg-white/5 animate-pulse" :style="{ animationDelay: i * 0.1 + 's' }"></div>
      </div>

      <!-- Today's Matches — centered score layout -->
      <div v-else-if="hasTodayMatches" class="space-y-6">
        <div v-for="item in state.todayByLeague" :key="item.league.id">
          <div class="space-y-1.5">
            <button
              v-for="match in item.matches"
              :key="match.id"
              @click="openMatch(match)"
              class="w-full grid items-center rounded-xl border px-4 py-3.5 transition-all duration-300 cursor-pointer text-left"
              :class="isLive(match)
                ? 'border-emerald-500/40 bg-emerald-950/40 shadow-[0_0_18px_rgba(16,185,129,0.12)] hover:bg-emerald-950/60'
                : 'border-white/5 bg-slate-900/50 hover:bg-slate-800/60 hover:border-white/10'"
              style="grid-template-columns: 1fr auto 1fr;"
            >
              <!-- Home team: name then flag, right-aligned -->
              <div class="flex items-center justify-end gap-2.5 min-w-0 pr-3">
                <span class="font-semibold text-sm text-white truncate text-right">{{ match.home?.name }}</span>
                <img
                  :src="`https://images.fotmob.com/image_resources/logo/teamlogo/${match.home?.id}_xsmall.png`"
                  class="w-7 h-7 object-contain flex-shrink-0"
                  :alt="match.home?.name"
                />
              </div>

              <!-- Score — always dead center -->
              <div class="flex flex-col items-center justify-center gap-0.5 min-w-[80px]">
                <span
                  class="font-bold tabular-nums px-3 py-1 rounded-lg"
                  :class="[
                    match.status?.finished ? 'text-base text-slate-300 bg-slate-800/60' :
                    isLive(match) ? 'text-base text-emerald-400 bg-emerald-500/15' :
                    'text-xs text-slate-400 bg-slate-800/40'
                  ]"
                >
                  {{ match.status?.scoreStr || matchStatusText(match) }}
                </span>
                <span v-if="isLive(match)" class="inline-flex items-center gap-1 text-[9px] font-bold tracking-widest text-emerald-400 uppercase">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  VIVO<span v-if="match.status?.liveTime?.short" class="ml-0.5 normal-case tracking-normal text-emerald-300">{{ match.status.liveTime.short }}</span>
                </span>
              </div>

              <!-- Away team: flag then name, left-aligned -->
              <div class="flex items-center gap-2.5 min-w-0 pl-3">
                <img
                  :src="`https://images.fotmob.com/image_resources/logo/teamlogo/${match.away?.id}_xsmall.png`"
                  class="w-7 h-7 object-contain flex-shrink-0"
                  :alt="match.away?.name"
                />
                <span class="font-semibold text-sm text-white truncate">{{ match.away?.name }}</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      <!-- Upcoming matches fallback -->
      <div v-else-if="state.upcomingMatches.length" class="space-y-1.5">
        <p class="text-slate-400 text-sm mb-3">Próximos partidos</p>
        <div
          v-for="match in state.upcomingMatches"
          :key="match.id"
          class="grid items-center rounded-xl border border-white/5 bg-slate-900/50 hover:bg-slate-800/60 px-4 py-3 transition-all"
          style="grid-template-columns: 1fr auto 1fr;"
        >
          <div class="text-right text-sm font-semibold text-white truncate pr-3">{{ match.homeTeam }}</div>
          <div class="px-3 text-xs text-slate-400 tabular-nums whitespace-nowrap bg-slate-800/40 rounded-lg py-1">
            {{ new Date(match.date).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }) }}
          </div>
          <div class="text-left text-sm font-semibold text-white truncate pl-3">{{ match.awayTeam }}</div>
        </div>
      </div>

      <!-- No matches -->
      <div v-else-if="!state.loadingToday" class="rounded-2xl border border-white/10 bg-slate-900/40 p-10 text-center">
        <svg class="w-12 h-12 mx-auto text-slate-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="10" stroke-width="1.5"/><path stroke-linecap="round" stroke-width="1.5" d="M12 2a15 15 0 010 20M12 2a15 15 0 000 20M2 12h20"/></svg>
        <p class="text-slate-300 font-medium">No hay partidos programados para hoy</p>
        <RouterLink to="/leagues/world-cup" class="inline-block mt-3 text-sm text-cyan-400 hover:text-cyan-300 transition-colors">
          Ver calendario completo →
        </RouterLink>
      </div>
    </div>

    <!-- How It Works (solo invitados) -->
    <div v-if="!state.isAuthenticated" class="relative z-10 max-w-5xl mx-auto px-6 mb-20">
      <div class="text-center mb-10">
        <h2 class="text-2xl sm:text-3xl font-bold text-white mb-3">¿Cómo funciona?</h2>
        <p class="text-slate-400 text-sm max-w-md mx-auto">Tres pasos simples para empezar a competir</p>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div class="rounded-2xl border border-white/10 bg-slate-900/40 p-6 text-center">
          <div class="w-12 h-12 mx-auto mb-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 grid place-items-center">
            <svg class="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
          </div>
          <h3 class="text-white font-semibold mb-1.5">Creá tu cuenta</h3>
          <p class="text-slate-400 text-sm leading-relaxed">Registrate gratis y personalizá tu perfil con tu equipo y jugador favorito.</p>
        </div>
        <div class="rounded-2xl border border-white/10 bg-slate-900/40 p-6 text-center">
          <div class="w-12 h-12 mx-auto mb-4 rounded-xl bg-cyan-500/15 border border-cyan-500/30 grid place-items-center">
            <svg class="w-6 h-6 text-cyan-400" fill="currentColor" viewBox="0 0 24 24"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/></svg>
          </div>
          <h3 class="text-white font-semibold mb-1.5">Jugá desafíos diarios</h3>
          <p class="text-slate-400 text-sm leading-relaxed">9 modos de juego únicos. Adivinar jugadores, ordenar por valor, armar formaciones y más.</p>
        </div>
        <div class="rounded-2xl border border-white/10 bg-slate-900/40 p-6 text-center">
          <div class="w-12 h-12 mx-auto mb-4 rounded-xl bg-amber-500/15 border border-amber-500/30 grid place-items-center">
            <svg class="w-6 h-6 text-amber-400" fill="currentColor" viewBox="0 0 24 24"><path d="M5 3h14l-1.5 5H20a1 1 0 011 1v1a5 5 0 01-3.5 4.77V16a1 1 0 01-1 1h-1.1l.6 3H8l.6-3H7.5a1 1 0 01-1-1v-1.23A5 5 0 013 10V9a1 1 0 011-1h2.5L5 3zm2.36 0l1.14 5h7l1.14-5H7.36zM4 9v1a4 4 0 003.5 3.97V15h9v-1.03A4 4 0 0020 10V9H4z"/></svg>
          </div>
          <h3 class="text-white font-semibold mb-1.5">Subí de nivel</h3>
          <p class="text-slate-400 text-sm leading-relaxed">Ganá XP, desbloqueá logros y competí en el ranking global contra otros fanáticos.</p>
        </div>
      </div>
    </div>

    <!-- Featured Games -->
    <div class="relative z-10 max-w-6xl mx-auto px-6 mb-20">
      <div class="relative rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/60 to-slate-800/30 backdrop-blur-sm p-8 md:pt-10 md:pb-6">
        <div class="absolute -top-4 left-1/2 -translate-x-1/2">
          <div class="px-6 py-1.5 rounded-full bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-white/20 shadow-xl backdrop-blur-sm">
            <h2 class="text-lg font-bold text-white whitespace-nowrap flex items-center gap-2">
              <svg class="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 24 24"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/></svg>
              Jugá
            </h2>
          </div>
        </div>

        <div v-if="!state.loading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 stagger-grid">
          <div
            v-for="game in state.featuredGames"
            :key="game.slug"
            class="relative group flex flex-col overflow-hidden rounded-2xl border bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 backdrop-blur-sm transition-all duration-300 hover:scale-[1.03] active:scale-[0.98]"
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
              class="flex flex-col flex-1"
            >
              <div class="relative h-36 bg-gradient-to-br from-slate-800/60 to-slate-900 flex items-center justify-center overflow-hidden">
                <div class="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style="background: radial-gradient(60% 60% at 50% 45%, rgba(16,185,129,0.18), transparent 70%);"></div>
                <img v-if="game.cover_url" :src="game.cover_url" :alt="game.name" class="relative z-10 w-20 h-20 object-contain group-hover:scale-110 transition-transform duration-300" />
                <svg v-else class="relative z-10 w-16 h-16 text-emerald-400/80" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/>
                </svg>
              </div>
              <div class="p-4 flex flex-col flex-1">
                <h3 class="text-base font-bold text-white mb-1 line-clamp-1">{{ game.name }}</h3>
                <p class="text-xs text-slate-400 line-clamp-2 mb-3">{{ game.description || 'Desafío diario disponible' }}</p>
                <div v-if="state.isAuthenticated" class="mt-auto flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white transition-all group-hover:shadow-lg group-hover:shadow-emerald-500/40">
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

    <!-- Pase mensual (sección propia, solo logueado) -->
    <div v-if="state.isAuthenticated" class="relative z-10 max-w-5xl mx-auto px-6 mb-20">
      <div class="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/[0.06] via-slate-900/40 to-cyan-500/[0.04] p-5 sm:p-6">
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-display font-bold text-white text-lg flex items-center gap-2">🎟️ Pase mensual</h3>
          <span class="text-[11px] rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-amber-300 font-bold">
            {{ home.isPremium ? '⭐ Premium' : 'Premium 🔒' }}
          </span>
        </div>
        <div class="h-2.5 rounded-full bg-black/30 overflow-hidden mb-2 border border-white/5">
          <div class="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400 transition-all duration-700" :style="{ width: home.passPercent + '%' }"></div>
        </div>
        <div class="flex items-center justify-between gap-3">
          <span class="text-sm text-slate-400 truncate">{{ home.passNextLabel || `${home.passPoints} pts` }}</span>
          <button @click="showPassModal = true" class="shrink-0 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-110 active:scale-95 text-black font-bold px-4 py-2 text-sm transition">
            Ver pase completo
          </button>
        </div>
      </div>
    </div>

    <!-- Planes (sección propia, para todos) -->
    <div class="relative z-10 max-w-5xl mx-auto px-6 mb-24">
      <div class="text-center mb-10">
        <h2 class="text-2xl sm:text-3xl font-bold text-white mb-3">{{ state.isAuthenticated ? 'Mejorá tu plan' : 'Elegí tu plan' }}</h2>
        <p class="text-slate-400 text-sm max-w-md mx-auto">Más desafíos, power-ups y bonus de XP para dominar Goaldemy</p>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <!-- Free -->
        <div class="rounded-2xl border border-white/10 bg-slate-900/50 p-6 flex flex-col">
          <div class="mb-5">
            <div class="inline-flex items-center gap-1.5 rounded-full bg-white/5 border border-white/10 px-3 py-1 text-xs font-semibold text-slate-300 mb-3">
              <svg class="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
              Gratis
            </div>
            <div class="text-3xl font-extrabold text-white">$0 <span class="text-sm font-normal text-slate-500">/mes</span></div>
          </div>
          <ul class="space-y-2.5 text-sm text-slate-300 mb-6 flex-1">
            <li class="flex items-start gap-2"><svg class="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>9 modos de juego</li>
            <li class="flex items-start gap-2"><svg class="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>1 desafío por día por juego</li>
            <li class="flex items-start gap-2"><svg class="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>1 power-up por día</li>
            <li class="flex items-start gap-2"><svg class="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>Sistema de XP y niveles</li>
            <li class="flex items-start gap-2"><svg class="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>Ranking global</li>
          </ul>
          <RouterLink to="/register" class="block text-center rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/5 transition">
            Empezar gratis
          </RouterLink>
        </div>

        <!-- Pro (highlighted) -->
        <div class="relative rounded-2xl border-2 border-cyan-500/50 bg-gradient-to-b from-cyan-500/10 to-slate-900/80 p-6 flex flex-col shadow-lg shadow-cyan-500/10">
          <div class="absolute -top-3 left-1/2 -translate-x-1/2">
            <span class="rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-1 text-xs font-bold text-white shadow-lg">Popular</span>
          </div>
          <div class="mb-5">
            <div class="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 px-3 py-1 text-xs font-semibold text-cyan-300 mb-3">
              <svg class="w-3.5 h-3.5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
              Pro
            </div>
            <div class="text-3xl font-extrabold text-white">$11.990 <span class="text-sm font-normal text-slate-500">ARS/mes</span></div>
          </div>
          <ul class="space-y-2.5 text-sm text-slate-300 mb-6 flex-1">
            <li class="flex items-start gap-2"><svg class="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>3 desafíos por día por juego</li>
            <li class="flex items-start gap-2"><svg class="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>5 power-ups por día</li>
            <li class="flex items-start gap-2"><svg class="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>Bonus de XP +25%</li>
            <li class="flex items-start gap-2"><svg class="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>1 protector de racha por semana</li>
            <li class="flex items-start gap-2"><svg class="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>Badge Pro en perfil</li>
          </ul>
          <RouterLink to="/pricing" class="block w-full text-center rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2.5 text-sm font-bold text-white hover:opacity-90 transition">
            Suscribirme
          </RouterLink>
        </div>

        <!-- Legend -->
        <div class="rounded-2xl border border-amber-500/30 bg-gradient-to-b from-amber-500/5 to-slate-900/50 p-6 flex flex-col">
          <div class="mb-5">
            <div class="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 px-3 py-1 text-xs font-semibold text-amber-300 mb-3">
              <svg class="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              Legend
            </div>
            <div class="text-3xl font-extrabold text-white">$14.990 <span class="text-sm font-normal text-slate-500">ARS/mes</span></div>
          </div>
          <ul class="space-y-2.5 text-sm text-slate-300 mb-6 flex-1">
            <li class="flex items-start gap-2"><svg class="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>5 desafíos por día por juego</li>
            <li class="flex items-start gap-2"><svg class="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>15 power-ups por día</li>
            <li class="flex items-start gap-2"><svg class="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>Bonus de XP +50%</li>
            <li class="flex items-start gap-2"><svg class="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>3 protectores de racha por semana</li>
            <li class="flex items-start gap-2"><svg class="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>Badge Legend dorado en perfil</li>
          </ul>
          <RouterLink to="/pricing" class="block w-full text-center rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-300 hover:bg-amber-500/20 transition">
            Suscribirme
          </RouterLink>
        </div>
      </div>
    </div>

    <!-- Match Detail Modal -->
    <MatchDetailModal :match="selectedMatch" :open="matchModalOpen" @close="matchModalOpen = false" />

    <!-- Pase mensual completo (modal) -->
    <Teleport to="body">
      <Transition name="pass-fade">
        <div v-if="showPassModal" class="fixed inset-0 z-[60] overflow-y-auto bg-black/80 backdrop-blur-sm">
          <div class="min-h-full flex items-start justify-center p-4 pt-10 pb-10" @click.self="showPassModal = false">
            <div class="relative w-full max-w-2xl">
              <div class="flex items-center justify-between mb-3">
                <h2 class="font-display text-xl font-extrabold text-white">Pase mensual</h2>
                <button @click="showPassModal = false" class="rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-slate-300 w-9 h-9 grid place-items-center transition" aria-label="Cerrar">
                  <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
              <MonthlyPass />
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </section>
</template>

<style scoped>
.pass-fade-enter-active, .pass-fade-leave-active { transition: opacity 0.2s ease; }
.pass-fade-enter-from, .pass-fade-leave-to { opacity: 0; }
</style>
