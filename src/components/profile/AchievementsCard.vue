<script setup>
import { ref, computed, onMounted } from 'vue'
import { getAchievementsCatalog, getAchievementUnlockPercentages } from '../../services/achievements'
import { friendlyNameForSlug } from '../../services/games'
import { achievementIcon } from '../../services/achievement-icons'
import { getCosmeticUnlocksByAchievement } from '../../services/cosmetics'
import CosmeticIcon from '../rewards/CosmeticIcon.vue'
import PassCosmetic from '../rewards/PassCosmetic.vue'

const props = defineProps({
  achievements: { type: Array, required: true },
  loading: { type: Boolean, default: false },
  featuredCodes: { type: Array, default: () => [] },
  isSelf: { type: Boolean, default: false },
})

const emit = defineEmits(['customize'])

const ACHIEVEMENTS = ref({})
const percentages = ref({})
const cosmeticUnlocks = ref({})
onMounted(async () => {
  ACHIEVEMENTS.value = await getAchievementsCatalog()
  percentages.value = await getAchievementUnlockPercentages()
  cosmeticUnlocks.value = await getCosmeticUnlocksByAchievement()
})

function iconKeyFor(a) { return achievementIcon(a?.achievements?.code).icon }
function rarityFor(a) { return achievementIcon(a?.achievements?.code).rarity }

// Qué cosmético(s) se desbloquean al conseguir este logro (o que ya desbloqueó).
// Se muestra en el hover tanto si ya lo tenés como si está pendiente (funciona de incentivo).
function unlockInfoFor(a) {
  const code = a?.achievements?.code
  return (code && cosmeticUnlocks.value[code]) || []
}

// "Por qué" personalizado: solo cuando el metadata guardado cuenta algo más
// específico que la descripción genérica del logro (por ahora, rachas por juego).
function reasonFor(a) {
  const meta = a?.metadata
  const streak = Number(meta?.streak)
  if (meta?.game && Number.isFinite(streak) && streak > 0) {
    return `Racha de ${streak} en ${friendlyNameForSlug(meta.game)}`
  }
  return null
}

function pctClass(code) {
  const p = percentages.value[code]
  if (p == null) return ''
  if (p < 10) return 'bg-fuchsia-500/20 border-fuchsia-400/40 text-fuchsia-200'
  if (p < 30) return 'bg-amber-500/20 border-amber-400/40 text-amber-200'
  return 'bg-slate-600/30 border-slate-500/40 text-slate-300'
}

const showAll = ref(false)
const viewMode = ref('list') // 'list' | 'grid'

const ownedCodes = computed(() => {
  const arr = Array.isArray(props.achievements) ? props.achievements : []
  return new Set(arr.map(a => a?.achievements?.code).filter(Boolean))
})

// Logros conseguidos, más reciente primero.
const unlockedSorted = computed(() => {
  const arr = Array.isArray(props.achievements) ? props.achievements.slice() : []
  arr.sort((a, b) => new Date(b.earned_at) - new Date(a.earned_at))
  return arr
})

// Logros pendientes (todavía no desbloqueados), alfabético.
const pendingSorted = computed(() => {
  const have = ownedCodes.value
  const result = []
  const catalog = ACHIEVEMENTS.value || {}
  for (const code of Object.keys(catalog)) {
    if (!have.has(code)) result.push({ achievements: { ...catalog[code] }, earned_at: null, _missing: true })
  }
  result.sort((a, b) => (a.achievements?.name || '').localeCompare(b.achievements?.name || ''))
  return result
})

const totalCatalog = computed(() => Object.keys(ACHIEVEMENTS.value || {}).length)

const featuredList = computed(() => {
  const all = Array.isArray(props.achievements) ? props.achievements.slice() : []
  all.sort((a, b) => new Date(b.earned_at) - new Date(a.earned_at))
  if (!props.featuredCodes || props.featuredCodes.length === 0) return all.slice(0, 3)
  const byCode = new Map()
  all.forEach(a => { const c = a?.achievements?.code; if (c) byCode.set(c, a) })
  const picked = props.featuredCodes.map(c => byCode.get(c)).filter(Boolean)
  return (picked.length ? picked : all).slice(0, 3)
})
</script>

<template>
  <div class="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/50 backdrop-blur p-5 sm:p-6 w-full shadow-xl">
    <!-- Header unificado -->
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2.5">
        <span class="w-1 h-5 rounded-full bg-gradient-to-b from-amber-300 to-amber-600"></span>
        <div>
          <h3 class="font-display font-bold text-white leading-tight">Logros destacados</h3>
          <p class="text-[11px] text-slate-400">{{ achievements.length }} de {{ totalCatalog }} desbloqueados</p>
        </div>
      </div>
      <button v-if="isSelf && achievements.length > 0" @click="$emit('customize')"
        class="h-8 w-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 grid place-items-center transition-all" title="Personalizar logros destacados">
        <svg viewBox="0 0 24 24" fill="currentColor" class="h-4 w-4 text-slate-200"><path d="M21.731 2.269a2.625 2.625 0 00-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 000-3.712zM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 00-1.32 2.214l-.8 2.685a.75.75 0 00.933.933l2.685-.8a5.25 5.25 0 002.214-1.32l8.4-8.4z" /><path d="M5.25 5.25a3 3 0 00-3 3v10.5a3 3 0 003 3h10.5a3 3 0 003-3V13.5a.75.75 0 00-1.5 0v5.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5V8.25a1.5 1.5 0 011.5-1.5h5.25a.75.75 0 000-1.5H5.25z" /></svg>
      </button>
    </div>

    <!-- Destacados: SIN XP, énfasis en imagen/título/descripción -->
    <div v-if="loading" class="text-center py-8 text-slate-400 animate-pulse">Cargando logros...</div>
    <div v-else-if="!featuredList.length" class="text-slate-400 text-center py-8 rounded-xl bg-slate-800/30 border border-white/5">
      <div class="text-3xl mb-2">🎯</div>
      <p>Aún no hay logros destacados</p>
    </div>
    <div v-else class="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div v-for="(a, idx) in featuredList" :key="idx"
        class="group relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-slate-800/80 to-slate-800/40 p-4 flex flex-col items-center text-center transition-all hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/10">
        <div class="relative">
          <div class="size-14 transition-transform group-hover:scale-110">
            <CosmeticIcon framed :icon-key="iconKeyFor(a)" :rarity="rarityFor(a)" :size="56" />
          </div>
          <div v-if="percentages[a.achievements?.code]" class="absolute -bottom-1.5 -right-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold backdrop-blur border" :class="pctClass(a.achievements?.code)">
            {{ percentages[a.achievements?.code] }}%
          </div>
        </div>
        <p class="font-bold text-sm text-white mt-2.5 leading-tight">{{ a.achievements?.name || 'Logro' }}</p>
        <p v-if="a.achievements?.description" class="text-[11px] text-slate-400 mt-1 leading-snug line-clamp-2">{{ a.achievements.description }}</p>
      </div>
    </div>

    <div v-if="achievements.length > 0" class="mt-5 text-center">
      <button @click="showAll = true"
        class="px-6 py-2.5 rounded-xl border border-white/10 bg-slate-800/50 text-slate-200 hover:bg-slate-700/50 hover:border-white/20 transition-all font-semibold text-sm shadow-lg">
        Ver todos los logros ({{ achievements.length }}) →
      </button>
    </div>

    <!-- POPUP: todos los logros (no estira el perfil) -->
    <Teleport to="body">
      <Transition name="ach-modal">
        <div v-if="showAll" class="fixed inset-0 z-[60] overflow-y-auto">
          <div class="fixed inset-0 bg-black/80 backdrop-blur-sm" @click="showAll = false"></div>
          <div class="relative min-h-full flex items-start sm:items-center justify-center p-3 sm:p-4" @click.self="showAll = false">
            <div class="relative w-full max-w-4xl rounded-2xl border border-white/15 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 shadow-2xl my-4">
              <div class="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-4 border-b border-white/10 bg-slate-900/95 backdrop-blur rounded-t-2xl">
                <h3 class="font-display font-bold text-white text-lg">Todos los logros</h3>
                <div class="flex items-center gap-2">
                  <div class="flex items-center rounded-lg border border-white/10 overflow-hidden">
                    <button @click="viewMode = 'list'" title="Vista lista"
                      class="px-2 py-1.5 transition-all" :class="viewMode === 'list' ? 'bg-violet-500/20 text-violet-200' : 'text-slate-400 hover:bg-white/5'">
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
                    </button>
                    <button @click="viewMode = 'grid'" title="Vista grilla"
                      class="px-2 py-1.5 transition-all" :class="viewMode === 'grid' ? 'bg-violet-500/20 text-violet-200' : 'text-slate-400 hover:bg-white/5'">
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" /></svg>
                    </button>
                  </div>
                  <button @click="showAll = false" class="text-slate-400 hover:text-white transition">
                    <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>

              <!-- VISTA GRILLA: cada tile lleva su propio popup flotante on-hover (no hace falta click) -->
              <div class="p-5" v-if="viewMode === 'grid'">
                <h4 class="text-sm font-bold text-slate-200 mb-3">Desbloqueados <span class="text-xs px-2 py-0.5 rounded-full bg-white/10 text-slate-400">{{ unlockedSorted.length }}</span></h4>
                <div v-if="!unlockedSorted.length" class="text-slate-400 text-center py-6 mb-4">Aún no desbloqueaste ningún logro.</div>
                <div v-else class="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 gap-2.5 mb-6">
                  <div v-for="(a, idx) in unlockedSorted" :key="idx" class="group/tile relative aspect-square rounded-xl">
                    <div class="w-full h-full"><CosmeticIcon framed :icon-key="iconKeyFor(a)" :rarity="rarityFor(a)" :size="64" /></div>
                    <div v-if="percentages[a.achievements?.code]" class="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold backdrop-blur border pointer-events-none" :class="pctClass(a.achievements?.code)">{{ percentages[a.achievements?.code] }}%</div>

                    <div class="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-30 w-64 rounded-xl border border-white/15 bg-slate-900/95 backdrop-blur p-3 opacity-0 translate-y-1 shadow-2xl transition-all group-hover/tile:opacity-100 group-hover/tile:translate-y-0">
                      <div class="flex items-start gap-2.5">
                        <div class="size-10 flex-none"><CosmeticIcon framed :icon-key="iconKeyFor(a)" :rarity="rarityFor(a)" :size="40" /></div>
                        <div class="min-w-0">
                          <p class="font-bold text-xs text-white leading-tight">{{ a.achievements?.name || 'Logro' }}</p>
                          <p class="text-[10px] font-semibold text-emerald-300 mt-0.5">+{{ a.achievements?.points ?? 0 }} XP · {{ new Date(a.earned_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }) }}</p>
                        </div>
                      </div>
                      <p v-if="a.achievements?.description" class="text-[10px] text-slate-400 leading-snug mt-2">{{ a.achievements.description }}</p>
                      <p v-if="reasonFor(a)" class="text-[10px] text-violet-300/90 leading-snug mt-1">{{ reasonFor(a) }}</p>
                      <template v-if="unlockInfoFor(a).length">
                        <div class="text-[9px] uppercase tracking-wider text-slate-500 font-semibold mt-2 pt-2 border-t border-white/10 mb-1.5">Desbloqueás</div>
                        <div class="grid grid-cols-3 gap-2 place-items-center">
                          <div v-for="u in unlockInfoFor(a)" :key="u.code" class="flex flex-col items-center gap-1">
                            <PassCosmetic :cos="u" :size="34" />
                            <div class="text-[8px] font-semibold text-slate-300 text-center leading-tight">{{ u.name }}</div>
                          </div>
                        </div>
                      </template>
                    </div>
                  </div>
                </div>

                <h4 class="text-sm font-bold text-slate-200 mb-3">Pendientes <span class="text-xs px-2 py-0.5 rounded-full bg-white/10 text-slate-400">{{ pendingSorted.length }}</span></h4>
                <div v-if="!pendingSorted.length" class="text-center py-6">
                  <div class="text-3xl mb-2">✨</div>
                  <p class="font-semibold text-emerald-400">¡No te queda ningún logro pendiente!</p>
                </div>
                <div v-else class="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 gap-2.5">
                  <div v-for="(a, idx) in pendingSorted" :key="idx" class="group/tile relative aspect-square rounded-xl">
                    <div class="w-full h-full opacity-40 grayscale"><CosmeticIcon framed :icon-key="iconKeyFor(a)" :rarity="rarityFor(a)" :size="64" /></div>

                    <div class="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-30 w-64 rounded-xl border border-white/15 bg-slate-900/95 backdrop-blur p-3 opacity-0 translate-y-1 shadow-2xl transition-all group-hover/tile:opacity-100 group-hover/tile:translate-y-0">
                      <div class="flex items-start gap-2.5">
                        <div class="size-10 flex-none opacity-60 grayscale"><CosmeticIcon framed :icon-key="iconKeyFor(a)" :rarity="rarityFor(a)" :size="40" /></div>
                        <div class="min-w-0">
                          <p class="font-bold text-xs text-slate-200 leading-tight">{{ a.achievements?.name || 'Logro' }}</p>
                          <p class="text-[10px] font-semibold text-slate-500 mt-0.5">🔒 +{{ a.achievements?.points ?? 0 }} XP al conseguirlo</p>
                        </div>
                      </div>
                      <p v-if="a.achievements?.description" class="text-[10px] text-slate-400 leading-snug mt-2">{{ a.achievements.description }}</p>
                      <template v-if="unlockInfoFor(a).length">
                        <div class="text-[9px] uppercase tracking-wider text-slate-500 font-semibold mt-2 pt-2 border-t border-white/10 mb-1.5">Al conseguirlo, desbloqueás</div>
                        <div class="grid grid-cols-3 gap-2 place-items-center">
                          <div v-for="u in unlockInfoFor(a)" :key="u.code" class="flex flex-col items-center gap-1">
                            <PassCosmetic :cos="u" :size="34" />
                            <div class="text-[8px] font-semibold text-slate-300 text-center leading-tight">{{ u.name }}</div>
                          </div>
                        </div>
                      </template>
                    </div>
                  </div>
                </div>
              </div>

              <!-- VISTA LISTA -->
              <div class="p-5" v-else>
                <h4 class="text-sm font-bold text-slate-200 mb-3">Desbloqueados <span class="text-xs px-2 py-0.5 rounded-full bg-white/10 text-slate-400">{{ unlockedSorted.length }}</span></h4>
                <div v-if="!unlockedSorted.length" class="text-slate-400 text-center py-6 mb-6">Aún no desbloqueaste ningún logro.</div>
                <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
                  <div v-for="(a, idx) in unlockedSorted" :key="idx" class="group/ach relative rounded-xl border border-white/10 bg-slate-800/70 hover:border-white/20 p-4 transition-all">
                    <div class="flex items-start gap-3">
                      <div class="relative flex-none">
                        <div class="size-12"><CosmeticIcon framed :icon-key="iconKeyFor(a)" :rarity="rarityFor(a)" :size="48" /></div>
                        <div v-if="percentages[a.achievements?.code]" class="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold backdrop-blur border" :class="pctClass(a.achievements?.code)">{{ percentages[a.achievements?.code] }}%</div>
                      </div>
                      <div class="min-w-0 flex-1">
                        <p class="font-bold text-sm leading-tight text-white">{{ a.achievements?.name || 'Logro' }}</p>
                        <p v-if="a.achievements?.description" class="text-[11px] leading-snug mt-1 line-clamp-2 text-slate-400">{{ a.achievements.description }}</p>
                        <p v-if="reasonFor(a)" class="text-[11px] leading-snug mt-0.5 text-violet-300/90">{{ reasonFor(a) }}</p>
                        <div class="mt-1.5 flex items-center justify-between">
                          <span class="text-[11px] font-semibold text-emerald-300">+{{ a.achievements?.points ?? 0 }} XP</span>
                          <span class="text-[10px] text-slate-400">{{ new Date(a.earned_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }) }}</span>
                        </div>
                      </div>
                    </div>

                    <!-- Popup flotante on-hover: qué cosmético desbloquea (patrón PlanCard/Pricing) -->
                    <div v-if="unlockInfoFor(a).length" class="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-30 w-64 rounded-xl border border-white/15 bg-slate-900/95 backdrop-blur p-3 opacity-0 translate-y-1 shadow-2xl transition-all group-hover/ach:opacity-100 group-hover/ach:translate-y-0">
                      <div class="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-2">Desbloqueaste</div>
                      <div class="grid grid-cols-3 gap-2 place-items-center">
                        <div v-for="u in unlockInfoFor(a)" :key="u.code" class="flex flex-col items-center gap-1">
                          <PassCosmetic :cos="u" :size="40" />
                          <div class="text-[9px] font-semibold text-slate-300 text-center leading-tight">{{ u.name }}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <h4 class="text-sm font-bold text-slate-200 mb-3">Pendientes <span class="text-xs px-2 py-0.5 rounded-full bg-white/10 text-slate-400">{{ pendingSorted.length }}</span></h4>
                <div v-if="!pendingSorted.length" class="text-center py-6">
                  <div class="text-3xl mb-2">✨</div>
                  <p class="font-semibold text-emerald-400">¡No te queda ningún logro pendiente!</p>
                </div>
                <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div v-for="(a, idx) in pendingSorted" :key="idx" class="group/ach relative rounded-xl border border-white/5 bg-slate-900/40 p-4 transition-all">
                    <div class="flex items-start gap-3">
                      <div class="relative flex-none">
                        <div class="size-12 opacity-40 grayscale"><CosmeticIcon framed :icon-key="iconKeyFor(a)" :rarity="rarityFor(a)" :size="48" /></div>
                      </div>
                      <div class="min-w-0 flex-1">
                        <p class="font-bold text-sm leading-tight text-slate-300">{{ a.achievements?.name || 'Logro' }}</p>
                        <p v-if="a.achievements?.description" class="text-[11px] leading-snug mt-1 line-clamp-2 text-slate-500">{{ a.achievements.description }}</p>
                        <div class="mt-1.5 flex items-center justify-between">
                          <span class="text-[11px] font-semibold text-slate-500">+{{ a.achievements?.points ?? 0 }} XP</span>
                          <span class="text-[10px] text-slate-500">🔒</span>
                        </div>
                      </div>
                    </div>

                    <!-- Popup flotante on-hover: qué desbloqueás si conseguís este logro -->
                    <div v-if="unlockInfoFor(a).length" class="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-30 w-64 rounded-xl border border-white/15 bg-slate-900/95 backdrop-blur p-3 opacity-0 translate-y-1 shadow-2xl transition-all group-hover/ach:opacity-100 group-hover/ach:translate-y-0">
                      <div class="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-2">Al conseguirlo, desbloqueás</div>
                      <div class="grid grid-cols-3 gap-2 place-items-center">
                        <div v-for="u in unlockInfoFor(a)" :key="u.code" class="flex flex-col items-center gap-1">
                          <PassCosmetic :cos="u" :size="40" />
                          <div class="text-[9px] font-semibold text-slate-300 text-center leading-tight">{{ u.name }}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.ach-modal-enter-active, .ach-modal-leave-active { transition: opacity 0.2s ease; }
.ach-modal-enter-from, .ach-modal-leave-to { opacity: 0; }
/* CosmeticIcon fija width/height en px vía prop; acá lo usamos dentro de cajas
   fluidas (grilla responsiva, tarjetas), así que lo estiramos al 100% del padre. */
:deep(.cosmetic-icon) { width: 100%; height: 100%; }
</style>
