<script>
import AppNavBar from './components/AppNavBar.vue';
import AppFooter from './components/AppFooter.vue';
import FriendsDock from './components/FriendsDock.vue';
import AppToast from './components/AppToast.vue';
import AppSplash from './components/common/AppSplash.vue';
import BrandedBackground from './components/BrandedBackground.vue';
import AchievementUnlockOverlay from './components/rewards/AchievementUnlockOverlay.vue';
import LevelUpOverlay from './components/rewards/LevelUpOverlay.vue';
import CosmeticUnlockOverlay from './components/rewards/CosmeticUnlockOverlay.vue';
import ProWelcomeOverlay from './components/rewards/ProWelcomeOverlay.vue';
import ClaimNotificationStack from './components/rewards/ClaimNotificationStack.vue';
import { authReady } from './services/auth';
import { setSuppressOverlays } from './stores/notifications';
import { installPresence, setPresenceGame } from './services/presence';
import { sidebarState } from './stores/sidebar';
import { captureReferralFromUrl } from './services/referral';

// ── Transiciones entre pantallas (Moodboard 06) ──
// Pestañas principales en el orden en que aparecen: ir "hacia adelante" entra
// desde la derecha y volver entra desde la izquierda.
const TAB_ORDER = ['/', '/play/points', '/rewards', '/tienda', '/leaderboards', '/competiciones', '/teams', '/profile']
function tabIndex(path) {
  if (!path) return -1
  if (path === '/') return 0
  for (let i = TAB_ORDER.length - 1; i > 0; i--) if (path === TAB_ORDER[i] || path.startsWith(TAB_ORDER[i] + '/')) return i
  return -1
}
const isGamePath = (p) => /^\/games\//.test(p || '')
const SPLASH_SEEN_KEY = 'fulvo:splash_seen'

// Cache en memoria del módulo de arte de juegos: por lo general ya está
// "tibio" (GamePoster.vue lo importa de forma estática en el índice), así
// que esta importación dinámica resuelve casi al instante en el caso real
// (el usuario ve el índice antes de tocar un juego). Solo la primerísima
// navegación a un juego de la sesión (sin pasar antes por el índice) puede
// no tener el color/arte listo a tiempo y usar el degradé dorado de reserva.
let gameArtModule = null
function loadGameArt() {
  if (gameArtModule) return
  import('./services/game-art').then(m => { gameArtModule = m }).catch(() => {})
}

export default {
  name: 'App',
  components: {
    AppNavBar,
    AppFooter,
    AppToast,
    AppSplash,
    FriendsDock,
    BrandedBackground,
    AchievementUnlockOverlay,
    LevelUpOverlay,
    CosmeticUnlockOverlay,
    ProWelcomeOverlay,
    ClaimNotificationStack,
  },
  data() {
    return {
      authBooting: true,
      splashMinDelayDone: false, // tiempo mínimo del splash para que la animación no "flashee"
      splashQuick: false,  // ya entró antes → splash corto (0,9 s)
      splashSlow: false,   // la sesión tarda → "Preparando la cancha"
      routeTransition: 'fade-slide',
      curtainKey: 0,       // cortina al entrar a un juego (crece desde el póster tocado)
      curtainStyle: null,
      curtainArt: '',      // arte de línea del póster del juego, para que la cortina no sea un color liso
      isLg: false,        // desktop ≥1024px → reservar ancho de la sidebar
      _mqlSidebar: null,
    }
  },
  computed: {
    // Splash de arranque en frío: se apaga recién cuando auth resolvió Y pasó el
    // tiempo mínimo de animación. Mientras tanto el resto de la app ya se monta
    // debajo (oculto) para camuflar la carga real de componentes/datos.
    showSplash() {
      return this.authBooting || !this.splashMinDelayDone
    },
    isAuthLayout() {
      return this.$route?.meta?.layout === 'auth'
    },
    // Zona Hub (home, perfil, juegos, precios...): fondo sólido continuo entre
    // header y contenido, sin el gradiente+aurora emerald/cyan del resto de la
    // app — misma superficie única que ya se validó en Auth.
    isHubZone() {
      return this.$route?.meta?.zone === 'hub'
    },
    // Rutas de juego inmersivas (GameShell): el <main> pierde el padding vertical
    // para que el juego ocupe todo el alto visible sin pedir scroll.
    isImmersive() {
      return !!this.$route?.meta?.immersive
    },
    // Reserva el ancho de la sidebar en desktop → el contenido "corta" en la barra
    // y nunca queda por debajo. Sin sesión o en /login no reserva nada.
    hasSidebar() {
      return !this.isAuthLayout && sidebarState.hasUser
    },
    // Reserva el ancho de la sidebar (300px) SOLO en desktop y con sesión.
    // Inline (no Tailwind ni scoped CSS) → garantizado, sin sorpresas de cascada.
    shellStyle() {
      // --fb-shift: corrección constante para los elementos "full-bleed"
      // (MatchTicker, hero de invitado, banner de perfil — cualquiera sea su
      // anidamiento). El truco width:100vw + left:50% + margin-left:-50vw
      // asume que <main> queda centrado simétrico en el viewport; el gutter
      // derecho de la sidebar (84px vs 24px del lado izquierdo) lo corre del
      // centro una constante = (padding-right - padding-left)/2, sin importar
      // el ancho del contenedor local (por eso esta única variable alcanza
      // para cualquier nivel de anidamiento). Sumada al -50vw de cada full-bleed,
      // recentra el elemento exactamente en el borde real del viewport.
      const fbVars = { '--fb-shift': (this.hasSidebar && this.isLg) ? '30px' : '0px' }
      // Card flotante de amigos a la derecha en desktop: ya no es una columna
      // full-height, sino una card centrada y separada del borde. Reservamos un
      // gutter fino (~72px = ancho card + inset) para que el contenido no quede
      // tapado por la card. La lista completa + chat son un drawer desplegable.
      if (this.hasSidebar && this.isLg) return { ...fbVars, paddingRight: '84px' }
      // Mobile/tablet (<lg): el cluster flotante de amigos (desafíos + bug + amigos,
      // fixed bottom-5 right-4) mide ~164px de alto real. Reservamos abajo para que
      // no tape contenido que caiga en la esquina inferior derecha (ej. la última
      // card del grid de "Jugá hoy" en Home). No aplica en juegos inmersivos: ahí
      // el shell pide py-0 a propósito (ocupa 100dvh sin scroll).
      if (this.hasSidebar && !this.isImmersive) return { ...fbVars, paddingBottom: '104px' }
      return fbVars
    }
  },
  beforeUnmount() {
    window.removeEventListener('pointerdown', this._onTap, { capture: true })
    this._mqlSidebar?.removeEventListener('change', this._onMq)
  },
  methods: {
    pickTransition(to, from) {
      const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      if (!from?.matched?.length || reduce) { this.routeTransition = reduce ? 'route-fade' : 'fade-slide'; return }
      const toGame = isGamePath(to.path), fromGame = isGamePath(from.path)
      if (toGame && !fromGame) {
        this.routeTransition = 'route-game-in'
        // Cortina que crece desde el póster tocado (o desde el centro), con
        // el color y el arte de línea de ESE juego — no un color liso — para
        // que se sienta como el póster agrandándose (moodboard 06).
        const r = (Date.now() - (this._lastTapAt || 0) < 1500) ? this._lastTapRect : null
        const vw = window.innerWidth, vh = window.innerHeight
        const box = r && r.width > 0 ? r : { top: vh / 2 - 60, left: vw / 2 - 60, width: 120, height: 120 }
        const slug = (to.path.match(/^\/games\/([a-z0-9-]+)/) || [])[1] || ''
        const meta = gameArtModule?.GAME_POSTER_META?.[slug]
        this.curtainStyle = {
          '--ct': Math.max(0, box.top) + 'px',
          '--cl': Math.max(0, box.left) + 'px',
          '--cr': Math.max(0, vw - box.left - box.width) + 'px',
          '--cb': Math.max(0, vh - box.top - box.height) + 'px',
          '--c1': meta?.c1 || '#fde68a',
          '--c2': meta?.c2 || '#b45309',
        }
        this.curtainArt = gameArtModule?.GAME_ART?.[slug] || ''
        this.curtainKey++
        return
      }
      if (fromGame && !toGame) { this.routeTransition = 'route-game-out'; return }
      const a = tabIndex(from.path), b = tabIndex(to.path)
      if (a >= 0 && b >= 0 && a !== b) { this.routeTransition = b > a ? 'route-tab-fwd' : 'route-tab-back'; return }
      this.routeTransition = 'fade-slide'
    },
  },
  async mounted() {
    // Referidos: si llegó con ?ref=CODIGO (link compartido por otro usuario), lo
    // guardamos ANTES de que arranque nada más — funciona aunque todavía no haya sesión.
    captureReferralFromUrl()
    // Track desktop breakpoint para reservar el ancho de la sidebar.
    this._mqlSidebar = window.matchMedia('(min-width: 1024px)')
    this.isLg = this._mqlSidebar.matches
    this._onMq = (e) => { this.isLg = e.matches }
    this._mqlSidebar.addEventListener('change', this._onMq)
    // Transición según de dónde a dónde se navega. Se recuerda lo último que se
    // tocó para que la cortina dorada nazca de la tarjeta del juego.
    this._lastTapRect = null
    this._onTap = (e) => {
      const el = e.target?.closest?.('a, button, [role="button"]')
      this._lastTapRect = el ? el.getBoundingClientRect() : null
      this._lastTapAt = Date.now()
    }
    window.addEventListener('pointerdown', this._onTap, { capture: true, passive: true })
    this.$router.beforeEach((to, from) => { this.pickTransition(to, from) })
    loadGameArt()
    // Mínimo ~2.2s de splash: da tiempo a la secuencia de marca completa (ícono
    // entra, después el wordmark "FULVO") antes de revelar la app, aunque la
    // sesión resuelva casi al instante. Debe cubrir la duración de las animaciones
    // en AppSplash.vue (ícono 0.8s + wordmark delay 1.1s + wordmark 0.7s ≈ 1.8s)
    // más un pequeño respiro para que se lea el logo completo.
    // Si ya entró antes, la misma escena comprimida (~0,9 s).
    try { this.splashQuick = localStorage.getItem(SPLASH_SEEN_KEY) === '1'; localStorage.setItem(SPLASH_SEEN_KEY, '1') } catch {}
    setTimeout(() => { this.splashMinDelayDone = true }, this.splashQuick ? 900 : 2200)
    setTimeout(() => { if (this.authBooting) this.splashSlow = true }, 2600)
    try { await authReady; } finally { this.authBooting = false }
    import('./services/players').then(m => m.initializePlayers?.()).catch(() => {})
    // Bienvenida PRO ANTES de la lluvia de cosméticos: si el usuario recién se hizo
    // PRO, primero ve el popup de beneficios y recién al cerrarlo se destapan los cosméticos.
    try {
      const notif = await import('./stores/notifications')
      await notif.maybeShowProWelcome?.()
    } catch {}
    import('./services/cosmetics').then(m => m.checkCosmeticUnlocks?.()).catch(() => {})
    // Modo Carrera: mismo cierre de loop que el Reto del día, para invitados que se registran.
    import('./services/career').then(m => m.claimPendingCareerReward?.()).catch(() => {})
    // Referidos: si vino con un código pendiente y ya está logueado + verificado,
    // reparte las Fichas a él y a quien lo invitó (cierra el loop del share incentivado).
    import('./services/referral').then(m => m.claimPendingReferral?.()).catch(() => {})
    // Modo invitado en juegos reales: cierra el loop de invitado → registro → recompensa real.
    import('./services/guest-play').then(m => m.claimPendingGuestReward?.()).catch(() => {})
    installPresence()
    this.$watch(() => this.$route?.path, (path) => {
      setSuppressOverlays(false)
      const m = (path || '').match(/^\/games\/([^/?#]+)/)
      setPresenceGame(m ? m[1] : null)
    }, { immediate: true })
  }
}
</script>

<template>
  <div class="relative min-h-screen text-slate-100" :class="isHubZone ? 'bg-[#0b1220]' : 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800'">
    <BrandedBackground v-if="!isHubZone" />
    <!-- Shell del contenido: el rail de amigos reserva 60px SOLO en el contenido
         (main + footer), no en el header → el navbar ocupa el 100% del ancho. -->
    <div class="min-h-screen min-w-0 transition-[padding] duration-300"
         :class="isAuthLayout ? 'grid grid-rows-[1fr]' : 'grid grid-rows-[auto_1fr_auto]'">
      <AppNavBar v-if="!isAuthLayout" />
      <main :style="shellStyle" :class="isAuthLayout ? 'relative z-10 min-h-0 lg:min-h-screen min-w-0 grid place-items-center px-4 py-0 lg:py-8' : (isImmersive ? 'relative z-10 w-full min-w-0 max-w-[1600px] mx-auto px-3 sm:px-6 py-0' : 'relative z-10 w-full min-w-0 max-w-[1600px] mx-auto px-6 py-10 lg:py-12')">
        <RouterView v-if="!authBooting" v-slot="{ Component, route }">
          <Transition :name="routeTransition" mode="out-in">
            <!-- w-full lg:w-auto solo en el layout de auth (login/register):
                 <main> centra este wrapper con place-items-center, que por
                 default también lo ENCOGE al ancho de su contenido
                 (justify-items:center) en vez de estirarlo — en mobile eso
                 dejaba el AuthPage completo angosto y centrado, con "bordes"
                 visibles a los costados aunque sus hijos ya cancelaran el
                 padding con -mx-4. En desktop se deja encoger (w-auto) para
                 que la card de max-w-4xl siga centrándose sola. -->
            <div :key="route.meta?.authGroup || route.path" class="route-shell" :class="isAuthLayout ? 'w-full lg:w-auto' : ''">
              <component :is="Component" />
            </div>
          </Transition>
        </RouterView>
      </main>
      <AppFooter v-if="!isAuthLayout && !isImmersive" :style="shellStyle" />
    </div>
    <AppToast />
    <AchievementUnlockOverlay />
    <LevelUpOverlay />
    <CosmeticUnlockOverlay />
    <ProWelcomeOverlay />
    <ClaimNotificationStack />
    <FriendsDock v-if="!isAuthLayout" />
    <div v-if="curtainKey" :key="curtainKey" class="route-curtain" :style="curtainStyle" aria-hidden="true" @animationend="curtainKey = 0">
      <span v-if="curtainArt" class="route-curtain-art" v-html="curtainArt"></span>
    </div>
    <Transition name="splash-fade">
      <AppSplash v-if="showSplash" :quick="splashQuick" :slow="splashSlow" />
    </Transition>
  </div>
</template>

<style>
/* ── Transiciones entre pantallas (Moodboard 06) ── */
/* Pestañas con dirección: 240 ms */
.route-tab-fwd-leave-active, .route-tab-back-leave-active { transition: opacity 120ms ease, transform 120ms ease; }
.route-tab-fwd-enter-active, .route-tab-back-enter-active { transition: opacity 240ms ease, transform 240ms cubic-bezier(.16, 1, .3, 1); }
.route-tab-fwd-leave-to { opacity: 0; transform: translateX(-18px); }
.route-tab-fwd-enter-from { opacity: 0; transform: translateX(28px); }
.route-tab-back-leave-to { opacity: 0; transform: translateX(18px); }
.route-tab-back-enter-from { opacity: 0; transform: translateX(-28px); }
/* Entrar a un juego: la tarjeta crece como cortina dorada (450 ms) y el juego aparece detrás */
.route-game-in-leave-active { transition: opacity 160ms ease; }
.route-game-in-leave-to { opacity: 0; }
.route-game-in-enter-active { transition: opacity 300ms ease 60ms, transform 380ms cubic-bezier(.16, 1, .3, 1) 60ms; }
.route-game-in-enter-from { opacity: 0; transform: scale(.94); }
/* Volver de un juego: inverso (320 ms) */
.route-game-out-leave-active { transition: opacity 140ms ease, transform 140ms ease; }
.route-game-out-leave-to { opacity: 0; transform: scale(.97); }
.route-game-out-enter-active { transition: opacity 320ms ease, transform 320ms cubic-bezier(.16, 1, .3, 1); }
.route-game-out-enter-from { opacity: 0; transform: scale(1.03); }
/* Movimiento reducido: fundidos de 120 ms */
.route-fade-enter-active, .route-fade-leave-active { transition: opacity 120ms ease; }
.route-fade-enter-from, .route-fade-leave-to { opacity: 0; }

.route-curtain {
  position: fixed; inset: 0; z-index: 90; pointer-events: none; overflow: hidden;
  background: radial-gradient(120% 90% at 50% 40%, var(--c1, #fde68a) 0%, var(--c2, #b45309) 100%);
  clip-path: inset(var(--ct, 45%) var(--cr, 45%) var(--cb, 45%) var(--cl, 45%) round 18px);
  animation: route-curtain 450ms cubic-bezier(.7, 0, .3, 1) forwards;
}
.route-curtain-art { position: absolute; left: 50%; top: 50%; width: min(70vmin, 520px); aspect-ratio: 200 / 170;
  transform: translate(-50%, -50%) scale(.5); opacity: 0; animation: route-curtain-art 450ms cubic-bezier(.7, 0, .3, 1) forwards; }
.route-curtain-art :deep(svg) { width: 100%; height: 100%; }
@keyframes route-curtain { 0% { opacity: .9; } 55% { clip-path: inset(0 0 0 0 round 0); opacity: 1; } 100% { clip-path: inset(0 0 0 0 round 0); opacity: 0; } }
@keyframes route-curtain-art { 0% { opacity: 0; transform: translate(-50%, -50%) scale(.5); } 55% { opacity: .9; transform: translate(-50%, -50%) scale(1); } 100% { opacity: 0; transform: translate(-50%, -50%) scale(1.15); } }
@media (prefers-reduced-motion: reduce) { .route-curtain { display: none; } }
</style>
