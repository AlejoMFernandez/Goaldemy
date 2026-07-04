<script setup>
import { onMounted, onUnmounted, reactive, computed, ref, defineAsyncComponent } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { supabase } from '../services/supabase'
import { getAuthUser } from '../services/auth'
import { fetchGames, gameRouteForSlug } from '../services/games'
import { ACTIVE_LEAGUES, getTodayMatches, getUpcomingMatches } from '../services/fotmob'
import { getDailyChallenges, getDailyReward, getMonthlyPass } from '../services/rewards'
import { getUserLevel } from '../services/xp'
import { getEquippedCosmetics } from '../services/cosmetics'
import { getTierForLevel, tierAccentText } from '../services/tiers'
import { getGameUnlockLevel, isGameUnlocked } from '../services/level-rewards'
import { fetchPlans, getUserPlan } from '../services/premium'
import UserAvatar from '../components/common/UserAvatar.vue'
// Async: pase, planes y modal de partido bajan en su propio chunk (deps pesadas
// fuera del bundle inicial de la home). MonthlyPass trae su card + modal + datos.
const MatchDetailModal = defineAsyncComponent(() => import('../components/match/MatchDetailModal.vue'))
const MonthlyPass = defineAsyncComponent(() => import('../components/rewards/MonthlyPass.vue'))
const PlanCard = defineAsyncComponent(() => import('../components/pricing/PlanCard.vue'))

const router = useRouter()

const state = reactive({
  isAuthenticated: !!(getAuthUser()?.id),
  loading: true,
  featuredGames: [],
  totalGames: 0,
  loadingToday: false,
  todayByLeague: [],
  upcomingMatches: [],
  availability: {},   // por slug: estado del desafío de hoy (win/loss/available) — igual que el índice
  streaks: {},        // por slug: racha de victorias diarias
})

// Dashboard del usuario logueado
const home = reactive({
  loading: true,
  name: '', avatarUrl: '', level: 1, dailyStreak: 0,
  frameKey: 'none', iconGlyph: '', iconBg: 'emerald', framePremium: false,
  playedToday: 0,
  playedGameIds: [],   // ids de juegos con desafío TERMINADO hoy (para el stat "Jugados hoy")
  rewardsToClaim: 0,
  passPoints: 0, passPercent: 0, passNextLabel: '', isPremium: false,
})
// Planes para la sección de precios (compartida invitado/logueado). Data real de la DB.
const plans = ref([])
const currentPlan = ref('')
const sortedPlans = computed(() => [...plans.value].sort((a, b) => a.sort_order - b.sort_order))
function goToPricing() { router.push('/pricing') }

const selectedMatch = ref(null)
const matchModalOpen = ref(false)

function openMatch(match) {
  selectedMatch.value = match
  matchModalOpen.value = true
}

const hasTodayMatches = computed(() => state.todayByLeague.some(l => l.matches.length > 0))

// Rango/categoría por nivel (fuente única en tiers.js) para el hero
const tier = computed(() => getTierForLevel(home.level))
const tierLabel = computed(() => tier.value?.label || '')
const tierAccent = computed(() => tierAccentText(tier.value?.color))

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
    if (state.isAuthenticated) loadFeaturedStates()
  } catch (e) {
    console.error('Landing load error:', e)
  } finally {
    state.loading = false
  }
  loadTodayByLeague()
  loadPlans()
}

// Planes reales (Free/Pro/Legend) para la sección de precios, en ambos estados.
async function loadPlans() {
  try {
    plans.value = await fetchPlans() || []
    if (state.isAuthenticated) {
      const up = await getUserPlan().catch(() => null)
      currentPlan.value = up?.plan || ''
    }
  } catch (e) {
    console.warn('[Landing] plans load error', e)
  }
}

// Estado de desafío + racha por juego destacado, para renderizar las cards
// EXACTAMENTE como el índice de juegos (PlayPoints): ✓/✕ de hoy y racha 🔥.
async function loadFeaturedStates() {
  try {
    // Import diferido: game-modes arrastra un grafo pesado (achievement-triggers,
    // premium…) que no queremos en el chunk inicial de la home.
    const { isChallengeAvailable, fetchDailyWinStreak } = await import('../services/game-modes')
    const list = state.featuredGames
    const [av, st] = await Promise.all([
      Promise.all(list.map(async g => [g.slug, await isChallengeAvailable(g.slug)])),
      Promise.all(list.map(async g => [g.slug, await fetchDailyWinStreak(g.slug)])),
    ])
    state.availability = Object.fromEntries(av)
    state.streaks = Object.fromEntries(st)
  } catch (e) {
    console.warn('[Landing] featured states error', e)
  }
}

// Jugado hoy → review (ver resultado). Sin jugar → arrancar el desafío. (igual que el índice)
function toChallenge(slug) {
  const av = state.availability[slug]
  if (av && av.available === false) return `${gameRouteForSlug(slug)}?mode=review`
  return `${gameRouteForSlug(slug)}?mode=challenge`
}

async function loadUserHome() {
  const { id } = getAuthUser() || {}
  if (!id) { home.loading = false; return }
  try {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const [profileRes, lvlRes, challenges, daily, pass, sessionsRes, equipped] = await Promise.all([
      supabase.from('user_profiles').select('display_name, avatar_url, daily_streak').eq('id', id).single(),
      getUserLevel(null),
      getDailyChallenges(),
      getDailyReward(),
      getMonthlyPass(),
      supabase.from('game_sessions').select('game_id, ended_at, metadata').eq('user_id', id).gte('started_at', todayStart.toISOString()),
      getEquippedCosmetics(id).catch(() => null),
    ])
    const finished = (sessionsRes?.data || []).filter(s => s.ended_at && (s.metadata || {}).mode === 'challenge')
    home.playedGameIds = [...new Set(finished.map(s => s.game_id).filter(Boolean))]
    home.playedToday = home.playedGameIds.length
    if (profileRes.data) {
      home.name = profileRes.data.display_name || ''
      home.avatarUrl = profileRes.data.avatar_url || ''
      home.dailyStreak = profileRes.data.daily_streak || 0
    }
    if (equipped) {
      home.frameKey = equipped.frameKey || 'none'
      home.iconGlyph = equipped.iconGlyph || ''
      home.iconBg = equipped.iconBg || 'emerald'
      home.framePremium = !!equipped.framePremium
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
</script>

<template>
  <section class="relative min-h-screen overflow-hidden">

    <!-- ══════════════════ HERO ══════════════════ -->
    <div class="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-8">
      <!-- Invitado: hero marketing (no tocar) -->
      <div v-if="!state.isAuthenticated" class="text-center space-y-6">
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

      <!-- Logueado: hero XL estilo lobby (avatar grande + JUGAR + Tu día) -->
      <div v-else class="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900/70 to-slate-800/40 p-6 sm:p-8 shadow-xl shadow-black/30">
        <div class="pointer-events-none absolute -top-24 -right-20 w-72 h-72 rounded-full opacity-20" style="background: radial-gradient(circle, rgba(16,185,129,0.55), transparent 70%);"></div>
        <div class="pointer-events-none absolute -bottom-28 -left-16 w-72 h-72 rounded-full opacity-10" style="background: radial-gradient(circle, rgba(34,211,238,0.5), transparent 70%);"></div>

        <div class="relative flex flex-col sm:flex-row items-center gap-5 sm:gap-7">
          <!-- Avatar XL con badge de nivel -->
          <div class="relative shrink-0">
            <UserAvatar
              :size="112"
              :avatar-url="home.avatarUrl"
              :initial="(home.name || '?')[0]?.toUpperCase()"
              :frame-key="home.frameKey"
              :icon-glyph="home.iconGlyph"
              :icon-bg="home.iconBg"
              :frame-premium="home.framePremium"
            />
            <div class="absolute -bottom-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-slate-950 border border-emerald-400/60 px-3 py-1 text-xs font-extrabold text-emerald-400 shadow-lg shadow-emerald-500/20">
              NIVEL {{ home.level }}
            </div>
          </div>

          <!-- Identidad + CTA -->
          <div class="flex-1 min-w-0 w-full text-center sm:text-left">
            <p class="text-[11px] uppercase tracking-[0.22em] text-slate-500 mb-1">Bienvenido de vuelta</p>
            <h1 class="font-display text-2xl sm:text-4xl font-extrabold text-white leading-tight truncate">Hola{{ home.name ? ', ' + home.name : '' }}</h1>
            <div class="flex flex-wrap items-center justify-center sm:justify-start gap-x-2.5 gap-y-1 text-sm mt-2">
              <span v-if="tierLabel" class="inline-flex items-center gap-1.5 font-bold" :class="tierAccent">
                <span class="w-1.5 h-1.5 rounded-full bg-current"></span>{{ tierLabel }}
              </span>
              <span v-if="tierLabel" class="text-slate-600">·</span>
              <span class="text-slate-400">Nivel {{ home.level }}</span>
              <span class="text-slate-600">·</span>
              <span class="inline-flex items-center gap-1 text-slate-400">
                <svg class="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="currentColor"><path d="M12 23c-3.6 0-8-3.1-8-8.5C4 9 8 4 11.5 1c.2-.1.4-.1.5 0 .2.1.2.3.1.5C11 4 14 6 14 6s1-1.5 1.5-4c0-.2.2-.3.4-.3s.3.1.4.3C18 5 20 9 20 14.5 20 19.9 15.6 23 12 23z"/></svg>
                <span class="text-slate-200 font-semibold">{{ home.dailyStreak }}</span> días de racha
              </span>
            </div>
            <div class="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-5">
              <RouterLink to="/play/points" class="group inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-8 py-3.5 font-bold text-white text-base shadow-lg shadow-emerald-500/30 transition-all hover:scale-105 hover:shadow-emerald-500/50 active:scale-95">
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/></svg>
                Jugar ahora
              </RouterLink>
              <RouterLink to="/leaderboards" class="inline-flex items-center gap-2 rounded-2xl border border-white/15 px-6 py-3.5 font-semibold text-slate-200 text-sm transition-all hover:border-white/25 hover:bg-white/5 active:scale-95">
                <svg class="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 24 24"><path d="M5 3h14l-1.5 5H20a1 1 0 011 1v1a5 5 0 01-3.5 4.77V16a1 1 0 01-1 1h-1.1l.6 3H8l.6-3H7.5a1 1 0 01-1-1v-1.23A5 5 0 013 10V9a1 1 0 011-1h2.5L5 3z"/></svg>
                Ranking
              </RouterLink>
            </div>
          </div>
        </div>

        <!-- Strip "Tu día" -->
        <div class="relative mt-6 pt-5 border-t border-white/10 grid grid-cols-3 divide-x divide-white/10">
          <RouterLink to="/play/points" class="group flex flex-col items-center px-2 transition">
            <span class="text-[10px] uppercase tracking-wider text-slate-500 group-hover:text-emerald-400 transition-colors">Jugados hoy</span>
            <span class="font-display text-xl font-extrabold text-white mt-0.5">{{ home.playedToday }}<span class="text-slate-600 text-sm">/{{ state.totalGames || '—' }}</span></span>
          </RouterLink>
          <div class="flex flex-col items-center px-2">
            <span class="text-[10px] uppercase tracking-wider text-slate-500">Racha</span>
            <span class="font-display text-xl font-extrabold text-white mt-0.5">{{ home.dailyStreak }} <span class="text-slate-500 text-sm font-semibold">días</span></span>
          </div>
          <RouterLink to="/rewards" class="group relative flex flex-col items-center px-2 transition">
            <span class="text-[10px] uppercase tracking-wider transition-colors" :class="home.rewardsToClaim > 0 ? 'text-amber-300' : 'text-slate-500 group-hover:text-amber-300'">Recompensas</span>
            <span class="font-display text-xl font-extrabold mt-0.5" :class="home.rewardsToClaim > 0 ? 'text-amber-300' : 'text-white'">{{ home.rewardsToClaim }}</span>
            <span v-if="home.rewardsToClaim > 0" class="absolute -top-1 right-1 w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
          </RouterLink>
        </div>
      </div>
    </div>

    <!-- ══════════════════ Partidos del Mundial (compartido, full-width) ══════════════════ -->
    <!-- min-h reserva espacio para que el footer no salte cuando cargan los partidos (CLS) -->
    <div class="relative z-10 max-w-5xl mx-auto px-6 mb-16 min-h-[340px]">
      <div class="flex items-center gap-3 mb-5">
        <div class="flex items-center gap-2.5">
          <img src="https://images.fotmob.com/image_resources/logo/leaguelogo/77.png" alt="Copa del Mundo 2026" width="28" height="28" loading="lazy" decoding="async" class="w-7 h-7 object-contain" @error="$event.target.style.display='none'" />
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
                  width="28" height="28" loading="lazy" decoding="async"
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
                  width="28" height="28" loading="lazy" decoding="async"
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

    <!-- ══════════════════ ¿Cómo funciona? (solo invitados) ══════════════════ -->
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

    <!-- ══════════════════ Juegos ══════════════════ -->
    <!-- Logueado: cards idénticas al índice de juegos -->
    <div v-if="state.isAuthenticated" class="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 mb-16">
      <div class="flex items-center gap-2.5 mb-4">
        <span class="grid place-items-center size-9 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/10 border border-emerald-400/25 shrink-0">
          <svg class="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 24 24"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/></svg>
        </span>
        <div class="flex-1 min-w-0">
          <h2 class="font-display font-bold text-white text-lg leading-tight">Jugá hoy</h2>
          <p class="text-xs text-slate-500">Tus desafíos diarios</p>
        </div>
        <RouterLink to="/play/points" class="group inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-emerald-400 transition-colors">
          Ver todos
          <svg class="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
        </RouterLink>
      </div>

      <div v-if="state.loading" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        <div v-for="i in 4" :key="i" class="rounded-2xl border border-white/10 bg-slate-900/50 overflow-hidden animate-pulse">
          <div class="h-36 bg-slate-700/40"></div>
          <div class="px-3 py-3 border-t border-white/5"><div class="h-3 bg-slate-700/40 rounded mx-auto w-2/3"></div></div>
        </div>
      </div>
      <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 stagger-grid">
        <template v-for="g in state.featuredGames" :key="g.slug">
          <!-- Bloqueado por nivel -->
          <div
            v-if="!isGameUnlocked(g.slug, home.level)"
            class="relative flex flex-col rounded-2xl overflow-hidden border border-white/5 bg-gradient-to-b from-slate-800/40 to-slate-900/60 opacity-60 cursor-not-allowed select-none"
          >
            <div class="relative flex items-center justify-center h-36 bg-slate-800/40">
              <img v-if="g.cover_url" :src="g.cover_url" :alt="g.name" width="96" height="96" loading="lazy" decoding="async" class="w-24 h-24 object-contain opacity-20 grayscale" />
              <div class="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/40">
                <svg class="w-10 h-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                <span class="text-[10px] text-slate-400 font-semibold text-center px-2 leading-tight">Nivel {{ getGameUnlockLevel(g.slug) }}</span>
              </div>
            </div>
            <div class="bg-slate-900/90 px-3 py-3 border-t border-white/5 text-center">
              <div class="font-display font-bold text-slate-500 text-xs tracking-widest uppercase">BLOQUEADO</div>
              <div class="text-slate-500 text-xs mt-0.5 truncate">{{ g.name }}</div>
            </div>
          </div>

          <!-- Desbloqueado -->
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
            <div class="absolute top-0 inset-x-0 h-0.5 z-20 bg-gradient-to-r from-emerald-400/70 via-cyan-400/70 to-transparent opacity-50 group-hover:opacity-100 transition-opacity duration-300"></div>

            <div class="relative flex items-center justify-center h-36 bg-slate-800/60 overflow-hidden">
              <div class="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style="background: radial-gradient(60% 60% at 50% 42%, rgba(16,185,129,0.20), transparent 70%);"></div>
              <div v-if="state.availability[g.slug]?.available === false" class="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                <div v-if="state.availability[g.slug]?.result === 'win'" class="w-14 h-14 rounded-2xl flex items-center justify-center ring-1 ring-emerald-400/40 bg-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                  <span class="text-emerald-400 text-3xl font-extrabold leading-none">✓</span>
                </div>
                <div v-else class="w-14 h-14 rounded-2xl flex items-center justify-center ring-1 ring-red-400/40 bg-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.3)]">
                  <span class="text-red-400 text-3xl font-extrabold leading-none">✕</span>
                </div>
              </div>
              <img
                v-if="g.cover_url"
                :src="g.cover_url"
                :alt="g.name"
                width="96" height="96" loading="lazy" decoding="async"
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

    <!-- Invitado: juegos destacados bloqueados (panel de conversión) -->
    <div v-else class="relative z-10 max-w-6xl mx-auto px-6 mb-20">
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
            class="relative group flex flex-col overflow-hidden rounded-2xl border border-red-500/30 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 backdrop-blur-sm transition-all duration-300 hover:scale-[1.03] active:scale-[0.98]"
          >
            <div class="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-sm">
              <svg class="w-10 h-10 text-red-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <p class="text-sm font-semibold text-red-400 mb-1">Bloqueado</p>
              <p class="text-xs text-slate-400 text-center px-4">Iniciá sesión para jugar</p>
              <RouterLink to="/login" class="mt-3 rounded-lg bg-red-500/20 border border-red-400/30 px-4 py-1.5 text-xs font-semibold text-red-400 transition hover:bg-red-500/30 active:scale-95">
                Iniciar sesión
              </RouterLink>
            </div>
            <div class="flex flex-col flex-1 pointer-events-none">
              <div class="relative h-36 bg-gradient-to-br from-slate-800/60 to-slate-900 flex items-center justify-center overflow-hidden">
                <img v-if="game.cover_url" :src="game.cover_url" :alt="game.name" width="80" height="80" loading="lazy" decoding="async" class="relative z-10 w-20 h-20 object-contain" />
                <svg v-else class="relative z-10 w-16 h-16 text-emerald-400/80" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/>
                </svg>
              </div>
              <div class="p-4 flex flex-col flex-1">
                <h3 class="text-base font-bold text-white mb-1 line-clamp-1">{{ game.name }}</h3>
                <p class="text-xs text-slate-400 line-clamp-2">{{ game.description || 'Desafío diario disponible' }}</p>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div v-for="i in 4" :key="i" class="rounded-2xl border border-white/10 bg-slate-900/50 backdrop-blur-sm p-4 animate-pulse">
            <div class="h-32 bg-slate-700/50 rounded-lg mb-4"></div>
            <div class="h-4 bg-slate-700/50 rounded mb-2"></div>
            <div class="h-3 bg-slate-700/30 rounded"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- ══════════════════ Pase de Batalla (solo logueado) ══════════════════ -->
    <!-- Card real del pase (teaser + modal + datos propios). min-h reserva espacio (CLS) -->
    <div v-if="state.isAuthenticated" class="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 mb-16 min-h-[240px]">
      <MonthlyPass />
    </div>

    <!-- ══════════════════ Planes (compartido) ══════════════════ -->
    <div class="relative z-10 max-w-5xl mx-auto px-6 mb-24">
      <div class="text-center mb-10">
        <h2 class="text-2xl sm:text-3xl font-bold text-white mb-3">{{ state.isAuthenticated ? 'Mejorá tu plan' : 'Elegí tu plan' }}</h2>
        <p class="text-slate-400 text-sm max-w-md mx-auto">Más desafíos, power-ups y bonus de XP para dominar Goaldemy</p>
      </div>
      <div v-if="sortedPlans.length" class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <PlanCard
          v-for="plan in sortedPlans"
          :key="plan.slug"
          :plan="plan"
          :current-plan="currentPlan"
          @subscribe="goToPricing"
        />
      </div>
      <div v-else class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div v-for="i in 3" :key="i" class="rounded-2xl border border-white/10 bg-white/[0.02] h-[420px] animate-pulse"></div>
      </div>
    </div>

    <!-- Match Detail Modal -->
    <MatchDetailModal :match="selectedMatch" :open="matchModalOpen" @close="matchModalOpen = false" />
  </section>
</template>
