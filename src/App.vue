<script>
import AppNavBar from './components/AppNavBar.vue';
import AppFooter from './components/AppFooter.vue';
import Home from './pages/Home.vue';
import AppToast from './components/AppToast.vue';

export default {
  name: 'App',
  components: {
    Home,
    AppNavBar,
    AppFooter,
    AppToast,
  }
}
</script>

<template>
  <div class="min-h-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-slate-100 grid grid-rows-[70px_1fr_68px]">
    <AppNavBar />
    <main class="container mx-auto px-4 py-8">
      <RouterView />
    </main>
    <AppFooter />
    <AppToast />
  </div>
</template>