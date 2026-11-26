<script setup>
import { computed } from 'vue'
import { rarityOf } from '@/services/rarity'

// Gema facetada que representa la rareza (estilo LoL): color distintivo por rareza.
const props = defineProps({
  rarity: { type: String, default: 'common' },
  size: { type: Number, default: 16 },
})

const g = computed(() => { const r = rarityOf(props.rarity); return { fill: r.c, dark: r.dark, light: r.light } })
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 24 24" class="block" aria-hidden="true">
    <path d="M12 2.5 L21 9.5 L12 21.5 L3 9.5 Z" :fill="g.fill" :stroke="g.dark" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M3 9.5 H21 M12 2.5 L8 9.5 M12 2.5 L16 9.5 M8 9.5 L12 21.5 M16 9.5 L12 21.5" fill="none" :stroke="g.dark" stroke-width="0.7" stroke-opacity="0.55"/>
    <path d="M12 2.5 L8 9.5 H16 Z" :fill="g.light" fill-opacity="0.75"/>
  </svg>
</template>
