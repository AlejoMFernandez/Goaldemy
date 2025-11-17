<script setup>
import { ref, computed } from 'vue'
import { ACHIEVEMENTS } from '../../services/achievements-catalog'

const props = defineProps({
  achievements: { type: Array, required: true },
  currentFeatured: { type: Array, default: () => [] }, // Array of achievement codes
})

const emit = defineEmits(['save', 'cancel'])

// Local state for selected achievements (array of codes)
const selected = ref([...props.currentFeatured])

// Build a map of owned achievements by code
const ownedByCode = computed(() => {
  const map = new Map()
  props.achievements.forEach(a => {
    const code = a?.achievements?.code
    if (code) map.set(code, a)
  })
  return map
})

// Available achievements to select from (owned only)
const availableList = computed(() => {
  return props.achievements
    .filter(a => a?.achievements?.code)
    .map(a => ({
      code: a.achievements.code,
      name: a.achievements.name,
      description: a.achievements.description,
      icon_url: a.achievements.icon_url,
      points: a.achievements.points,
      difficulty: ACHIEVEMENTS[a.achievements.code]?.difficulty || null,
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
        <div class="mt-4 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-400/20">
          <span class="text-emerald-400 font-semibold">{{ selected.length }} / 3</span>
          <span class="text-sm text-slate-300">seleccionados</span>
        </div>
      </div>

      <!-- Body - scrollable list -->
      <div class="p-6 max-h-[60vh] overflow-y-auto">
        <div v-if="!availableList.length" class="text-center text-slate-400 py-8">
          Aún no tenés logros desbloqueados
        </div>
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            v-for="ach in availableList"
            :key="ach.code"
            @click="toggleSelection(ach.code)"
            class="relative text-left rounded-xl border p-4 transition"
            :class="isSelected(ach.code) 
              ? 'border-emerald-400/50 bg-emerald-500/10 shadow-lg shadow-emerald-500/20' 
              : 'border-white/10 bg-slate-800/40 hover:border-white/20 hover:bg-slate-800/60'
            ">
            <!-- Selected checkmark -->
            <div v-if="isSelected(ach.code)" class="absolute top-2 right-2 w-6 h-6 rounded-full bg-emerald-500 grid place-items-center">
              <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <div class="flex items-start gap-3">
              <img v-if="ach.icon_url" :src="ach.icon_url" class="w-12 h-12 rounded flex-none" alt="icon" />
              <div v-else class="w-12 h-12 rounded bg-slate-700/60 flex items-center justify-center text-slate-300/80 flex-none">🏆</div>
              
              <div class="flex-1 min-w-0 pr-6">
                <p class="font-semibold text-white leading-tight">{{ ach.name }}</p>
                <p class="text-xs text-slate-400 mt-1 line-clamp-2">{{ ach.description }}</p>
                <div class="mt-2 flex items-center gap-2 text-xs">
                  <span class="font-semibold text-emerald-300">+{{ ach.points }} XP</span>
                  <span v-if="ach.difficulty" class="px-2 py-0.5 rounded-full border text-[10px] uppercase"
                    :class="{
                      'border-green-400/40 text-green-300 bg-green-400/10': ach.difficulty==='fácil',
                      'border-amber-400/40 text-amber-300 bg-amber-400/10': ach.difficulty==='media',
                      'border-sky-400/40 text-sky-300 bg-sky-400/10': ach.difficulty==='difícil',
                      'border-fuchsia-400/40 text-fuchsia-300 bg-fuchsia-400/10': ach.difficulty==='épico',
                    }">
                    {{ ach.difficulty }}
                  </span>
                </div>
              </div>
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
            ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/20' 
            : 'bg-slate-700 text-slate-500 cursor-not-allowed'
          ">
          Guardar
        </button>
      </div>
    </div>
  </div>
</template>
