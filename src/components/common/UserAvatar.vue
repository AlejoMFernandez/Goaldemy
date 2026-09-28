<script setup>
/**
 * Avatar reutilizable: renderiza el ícono/foto del usuario DENTRO de su borde equipado.
 * Fuente única para header, home, y cualquier lugar que muestre "quién sos".
 * Prioridad de lo que se ve adentro: ícono cosmético → foto → inicial.
 * El fondo detrás del ícono es el temático del ícono; si no hay ícono, el color elegido.
 * El borde lo dibuja <AvatarFrame> (bordes viejos y del vestuario nuevo).
 */
import { computed } from 'vue'
import { iconBgStyle, iconThemeBg, AVATAR_ROUND } from '../../services/cosmetics'
import CosmeticIcon from '../rewards/CosmeticIcon.vue'
import AvatarFrame from './AvatarFrame.vue'

const props = defineProps({
  avatarUrl: { type: String, default: '' },
  initial: { type: String, default: '?' },
  frameKey: { type: String, default: 'none' },
  iconGlyph: { type: String, default: '' },
  iconBg: { type: String, default: 'emerald' },
  framePremium: { type: Boolean, default: false },
  size: { type: Number, default: 40 }, // px
  ring: { type: Boolean, default: true }, // false = ícono pelado, sin aro/borde
  glow: { type: Boolean, default: true }, // false = sin el aura/shadow del marco (para avatares chicos muy pegados a otro UI)
  level: { type: Number, default: null }, // nivel real (borde "Placa de nivel")
  streak: { type: Number, default: 0 },   // racha diaria actual (borde "Racha encendida")
})

const framed = computed(() => !!props.frameKey && props.frameKey !== 'none')
const outerRadius = computed(() => AVATAR_ROUND ? Math.round(props.size / 2) : Math.round(props.size * 0.22))
const innerRadius = computed(() => Math.max(4, outerRadius.value - 2))
const iconSize = computed(() => Math.round(props.size * 0.72))
const fontSize = computed(() => Math.round(props.size * 0.42))
const innerBg = computed(() => (props.iconGlyph ? iconThemeBg(props.iconGlyph) : iconBgStyle(props.iconBg)))
</script>

<template>
  <AvatarFrame
    :frame-key="frameKey" :size="size" :premium="framePremium" :glow="glow"
    :level="level" :streak="streak" :radius="outerRadius"
  >
    <div
      class="relative w-full h-full overflow-hidden grid place-items-center text-white font-extrabold leading-none"
      :class="[innerBg, (framed || !ring) ? '' : 'border-2 border-white/10']"
      :style="{ borderRadius: innerRadius + 'px', fontSize: fontSize + 'px' }"
    >
      <CosmeticIcon v-if="iconGlyph" :iconKey="iconGlyph" :size="iconSize" />
      <img v-else-if="avatarUrl" :src="avatarUrl" alt="" class="w-full h-full object-cover" />
      <span v-else>{{ initial }}</span>
    </div>
  </AvatarFrame>
</template>
