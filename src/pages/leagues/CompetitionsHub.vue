<script>
import { RouterLink } from 'vue-router'
import { competitionsByGroup, featuredCompetition, LEAGUE_LOGO } from '../../services/competitions'

export default {
  name: 'CompetitionsHub',
  components: { RouterLink },
  data() {
    return {
      groups: competitionsByGroup(),
      featured: featuredCompetition(),
    }
  },
  methods: {
    logo(id) { return LEAGUE_LOGO(id) },
    onLogoError(e) { e.target.style.visibility = 'hidden' },
    go(c) { if (c.status === 'live') this.$router.push(`/leagues/${c.slug}`) },
  },
}
</script>

<template>
  <div class="competitions-hub py-8 px-4">
    <div class="container mx-auto max-w-6xl">
      <!-- Page header -->
      <header class="mb-8">
        <span class="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-300/80">Explorá</span>
        <h1 class="mt-1 text-3xl sm:text-4xl font-display font-extrabold text-white">Competiciones</h1>
        <p class="mt-1.5 text-slate-400 text-sm sm:text-base">Ligas, copas y torneos — tablas, goleadores y brackets en un solo lugar.</p>
      </header>

      <!-- Featured (Mundial) -->
      <section v-if="featured" class="mb-10">
        <RouterLink
          :to="`/leagues/${featured.slug}`"
          class="group relative block overflow-hidden rounded-3xl border border-amber-400/25 bg-gradient-to-br from-amber-500/[0.12] via-slate-900 to-slate-900 p-6 sm:p-8 shadow-2xl transition hover:border-amber-300/50"
        >
          <!-- glow -->
          <div class="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-amber-400/15 blur-3xl"></div>
          <div class="relative flex flex-col sm:flex-row sm:items-center gap-5">
            <div class="flex h-20 w-20 flex-none items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-500/10 text-5xl shadow-inner">
              🏆
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span class="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                  <span class="relative flex h-1.5 w-1.5">
                    <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                    <span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                  </span>
                  En vivo
                </span>
                <span v-if="featured.bracket" class="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-300">Con bracket</span>
              </div>
              <h2 class="mt-2 text-2xl sm:text-3xl font-display font-extrabold text-white">{{ featured.name }}</h2>
              <p class="mt-0.5 text-amber-200/80 text-sm font-medium">{{ featured.tagline || featured.country }}</p>
            </div>
            <div class="flex-none">
              <span class="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 px-5 py-2.5 text-sm font-bold text-slate-900 shadow-lg shadow-amber-500/25 transition group-hover:brightness-110">
                Ver torneo
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
              </span>
            </div>
          </div>
        </RouterLink>
      </section>

      <!-- Groups -->
      <section v-for="group in groups" :key="group.key" class="mb-10 last:mb-0">
        <div class="mb-4 flex items-baseline justify-between">
          <div>
            <h3 class="text-lg font-display font-bold text-white">{{ group.title }}</h3>
            <p class="text-xs text-slate-500">{{ group.subtitle }}</p>
          </div>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          <component
            :is="c.status === 'live' ? 'RouterLink' : 'div'"
            v-for="c in group.items"
            :key="c.id"
            :to="c.status === 'live' ? `/leagues/${c.slug}` : undefined"
            class="group relative flex flex-col rounded-2xl border p-4 transition"
            :class="c.status === 'live'
              ? 'border-white/10 bg-slate-900/60 hover:border-emerald-400/40 hover:bg-slate-900/80 cursor-pointer'
              : 'border-white/5 bg-slate-900/40 opacity-70 cursor-default'"
          >
            <!-- logo + status -->
            <div class="flex items-start justify-between">
              <div class="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                <img :src="logo(c.id)" :alt="c.name" @error="onLogoError"
                     class="h-8 w-8 object-contain"
                     :class="c.status === 'live' ? '' : 'grayscale'" />
              </div>
              <span
                v-if="c.status === 'live'"
                class="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
                <span class="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Vivo
              </span>
              <span v-else class="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-500">Pronto</span>
            </div>

            <!-- name -->
            <div class="mt-3">
              <div class="font-display font-bold text-white leading-tight truncate">{{ c.name }}</div>
              <div class="text-xs text-slate-500">{{ c.country }}</div>
            </div>

            <!-- footer chips -->
            <div class="mt-3 flex items-center gap-1.5">
              <span v-if="c.bracket" class="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-400">Bracket</span>
              <span v-if="c.status === 'live'" class="ml-auto text-emerald-300/0 transition group-hover:text-emerald-300 text-xs font-semibold">Ver →</span>
            </div>
          </component>
        </div>
      </section>

      <!-- Footnote -->
      <p class="mt-8 text-center text-xs text-slate-600">
        ¿Falta tu torneo favorito? Estamos sumando más competiciones seguido.
      </p>
    </div>
  </div>
</template>
