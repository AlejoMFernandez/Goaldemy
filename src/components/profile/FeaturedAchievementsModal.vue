<script setup>
import { ref, computed, onMounted } from 'vue'
import { getAchievementUnlockPercentages } from '../../services/achievements'
import { achievementIcon } from '../../services/achievement-icons'
import AchievementTile from '../rewards/AchievementTile.vue'

const props = defineProps({
  achievements: { type: Array, required: true },
  currentFeatured: { type: Array, default: () => [] }, // Array of achievement codes
})

const emit = defineEmits(['save', 'cancel'])

const percentages = ref({})
onMounted(async () => {
  percentages.value = await getAchievementUnlockPercentages()
})

// Local state for selected achievements (array of codes)
const selected = ref([...props.currentFeatured])

// Logros propios disponibles para destacar, más reciente primero.
const availableList = computed(() => {
  return props.achievements
    .filter(a => a?.achievements?.code)
    .map(a => ({
      code: a.achievements.code,
      name: a.achievements.name,
      description: a.achievements.description,
      earned_at: a.earned_at,
    }))
    .sort((a, b) => new Date(b.earned_at) - new Date(a.earned_at))
})

function toggleSelection(code) {
  const idx = selected.value.indexOf(code)
  if (idx >= 0) {
    selected.value.splice(idx, 1)
  } else {
    if (selected.value.length < 3) {
      selected.value.push(code)
    }
  }
}

function isSelected(code) {
  return selected.value.includes(code)
}

function pctClass(code) {
  const p = percentages.value[code]
  if (p == null) return ''
  if (p < 10) return 'bg-fuchsia-500/20 border-fuchsia-400/40 text-fuchsia-200'
  if (p < 30) return 'bg-amber-500/20 border-amber-400/40 text-amber-200'
  return 'bg-slate-600/30 border-slate-500/40 text-slate-300'
}

function save() {
  emit('save', selected.value)
}

function cancel() {
  emit('cancel')
}

const canSave = computed(() => selected.value.length > 0 && selected.value.length <= 3)
</script>

<template>
  <div class="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4" @click.self="cancel">
    <div class="relative w-full max-w-3xl bg-slate-900 rounded-2xl border border-white/10 shadow-2xl overflow-hidden" @click.stop>
      <!-- Header -->
      <div class="p-6 border-b border-white/10">
        <div class="flex items-start justify-between">
          <div>
            <h2 class="text-2xl font-bold text-white">Personalizar logros destacados</h2>
            <p class="text-sm text-slate-400 mt-1">Elegí hasta 3 logros para mostrar en tu perfil</p>
          </div>
          <button @click="cancel" class="text-slate-400 hover:text-white transition">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <!-- Counter -->
        <div class="mt-4 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-500/10 border border-violet-400/20">
          <span class="text-violet-400 font-semibold">{{ selected.length }} / 3</span>
          <span class="text-sm text-slate-300">seleccionados</span>
        </div>
      </div>

      <!-- Body - grilla plana, sin categorías -->
      <div class="p-6 max-h-[60vh] overflow-y-auto">
        <div v-if="!availableList.length" class="text-center text-slate-400 py-8">
          Aún no tenés logros desbloqueados
        </div>
        <div v-else class="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
          <button
            v-for="(ach, idx) in availableList"
            :key="ach.code"
            @click="toggleSelection(ach.code)"
            class="group/pick relative aspect-square rounded-xl transition-transform hover:scale-105"
          >
            <div class="w-full h-full">
              <AchievementTile :icon-key="achievementIcon(ach.code).icon" :rarity="achievementIcon(ach.code).rarity" :size="64" />
            </div>

            <!-- % de obtención -->
            <div v-if="percentages[ach.code]" class="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold backdrop-blur border pointer-events-none" :class="pctClass(ach.code)">
              {{ percentages[ach.code] }}%
            </div>

            <!-- Selected checkmark -->
            <div v-if="isSelected(ach.code)" class="absolute -top-1.5 -left-1.5 w-6 h-6 rounded-full bg-indigo-500 border-2 border-slate-900 grid place-items-center pointer-events-none">
              <svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div v-if="isSelected(ach.code)" class="absolute inset-0 rounded-xl ring-2 ring-violet-400/70 pointer-events-none"></div>

            <!-- Hover: solo qué es el logro, sin desbloqueables (no hace falta acá) -->
            <div
              class="pointer-events-none absolute left-1/2 -translate-x-1/2 z-30 w-56 rounded-xl border border-white/15 bg-slate-900/95 backdrop-blur p-3 opacity-0 translate-y-1 shadow-2xl transition-all group-hover/pick:opacity-100 group-hover/pick:translate-y-0"
              :class="idx < 6 ? 'top-full mt-2' : 'bottom-full mb-2'"
            >
              <p class="font-bold text-xs text-white leading-tight">{{ ach.name }}</p>
              <p v-if="ach.description" class="text-[11px] text-slate-400 leading-snug mt-1">{{ ach.description }}</p>
            </div>
          </button>
        </div>
      </div>

      <!-- Footer -->
      <div class="p-6 border-t border-white/10 flex items-center justify-end gap-3">
        <button @click="cancel" class="px-4 py-2 rounded-lg border border-white/10 text-slate-300 hover:bg-white/5 transition">
          Cancelar
        </button>
        <button
          @click="save"
          :disabled="!canSave"
          class="px-6 py-2 rounded-lg font-semibold transition"
          :class="canSave
            ? 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-lg shadow-indigo-500/20'
            : 'bg-slate-700 text-slate-500 cursor-not-allowed'
          ">
          Guardar
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
:deep(.achievement-tile) { width: 100%; height: 100%; }
</style>
