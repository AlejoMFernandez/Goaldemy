<script setup>
import { ref, computed, onMounted } from 'vue'
import { getAchievementsCatalog, getAchievementUnlockPercentages } from '../../services/achievements'

const props = defineProps({
  achievements: { type: Array, required: true },
  loading: { type: Boolean, default: false },
  featuredCodes: { type: Array, default: () => [] },
  isSelf: { type: Boolean, default: false },
})

const emit = defineEmits(['customize'])

const ACHIEVEMENTS = ref({})
const percentages = ref({})
onMounted(async () => {
  ACHIEVEMENTS.value = await getAchievementsCatalog()
  percentages.value = await getAchievementUnlockPercentages()
})

const ICONS_BY_CODE = {
  daily_streak_3: '/achievements/daily-streak-3.svg',
}
function iconFor(a) {
  const url = a?.achievements?.icon_url
  if (url && typeof url === 'string' && url.trim()) return url
  const code = a?.achievements?.code
  return (code && ICONS_BY_CODE[code]) || ''
}

function pctClass(code) {
  const p = percentages.value[code]
  if (p == null) return ''
  if (p < 10) return 'bg-fuchsia-500/20 border-fuchsia-400/40 text-fuchsia-200'
  if (p < 30) return 'bg-amber-500/20 border-amber-400/40 text-amber-200'
  return 'bg-slate-600/30 border-slate-500/40 text-slate-300'
}

const showAll = ref(false)
const selected = ref('all')

const CATEGORIES = [
  { key: 'inicio', label: '🎯 Logros de inicio', codes: ['first_correct', 'first_win'] },
  { key: 'rachas', label: '🔥 Rachas de juego', codes: ['streak_3', 'streak_5', 'streak_10', 'streak_15'] },
  { key: 'daily_wins', label: '📅 Victorias diarias', codes: ['daily_wins_3', 'daily_wins_5', 'daily_wins_all', 'daily_wins_10'] },
  { key: 'daily_streak', label: '🔁 Constancia diaria', codes: ['daily_streak_3', 'daily_streak_5', 'daily_streak_7', 'daily_streak_14', 'daily_streak_30'] },
  { key: 'game_specific', label: '⚽ Logros por juego', codes: ['guess_master', 'nationality_expert', 'position_guru'] },
  { key: 'curious', label: '🎲 Logros curiosos', codes: ['lucky_first', 'comeback_king', 'night_owl', 'early_bird', 'weekend_warrior'] },
  { key: 'epic', label: '🏆 Logros épicos', codes: ['perfectionist', 'hat_trick', 'grand_slam', 'centurion'] },
  { key: 'social', label: '🌟 Logros sociales', codes: ['social_butterfly', 'chat_master'] },
  { key: 'super', label: '💎 Super logros', codes: ['streak_dual_100', 'xp_multi_5k_3', 'daily_super_5x3'] },
]

const tabs = [
  { key: 'all', label: 'Todos' },
  ...CATEGORIES.map(cat => ({ key: cat.key, label: cat.label })),
  { key: 'missing', label: 'Pendientes' },
]

const ownedCodes = computed(() => {
  const arr = Array.isArray(props.achievements) ? props.achievements : []
  return new Set(arr.map(a => a?.achievements?.code).filter(Boolean))
})

const missingList = computed(() => {
  const have = ownedCodes.value
  const result = []
  const catalog = ACHIEVEMENTS.value || {}
  for (const code of Object.keys(catalog)) {
    if (!have.has(code)) result.push({ achievements: { ...catalog[code] }, earned_at: null, _missing: true })
  }
  result.sort((a, b) => (a.achievements?.name || '').localeCompare(b.achievements?.name || ''))
  return result
})

const filtered = computed(() => {
  if (selected.value === 'missing') return missingList.value
  let arr = Array.isArray(props.achievements) ? props.achievements.slice() : []
  if (selected.value !== 'all') {
    const category = CATEGORIES.find(c => c.key === selected.value)
    if (category) arr = arr.filter(a => category.codes.includes(a?.achievements?.code))
  }
  arr.sort((a, b) => new Date(b.earned_at) - new Date(a.earned_at))
  return arr
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

const currentCategoryLabel = computed(() => {
  if (selected.value === 'all') return 'Todos los logros'
  if (selected.value === 'missing') return 'Logros pendientes'
  const category = CATEGORIES.find(c => c.key === selected.value)
  return category ? category.label : null
})

const groupedAchievements = computed(() => {
  if (selected.value !== 'all') return null
  const groups = []
  for (const category of CATEGORIES) {
    const items = filtered.value.filter(a => category.codes.includes(a?.achievements?.code))
    if (items.length > 0) groups.push({ category, items })
  }
  return groups
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
          <img v-if="iconFor(a)" :src="iconFor(a)" class="w-16 h-16 rounded-2xl shadow-lg transition-transform group-hover:scale-110" alt="" />
          <div v-else class="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-slate-700/60 grid place-items-center text-3xl shadow-lg transition-transform group-hover:scale-110">🏆</div>
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
                <h3 class="font-display font-extrabold text-white text-lg">{{ currentCategoryLabel || 'Todos los logros' }}</h3>
                <button @click="showAll = false" class="text-slate-400 hover:text-white transition">
                  <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div class="px-5 pt-4 flex flex-wrap gap-2">
                <button v-for="t in tabs" :key="t.key" @click="selected = t.key"
                  class="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all whitespace-nowrap"
                  :class="selected === t.key ? 'border-emerald-400/50 bg-emerald-500/20 text-emerald-200' : 'border-white/10 text-slate-400 hover:bg-white/5 hover:border-white/20'">
                  {{ t.label }}
                </button>
              </div>

              <div class="p-5">
                <template v-if="groupedAchievements && selected === 'all'">
                  <div v-for="group in groupedAchievements" :key="group.category.key" class="mb-6 last:mb-0">
                    <h4 class="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
                      {{ group.category.label }}
                      <span class="text-xs px-2 py-0.5 rounded-full bg-white/10 text-slate-400">{{ group.items.length }}</span>
                    </h4>
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <div v-for="(a, idx) in group.items" :key="idx" class="relative overflow-hidden rounded-xl border p-4"
                        :class="a._missing ? 'border-white/5 bg-slate-900/40' : 'border-white/10 bg-slate-800/70'">
                        <div class="flex items-start gap-3">
                          <div class="relative flex-none">
                            <img v-if="iconFor(a)" :src="iconFor(a)" class="w-12 h-12 rounded-lg" :class="a._missing ? 'opacity-40 grayscale' : ''" alt="" />
                            <div v-else class="w-12 h-12 rounded-lg bg-slate-700/60 grid place-items-center text-2xl" :class="a._missing ? 'opacity-40 grayscale' : ''">🏆</div>
                            <div v-if="percentages[a.achievements?.code]" class="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold backdrop-blur border" :class="pctClass(a.achievements?.code)">{{ percentages[a.achievements?.code] }}%</div>
                          </div>
                          <div class="min-w-0 flex-1">
                            <p class="font-bold text-sm leading-tight" :class="a._missing ? 'text-slate-300' : 'text-white'">{{ a.achievements?.name || 'Logro' }}</p>
                            <p v-if="a.achievements?.description" class="text-[11px] leading-snug mt-1 line-clamp-2" :class="a._missing ? 'text-slate-500' : 'text-slate-400'">{{ a.achievements.description }}</p>
                            <div class="mt-1.5 flex items-center justify-between">
                              <span class="text-[11px] font-semibold" :class="a._missing ? 'text-slate-500' : 'text-emerald-300'">+{{ a.achievements?.points ?? 0 }} XP</span>
                              <span class="text-[10px]" :class="a._missing ? 'text-slate-500' : 'text-slate-400'"><template v-if="a._missing">🔒</template><template v-else>{{ new Date(a.earned_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }) }}</template></span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </template>

                <div v-else>
                  <div v-if="!filtered.length" class="text-slate-400 text-center py-8">
                    <div class="text-3xl mb-2">✨</div>
                    <p v-if="selected === 'missing'" class="font-semibold text-emerald-400">¡No te queda ningún logro pendiente!</p>
                    <p v-else>Aún no hay logros en esta categoría</p>
                  </div>
                  <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div v-for="(a, idx) in filtered" :key="idx" class="relative overflow-hidden rounded-xl border p-4"
                      :class="a._missing ? 'border-white/5 bg-slate-900/40' : 'border-white/10 bg-slate-800/70'">
                      <div class="flex items-start gap-3">
                        <div class="relative flex-none">
                          <img v-if="iconFor(a)" :src="iconFor(a)" class="w-12 h-12 rounded-lg" :class="a._missing ? 'opacity-40 grayscale' : ''" alt="" />
                          <div v-else class="w-12 h-12 rounded-lg bg-slate-700/60 grid place-items-center text-2xl" :class="a._missing ? 'opacity-40 grayscale' : ''">🏆</div>
                          <div v-if="percentages[a.achievements?.code]" class="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold backdrop-blur border" :class="pctClass(a.achievements?.code)">{{ percentages[a.achievements?.code] }}%</div>
                        </div>
                        <div class="min-w-0 flex-1">
                          <p class="font-bold text-sm leading-tight" :class="a._missing ? 'text-slate-300' : 'text-white'">{{ a.achievements?.name || 'Logro' }}</p>
                          <p v-if="a.achievements?.description" class="text-[11px] leading-snug mt-1 line-clamp-2" :class="a._missing ? 'text-slate-500' : 'text-slate-400'">{{ a.achievements.description }}</p>
                          <div class="mt-1.5 flex items-center justify-between">
                            <span class="text-[11px] font-semibold" :class="a._missing ? 'text-slate-500' : 'text-emerald-300'">+{{ a.achievements?.points ?? 0 }} XP</span>
                            <span class="text-[10px]" :class="a._missing ? 'text-slate-500' : 'text-slate-400'"><template v-if="a._missing">🔒</template><template v-else>{{ new Date(a.earned_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }) }}</template></span>
                          </div>
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
</style>
