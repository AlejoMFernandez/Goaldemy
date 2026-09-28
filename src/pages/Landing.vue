<script setup>
import { onMounted, onUnmounted, reactive, computed, ref, watch, defineAsyncComponent } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { supabase } from '../services/supabase'
import { getAuthUser } from '../services/auth'
import { fetchGames, gameRouteForSlug, friendlyNameForSlug, friendlyDescForSlug, KNOWN_GAME_SLUGS } from '../services/games'
import { getDailyChallenges, getDailyReward, getProgressiveChallenges } from '../services/rewards'
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
import { useJornada } from '../components/home/useJornada'
import HomeDay from '../components/home/HomeDay.vue'
import HomeTiles from '../components/home/HomeTiles.vue'
import GamePoster from '../components/game/GamePoster.vue'
import { pickMonthly } from '../components/missions/missions'
import { appDayStartIso, appToday } from '../services/app-date'
import { tap as tapHaptic } from '../services/haptics'

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
  frameKey: 'none', iconGlyph: '', iconBg: 'emerald', framePremium: false, frameStreak: 0,
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
        dailyStreak: cosmetics?.dailyStreak || 0,
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

// Logueado: mobile (<1024px) usa el Inicio V4; desktop mantiene las 2 columnas.
// v-if (no solo CSS) para no montar ni pedir datos de la versión que no se ve.
const desktopMq = typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)') : null
const isDesktop = ref(!!desktopMq?.matches)
const onMq = (e) => { isDesktop.value = e.matches }
watch(isDesktop, (d) => { if (d && state.isAuthenticated && !spotlight.top.length) loadSpotlight() })

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

// ══ Inicio logueado (diseño V4 · opción A) ══
// La jornada (juegos, ✓/✕, premios del día) sale de useJornada: mismos datos
// que el índice /play/points. También alimenta las cards de desktop.
const j = useJornada()
const toChallenge = (slug) => j.toChallenge(slug)

// "Te faltan hoy": los pendientes en el mismo orden que JUGAR RÁPIDO
// (primero los clásicos del día, después el resto del catálogo).
const quickList = computed(() => {
  const rank = (slug) => { const i = KNOWN_GAME_SLUGS.indexOf(slug); return i === -1 ? KNOWN_GAME_SLUGS.length : i }
  return [...j.todo.value].sort((a, b) => rank(a.slug) - rank(b.slug))
})
const quickNext = computed(() => quickList.value[0] || null)
function playQuick() {
  if (!quickNext.value) return
  tapHaptic()
  router.push(j.toChallenge(quickNext.value.slug))
}

// XP ganada hoy (suma de xp_events propios desde el inicio del día de la app).
// Solo lectura; si falla queda en null y la tarjeta muestra "—".
const xpToday = ref(null)
async function loadXpToday() {
  const { id } = getAuthUser() || {}
  if (!id) return
  try {
    const { data, error } = await supabase.from('xp_events').select('amount').eq('user_id', id).gte('created_at', appDayStartIso()).limit(2000)
    if (error) throw error
    xpToday.value = (data || []).reduce((a, r) => a + (Number(r.amount) || 0), 0)
  } catch (e) {
    console.warn('[Landing] xp de hoy', e)
    xpToday.value = null
  }
}

// Retos progresivos: el "Desafío del mes" (Evento) y los que hay para cobrar
const progressive = ref([])
async function loadProgressive() {
  try { const r = await getProgressiveChallenges(); progressive.value = Array.isArray(r) ? r : [] }
  catch { progressive.value = [] }
}
function daysLeftInMonth() {
  const [y, m, d] = appToday().split('-').map(Number)
  if (!y) return 0
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return Math.max(1, last - d + 1)
}
const homeTiles = computed(() => {
  const monthly = pickMonthly(progressive.value)
  const dailyClaim = (home.challenges || []).filter(c => !c.claimed && Number(c.progress) >= Number(c.target)).length
  const progClaim = progressive.value.filter(c => c.claimable).length
  const claim = dailyClaim + progClaim
  const days = daysLeftInMonth()
  return [
    monthly
      ? { key: 'evento', to: '/rewards?tab=misiones', title: 'Evento', sub: `${days} ${days === 1 ? 'día' : 'días'} · ${monthly.title}`, badge: monthly.claimable ? '!' : '' }
      : { key: 'pase', to: '/rewards?tab=pase', title: 'Abono', sub: 'Tu pase de temporada', badge: '' },
    { key: 'ranking', to: '/social?tab=ranking', title: 'Ranking', sub: home.rank ? `Sos #${home.rank} global` : 'Sumá XP y entrá', badge: '' },
    { key: 'sobre', to: '/rewards?tab=sobre', title: 'Sobre del día', sub: envelope.loading ? 'Revisando…' : (envelope.available ? 'Listo para abrir' : 'Mañana hay otro'), badge: envelope.available ? '!' : '' },
    { key: 'misiones', to: '/rewards?tab=misiones', title: 'Misiones', sub: claim > 0 ? `${claim} para cobrar` : (home.challengesTotal ? `${home.challengesDone}/${home.challengesTotal} de hoy` : 'Mirá las de hoy'), badge: claim > 0 ? String(claim) : '' },
  ]
})

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
      home.frameStreak = equipped.dailyStreak || 0
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
  desktopMq?.addEventListener?.('change', onMq)
  if (state.isAuthenticated) { loadUserHome(); loadEnvelope(); j.load(); loadXpToday(); loadProgressive() }
  // El podio "Top jugador" solo se ve en la versión invitado y en desktop
  if (!state.isAuthenticated || isDesktop.value) loadSpotlight()
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
onUnmounted(() => { if (pollTimer) clearInterval(pollTimer); desktopMq?.removeEventListener?.('change', onMq) })
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
      <!-- ══ MOBILE (diseño V4 · opción A): Tu día → Te faltan hoy + JUGAR RÁPIDO → 4 accesos ══ -->
      <div v-if="!isDesktop" class="home-v4">
        <HomeDay
          :loading="j.state.loading"
          :played="j.played.value.length"
          :total="j.total.value"
          :wins="j.wins.value"
          :losses="j.losses.value"
          :xp-today="xpToday"
          :milestones="j.milestones.value"
          :next="j.allDone.value ? null : j.nextMilestone.value"
          :reset-text="j.resetText.value"
        />

        <!-- Te faltan hoy + JUGAR RÁPIDO. Con la jornada completa queda un cartel chico con la cuenta regresiva. -->
        <section v-if="j.state.loading" class="hv-quick" aria-busy="true" aria-label="Preparando tu jornada">
          <div class="hv-head"><span class="hv-h">Te faltan hoy</span></div>
          <div class="hv-posters"><div v-for="i in 3" :key="i" class="hv-sk"></div></div>
          <div class="hv-sk hv-sk-btn"></div>
        </section>
        <section v-else-if="j.state.error" class="hv-done" role="alert">
          <span class="min-w-0 flex-1 text-[13px] text-slate-300">No pudimos armar tu jornada.</span>
          <button type="button" class="hv-retry" @click="j.load()">Reintentar</button>
        </section>
        <section v-else-if="j.allDone.value" class="hv-done" aria-label="Jornada completa">
          <span class="hv-done-ic" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
          </span>
          <span class="min-w-0 flex-1">
            <span class="hv-done-t">Jugaste los {{ j.total.value }} de hoy</span>
            <span class="hv-done-s">{{ j.wins.value }} {{ j.wins.value === 1 ? 'ganado' : 'ganados' }} · nuevos en <b class="tabular-nums">{{ j.resetText.value }}</b></span>
          </span>
          <RouterLink to="/play/points" class="hv-done-l">Ver</RouterLink>
        </section>
        <section v-else class="hv-quick" aria-label="Acceso rápido">
          <div class="hv-head">
            <h2 class="hv-h">Te faltan hoy</h2>
            <RouterLink to="/play/points" class="hv-all">Ver los {{ j.state.games.length }} juegos<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></RouterLink>
          </div>
          <div class="hv-posters">
            <RouterLink v-for="g in quickList.slice(0, 3)" :key="g.slug" :to="toChallenge(g.slug)" class="hv-poster" :aria-label="`${g.name}: jugar`">
              <GamePoster :slug="g.slug" :name="g.name" :streak="j.state.streaks[g.slug] || 0" />
            </RouterLink>
          </div>
          <button type="button" class="hv-play" :aria-label="quickNext ? `Jugar rápido: ${quickNext.name}` : 'Jugar rápido'" @click="playQuick">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4l13 8-13 8z"/></svg>JUGAR RÁPIDO
          </button>
        </section>

        <HomeTiles :tiles="homeTiles" :loading="home.loading" />
      </div>

      <div v-else class="relative z-10 lg:max-w-6xl lg:mx-auto px-0 sm:px-6 -mt-4 lg:mt-0 pt-0 sm:pt-4 lg:pt-8 mb-10 lg:mb-20 lg:grid lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-6 lg:items-start lg:pt-8">

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
                  :level="home.level"
                  :streak="home.frameStreak"
                />
                <RouterLink v-if="home.dailyStreak > 0" to="/racha" :aria-label="`Racha de ${home.dailyStreak} días: ver tu racha`" class="absolute -top-2 -right-2 flex items-center gap-0.5 rounded-full bg-slate-950 ring-2 ring-amber-400/60 px-2 py-1 shadow-lg hover:ring-amber-300 transition">
                  <svg class="w-3.5 h-3.5 text-amber-400" viewBox="0 0 24 24" fill="currentColor"><path d="M12 23c-3.6 0-8-3.1-8-8.5C4 9 8 4 11.5 1c.2-.1.4-.1.5 0 .2.1.2.3.1.5C11 4 14 6 14 6s1-1.5 1.5-4c0-.2.2-.3.4-.3s.3.1.4.3C18 5 20 9 20 14.5 20 19.9 15.6 23 12 23z"/></svg>
                  <span class="text-amber-300 font-extrabold text-xs leading-none">{{ home.dailyStreak }}</span>
                </RouterLink>
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
          <!-- Jugá hoy: grid en desktop (en mobile lo reemplaza la jornada de arriba) -->
          <div class="hidden lg:block">
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
                    :availability="j.state.availability[g.slug]"
                    :streak="j.state.streaks[g.slug] || 0"
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
/* ══ Inicio V4 (mobile) ══ */
.home-v4 { display: flex; flex-direction: column; gap: 16px; margin: -28px -10px 0; padding-bottom: 8px; color: #f1f5f9; }
.hv-quick { display: flex; flex-direction: column; gap: 10px; }
.hv-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.hv-h { margin: 0; font-family: var(--font-display); font-weight: 700; font-size: 18px; color: #fff; }
.hv-all { display: inline-flex; align-items: center; gap: 4px; min-height: 32px; font-size: 13px; font-weight: 700; color: #fbbf24; text-decoration: none; }
.hv-posters { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.hv-poster { display: block; border-radius: 14px; text-decoration: none; transition: transform .12s ease; }
.hv-poster:active { transform: scale(.97); }
.hv-poster:focus-visible { outline: 2px solid #fcd34d; outline-offset: 2px; }
.hv-play { min-height: 54px; border: 0; border-radius: 16px; background: linear-gradient(180deg, #fcd34d 0%, #f59e0b 100%); border-bottom: 4px solid #b45309; color: #1c1206; display: flex; align-items: center; justify-content: center; gap: 8px; font-family: var(--font-shout); font-weight: 800; font-style: italic; font-size: 24px; letter-spacing: 1px; cursor: pointer; animation: hv-pulse 2s ease-in-out infinite; -webkit-tap-highlight-color: transparent; }
.hv-play:active { transform: translateY(2px); border-bottom-width: 2px; }
@keyframes hv-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(251, 191, 36, .45); } 50% { box-shadow: 0 0 0 8px rgba(251, 191, 36, 0); } }
.hv-sk { aspect-ratio: 4 / 5; border-radius: 14px; background: rgba(255, 255, 255, .05); animation: hv-sk 1.4s ease-in-out infinite; }
.hv-sk-btn { aspect-ratio: auto; height: 54px; border-radius: 16px; }
@keyframes hv-sk { 50% { opacity: .5; } }
.hv-done { display: flex; align-items: center; gap: 12px; min-height: 64px; padding: 10px 12px; border-radius: 16px; border: 1px solid rgba(52, 211, 153, .3); background: linear-gradient(135deg, rgba(34, 197, 94, .16), #111a2e 60%); }
.hv-done-ic { width: 40px; height: 40px; flex: none; border-radius: 50%; display: grid; place-items: center; background: #22c55e; color: #fff; }
.hv-done-t { display: block; font-family: var(--font-shout); font-weight: 800; font-size: 19px; line-height: 1; text-transform: uppercase; color: #fff; }
.hv-done-s { display: block; margin-top: 3px; font-size: 12px; color: #cbd5e1; }
.hv-done-s b { color: #fde68a; }
.hv-done-l, .hv-retry { min-height: 44px; min-width: 44px; padding: 0 12px; display: grid; place-items: center; border-radius: 12px; border: 1px solid rgba(255, 255, 255, .14); background: rgba(255, 255, 255, .05); color: #e2e8f0; font-weight: 700; font-size: 13px; text-decoration: none; cursor: pointer; }
@media (prefers-reduced-motion: reduce) {
  .hero-aurora::before, .hero-aurora::after { animation: none; }
  .guest-play-btn, .env-wiggle, .hv-play, .hv-sk { animation: none; }
}
</style>
