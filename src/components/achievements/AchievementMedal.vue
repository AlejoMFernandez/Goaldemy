<script setup>
/**
 * Medalla hexagonal de logro (diseño V4 Logros): aro "metal" por rareza + cara
 * interior + pictograma real del logro (AchievementTile en modo bare).
 * Estados: done (color pleno) · locked (aro gris, glifo en color de rareza
 * apagado) · secret (aro gris con "?").
 */
import { computed } from 'vue'
import AchievementTile from '../rewards/AchievementTile.vue'
import { RARITY } from './logros-data'

const props = defineProps({
  icon: { type: String, default: '' },
  rarity: { type: String, default: 'common' },
  state: { type: String, default: 'done' }, // 'done' | 'locked' | 'secret'
  size: { type: String, default: 'md' }, // 'md' 46×51 · 'lg' 58×64
  shine: { type: Boolean, default: false },
})

const r = computed(() => RARITY[props.rarity] || RARITY.common)
const dims = computed(() => (props.size === 'lg'
  ? { w: 58, h: 64, iw: 48, ih: 53, glyph: 30 }
  : { w: 46, h: 51, iw: 38, ih: 42, glyph: 24 }))

const outerStyle = computed(() => {
  const s = { width: dims.value.w + 'px', height: dims.value.h + 'px' }
  if (props.state === 'secret') return { ...s, background: 'linear-gradient(160deg,#334155,#1e293b)', opacity: 0.8 }
  if (props.state === 'locked') return { ...s, background: 'linear-gradient(160deg,#475569,#1e293b)' }
  return { ...s, background: r.value.metal }
})
// El glow va en un wrapper SIN clip-path (clip-path recortaría el drop-shadow).
const wrapStyle = computed(() => (props.state === 'done' && props.size === 'lg' && !props.shine
  ? { filter: `drop-shadow(0 4px 10px ${r.value.glow})` }
  : null))
const innerStyle = computed(() => ({
  width: dims.value.iw + 'px',
  height: dims.value.ih + 'px',
  background: props.state === 'secret' ? '#0f172a' : props.state === 'locked' ? '#111a2e' : r.value.inner,
}))
const glyphColor = computed(() => (props.state === 'locked' ? r.value.color : '#ffffff'))
</script>

<template>
  <span class="inline-flex shrink-0" :class="{ 'medal-shine': shine }" :style="wrapStyle" aria-hidden="true">
  <span class="medal-hex flex items-center justify-center" :style="outerStyle">
    <span class="medal-hex flex items-center justify-center" :style="innerStyle">
      <span v-if="state === 'secret'" class="font-bug font-extrabold text-[22px] leading-none text-slate-500">?</span>
      <AchievementTile v-else bare :icon-key="icon" :rarity="rarity" :color="glyphColor" :size="dims.glyph"
        :style="state === 'locked' ? { opacity: 0.75 } : null" />
    </span>
  </span>
  </span>
</template>

<style scoped>
.medal-hex { clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%); }
.font-bug { font-family: var(--font-bug); }
@keyframes medalShine {
  0%, 100% { filter: drop-shadow(0 0 0 rgba(34, 197, 94, 0)); }
  50% { filter: drop-shadow(0 0 8px rgba(74, 222, 128, 0.8)); }
}
.medal-shine { animation: medalShine 1.8s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .medal-shine { animation: none; } }
</style>
