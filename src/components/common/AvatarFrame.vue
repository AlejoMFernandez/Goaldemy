<script setup>
/**
 * AvatarFrame — el borde equipado alrededor de lo que se le pase por slot.
 * Fuente única de bordes: lo usan UserAvatar, ranking, perfil, vestuario, PrizeCard…
 *
 * · Bordes viejos (bronce, oro, medallón…): un wrapper con wrap/pad, igual que antes.
 * · Bordes del vestuario nuevo (FRAME_STYLES con `ring`): el aro se dibuja a 108 px como
 *   en docs/vestuario/moodboard.html y se escala a `size`; el slot va a tamaño real en el
 *   hueco. Piezas extra (tiza, laurel, estrellas) en un overlay; chapitas de nivel /
 *   racha / capitán a tamaño real.
 *
 * Movimiento (docs/vestuario/SPEC.md): por debajo de 56 px el aro se dibuja quieto y sin
 * laurel/estrellas (rail de amigos, ranking, chat); prefers-reduced-motion = todo quieto.
 * `animate` fuerza el modo (true/false); por defecto se decide por tamaño.
 */
import { computed } from 'vue'
import { frameStyle, streakPercent, AVATAR_ROUND } from '../../services/cosmetics'

const props = defineProps({
  frameKey: { type: String, default: 'none' },
  size: { type: Number, default: 40 },          // diámetro/lado exterior en px
  premium: { type: Boolean, default: false },   // bordes viejos: gradiente que se mueve (PRO)
  glow: { type: Boolean, default: true },       // false = sin aura exterior
  level: { type: Number, default: null },       // nivel real del usuario (borde "Placa de nivel")
  streak: { type: Number, default: 0 },         // racha diaria actual (borde "Racha encendida")
  animate: { type: [Boolean, String], default: 'auto' },
  radius: { type: Number, default: null },      // bordes viejos: radio exterior en px
  rounded: { type: String, default: '' },       // bordes viejos: clase de radio (alternativa a radius)
  sized: { type: Boolean, default: true },      // bordes viejos: false = el tamaño lo da el contenido
})

const fr = computed(() => frameStyle(props.frameKey))
const scene = computed(() => !!fr.value.ring)
const small = computed(() => props.size < 56)
const still = computed(() => props.animate === 'auto' ? small.value : !props.animate)
const k = computed(() => props.size / 108)

// ── bordes viejos ──
const legacyClass = computed(() => {
  const w = props.glow ? fr.value.wrap : fr.value.wrap.replace(/shadow-\[[^\]]*\]/g, '').trim()
  // AVATAR_SHAPE (services/cosmetics.js) manda: en 'round' se ignoran rounded/radius.
  return [w, fr.value.pad, AVATAR_ROUND ? 'rounded-full' : props.rounded, props.premium ? 'anim-pan' : '']
})
const legacyStyle = computed(() => {
  const s = {}
  if (props.sized) { s.width = props.size + 'px'; s.height = props.size + 'px' }
  if (!AVATAR_ROUND && props.radius != null) s.borderRadius = props.radius + 'px'
  return s
})

// ── bordes nuevos ──
const ringClass = computed(() => {
  if (fr.value.badge === 'streak') return props.streak > 0 ? 'frm-racha' : 'frm-racha0'
  return fr.value.ring
})
const rootStyle = computed(() => ({
  width: props.size + 'px',
  height: props.size + 'px',
  '--k': k.value.toFixed(4),
  '--p': streakPercent(props.streak),
  '--bf': Math.max(9, Math.min(16, props.size * 0.14)).toFixed(1) + 'px',
}))
const innerStyle = computed(() => {
  const inset = (fr.value.padPx * k.value).toFixed(2) + 'px'
  return { inset }
})
const badgeKind = computed(() => {
  const b = fr.value.badge
  if (b === 'level') return props.level > 0 ? 'level' : ''
  if (b === 'streak') return props.streak > 0 ? 'streak' : ''
  return b || ''
})
const badgeText = computed(() => {
  if (badgeKind.value === 'level') return small.value ? String(props.level) : 'NV ' + props.level
  if (badgeKind.value === 'streak') return '🔥 ' + (props.streak > 99 ? '99+' : props.streak)
  if (badgeKind.value === 'captain') return 'C'
  return ''
})
// Piezas extra: la tiza siempre; laurel y estrellas solo donde se leen (≥ 56 px)
const overlay = computed(() => {
  const fx = fr.value.fx
  if (fx === 'chalk') return 'chalk'
  if (!small.value && (fx === 'laurel' || fx === 'stars')) return fx
  return ''
})

// Hojas del laurel (mismo dibujo que el moodboard)
const laurelLeaves = (() => {
  const out = []
  for (let i = 0; i < 9; i++) {
    const a = (200 + i * 16) * Math.PI / 180
    const a2 = (-20 - i * 16) * Math.PI / 180
    const x = 50 + 44 * Math.cos(a), y = 50 - 44 * Math.sin(a)
    const x2 = 50 + 44 * Math.cos(a2), y2 = 50 - 44 * Math.sin(a2)
    out.push({ x: x.toFixed(1), y: y.toFixed(1), r: (-(200 + i * 16) + 60).toFixed(0) })
    out.push({ x: x2.toFixed(1), y: y2.toFixed(1), r: (20 + i * 16 - 60).toFixed(0) })
  }
  return out
})()
</script>

<template>
  <!-- Bordes del vestuario nuevo -->
  <div v-if="scene" class="avf shrink-0" :class="{ 'avf-still': still, 'avf-noglow': !glow }" :style="rootStyle">
    <div class="avf-stage"><div class="frm-ring" :class="ringClass"></div></div>
    <div class="avf-inner" :style="innerStyle"><slot /></div>
    <div v-if="overlay" class="avf-stage avf-over" aria-hidden="true">
      <svg v-if="overlay === 'chalk'" class="avf-chalk" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="46.5" fill="none" stroke="#f8fafc" stroke-width="5" stroke-linecap="round" stroke-dasharray="40 4 22 3 60 5 30 4 50 2" opacity=".9" transform="rotate(-20 50 50)" />
        <circle cx="50" cy="50" r="47.5" fill="none" stroke="#f8fafc" stroke-width="1.2" stroke-dasharray="8 6 3 9" opacity=".5" />
      </svg>
      <svg v-else-if="overlay === 'laurel'" class="avf-laurel" viewBox="0 0 100 100">
        <ellipse v-for="(l, i) in laurelLeaves" :key="i" :cx="l.x" :cy="l.y" rx="7" ry="3" fill="#fbbf24" stroke="#92400e" stroke-width=".6" :transform="`rotate(${l.r} ${l.x} ${l.y})`" />
      </svg>
      <div v-else-if="overlay === 'stars'" class="avf-orb">
        <i v-for="d in [0, 72, 144, 216, 288]" :key="d" :style="{ transform: `rotate(${d}deg)` }"></i>
      </div>
    </div>
    <span v-if="badgeKind" class="avf-badge" :class="'avf-badge-' + badgeKind" aria-hidden="true">{{ badgeText }}</span>
  </div>

  <!-- Bordes viejos: wrapper de siempre -->
  <div v-else class="inline-block shrink-0" :class="legacyClass" :style="legacyStyle">
    <!-- redondo: el contenido se recorta a círculo para que el aro quede parejo en las diagonales -->
    <div v-if="AVATAR_ROUND" class="w-full h-full rounded-full overflow-hidden"><slot /></div>
    <slot v-else />
  </div>
</template>
