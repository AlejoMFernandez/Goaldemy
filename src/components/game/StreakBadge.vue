<script>
import { ref, watch } from 'vue'
import { soundManager } from '@/services/sounds'

export default {
  name: 'StreakBadge',
  props: {
    streak: { type: Number, default: 0 },
  },
  setup(props) {
    const animating = ref(false)
    const breaking = ref(false)

    const colorClass = (s) => {
      if (s >= 10) return 'text-yellow-400 border-yellow-500/50 bg-yellow-500/15'
      if (s >= 5) return 'text-emerald-300 border-emerald-500/50 bg-emerald-500/15'
      return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
    }

    const glowIntensity = (s) => {
      if (s >= 10) return 'shadow-yellow-500/40 shadow-lg'
      if (s >= 5) return 'shadow-emerald-500/30 shadow-md'
      return ''
    }

    watch(() => props.streak, (newVal, oldVal) => {
      if (newVal > oldVal && newVal > 0) {
        animating.value = true
        if (newVal % 5 === 0) soundManager.play('combo')
        setTimeout(() => { animating.value = false }, 400)
      } else if (newVal === 0 && oldVal > 1) {
        breaking.value = true
        setTimeout(() => { breaking.value = false }, 500)
      }
    })

    return { animating, breaking, colorClass, glowIntensity }
  }
}
</script>

<template>
  <Transition name="streak-badge">
    <div
      v-if="streak > 0"
      class="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 font-display font-bold text-sm tabular-nums transition-all duration-200"
      :class="[
        colorClass(streak),
        glowIntensity(streak),
        animating ? 'streak-bump' : '',
        breaking ? 'streak-break' : '',
      ]"
    >
      <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z"/>
      </svg>
      <span>×{{ streak }}</span>
    </div>
  </Transition>
</template>

<style scoped>
.streak-badge-enter-active { transition: all 0.3s var(--ease-bounce); }
.streak-badge-leave-active { transition: all 0.2s ease; }
.streak-badge-enter-from { opacity: 0; transform: scale(0.5); }
.streak-badge-leave-to { opacity: 0; transform: scale(0.8); }

.streak-break {
  animation: break-shake 0.5s ease both;
}
@keyframes break-shake {
  0%, 100% { transform: translateX(0) scale(1); opacity: 1; }
  25% { transform: translateX(-4px) scale(0.95); }
  50% { transform: translateX(4px) scale(0.9); }
  75% { transform: translateX(-2px) scale(0.85); opacity: 0.5; }
  100% { transform: translateX(0) scale(0.8); opacity: 0; }
}
</style>
