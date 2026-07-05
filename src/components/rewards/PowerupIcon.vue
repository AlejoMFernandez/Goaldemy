<script setup>
// Ícono de una AYUDA (power-up), en estilo PLANO (flat) para pegar con el resto
// del juego. Antes usaba arte webp realista de /ayudas/<type>.webp; se veía
// demasiado detallado en una UI plana. Ahora se dibuja inline con currentColor,
// así hereda el tinte de cada ayuda (fucsia/celeste/ámbar/esmeralda).
// type ∈ fifty_fifty|shield|extra_time|reveal_hint.
import { computed } from 'vue'

const props = defineProps({
  type: { type: String, required: true },
  size: { type: Number, default: 28 },
})

const KNOWN = new Set(['fifty_fifty', 'shield', 'extra_time', 'reveal_hint'])
const isKnown = computed(() => KNOWN.has(props.type))
</script>

<template>
  <svg v-if="isKnown" :width="size" :height="size" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"
       class="block select-none" aria-hidden="true">
    <!-- 50:50 — círculo mitad lleno -->
    <template v-if="type === 'fifty_fifty'">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" stroke="none" />
    </template>
    <!-- Escudo con check -->
    <template v-else-if="type === 'shield'">
      <path d="M12 3l7 2.8v5c0 4.5-3 7.6-7 9.2-4-1.6-7-4.7-7-9.2v-5z" />
      <path d="M8.7 12.2l2.3 2.3 4.3-4.6" />
    </template>
    <!-- Tiempo extra — reloj + más -->
    <template v-else-if="type === 'extra_time'">
      <circle cx="10.5" cy="13.5" r="7" />
      <path d="M10.5 10v3.5l2.4 1.4" />
      <path d="M18.5 3.5v4M16.5 5.5h4" />
    </template>
    <!-- Pista — lamparita -->
    <template v-else-if="type === 'reveal_hint'">
      <path d="M9.2 17.5h5.6" />
      <path d="M10 20.5h4" />
      <path d="M12 3a6 6 0 0 1 3.9 10.6c-.6.6-1 1.4-1 2.2v.2H9.1v-.2c0-.8-.4-1.6-1-2.2A6 6 0 0 1 12 3z" />
    </template>
  </svg>
  <span v-else class="leading-none" :style="{ fontSize: Math.round(size * 0.82) + 'px' }">🎁</span>
</template>
