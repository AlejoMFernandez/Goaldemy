<script setup>
import { onMounted, onUnmounted, reactive, computed, ref, defineAsyncComponent } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { supabase } from '../services/supabase'
import { getAuthUser } from '../services/auth'
import { fetchGames, gameRouteForSlug } from '../services/games'
import { LEAGUES, getUpcomingMatches } from '../services/fotmob'
import { getDailyChallenges, getDailyReward, getMonthlyPass } from '../services/rewards'
import { getUserLevel, getLeaderboard } from '../services/xp'
import { getEquippedCosmetics } from '../services/cosmetics'
import { getTierForLevel, tierAccentText } from '../services/tiers'
import { getGameUnlockLevel, isGameUnlocked } from '../services/level-rewards'
import { fetchPlans, getUserPlan } from '../services/premium'
import UserAvatar from '../components/common/UserAvatar.vue'
import GameCard from '../components/game/GameCard.vue'
import MatchTicker from '../components/home/MatchTicker.vue'

// Video de fondo del hero (local, optimizado — ver public/videoshero/).
// Vacío = se usa el fondo con degradé en vez de video.
const HERO_VIDEO_SRC = '/videoshero/hero-aerial.mp4'
const HERO_VIDEO_POSTER = '/videoshero/hero-aerial-poster.jpg'
// Async: pase y planes bajan en su propio chunk (deps pesadas fuera del
// bundle inicial de la home). MonthlyPass trae su card + modal + datos.
const MonthlyPass = defineAsyncComponent(() => import('../components/rewards/MonthlyPass.vue'))
const PlanCard = defineAsyncComponent(() => import('../components/pricing/PlanCard.vue'))

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
// Config visual del podio: orden de render 2-1-3, tamaños/alturas decrecientes por rango.
const podiumSlots = computed(() => ([
  { rank: 2, player: spotlight.top[1], avatarSize: 72, pedestal: 'h-12', badge: 'bg-slate-300 text-slate-900' },
  { rank: 1, player: spotlight.top[0], avatarSize: 96, pedestal: 'h-20', badge: 'bg-amber-400 text-slate-900' },
  { rank: 3, player: spotlight.top[2], avatarSize: 72, pedestal: 'h-8', badge: 'bg-orange-600 text-white' },
].filter(s => s.player)))

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
    leagueLogo: `https://images.fotmob.com/image_resources/logo/leaguelogo/${m.league.id}.png`,
    homeId: m.homeTeamId, homeName: m.homeTeam,
    awayId: m.awayTeamId, awayName: m.awayTeam,
    homeScore, awayScore,
    isLive: live,
    statusText: m.status?.finished ? 'FIN' : new Date(m.date).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }),
  }
}))

// Video de fondo del hero: se descarga solo en pantallas grandes y si el
// usuario no pidió menos movimiento — nunca se pide el archivo en mobile.
const showHeroVideo = ref(false)

// Rango/categoría por nivel (fuente única en tiers.js) para el hero
const tier = computed(() => getTierForLevel(home.level))
const tierLabel = computed(() => tier.value?.label || '')
const tierAccent = computed(() => tierAccentText(tier.value?.color))

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

    <!-- ══════════════════ HERO + Top jugador ══════════════════ -->
    <!-- Logueado: glow ambiental compartido de fondo (antes vivía duplicado dentro de cada card).
         overflow-hidden solo cuando hay blobs que contener: para invitado clipeaba el hero
         full-bleed (que necesita desbordar hacia los costados hasta el borde real). -->
    <div class="relative" :class="state.isAuthenticated ? 'overflow-hidden' : ''">
      <template v-if="state.isAuthenticated">
        <div class="pointer-events-none absolute -top-10 -right-24 w-80 h-80 sm:w-96 sm:h-96 rounded-full opacity-20" style="background: radial-gradient(circle, rgba(99,102,241,0.5), transparent 70%);"></div>
        <div class="pointer-events-none absolute -bottom-10 -left-24 w-80 h-80 sm:w-96 sm:h-96 rounded-full opacity-10" style="background: radial-gradient(circle, rgba(168,85,247,0.45), transparent 70%);"></div>
      </template>

    <!-- Invitado: hero inmersivo full-bleed (video de fondo secundario + degradé) -->
    <div v-if="!state.isAuthenticated" class="relative overflow-hidden hero-fullbleed mb-20 min-h-[520px] sm:min-h-[600px] flex items-center justify-center">
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

    <!-- Logueado: hero XL estilo lobby (avatar grande + JUGAR + Tu día) — sin cambios -->
    <div v-else class="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 mb-20">
      <div class="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900/70 to-slate-800/40 p-6 sm:p-8 shadow-xl shadow-black/30">
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
            <div class="absolute -bottom-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-slate-950 border border-violet-400/60 px-3 py-1 text-xs font-extrabold text-violet-400 shadow-lg shadow-indigo-500/20">
              NIVEL {{ home.level }}
            </div>
          </div>

          <!-- Identidad + CTA -->
          <div class="flex-1 min-w-0 w-full text-center sm:text-left">
            <p class="text-[11px] uppercase tracking-[0.22em] text-slate-500 mb-1">Bienvenido de vuelta</p>
            <h1 class="font-display text-2xl sm:text-4xl font-bold text-white leading-tight truncate">Hola{{ home.name ? ', ' + home.name : '' }}</h1>
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
              <RouterLink to="/play/points" class="group inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 px-8 py-3.5 font-bold text-white text-base shadow-lg shadow-indigo-500/30 transition-all hover:scale-105 hover:shadow-indigo-500/50 active:scale-95">
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
            <span class="text-[10px] uppercase tracking-wider text-slate-500 group-hover:text-violet-400 transition-colors">Jugados hoy</span>
            <span class="font-display text-xl font-bold text-white mt-0.5">{{ home.playedToday }}<span class="text-slate-600 text-sm">/{{ state.totalGames || '—' }}</span></span>
          </RouterLink>
          <div class="flex flex-col items-center px-2">
            <span class="text-[10px] uppercase tracking-wider text-slate-500">Racha</span>
            <span class="font-display text-xl font-bold text-white mt-0.5">{{ home.dailyStreak }} <span class="text-slate-500 text-sm font-semibold">días</span></span>
          </div>
          <RouterLink to="/rewards" class="group relative flex flex-col items-center px-2 transition">
            <span class="text-[10px] uppercase tracking-wider transition-colors" :class="home.rewardsToClaim > 0 ? 'text-amber-300' : 'text-slate-500 group-hover:text-amber-300'">Recompensas</span>
            <span class="font-display text-xl font-bold mt-0.5" :class="home.rewardsToClaim > 0 ? 'text-amber-300' : 'text-white'">{{ home.rewardsToClaim }}</span>
            <span v-if="home.rewardsToClaim > 0" class="absolute -top-1 right-1 w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
          </RouterLink>
        </div>
      </div>
    </div>

    <!-- ══════════════════ Top jugador (semana/mes) — podio Top 3, ya no clona el hero ══════════════════ -->
    <!-- min-h reserva espacio para que el footer no salte cuando carga (CLS) -->
    <div class="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 mb-20 min-h-[260px]">
      <div class="flex items-center justify-between gap-3 mb-6">
        <h2 class="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">Top jugador</h2>
        <div class="inline-flex rounded-xl border border-white/10 bg-white/5 p-1 shrink-0">
          <button
            @click="setSpotlightPeriod('weekly')"
            :class="['px-3 py-1.5 text-xs font-semibold rounded-lg transition', spotlight.period === 'weekly' ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white' : 'text-slate-400 hover:text-white']"
          >Semana</button>
          <button
            @click="setSpotlightPeriod('monthly')"
            :class="['px-3 py-1.5 text-xs font-semibold rounded-lg transition', spotlight.period === 'monthly' ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white' : 'text-slate-400 hover:text-white']"
          >Mes</button>
        </div>
      </div>

      <!-- Loading skeleton: solo en la carga inicial, sin dato previo que mostrar -->
      <div v-if="spotlight.loading && !spotlight.top.length" class="rounded-3xl border border-white/10 bg-slate-900/40 h-[220px] animate-pulse"></div>

      <!-- Podio: al cambiar de período se atenúa en el lugar, nunca cambia de tamaño -->
      <div
        v-else-if="spotlight.top.length"
        class="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900/70 to-slate-800/40 p-6 sm:p-8 transition-opacity duration-200"
        :class="spotlight.loading ? 'opacity-40 pointer-events-none' : 'opacity-100'"
      >
        <!-- Invitado: este glow es local (no hay hero logueado del que "heredar" el de fondo) -->
        <template v-if="!state.isAuthenticated">
          <div class="pointer-events-none absolute -top-24 -right-20 w-72 h-72 rounded-full opacity-20" style="background: radial-gradient(circle, rgba(99,102,241,0.55), transparent 70%);"></div>
          <div class="pointer-events-none absolute -bottom-28 -left-16 w-72 h-72 rounded-full opacity-10" style="background: radial-gradient(circle, rgba(168,85,247,0.5), transparent 70%);"></div>
        </template>

        <p class="relative text-[11px] uppercase tracking-[0.2em] text-slate-500 text-center mb-6">
          {{ spotlight.period === 'weekly' ? 'Top jugador de la semana' : 'Top jugador del mes' }}
        </p>

        <div class="relative flex items-end justify-center gap-3 sm:gap-6">
          <div v-for="slot in podiumSlots" :key="slot.rank" class="flex flex-col items-center">
            <div class="relative">
              <UserAvatar
                :size="slot.avatarSize"
                :avatar-url="slot.player.avatarUrl"
                :initial="(slot.player.name || '?')[0]?.toUpperCase()"
                :frame-key="slot.player.frameKey"
                :icon-glyph="slot.player.iconGlyph"
                :icon-bg="slot.player.iconBg"
                :frame-premium="slot.player.framePremium"
              />
              <div class="absolute -top-1.5 -right-1.5 grid place-items-center w-6 h-6 rounded-full text-xs font-black shadow-lg" :class="slot.badge">{{ slot.rank }}</div>
            </div>
            <p class="mt-2 text-sm sm:text-base font-bold text-white truncate max-w-[100px] sm:max-w-[130px] text-center">{{ slot.player.name }}</p>
            <p class="text-[11px] text-slate-500 mt-0.5 whitespace-nowrap">Nivel {{ slot.player.level }} · {{ slot.player.xp.toLocaleString('es-AR') }} XP</p>
            <!-- El pedestal solo tiene sentido si hay más de uno para comparar -->
            <div v-if="podiumSlots.length > 1" class="mt-3 w-16 sm:w-20 rounded-t-xl bg-white/5 border-t border-white/10" :class="slot.pedestal"></div>
          </div>
        </div>

        <div class="relative mt-6 text-center">
          <RouterLink to="/leaderboards" class="inline-flex items-center gap-1.5 rounded-xl border border-white/15 px-5 py-2.5 font-semibold text-slate-200 text-sm transition-all hover:border-white/25 hover:bg-white/5 active:scale-95">
            Ver ranking completo →
          </RouterLink>
        </div>
      </div>

      <!-- Sin actividad suficiente todavía -->
      <div v-else class="rounded-2xl border border-white/10 bg-slate-900/40 p-10 text-center">
        <p class="text-slate-300 font-medium">Todavía no hay suficiente actividad para armar el ranking {{ spotlight.period === 'weekly' ? 'semanal' : 'mensual' }}</p>
      </div>
    </div>
    </div>

    <!-- ══════════════════ Juegos ══════════════════ -->
    <!-- Logueado: cards idénticas al índice de juegos -->
    <div v-if="state.isAuthenticated" class="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 mb-20">
      <div class="flex items-center justify-between gap-3 mb-6">
        <h2 class="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">Jugá hoy</h2>
        <RouterLink to="/play/points" class="group inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-violet-400 transition-colors">
          Ver todos
          <svg class="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
        </RouterLink>
      </div>

      <div v-if="state.loading" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        <div v-for="i in 4" :key="i" class="rounded-2xl border border-white/10 bg-slate-900/50 overflow-hidden animate-pulse h-[184px]"></div>
      </div>
      <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 stagger-grid">
        <template v-for="g in state.featuredGames" :key="g.slug">
          <GameCard
            :game="g"
            :unlocked="isGameUnlocked(g.slug, home.level)"
            :unlock-level="getGameUnlockLevel(g.slug)"
            :availability="state.availability[g.slug]"
            :streak="state.streaks[g.slug] || 0"
            :to="toChallenge(g.slug)"
          />
        </template>
      </div>
    </div>

    <!-- Invitado: juegos destacados bloqueados (panel de conversión) -->
    <div v-else class="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 mb-20">
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

    <!-- ══════════════════ ¿Cómo funciona? (solo invitados) — formato editorial, sin cards ══════════════════ -->
    <div v-if="!state.isAuthenticated" class="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 mb-20">
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

    <!-- ══════════════════ Pase de Batalla (solo logueado) ══════════════════ -->
    <!-- Card real del pase (teaser + modal + datos propios). min-h reserva espacio (CLS) -->
    <div v-if="state.isAuthenticated" class="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 mb-20 min-h-[240px]">
      <MonthlyPass />
    </div>

    <!-- ══════════════════ Planes (compartido) ══════════════════ -->
    <div class="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 mb-20">
      <h2 class="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight mb-6">{{ state.isAuthenticated ? 'Mejorá tu plan' : 'Elegí tu plan' }}</h2>
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
