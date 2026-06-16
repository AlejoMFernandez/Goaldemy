<script setup>
import { ref, onMounted } from 'vue'
import { getAvailablePowerups, usePowerup } from '../../services/powerups'

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

onMounted(load)

defineExpose({ reload: load })
</script>

<template>
  <Transition name="bar-slide">
    <div
      v-if="!hide && powerups.length > 0"
      class="flex items-center justify-center gap-2 py-2 px-3"
    >
      <button
        v-for="pu in powerups"
        :key="pu.key"
        :disabled="pu.count <= 0 || disabledTypes.includes(pu.key) || using === pu.key"
        class="relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-all duration-200"
        :class="[
          pu.count > 0 && !disabledTypes.includes(pu.key)
            ? 'bg-white/10 hover:bg-white/20 text-white cursor-pointer hover:scale-105 active:scale-95'
            : 'bg-white/5 text-white/30 cursor-not-allowed',
          using === pu.key ? 'animate-pulse scale-110' : '',
        ]"
        :title="pu.description"
        @click="activate(pu.key)"
      >
        <span class="text-base">{{ pu.icon }}</span>
        <span class="hidden sm:inline">{{ pu.name }}</span>
        <span
          class="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[11px] font-bold leading-none"
          :class="pu.count > 0 ? 'bg-white/20 text-white' : 'bg-white/5 text-white/30'"
        >
          {{ pu.count }}
        </span>
      </button>
    </div>
  </Transition>
</template>

<style scoped>
.bar-slide-enter-active,
.bar-slide-leave-active {
  transition: all 0.3s ease;
}
.bar-slide-enter-from,
.bar-slide-leave-to {
  opacity: 0;
  transform: translateY(12px);
}
</style>
