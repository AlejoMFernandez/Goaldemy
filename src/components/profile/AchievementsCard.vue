<script setup>
import { ref, computed } from 'vue'
import { ACHIEVEMENTS } from '../../services/achievements-catalog'
defineProps({
  achievements: { type: Array, required: true },
  loading: { type: Boolean, default: false },
})

function difficultyFor(a) {
  const code = a?.achievements?.code
  if (!code) return null
  return ACHIEVEMENTS[code]?.difficulty || null
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

const selected = ref('all')
const order = ['épico','difícil','media','fácil', null]
const tabs = [
  { key: 'all', label: 'Todos' },
  { key: 'épico', label: 'Épico' },
  { key: 'difícil', label: 'Difícil' },
  { key: 'media', label: 'Media' },
  { key: 'fácil', label: 'Fácil' },
  { key: 'missing', label: 'Pendientes' },
]

const ownedCodes = computed(() => {
  const arr = Array.isArray(__props.achievements) ? __props.achievements : []
  return new Set(arr.map(a => a?.achievements?.code).filter(Boolean))
})

const missingList = computed(() => {
  const have = ownedCodes.value
  const result = []
  for (const code of Object.keys(ACHIEVEMENTS || {})) {
    if (!have.has(code)) {
      const meta = ACHIEVEMENTS[code]
      result.push({
        achievements: { ...meta },
        earned_at: null,
        _missing: true,
      })
    }
  }
  // sort same as earned: difficulty then name
  result.sort((a,b) => {
    const da = a.achievements?.difficulty
    const db = b.achievements?.difficulty
    const ia = order.indexOf(da === undefined ? null : da)
    const ib = order.indexOf(db === undefined ? null : db)
    if (ia !== ib) return ia - ib
    return (a.achievements?.name || '').localeCompare(b.achievements?.name || '')
  })
  return result
})

const filtered = computed(() => {
  if (selected.value === 'missing') {
    return missingList.value
  }
  let arr = Array.isArray(__props.achievements) ? __props.achievements.slice() : []
  // sort by difficulty (épico primero), luego por fecha
  arr.sort((a,b) => {
    const da = difficultyFor(a)
    const db = difficultyFor(b)
    const ia = order.indexOf(da === undefined ? null : da)
    const ib = order.indexOf(db === undefined ? null : db)
    if (ia !== ib) return ia - ib
    return new Date(b.earned_at) - new Date(a.earned_at)
  })
  if (selected.value !== 'all') {
    arr = arr.filter(a => difficultyFor(a) === selected.value)
  }
  return arr
})

const totalCatalog = computed(() => Object.keys(ACHIEVEMENTS || {}).length)
</script>

<template>
  <div class="rounded-lg border border-white/10 p-4 w-full">
    <div class="flex items-center justify-between">
      <p class="text-xs uppercase tracking-wide text-slate-400">Logros</p>
      <span class="text-[10px] text-slate-400">{{ achievements.length }} / {{ totalCatalog }}</span>
    </div>
    <div class="mt-2 flex items-center gap-1 text-[11px]">
      <button v-for="t in tabs" :key="t.key" @click="selected=t.key"
        class="px-2 py-1 rounded border"
        :class="selected===t.key ? 'border-fuchsia-400/50 bg-fuchsia-400/10 text-fuchsia-200' : 'border-white/10 text-slate-400 hover:bg-white/5'">
        {{ t.label }}
      </button>
    </div>
    <div class="mt-3 text-sm text-slate-300">
      <div v-if="loading">Cargando…</div>
      <template v-else>
        <div v-if="!filtered.length" class="text-slate-500">
          <template v-if="selected==='missing'">¡Felicitaciones! No tenés logros pendientes.</template>
          <template v-else>Aún no hay logros</template>
        </div>
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div
            v-for="(a, idx) in filtered"
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
      </template>
    </div>
  </div>
  
</template>
