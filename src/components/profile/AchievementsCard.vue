<script setup>
import { ref, computed, onMounted } from 'vue'
import { getAchievementsCatalog } from '../../services/achievements'

const props = defineProps({
  achievements: { type: Array, required: true },
  loading: { type: Boolean, default: false },
  featuredCodes: { type: Array, default: () => [] }, // Array of achievement codes to show as featured
  isSelf: { type: Boolean, default: false }, // If viewing own profile
})

const emit = defineEmits(['customize'])

// Load catalog from DB
const ACHIEVEMENTS = ref({})
onMounted(async () => {
  ACHIEVEMENTS.value = await getAchievementsCatalog()
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
  <div class="rounded-lg border border-white/10 p-4 w-full">
    <div class="flex items-center justify-between">
      <p class="text-xs uppercase tracking-wide text-slate-400">Logros</p>
      <div class="flex items-center gap-2">
        <span class="text-[10px] text-slate-400">{{ achievements.length }} / {{ totalCatalog }}</span>
        <button 
          v-if="isSelf && achievements.length > 0"
          @click="$emit('customize')"
          class="px-2 py-1 rounded text-[10px] font-semibold border border-emerald-400/30 text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 transition">
          Personalizar
        </button>
      </div>
    </div>
    <div v-if="showAll" class="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
      <button v-for="t in tabs" :key="t.key" @click="selected=t.key"
        class="px-2.5 py-1.5 rounded-md border transition-all whitespace-nowrap"
        :class="selected===t.key ? 'border-[oklch(0.62_0.21_270)]/50 bg-[oklch(0.62_0.21_270)]/10 text-[oklch(0.80_0.21_270)] font-semibold' : 'border-white/10 text-slate-400 hover:bg-white/5 hover:border-white/20'">
        {{ t.label }}
      </button>
    </div>
    <div class="mt-3 text-sm text-slate-300">
      <div v-if="loading">Cargando…</div>
      <template v-else>
        <div v-if="!displayList.length && !showAll" class="text-slate-500 text-center py-4">
          Aún no hay logros destacados
        </div>
        <div v-else-if="!displayList.length && showAll" class="text-slate-500">
          <template v-if="selected==='missing'">¡Felicitaciones! No tenés logros pendientes.</template>
          <template v-else>Aún no hay logros en esta categoría</template>
        </div>
        <!-- Grouped view for "all" category -->
        <template v-else-if="groupedAchievements && selected === 'all'">
          <div v-for="group in groupedAchievements" :key="group.category.key" class="mb-6 last:mb-0">
            <h3 class="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              {{ group.category.label }}
              <span class="text-xs text-slate-500">({{ group.items.length }})</span>
            </h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div
                v-for="(a, idx) in group.items"
                :key="idx"
                class="relative overflow-hidden rounded-xl border bg-gradient-to-br p-3 transition h-28 flex flex-col border-white/10 from-slate-900/70 to-slate-800/40 hover:border-white/20">
                <div class="flex items-start gap-3 flex-1 min-h-0">
                  <img v-if="iconFor(a)" :src="iconFor(a)" class="w-10 h-10 rounded flex-none" alt="icon" />
                  <div v-else class="w-10 h-10 rounded bg-slate-700/60 flex items-center justify-center text-slate-300/80 flex-none">🏆</div>
                  <div class="min-w-0 flex-1">
                    <p class="font-semibold leading-tight truncate text-slate-100">{{ a.achievements?.name || 'Logro' }}</p>
                    <p v-if="a.achievements?.description" class="text-[11px] line-clamp-2 text-slate-400">{{ a.achievements.description }}</p>
                  </div>
                </div>
                <div class="mt-2 flex items-center justify-between text-[11px]">
                  <span class="font-semibold text-emerald-300">+{{ a.achievements?.points ?? 0 }} XP</span>
                  <span class="text-slate-400">{{ new Date(a.earned_at).toLocaleDateString() }}</span>
                </div>
              </div>
            </div>
          </div>
        </template>
        <!-- Single category or filtered view -->
        <div v-else>
          <h3 v-if="currentCategoryLabel && selected !== 'all'" class="text-sm font-semibold text-slate-300 mb-3">
            {{ currentCategoryLabel }}
          </h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div
            v-for="(a, idx) in displayList"
            :key="idx"
            class="relative overflow-hidden rounded-xl border bg-gradient-to-br p-3 transition h-28 flex flex-col"
            :class="a._missing ? 'border-white/5 from-slate-900/40 to-slate-800/20 hover:border-white/10' : 'border-white/10 from-slate-900/70 to-slate-800/40 hover:border-white/20'">
            <div class="flex items-start gap-3 flex-1 min-h-0">
              <img v-if="iconFor(a)" :src="iconFor(a)" class="w-10 h-10 rounded flex-none" alt="icon" />
              <div v-else class="w-10 h-10 rounded bg-slate-700/60 flex items-center justify-center text-slate-300/80 flex-none">🏆</div>
              <div class="min-w-0 flex-1">
                <p class="font-semibold leading-tight truncate" :class="a._missing ? 'text-slate-200' : 'text-slate-100'">{{ a.achievements?.name || 'Logro' }}</p>
                <p v-if="a.achievements?.description" class="text-[11px] line-clamp-2" :class="a._missing ? 'text-slate-500' : 'text-slate-400'">{{ a.achievements.description }}</p>
              </div>
            </div>
            <div class="mt-2 flex items-center justify-between text-[11px]">
              <div class="flex items-center gap-2">
                <span class="font-semibold" :class="a._missing ? 'text-emerald-300/70' : 'text-emerald-300'">+{{ a.achievements?.points ?? 0 }} XP</span>
                <span v-if="difficultyFor(a)" class="px-1.5 py-0.5 rounded-full border text-[10px] uppercase tracking-wide"
                  :class="{
                    'border-green-400/40 text-green-300 bg-green-400/10': difficultyFor(a)==='fácil',
                    'border-amber-400/40 text-amber-300 bg-amber-400/10': difficultyFor(a)==='media',
                    'border-sky-400/40 text-sky-300 bg-sky-400/10': difficultyFor(a)==='difícil',
                    'border-fuchsia-400/40 text-fuchsia-300 bg-fuchsia-400/10': difficultyFor(a)==='épico',
                  }">
                  {{ difficultyFor(a) }}
                </span>
              </div>
              <span class="text-slate-400">
                <template v-if="a._missing">Pendiente</template>
                <template v-else>{{ new Date(a.earned_at).toLocaleDateString() }}</template>
              </span>
            </div>
          </div>
        </div>
        </div>
        <!-- Show All / Show Less button -->
        <div v-if="achievements.length > 3" class="mt-4 text-center">
          <button 
            @click="showAll = !showAll"
            class="px-4 py-2 rounded-lg border border-white/10 text-slate-300 hover:bg-white/5 transition font-semibold text-sm">
            {{ showAll ? '← Ver destacados' : `Ver todos (${achievements.length}) →` }}
          </button>
        </div>
      </template>
    </div>
  </div>
  
</template>
