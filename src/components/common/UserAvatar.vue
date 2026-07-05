<script setup>
/**
 * Avatar reutilizable: renderiza el ícono/foto del usuario DENTRO de su borde equipado.
 * Fuente única para header, home, y cualquier lugar que muestre "quién sos".
 * Prioridad de lo que se ve adentro: ícono cosmético → foto → inicial.
 * El fondo detrás del ícono es el temático del ícono; si no hay ícono, el color elegido.
 */
import { computed } from 'vue'
import { frameStyle, iconBgStyle, iconThemeBg } from '../../services/cosmetics'
import CosmeticIcon from '../rewards/CosmeticIcon.vue'

const props = defineProps({
  avatarUrl: { type: String, default: '' },
  initial: { type: String, default: '?' },
  frameKey: { type: String, default: 'none' },
  iconGlyph: { type: String, default: '' },
  iconBg: { type: String, default: 'emerald' },
  framePremium: { type: Boolean, default: false },
  size: { type: Number, default: 40 }, // px
  ring: { type: Boolean, default: true }, // false = ícono pelado, sin aro/borde
})

const fr = computed(() => frameStyle(props.frameKey))
const framed = computed(() => !!props.frameKey && props.frameKey !== 'none')
const outerRadius = computed(() => Math.round(props.size * 0.22))
const innerRadius = computed(() => Math.max(4, outerRadius.value - 2))
const iconSize = computed(() => Math.round(props.size * 0.72))
const fontSize = computed(() => Math.round(props.size * 0.42))
const innerBg = computed(() => (props.iconGlyph ? iconThemeBg(props.iconGlyph) : iconBgStyle(props.iconBg)))
</script>

<template>
  <div
    class="inline-block shrink-0"
    :style="{ width: size + 'px', height: size + 'px', borderRadius: outerRadius + 'px' }"
    :class="[fr.wrap, fr.pad, framePremium ? 'anim-pan' : '']"
  >
    <div
      class="relative w-full h-full overflow-hidden grid place-items-center text-white font-extrabold leading-none"
      :class="[innerBg, (framed || !ring) ? '' : 'ring-2 ring-white/10']"
      :style="{ borderRadius: innerRadius + 'px', fontSize: fontSize + 'px' }"
    >
      <CosmeticIcon v-if="iconGlyph" :iconKey="iconGlyph" :size="iconSize" />
      <img v-else-if="avatarUrl" :src="avatarUrl" alt="" class="w-full h-full object-cover" />
      <span v-else>{{ initial }}</span>
    </div>
  </div>
</template>
