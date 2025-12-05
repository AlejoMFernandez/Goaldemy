<script>
import AppNavBar from './components/AppNavBar.vue';
import AppFooter from './components/AppFooter.vue';
import DirectMessagesDock from './components/DirectMessagesDock.vue';
import Home from './pages/Home.vue';
import AppToast from './components/AppToast.vue';
import AppLoader from './components/AppLoader.vue';
import BrandedBackground from './components/BrandedBackground.vue';
import { authReady } from './services/auth';

export default {
  name: 'App',
  components: {
    Home,
    AppNavBar,
    AppFooter,
    AppToast,
    AppLoader,
    DirectMessagesDock,
    BrandedBackground,
  },
  data() {
    return {
      authBooting: true,
    }
  },
  computed: {
    isAuthLayout() {
      return this.$route?.meta?.layout === 'auth'
    }
  },
  async mounted() {
    try { await authReady; } finally { this.authBooting = false }
  }
}
</script>

<template>
  <div class="relative min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-slate-100" :class="isAuthLayout ? 'grid grid-rows-[1fr]' : 'grid grid-rows-[auto_1fr_auto]'">
    <BrandedBackground />
    <AppNavBar v-if="!isAuthLayout" />
    <main :class="isAuthLayout ? 'relative z-10 min-h-screen grid place-items-center px-4 py-8' : 'relative z-10 w-full max-w-[1600px] mx-auto px-6 py-10 lg:py-12'">
      <AppLoader v-if="authBooting" />
      <RouterView v-else />
    </main>
    <AppFooter v-if="!isAuthLayout" />
    <AppToast />
    <DirectMessagesDock v-if="!isAuthLayout" />
  </div>
</template>