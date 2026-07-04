<script setup>
// Ícono de una AYUDA (power-up). Usa el arte webp de /ayudas/<type>.webp;
// si no existe (404) cae al emoji legacy. type ∈ fifty_fifty|shield|extra_time|reveal_hint.
import { ref, computed } from 'vue'

const props = defineProps({
  type: { type: String, required: true },
  size: { type: Number, default: 28 },
})

const EMOJI = { fifty_fifty: '✂️', shield: '🛡️', extra_time: '⏱️', reveal_hint: '💡' }
const KNOWN = new Set(['fifty_fifty', 'shield', 'extra_time', 'reveal_hint'])

const failed = ref(false)
const useImg = computed(() => KNOWN.has(props.type) && !failed.value)
const src = computed(() => `/ayudas/${props.type}.webp`)
</script>

<template>
  <img
    v-if="useImg"
    :src="src"
    @error="failed = true"
    class="object-contain inline-block select-none"
    :style="{ width: size + 'px', height: size + 'px' }"
    alt=""
  />
  <span v-else class="leading-none" :style="{ fontSize: Math.round(size * 0.82) + 'px' }">{{ EMOJI[type] || '🎁' }}</span>
</template>
