<script setup>
/**
 * Vista de un cosmético "al desnudo": nada de tarjeta cuadrada genérica alrededor.
 * Cada tipo tiene su propia silueta (ícono = medallón circular, borde = anillo,
 * banner = cinta con punta, título = chip de texto) para que se note qué es de
 * un vistazo, no solo un ítem más metido en una caja. Se usa tanto en el reveal
 * de 1 sola recompensa como en cada carta de la grilla de varias.
 */
import { computed } from 'vue'
import { frameStyle, bannerStyle } from '@/services/cosmetics'
import CosmeticIcon from './CosmeticIcon.vue'

const props = defineProps({
  type: { type: String, default: 'icon' },
  styleKey: { type: String, default: '' },
  rarity: { type: String, default: 'common' },
  name: { type: String, default: '' },
  glow: { type: String, default: 'rgba(148,163,184,0.4)' },
  ringBorder: { type: String, default: 'border-slate-400/40' },
  textClass: { type: String, default: 'text-slate-300' },
  size: { type: Number, default: 96 }, // referencia general de escala
  animated: { type: Boolean, default: false }, // glow pulsante (fase "asentada" del reveal)
})

const glowStyle = computed(() => `filter: drop-shadow(0 0 ${Math.round(props.size * 0.16)}px ${props.glow})`)
const frame = computed(() => frameStyle(props.styleKey))
const banner = computed(() => bannerStyle(props.styleKey))
</script>

<template>
  <!-- ÍCONO: flota libre, circular por naturaleza, sin caja -->
  <div v-if="type === 'icon'" class="grid place-items-center" :style="[glowStyle, animated ? 'animation: glow-pulse 2s ease-in-out infinite' : '']">
    <CosmeticIcon :iconKey="styleKey" :rarity="rarity" :size="Math.round(size * 0.9)" />
  </div>

  <!-- BORDE: el anillo mismo es la pieza, sin backing cuadrado -->
  <div v-else-if="type === 'frame'" :style="[glowStyle, animated ? 'animation: glow-pulse 2s ease-in-out infinite' : '']">
    <div :class="['rounded-full', frame.wrap, frame.pad]">
      <div class="rounded-full bg-gradient-to-br from-slate-700 to-slate-900" :style="{ width: Math.round(size * 0.62) + 'px', height: Math.round(size * 0.62) + 'px' }"></div>
    </div>
  </div>

  <!-- BANNER: cinta con punta (no un rectángulo suelto) -->
  <div v-else-if="type === 'banner'" class="ribbon"
       :class="banner"
       :style="[glowStyle, { width: Math.round(size * 1.55) + 'px', height: Math.round(size * 0.5) + 'px' }, animated ? 'animation: glow-pulse 2s ease-in-out infinite' : '']">
  </div>

  <!-- TÍTULO / genérico: chip de texto brillante, no una caja -->
  <div v-else class="rounded-full border px-4 py-2 backdrop-blur-sm" :class="[ringBorder]" :style="`box-shadow: 0 0 ${Math.round(size*0.18)}px ${glow}`">
    <span class="font-display font-bold" :class="textClass" :style="{ fontSize: Math.round(size * 0.16) + 'px' }">{{ name }}</span>
  </div>
</template>

<style scoped>
.ribbon {
  clip-path: polygon(0% 0%, 82% 0%, 100% 50%, 82% 100%, 0% 100%);
  border-radius: 6px 0 0 6px;
}
</style>
