<script setup>
/** Miniatura del póster de un juego (color + ilustración de game-art), sin texto. */
import { computed, useId } from 'vue'
import { GAME_ART, GAME_POSTER_META } from '../../services/game-art'

const props = defineProps({
  slug: { type: String, required: true },
  w: { type: Number, default: 44 },
  h: { type: Number, default: 50 },
  bleed: { type: Boolean, default: false }, // arte grande que sale del cuadro (cabecera del reto)
})
const meta = computed(() => GAME_POSTER_META[props.slug] || { c1: '#475569', c2: '#0f172a' })
const uid = 'gt' + useId().replace(/[^a-zA-Z0-9_-]/g, '')
const art = computed(() => (GAME_ART[props.slug] || '')
  .replace(/id="(cp[a-z])"/g, `id="${uid}$1"`).replace(/url\(#(cp[a-z])\)/g, `url(#${uid}$1)`))
</script>

<template>
  <span class="gt" :class="bleed ? 'gt-bleed' : ''" :style="{ width: w + 'px', height: h + 'px', background: `linear-gradient(160deg, ${meta.c1}, ${meta.c2})` }" aria-hidden="true">
    <span class="gt-art" v-html="art"></span>
  </span>
</template>

<style scoped>
.gt { position: relative; display: block; flex-shrink: 0; overflow: hidden; border-radius: 8px; border: 1px solid rgba(255,255,255,0.14); }
.gt-art { position: absolute; inset: -4% -12% -8%; display: block; }
.gt-art :deep(svg) { width: 100%; height: 100%; display: block; }
.gt-bleed { position: absolute; inset: 0; width: 100% !important; height: 100% !important; border: 0; border-radius: 0; }
.gt-bleed .gt-art { inset: -18% -30% -18% 38%; }
</style>
