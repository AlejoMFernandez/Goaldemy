<script setup>
/**
 * LOGROS — página completa (/logros), diseño V4 Logros.
 *
 * Datos reales:
 *  - catálogo activo: getAchievementsCatalog() · logros propios: getUserAchievements()
 *  - destacados: user_profiles.featured_achievements (getPublicProfile) y se editan
 *    con el FeaturedAchievementsModal existente (updateFeaturedAchievements)
 *  - racha diaria (para el progreso de daily_streak_N): shellState.stats.streak
 * Categorías, secretos y progreso se infieren en components/achievements/logros-data.js.
 */
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getAuthUser } from '../services/auth'
import { getAchievementsCatalog, getUserAchievements } from '../services/achievements'
import { getLockedAchievementProgress } from '../services/achievement-progress'
import { getPublicProfile, updateFeaturedAchievements } from '../services/user-profiles'
import { pushErrorToast, pushSuccessToast } from '../stores/notifications'
import { tap, success } from '../services/haptics'
import { shellState, loadShellStats } from '../components/shell/shell-state'
import AchievementMedal from '../components/achievements/AchievementMedal.vue'
import AchievementRow from '../components/achievements/AchievementRow.vue'
import FeaturedAchievementsModal from '../components/profile/FeaturedAchievementsModal.vue'
import { CATEGORIES, RARITY, RARITY_ORDER, buildAchievementList, matchesFilter } from '../components/achievements/logros-data'

const router = useRouter()

const loading = ref(true)
const loadError = ref(false)
const catalog = ref({})
const owned = ref([])
const featuredCodes = ref([])
const filter = ref('todos')
const showFeaturedModal = ref(false)
const barReady = ref(false)
const progressByCode = ref({})

async function load() {
  loading.value = true
  loadError.value = false
  const { id } = getAuthUser() || {}
  try {
    const [cat, mine, prof] = await Promise.all([
      getAchievementsCatalog(),
      id ? getUserAchievements(id) : Promise.resolve({ data: [] }),
      id ? getPublicProfile(id) : Promise.resolve({ data: null }),
      loadShellStats().catch(() => {}),
    ])
    if (mine?.error) throw mine.error
    catalog.value = cat || {}
    owned.value = mine?.data || []
    featuredCodes.value = prof?.data?.featured_achievements || []
    loadProgress()
  } catch (e) {
    console.error('[Logros] load:', e)
    loadError.value = true
  } finally {
    loading.value = false
    requestAnimationFrame(() => { barReady.value = true })
  }
}
onMounted(load)

// Avance de los bloqueados (32/50…): solo lectura, después de pintar la lista; si falla, quedan sin barra.
async function loadProgress() {
  try {
    const codes = buildAchievementList(catalog.value, owned.value, {}).filter(i => !i.done && !i.hidden).map(i => i.code)
    progressByCode.value = await getLockedAchievementProgress(codes)
  } catch (e) { console.warn('[Logros] progreso:', e) }
}

const ctx = computed(() => ({
  dailyStreak: shellState.stats.loaded ? Number(shellState.stats.streak) || 0 : NaN,
  progressByCode: progressByCode.value,
}))
const items = computed(() => buildAchievementList(catalog.value, owned.value, ctx.value))
const total = computed(() => items.value.length)
const doneItems = computed(() => items.value.filter(i => i.done))
const doneCount = computed(() => doneItems.value.length)
const donePct = computed(() => (total.value ? Math.round((100 * doneCount.value) / total.value) : 0))

const rarCounts = computed(() => RARITY_ORDER.map(k => ({
  key: k,
  n: doneItems.value.filter(i => i.rarity === k).length,
  ...RARITY[k],
})))

const filters = computed(() => CATEGORIES
  .map(c => ({ ...c, count: items.value.filter(i => matchesFilter(i, c.key)).length }))
  .filter(c => c.key === 'todos' || c.count > 0))
const visible = computed(() => items.value.filter(i => matchesFilter(i, filter.value)))

function pick(key) {
  if (filter.value === key) return
  tap()
  filter.value = key
}

// Destacados: los elegidos en el perfil; si no hay, los 3 más recientes (igual que AchievementsCard).
const featured = computed(() => {
  const mine = doneItems.value.slice().sort((a, b) => Date.parse(b.earnedAt) - Date.parse(a.earnedAt))
  const byCode = new Map(mine.map(i => [i.code, i]))
  const picked = (featuredCodes.value || []).map(c => byCode.get(c)).filter(Boolean)
  return (picked.length ? picked : mine).slice(0, 3)
})

function openFeatured() {
  tap()
  showFeaturedModal.value = true
}
async function saveFeatured(codes) {
  const { id } = getAuthUser() || {}
  if (!id) return
  try {
    await updateFeaturedAchievements(id, codes)
    featuredCodes.value = codes
    showFeaturedModal.value = false
    success()
    pushSuccessToast('Logros destacados actualizados')
  } catch (e) {
    console.error('[Logros] save featured:', e)
    pushErrorToast('No pudimos guardar tus destacados. Probá de nuevo.')
  }
}

function goBack() {
  tap()
  if (window.history.state?.back) router.back()
  else router.push('/profile')
}
</script>

<template>
  <section class="logros relative max-w-xl mx-auto -mx-2 sm:mx-auto -mt-6 lg:mt-0 pb-6">
    <div class="logros-glow pointer-events-none absolute inset-x-0 -top-10 h-64" aria-hidden="true"></div>

    <header class="relative h-14 flex items-center gap-1 -ml-2">
      <button type="button" aria-label="Volver" @click="goBack"
        class="w-11 h-11 rounded-full grid place-items-center text-slate-300 active:bg-white/10 transition">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
      </button>
      <h1 class="font-display font-bold text-2xl text-slate-100">Logros</h1>
    </header>

    <div class="relative flex flex-col gap-3 pt-1.5">
      <!-- Resumen -->
      <section aria-label="Resumen" class="rounded-[18px] px-3.5 py-3 border border-violet-300/25 flex flex-col gap-[9px]"
        style="background: linear-gradient(160deg, #2e1065, #1e1b4b 55%, #0f172a)">
        <div class="flex items-end justify-between gap-3">
          <span class="flex flex-col">
            <span class="text-[11px] font-extrabold tracking-[1.2px] text-violet-300">CONSEGUISTE</span>
            <span v-if="loading" class="h-10 w-28 rounded-lg bg-white/10 animate-pulse mt-1"></span>
            <span v-else class="font-bug font-extrabold text-[44px] leading-[0.9] text-slate-100">{{ doneCount }}<span class="text-2xl text-[#6d63a8]"> / {{ total }}</span></span>
          </span>
          <span class="flex gap-1.5">
            <span v-for="c in rarCounts" :key="c.key" class="flex flex-col items-center gap-0.5" :aria-label="`${c.n} ${c.short}`">
              <span class="medal-hex w-[26px] h-[29px] grid place-items-center font-bug font-extrabold text-sm" :style="{ background: c.metal, color: c.ink }">{{ loading ? '–' : c.n }}</span>
              <span class="text-[9px] font-bold" :style="{ color: c.color }">{{ c.short }}</span>
            </span>
          </span>
        </div>
        <span class="h-2.5 rounded-full bg-white/10 overflow-hidden block" role="progressbar" :aria-valuenow="doneCount" aria-valuemin="0" :aria-valuemax="total" aria-label="Logros conseguidos">
          <span class="sum-bar block h-full rounded-full" :style="{ width: (barReady ? donePct : 0) + '%' }"></span>
        </span>
      </section>

      <!-- Filtros -->
      <div role="tablist" aria-label="Filtrar logros" class="no-scrollbar -mx-3.5 px-3.5 flex gap-1.5 overflow-x-auto">
        <button v-for="f in filters" :key="f.key" type="button" role="tab" :aria-selected="filter === f.key" @click="pick(f.key)"
          class="shrink-0 min-h-[44px] px-3.5 rounded-full border font-bold text-[13px] flex items-center gap-1.5 transition-colors active:scale-95"
          :class="filter === f.key ? 'border-transparent text-slate-900' : 'border-white/10 bg-white/[0.04] text-slate-400'"
          :style="filter === f.key ? { background: 'linear-gradient(180deg,#ffffff,#e2e8f0)' } : null">
          {{ f.label }}<span v-if="!loading" class="text-[11px] opacity-70">{{ f.count }}</span>
        </button>
      </div>

      <!-- Destacados en tu perfil -->
      <section aria-label="Destacados en tu perfil" class="rounded-[18px] px-3 pt-2.5 pb-3 bg-white/[0.04] border border-white/[0.08]">
        <div class="flex justify-between items-center">
          <span class="text-xs font-extrabold tracking-[1.2px] text-slate-400">DESTACADOS EN TU PERFIL</span>
          <button v-if="doneCount > 0" type="button" @click="openFeatured"
            class="min-h-[44px] -my-1.5 -mr-1 px-1 flex items-center gap-1 text-[13px] font-bold text-amber-400 active:text-amber-200">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z" /></svg>
            Cambiar
          </button>
        </div>
        <div v-if="loading" class="mt-1 grid grid-cols-3 gap-1.5">
          <span v-for="n in 3" :key="n" class="h-[92px] rounded-xl bg-white/5 animate-pulse"></span>
        </div>
        <p v-else-if="!featured.length" class="mt-2 py-3 text-center text-[13px] text-slate-400">Conseguí tu primer logro para destacarlo en tu perfil.</p>
        <div v-else class="mt-1 grid grid-cols-3 gap-1.5">
          <div v-for="m in featured" :key="m.code" class="flex flex-col items-center gap-[5px] text-center">
            <AchievementMedal :icon="m.icon" :rarity="m.rarity" state="done" size="lg" />
            <span class="text-xs font-extrabold leading-[1.1] text-slate-100">{{ m.name }}</span>
            <span class="text-[9.5px] font-extrabold tracking-[0.8px]" :style="{ color: RARITY[m.rarity].color }">{{ RARITY[m.rarity].label }}</span>
          </div>
        </div>
      </section>

      <!-- Lista -->
      <section aria-label="Lista de logros" class="rounded-[18px] border border-white/[0.08] overflow-hidden">
        <div v-if="loading">
          <div v-for="n in 6" :key="n" class="flex items-center gap-3 px-3 py-2.5 border-b border-white/[0.06]">
            <span class="medal-hex w-[46px] h-[51px] bg-white/10 animate-pulse"></span>
            <span class="flex-1 flex flex-col gap-1.5"><span class="h-3.5 w-2/5 rounded bg-white/10 animate-pulse"></span><span class="h-3 w-4/5 rounded bg-white/5 animate-pulse"></span></span>
          </div>
        </div>
        <div v-else-if="loadError" class="px-3.5 py-6 text-center">
          <p class="text-[13px] text-slate-400">No pudimos cargar tus logros.</p>
          <button type="button" @click="load" class="mt-3 min-h-[44px] px-5 rounded-xl border border-white/15 bg-white/5 text-sm font-bold text-slate-200 active:scale-95 transition">Reintentar</button>
        </div>
        <Transition v-else name="log-fade" mode="out-in">
          <ul v-if="visible.length" :key="filter">
            <AchievementRow v-for="it in visible" :key="it.code" :item="it" />
          </ul>
          <div v-else :key="filter + '-empty'" class="px-3.5 py-6 text-center text-[13px] text-slate-400">No hay logros en este filtro.</div>
        </Transition>
      </section>
    </div>

    <FeaturedAchievementsModal
      v-if="showFeaturedModal"
      :achievements="owned"
      :current-featured="featuredCodes"
      @save="saveFeatured"
      @cancel="showFeaturedModal = false"
    />
  </section>
</template>

<style scoped>
.logros-glow { background: radial-gradient(80% 60% at 50% 0%, rgba(168, 85, 247, 0.2), transparent 70%); }
.medal-hex { clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%); }
.font-bug { font-family: var(--font-bug); }
.sum-bar {
  background: linear-gradient(90deg, #34d399, #22d3ee, #818cf8);
  transition: width 0.8s cubic-bezier(0.22, 1, 0.36, 1);
}
.no-scrollbar { scrollbar-width: none; }
.no-scrollbar::-webkit-scrollbar { display: none; }
.log-fade-enter-active, .log-fade-leave-active { transition: opacity 0.16s ease, transform 0.16s ease; }
.log-fade-enter-from { opacity: 0; transform: translateY(4px); }
.log-fade-leave-to { opacity: 0; }
@media (prefers-reduced-motion: reduce) {
  .sum-bar { transition: none; }
  .log-fade-enter-active, .log-fade-leave-active { transition: none; }
  .log-fade-enter-from { transform: none; }
}
</style>
