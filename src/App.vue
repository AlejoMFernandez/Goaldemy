<script>
import AppNavBar from './components/AppNavBar.vue';
import AppFooter from './components/AppFooter.vue';
import FriendsDock from './components/FriendsDock.vue';
import AppToast from './components/AppToast.vue';
import AppLoader from './components/common/AppLoader.vue';
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

export default {
  name: 'App',
  components: {
    AppNavBar,
    AppFooter,
    AppToast,
    AppLoader,
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
      isLg: false,        // desktop ≥1024px → reservar ancho de la sidebar
      _mqlSidebar: null,
    }
  },
  computed: {
    isAuthLayout() {
      return this.$route?.meta?.layout === 'auth'
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
      // Card flotante de amigos a la derecha en desktop: ya no es una columna
      // full-height, sino una card centrada y separada del borde. Reservamos un
      // gutter fino (~72px = ancho card + inset) para que el contenido no quede
      // tapado por la card. La lista completa + chat son un drawer desplegable.
      if (this.hasSidebar && this.isLg) return { paddingRight: '84px' }
      // Mobile/tablet (<lg): el cluster flotante de amigos (desafíos + bug + amigos,
      // fixed bottom-5 right-4) mide ~164px de alto real. Reservamos abajo para que
      // no tape contenido que caiga en la esquina inferior derecha (ej. la última
      // card del grid de "Jugá hoy" en Home). No aplica en juegos inmersivos: ahí
      // el shell pide py-0 a propósito (ocupa 100dvh sin scroll).
      if (this.hasSidebar && !this.isImmersive) return { paddingBottom: '104px' }
      return {}
    }
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
    try { await authReady; } finally { this.authBooting = false }
    import('./services/players').then(m => m.initializePlayers?.()).catch(() => {})
    // Bienvenida PRO ANTES de la lluvia de cosméticos: si el usuario recién se hizo
    // PRO, primero ve el popup de beneficios y recién al cerrarlo se destapan los cosméticos.
    try {
      const notif = await import('./stores/notifications')
      await notif.maybeShowProWelcome?.()
    } catch {}
    import('./services/cosmetics').then(m => m.checkCosmeticUnlocks?.()).catch(() => {})
    // Reto del día: si el usuario venía de jugar como invitado y ahora está logueado,
    // otorgar de verdad la XP + Fichas que se le mostraron (cierra el loop del funnel).
    import('./services/daily-reto').then(m => m.claimPendingRetoReward?.()).catch(() => {})
    // Modo Carrera: mismo cierre de loop que el Reto del día, para invitados que se registran.
    import('./services/career').then(m => m.claimPendingCareerReward?.()).catch(() => {})
    // Referidos: si vino con un código pendiente y ya está logueado + verificado,
    // reparte las Fichas a él y a quien lo invitó (cierra el loop del share incentivado).
    import('./services/referral').then(m => m.claimPendingReferral?.()).catch(() => {})
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
  <div class="relative min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-slate-100">
    <BrandedBackground />
    <!-- Shell del contenido: el rail de amigos reserva 60px SOLO en el contenido
         (main + footer), no en el header → el navbar ocupa el 100% del ancho. -->
    <div class="min-h-screen min-w-0 transition-[padding] duration-300"
         :class="isAuthLayout ? 'grid grid-rows-[1fr]' : 'grid grid-rows-[auto_1fr_auto]'">
      <AppNavBar v-if="!isAuthLayout" />
      <main :style="shellStyle" :class="isAuthLayout ? 'relative z-10 min-h-screen min-w-0 grid place-items-center px-4 py-8' : (isImmersive ? 'relative z-10 w-full min-w-0 max-w-[1600px] mx-auto px-3 sm:px-6 py-0' : 'relative z-10 w-full min-w-0 max-w-[1600px] mx-auto px-6 py-10 lg:py-12')">
        <AppLoader v-if="authBooting" />
        <RouterView v-else v-slot="{ Component, route }">
          <Transition name="fade-slide" mode="out-in">
            <div :key="route.meta?.authGroup || route.path" class="route-shell">
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
  </div>
</template>
