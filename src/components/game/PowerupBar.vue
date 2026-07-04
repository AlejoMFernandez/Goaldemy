<script setup>
import { ref, onMounted } from 'vue'
import { getAvailablePowerups, usePowerup } from '../../services/powerups'
import PowerupIcon from '../rewards/PowerupIcon.vue'

const props = defineProps({
  disabledTypes: { type: Array, default: () => [] },
  hide: { type: Boolean, default: false },
})

const emit = defineEmits(['use'])

const powerups = ref([])
const using = ref(null)

async function load() {
  powerups.value = await getAvailablePowerups()
}

async function activate(type) {
  if (using.value) return
  const pu = powerups.value.find(p => p.key === type)
  if (!pu || pu.count <= 0) return

  using.value = type
  const ok = await usePowerup(type)
  if (ok) {
    pu.count--
    emit('use', type)
  }
  setTimeout(() => { using.value = null }, 400)
}

// Tintes translúcidos tipo glass (calmados), un color por ayuda para reconocerlas
const COLORS = {
  fifty_fifty: 'bg-fuchsia-500/10 ring-fuchsia-400/25 text-fuchsia-200',
  shield: 'bg-sky-500/10 ring-sky-400/25 text-sky-200',
  extra_time: 'bg-amber-500/10 ring-amber-400/25 text-amber-100',
  reveal_hint: 'bg-emerald-500/10 ring-emerald-400/25 text-emerald-200',
}

function puColor(key) {
  return COLORS[key] || 'bg-white/5 ring-white/15 text-white'
}

onMounted(load)

defineExpose({ reload: load })
</script>

<template>
  <Transition name="dock-fade">
    <!-- Barra de ayudas INTEGRADA a la tarjeta del juego (antes flotaba al borde de la pantalla) -->
    <div v-if="!hide && powerups.length > 0" class="mt-6 pt-4 border-t border-white/10">
      <div class="flex items-center justify-center gap-2.5 flex-wrap">
        <span class="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-amber-400/90 font-semibold mr-1">
          <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          Ayudas
        </span>
        <button
          v-for="pu in powerups"
          :key="pu.key"
          :disabled="pu.count <= 0 || disabledTypes.includes(pu.key) || using === pu.key"
          class="powerup-tile group relative grid place-items-center rounded-xl ring-1 backdrop-blur-md transition-all duration-200"
          :class="[
            pu.count > 0 && !disabledTypes.includes(pu.key)
              ? `${puColor(pu.key)} hover:brightness-110 hover:scale-110 active:scale-95 cursor-pointer`
              : 'bg-white/[0.03] ring-white/10 text-white/40 cursor-not-allowed',
            using === pu.key ? 'animate-bounce scale-110' : '',
          ]"
          :title="pu.description"
          @click="activate(pu.key)"
        >
          <PowerupIcon :type="pu.key" :size="38" />
          <span
            v-if="pu.count > 0"
            class="absolute -top-1.5 -right-1.5 grid place-items-center min-w-[17px] h-[17px] px-1 rounded-full bg-slate-900/95 ring-1 ring-white/15 text-[10px] font-bold text-white leading-none"
          >
            {{ pu.count }}
          </span>
          <span class="pointer-events-none absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900/95 px-2 py-1 text-[11px] font-semibold text-white opacity-0 shadow-xl ring-1 ring-white/10 transition-opacity group-hover:opacity-100">
            {{ pu.name }}
          </span>
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.powerup-tile {
  width: 44px;
  height: 44px;
}
@media (min-width: 640px) {
  .powerup-tile {
    width: 48px;
    height: 48px;
  }
}
.dock-fade-enter-active,
.dock-fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.dock-fade-enter-from,
.dock-fade-leave-to {
  opacity: 0;
}
</style>
