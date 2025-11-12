<script>
import AppH1 from '../components/AppH1.vue';

export default {
  name: 'Home',
  components: {
    AppH1
  }
}
</script>

<template>
  <section class="relative grid place-items-center h-full overflow-hidden">
    <!-- Aurora scoped to Home only -->
    <div aria-hidden="true" class="aurora-root">
      <div class="accent"></div>
    </div>
    <div class="space-y-4 text-center max-w-2xl">
      <AppH1>Bienvenido a Goaldemy</AppH1>
      <p class="text-slate-300">Juega minijuegos de fútbol, gana XP, desbloquea logros y sube en el ranking. Personaliza tu perfil y compite con la comunidad.</p>
      <div class="flex gap-3 pt-2 justify-center">
        <RouterLink to="/play/points" class="rounded-xl bg-[oklch(0.62_0.21_270)] px-5 py-2.5 font-semibold text-white transition hover:bg-[oklch(0.55_0.21_270)]">Ver juegos</RouterLink>
        <RouterLink to="/leaderboards" class="rounded-xl border border-white/10 px-5 py-2.5 font-semibold text-slate-200 transition hover:border-white/20 hover:text-white">Top global</RouterLink>
        <RouterLink to="/register" class="rounded-xl border border-white/10 px-5 py-2.5 font-semibold text-slate-200 transition hover:border-white/20 hover:text-white">Crear cuenta</RouterLink>
      </div>
    </div>
  </section>
</template>