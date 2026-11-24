<script setup>
import { onMounted, onUnmounted, reactive, computed, ref, defineAsyncComponent } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { supabase } from '../services/supabase'
import { getAuthUser } from '../services/auth'
import { fetchGames, gameRouteForSlug, friendlyNameForSlug, friendlyDescForSlug } from '../services/games'
import { getDailyChallenges, getDailyReward } from '../services/rewards'
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
import QuickPlayHero from '../components/home/QuickPlayHero.vue'
import { useUpcomingMatches } from '../components/home/useUpcomingMatches'
import { tapHaptic } from '../components/shell/shell-state'

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
  allGames: [],       // todos los juegos con ruta real (para invitado: cuáles se juegan sin cuenta)
})

// Sobre del día (teaser en la home logueada): solo el estado, se abre en /rewards.
const envelope = reactive({ loading: true, available: false })

// Juegos que se pueden jugar SIN cuenta: se deriva del router (rutas /games/*
// sin requiresAuth), no de una lista a mano → si mañana se abre otro juego a
// invitados, la home lo muestra sola.
const guestSlugs = new Set(
  router.getRoutes()
    .filter(r => /^\/games\/[a-z0-9-]+$/.test(r.path) && !r.meta?.requiresAuth)
    .map(r => r.path.replace('/games/', ''))
)
// Si el catálogo no llegó (red caída), igual se muestran con nombre local: un
// invitado nunca tiene que ver la sección vacía.
const guestGames = computed(() => {
  const fromDb = state.allGames.filter(g => guestSlugs.has(g.slug))
  if (fromDb.length) return fromDb
  return [...guestSlugs].map(slug => ({ id: slug, slug, name: friendlyNameForSlug(slug), description: friendlyDescForSlug(slug), cover_url: null }))
})
const lockedForGuest = computed(() => Math.max(0, state.totalGames - guestGames.value.length))
const guestPlayTo = computed(() => {
  const first = guestGames.value[0]?.slug || [...guestSlugs][0] || 'guess-player'
  return `${gameRouteForSlug(first)}?mode=challenge`
})
function playAsGuest() { tapHaptic(12); router.push(guestPlayTo.value) }

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

// Partidos (ticker de arriba + "Partidos de hoy"): misma lógica que Social →
// Fútbol (useUpcomingMatches). En mobile logueado no se piden: esa sección se
// mudó a Social → Fútbol y la home arranca directo con JUGAR RÁPIDO.
const { loading: loadingMatches, load: loadTickerMatches, matches: tickerMatches, todayMatches } = useUpcomingMatches()
const wantsMatches = () => !state.isAuthenticated || window.matchMedia('(min-width: 1024px)').matches

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
    state.allGames = playable
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

async function loadEnvelope() {
  envelope.loading = true
  try { const r = await getDailyReward(); envelope.available = !!r?.available }
  catch { envelope.available = false }
  finally { envelope.loading = false }
}

let pollTimer = null
onMounted(() => {
  load()
  if (state.isAuthenticated) { loadUserHome(); loadEnvelope() }
  loadSpotlight()
  if (wantsMatches()) {
    loadTickerMatches()
    // Refrescar el ticker cada 60s (marcador + minuto en vivo)
    pollTimer = setInterval(() => loadTickerMatches(), 60000)
  }

  if (HERO_VIDEO_SRC) {
    const wideEnough = window.matchMedia('(min-width: 640px)').matches
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    showHeroVideo.value = wideEnough && !reducedMotion
  }
})
onUnmounted(() => { if (pollTimer) clearInterval(pollTimer) })
</script>

<template>
  <section class="relative min-h-dvh" :class="state.isAuthenticated ? '' : 'bg-[#0b1220]'">

    <!-- ══════════════════ Ticker de partidos (arriba de todo, para todos) ══════════════════ -->
    <!-- En mobile se oculta: la home tiene que arrancar con el CTA de juego. -->
    <div class="hidden lg:block">
      <MatchTicker :matches="tickerMatches" :loading="loadingMatches" />
    </div>

    <!-- ══════════════════ INVITADO: una sola columna, sin cambios de fondo ══════════════════ -->
    <template v-if="!state.isAuthenticated">
      <!-- Hero inmersivo full-bleed (video de fondo secundario + degradé) -->
      <div class="relative overflow-hidden hero-fullbleed -mt-6 lg:mt-0 mb-12 lg:mb-20 min-h-[460px] sm:min-h-[600px] flex items-center justify-center">
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
            <span class="block mb-4 text-sm sm:text-base font-semibold uppercase tracking-[0.35em] text-violet-300/80">FULVO</span>
            Jugá. Aprendé.<br />
            <span class="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">Dominá.</span>
          </h1>
          <p class="text-slate-300 max-w-md mx-auto text-base sm:text-lg leading-relaxed mt-6">
            FULVO es una app de micro-juegos de fútbol para entrenar tu conocimiento: adiviná jugadores, armá rachas, sumá logros y competí en el ranking.
          </p>
          <div class="flex flex-col sm:flex-row flex-wrap gap-3 justify-center items-stretch sm:items-center pt-8">
            <!-- CTA principal: jugar YA, sin registro (el resultado se reclama al crear la cuenta) -->
            <button type="button" class="guest-play-btn" @click="playAsGuest">
              <svg class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15a1 1 0 001.5.86l12.5-7.5a1 1 0 000-1.72L8.5 3.64A1 1 0 007 4.5z"/></svg>
              Jugar sin cuenta
            </button>
            <RouterLink to="/register" class="group rounded-xl bg-white px-7 py-3.5 font-semibold text-slate-900 text-sm text-center transition-all hover:shadow-lg hover:shadow-white/20 hover:scale-105 active:scale-95">
              Crear cuenta gratis
              <span class="inline-block ml-1 transition-transform group-hover:translate-x-0.5">→</span>
            </RouterLink>
            <RouterLink to="/login" class="rounded-xl px-6 py-3 font-semibold text-slate-300 text-sm text-center transition-all hover:text-white active:scale-95">
              Ya tengo cuenta
            </RouterLink>
          </div>
        </div>
      </div>

      <!-- Juegos que se juegan SIN cuenta (antes salían como "Bloqueado") -->
      <div class="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 mb-16 lg:mb-20">
        <h2 class="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">Jugá gratis, sin cuenta</h2>
        <p class="text-slate-400 text-sm mt-1 mb-6">Tocá y jugá. Si creás tu cuenta después, el resultado se te guarda.</p>
        <div v-if="!state.loading" class="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 stagger-grid">
          <GameCard v-for="g in guestGames" :key="g.slug" :game="g" :unlocked="true" :to="`${gameRouteForSlug(g.slug)}?mode=challenge`" />
          <!-- Modo Carrera: también público -->
          <RouterLink to="/carrera" class="career-card group relative flex flex-col justify-end overflow-hidden rounded-2xl border border-amber-400/30 p-4 min-h-[184px] active:scale-[.98] transition">
            <span class="absolute top-3 left-3 rounded-full bg-amber-400 text-slate-900 text-[10px] font-extrabold px-2 py-0.5 tracking-wide">CARRERA</span>
            <span class="font-display font-bold text-white text-lg leading-tight">Modo Carrera</span>
            <span class="text-xs text-amber-100/80 mt-1">Encadená aciertos sin fallar</span>
          </RouterLink>
        </div>
        <div v-else class="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          <div v-for="i in 4" :key="i" class="rounded-2xl border border-white/10 bg-slate-900/50 h-[184px] animate-pulse"></div>
        </div>
        <RouterLink v-if="lockedForGuest > 0" to="/register" class="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 min-h-[56px] text-sm hover:border-white/20 transition">
          <span class="text-slate-300"><span class="font-bold text-white">+{{ lockedForGuest }} modos más</span> con tu cuenta gratis</span>
          <span class="text-amber-300 font-bold">Crear cuenta →</span>
        </RouterLink>
      </div>

      <!-- Top jugador -->
      <div class="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 mb-20">
        <TopJugadorCard :spotlight="spotlight" :is-authenticated="false" @set-period="setSpotlightPeriod" />
      </div>

      <!-- Partidos de hoy -->
      <div class="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 mb-20">
        <TodayMatchesGrid :matches="todayMatches" :loading="loadingMatches" />
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
            <p class="text-slate-400 text-sm leading-relaxed">{{ state.totalGames ? state.totalGames + ' modos de juego únicos.' : 'Modos de juego únicos.' }} Adivinar jugadores, ordenar por valor, armar formaciones y más.</p>
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
      <div class="relative z-10 lg:max-w-6xl lg:mx-auto px-0 sm:px-6 -mt-4 lg:mt-0 pt-0 sm:pt-4 lg:pt-8 mb-10 lg:mb-20 lg:grid lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-6 lg:items-start lg:pt-8">

        <!-- Columna izquierda: Hero + Misión de hoy + Pase, sticky en desktop -->
        <div class="flex flex-col gap-5 lg:gap-6 lg:sticky lg:top-24">
          <!-- JUGAR RÁPIDO: primero de todo (mobile y desktop). Espera al nivel
               real para no ofrecer un juego todavía bloqueado. -->
          <QuickPlayHero v-if="!home.loading" :level="Number(home.level) || 1" />
          <div v-else class="h-[236px] rounded-3xl border border-amber-400/20 bg-white/[0.03] animate-pulse"></div>

          <!-- Hero de perfil: solo desktop. En mobile nivel/racha/avatar ya
               están en la top bar del shell. -->
          <div class="hidden lg:block relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900/70 to-slate-800/40 p-6 sm:p-8 shadow-xl shadow-black/30">
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
                Ver todos los juegos
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

          <!-- Sobre del día (teaser): se abre en el Centro de recompensas -->
          <RouterLink to="/rewards#sobre-del-dia" class="envelope-teaser group flex items-center gap-3.5 rounded-2xl border p-4 min-h-[76px] transition active:scale-[.98]"
            :class="envelope.available ? 'border-amber-400/40 bg-amber-500/[0.08]' : 'border-white/10 bg-white/[0.03]'">
            <span class="relative w-12 h-12 shrink-0 grid place-items-center rounded-xl" :class="envelope.available ? 'bg-amber-400/20 text-amber-300 env-wiggle' : 'bg-white/5 text-slate-500'">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>
              <span v-if="envelope.available" class="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-rose-500 ring-2 ring-[#0b1220]"></span>
            </span>
            <span class="min-w-0 flex-1">
              <span class="block font-display font-bold text-white text-[15px]">Sobre del día</span>
              <span class="block text-[12px]" :class="envelope.available ? 'text-amber-200/90' : 'text-slate-400'">
                {{ envelope.loading ? 'Revisando…' : (envelope.available ? '¡Listo para abrir! Tocá para reclamarlo' : 'Ya lo abriste. Volvé mañana por otro') }}
              </span>
            </span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-5 w-5 text-slate-500 group-hover:translate-x-0.5 transition-transform"><path d="M9 6l6 6-6 6"/></svg>
          </RouterLink>

          <!-- Pase de Batalla: card real del pase (teaser + modal + datos propios). min-h reserva espacio (CLS) -->
          <div class="min-h-[200px]">
            <MonthlyPass compact />
          </div>
        </div>

        <!-- Columna derecha: Jugá hoy, Top jugador, Planes -->
        <div class="flex flex-col gap-10 lg:gap-12 mt-8 lg:mt-0 min-w-0">
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
                    :user-level="Number(home.level) || 1"
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

          <!-- Partidos de hoy: en desktop acá; en mobile se mudó a Social → Fútbol -->
          <div class="hidden lg:block">
            <TodayMatchesGrid :matches="todayMatches" :loading="loadingMatches" />
          </div>
          <RouterLink to="/social?tab=futbol" class="lg:hidden flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 min-h-[64px]">
            <span class="w-10 h-10 grid place-items-center rounded-xl bg-emerald-500/15 text-emerald-300">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="w-5 h-5"><circle cx="12" cy="12" r="9"/><path d="M12 7l3 2.2-1.1 3.6h-3.8L9 9.2z"/></svg>
            </span>
            <span class="flex-1 min-w-0">
              <span class="block font-display font-bold text-white text-[15px]">Partidos de hoy</span>
              <span class="block text-[12px] text-slate-400">Resultados y fixtures en Social → Fútbol</span>
            </span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-5 w-5 text-slate-500"><path d="M9 6l6 6-6 6"/></svg>
          </RouterLink>

          <!-- Planes: solo desktop. En mobile están en la hoja de ajustes (Premium · Planes) y la Tienda. -->
          <div class="hidden lg:block">
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
/* CTA "Jugar sin cuenta": botón dorado gordo, mismo lenguaje que JUGAR RÁPIDO */
.guest-play-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 10px;
  min-height: 60px; padding: 0 28px; border-radius: 18px;
  font-family: var(--font-display); font-weight: 900; font-size: 19px; letter-spacing: .02em; color: #1c1206;
  background: linear-gradient(180deg, #fff3b0 0%, #fcd34d 38%, #f59e0b 100%);
  box-shadow: inset 0 2px 0 rgba(255,255,255,.7), 0 6px 0 #92400e, 0 14px 30px rgba(245,158,11,.4);
  transition: transform .1s ease, box-shadow .1s ease;
  animation: guest-pulse 1.9s ease-in-out infinite;
}
.guest-play-btn:active { transform: translateY(4px); box-shadow: inset 0 2px 0 rgba(255,255,255,.7), 0 2px 0 #92400e, 0 8px 18px rgba(245,158,11,.35); }
@keyframes guest-pulse { 50% { transform: scale(1.03); } }
.career-card { background: radial-gradient(120% 90% at 80% 0%, rgba(251,191,36,.35), transparent 60%), linear-gradient(160deg, #1e293b, #0b1220); }
.env-wiggle { animation: env-wiggle 2.8s ease-in-out infinite; }
@keyframes env-wiggle { 0%, 80%, 100% { transform: rotate(0); } 85% { transform: rotate(-8deg); } 90% { transform: rotate(7deg); } 95% { transform: rotate(-4deg); } }
@media (prefers-reduced-motion: reduce) {
  .hero-aurora::before, .hero-aurora::after { animation: none; }
  .guest-play-btn, .env-wiggle { animation: none; }
}
</style>
