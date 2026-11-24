<script setup>
/**
 * Escudo de rango (kit v2) generado por código — src/services/rank-crest.js.
 * Cada parte (aro, campo, medallón, emblema, cinta, corona/cuernos) va en su <g>
 * para que la escena "Forja" pueda animarlas por separado.
 *
 * Props:
 *  tier    → objeto de TIERS o su key
 *  size    → 's' (40) | 'm' (96) | 'l' (180) | número (ancho px)
 *  ribbon  → cinta con el nombre (por defecto: no en S)
 *  locked  → apagado (gris) para lo que todavía no se alcanzó
 *  forge   → reproduce la Forja: las piezas caen y se encastran con golpe metálico
 * Emite: hit(part) en cada encastre · forged al terminar.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { crestParts, crestUid, SIZES } from '@/services/rank-crest'

const props = defineProps({
  tier: { type: [Object, String], required: true },
  size: { type: [String, Number], default: 'm' },
  ribbon: { type: Boolean, default: undefined },
  locked: { type: Boolean, default: false },
  forge: { type: Boolean, default: false },
})
const emit = defineEmits(['hit', 'forged'])

const uid = crestUid('rc')
const width = computed(() => typeof props.size === 'number' ? props.size : (SIZES[props.size] || SIZES.m))
const withRibbon = computed(() => props.ribbon ?? (props.size !== 's' && width.value >= 64))
const parts = computed(() => crestParts(props.tier, { uid, ribbon: withRibbon.value }))
const label = computed(() => parts.value.kit.label)

// ── Forja: tiempos de cada encastre (ms desde que arranca) ──
const FORGE_TIMELINE = [
  { part: 'rim', at: 420 },
  { part: 'field', at: 800 },
  { part: 'roundel', at: 1180 },
  { part: 'ribbon', at: 1560 },
]
const playing = ref(false)
let timers = []
const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
function clear() { timers.forEach(clearTimeout); timers = [] }
function play() {
  clear()
  if (reduce) { playing.value = false; emit('forged'); return }
  playing.value = false
  // re-dispara las animaciones CSS
  requestAnimationFrame(() => {
    playing.value = true
    for (const s of FORGE_TIMELINE) {
      if (s.part === 'ribbon' && !withRibbon.value) continue
      timers.push(setTimeout(() => emit('hit', s.part), s.at))
    }
    timers.push(setTimeout(() => emit('forged'), 1800))
  })
}
onMounted(() => { if (props.forge) play() })
watch(() => props.forge, v => { if (v) play() })
onBeforeUnmount(clear)
defineExpose({ play })
</script>

<template>
  <svg
    class="rank-crest"
    :class="{ 'is-locked': locked, 'is-forging': playing }"
    :viewBox="parts.viewBox"
    :width="width"
    :height="Math.round(width * 140 / 120)"
    role="img"
    :aria-label="`Escudo ${label}`"
  >
    <defs v-html="parts.defs" />
    <g v-if="parts.extra" class="rc-part rc-extra" v-html="parts.extra" />
    <g class="rc-part rc-rim" v-html="parts.rim" />
    <g class="rc-part rc-field" v-html="parts.field" />
    <g class="rc-part rc-roundel">
      <g v-html="parts.roundel" />
      <g class="rc-emblem" v-html="parts.emblem" />
    </g>
    <g v-if="withRibbon" class="rc-part rc-ribbon" v-html="parts.ribbon" />
  </svg>
</template>

<style scoped>
.rank-crest { display: block; overflow: visible; }
.rank-crest.is-locked { filter: grayscale(1) brightness(.55); }
.rc-part { transform-box: fill-box; transform-origin: 50% 50%; }

/* ── FORJA ── cada pieza cae, se encastra (golpe) y brilla un instante */
.is-forging .rc-rim     { animation: rc-drop .42s cubic-bezier(.55, 0, .9, .45) both, rc-glint .5s ease-out .42s both; }
.is-forging .rc-extra   { animation: rc-drop .42s cubic-bezier(.55, 0, .9, .45) .08s both, rc-glint .5s ease-out .5s both; }
.is-forging .rc-field   { animation: rc-slam .38s cubic-bezier(.55, 0, .9, .45) .42s both, rc-glint .5s ease-out .8s both; }
.is-forging .rc-roundel { animation: rc-press .38s cubic-bezier(.55, 0, .9, .45) .8s both, rc-glint .6s ease-out 1.18s both; }
.is-forging .rc-emblem  { animation: rc-emblem .5s ease-out 1.12s both; }
.is-forging .rc-ribbon  { animation: rc-ribbon .4s cubic-bezier(.34, 1.56, .64, 1) 1.2s both, rc-glint .5s ease-out 1.56s both; }

@keyframes rc-drop {
  0% { opacity: 0; transform: translateY(-140%) scale(1.15); }
  60% { opacity: 1; }
  100% { opacity: 1; transform: none; }
}
@keyframes rc-slam {
  0% { opacity: 0; transform: scale(1.6); }
  100% { opacity: 1; transform: none; }
}
@keyframes rc-press {
  0% { opacity: 0; transform: translateY(-60%) scale(2.2) rotate(-25deg); }
  100% { opacity: 1; transform: none; }
}
@keyframes rc-emblem {
  0% { opacity: 0; stroke-dasharray: 0 200; }
  100% { opacity: 1; stroke-dasharray: 200 0; }
}
@keyframes rc-ribbon {
  0% { opacity: 0; transform: translateY(80%) scaleX(.2); }
  100% { opacity: 1; transform: none; }
}
/* golpe metálico: un destello blanco breve en la pieza recién encastrada */
@keyframes rc-glint {
  0% { filter: brightness(2.4) drop-shadow(0 0 6px #fff); }
  100% { filter: none; }
}

@media (prefers-reduced-motion: reduce) {
  .is-forging .rc-part, .is-forging .rc-emblem { animation: none !important; }
}
</style>
