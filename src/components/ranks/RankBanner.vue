<script setup>
/**
 * Banner de rango (kit v2): dibujo de la camiseta a todo el ancho + nombre + escudo a la derecha.
 * size: 's' (180) | 'm' (360) | 'l' (640) | número · fluid: ocupa el ancho del contenedor.
 */
import { computed } from 'vue'
import { bannerSvg, crestUid } from '@/services/rank-crest'

const props = defineProps({
  tier: { type: [Object, String], required: true },
  size: { type: [String, Number], default: 'm' },
  subtitle: { type: String, default: undefined },
  fluid: { type: Boolean, default: false },
  locked: { type: Boolean, default: false },
})
const uid = crestUid('rb')
const svg = computed(() => bannerSvg(props.tier, { size: props.size, uid, subtitle: props.subtitle }))
</script>

<template>
  <span class="rank-banner" :class="{ 'is-fluid': fluid, 'is-locked': locked }" v-html="svg" />
</template>

<style scoped>
.rank-banner { display: inline-block; line-height: 0; }
.rank-banner :deep(svg) { display: block; max-width: 100%; height: auto; }
.rank-banner.is-fluid { display: block; width: 100%; }
.rank-banner.is-fluid :deep(svg) { width: 100%; }
.rank-banner.is-locked { filter: grayscale(1) brightness(.55); }
</style>
