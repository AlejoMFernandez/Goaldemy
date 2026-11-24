<script setup>
/**
 * Medallón de rango (kit v2): aro con el dibujo de la camiseta + borde de metal + placa.
 * center: 'emblem' (con el emblema del rango) | 'empty' (hueco para un avatar encima).
 */
import { computed } from 'vue'
import { medallionSvg, crestUid } from '@/services/rank-crest'

const props = defineProps({
  tier: { type: [Object, String], required: true },
  size: { type: [String, Number], default: 'm' },
  plaque: { type: Boolean, default: undefined },
  center: { type: String, default: 'emblem' },
  locked: { type: Boolean, default: false },
})
const uid = crestUid('rm')
const svg = computed(() => medallionSvg(props.tier, { size: props.size, uid, plaque: props.plaque, center: props.center }))
</script>

<template>
  <span class="rank-medallion" :class="{ 'is-locked': locked }" v-html="svg" />
</template>

<style scoped>
.rank-medallion { display: inline-block; line-height: 0; }
.rank-medallion :deep(svg) { display: block; overflow: visible; }
.rank-medallion.is-locked { filter: grayscale(1) brightness(.55); }
</style>
