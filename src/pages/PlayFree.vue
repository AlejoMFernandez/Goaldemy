<script setup>
import { onMounted, reactive } from 'vue'
import { RouterLink } from 'vue-router'
import { fetchGames, gameRouteForSlug } from '../services/games'

const state = reactive({ games: [], loading: true })

async function load() {
  state.loading = true
  const all = await fetchGames()
  state.games = (all || []).filter(g => !!g?.slug && gameRouteForSlug(g.slug) !== '/games')
  state.loading = false
}
onMounted(load)

function toFree(slug) {
  return `${gameRouteForSlug(slug)}?mode=free`
}

const GAME_META = {
  'guess-player':    { topBar: 'bg-emerald-400/50', iconBg: 'bg-emerald-400/10 ring-1 ring-emerald-400/20', iconColor: 'text-emerald-400', hoverBorder: 'hover:border-emerald-400/25',
    paths: ['M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z'] },
  'who-is':          { topBar: 'bg-violet-400/50', iconBg: 'bg-violet-400/10 ring-1 ring-violet-400/20', iconColor: 'text-violet-400', hoverBorder: 'hover:border-violet-400/25',
    paths: ['M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z', 'M15 12a3 3 0 11-6 0 3 3 0 016 0z'] },
  'nationality':     { topBar: 'bg-cyan-400/50', iconBg: 'bg-cyan-400/10 ring-1 ring-cyan-400/20', iconColor: 'text-cyan-400', hoverBorder: 'hover:border-cyan-400/25',
    paths: ['M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418'] },
  'player-position': { topBar: 'bg-sky-400/50', iconBg: 'bg-sky-400/10 ring-1 ring-sky-400/20', iconColor: 'text-sky-400', hoverBorder: 'hover:border-sky-400/25',
    paths: ['M15 10.5a3 3 0 11-6 0 3 3 0 016 0z', 'M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z'] },
  'value-order':     { topBar: 'bg-amber-400/50', iconBg: 'bg-amber-400/10 ring-1 ring-amber-400/20', iconColor: 'text-amber-400', hoverBorder: 'hover:border-amber-400/25',
    paths: ['M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z'] },
  'age-order':       { topBar: 'bg-rose-400/50', iconBg: 'bg-rose-400/10 ring-1 ring-rose-400/20', iconColor: 'text-rose-400', hoverBorder: 'hover:border-rose-400/25',
    paths: ['M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z'] },
  'height-order':    { topBar: 'bg-teal-400/50', iconBg: 'bg-teal-400/10 ring-1 ring-teal-400/20', iconColor: 'text-teal-400', hoverBorder: 'hover:border-teal-400/25',
    paths: ['M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5'] },
  'shirt-number':    { topBar: 'bg-indigo-400/50', iconBg: 'bg-indigo-400/10 ring-1 ring-indigo-400/20', iconColor: 'text-indigo-400', hoverBorder: 'hover:border-indigo-400/25',
    paths: ['M5.25 8.25h15m-16.5 7.5h15m-1.8-13.5l-3.9 19.5m-2.1-19.5l-3.9 19.5'] },
  'once-ideal':      { topBar: 'bg-orange-400/50', iconBg: 'bg-orange-400/10 ring-1 ring-orange-400/20', iconColor: 'text-orange-400', hoverBorder: 'hover:border-orange-400/25',
    paths: ['M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z'] },
}

</script>

<template>
  <section class="mx-auto max-w-4xl">
    <h1 class="text-2xl md:text-4xl font-bold text-white mb-1">Jugar <span class="text-sky-400 uppercase">LIBRE</span></h1>
    <p class="text-slate-300 mb-6">Modo Free: jugá <strong class="text-slate-100 font-semibold">TODO LO QUE QUIERAS</strong>.</p>
    <div v-if="state.loading" class="text-slate-400">Cargando…</div>
    <div v-else>
      <!-- Game cards -->
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 stagger-grid">
        <RouterLink
          v-for="g in state.games"
          :key="g.slug"
          :to="toFree(g.slug)"
          class="group relative flex flex-col rounded-2xl overflow-hidden border border-white/10 bg-slate-900 transition-all duration-300 hover:shadow-lg hover:border-white/20 hover:-translate-y-1 hover:scale-[1.02] active:scale-[0.98]"
        >
          <!-- Cover image area -->
          <div class="relative flex items-center justify-center h-36 bg-slate-800/60">
            <img
              v-if="g.cover_url"
              :src="g.cover_url"
              :alt="g.name"
              class="w-24 h-24 object-contain opacity-90 transition-transform duration-300 group-hover:scale-110"
            />
          </div>
          <!-- Footer -->
          <div class="bg-slate-900/90 px-3 py-3 border-t border-white/5 text-center">
            <div class="font-bold text-white text-xs tracking-widest uppercase">JUGAR</div>
            <div class="text-slate-400 text-xs mt-0.5 truncate">{{ g.name }}</div>
          </div>
        </RouterLink>
      </div>
    </div>
  </section>
</template>


