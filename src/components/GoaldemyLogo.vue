<script setup>
import { defineProps, computed } from 'vue'

const props = defineProps({
  variant: {
    type: String,
    default: 'full', // 'full' | 'icon' | 'wordmark'
    validator: (value) => ['full', 'icon', 'wordmark'].includes(value)
  },
  size: {
    type: String,
    default: 'md', // 'sm' | 'md' | 'lg' | 'xl'
    validator: (value) => ['sm', 'md', 'lg', 'xl'].includes(value)
  },
  animated: {
    type: Boolean,
    default: false
  }
})

const sizeConfig = {
  sm: { icon: 'h-8', text: 'text-lg' },
  md: { icon: 'h-12', text: 'text-2xl' },
  lg: { icon: 'h-16', text: 'text-3xl' },
  xl: { icon: 'h-24', text: 'text-5xl' }
}

const iconClass = computed(() => sizeConfig[props.size].icon)
const textClass = computed(() => sizeConfig[props.size].text)
</script>

<template>
  <div class="flex items-center gap-2" :class="{ 'group cursor-pointer': animated }">
    <!-- Icon/Logo Mark -->
    <img 
      v-if="variant === 'full' || variant === 'icon'" 
      src="/iconclaro.png"
      alt="Goaldemy"
      :class="[
        iconClass,
        'w-auto object-contain',
        { 'group-hover:scale-110 transition-transform duration-300': animated }
      ]"
    />

    <!-- Wordmark -->
    <span 
      v-if="variant === 'full' || variant === 'wordmark'" 
      :class="[
        textClass,
        'font-bold tracking-tight text-white',
        { 'group-hover:translate-x-1 transition-transform duration-300': animated }
      ]"
      style="font-family: 'Montserrat', sans-serif;"
    >
      GOALDEMY
    </span>
  </div>
</template>

<style scoped>
/* Glow effect on hover */
.group:hover img {
  filter: drop-shadow(0 0 12px rgba(255, 255, 255, 0.3));
}
</style>

