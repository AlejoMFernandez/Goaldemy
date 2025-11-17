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
  <section class="relative min-h-[calc(100vh-12rem)] flex flex-col items-center justify-center overflow-hidden py-12 md:py-20">
    <!-- Aurora scoped to Home only -->
    <div aria-hidden="true" class="aurora-root">
      <div class="accent"></div>
    </div>
    
    <!-- Hero section -->
    <div class="relative z-10 max-w-4xl mx-auto px-6 mb-16 md:mb-24">
      <div class="space-y-6 text-center">
        <AppH1>Bienvenido a Goaldemy</AppH1>
        <p class="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
          Juega minijuegos de fútbol, gana XP, desbloquea logros y sube en el ranking. 
          Personaliza tu perfil y compite con la comunidad.
        </p>
        <div class="flex flex-wrap gap-4 pt-6 justify-center">
          <RouterLink to="/play/points" class="rounded-xl bg-[oklch(0.62_0.21_270)] px-6 py-3 font-semibold text-white transition hover:bg-[oklch(0.55_0.21_270)] hover:scale-105 shadow-lg hover:shadow-[oklch(0.62_0.21_270)]/50">
            Ver juegos
          </RouterLink>
          <RouterLink to="/leaderboards" class="rounded-xl border border-white/10 px-6 py-3 font-semibold text-slate-200 transition hover:border-white/20 hover:text-white hover:bg-white/5 backdrop-blur">
            Top global
          </RouterLink>
          <RouterLink to="/register" class="rounded-xl border border-white/10 px-6 py-3 font-semibold text-slate-200 transition hover:border-white/20 hover:text-white hover:bg-white/5 backdrop-blur">
            Crear cuenta
          </RouterLink>
        </div>
      </div>
    </div>

    <!-- Features grid -->
    <div class="relative z-10 max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
      <!-- Feature 1: Games -->
      <div class="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/60 backdrop-blur-sm p-8 transition-all hover:border-emerald-400/30 hover:shadow-xl hover:shadow-emerald-500/10 hover:-translate-y-1">
        <div class="mb-4 inline-flex rounded-xl bg-emerald-500/10 p-3 ring-1 ring-emerald-400/20">
          <svg class="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 class="text-xl font-bold text-white mb-3">Minijuegos épicos</h3>
        <p class="text-slate-400 leading-relaxed">
          8 modos diferentes para poner a prueba tu conocimiento futbolístico. Desde adivinar jugadores hasta ordenar estadísticas.
        </p>
      </div>

      <!-- Feature 2: Progression -->
      <div class="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/60 backdrop-blur-sm p-8 transition-all hover:border-indigo-400/30 hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1">
        <div class="mb-4 inline-flex rounded-xl bg-indigo-500/10 p-3 ring-1 ring-indigo-400/20">
          <svg class="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h3 class="text-xl font-bold text-white mb-3">Sistema de progresión</h3>
        <p class="text-slate-400 leading-relaxed">
          Gana XP, sube de nivel, desbloquea logros épicos y compite por badges especiales como TOP 1, 2 y 3 del ranking global.
        </p>
      </div>

      <!-- Feature 3: Community -->
      <div class="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/60 backdrop-blur-sm p-8 transition-all hover:border-cyan-400/30 hover:shadow-xl hover:shadow-cyan-500/10 hover:-translate-y-1">
        <div class="mb-4 inline-flex rounded-xl bg-cyan-500/10 p-3 ring-1 ring-cyan-400/20">
          <svg class="w-8 h-8 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <h3 class="text-xl font-bold text-white mb-3">Comunidad activa</h3>
        <p class="text-slate-400 leading-relaxed">
          Conectá con otros jugadores, armá tu red de contactos, y chateá en tiempo real sobre tus partidos y estadísticas.
        </p>
      </div>
    </div>
  </section>
</template>