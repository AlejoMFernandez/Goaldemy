<script setup>
import { onMounted, onUnmounted, reactive, computed, ref, defineAsyncComponent } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { supabase } from '../services/supabase'
import { getAuthUser } from '../services/auth'
import { fetchGames, gameRouteForSlug } from '../services/games'
import { LEAGUES, getUpcomingMatches } from '../services/fotmob'
import { getDailyChallenges } from '../services/rewards'
import { getUserLevel, getLeaderboard, getUserRank, computeProgressPercentSync, fetchLevelThresholds } from '../services/xp'
import { getUserAchievements, getAchievementsCatalog } from '../services/achievements'
import { getEquippedCosmetics } from '../services/cosmetics'
import { getTierForLevel } from '../services/tiers'
import { getGameUnlockLevel, isGameUnlocked } from '../services/level-rewards'
import { fetchPlans, getUserPlan } from '../services/premium'
import UserAvatar from '../components/common/UserAvatar.vue'
import GameCard from '../components/game/GameCard.vue'
import MatchTicker from '../components/home/MatchTicker.vue'
import TopJugadorCard from '../components/home/TopJugadorCard.vue'
import TodayMatchesGrid from '../components/home/TodayMatchesGrid.vue'

// Video de fondo del hero (local, optimizado — ver public/videoshero/).
// Vacío = se usa el fondo con degradé en vez de video.
const HERO_VIDEO_SRC = '/videoshero/hero-aerial.mp4'
const HERO_VIDEO_POSTER = '/videoshero/hero-aerial-poster.jpg'
// Async: pase y planes bajan en su propio chunk (deps pesadas fuera del
// bundle inicial de la home). MonthlyPass trae su card + modal + datos.
const MonthlyPass = defineAsyncComponent(() => import('../components/rewards/MonthlyPass.vue'))
const PlanCard = defineAsyncComponent(() => import('../components/pricing/PlanCard.vue'))
const LevelProgressionModal = defineAsyncComponent(() => import('../components/profile/LevelProgressionModal.vue'))
const showProgression = ref(false)

const router = useRouter()

const state = reactive({
  isAuthenticated: !!(getAuthUser()?.id),
  loading: true,
  featuredGames: [],
  totalGames: 0,
  availability: {},   // por slug: estado del desafío de hoy (win/loss/available) — igual que el índice
  streaks: {},        // por slug: racha de victorias diarias
  loadingTicker: false,
  tickerRaw: [],       // partidos crudos de TODAS las ligas, para el ticker de arriba
})

// Spotlight "Top jugador" (semana/mes) — reemplaza la vieja sección de partidos
// del Mundial (torneo ya finalizado, esa data quedó vieja) por algo propio de
// Fulvo que nunca se desactualiza. Podio top 3 (no una card 1:1 igual al hero).
const spotlight = reactive({
  loading: true,
  period: 'weekly', // 'weekly' | 'monthly'
  top: [], // [{ userId, name, avatarUrl, level, xp, frameKey, iconGlyph, iconBg, framePremium }] rank #1..#3
})

// Dashboard del usuario logueado
const home = reactive({
  loading: true,
  name: '', avatarUrl: '', level: 1, dailyStreak: 0,
  frameKey: 'none', iconGlyph: '', iconBg: 'emerald', framePremium: false,
  levelPercent: 0,               // % al próximo nivel, para el anillo del hero
  rank: null,                    // posición global (get_user_rank), null si no hay suficiente actividad
  achievementsEarned: 0, achievementsTotal: 0,
  challengesDone: 0, challengesTotal: 0,   // desafíos diarios completados/total, para "Misión de hoy"
  challenges: [],                // lista real de desafíos de hoy [{code, title, progress, target}], para mostrarlos como items
})
// Planes para la sección de precios (compartida invitado/logueado). Data real de la DB.
const plans = ref([])
const currentPlan = ref('')
const sortedPlans = computed(() => [...plans.value].sort((a, b) => a.sort_order - b.sort_order))
function goToPricing() { router.push('/pricing') }

// Trae el Top 3 del ranking (semanal/mensual) + cosméticos equipados de cada
// uno para el podio de la home.
async function loadSpotlight() {
  spotlight.loading = true
  try {
    const { data, error } = await getLeaderboard({ period: spotlight.period, gameId: null, limit: 3, offset: 0 })
    if (error) throw error
    const rows = Array.isArray(data) ? data : (data ? [data] : [])
    if (!rows.length) { spotlight.top = []; return }
    spotlight.top = await Promise.all(rows.map(async row => {
      const cosmetics = await getEquippedCosmetics(row.user_id).catch(() => null)
      return {
        userId: row.user_id,
        name: row.display_name || row.username || row.email || row.user_id?.slice(0, 8) || '—',
        avatarUrl: row.avatar_url || '',
        level: row.user_level ?? row.level ?? 1,
        xp: row.xp_total ?? 0,
        frameKey: cosmetics?.frameKey || 'none',
        iconGlyph: cosmetics?.iconGlyph || '',
        iconBg: cosmetics?.iconBg || 'emerald',
        framePremium: !!cosmetics?.framePremium,
      }
    }))
  } catch (e) {
    console.warn('[Landing] spotlight load error', e)
    spotlight.top = []
  } finally {
    spotlight.loading = false
  }
}
function setSpotlightPeriod(p) {
  if (spotlight.period === p) return
  spotlight.period = p
  loadSpotlight()
}

// Ticker de partidos (arriba de todo, para todos): recorre TODAS las ligas
// conocidas (no solo ACTIVE_LEAGUES/Mundial) y trae los PRÓXIMOS partidos de
// cada una — no solo los de hoy, igual que la referencia (Copero también
// muestra fechas de días siguientes, no exclusivamente "hoy"). Así el ticker
// siempre tiene contenido aunque hoy no juegue nadie del Mundial.
async function loadTickerMatches() {
  state.loadingTicker = true
  try {
    const results = await Promise.allSettled(
      Object.values(LEAGUES).map(l => getUpcomingMatches(l.id, 5).then(matches => ({ league: l, matches })))
    )
    state.tickerRaw = results
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => r.value.matches.map(m => ({ ...m, league: r.value.league })))
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 24)
  } catch (e) {
    console.warn('[Landing] ticker load error', e)
    state.tickerRaw = []
  } finally {
    state.loadingTicker = false
  }
}

const tickerMatches = computed(() => state.tickerRaw.map((m, i) => {
  const parts = (m.status?.score || '').split('-').map(s => s.trim())
  const [homeScore, awayScore] = parts.length === 2 ? parts : [null, null]
  const live = !!(m.status?.started && !m.status?.finished)
  return {
    id: m.id ?? i,
    date: m.date,
    leagueId: m.league.id, leagueName: m.league.name,
    leagueLogo: `https://images.fotmob.com/image_resources/logo/leaguelogo/${m.league.id}.png`,
    homeId: m.homeTeamId, homeName: m.homeTeam,
    awayId: m.awayTeamId, awayName: m.awayTeam,
    homeScore, awayScore,
    isLive: live,
    finished: !!m.status?.finished,
    statusText: m.status?.finished ? 'FIN' : new Date(m.date).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }),
    pageUrl: m.pageUrl || null,
  }
}))

// "Partidos de hoy" (sección grande, debajo de Top jugador): mismo dato ya
// traído para el ticker (sin pedirlo dos veces a FotMob). Sin filtro estricto
// de "literalmente hoy" — con eso la sección quedaba vacía la mayoría de los
// días (las ligas seguidas no siempre juegan hoy mismo); mostramos los
// próximos partidos ya disponibles, en vivo primero.
const todayMatches = computed(() => (
  [...tickerMatches.value].sort((a, b) => (b.isLive ? 1 : 0) - (a.isLive ? 1 : 0)).slice(0, 9)
))

// Video de fondo del hero: se descarga solo en pantallas grandes y si el
// usuario no pidió menos movimiento — nunca se pide el archivo en mobile.
const showHeroVideo = ref(false)

// Rango/categoría por nivel (fuente única en tiers.js) para el hero
const tier = computed(() => getTierForLevel(home.level))
const tierLabel = computed(() => tier.value?.label || '')

// "Misión de hoy": subtítulo resumen (los desafíos en sí se listan como items,
// mismos datos que /rewards).
const missionRemaining = computed(() => Math.max(0, home.challengesTotal - home.challengesDone))
const missionSubtitle = computed(() => missionRemaining.value > 0
  ? `Completá ${missionRemaining.value} desafío${missionRemaining.value === 1 ? '' : 's'} más`
  : '¡Todas las misiones de hoy completadas!')

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
    // Nota: el Pase de Batalla y la recompensa diaria NO se traen acá — el
    // Home solo embebe <MonthlyPass compact /> (trae sus propios datos), y
    // ya no hay franja "Jugados hoy"/"Recompensas" que necesite esos totales.
    const [profileRes, lvlRes, challenges, equipped, rankRes, achRes, achCatalog] = await Promise.all([
      supabase.from('user_profiles').select('display_name, avatar_url, daily_streak').eq('id', id).single(),
      getUserLevel(null),
      getDailyChallenges(),
      getEquippedCosmetics(id).catch(() => null),
      getUserRank(id).catch(() => ({ rank: null })),
      getUserAchievements(id).catch(() => ({ data: [] })),
      getAchievementsCatalog().catch(() => ({})),
      fetchLevelThresholds(),
    ])
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
    home.levelPercent = computeProgressPercentSync(lvlInfo)
    home.rank = rankRes?.rank ?? null
    home.achievementsEarned = Array.isArray(achRes?.data) ? achRes.data.length : 0
    home.achievementsTotal = achCatalog ? Object.keys(achCatalog).length : 0

    const chArr = Array.isArray(challenges) ? challenges : []
    home.challengesTotal = chArr.length
    home.challengesDone = chArr.filter(c => c.progress >= c.target).length
    home.challenges = chArr
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
  loadTickerMatches()
  loadSpotlight()
  // Refrescar el ticker cada 60s (marcador + minuto en vivo)
  pollTimer = setInterval(() => loadTickerMatches(), 60000)

  if (HERO_VIDEO_SRC) {
    const wideEnough = window.matchMedia('(min-width: 640px)').matches
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    showHeroVideo.value = wideEnough && !reducedMotion
  }
})
onUnmounted(() => { if (pollTimer) clearInterval(pollTimer) })
</script>

<template>
  <section class="relative min-h-screen" :class="state.isAuthenticated ? '' : 'bg-[#0b1220]'">

    <!-- ══════════════════ Ticker de partidos (arriba de todo, para todos) ══════════════════ -->
    <MatchTicker :matches="tickerMatches" :loading="state.loadingTicker" />

    <!-- ══════════════════ INVITADO: una sola columna, sin cambios de fondo ══════════════════ -->
    <template v-if="!state.isAuthenticated">
      <!-- Hero inmersivo full-bleed (video de fondo secundario + degradé) -->
      <div class="relative overflow-hidden hero-fullbleed mb-20 min-h-[520px] sm:min-h-[600px] flex items-center justify-center">
        <div class="absolute inset-0 hero-aurora"></div>
        <video
          v-if="HERO_VIDEO_SRC && showHeroVideo"
          class="absolute inset-0 w-full h-full object-cover hero-video"
          :src="HERO_VIDEO_SRC"
          :poster="HERO_VIDEO_POSTER"
          autoplay muted loop playsinline preload="none"
        ></video>
        <div class="absolute inset-0 hero-scrim"></div>
        <!-- Fundido final: disuelve el hero contra el fondo real de la página antes del borde -->
        <div class="absolute inset-x-0 bottom-0 h-24 sm:h-32 hero-fade-out"></div>

        <div class="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <h1 class="font-display text-5xl sm:text-7xl font-bold text-white tracking-tight leading-[0.98]">
            Jugá. Aprendé.<br />
            <span class="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">Dominá.</span>
          </h1>
          <p class="text-slate-300 max-w-sm mx-auto text-base sm:text-lg leading-relaxed mt-6">
            Micro-desafíos diarios de fútbol.
          </p>
          <div class="flex flex-wrap gap-3 justify-center pt-8">
            <RouterLink to="/register" class="group rounded-xl bg-white px-7 py-3.5 font-semibold text-slate-900 text-sm transition-all hover:shadow-lg hover:shadow-white/20 hover:scale-105 active:scale-95">
              Crear cuenta gratis
              <span class="inline-block ml-1 transition-transform group-hover:translate-x-0.5">→</span>
            </RouterLink>
            <RouterLink to="/login" class="rounded-xl border border-white/20 px-6 py-3.5 font-semibold text-slate-100 text-sm transition-all hover:border-white/35 hover:bg-white/10 active:scale-95">
              Iniciar sesión
            </RouterLink>
          </div>
        </div>
      </div>

      <!-- Top jugador -->
      <div class="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 mb-20">
        <TopJugadorCard :spotlight="spotlight" :is-authenticated="false" @set-period="setSpotlightPeriod" />
      </div>

      <!-- Partidos de hoy -->
      <div class="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 mb-20">
        <TodayMatchesGrid :matches="todayMatches" :loading="state.loadingTicker" />
      </div>

      <!-- Juegos destacados bloqueados (panel de conversión) -->
      <div class="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 mb-20">
        <h2 class="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight mb-6">Jugá</h2>

        <div class="relative">
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
                  <svg v-else class="relative z-10 w-16 h-16 text-violet-400/80" fill="currentColor" viewBox="0 0 24 24">
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

      <!-- ¿Cómo funciona? -->
      <div class="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 mb-20">
        <h2 class="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight mb-8">¿Cómo funciona?</h2>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-10 sm:gap-8">
          <div>
            <span class="font-display text-sm font-bold text-violet-400/70">01</span>
            <h3 class="text-white font-semibold text-lg mt-2 mb-1.5">Creá tu cuenta</h3>
            <p class="text-slate-400 text-sm leading-relaxed">Registrate gratis y personalizá tu perfil con tu equipo y jugador favorito.</p>
          </div>
          <div>
            <span class="font-display text-sm font-bold text-violet-400/70">02</span>
            <h3 class="text-white font-semibold text-lg mt-2 mb-1.5">Jugá desafíos diarios</h3>
            <p class="text-slate-400 text-sm leading-relaxed">9 modos de juego únicos. Adivinar jugadores, ordenar por valor, armar formaciones y más.</p>
          </div>
          <div>
            <span class="font-display text-sm font-bold text-violet-400/70">03</span>
            <h3 class="text-white font-semibold text-lg mt-2 mb-1.5">Subí de nivel</h3>
            <p class="text-slate-400 text-sm leading-relaxed">Ganá XP, desbloqueá logros y competí en el ranking global contra otros fanáticos.</p>
          </div>
        </div>
      </div>

      <!-- Planes -->
      <div class="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 mb-20">
        <h2 class="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight mb-6">Elegí tu plan</h2>
        <div v-if="sortedPlans.length" class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <PlanCard v-for="plan in sortedPlans" :key="plan.slug" :plan="plan" :current-plan="currentPlan" @subscribe="goToPricing" />
        </div>
        <div v-else class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div v-for="i in 3" :key="i" class="rounded-2xl border border-white/10 bg-white/[0.02] h-[420px] animate-pulse"></div>
        </div>
      </div>
    </template>

    <!-- ══════════════════ LOGUEADO: columna izquierda fija (Hero+Misión+Pase) + columna de contenido ══════════════════
         Mismo patrón de 2 columnas que ya usa Profile.vue (360px sticky + resto). En mobile/tablet
         (<lg) colapsa a una sola columna apilada — es el diseño que ya se validó ahí. ══════════════════ -->
    <template v-else>
      <div class="relative z-10 lg:max-w-6xl lg:mx-auto px-4 sm:px-6 pt-8 sm:pt-12 mb-20 lg:grid lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-6 lg:items-start lg:pt-8">

        <!-- Columna izquierda: Hero + Misión de hoy + Pase, sticky en desktop -->
        <div class="flex flex-col gap-6 lg:sticky lg:top-24">
          <!-- Hero: anillo de progreso + racha + stats de un vistazo -->
          <div class="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900/70 to-slate-800/40 p-6 sm:p-8 shadow-xl shadow-black/30">
            <div class="pointer-events-none absolute -top-16 -right-16 w-64 h-64 rounded-full opacity-20" style="background: radial-gradient(circle, rgba(99,102,241,0.5), transparent 70%);"></div>
            <div class="pointer-events-none absolute -bottom-16 -left-16 w-64 h-64 rounded-full opacity-10" style="background: radial-gradient(circle, rgba(168,85,247,0.45), transparent 70%);"></div>
            <div class="relative flex flex-col items-center text-center">
              <!-- Avatar sin anillo envolvente: el ícono es un cuadrado con
                   esquinas redondeadas (squircle), y un anillo circular alrededor
                   se veía roto/descentrado contra esa forma. El progreso al
                   próximo nivel ahora va como barra fina, pegada al pill de nivel. -->
              <div class="relative shrink-0">
                <UserAvatar
                  :size="88"
                  :avatar-url="home.avatarUrl"
                  :initial="(home.name || '?')[0]?.toUpperCase()"
                  :frame-key="home.frameKey"
                  :icon-glyph="home.iconGlyph"
                  :icon-bg="home.iconBg"
                  :frame-premium="home.framePremium"
                />
                <div v-if="home.dailyStreak > 0" class="absolute -top-2 -right-2 flex items-center gap-0.5 rounded-full bg-slate-950 ring-2 ring-amber-400/60 px-2 py-1 shadow-lg">
                  <svg class="w-3.5 h-3.5 text-amber-400" viewBox="0 0 24 24" fill="currentColor"><path d="M12 23c-3.6 0-8-3.1-8-8.5C4 9 8 4 11.5 1c.2-.1.4-.1.5 0 .2.1.2.3.1.5C11 4 14 6 14 6s1-1.5 1.5-4c0-.2.2-.3.4-.3s.3.1.4.3C18 5 20 9 20 14.5 20 19.9 15.6 23 12 23z"/></svg>
                  <span class="text-amber-300 font-extrabold text-xs leading-none">{{ home.dailyStreak }}</span>
                </div>
              </div>

              <div class="mt-2.5 flex flex-col items-center gap-1.5">
                <div class="inline-flex whitespace-nowrap rounded-full bg-slate-950 border border-violet-400/60 px-3 py-1 text-xs font-extrabold text-violet-400 shadow-lg shadow-indigo-500/20">
                  NIVEL {{ home.level }}
                </div>
                <div class="w-20 h-1 rounded-full bg-black/30 overflow-hidden" :title="home.levelPercent + '% al próximo nivel'">
                  <div class="h-full rounded-full bg-gradient-to-r from-indigo-400 to-purple-400 transition-all duration-500" :style="{ width: home.levelPercent + '%' }"></div>
                </div>
              </div>
              <h1 class="font-display text-2xl sm:text-3xl font-bold text-white leading-tight mt-2 truncate max-w-full">Hola{{ home.name ? ', ' + home.name : '' }}</h1>

              <!-- Stats de un vistazo: rango · logros ganados/total · puesto en el ranking -->
              <div class="grid grid-cols-3 gap-2 w-full max-w-xs mt-5 pt-5 border-t border-white/10 items-center">
                <button
                  type="button"
                  class="group flex items-center justify-center"
                  :title="`${tierLabel} — ver todos los rangos`"
                  @click="showProgression = true"
                >
                  <img v-if="tier?.image" :src="tier.image" :alt="tierLabel" width="48" height="48" class="w-12 h-12 transition-transform group-hover:scale-110 drop-shadow-[0_0_8px_rgba(167,139,250,0.35)]" />
                </button>
                <RouterLink to="/profile" class="group flex flex-col items-center gap-1">
                  <span class="font-display text-base font-extrabold text-violet-300 group-hover:text-violet-200 transition-colors">{{ home.achievementsEarned }}/{{ home.achievementsTotal }}</span>
                  <span class="text-[10px] text-slate-400 font-semibold group-hover:text-violet-300 transition-colors">Logros</span>
                </RouterLink>
                <RouterLink to="/leaderboards" class="group flex flex-col items-center gap-1">
                  <span class="font-display text-base font-extrabold text-violet-300 group-hover:text-violet-200 transition-colors">{{ home.rank ? '#' + home.rank : '—' }}</span>
                  <span class="text-[10px] text-slate-400 font-semibold group-hover:text-violet-300 transition-colors">Ranking</span>
                </RouterLink>
              </div>

              <RouterLink to="/play/points" class="mt-5 w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 px-8 py-3.5 font-bold text-white text-base shadow-lg shadow-indigo-500/30 transition-all hover:scale-105 hover:shadow-indigo-500/50 active:scale-95">
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/></svg>
                Jugar ahora
              </RouterLink>
            </div>
          </div>

          <!-- Misión de hoy -->
          <RouterLink v-if="home.challengesTotal > 0" to="/rewards" class="group block rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5 transition-colors hover:border-amber-400/30">
            <div class="flex items-center gap-3">
              <div class="w-11 h-11 sm:w-12 sm:h-12 rounded-xl grid place-items-center bg-amber-500/10 border border-amber-400/25 text-amber-300 shrink-0">
                <svg class="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4"/><path d="M5 4h13l-3 4 3 4H5"/></svg>
              </div>
              <div class="min-w-0">
                <div class="font-display font-bold text-white text-[15px]">Misión de hoy</div>
                <div class="text-slate-400 text-[11.5px] truncate">{{ missionSubtitle }}</div>
              </div>
            </div>

            <!-- Cada desafío de hoy como item propio: tick + tachado si ya se completó -->
            <div class="mt-3.5 space-y-2">
              <div v-for="c in home.challenges" :key="c.code" class="flex items-center gap-2.5">
                <span
                  class="shrink-0 w-4 h-4 rounded-full grid place-items-center"
                  :class="c.progress >= c.target ? 'bg-gradient-to-br from-amber-300 to-amber-500' : 'border border-white/15'"
                >
                  <svg v-if="c.progress >= c.target" class="w-2.5 h-2.5 text-slate-900" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>
                </span>
                <span class="flex-1 min-w-0 text-[12.5px] truncate" :class="c.progress >= c.target ? 'text-slate-500 line-through' : 'text-slate-200'">{{ c.title }}</span>
                <span v-if="c.progress < c.target" class="text-[10px] text-slate-500 font-semibold shrink-0 tabular-nums">{{ Math.min(c.progress, c.target) }}/{{ c.target }}</span>
              </div>
            </div>
            <div class="mt-3.5 text-center rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-slate-900 font-extrabold text-[12.5px] py-2.5 group-hover:brightness-105 transition">
              Ver recompensas de hoy
            </div>
          </RouterLink>

          <!-- Pase de Batalla: card real del pase (teaser + modal + datos propios). min-h reserva espacio (CLS) -->
          <div class="min-h-[200px]">
            <MonthlyPass compact />
          </div>
        </div>

        <!-- Columna derecha: Jugá hoy, Top jugador, Planes -->
        <div class="flex flex-col gap-12 mt-10 lg:mt-0 min-w-0">
          <!-- Jugá hoy: rail en mobile/tablet, grid en desktop (hay lugar para verlos todos) -->
          <div>
            <div class="flex items-center justify-between gap-3 mb-6">
              <h2 class="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">Jugá hoy</h2>
              <RouterLink to="/play/points" class="group inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-violet-400 transition-colors">
                Ver todos
                <svg class="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
              </RouterLink>
            </div>

            <div v-if="state.loading" class="flex gap-3 overflow-x-hidden lg:grid lg:grid-cols-4 lg:gap-4">
              <div v-for="i in 4" :key="i" class="rounded-2xl border border-white/10 bg-slate-900/50 overflow-hidden animate-pulse h-[184px] w-[140px] shrink-0 lg:w-auto"></div>
            </div>
            <div v-else class="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 lg:grid lg:grid-cols-4 lg:gap-4 lg:overflow-visible lg:mx-0 lg:px-0 stagger-grid">
              <template v-for="g in state.featuredGames" :key="g.slug">
                <div class="w-[140px] shrink-0 lg:w-auto">
                  <GameCard
                    :game="g"
                    :unlocked="isGameUnlocked(g.slug, home.level)"
                    :unlock-level="getGameUnlockLevel(g.slug)"
                    :availability="state.availability[g.slug]"
                    :streak="state.streaks[g.slug] || 0"
                    :to="toChallenge(g.slug)"
                  />
                </div>
              </template>
            </div>
          </div>

          <!-- Top jugador -->
          <TopJugadorCard :spotlight="spotlight" :is-authenticated="true" @set-period="setSpotlightPeriod" />

          <!-- Partidos de hoy -->
          <TodayMatchesGrid :matches="todayMatches" :loading="state.loadingTicker" />

          <!-- Planes -->
          <div>
            <h2 class="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight mb-6">Mejorá tu plan</h2>
            <div v-if="sortedPlans.length" class="grid grid-cols-1 md:grid-cols-3 gap-6">
              <PlanCard v-for="plan in sortedPlans" :key="plan.slug" :plan="plan" :current-plan="currentPlan" @subscribe="goToPricing" />
            </div>
            <div v-else class="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div v-for="i in 3" :key="i" class="rounded-2xl border border-white/10 bg-white/[0.02] h-[420px] animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <LevelProgressionModal v-if="showProgression" :current-level="home.level" @close="showProgression = false" />
  </section>
</template>

<style scoped>
/* Rompe el max-width/padding de <main> para que el hero ocupe el 100% del
   viewport. Ver comentario de .full-bleed en MatchTicker.vue: --fb-shift
   corrige el corrimiento que introduce el gutter de la sidebar de amigos. */
.hero-fullbleed {
  width: 100vw;
  position: relative;
  left: 50%;
  margin-left: calc(-50vw + var(--fb-shift, 0px));
}
/* Fondo del hero de invitado: usado siempre (video, si hay, se superpone encima) */
.hero-aurora {
  background: var(--mb-950, #070a1a);
  overflow: hidden;
}
.hero-aurora::before,
.hero-aurora::after {
  content: '';
  position: absolute;
  width: 60vw;
  max-width: 520px;
  aspect-ratio: 1;
  border-radius: 50%;
  filter: blur(40px);
  opacity: .5;
}
.hero-aurora::before {
  background: radial-gradient(circle, rgba(129,140,248,.55), transparent 70%);
  top: -18%;
  left: -12%;
  animation: hero-drift-a 14s ease-in-out infinite;
}
.hero-aurora::after {
  background: radial-gradient(circle, rgba(192,132,252,.45), transparent 70%);
  bottom: -20%;
  right: -10%;
  animation: hero-drift-b 17s ease-in-out infinite;
}
@keyframes hero-drift-a {
  0%, 100% { transform: translate(0, 0); }
  50% { transform: translate(4%, 3%); }
}
@keyframes hero-drift-b {
  0%, 100% { transform: translate(0, 0); }
  50% { transform: translate(-4%, -3%); }
}
/* El video queda como textura secundaria, no protagonista: más oscuro y
   desaturado, para que el texto sea lo primero que se lea. */
.hero-video {
  filter: brightness(.55) saturate(.7) contrast(1.05);
}
/* Degradé oscuro por encima del video/aurora: garantiza legibilidad del texto
   sea cual sea el contenido de fondo. */
.hero-scrim {
  background: linear-gradient(180deg, rgba(7,10,26,.65) 0%, rgba(7,10,26,.8) 45%, rgba(7,10,26,.95) 100%);
}
/* Fundido final del hero: mismo color exacto que el fondo del <body> (#0b1220),
   para que el borde del hero se disuelva en vez de cortar en seco. */
.hero-fade-out {
  background: linear-gradient(180deg, transparent 0%, #0b1220 90%);
}
@media (prefers-reduced-motion: reduce) {
  .hero-aurora::before, .hero-aurora::after { animation: none; }
}
</style>
