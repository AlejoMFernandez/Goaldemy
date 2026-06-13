<script>
import { computed, watch } from 'vue'
import { soundManager } from '@/services/sounds'

export default {
  name: 'CircularTimer',
  props: {
    seconds: { type: Number, required: true },
    total: { type: Number, required: true },
  },
  setup(props) {
    const radius = 24
    const circumference = 2 * Math.PI * radius
    const fraction = computed(() => Math.max(0, Math.min(1, props.seconds / Math.max(props.total, 1))))
    const offset = computed(() => circumference * (1 - fraction.value))

    const color = computed(() => {
      if (fraction.value > 0.66) return '#34d399'
      if (fraction.value > 0.33) return '#fbbf24'
      return '#f87171'
    })

    const urgent = computed(() => props.seconds <= 5 && props.seconds > 0)

    watch(() => props.seconds, (val) => {
      if (val <= 5 && val > 0) soundManager.play('tick')
    })

    return { circumference, offset, color, urgent }
  }
}
</script>

<template>
  <div class="relative inline-flex items-center justify-center w-14 h-14" :class="urgent ? 'timer-urgent' : ''">
    <svg class="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
      <circle cx="28" cy="28" :r="24" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="4" />
      <circle
        cx="28" cy="28" :r="24" fill="none"
        :stroke="color"
        stroke-width="4" stroke-linecap="round"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="offset"
        style="transition: stroke-dashoffset 0.3s linear, stroke 0.4s ease"
      />
    </svg>
    <div class="absolute inset-0 flex items-center justify-center font-display text-lg font-bold text-white tabular-nums">
      {{ seconds }}
    </div>
  </div>
</template>
