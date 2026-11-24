<script setup>
/**
 * SOCIAL — hub de la 5ª pestaña (mobile). Control segmentado:
 *   Ranking · Amigos · Fútbol   (sincronizado con ?tab= para links y "atrás")
 * Todo reusa lo que ya existía, sin duplicar lógica:
 *  - Ranking  → la página Leaderboards tal cual.
 *  - Amigos   → FriendsDock en modo `embedded` (lista + chat) — reemplaza el
 *               botón flotante de amigos que había en mobile.
 *  - Fútbol   → accesos a Competiciones/Equipos + "Partidos de hoy"
 *               (TodayMatchesGrid + useUpcomingMatches, igual que la home).
 * Arriba: buscador global (jugadores, equipos, usuarios, competiciones), que en
 * mobile vivía dentro del menú hamburguesa que ya no existe.
 */
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { searchAll, competitionRoute } from '../services/global-search'
import { getEquippedCosmeticsBatch } from '../services/cosmetics'
import { shellState, tapHaptic } from '../components/shell/shell-state'
import { useUpcomingMatches } from '../components/home/useUpcomingMatches'
import HubState from '../components/shell/HubState.vue'
import GlobalSearchResults from '../components/GlobalSearchResults.vue'
import TodayMatchesGrid from '../components/home/TodayMatchesGrid.vue'

import { asyncHub } from '../components/shell/async-hub'
const Leaderboards = asyncHub(() => import('./Leaderboards.vue'))
const FriendsDock = asyncHub(() => import('../components/FriendsDock.vue'))

const route = useRoute()
const router = useRouter()
const TABS = [
  { key: 'ranking', label: 'Ranking' },
  { key: 'amigos', label: 'Amigos' },
  { key: 'futbol', label: 'Fútbol' },
]
const tab = computed(() => TABS.some(t => t.key === route.query.tab) ? route.query.tab : 'ranking')
function setTab(k) {
  if (k === tab.value) return
  tapHaptic()
  router.replace({ query: { ...route.query, tab: k } })
}
const tabIdx = computed(() => TABS.findIndex(t => t.key === tab.value))
const logged = computed(() => !!shellState.user?.id)

// ── Fútbol ──
const { loading: mLoading, error: mError, load: loadMatches, todayMatches } = useUpcomingMatches()
let matchesLoaded = false
watch(tab, (t) => { if (t === 'futbol' && !matchesLoaded) { matchesLoaded = true; loadMatches() } }, { immediate: true })

// ── Buscador global ──
const q = ref('')
const searching = ref(false)
const results = ref({ users: [], players: [], teams: [], competitions: [] })
const resultCos = ref({})
let searchTimer = null
function onSearch() {
  clearTimeout(searchTimer)
  const term = q.value.trim()
  if (term.length < 2) { results.value = { users: [], players: [], teams: [], competitions: [] }; return }
  searchTimer = setTimeout(async () => {
    searching.value = true
    try {
      const res = await searchAll(term, { limitEach: 5, currentUserId: shellState.user?.id })
      results.value = res
      const ids = (res.users || []).map(u => u.id).filter(Boolean)
      resultCos.value = ids.length ? await getEquippedCosmeticsBatch(ids).catch(() => ({})) : {}
    } finally { searching.value = false }
  }, 220)
}
function clearSearch() { q.value = ''; results.value = { users: [], players: [], teams: [], competitions: [] } }
function go(path) { clearSearch(); router.push(path) }

const FUTBOL_CARDS = [
  { to: '/competiciones', title: 'Competiciones', sub: 'Ligas, copas y torneos: tablas, fixtures y brackets', accent: 'from-emerald-500/25 to-cyan-500/10 border-emerald-400/25',
    icon: 'M8 21h8M12 17v4M7 4h10v4a5 5 0 01-10 0V4zM17 5h3v2a3 3 0 01-3 3M7 5H4v2a3 3 0 003 3' },
  { to: '/teams', title: 'Equipos', sub: 'Planteles, últimos partidos y estadísticas', accent: 'from-sky-500/25 to-indigo-500/10 border-sky-400/25',
    icon: 'M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z' },
]

onMounted(() => { if (!route.query.tab) router.replace({ query: { ...route.query, tab: 'ranking' } }) })
</script>

<template>
  <section class="max-w-3xl mx-auto -mt-4 lg:mt-0">
    <!-- Buscador global -->
    <div class="relative mb-4">
      <input v-model="q" type="search" inputmode="search" placeholder="Buscar jugadores, equipos, usuarios…" aria-label="Buscar"
        class="w-full h-12 rounded-2xl border border-white/10 bg-white/[0.04] pl-11 pr-4 text-[15px] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
        @input="onSearch" />
      <svg class="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
      <div v-if="q.trim().length >= 2" class="absolute z-30 mt-2 w-full max-h-[60dvh] overflow-auto rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur shadow-2xl p-2">
        <GlobalSearchResults :results="results" :result-cos="resultCos" :searching="searching" :query="q"
          @go-user="(u) => go(`/u/${u.id}`)" @go-player="(p) => p?.teamId && go(`/team/${p.teamId}`)"
          @go-team="(t) => go(`/team/${t.id}`)" @go-competition="(c) => go(competitionRoute(c))" />
      </div>
    </div>

    <!-- Control segmentado -->
    <div class="seg relative grid grid-cols-3 p-1 rounded-2xl bg-black/30 border border-white/10 mb-5" role="tablist" aria-label="Secciones de Social">
      <span class="seg-thumb" :style="{ transform: `translateX(${tabIdx * 100}%)` }" aria-hidden="true"></span>
      <button v-for="t in TABS" :key="t.key" type="button" role="tab" :aria-selected="tab === t.key"
        class="relative z-10 min-h-[44px] rounded-xl text-sm font-bold transition-colors"
        :class="tab === t.key ? 'text-slate-900' : 'text-slate-300'" @click="setTab(t.key)">
        {{ t.label }}
      </button>
    </div>

    <Transition name="seg-fade" mode="out-in">
      <!-- Ranking -->
      <div v-if="tab === 'ranking'" key="ranking">
        <Leaderboards />
      </div>

      <!-- Amigos -->
      <div v-else-if="tab === 'amigos'" key="amigos">
        <template v-if="logged">
          <FriendsDock embedded />
          <RouterLink to="/messages" class="mt-3 flex items-center justify-center gap-2 min-h-[44px] rounded-xl border border-white/10 bg-white/[0.03] text-sm font-semibold text-slate-300 hover:text-white">
            Ver todas las conversaciones
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4"><path d="M9 6l6 6-6 6"/></svg>
          </RouterLink>
        </template>
        <div v-else class="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <p class="font-display font-bold text-white text-lg">Jugá con amigos</p>
          <p class="text-slate-400 text-sm mt-1">Creá tu cuenta para agregar amigos, chatear y ver a qué están jugando.</p>
          <RouterLink to="/register" class="mt-5 inline-flex min-h-[44px] items-center rounded-xl px-6 font-bold text-slate-900 bg-gradient-to-b from-amber-300 to-amber-500">Crear cuenta gratis</RouterLink>
        </div>
      </div>

      <!-- Fútbol -->
      <div v-else key="futbol" class="space-y-6">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <RouterLink v-for="c in FUTBOL_CARDS" :key="c.to" :to="c.to"
            class="group flex items-center gap-4 rounded-2xl border bg-gradient-to-br p-4 min-h-[84px] active:scale-[.98] transition" :class="c.accent">
            <span class="h-12 w-12 shrink-0 grid place-items-center rounded-xl bg-black/30 text-white">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6"><path :d="c.icon"/></svg>
            </span>
            <span class="min-w-0 flex-1">
              <span class="block font-display font-bold text-white">{{ c.title }}</span>
              <span class="block text-xs text-slate-300/80 mt-0.5">{{ c.sub }}</span>
            </span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-5 w-5 text-slate-400 group-hover:translate-x-0.5 transition-transform"><path d="M9 6l6 6-6 6"/></svg>
          </RouterLink>
        </div>
        <HubState v-if="mError && !mLoading" error message="No pudimos traer los partidos." @retry="loadMatches" />
        <TodayMatchesGrid v-else :matches="todayMatches" :loading="mLoading" />
      </div>
    </Transition>
  </section>
</template>

<style scoped>
.seg-thumb {
  position: absolute; top: 4px; bottom: 4px; left: 4px; width: calc((100% - 8px) / 3);
  border-radius: 12px; background: linear-gradient(180deg, #fde68a, #f59e0b);
  box-shadow: 0 4px 14px rgba(245,158,11,.35);
  transition: transform .3s cubic-bezier(.34, 1.4, .64, 1);
}
.seg-fade-enter-active, .seg-fade-leave-active { transition: opacity .16s ease, transform .16s ease; }
.seg-fade-enter-from { opacity: 0; transform: translateY(6px); }
.seg-fade-leave-to { opacity: 0; }
@media (prefers-reduced-motion: reduce) {
  .seg-thumb { transition: none; }
  .seg-fade-enter-active, .seg-fade-leave-active { transition: opacity .1s ease; }
  .seg-fade-enter-from { transform: none; }
}
</style>
