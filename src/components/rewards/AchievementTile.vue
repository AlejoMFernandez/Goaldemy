<script setup>
/**
 * Tile de logro estilo Copero: cuadrado, fondo sólido/gradiente vivo por rareza,
 * pictograma de una sola línea blanca (sin sombreado interno). Bloqueado = casi
 * invisible (silueta oscura sobre fondo oscuro), como en la referencia real.
 *
 * Deliberadamente SEPARADO de CosmeticIcon.vue: los cosméticos de la tienda son
 * cuadrados con OTRO tratamiento (fondo temático + glyph multi-tono), y los rangos
 * usan el medallón redondo. Los logros son su propio lenguaje visual.
 */
import { computed, useId } from 'vue'

const props = defineProps({
  iconKey: { type: String, default: '' },
  rarity: { type: String, default: 'common' },
  locked: { type: Boolean, default: false },
  size: { type: Number, default: 64 },
})

const uid = 'at' + useId().replace(/[^a-zA-Z0-9_-]/g, '')
const gid = (n) => `${uid}-${n}`

// Paleta por rareza: mismos matices que el resto de Fulvo (aros de medallón,
// gemas), pero acá como gradiente diagonal vívido de fondo del tile.
const TIER = {
  common:    { from: '#34d399', to: '#0e7490', glow: 'rgba(16,185,129,0.35)' },
  rare:      { from: '#38bdf8', to: '#1d4ed8', glow: 'rgba(56,189,248,0.4)' },
  epic:      { from: '#e879f9', to: '#7e22ce', glow: 'rgba(232,121,249,0.45)' },
  legendary: { from: '#fbbf24', to: '#b45309', glow: 'rgba(251,191,36,0.55)' },
}
const tier = computed(() => TIER[props.rarity] || TIER.common)

const LOCKED_BG = '#141924'
const LOCKED_BORDER = '#232b38'
const LOCKED_GLYPH = '#2b3341'

const glyphColor = computed(() => (props.locked ? LOCKED_GLYPH : '#ffffff'))

const wrapStyle = computed(() => {
  if (props.locked) return {}
  return { filter: `drop-shadow(0 0 ${Math.round(props.size * 0.12)}px ${tier.value.glow})` }
})

// Aguja del velocímetro (ach_gauge): sube de tier en tier ("calentando motores").
const GAUGE_ANGLE = { common: -50, rare: -5, epic: 45, legendary: 45 }
const gaugeAngle = computed(() => GAUGE_ANGLE[props.rarity] ?? GAUGE_ANGLE.common)
</script>

<template>
  <svg class="achievement-tile" :width="size" :height="size" viewBox="0 0 100 100" :style="wrapStyle" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient :id="gid('bg')" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" :stop-color="tier.from"/>
          <stop offset="1" :stop-color="tier.to"/>
        </linearGradient>
      </defs>

      <rect x="2" y="2" width="96" height="96" rx="20"
        :fill="locked ? LOCKED_BG : `url(#${gid('bg')})`"
        :stroke="locked ? LOCKED_BORDER : 'rgba(255,255,255,0.28)'" stroke-width="2"/>

      <g :fill="glyphColor" :stroke="glyphColor">
        <template v-if="iconKey === 'ach_target'">
          <circle cx="50" cy="50" r="30" fill="none" stroke-width="6"/>
          <circle cx="50" cy="50" r="18" fill="none" stroke-width="6"/>
          <circle cx="50" cy="50" r="6" stroke="none"/>
        </template>
        <template v-else-if="iconKey === 'ach_flag'">
          <path d="M32 18 v64" stroke-width="6" stroke-linecap="round"/>
          <path d="M32 22 L74 34 L32 46 Z" stroke="none"/>
        </template>
        <template v-else-if="iconKey === 'ach_gauge'">
          <path d="M24 66 a26 26 0 1 1 52 0" fill="none" stroke-width="7" stroke-linecap="round"/>
          <g :transform="`rotate(${gaugeAngle} 50 66)`"><path d="M50 66 L50 34" stroke-width="6" stroke-linecap="round"/></g>
          <circle cx="50" cy="66" r="6" stroke="none"/>
        </template>
        <template v-else-if="iconKey === 'ach_engine'">
          <g stroke="none">
            <rect x="46" y="14" width="8" height="16" rx="2"/>
            <rect x="46" y="70" width="8" height="16" rx="2"/>
            <rect x="14" y="46" width="16" height="8" rx="2"/>
            <rect x="70" y="46" width="16" height="8" rx="2"/>
            <rect x="24" y="24" width="11" height="11" rx="2" transform="rotate(45 29.5 29.5)"/>
            <rect x="65" y="24" width="11" height="11" rx="2" transform="rotate(45 70.5 29.5)"/>
            <rect x="24" y="65" width="11" height="11" rx="2" transform="rotate(45 29.5 70.5)"/>
            <rect x="65" y="65" width="11" height="11" rx="2" transform="rotate(45 70.5 70.5)"/>
            <circle cx="50" cy="50" r="18"/>
          </g>
        </template>
        <template v-else-if="iconKey === 'ach_five_stars'">
          <path d="M50 20 L61 42 L86 45 L68 62 L73 87 L50 74 L27 87 L32 62 L14 45 L39 42 Z" stroke="none"/>
        </template>
        <template v-else-if="iconKey === 'ach_clean_sweep'">
          <path d="M64 14 L44 52" stroke-width="7" stroke-linecap="round"/>
          <rect x="33" y="46" width="24" height="9" rx="2" transform="rotate(-27 45 50)" stroke="none"/>
          <path d="M28 58 q17 -6 34 0 l4 20 q-21 10 -42 0 z" stroke="none"/>
          <path d="M36 60 l1.5 20 M45 61 v20 M54 60 l-1.5 20" stroke-width="2.5" stroke-opacity="0.35" stroke-linecap="round"/>
        </template>
        <template v-else-if="iconKey === 'ach_ring_complete'">
          <circle cx="50" cy="50" r="32" fill="none" stroke-opacity="0.35" stroke-width="4"/>
          <g stroke="none">
            <circle cx="50" cy="18" r="4"/><circle cx="69" cy="24" r="4"/><circle cx="82" cy="42" r="4"/>
            <circle cx="82" cy="58" r="4"/><circle cx="69" cy="76" r="4"/><circle cx="50" cy="82" r="4"/>
            <circle cx="31" cy="76" r="4"/><circle cx="18" cy="58" r="4"/><circle cx="18" cy="42" r="4"/><circle cx="31" cy="24" r="4"/>
          </g>
        </template>
        <template v-else-if="iconKey === 'calendar'">
          <rect x="22" y="24" width="56" height="52" rx="6" fill="none" stroke-width="5"/>
          <path d="M22 38 h56" stroke-width="5"/>
          <rect x="32" y="14" width="6" height="14" rx="3" stroke="none"/>
          <rect x="62" y="14" width="6" height="14" rx="3" stroke="none"/>
          <path d="M35 60 l5 5 10 -10" fill="none" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
        </template>
        <template v-else-if="iconKey === 'crystal_ball'">
          <circle cx="50" cy="46" r="26" fill="none" stroke-width="6"/>
          <path d="M32 80 q18 -8 36 0" fill="none" stroke-width="6" stroke-linecap="round"/>
          <path d="M38 38 a14 14 0 0 1 18 -6" fill="none" stroke-width="4" stroke-linecap="round" opacity="0.7"/>
        </template>
        <template v-else-if="iconKey === 'ach_flags_fan'">
          <circle cx="50" cy="50" r="32" fill="none" stroke-width="5"/>
          <path d="M18 50 h64 M50 18 v64" stroke-width="3" opacity="0.6"/>
          <path d="M50 18 a32 32 0 0 1 0 64 M50 18 a32 32 0 0 0 0 64" fill="none" stroke-width="3" opacity="0.6"/>
        </template>
        <template v-else-if="iconKey === 'tactics_board'">
          <rect x="20" y="20" width="60" height="56" rx="4" fill="none" stroke-width="5"/>
          <path d="M32 44 L68 30 M32 60 L68 46" stroke-width="4" stroke-dasharray="4 3"/>
          <g stroke="none"><circle cx="32" cy="44" r="4"/><circle cx="32" cy="60" r="4"/><circle cx="68" cy="38" r="4"/></g>
        </template>
        <template v-else-if="iconKey === 'ach_horseshoe'">
          <path d="M34 78 C22 66 22 40 34 27 C41 18 59 18 66 27 C78 40 78 66 66 78 L59 78 C67 68 69 46 60 35 C54 28 46 28 40 35 C31 46 33 68 41 78 Z" stroke="none"/>
        </template>
        <template v-else-if="iconKey === 'ach_comeback_arrow'">
          <!-- Tablero de tiempo agregado (4to árbitro): "+" en un cartel con mango -->
          <rect x="18" y="16" width="64" height="46" rx="6" fill="none" stroke-width="6"/>
          <path d="M50 28 v22 M39 39 h22" stroke-width="7" stroke-linecap="round"/>
          <rect x="43" y="62" width="14" height="24" rx="3" stroke="none"/>
        </template>
        <template v-else-if="iconKey === 'ach_crescent_moon'">
          <path d="M62 18 a32 32 0 1 0 20 46 a24 24 0 0 1 -20 -46 z" stroke="none"/>
        </template>
        <template v-else-if="iconKey === 'ach_perfect_seal'">
          <circle cx="50" cy="50" r="32" fill="none" stroke-width="6"/>
          <path d="M36 51 l9 9 19 -21" fill="none" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
        </template>
        <template v-else-if="iconKey === 'ach_triple_ball'">
          <g stroke="none">
            <circle cx="50" cy="30" r="13"/>
            <circle cx="34" cy="58" r="13"/>
            <circle cx="66" cy="58" r="13"/>
          </g>
        </template>
        <template v-else-if="iconKey === 'ach_grand_rosette'">
          <g stroke="none">
            <path d="M34 24 h32 v14 a16 14 0 0 1 -32 0 z"/>
            <path d="M34 28 h-8 a8 8 0 0 0 8 10 z M66 28 h8 a8 8 0 0 1 -8 10 z"/>
            <rect x="46" y="52" width="8" height="12"/>
            <rect x="33" y="64" width="34" height="8" rx="2"/>
          </g>
        </template>
        <template v-else-if="iconKey === 'ach_centurion_helmet'">
          <path d="M50 26 a20 20 0 0 1 20 20 v6 h-40 v-6 a20 20 0 0 1 20 -20 z" stroke="none"/>
          <path d="M44 22 q6 -6 12 0 q-3 4 -6 4 q-3 0 -6 -4 z" stroke="none"/>
          <path d="M30 52 h11 v20 q0 4 -4 4 h-3 q-4 0 -4 -4 z" stroke="none"/>
          <path d="M70 52 h-11 v20 q0 4 4 4 h3 q4 0 4 -4 z" stroke="none"/>
        </template>
        <template v-else-if="iconKey === 'ach_magnifier'">
          <circle cx="42" cy="42" r="20" fill="none" stroke-width="7"/>
          <path d="M57 57 L78 78" stroke-width="8" stroke-linecap="round"/>
        </template>
        <template v-else-if="iconKey === 'ach_eye'">
          <path d="M14 50 q36 -34 72 0 q-36 34 -72 0 z" fill="none" stroke-width="6" stroke-linejoin="round"/>
          <circle cx="50" cy="50" r="12" stroke="none"/>
        </template>
        <template v-else-if="iconKey === 'ach_prophet'">
          <path d="M50 14 c14 10 20 26 20 40 v18 h-40 v-18 c0 -14 6 -30 20 -40 z" stroke="none"/>
          <path d="M50 30 l2 5 5 1 -4 3.5 1 5 -4.5 -2.5 -4.5 2.5 1 -5 -4 -3.5 5 -1 z" opacity="0.5" stroke="none"/>
        </template>
        <template v-else-if="iconKey === 'ach_calendar_star'">
          <rect x="22" y="24" width="56" height="52" rx="6" fill="none" stroke-width="5"/>
          <path d="M22 38 h56" stroke-width="5"/>
          <rect x="32" y="14" width="6" height="14" rx="3" stroke="none"/>
          <rect x="62" y="14" width="6" height="14" rx="3" stroke="none"/>
          <path d="M50 50 l3 7 8 1 -6 5 2 8 -7 -4 -7 4 2 -8 -6 -5 8 -1 z" stroke="none"/>
        </template>
        <template v-else-if="iconKey === 'ach_stopwatch'">
          <rect x="42" y="10" width="16" height="8" rx="2" stroke="none"/>
          <circle cx="50" cy="54" r="30" fill="none" stroke-width="6"/>
          <path d="M50 54 L50 34 M50 54 L66 60" stroke-width="5" stroke-linecap="round"/>
          <path d="M68 24 l8 -8" stroke-width="5" stroke-linecap="round"/>
        </template>
        <template v-else-if="iconKey === 'ach_check_badge'">
          <circle cx="50" cy="50" r="32" fill="none" stroke-width="6"/>
          <path d="M36 50 l10 10 20 -22" fill="none" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
        </template>
        <template v-else-if="iconKey === 'ach_sunrise'">
          <path d="M14 62 h72" stroke-width="6" stroke-linecap="round"/>
          <path d="M26 62 a24 24 0 0 1 48 0" fill="none" stroke-width="6"/>
          <g stroke-width="5" stroke-linecap="round"><path d="M50 20 v10 M22 62 l8 -6 M78 62 l-8 -6"/></g>
        </template>
        <template v-else-if="iconKey === 'ach_crossed_swords'">
          <g stroke-width="7" stroke-linecap="round">
            <path d="M22 22 L78 78 M30 22 h-8 v8 M70 78 h8 v-8"/>
            <path d="M78 22 L22 78 M70 22 h8 v8 M30 78 h-8 v-8"/>
          </g>
          <circle cx="50" cy="50" r="5" stroke="none"/>
        </template>
        <template v-else-if="iconKey === 'ach_network'">
          <g stroke-width="4" stroke-linecap="round"><path d="M50 24 L26 58 M50 24 L74 58 M26 58 L50 80 M74 58 L50 80 M26 58 L74 58" fill="none"/></g>
          <g stroke="none"><circle cx="50" cy="24" r="8"/><circle cx="26" cy="58" r="8"/><circle cx="74" cy="58" r="8"/><circle cx="50" cy="80" r="7"/></g>
        </template>
        <template v-else-if="iconKey === 'ach_chat_stack'">
          <path d="M26 26 h44 a8 8 0 0 1 8 8 v26 a8 8 0 0 1 -8 8 h-24 l-14 12 v-12 h-10 a8 8 0 0 1 -8 -8 v-26 a8 8 0 0 1 8 -8 z" stroke="none"/>
        </template>
        <template v-else-if="iconKey === 'ach_dual_medal'">
          <circle cx="36" cy="50" r="16" fill="none" stroke-width="7"/>
          <circle cx="64" cy="50" r="16" fill="none" stroke-width="7"/>
        </template>
        <template v-else-if="iconKey === 'ach_triple_gem'">
          <path d="M50 18 L74 38 L50 84 L26 38 Z" stroke="none"/>
          <path d="M26 38 h48 M40 38 L50 18 L60 38" fill="none" stroke-opacity="0.4" stroke-width="2"/>
        </template>
        <template v-else-if="iconKey === 'ach_royal_banner'">
          <path d="M20 64 L15 34 L34 48 L50 24 L66 48 L85 34 L80 64 Z" stroke="none"/>
          <rect x="19" y="64" width="62" height="12" rx="2" stroke="none"/>
        </template>
      </g>
    </svg>
</template>

<style scoped>
.achievement-tile { display: block; }
</style>

