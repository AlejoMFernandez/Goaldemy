<script setup>
import { computed } from 'vue'

const props = defineProps({
  // Acepta clave semántica ('ball') o el emoji legacy ('⚽'); cae al glyph si no matchea.
  iconKey: { type: String, default: '' },
  rarity: { type: String, default: 'common' },
  framed: { type: Boolean, default: false }, // true = medallón completo (escena/colección)
  size: { type: Number, default: 40 },
})

// Map emoji legacy (style_key actual de los cosméticos) → clave semántica del set SVG.
const EMOJI_MAP = {
  '⚽': 'ball', '👟': 'boot', '🧤': 'gloves', '🏅': 'medal',
  '🏆': 'trophy', '🐐': 'goat', '👑': 'crown', '⭐': 'star', '🛡️': 'shield', '🛡': 'shield',
}
const KNOWN = new Set(['ball', 'boot', 'gloves', 'medal', 'trophy', 'goat', 'crown', 'star', 'shield'])

const key = computed(() => {
  const k = (props.iconKey || '').trim()
  if (KNOWN.has(k)) return k
  if (EMOJI_MAP[k]) return EMOJI_MAP[k]
  return '' // desconocido → render del glyph crudo
})

const isSvg = computed(() => !!key.value)

// Marco del medallón por rareza (gradiente del aro + disco + glow).
const FRAME = {
  common:    { rim: 'cosmRimCommon', disc: 'cosmDiscCommon', rimDark: '#0b3b34', glow: 'rgba(16,185,129,0.45)', studs: '#0b3b34' },
  rare:      { rim: 'cosmRimRare',   disc: 'cosmDiscRare',   rimDark: '#0b1f4d', glow: 'rgba(56,189,248,0.45)', studs: '#0b1f4d' },
  epic:      { rim: 'cosmRimEpic',   disc: 'cosmDiscEpic',   rimDark: '#2a0a4a', glow: 'rgba(232,121,249,0.5)', studs: '#2a0a4a' },
  legendary: { rim: 'cosmRimLeg',    disc: 'cosmDiscLeg',    rimDark: '#5c3206', glow: 'rgba(251,191,36,0.55)', studs: '#5c3206' },
}
const frame = computed(() => FRAME[props.rarity] || FRAME.common)

// El check del escudo y los detalles usan un acento por rareza.
const ACCENT = { common: '#10b981', rare: '#2563eb', epic: '#9333ea', legendary: '#b45309' }
const accent = computed(() => ACCENT[props.rarity] || ACCENT.common)
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" class="cosmetic-icon">
    <defs>
      <linearGradient id="cosmSilver" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#94a3b8"/></linearGradient>
      <linearGradient id="cosmGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3c4"/><stop offset="1" stop-color="#f59e0b"/></linearGradient>
      <template v-if="framed">
        <linearGradient id="cosmRimCommon" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a7f3d0"/><stop offset="0.5" stop-color="#10b981"/><stop offset="1" stop-color="#0e7490"/></linearGradient>
        <linearGradient id="cosmRimRare" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bae6fd"/><stop offset="0.5" stop-color="#38bdf8"/><stop offset="1" stop-color="#1d4ed8"/></linearGradient>
        <linearGradient id="cosmRimEpic" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f5d0fe"/><stop offset="0.5" stop-color="#e879f9"/><stop offset="1" stop-color="#7e22ce"/></linearGradient>
        <linearGradient id="cosmRimLeg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff7d6"/><stop offset="0.5" stop-color="#fbbf24"/><stop offset="1" stop-color="#b45309"/></linearGradient>
        <radialGradient id="cosmDiscCommon" cx="0.4" cy="0.32" r="0.85"><stop offset="0" stop-color="#0f766e"/><stop offset="1" stop-color="#06231f"/></radialGradient>
        <radialGradient id="cosmDiscRare" cx="0.4" cy="0.32" r="0.85"><stop offset="0" stop-color="#1e40af"/><stop offset="1" stop-color="#0a1838"/></radialGradient>
        <radialGradient id="cosmDiscEpic" cx="0.4" cy="0.32" r="0.85"><stop offset="0" stop-color="#6b21a8"/><stop offset="1" stop-color="#23073f"/></radialGradient>
        <radialGradient id="cosmDiscLeg" cx="0.4" cy="0.32" r="0.85"><stop offset="0" stop-color="#a8590a"/><stop offset="1" stop-color="#2c1705"/></radialGradient>
      </template>
    </defs>

    <!-- Marco medallón (solo framed) -->
    <g v-if="framed">
      <circle cx="50" cy="50" r="48" :fill="`url(#${frame.rim})`"/>
      <circle cx="50" cy="50" r="48" fill="none" stroke="#ffffff" stroke-opacity="0.5" stroke-width="1.5"/>
      <circle cx="50" cy="50" r="48" fill="none" :stroke="frame.studs" stroke-opacity="0.5" stroke-width="4" stroke-dasharray="1 10" stroke-linecap="round"/>
      <circle cx="50" cy="50" r="37" :fill="`url(#${frame.disc})`" :stroke="frame.rimDark" stroke-width="1.5"/>
      <ellipse cx="50" cy="34" rx="26" ry="12" fill="#ffffff" fill-opacity="0.10"/>
    </g>

    <!-- Ícono. Framed → encogido al disco; suelto → casi full. -->
    <g :transform="framed ? 'translate(50,51) scale(0.58) translate(-50,-50)' : ''">
      <!-- PELOTA -->
      <template v-if="key === 'ball'">
        <circle cx="50" cy="50" r="30" fill="url(#cosmSilver)"/>
        <path d="M50 35 l14 11 -5 17 h-18 l-5 -17 z" fill="#1e293b"/>
        <path d="M50 35 V21 M64 46 l13 -6 M59 63 l7 14 M41 63 l-7 14 M36 46 l-13 -6" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/>
        <path d="M30 43 a30 30 0 0 1 17 -11" fill="none" stroke="#ffffff" stroke-opacity="0.75" stroke-width="3.5" stroke-linecap="round"/>
      </template>
      <!-- BOTÍN -->
      <template v-else-if="key === 'boot'">
        <path d="M24 40 c0 11 2 18 6 21 h33 c7 0 9 -4 9 -9 c0 -4 -3 -6 -8 -7 c-13 -3 -21 -8 -28 -15 c-4 -4 -12 -1 -12 9 z" fill="url(#cosmSilver)"/>
        <path d="M30 38 q12 8 26 12" fill="none" :stroke="accent" stroke-width="3" stroke-linecap="round"/>
        <rect x="30" y="63" width="6" height="6" rx="1.5" fill="#64748b"/>
        <rect x="44" y="63" width="6" height="6" rx="1.5" fill="#64748b"/>
        <rect x="58" y="63" width="6" height="6" rx="1.5" fill="#64748b"/>
      </template>
      <!-- GUANTES -->
      <template v-else-if="key === 'gloves'">
        <path d="M34 48 q-3 0 -3 5 l2 15 q1 9 10 9 h14 q9 0 9 -10 v-19 q0 -4 -4 -4 z" fill="url(#cosmSilver)"/>
        <path d="M37 50 v-18 q0 -4 4 -4 t4 4 v16 M48 48 v-22 q0 -4 4 -4 t4 4 v20 M59 49 v-15 q0 -4 4 -4 t4 4 v15" fill="url(#cosmSilver)" stroke="#94a3b8" stroke-width="1"/>
        <path d="M37 58 h28" fill="none" :stroke="accent" stroke-width="3" stroke-linecap="round"/>
      </template>
      <!-- MEDALLA -->
      <template v-else-if="key === 'medal'">
        <path d="M40 22 l9 24 -9 5 -9 -5 z" fill="#cbd5e1"/>
        <path d="M60 22 l-9 24 9 5 9 -5 z" fill="#94a3b8"/>
        <circle cx="50" cy="62" r="20" fill="url(#cosmGold)" stroke="#b45309" stroke-width="1.5"/>
        <path d="M50 50 l4 9 9 1 -7 6 2 9 -8 -5 -8 5 2 -9 -7 -6 9 -1 z" fill="#b45309"/>
      </template>
      <!-- TROFEO -->
      <template v-else-if="key === 'trophy'">
        <path d="M33 28 h34 v12 a17 15 0 0 1 -34 0 z" fill="url(#cosmGold)"/>
        <path d="M33 32 h-9 a8 8 0 0 0 9 11 z M67 32 h9 a8 8 0 0 1 -9 11 z" fill="#f59e0b"/>
        <rect x="45" y="54" width="10" height="11" fill="#f59e0b"/>
        <rect x="34" y="65" width="32" height="8" rx="2" fill="url(#cosmGold)" stroke="#b45309" stroke-width="1"/>
        <path d="M50 30 l3 7 8 1 -6 5 2 8 -7 -4 -7 4 2 -8 -6 -5 8 -1 z" fill="#b45309"/>
      </template>
      <!-- ESTRELLA -->
      <template v-else-if="key === 'star'">
        <path d="M50 22 l8 19 21 1.5 -16 13 5 20 -18 -11 -18 11 5 -20 -16 -13 21 -1.5 z" fill="url(#cosmGold)" stroke="#b45309" stroke-width="1.5"/>
        <path d="M50 30 l5 12 13 1" fill="none" stroke="#fff7d6" stroke-opacity="0.8" stroke-width="2.5" stroke-linecap="round"/>
      </template>
      <!-- ESCUDO -->
      <template v-else-if="key === 'shield'">
        <path d="M50 22 l24 9 v15 c0 19 -13 28 -24 32 -11 -4 -24 -13 -24 -32 v-15 z" fill="url(#cosmSilver)" stroke="#94a3b8" stroke-width="1.5"/>
        <path d="M39 51 l7 8 15 -17" fill="none" :stroke="accent" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      </template>
      <!-- CORONA -->
      <template v-else-if="key === 'crown'">
        <path d="M28 66 l-6 -34 17 14 11 -20 11 20 17 -14 -6 34 z" fill="url(#cosmGold)" stroke="#b45309" stroke-width="1.5"/>
        <rect x="27" y="66" width="46" height="9" rx="2" fill="url(#cosmGold)" stroke="#b45309" stroke-width="1.5"/>
        <circle cx="34" cy="40" r="3.5" fill="#e11d48"/><circle cx="50" cy="34" r="4" fill="#06b6d4"/><circle cx="66" cy="40" r="3.5" fill="#e11d48"/>
      </template>
      <!-- GOAT -->
      <template v-else-if="key === 'goat'">
        <path d="M34 36 c-7 -5 -9 -15 -5 -23 c1 9 6 14 12 17 M66 36 c7 -5 9 -15 5 -23 c-1 9 -6 14 -12 17" fill="none" stroke="url(#cosmSilver)" stroke-width="6" stroke-linecap="round"/>
        <path d="M38 38 q12 -9 24 0 q7 9 4 21 q-3 11 -16 13 q-13 -2 -16 -13 q-3 -12 4 -21 z" fill="url(#cosmSilver)"/>
        <circle cx="44" cy="50" r="2.6" fill="#1e293b"/><circle cx="56" cy="50" r="2.6" fill="#1e293b"/>
        <path d="M50 58 v8 M47 74 l3 6 3 -6" fill="none" stroke="#94a3b8" stroke-width="2.5" stroke-linecap="round"/>
      </template>
    </g>

    <!-- Fallback: glyph crudo (emoji/letra) si la clave no está en el set -->
    <text v-if="!isSvg" x="50" :y="framed ? 60 : 68" text-anchor="middle" :font-size="framed ? 42 : 60">{{ iconKey || '★' }}</text>
  </svg>
</template>

<style scoped>
.cosmetic-icon { display: block; }
</style>
