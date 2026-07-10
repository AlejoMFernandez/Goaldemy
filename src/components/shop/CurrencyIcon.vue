<script setup>
/**
 * Íconos SVG únicos de las monedas de Goaldemy (reemplazan los emojis ⚽/🏆):
 *  • fichas  — moneda blanda: ficha/token esmeralda con pelota de fútbol.
 *  • balones — moneda dura: Balón de Oro (esfera dorada sobre pedestal).
 * IDs de gradiente únicos por instancia para no colisionar cuando hay varios.
 */
import { computed } from 'vue'

const props = defineProps({
  type: { type: String, default: 'fichas' }, // 'fichas' | 'balones'
  size: { type: Number, default: 20 },
})

let _uid = 0
const uid = `cur-${(_uid = Math.random().toString(36).slice(2, 8))}`
const isBalon = computed(() => props.type === 'balones')
</script>

<template>
  <!-- ── BALÓN DE ORO (moneda dura) ── -->
  <svg v-if="isBalon" :width="size" :height="size" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <radialGradient :id="`${uid}-ball`" cx="38%" cy="34%" r="72%">
        <stop offset="0%" stop-color="#fff7d6" />
        <stop offset="42%" stop-color="#fcd34d" />
        <stop offset="100%" stop-color="#b45309" />
      </radialGradient>
      <linearGradient :id="`${uid}-base`" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#fbbf24" />
        <stop offset="100%" stop-color="#92400e" />
      </linearGradient>
    </defs>
    <!-- Pedestal -->
    <rect x="8.5" y="20.4" width="7" height="1.9" rx="0.6" :fill="`url(#${uid}-base)`" />
    <path d="M10 17.8h4l0.9 2.8h-5.8z" :fill="`url(#${uid}-base)`" />
    <!-- Esfera dorada -->
    <circle cx="12" cy="10.5" r="7.6" :fill="`url(#${uid}-ball)`" stroke="#78350f" stroke-width="0.6" />
    <!-- Costuras de pelota (pentágonos estilizados) -->
    <g fill="#7c4a09" opacity="0.9">
      <path d="M12 6.4l2.1 1.5-0.8 2.5h-2.6l-0.8-2.5z" />
    </g>
    <g stroke="#7c4a09" stroke-width="0.7" stroke-linecap="round" opacity="0.75" fill="none">
      <path d="M12 4.2v2.2M9.1 8l-2 -0.7M14.9 8l2 -0.7M10.3 12.4l-1.4 1.9M13.7 12.4l1.4 1.9" />
    </g>
    <!-- Brillo -->
    <ellipse cx="9.6" cy="8" rx="1.7" ry="1.1" fill="#fffbe8" opacity="0.55" transform="rotate(-25 9.6 8)" />
  </svg>

  <!-- ── FICHAS (moneda blanda) ── -->
  <svg v-else :width="size" :height="size" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <linearGradient :id="`${uid}-coin`" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#6ee7b7" />
        <stop offset="55%" stop-color="#10b981" />
        <stop offset="100%" stop-color="#0e7490" />
      </linearGradient>
    </defs>
    <!-- Ficha/token con muescas de casino -->
    <circle cx="12" cy="12" r="10.5" :fill="`url(#${uid}-coin)`" />
    <g fill="#ecfeff" opacity="0.85">
      <rect x="11.1" y="1.2" width="1.8" height="2.6" rx="0.4" />
      <rect x="11.1" y="20.2" width="1.8" height="2.6" rx="0.4" />
      <rect x="1.2" y="11.1" width="2.6" height="1.8" rx="0.4" />
      <rect x="20.2" y="11.1" width="2.6" height="1.8" rx="0.4" />
      <rect x="3.9" y="3.9" width="1.8" height="2.6" rx="0.4" transform="rotate(-45 4.8 5.2)" />
      <rect x="18.3" y="3.9" width="1.8" height="2.6" rx="0.4" transform="rotate(45 19.2 5.2)" />
      <rect x="3.9" y="17.5" width="1.8" height="2.6" rx="0.4" transform="rotate(45 4.8 18.8)" />
      <rect x="18.3" y="17.5" width="1.8" height="2.6" rx="0.4" transform="rotate(-45 19.2 18.8)" />
    </g>
    <!-- Disco interior -->
    <circle cx="12" cy="12" r="7.4" fill="#065f46" opacity="0.55" />
    <circle cx="12" cy="12" r="7.4" fill="none" stroke="#ecfeff" stroke-width="0.7" opacity="0.6" />
    <!-- Pelota de fútbol simplificada -->
    <g>
      <path d="M12 7.6l2.9 2.1-1.1 3.4h-3.6l-1.1-3.4z" fill="#022c22" />
      <g stroke="#022c22" stroke-width="0.9" stroke-linecap="round" opacity="0.85" fill="none">
        <path d="M12 5.2v2.4M8.4 9.6l-2 -0.8M15.6 9.6l2 -0.8M9.8 14.3l-1.5 2M14.2 14.3l1.5 2" />
      </g>
    </g>
  </svg>
</template>
