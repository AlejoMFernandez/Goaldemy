<script setup>
// Panel de AYUDAS para el índice de juegos: muestra el inventario del usuario
// ANTES de jugar y en qué juegos se pueden usar, para no llevarse sorpresas.
import { ref, computed, onMounted } from 'vue'
import { getAvailablePowerups, POWERUP_GAME_SLUGS } from '../../services/powerups'
import { friendlyNameForSlug } from '../../services/games'
import PowerupIcon from '../rewards/PowerupIcon.vue'

const powerups = ref([])
const loading = ref(true)

const games = POWERUP_GAME_SLUGS.map(slug => ({
  slug,
  name: friendlyNameForSlug(slug),
  cover: `/games/${slug}.svg`,
}))

const total = computed(() => powerups.value.reduce((a, p) => a + (p.count || 0), 0))

// Tinte por ayuda (mismo criterio que la barra dentro del juego)
const COLORS = {
  fifty_fifty: 'bg-fuchsia-500/10 ring-fuchsia-400/25 text-fuchsia-200',
  shield: 'bg-sky-500/10 ring-sky-400/25 text-sky-200',
  extra_time: 'bg-amber-500/10 ring-amber-400/25 text-amber-100',
  reveal_hint: 'bg-emerald-500/10 ring-emerald-400/25 text-emerald-200',
}
function puColor(key) {
  return COLORS[key] || 'bg-white/5 ring-white/15 text-white'
}

async function load() {
  try {
    powerups.value = await getAvailablePowerups()
  } finally {
    loading.value = false
  }
}
onMounted(load)
</script>

<template>
  <div class="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950/80 p-4 md:p-5">
    <div class="pointer-events-none absolute -top-16 -right-10 w-56 h-56 rounded-full opacity-20 blur-3xl" style="background: radial-gradient(circle, rgba(251,191,36,0.35), transparent 70%);"></div>

    <!-- Encabezado -->
    <div class="relative flex items-center justify-between gap-3 mb-4">
      <div class="flex items-center gap-2">
        <span class="inline-grid place-items-center w-8 h-8 rounded-xl bg-amber-500/15 ring-1 ring-amber-400/30 text-amber-300">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
        </span>
        <div>
          <div class="font-display font-bold text-white leading-tight">Tus ayudas</div>
          <div class="text-[11px] text-slate-400 leading-tight">Usalas cuando más lo necesites</div>
        </div>
      </div>
      <div class="shrink-0 text-right">
        <div class="text-lg font-extrabold tabular-nums text-white leading-none">{{ total }}</div>
        <div class="text-[10px] uppercase tracking-wider text-slate-500">disponibles</div>
      </div>
    </div>

    <!-- Grid de ayudas -->
    <div class="relative grid grid-cols-2 sm:grid-cols-4 gap-2.5">
      <div
        v-for="pu in powerups"
        :key="pu.key"
        class="relative flex items-center gap-2.5 rounded-2xl ring-1 backdrop-blur-md p-2.5 transition-colors"
        :class="pu.count > 0 ? puColor(pu.key) : 'bg-white/[0.02] ring-white/10 text-white/45'"
      >
        <span class="shrink-0 grid place-items-center w-9 h-9">
          <PowerupIcon :type="pu.key" :size="26" />
        </span>
        <div class="min-w-0">
          <div class="text-xs font-bold leading-tight truncate">{{ pu.name }}</div>
          <div class="text-[10px] opacity-70 leading-tight line-clamp-2">{{ pu.description }}</div>
        </div>
        <span
          class="absolute -top-1.5 -right-1.5 grid place-items-center min-w-[19px] h-[19px] px-1 rounded-full bg-slate-900/95 ring-1 ring-white/15 text-[10px] font-bold text-white leading-none tabular-nums"
        >
          {{ pu.count }}
        </span>
      </div>
    </div>

    <!-- A qué juegos aplican -->
    <div class="relative mt-4 pt-3 border-t border-white/10">
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mr-0.5">Se usan en</span>
        <RouterLink
          v-for="g in games"
          :key="g.slug"
          :to="`/games/${g.slug}?mode=challenge`"
          class="group inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] ring-1 ring-white/10 pl-1 pr-2.5 py-1 hover:bg-white/[0.08] hover:ring-emerald-400/30 transition"
        >
          <img :src="g.cover" :alt="g.name" class="w-5 h-5 object-contain opacity-90 group-hover:scale-110 transition-transform" />
          <span class="text-[11px] font-medium text-slate-200">{{ g.name }}</span>
        </RouterLink>
        <span class="text-[11px] text-slate-500">· el resto de los juegos no llevan ayudas</span>
      </div>
    </div>

    <div v-if="loading" class="absolute inset-0 grid place-items-center bg-slate-950/40 rounded-3xl">
      <div class="h-6 w-6 rounded-full border-2 border-amber-400/30 border-t-amber-400 animate-spin"></div>
    </div>
  </div>
</template>
