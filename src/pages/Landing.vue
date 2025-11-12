<script>
import { SUBSCRIPTION_PACKAGES, formatPrice } from '../services/subscriptions';
export default {
  name: 'Landing',
  data() {
    return { packages: SUBSCRIPTION_PACKAGES };
  },
  methods: { formatPrice }
}
</script>

<template>
  <div class="space-y-28 relative">

    <!-- Hero -->
    <section class="pt-8 sm:pt-16 text-center max-w-4xl mx-auto px-2">
      <h1 class="text-4xl sm:text-6xl font-extrabold tracking-tight leading-tight bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-indigo-400 to-purple-400">
        Aprendizaje gamificado <span class="text-white">de Fútbol</span>
      </h1>
      <p class="mt-6 text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto">
        Convertí tu pasión por el fútbol en progreso real: <span class="font-semibold text-slate-200">XP</span>, <span class="font-semibold text-slate-200">insignias</span>, <span class="font-semibold text-slate-200">rangos</span> y micro‑desafíos diarios que te mantienen avanzando.
      </p>
      <div class="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
        <RouterLink to="/register" class="rounded-xl bg-[oklch(0.62_0.21_270)] px-8 py-3 font-semibold text-white shadow hover:bg-[oklch(0.55_0.21_270)] transition">Crear cuenta</RouterLink>
        <RouterLink to="/login" class="rounded-xl border border-white/15 px-8 py-3 font-semibold text-slate-200 hover:text-white hover:border-white/30 transition">Iniciar sesión</RouterLink>
        <RouterLink to="/play/free" class="rounded-xl border border-white/15 px-8 py-3 font-semibold text-slate-200 hover:text-white hover:border-white/30 transition">Probar juegos</RouterLink>
      </div>
    </section>

    <!-- Three info cards -->
    <section class="max-w-6xl mx-auto px-2">
      <div class="grid gap-6 md:grid-cols-3">
        <div v-for="card in [
          { title: 'Aprendizaje activo', body: 'Jugás mientras incorporás datos, posiciones y contexto histórico. Cada respuesta entrena memoria y rapidez.' },
          { title: 'Progreso visible', body: 'Rachas, logros y rangos te muestran tu evolución y mantienen la motivación encendida.' },
          { title: 'Comunidad competitiva', body: 'Tablas globales y mini‑ligas te conectan con otros apasionados del fútbol.' }
        ]" :key="card.title" class="card backdrop-blur card-hover p-6 flex flex-col">
          <h3 class="text-xl font-bold mb-3">{{ card.title }}</h3>
          <p class="text-slate-300 leading-relaxed text-sm">{{ card.body }}</p>
        </div>
      </div>
    </section>

    <!-- Subscription packages -->
    <section class="max-w-6xl mx-auto px-2 pb-12">
      <div class="text-center max-w-3xl mx-auto mb-10">
        <h2 class="text-3xl sm:text-4xl font-extrabold">Elegí tu ritmo</h2>
        <p class="mt-4 text-slate-300">Tres niveles para avanzar: libre, acelerado o máximo desafío competitivo.</p>
      </div>
      <div class="grid gap-6 md:grid-cols-3">
        <div v-for="p in packages" :key="p.id" class="relative card backdrop-blur card-hover p-6 flex flex-col">
          <div v-if="p.popular" class="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-indigo-500 to-purple-500 text-xs font-bold tracking-wide px-3 py-1 rounded-full shadow">POPULAR</div>
          <h3 class="text-lg font-bold flex items-center gap-2">
            <span>{{ p.name }}</span>
          </h3>
          <p class="mt-1 text-sm text-slate-400">{{ p.tagline }}</p>
          <div class="mt-4 text-3xl font-extrabold">
            <span>{{ formatPrice(p.priceMonthly) }}</span>
            <span v-if="p.priceMonthly" class="text-sm font-semibold text-slate-400">/mes</span>
          </div>
          <p class="mt-2 text-xs uppercase tracking-wide text-brand-400 font-semibold">{{ p.highlight }}</p>
          <ul class="mt-4 space-y-2 text-sm text-slate-300 flex-1">
            <li v-for="f in p.features" :key="f" class="flex gap-2 items-center">
              <span class="w-2 h-2 rounded-full bg-cyan-400"></span>
              <span>{{ f }}</span>
            </li>
          </ul>
          <RouterLink :to="p.ctaTo" class="mt-6 rounded-lg px-5 py-2.5 font-semibold text-center transition" :class="p.popular ? 'bg-[oklch(0.62_0.21_270)] hover:bg-[oklch(0.55_0.21_270)] text-white' : 'border border-white/15 hover:border-white/30 text-slate-200 hover:text-white'">{{ p.cta }}</RouterLink>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.text-brand-400 { color: var(--brand-400); }
</style>
