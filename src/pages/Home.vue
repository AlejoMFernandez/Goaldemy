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
<<<<<<< HEAD
  <section class="grid place-items-center h-full">
    <div class="space-y-4">
      <AppH1>¡Hola!</AppH1>
      <p class="text-slate-300">Esta es la página de inicio.</p>
      <div class="flex gap-3 pt-2">
        <RouterLink to="/chat" class="rounded-xl bg-[oklch(0.62_0.21_270)] px-5 py-2.5 font-semibold text-white transition hover:bg-[oklch(0.55_0.21_270)]">Ir al Chat</RouterLink>
=======
  <section class="relative grid place-items-center h-full overflow-hidden">
    <!-- Aurora background -->
    <div aria-hidden="true" class="pointer-events-none absolute inset-0 -z-10">
      <div class="absolute -top-24 left-0 right-0 h-72 blur-3xl opacity-60"
           style="background: radial-gradient(60% 60% at 30% 40%, oklch(0.70 0.21 270 / 0.4), transparent), radial-gradient(50% 50% at 70% 60%, oklch(0.62 0.21 270 / 0.35), transparent)"></div>
      <div class="absolute bottom-0 left-0 right-0 h-72 blur-2xl opacity-40"
           style="background: radial-gradient(50% 50% at 20% 70%, oklch(0.55 0.21 270 / 0.35), transparent), radial-gradient(60% 60% at 80% 80%, oklch(0.70 0.21 270 / 0.25), transparent)"></div>
    </div>
    <div class="space-y-4 text-center max-w-2xl">
      <AppH1>Bienvenido a Goaldemy</AppH1>
      <p class="text-slate-300">Juega minijuegos de fútbol, gana XP, desbloquea logros y sube en el ranking. Personaliza tu perfil y compite con la comunidad.</p>
      <div class="flex gap-3 pt-2 justify-center">
        <RouterLink to="/games" class="rounded-xl bg-[oklch(0.62_0.21_270)] px-5 py-2.5 font-semibold text-white transition hover:bg-[oklch(0.55_0.21_270)]">Ver juegos</RouterLink>
        <RouterLink to="/leaderboards" class="rounded-xl border border-white/10 px-5 py-2.5 font-semibold text-slate-200 transition hover:border-white/20 hover:text-white">Top global</RouterLink>
>>>>>>> d0aeee3 (Opciones en Registro, agregado de logros y fix de XP)
        <RouterLink to="/register" class="rounded-xl border border-white/10 px-5 py-2.5 font-semibold text-slate-200 transition hover:border-white/20 hover:text-white">Crear cuenta</RouterLink>
      </div>
    </div>
  </section>
</template>