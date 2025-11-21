<script setup>
import { ref, computed, onMounted } from 'vue'
import { getAchievementsCatalog, getAchievementUnlockPercentages } from '../../services/achievements'

const props = defineProps({
  achievements: { type: Array, required: true },
  loading: { type: Boolean, default: false },
  featuredCodes: { type: Array, default: () => [] }, // Array of achievement codes to show as featured
  isSelf: { type: Boolean, default: false }, // If viewing own profile
})

const emit = defineEmits(['customize'])

// Load catalog from DB
const ACHIEVEMENTS = ref({})
const percentages = ref({})
onMounted(async () => {
  ACHIEVEMENTS.value = await getAchievementsCatalog()
  percentages.value = await getAchievementUnlockPercentages()
})

function difficultyFor(a) {
  const code = a?.achievements?.code
  if (!code) return null
  // No difficulty info in DB yet, could be added later
  return null
}

// Fallback de íconos por código (por si en la DB falta o el link externo cayó)
const ICONS_BY_CODE = {
  daily_streak_3: '/achievements/daily-streak-3.svg',
}
function iconFor(a) {
  const url = a?.achievements?.icon_url
  if (url && typeof url === 'string' && url.trim()) return url
  const code = a?.achievements?.code
  return (code && ICONS_BY_CODE[code]) || ''
}

const showAll = ref(false)
const selected = ref('all')

// Categories based on achievement codes
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
  const arr = Array.isArray(__props.achievements) ? __props.achievements : []
  return new Set(arr.map(a => a?.achievements?.code).filter(Boolean))
})

const missingList = computed(() => {
  const have = ownedCodes.value
  const result = []
  const catalog = ACHIEVEMENTS.value || {}
  for (const code of Object.keys(catalog)) {
    if (!have.has(code)) {
      const meta = catalog[code]
      result.push({
        achievements: { ...meta },
        earned_at: null,
        _missing: true,
      })
    }
  }
  // Sort by name
  result.sort((a,b) => {
    return (a.achievements?.name || '').localeCompare(b.achievements?.name || '')
  })
  return result
})

const filtered = computed(() => {
  if (selected.value === 'missing') {
    return missingList.value
  }
  let arr = Array.isArray(__props.achievements) ? __props.achievements.slice() : []
  
  // Filter by category if selected
  if (selected.value !== 'all') {
    const category = CATEGORIES.find(c => c.key === selected.value)
    if (category) {
      arr = arr.filter(a => category.codes.includes(a?.achievements?.code))
    }
  }
  
  // Sort by earned date (most recent first)
  arr.sort((a,b) => new Date(b.earned_at) - new Date(a.earned_at))
  
  return arr
})

const totalCatalog = computed(() => Object.keys(ACHIEVEMENTS.value || {}).length)

// Featured achievements: filter by featuredCodes prop
const featuredList = computed(() => {
  if (!props.featuredCodes || props.featuredCodes.length === 0) {
    // Default: show first 3 by difficulty/date
    return filtered.value.slice(0, 3)
  }
  // Show achievements matching the featured codes, in the order specified
  const byCode = new Map()
  filtered.value.forEach(a => {
    const code = a?.achievements?.code
    if (code) byCode.set(code, a)
  })
  return props.featuredCodes
    .map(code => byCode.get(code))
    .filter(Boolean)
    .slice(0, 3)
})

// Display list: featured (limited to 3) or full list
const displayList = computed(() => {
  return showAll.value ? filtered.value : featuredList.value
})

// Current category label for display
const currentCategoryLabel = computed(() => {
  if (!showAll.value) return null
  if (selected.value === 'all') return 'Todos los logros'
  if (selected.value === 'missing') return 'Logros pendientes'
  const category = CATEGORIES.find(c => c.key === selected.value)
  return category ? category.label : null
})

// Group achievements by category for "all" view
const groupedAchievements = computed(() => {
  if (selected.value !== 'all' || !showAll.value) return null
  
  const groups = []
  for (const category of CATEGORIES) {
    const items = filtered.value.filter(a => category.codes.includes(a?.achievements?.code))
    if (items.length > 0) {
      groups.push({ category, items })
    }
  }
  return groups
})
</script>

<template>
  <div class="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/50 backdrop-blur p-6 w-full shadow-xl">
    <div class="flex items-center justify-between mb-4">
      <div>
        <p class="text-xs uppercase tracking-wide text-slate-400">Logros</p>
        <p class="text-xs text-slate-400">{{ achievements.length }} de {{ totalCatalog }} desbloqueados</p>
      </div>
      <button 
        v-if="isSelf && achievements.length > 0"
        @click="$emit('customize')"
        class="h-8 w-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 grid place-items-center transition-all"
        title="Personalizar logros destacados">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-4 w-4 text-slate-200">
          <path d="M21.731 2.269a2.625 2.625 0 00-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 000-3.712zM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 00-1.32 2.214l-.8 2.685a.75.75 0 00.933.933l2.685-.8a5.25 5.25 0 002.214-1.32l8.4-8.4z" />
          <path d="M5.25 5.25a3 3 0 00-3 3v10.5a3 3 0 003 3h10.5a3 3 0 003-3V13.5a.75.75 0 00-1.5 0v5.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5V8.25a1.5 1.5 0 011.5-1.5h5.25a.75.75 0 000-1.5H5.25z" />
        </svg>
      </button>
    </div>

    <!-- Filter tabs when showing all -->
    <div v-if="showAll" class="flex flex-wrap gap-2 mb-4">
      <button v-for="t in tabs" :key="t.key" @click="selected=t.key"
        class="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all whitespace-nowrap"
        :class="selected===t.key 
          ? 'border-emerald-400/50 bg-emerald-500/20 text-emerald-200 shadow-lg shadow-emerald-500/10' 
          : 'border-white/10 text-slate-400 hover:bg-white/5 hover:border-white/20'">
        {{ t.label }}
      </button>
    </div>

    <div class="text-sm">
      <div v-if="loading" class="text-center py-8 text-slate-400">
        <div class="animate-pulse">Cargando logros...</div>
      </div>
      <template v-else>
        <div v-if="!displayList.length && !showAll" class="text-slate-400 text-center py-8 rounded-xl bg-slate-800/30 border border-white/5">
          <div class="text-3xl mb-2">🎯</div>
          <p>Aún no hay logros destacados</p>
        </div>
        <div v-else-if="!displayList.length && showAll" class="text-slate-400 text-center py-8 rounded-xl bg-slate-800/30 border border-white/5">
          <div class="text-3xl mb-2">✨</div>
          <template v-if="selected==='missing'">
            <p class="font-semibold text-emerald-400">¡Felicitaciones!</p>
            <p class="text-sm mt-1">No tenés logros pendientes</p>
          </template>
          <template v-else>
            <p>Aún no hay logros en esta categoría</p>
          </template>
        </div>

        <!-- Grouped view for "all" category -->
        <template v-else-if="groupedAchievements && selected === 'all'">
          <div v-for="group in groupedAchievements" :key="group.category.key" class="mb-6 last:mb-0">
            <h3 class="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2 px-2">
              {{ group.category.label }}
              <span class="text-xs px-2 py-0.5 rounded-full bg-white/10 text-slate-400">{{ group.items.length }}</span>
            </h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div
                v-for="(a, idx) in group.items"
                :key="idx"
                class="group relative overflow-hidden rounded-xl border transition-all duration-300 hover:scale-[1.02] hover:shadow-lg"
                :class="a._missing 
                  ? 'border-white/5 bg-gradient-to-br from-slate-900/40 via-slate-800/30 to-slate-900/40 hover:border-white/10' 
                  : 'border-white/10 bg-gradient-to-br from-slate-800/80 via-slate-700/60 to-slate-800/80 hover:border-emerald-500/30 hover:shadow-emerald-500/10'">
                
                <!-- Glow effect on hover for unlocked -->
                <div v-if="!a._missing" class="absolute inset-0 bg-gradient-to-br from-emerald-500/0 to-emerald-500/0 group-hover:from-emerald-500/5 group-hover:to-cyan-500/5 transition-all duration-300"></div>
                
                <div class="relative p-4">
                  <div class="flex items-start gap-3 mb-3">
                    <div class="relative flex-none">
                      <img v-if="iconFor(a)" :src="iconFor(a)" 
                        class="w-12 h-12 rounded-lg shadow-md transition-transform group-hover:scale-110" 
                        :class="a._missing ? 'opacity-40 grayscale' : ''"
                        alt="icon" />
                      <div v-else class="w-12 h-12 rounded-lg bg-slate-700/60 flex items-center justify-center text-2xl shadow-md"
                        :class="a._missing ? 'opacity-40 grayscale' : ''">
                        🏆
                      </div>
                      <!-- Percentage badge -->
                      <div v-if="percentages[a.achievements?.code]" 
                        class="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold backdrop-blur border"
                        :class="percentages[a.achievements?.code] < 10 
                          ? 'bg-fuchsia-500/20 border-fuchsia-400/40 text-fuchsia-200' 
                          : percentages[a.achievements?.code] < 30 
                          ? 'bg-amber-500/20 border-amber-400/40 text-amber-200'
                          : 'bg-slate-600/30 border-slate-500/40 text-slate-300'">
                        {{ percentages[a.achievements?.code] }}%
                      </div>
                    </div>
                    <div class="min-w-0 flex-1">
                      <p class="font-bold text-sm leading-tight mb-1" 
                        :class="a._missing ? 'text-slate-300' : 'text-white'">
                        {{ a.achievements?.name || 'Logro' }}
                      </p>
                      <p v-if="a.achievements?.description" 
                        class="text-[11px] leading-snug line-clamp-2" 
                        :class="a._missing ? 'text-slate-500' : 'text-slate-400'">
                        {{ a.achievements.description }}
                      </p>
                    </div>
                  </div>
                  
                  <div class="flex items-center justify-between pt-2 border-t border-white/5">
                    <span class="font-bold text-sm" 
                      :class="a._missing ? 'text-slate-400' : 'text-emerald-300'">
                      +{{ a.achievements?.points ?? 0 }} XP
                    </span>
                    <span class="text-[11px]" :class="a._missing ? 'text-slate-500' : 'text-slate-400'">
                      <template v-if="a._missing">🔒 Bloqueado</template>
                      <template v-else>{{ new Date(a.earned_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }) }}</template>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- Single category or filtered view -->
        <div v-else>
          <h3 v-if="currentCategoryLabel && selected !== 'all'" class="text-sm font-bold text-slate-200 mb-3 px-2">
            {{ currentCategoryLabel }}
          </h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div
              v-for="(a, idx) in displayList"
              :key="idx"
              class="group relative overflow-hidden rounded-xl border transition-all duration-300 hover:scale-[1.02] hover:shadow-lg"
              :class="a._missing 
                ? 'border-white/5 bg-gradient-to-br from-slate-900/40 via-slate-800/30 to-slate-900/40 hover:border-white/10' 
                : 'border-white/10 bg-gradient-to-br from-slate-800/80 via-slate-700/60 to-slate-800/80 hover:border-emerald-500/30 hover:shadow-emerald-500/10'">
              
              <div v-if="!a._missing" class="absolute inset-0 bg-gradient-to-br from-emerald-500/0 to-emerald-500/0 group-hover:from-emerald-500/5 group-hover:to-cyan-500/5 transition-all duration-300"></div>
              
              <div class="relative p-4">
                <div class="flex items-start gap-3 mb-3">
                  <div class="relative flex-none">
                    <img v-if="iconFor(a)" :src="iconFor(a)" 
                      class="w-12 h-12 rounded-lg shadow-md transition-transform group-hover:scale-110" 
                      :class="a._missing ? 'opacity-40 grayscale' : ''"
                      alt="icon" />
                    <div v-else class="w-12 h-12 rounded-lg bg-slate-700/60 flex items-center justify-center text-2xl shadow-md"
                      :class="a._missing ? 'opacity-40 grayscale' : ''">
                      🏆
                    </div>
                    <div v-if="percentages[a.achievements?.code]" 
                      class="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold backdrop-blur border"
                      :class="percentages[a.achievements?.code] < 10 
                        ? 'bg-fuchsia-500/20 border-fuchsia-400/40 text-fuchsia-200' 
                        : percentages[a.achievements?.code] < 30 
                        ? 'bg-amber-500/20 border-amber-400/40 text-amber-200'
                        : 'bg-slate-600/30 border-slate-500/40 text-slate-300'">
                      {{ percentages[a.achievements?.code] }}%
                    </div>
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="font-bold text-sm leading-tight mb-1" 
                      :class="a._missing ? 'text-slate-300' : 'text-white'">
                      {{ a.achievements?.name || 'Logro' }}
                    </p>
                    <p v-if="a.achievements?.description" 
                      class="text-[11px] leading-snug line-clamp-2" 
                      :class="a._missing ? 'text-slate-500' : 'text-slate-400'">
                      {{ a.achievements.description }}
                    </p>
                  </div>
                </div>
                
                <div class="flex items-center justify-between pt-2 border-t border-white/5">
                  <span class="font-bold text-sm" 
                    :class="a._missing ? 'text-slate-400' : 'text-emerald-300'">
                    +{{ a.achievements?.points ?? 0 }} XP
                  </span>
                  <span class="text-[11px]" :class="a._missing ? 'text-slate-500' : 'text-slate-400'">
                    <template v-if="a._missing">🔒 Bloqueado</template>
                    <template v-else>{{ new Date(a.earned_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }) }}</template>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Show All / Show Less button -->
        <div v-if="achievements.length > 3" class="mt-6 text-center">
          <button 
            @click="showAll = !showAll"
            class="px-6 py-2.5 rounded-xl border border-white/10 bg-slate-800/50 text-slate-200 hover:bg-slate-700/50 hover:border-white/20 transition-all font-semibold text-sm shadow-lg hover:shadow-xl">
            {{ showAll ? '← Ver destacados' : `Ver todos los logros (${achievements.length}) →` }}
          </button>
        </div>
      </template>
    </div>
  </div>
  
</template>
