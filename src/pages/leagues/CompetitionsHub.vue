<script>
import { RouterLink } from 'vue-router'
import { competitionsByCountry, featuredCompetition, LEAGUE_LOGO, FLAG_CDN, COMPETITIONS } from '../../services/competitions'
import { getSeasonStatus } from '../../services/fotmob'

const STATUS_CACHE_KEY = 'fulvo_comp_status_v1'

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function readStatusCache() {
  try {
    const raw = sessionStorage.getItem(STATUS_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed.day === todayKey() ? parsed.data : null
  } catch {
    return null
  }
}

function writeStatusCache(data) {
  try {
    sessionStorage.setItem(STATUS_CACHE_KEY, JSON.stringify({ day: todayKey(), data }))
  } catch {
    // sessionStorage no disponible (privado/bloqueado): no pasa nada, solo no cachea
  }
}

export default {
  name: 'CompetitionsHub',
  components: { RouterLink },
  data() {
    return {
      groups: competitionsByCountry(),
      featured: featuredCompetition(),
      selectedKey: null,
      statusById: {},
    }
  },
  computed: {
    visibleGroups() {
      if (!this.selectedKey) return this.groups
      return this.groups.filter(g => g.key === this.selectedKey)
    },
    featuredStatus() {
      return this.statusById[this.featured?.id] || null
    },
  },
  mounted() {
    this.loadStatuses()
  },
  methods: {
    logo(id) { return LEAGUE_LOGO(id) },
    flagSrc(code) { return FLAG_CDN(code) },
    onLogoError(e) { e.target.style.visibility = 'hidden' },
    go(c) { if (c.status === 'live') this.$router.push(`/leagues/${c.slug}`) },
    statusFor(c) { return this.statusById[c.id] || null },
    async loadStatuses() {
      const cached = readStatusCache()
      if (cached) { this.statusById = cached; return }

      const routed = COMPETITIONS.filter(c => c.status === 'live')
      const results = await Promise.allSettled(routed.map(c => getSeasonStatus(c.id)))
      const map = {}
      routed.forEach((c, i) => {
        map[c.id] = results[i].status === 'fulfilled' ? results[i].value : { live: false, inSeason: false }
      })
      this.statusById = map
      writeStatusCache(map)
    },
  },
}
</script>

<template>
  <div class="competitions-hub py-8 px-4">
    <div class="container mx-auto max-w-6xl">
      <!-- Page header -->
      <header class="mb-6">
        <span class="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-300/80">Explorá</span>
        <h1 class="mt-1 text-3xl sm:text-4xl font-display font-bold text-white">Competiciones</h1>
        <p class="mt-1.5 text-slate-400 text-sm sm:text-base">Ligas, copas y torneos por país — tablas, goleadores y brackets en un solo lugar.</p>
      </header>

      <!-- Featured (Mundial) -->
      <section v-if="featured" class="mb-8">
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
                <span v-if="featuredStatus?.live" class="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                  <span class="relative flex h-1.5 w-1.5">
                    <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                    <span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                  </span>
                  En vivo
                </span>
                <span v-else-if="featuredStatus?.inSeason" class="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                  <span class="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                  Temporada en curso
                </span>
                <span v-else-if="featuredStatus" class="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Fuera de temporada
                </span>
                <span v-if="featured.bracket" class="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-300">Con bracket</span>
              </div>
              <h2 class="mt-2 text-2xl sm:text-3xl font-display font-bold text-white">{{ featured.name }}</h2>
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

      <!-- Filtro por país / región -->
      <div class="mb-6 -mx-4 px-4 sm:mx-0 sm:px-0">
        <div class="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          <button
            @click="selectedKey = null"
            class="flex-none rounded-full border px-3.5 py-1.5 text-xs font-semibold transition whitespace-nowrap"
            :class="!selectedKey ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-300' : 'border-white/10 bg-slate-900/60 text-slate-400 hover:text-white'"
          >
            Todos
          </button>
          <button
            v-for="g in groups" :key="g.key"
            @click="selectedKey = g.key"
            class="flex-none inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition whitespace-nowrap"
            :class="selectedKey === g.key ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-300' : 'border-white/10 bg-slate-900/60 text-slate-400 hover:text-white'"
          >
            <img v-if="g.flagCode" :src="flagSrc(g.flagCode)" :alt="g.label" class="h-3 w-4 rounded-[2px] object-cover" />
            <span v-else>{{ g.emoji }}</span>
            {{ g.label }}
          </button>
        </div>
      </div>

      <!-- Groups -->
      <section v-for="group in visibleGroups" :key="group.key" class="mb-7 last:mb-0">
        <div class="mb-2.5 flex items-center gap-1.5">
          <img v-if="group.flagCode" :src="flagSrc(group.flagCode)" :alt="group.label" class="h-3.5 w-5 rounded-[2px] object-cover" />
          <span v-else class="text-sm">{{ group.emoji }}</span>
          <h3 class="text-sm font-display font-bold text-white">{{ group.label }}</h3>
          <span class="text-[11px] text-slate-600">· {{ group.items.length }}</span>
        </div>

        <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-2.5">
          <component
            :is="c.status === 'live' ? 'RouterLink' : 'div'"
            v-for="c in group.items"
            :key="c.id"
            :to="c.status === 'live' ? `/leagues/${c.slug}` : undefined"
            class="group relative flex flex-col rounded-xl border p-2.5 transition"
            :class="c.status === 'live'
              ? 'border-white/10 bg-slate-900/60 hover:border-emerald-400/40 hover:bg-slate-900/80 cursor-pointer'
              : 'border-white/5 bg-slate-900/40 opacity-70 cursor-default'"
            :title="c.status === 'live' ? (statusFor(c)?.live ? 'En vivo ahora' : statusFor(c)?.inSeason ? 'Temporada en curso' : 'Fuera de temporada') : 'Próximamente'"
          >
            <!-- logo + status dot -->
            <div class="flex items-start justify-between">
              <div class="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                <img :src="logo(c.id)" :alt="c.name" @error="onLogoError"
                     class="h-6 w-6 object-contain"
                     :class="c.status === 'live' ? '' : 'grayscale'" />
              </div>
              <span
                v-if="c.status === 'live' && statusFor(c)?.live"
                class="relative flex h-2 w-2 flex-none mt-0.5">
                <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-400"></span>
              </span>
              <span v-else-if="c.status === 'live' && statusFor(c)?.inSeason"
                class="h-2 w-2 flex-none mt-0.5 rounded-full bg-emerald-400/70"></span>
              <span v-else-if="c.status === 'live'"
                class="h-2 w-2 flex-none mt-0.5 rounded-full bg-slate-600"></span>
            </div>

            <!-- name -->
            <div class="mt-2 min-w-0">
              <div class="font-display font-bold text-white text-xs leading-tight truncate">{{ c.short }}</div>
              <div class="text-[10px] text-slate-500 truncate">{{ c.country }}</div>
            </div>

            <!-- soon tag -->
            <span v-if="c.status !== 'live'" class="mt-1.5 self-start rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500">Pronto</span>
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

<style scoped>
.scrollbar-hide::-webkit-scrollbar { display: none; }
.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
</style>
