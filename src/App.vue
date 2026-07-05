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
import ClaimNotificationStack from './components/rewards/ClaimNotificationStack.vue';
import { authReady } from './services/auth';
import { setSuppressOverlays } from './stores/notifications';
import { installPresence, setPresenceGame } from './services/presence';
import { sidebarState } from './stores/sidebar';

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
    // Reserva el ancho de la sidebar en desktop → el contenido "corta" en la barra
    // y nunca queda por debajo. Sin sesión o en /login no reserva nada.
    hasSidebar() {
      return !this.isAuthLayout && sidebarState.hasUser
    },
    // Reserva el ancho de la sidebar (300px) SOLO en desktop y con sesión.
    // Inline (no Tailwind ni scoped CSS) → garantizado, sin sorpresas de cascada.
    shellStyle() {
      return (this.hasSidebar && this.isLg) ? { paddingRight: '300px' } : {}
    }
  },
  async mounted() {
    // Track desktop breakpoint para reservar el ancho de la sidebar.
    this._mqlSidebar = window.matchMedia('(min-width: 1024px)')
    this.isLg = this._mqlSidebar.matches
    this._onMq = (e) => { this.isLg = e.matches }
    this._mqlSidebar.addEventListener('change', this._onMq)
    try { await authReady; } finally { this.authBooting = false }
    import('./services/players').then(m => m.initializePlayers?.()).catch(() => {})
    import('./services/cosmetics').then(m => m.checkCosmeticUnlocks?.()).catch(() => {})
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
    <!-- Shell del contenido: reserva el ancho de la sidebar en desktop -->
    <div class="min-h-screen transition-[padding] duration-300"
         :class="isAuthLayout ? 'grid grid-rows-[1fr]' : 'grid grid-rows-[auto_1fr_auto]'"
         :style="shellStyle">
      <AppNavBar v-if="!isAuthLayout" />
      <main :class="isAuthLayout ? 'relative z-10 min-h-screen grid place-items-center px-4 py-8' : 'relative z-10 w-full max-w-[1600px] mx-auto px-6 py-10 lg:py-12'">
        <AppLoader v-if="authBooting" />
        <RouterView v-else v-slot="{ Component, route }">
          <Transition name="fade-slide" mode="out-in">
            <div :key="route.path" class="route-shell">
              <component :is="Component" />
            </div>
          </Transition>
        </RouterView>
      </main>
      <AppFooter v-if="!isAuthLayout" />
    </div>
    <AppToast />
    <AchievementUnlockOverlay />
    <LevelUpOverlay />
    <CosmeticUnlockOverlay />
    <ClaimNotificationStack />
    <FriendsDock v-if="!isAuthLayout" />
  </div>
</template>
