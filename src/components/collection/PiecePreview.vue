<script setup>
/**
 * Vista de UNA pieza del vestuario (ícono / borde / banner / título) con su arte
 * real (CosmeticIcon, FRAME_STYLES, BANNER_STYLES). Diseño V4: el cosmético
 * grande, el texto aparte. Si la pieza no tiene arte todavía (colecciones nuevas),
 * se dibuja una silueta apagada con el tipo de pieza.
 *
 * Props:
 *  cos       → { type, style_key, name, rarity, premium_only }
 *  size      → lado del cuadrado para ícono/borde (px). Banner: alto = size * 0.8.
 *  innerIcon → style_key del ícono equipado, para mostrarlo dentro de un borde.
 *  initial   → letra si no hay ícono equipado (dentro del borde).
 *  locked    → apagado (gris) para lo que todavía no tenés.
 */
import { computed } from 'vue'
import { bannerStyle } from '../../services/cosmetics'
import CosmeticIcon from '../rewards/CosmeticIcon.vue'
import UserAvatar from '../common/UserAvatar.vue'
import { pieceRarity, hexA, hasArt } from './piece-style'

const props = defineProps({
  cos: { type: Object, required: true },
  size: { type: Number, default: 80 },
  innerIcon: { type: String, default: '' },
  initial: { type: String, default: '' },
  locked: { type: Boolean, default: false },
  titleSize: { type: Number, default: 15 },
})

const r = computed(() => pieceRarity(props.cos?.rarity))
const kind = computed(() => props.cos?.type || 'icon')
const key = computed(() => props.cos?.style_key || props.cos?.styleKey || '')
const art = computed(() => hasArt(props.cos))
const glow = computed(() => {
  if (props.locked) return 'none'
  if (props.cos?.rarity === 'legendary') return `0 0 16px ${hexA(r.value.c, 0.45)}`
  if (props.cos?.rarity === 'epic') return `0 0 12px ${hexA(r.value.c, 0.3)}`
  return 'none'
})
const dimStyle = computed(() => (props.locked ? { filter: 'grayscale(1)', opacity: 0.4 } : null))
const titleStyle = computed(() => ({
  background: `linear-gradient(90deg, ${hexA(r.value.c, 0.24)}, ${hexA(r.value.c, 0.05)})`,
  borderColor: hexA(r.value.c, 0.6),
  color: r.value.t,
  fontSize: props.titleSize + 'px',
}))
</script>

<template>
  <span class="piece-pv" :style="dimStyle">
    <!-- Sin arte todavía: silueta apagada -->
    <span v-if="!art" class="piece-ghost" :class="kind === 'banner' ? 'is-banner' : ''"
      :style="kind === 'banner' ? { height: Math.round(size * 0.8) + 'px' } : { width: size + 'px', height: size + 'px' }">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path v-if="kind === 'frame'" d="M6 4h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2zM8 8h8v8H8z" />
        <path v-else-if="kind === 'banner'" d="M3 6h18v12H3zM3 15l5-4 4 3 3-2 6 4" />
        <path v-else-if="kind === 'title'" d="M4 7h16M7 12h10M9 17h6" />
        <path v-else d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.3 6.8 19.1l1-5.8-4.3-4.1 5.9-.9z" />
      </svg>
    </span>

    <!-- Ícono -->
    <span v-else-if="kind === 'icon'" class="piece-icon" :style="{ width: size + 'px', height: size + 'px', borderColor: r.c, boxShadow: glow }">
      <CosmeticIcon :iconKey="key" :rarity="cos.rarity" :size="size" />
    </span>

    <!-- Borde: el aro real alrededor de tu ícono equipado -->
    <UserAvatar v-else-if="kind === 'frame'" :size="size" :frame-key="key" :icon-glyph="innerIcon" :initial="initial || '?'" :frame-premium="!!cos.premium_only" />

    <!-- Banner -->
    <span v-else-if="kind === 'banner'" class="piece-banner" :class="[bannerStyle(key), cos.premium_only ? 'anim-pan' : '']"
      :style="{ height: Math.round(size * 0.8) + 'px' }"></span>

    <!-- Título -->
    <span v-else class="piece-title" :style="titleStyle">{{ (cos.name || '').toUpperCase() }}</span>
  </span>
</template>

<style scoped>
.piece-pv { display: flex; align-items: center; justify-content: center; width: 100%; min-width: 0; }
.piece-icon { display: block; flex-shrink: 0; border: 2px solid; border-radius: 18px; overflow: hidden; box-sizing: border-box; }
.piece-icon :deep(.cosmetic-icon) { width: 100%; height: 100%; display: block; }
.piece-banner { display: block; width: 100%; border-radius: 12px; box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.14); }
.piece-title {
  max-width: 100%; box-sizing: border-box; padding: 6px 10px; border-radius: 999px; border: 1px solid;
  font-family: var(--font-bug); font-weight: 800; font-style: italic; line-height: 1.05; letter-spacing: 0.3px; text-align: center;
  overflow-wrap: anywhere;
}
.piece-ghost {
  display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-sizing: border-box;
  border-radius: 18px; border: 1.5px dashed rgba(255, 255, 255, 0.18); background: rgba(255, 255, 255, 0.03); color: #475569;
}
.piece-ghost.is-banner { width: 100%; border-radius: 12px; }
.piece-ghost svg { width: 42%; max-width: 36px; height: auto; }
</style>
