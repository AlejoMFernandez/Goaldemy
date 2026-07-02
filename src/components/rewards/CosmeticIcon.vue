<script>
// Compartido entre instancias: claves de íconos cuyo .webp ya 404-eó (no reintentar → sin spam de 404).
const RASTER_FAILED = new Set()
</script>

<script setup>
import { computed, useId, ref } from 'vue'

const props = defineProps({
  // Acepta clave semántica ('ball') o el emoji legacy ('⚽'); cae al glyph si no matchea.
  iconKey: { type: String, default: '' },
  rarity: { type: String, default: 'common' },
  framed: { type: Boolean, default: false }, // true = medallón completo (escena/colección/logros)
  size: { type: Number, default: 40 },
})

// IDs de gradiente ÚNICOS por instancia. Con ids fijos, al montar/desmontar varias
// instancias (riel → lista → chat) las referencias url(#id) quedaban colgadas y el
// ícono se rompía (sin relleno). useId() garantiza unicidad por instancia.
const uid = 'ci' + useId().replace(/[^a-zA-Z0-9_-]/g, '')
const gid = (name) => `${uid}-${name}`
const silver = `url(#${gid('silver')})`
const gold = `url(#${gid('gold')})`

// Map emoji legacy (style_key actual de los cosméticos) → clave semántica del set SVG.
const EMOJI_MAP = {
  '⚽': 'ball', '👟': 'boot', '🧤': 'gloves', '🏅': 'medal',
  '🏆': 'trophy', '🐐': 'goat', '👑': 'crown', '⭐': 'star', '🛡️': 'shield', '🛡': 'shield',
}
const KNOWN = new Set(['ball', 'boot', 'gloves', 'medal', 'trophy', 'goat', 'crown', 'star', 'shield', 'bolt', 'flame', 'gem', 'owl', 'broom', 'sun', 'clover', 'sword', 'hat', 'laurel', 'chat', 'butterfly', 'globe', 'comet', 'phoenix'])

const key = computed(() => {
  const k = (props.iconKey || '').trim()
  if (KNOWN.has(k)) return k
  if (EMOJI_MAP[k]) return EMOJI_MAP[k]
  return '' // desconocido → render del glyph crudo
})

const isSvg = computed(() => !!key.value)

// Marco del medallón por rareza (gradiente del aro + disco + glow).
const FRAME = {
  common:    { rim: 'RimCommon', disc: 'DiscCommon', rimDark: '#0b3b34', glow: 'rgba(16,185,129,0.45)', studs: '#0b3b34' },
  rare:      { rim: 'RimRare',   disc: 'DiscRare',   rimDark: '#0b1f4d', glow: 'rgba(56,189,248,0.45)', studs: '#0b1f4d' },
  epic:      { rim: 'RimEpic',   disc: 'DiscEpic',   rimDark: '#2a0a4a', glow: 'rgba(232,121,249,0.5)', studs: '#2a0a4a' },
  legendary: { rim: 'RimLeg',    disc: 'DiscLeg',    rimDark: '#5c3206', glow: 'rgba(251,191,36,0.55)', studs: '#5c3206' },
}
const frame = computed(() => FRAME[props.rarity] || FRAME.common)

// El check del escudo y los detalles usan un acento por rareza.
const ACCENT = { common: '#10b981', rare: '#2563eb', epic: '#9333ea', legendary: '#b45309' }
const accent = computed(() => ACCENT[props.rarity] || ACCENT.common)

// Arte raster opcional (DROP-IN): si existe /cosmetics/icons/<key>.webp se usa como
// imagen full-bleed; si el archivo no existe (404) @error cae al SVG. Solo íconos cuadrados
// (no framed). Para sumar un ícono raster: pegá el .webp y agregá su clave al set.
const RASTER_ICONS = new Set(['ball', 'boot', 'gloves', 'medal', 'trophy', 'goat', 'crown', 'star', 'shield', 'sun', 'clover', 'sword', 'hat', 'laurel', 'bolt', 'flame', 'gem', 'owl', 'broom'])
const rasterFailed = ref(false)
const useRaster = computed(() => !props.framed && RASTER_ICONS.has(key.value) && !RASTER_FAILED.has(key.value) && !rasterFailed.value)
const rasterSrc = computed(() => `/cosmetics/icons/${key.value}.webp`)
function onRasterError() { RASTER_FAILED.add(key.value); rasterFailed.value = true }
</script>

<template>
  <img v-if="useRaster" :src="rasterSrc" @error="onRasterError" class="cosmetic-icon w-full h-full object-cover" alt="" />
  <svg v-else :width="size" :height="size" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" class="cosmetic-icon">
    <defs>
      <linearGradient :id="gid('silver')" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#94a3b8"/></linearGradient>
      <linearGradient :id="gid('gold')" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3c4"/><stop offset="1" stop-color="#f59e0b"/></linearGradient>
      <template v-if="framed">
        <linearGradient :id="gid('RimCommon')" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a7f3d0"/><stop offset="0.5" stop-color="#10b981"/><stop offset="1" stop-color="#0e7490"/></linearGradient>
        <linearGradient :id="gid('RimRare')" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bae6fd"/><stop offset="0.5" stop-color="#38bdf8"/><stop offset="1" stop-color="#1d4ed8"/></linearGradient>
        <linearGradient :id="gid('RimEpic')" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f5d0fe"/><stop offset="0.5" stop-color="#e879f9"/><stop offset="1" stop-color="#7e22ce"/></linearGradient>
        <linearGradient :id="gid('RimLeg')" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff7d6"/><stop offset="0.5" stop-color="#fbbf24"/><stop offset="1" stop-color="#b45309"/></linearGradient>
        <radialGradient :id="gid('DiscCommon')" cx="0.4" cy="0.32" r="0.85"><stop offset="0" stop-color="#0f766e"/><stop offset="1" stop-color="#06231f"/></radialGradient>
        <radialGradient :id="gid('DiscRare')" cx="0.4" cy="0.32" r="0.85"><stop offset="0" stop-color="#1e40af"/><stop offset="1" stop-color="#0a1838"/></radialGradient>
        <radialGradient :id="gid('DiscEpic')" cx="0.4" cy="0.32" r="0.85"><stop offset="0" stop-color="#6b21a8"/><stop offset="1" stop-color="#23073f"/></radialGradient>
        <radialGradient :id="gid('DiscLeg')" cx="0.4" cy="0.32" r="0.85"><stop offset="0" stop-color="#a8590a"/><stop offset="1" stop-color="#2c1705"/></radialGradient>
      </template>
    </defs>

    <!-- Marco medallón (solo framed) -->
    <g v-if="framed">
      <circle cx="50" cy="50" r="48" :fill="`url(#${gid(frame.rim)})`"/>
      <circle cx="50" cy="50" r="48" fill="none" stroke="#ffffff" stroke-opacity="0.5" stroke-width="1.5"/>
      <circle cx="50" cy="50" r="48" fill="none" :stroke="frame.studs" stroke-opacity="0.5" stroke-width="4" stroke-dasharray="1 10" stroke-linecap="round"/>
      <circle cx="50" cy="50" r="37" :fill="`url(#${gid(frame.disc)})`" :stroke="frame.rimDark" stroke-width="1.5"/>
    </g>

    <!-- Ícono. Framed → encogido al disco; suelto → casi full. -->
    <g :transform="framed ? 'translate(50,51) scale(0.58) translate(-50,-50)' : ''">
      <!-- PELOTA -->
      <template v-if="key === 'ball'">
        <circle cx="50" cy="50" r="30" :fill="silver"/>
        <path d="M50 35 l14 11 -5 17 h-18 l-5 -17 z" fill="#1e293b"/>
        <path d="M50 35 V21 M64 46 l13 -6 M59 63 l7 14 M41 63 l-7 14 M36 46 l-13 -6" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/>
        <path d="M30 43 a30 30 0 0 1 17 -11" fill="none" stroke="#ffffff" stroke-opacity="0.75" stroke-width="3.5" stroke-linecap="round"/>
      </template>
      <!-- BOTÍN -->
      <template v-else-if="key === 'boot'">
        <path d="M24 40 c0 11 2 18 6 21 h33 c7 0 9 -4 9 -9 c0 -4 -3 -6 -8 -7 c-13 -3 -21 -8 -28 -15 c-4 -4 -12 -1 -12 9 z" :fill="silver"/>
        <path d="M30 38 q12 8 26 12" fill="none" :stroke="accent" stroke-width="3" stroke-linecap="round"/>
        <rect x="30" y="63" width="6" height="6" rx="1.5" fill="#64748b"/>
        <rect x="44" y="63" width="6" height="6" rx="1.5" fill="#64748b"/>
        <rect x="58" y="63" width="6" height="6" rx="1.5" fill="#64748b"/>
      </template>
      <!-- GUANTES -->
      <template v-else-if="key === 'gloves'">
        <path d="M34 48 q-3 0 -3 5 l2 15 q1 9 10 9 h14 q9 0 9 -10 v-19 q0 -4 -4 -4 z" :fill="silver"/>
        <path d="M37 50 v-18 q0 -4 4 -4 t4 4 v16 M48 48 v-22 q0 -4 4 -4 t4 4 v20 M59 49 v-15 q0 -4 4 -4 t4 4 v15" :fill="silver" stroke="#94a3b8" stroke-width="1"/>
        <path d="M37 58 h28" fill="none" :stroke="accent" stroke-width="3" stroke-linecap="round"/>
      </template>
      <!-- MEDALLA -->
      <template v-else-if="key === 'medal'">
        <path d="M40 22 l9 24 -9 5 -9 -5 z" fill="#cbd5e1"/>
        <path d="M60 22 l-9 24 9 5 9 -5 z" fill="#94a3b8"/>
        <circle cx="50" cy="62" r="20" :fill="gold" stroke="#b45309" stroke-width="1.5"/>
        <path d="M50 50 l4 9 9 1 -7 6 2 9 -8 -5 -8 5 2 -9 -7 -6 9 -1 z" fill="#b45309"/>
      </template>
      <!-- TROFEO -->
      <template v-else-if="key === 'trophy'">
        <path d="M33 28 h34 v12 a17 15 0 0 1 -34 0 z" :fill="gold"/>
        <path d="M33 32 h-9 a8 8 0 0 0 9 11 z M67 32 h9 a8 8 0 0 1 -9 11 z" fill="#f59e0b"/>
        <rect x="45" y="54" width="10" height="11" fill="#f59e0b"/>
        <rect x="34" y="65" width="32" height="8" rx="2" :fill="gold" stroke="#b45309" stroke-width="1"/>
        <path d="M50 30 l3 7 8 1 -6 5 2 8 -7 -4 -7 4 2 -8 -6 -5 8 -1 z" fill="#b45309"/>
      </template>
      <!-- ESTRELLA -->
      <template v-else-if="key === 'star'">
        <path d="M50 22 l8 19 21 1.5 -16 13 5 20 -18 -11 -18 11 5 -20 -16 -13 21 -1.5 z" :fill="gold" stroke="#b45309" stroke-width="1.5"/>
        <path d="M50 30 l5 12 13 1" fill="none" stroke="#fff7d6" stroke-opacity="0.8" stroke-width="2.5" stroke-linecap="round"/>
      </template>
      <!-- ESCUDO -->
      <template v-else-if="key === 'shield'">
        <path d="M50 22 l24 9 v15 c0 19 -13 28 -24 32 -11 -4 -24 -13 -24 -32 v-15 z" :fill="silver" stroke="#94a3b8" stroke-width="1.5"/>
        <path d="M39 51 l7 8 15 -17" fill="none" :stroke="accent" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      </template>
      <!-- CORONA -->
      <template v-else-if="key === 'crown'">
        <path d="M28 66 l-6 -34 17 14 11 -20 11 20 17 -14 -6 34 z" :fill="gold" stroke="#b45309" stroke-width="1.5"/>
        <rect x="27" y="66" width="46" height="9" rx="2" :fill="gold" stroke="#b45309" stroke-width="1.5"/>
        <circle cx="34" cy="40" r="3.5" fill="#e11d48"/><circle cx="50" cy="34" r="4" fill="#06b6d4"/><circle cx="66" cy="40" r="3.5" fill="#e11d48"/>
      </template>
      <!-- GOAT (legendario, dorado) -->
      <template v-else-if="key === 'goat'">
        <!-- cuernos curvos con estrías -->
        <path d="M38 35 c-10 -3 -15 -14 -10 -25 c2 11 8 17 16 19 z" :fill="gold" stroke="#b45309" stroke-width="1.2" stroke-linejoin="round"/>
        <path d="M62 35 c10 -3 15 -14 10 -25 c-2 11 -8 17 -16 19 z" :fill="gold" stroke="#b45309" stroke-width="1.2" stroke-linejoin="round"/>
        <path d="M31 14 q3 8 10 14 M69 14 q-3 8 -10 14" fill="none" stroke="#b45309" stroke-opacity="0.5" stroke-width="1.3" stroke-linecap="round"/>
        <!-- orejas -->
        <path d="M35 41 q-10 -1 -13 6 q8 3 13 -1 z" :fill="gold" stroke="#b45309" stroke-width="1"/>
        <path d="M65 41 q10 -1 13 6 q-8 3 -13 -1 z" :fill="gold" stroke="#b45309" stroke-width="1"/>
        <!-- cara -->
        <path d="M38 39 q12 -7 24 0 q6 10 3 23 q-3 13 -15 16 q-12 -3 -15 -16 q-3 -13 3 -23 z" :fill="gold" stroke="#b45309" stroke-width="1.4"/>
        <!-- brillo de frente -->
        <path d="M44 41 q6 -3 12 0 q2 4 1 9 q-7 -4 -14 0 q-1 -5 1 -9 z" fill="#fff7d6" fill-opacity="0.45"/>
        <!-- ojos con destello -->
        <circle cx="44" cy="51" r="3.2" fill="#3b1d04"/><circle cx="56" cy="51" r="3.2" fill="#3b1d04"/>
        <circle cx="45.3" cy="49.8" r="1" fill="#ffe9a8"/><circle cx="57.3" cy="49.8" r="1" fill="#ffe9a8"/>
        <!-- hocico -->
        <path d="M44 63 q6 4 12 0 q-2 6 -6 7 q-4 -1 -6 -7 z" fill="#7a4a12"/>
        <path d="M47 64 h6" stroke="#3b1d04" stroke-width="1.3" stroke-linecap="round"/>
        <!-- barba -->
        <path d="M50 70 q-3 8 -1 13 M50 70 q3 8 1 13" fill="none" stroke="#b45309" stroke-width="2.3" stroke-linecap="round"/>
      </template>
      <!-- RAYO -->
      <template v-else-if="key === 'bolt'">
        <path d="M56 16 L28 54 h16 l-5 30 l33 -42 h-18 z" :fill="gold" stroke="#a16207" stroke-width="1.5" stroke-linejoin="round"/>
        <path d="M49 30 l-11 22" fill="none" stroke="#fff7d6" stroke-opacity="0.7" stroke-width="2.5" stroke-linecap="round"/>
      </template>
      <!-- LLAMA -->
      <template v-else-if="key === 'flame'">
        <path d="M50 18 c10 14 19 21 15 39 c-3 14 -11 23 -15 23 c-4 0 -12 -9 -15 -23 c-2 -10 4 -15 7 -22 c2 7 6 7 7 3 c2 -8 -4 -16 1 -20 z" fill="#ea580c"/>
        <path d="M50 42 c5 7 9 11 7 20 c-1 7 -5 12 -7 12 c-2 0 -6 -5 -7 -12 c-1 -5 3 -8 5 -13 c1 4 2 4 2 0 z" fill="#fde047"/>
      </template>
      <!-- GEMA -->
      <template v-else-if="key === 'gem'">
        <path d="M32 42 l10 -18 h16 l10 18 -18 38 z" fill="#a5f3fc" stroke="#0891b2" stroke-width="1.5" stroke-linejoin="round"/>
        <path d="M32 42 h36 M46 42 l4 38 M54 42 l-4 38 M42 24 l4 18 M58 24 l-4 18" fill="none" stroke="#0891b2" stroke-width="1.1" stroke-opacity="0.8"/>
        <path d="M42 24 h16 l-4 18 h-8 z" fill="#cffafe"/>
      </template>
      <!-- BÚHO -->
      <template v-else-if="key === 'owl'">
        <path d="M30 30 q3 -12 11 -12 q-1 8 -3 13 z M70 30 q-3 -12 -11 -12 q1 8 3 13 z" :fill="silver"/>
        <path d="M50 26 c-15 0 -24 12 -24 27 c0 17 11 29 24 29 c13 0 24 -12 24 -29 c0 -15 -9 -27 -24 -27 z" :fill="silver" stroke="#94a3b8" stroke-width="1"/>
        <circle cx="40" cy="46" r="9.5" fill="#0f172a"/><circle cx="60" cy="46" r="9.5" fill="#0f172a"/>
        <circle cx="40" cy="46" r="6.5" fill="#fbbf24"/><circle cx="60" cy="46" r="6.5" fill="#fbbf24"/>
        <circle cx="40" cy="46" r="3" fill="#0f172a"/><circle cx="60" cy="46" r="3" fill="#0f172a"/>
        <path d="M50 52 l5 7 -5 5 -5 -5 z" fill="#f59e0b"/>
        <path d="M37 66 q13 9 26 0" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/>
      </template>
      <!-- ESCOBA -->
      <template v-else-if="key === 'broom'">
        <path d="M64 20 L44 48" :stroke="gold" stroke-width="5" stroke-linecap="round"/>
        <path d="M30 50 l20 -8 l8 18 q-16 12 -28 6 z" fill="#ca8a04"/>
        <path d="M30 50 l20 -8 l3 9 l-20 8 z" fill="#a16207"/>
        <path d="M33 62 l-2 18 M40 64 l0 18 M47 64 l2 17 M54 61 l4 17" fill="none" stroke="#854d0e" stroke-width="2.5" stroke-linecap="round"/>
      </template>
      <!-- SOL / AMANECER -->
      <template v-else-if="key === 'sun'">
        <g :stroke="gold" stroke-width="5" stroke-linecap="round"><path d="M50 14 v10 M50 76 v10 M14 50 h10 M76 50 h10 M25 25 l7 7 M68 68 l7 7 M75 25 l-7 7 M32 68 l-7 7"/></g>
        <circle cx="50" cy="50" r="18" :fill="gold" stroke="#b45309" stroke-width="1.5"/>
        <path d="M40 46 a12 12 0 0 1 16 -4" fill="none" stroke="#fff7d6" stroke-opacity="0.7" stroke-width="2.5" stroke-linecap="round"/>
      </template>
      <!-- TRÉBOL -->
      <template v-else-if="key === 'clover'">
        <path d="M50 66 q3 10 -5 18" fill="none" stroke="#15803d" stroke-width="3.5" stroke-linecap="round"/>
        <g fill="#22c55e" stroke="#15803d" stroke-width="1.2">
          <circle cx="50" cy="36" r="13"/><circle cx="64" cy="50" r="13"/><circle cx="50" cy="64" r="13"/><circle cx="36" cy="50" r="13"/>
        </g>
        <circle cx="50" cy="50" r="5" fill="#166534"/>
        <path d="M44 32 a10 10 0 0 1 8 -4" fill="none" stroke="#dcfce7" stroke-opacity="0.7" stroke-width="2.2" stroke-linecap="round"/>
      </template>
      <!-- ESPADA -->
      <template v-else-if="key === 'sword'">
        <path d="M50 14 l6 8 -3 40 h-6 l-3 -40 z" :fill="silver" stroke="#64748b" stroke-width="1.2" stroke-linejoin="round"/>
        <path d="M50 16 v44" stroke="#e2e8f0" stroke-opacity="0.6" stroke-width="1.5"/>
        <rect x="34" y="60" width="32" height="6" rx="2" :fill="gold" stroke="#b45309" stroke-width="0.8"/>
        <rect x="46" y="65" width="8" height="15" rx="2" fill="#78350f"/>
        <circle cx="50" cy="82" r="4.5" :fill="gold" stroke="#b45309" stroke-width="0.8"/>
      </template>
      <!-- HAT-TRICK (galera) -->
      <template v-else-if="key === 'hat'">
        <ellipse cx="50" cy="72" rx="30" ry="7" :fill="silver" stroke="#64748b" stroke-width="1"/>
        <path d="M36 72 v-34 q0 -4 4 -4 h20 q4 0 4 4 v34 z" fill="#1e293b" stroke="#64748b" stroke-width="1.5"/>
        <rect x="36" y="58" width="28" height="8" fill="#e11d48"/>
        <ellipse cx="50" cy="38" rx="14" ry="4" fill="#334155"/>
      </template>
      <!-- LAUREL (centurión) -->
      <template v-else-if="key === 'laurel'">
        <path d="M48 84 C30 80 22 62 27 42 M52 84 C70 80 78 62 73 42" fill="none" :stroke="gold" stroke-width="3.5" stroke-linecap="round"/>
        <g fill="#ca8a04">
          <ellipse cx="27" cy="47" rx="5.5" ry="3" transform="rotate(-45 27 47)"/><ellipse cx="30" cy="60" rx="5.5" ry="3" transform="rotate(-28 30 60)"/><ellipse cx="36" cy="72" rx="5.5" ry="3" transform="rotate(-12 36 72)"/>
          <ellipse cx="73" cy="47" rx="5.5" ry="3" transform="rotate(45 73 47)"/><ellipse cx="70" cy="60" rx="5.5" ry="3" transform="rotate(28 70 60)"/><ellipse cx="64" cy="72" rx="5.5" ry="3" transform="rotate(12 64 72)"/>
        </g>
        <path d="M50 34 l3.2 7.5 8.3 0.6 -6.3 5.4 2 8.1 -7.2 -4.4 -7.2 4.4 2 -8.1 -6.3 -5.4 8.3 -0.6 z" :fill="gold" stroke="#b45309" stroke-width="1"/>
      </template>
      <!-- BOCADILLO (chat) -->
      <template v-else-if="key === 'chat'">
        <path d="M20 28 h60 a10 10 0 0 1 10 10 v20 a10 10 0 0 1 -10 10 h-32 l-16 13 v-13 h-12 a10 10 0 0 1 -10 -10 v-20 a10 10 0 0 1 10 -10 z" :fill="silver" stroke="#64748b" stroke-width="1.5" stroke-linejoin="round"/>
        <g fill="#475569"><circle cx="36" cy="48" r="4"/><circle cx="50" cy="48" r="4"/><circle cx="64" cy="48" r="4"/></g>
      </template>
      <!-- MARIPOSA -->
      <template v-else-if="key === 'butterfly'">
        <g fill="#e879f9" stroke="#a21caf" stroke-width="1">
          <path d="M49 46 q-20 -20 -30 -8 q-8 12 4 20 q14 8 26 -6 z"/>
          <path d="M51 46 q20 -20 30 -8 q8 12 -4 20 q-14 8 -26 -6 z"/>
        </g>
        <g fill="#c026d3" stroke="#a21caf" stroke-width="1">
          <path d="M49 54 q-14 6 -18 18 q-2 10 8 10 q10 0 12 -14 z"/>
          <path d="M51 54 q14 6 18 18 q2 10 -8 10 q-10 0 -12 -14 z"/>
        </g>
        <ellipse cx="50" cy="52" rx="2.6" ry="15" fill="#3b1d04"/>
        <path d="M50 38 q-5 -7 -10 -8 M50 38 q5 -7 10 -8" fill="none" stroke="#3b1d04" stroke-width="2" stroke-linecap="round"/>
      </template>
      <!-- GLOBO -->
      <template v-else-if="key === 'globe'">
        <circle cx="50" cy="50" r="30" fill="#0ea5e9" stroke="#075985" stroke-width="1.5"/>
        <g fill="#22c55e" stroke="#15803d" stroke-width="0.6">
          <path d="M28 42 q10 -6 18 1 q-3 8 -13 8 q-9 -2 -5 -9 z"/>
          <path d="M54 56 q12 -5 17 5 q-5 9 -17 5 q-4 -6 0 -10 z"/>
          <path d="M38 64 q9 1 9 8 q-9 4 -13 -3 q0 -3 4 -5 z"/>
        </g>
        <g fill="none" stroke="#e0f2fe" stroke-opacity="0.45" stroke-width="1">
          <ellipse cx="50" cy="50" rx="13" ry="30"/><path d="M20 50 h60 M24 38 h52 M24 62 h52"/>
        </g>
      </template>
      <!-- COMETA -->
      <template v-else-if="key === 'comet'">
        <path d="M22 72 L58 36" stroke="#a5b4fc" stroke-width="7" stroke-linecap="round" stroke-opacity="0.45"/>
        <path d="M30 74 L60 44" stroke="#c7d2fe" stroke-width="3.5" stroke-linecap="round" stroke-opacity="0.4"/>
        <path d="M67 28 l4.5 11 12 1 -9 8 3 12 -10.5 -6.5 -10.5 6.5 3 -12 -9 -8 12 -1 z" :fill="gold" stroke="#b45309" stroke-width="1.2" stroke-linejoin="round"/>
      </template>
      <!-- FÉNIX -->
      <template v-else-if="key === 'phoenix'">
        <path d="M50 44 c-16 -14 -30 -6 -34 6 c14 -4 20 4 18 14 c8 -8 14 -3 16 5 z" fill="#ea580c"/>
        <path d="M50 44 c16 -14 30 -6 34 6 c-14 -4 -20 4 -18 14 c-8 -8 -14 -3 -16 5 z" fill="#ea580c"/>
        <path d="M50 46 c-9 -7 -15 -3 -17 3 c8 -2 10 4 8 9 c6 -5 8 -1 9 4 z" fill="#fbbf24"/>
        <path d="M50 46 c9 -7 15 -3 17 3 c-8 -2 -10 4 -8 9 c-6 -5 -8 -1 -9 4 z" fill="#fbbf24"/>
        <path d="M50 62 c-3 10 -7 15 -3 22 c3 -4 3 -9 3 -13 c0 4 0 9 3 13 c4 -7 0 -12 -3 -22 z" fill="#dc2626"/>
        <circle cx="50" cy="34" r="7" fill="#f97316" stroke="#c2410c" stroke-width="1"/>
        <circle cx="52.5" cy="32" r="1.6" fill="#1e293b"/>
        <path d="M56 34 l8 -1 -5 5 z" fill="#facc15"/>
      </template>
    </g>

    <!-- Fallback: glyph crudo (emoji/letra) si la clave no está en el set -->
    <text v-if="!isSvg" x="50" :y="framed ? 60 : 68" text-anchor="middle" :font-size="framed ? 42 : 60">{{ iconKey || '★' }}</text>
  </svg>
</template>

<style scoped>
.cosmetic-icon { display: block; }
</style>
