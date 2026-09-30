<script setup>
/**
 * PrizeCard — la CARTA DE RECOMPENSA ESTÁNDAR (Moodboard 08).
 *
 * Una sola carta para todo lo que se gana en FULVO: ícono, borde, banner,
 * título, rango, juego, XP y ayuda. La carta NUNCA cambia de forma
 * (5:7 con una ventana cuadrada fija); lo que cambia es qué se dibuja en la
 * ventana, con una regla por tipo:
 *   ícono → el ícono solo · borde → el borde con una silueta gris ·
 *   banner → tu perfil en miniatura · título → nombre + etiqueta ·
 *   rango → escudo real · juego → portada del juego · XP → esfera dorada ·
 *   ayuda → el botón de la ayuda. (Los logros tienen su propia escena y medalla.)
 * La rareza SOLO toca el marco (color, gema y brillo), nunca el tamaño.
 *
 * Tamaños: 's' (72 px, cuadrada, sin texto) · 'm' (150 px) · 'l' (240 px) o un número.
 * Estados: '' · 'new' · 'equipped' · 'locked' (con lockLevel). faceDown = boca abajo.
 * Usar con services/prize-card.js para convertir cualquier recompensa.
 */
import { computed, ref, watch } from 'vue'
import { frameStyle, bannerStyle } from '@/services/cosmetics'
import { PRIZE_TYPE_LABEL } from '@/services/prize-card'
import CosmeticIcon from './CosmeticIcon.vue'
import PowerupIcon from './PowerupIcon.vue'

const props = defineProps({
  prize: { type: Object, required: true },
  size: { type: [String, Number], default: 'm' },
  state: { type: String, default: '' },          // '' | 'new' | 'equipped' | 'locked'
  lockLevel: { type: [Number, String], default: null },
  faceDown: { type: Boolean, default: false },
  tilt: { type: Boolean, default: false },
  userName: { type: String, default: 'Vos' },
})

const SIZES = { s: 72, m: 150, l: 240 }
const width = computed(() => typeof props.size === 'number' ? props.size : (SIZES[props.size] || 150))
const small = computed(() => props.size === 's' || width.value < 96)
const rarity = computed(() => props.prize?.rarity || 'common')
const kind = computed(() => props.prize?.kind || 'icon')
const typeLabel = computed(() => PRIZE_TYPE_LABEL[kind.value] || 'Recompensa')
const longName = computed(() => (props.prize?.name || '').length > 16)
// Tamaño en px de la ventana (para los componentes que dibujan con `size`)
const win = computed(() => Math.round(small.value ? width.value * 0.92 : width.value * 0.856))
const fr = computed(() => frameStyle(props.prize?.styleKey))
const bnr = computed(() => bannerStyle(props.prize?.styleKey))

const GAME_COLORS = {
  'guess-player': ['#10b981', '#064e3b'], 'nationality': ['#06b6d4', '#083344'], 'player-position': ['#3b82f6', '#172554'],
  'shirt-number': ['#6366f1', '#1e1b4b'], 'stat-challenge': ['#ec4899', '#500724'], 'value-order': ['#f59e0b', '#451a03'],
  'age-order': ['#f43f5e', '#4c0519'], 'height-order': ['#14b8a6', '#042f2e'], 'who-is': ['#a855f7', '#3b0764'],
  'football-wordle': ['#64748b', '#0f172a'], 'higher-or-lower': ['#ef4444', '#450a0a'], 'connections': ['#84cc16', '#1a2e05'],
  'football-grid': ['#0ea5e9', '#082f49'], 'once-ideal': ['#f97316', '#431407'],
}
const gameBg = computed(() => {
  const c = GAME_COLORS[props.prize?.slug] || ['#475569', '#0f172a']
  return `radial-gradient(70% 70% at 50% 45%, ${c[0]}88, transparent 75%), linear-gradient(160deg, ${c[0]}, ${c[1]})`
})
const PU_COLORS = { fifty_fifty: '#e879f9', shield: '#38bdf8', extra_time: '#fbbf24', reveal_hint: '#34d399' }
const puColor = computed(() => PU_COLORS[props.prize?.powerup] || '#94a3b8')


// Vuelta de la carta cuando deja de estar boca abajo
const flipping = ref(false)
watch(() => props.faceDown, (v, old) => {
  if (old && !v) { flipping.value = true; setTimeout(() => { flipping.value = false }, 460) }
})

// Inclinación con el dedo / mouse (tamaño L en escenas)
const rootEl = ref(null)
const tiltStyle = ref({})
const shinePos = ref(null)
function onMove(e) {
  if (!props.tilt || !rootEl.value) return
  const r = rootEl.value.getBoundingClientRect()
  const x = (e.clientX - r.left) / r.width - 0.5
  const y = (e.clientY - r.top) / r.height - 0.5
  tiltStyle.value = { transform: `perspective(900px) rotateY(${x * 22}deg) rotateX(${-y * 22}deg)` }
  shinePos.value = `${50 - x * 140}% 0`
}
function onLeave() { tiltStyle.value = {}; shinePos.value = null }
</script>

<template>
  <div
    ref="rootEl"
    class="pcard"
    :class="[`r-${rarity}`, { 'is-s': small, 'is-locked': state === 'locked', 'is-flipping': flipping, 'is-tilt': tilt }]"
    :style="[{ '--w': width + 'px' }, tiltStyle]"
    @pointermove="onMove"
    @pointerleave="onLeave"
  >
    <div class="pc-in">
      <div class="pc-win">
        <!-- ÍCONO -->
        <div v-if="kind === 'icon'" class="pc-icon" :style="{ width: Math.round(win * 0.74) + 'px', height: Math.round(win * 0.74) + 'px' }">
          <CosmeticIcon :iconKey="prize.styleKey" :rarity="rarity" :size="Math.round(win * 0.74)" />
        </div>

        <!-- BORDE: el borde solo, con una silueta gris donde va tu ícono -->
        <div v-else-if="kind === 'frame'" class="rounded-full" :class="[fr.wrap]"
             :style="{ width: Math.round(win * 0.66) + 'px', height: Math.round(win * 0.66) + 'px', padding: Math.max(3, Math.round(win * 0.045)) + 'px' }">
          <div class="pc-av w-full h-full rounded-full overflow-hidden grid place-items-center"><svg class="pc-sil" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="15" r="7.5" /><path d="M6 38c0-8.5 6.3-13 14-13s14 4.5 14 13z" /></svg></div>
        </div>

        <!-- BANNER: perfil en miniatura (silueta gris en el lugar del ícono) -->
        <div v-else-if="kind === 'banner'" class="pc-banner" :class="bnr">
          <span class="pc-bav"><svg class="pc-sil" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="15" r="7.5" /><path d="M6 38c0-8.5 6.3-13 14-13s14 4.5 14 13z" /></svg></span>
          <i class="l1"></i><i class="l2"></i>
        </div>

        <!-- TÍTULO: tu nombre + la etiqueta -->
        <div v-else-if="kind === 'title'" class="pc-title">
          <span class="who"><i></i>{{ userName }}</span>
          <span class="tt" :class="{ long: (prize.name || '').length > 18 }">{{ prize.name }}</span>
        </div>

        <!-- RANGO -->
        <img v-else-if="kind === 'tier'" :src="prize.image" class="pc-img pc-tier" alt="" />

        <!-- JUEGO -->
        <div v-else-if="kind === 'game'" class="pc-game" :style="{ background: gameBg }">
          <img :src="prize.image || `/games/${prize.slug}.svg`" class="pc-img" alt="" />
        </div>

        <!-- XP: chapa de marcador (plana, sin esfera) -->
        <svg v-else-if="kind === 'xp'" class="pc-xp" viewBox="0 0 60 46" :style="{ width: Math.round(win * 0.78) + 'px' }" aria-hidden="true">
          <g transform="rotate(-4 30 22)">
            <rect x="2" y="3" width="56" height="30" rx="7" fill="#0b1024" stroke="#fcd34d" stroke-width="2.5" />
            <path d="M8 9h44" stroke="#fcd34d" stroke-opacity=".18" stroke-width="2" stroke-linecap="round" />
            <text x="30" y="25.5" text-anchor="middle" font-family="Barlow Condensed, sans-serif" font-weight="800" :font-size="String(prize.amount).length > 3 ? 17 : 20" fill="#fcd34d">+{{ prize.amount }}</text>
            <rect x="19" y="29" width="22" height="12" rx="3" fill="#fcd34d" />
            <text x="30" y="38.5" text-anchor="middle" font-family="Barlow Condensed, sans-serif" font-weight="800" font-size="10" letter-spacing="1" fill="#141005">XP</text>
          </g>
        </svg>

        <!-- AYUDA: el botón de la partida -->
        <div v-else-if="kind === 'powerup'" class="pc-pu" :style="{ '--pc': puColor, width: Math.round(win * 0.62) + 'px', height: Math.round(win * 0.62) + 'px' }">
          <PowerupIcon :type="prize.powerup" :size="Math.round(win * 0.36)" />
          <span v-if="prize.count > 1" class="x">×{{ prize.count }}</span>
        </div>


        <span v-if="state === 'locked'" class="pc-lock" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
        </span>
      </div>
      <div v-if="!small" class="pc-meta">
        <span class="pc-ty">{{ typeLabel }}</span>
        <span class="pc-nm" :class="{ long: longName }">{{ prize.name }}</span>
      </div>
    </div>
    <span class="pc-gem" aria-hidden="true"></span>
    <span class="pc-shine" aria-hidden="true" :style="shinePos ? { backgroundPosition: shinePos, animation: 'none' } : null"></span>
    <div v-if="faceDown" class="pc-back" aria-hidden="true"><span>F</span></div>
    <span v-if="!small && state === 'new'" class="pc-chip new">Nueva</span>
    <span v-else-if="!small && state === 'equipped'" class="pc-chip eq">✓ Equipada</span>
    <span v-else-if="!small && state === 'locked' && lockLevel" class="pc-chip lk">🔒 NV {{ lockLevel }}</span>
  </div>
</template>

<style scoped>
/* La carta es su propio contenedor: TODO lo de adentro se mide en cqw. Las
   propiedades de la carta misma NO usan cqw (se medirían contra el padre). */
.pcard {
  --rk: #cbd5e1; --rk2: #64748b;
  position: relative; flex: none; align-self: flex-start; width: var(--w); height: auto; aspect-ratio: 5 / 7; container-type: inline-size;
  border-radius: 9% / 6.4%; color: #fff; isolation: isolate;
  background: linear-gradient(160deg, var(--rk), var(--rk2));
  box-shadow: 0 8px 22px rgba(0, 0, 0, .45);
  transition: transform .2s ease-out, filter .3s;
  user-select: none; -webkit-user-select: none;
}
.pcard.r-rare { --rk: #7dd3fc; --rk2: #1d4ed8; }
.pcard.r-epic { --rk: #f0abfc; --rk2: #7e22ce; }
.pcard.r-legendary { --rk: #fde68a; --rk2: #b45309; background: conic-gradient(from var(--pc-ang, 0deg), #fde68a, #f59e0b, #fef3c7, #d97706, #fde68a); animation: pc-rot 6s linear infinite; }
@property --pc-ang { syntax: '<angle>'; inherits: false; initial-value: 0deg; }
@keyframes pc-rot { to { --pc-ang: 360deg; } }
.pcard.is-s { aspect-ratio: 1; border-radius: 14%; }

.pc-in { position: absolute; inset: 2.2cqw; border-radius: 5.4cqw; overflow: hidden; background: linear-gradient(180deg, #141a38, #0b1024); display: flex; flex-direction: column; }
.is-s .pc-in { border-radius: 11%; }
.pc-win {
  position: relative; margin: 5cqw 5cqw 0; aspect-ratio: 1; border-radius: 4cqw; overflow: hidden; display: grid; place-items: center;
  background: radial-gradient(70% 70% at 50% 40%, color-mix(in srgb, var(--rk) 35%, transparent), transparent 70%), #0a0f26;
}
.is-s .pc-win { margin: 0; aspect-ratio: auto; height: 100%; border-radius: 0; }
.pc-win::after { content: ""; position: absolute; inset: 0; border-radius: inherit; box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .08); pointer-events: none; }
.pc-meta { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 1cqw; padding: 3cqw 6cqw 5cqw; min-height: 0; }
.pc-ty { font-family: var(--font-bug, 'Barlow Condensed', sans-serif); font-weight: 800; text-transform: uppercase; letter-spacing: .1em; font-size: 6.4cqw; line-height: 1; color: var(--rk); }
.pc-nm { font-family: var(--font-bug, 'Barlow Condensed', sans-serif); font-weight: 800; font-size: 10.5cqw; line-height: 1.02; text-transform: uppercase; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-wrap: balance; }
.pc-nm.long { font-size: 9cqw; }
.pc-gem { position: absolute; right: 7cqw; top: 7cqw; width: 9cqw; height: 9cqw; transform: rotate(45deg); border-radius: 1.5cqw; background: linear-gradient(135deg, #fff, var(--rk) 40%, var(--rk2)); box-shadow: 0 0 3cqw var(--rk); z-index: 3; }
.pc-shine { position: absolute; inset: 0; border-radius: inherit; pointer-events: none; z-index: 4; background: linear-gradient(115deg, transparent 35%, rgba(255, 255, 255, .35) 50%, transparent 65%); background-size: 250% 100%; background-position: 120% 0; mix-blend-mode: overlay; }
.r-epic .pc-shine, .r-legendary .pc-shine { animation: pc-sweep 3.2s ease-in-out infinite; }
.r-legendary .pc-shine { background-image: linear-gradient(115deg, transparent 30%, rgba(255, 240, 180, .5) 45%, rgba(180, 240, 255, .4) 55%, transparent 70%); }
@keyframes pc-sweep { 0%, 40% { background-position: 120% 0; } 100% { background-position: -120% 0; } }

/* contenidos */
.pc-icon { display: grid; place-items: center; filter: drop-shadow(0 3cqw 4cqw rgba(0, 0, 0, .5)); }
.pc-img { width: 78%; height: 78%; object-fit: contain; filter: drop-shadow(0 3cqw 4cqw rgba(0, 0, 0, .5)); }
.pc-av { background: #1e293b; box-shadow: inset 0 0 0 1px rgba(0, 0, 0, .4); }
.pc-sil { width: 62%; height: 62%; fill: #64748b; margin-top: 14%; }
.pc-banner { position: absolute; inset: 0; }
.pc-bav { position: absolute; left: 9%; bottom: 12%; width: 30%; aspect-ratio: 1; border-radius: 50%; background: #1e293b; border: 1.5cqw solid #0b1024; display: grid; place-items: center; overflow: hidden; }
.pc-banner .l1, .pc-banner .l2 { position: absolute; left: 44%; height: 5cqw; border-radius: 3cqw; background: rgba(255, 255, 255, .85); }
.pc-banner .l1 { bottom: 30%; width: 36%; }
.pc-banner .l2 { bottom: 18%; width: 24%; background: rgba(255, 255, 255, .45); }
.pc-title { display: grid; justify-items: center; gap: 3cqw; width: 86%; text-align: center; }
.pc-title .who { display: flex; align-items: center; gap: 3cqw; font-weight: 700; font-size: 9cqw; }
.pc-title .who i { width: 13cqw; height: 13cqw; border-radius: 50%; background: #64748b; display: block; }
.pc-title .tt { font-family: var(--font-bug, 'Barlow Condensed', sans-serif); font-weight: 800; text-transform: uppercase; letter-spacing: .04em; font-size: 9.5cqw; line-height: 1.05; color: var(--rk); padding: 2.2cqw 4cqw; border-radius: 3cqw; background: color-mix(in srgb, var(--rk) 14%, transparent); border: 1px solid color-mix(in srgb, var(--rk) 45%, transparent); text-wrap: balance; }
.pc-title .tt.long { font-size: 8cqw; }
.pc-game { position: absolute; inset: 0; display: grid; place-items: center; }
.pc-xp { height: auto; }
.pc-pu { position: relative; border-radius: 22%; display: grid; place-items: center; color: var(--pc); background: color-mix(in srgb, var(--pc) 20%, #0b1024); border: 2cqw solid var(--pc); box-shadow: 0 0 6cqw color-mix(in srgb, var(--pc) 45%, transparent); }
.pc-pu .x { position: absolute; right: -7cqw; bottom: -5cqw; font-family: var(--font-bug, 'Barlow Condensed', sans-serif); font-weight: 800; font-size: 10cqw; color: #fff; background: #0b1024; border: 1.5px solid var(--pc); border-radius: 99px; padding: .5cqw 3cqw; }

/* estados */
.is-locked .pc-win > :not(.pc-lock) { filter: saturate(.65) brightness(.8); }
.is-locked .pc-shine { display: none; }
.pc-lock { position: absolute; right: 5cqw; bottom: 5cqw; z-index: 3; width: 15cqw; height: 15cqw; border-radius: 50%; background: rgba(8, 10, 25, .85); display: grid; place-items: center; border: 1px solid rgba(255, 255, 255, .2); }
.pc-lock svg { width: 58%; height: 58%; }
.pc-chip { position: absolute; left: 50%; transform: translateX(-50%); bottom: -3.5cqw; z-index: 5; white-space: nowrap; font-family: var(--font-bug, 'Barlow Condensed', sans-serif); font-weight: 800; text-transform: uppercase; letter-spacing: .06em; font-size: 6.6cqw; line-height: 1; padding: 1.8cqw 3.6cqw; border-radius: 99px; box-shadow: 0 3px 10px rgba(0, 0, 0, .4); }
.pc-chip.new { background: #ef4444; color: #fff; }
.pc-chip.eq { background: #4ade80; color: #052e16; }
.pc-chip.lk { background: #0b1024; color: #e2e8f0; border: 1px solid rgba(255, 255, 255, .2); }

/* boca abajo */
.pc-back { position: absolute; inset: 2.2cqw; border-radius: 5.4cqw; z-index: 6; display: grid; place-items: center;
  background: repeating-linear-gradient(45deg, rgba(255, 255, 255, .06) 0 3cqw, transparent 3cqw 7cqw), radial-gradient(60% 60% at 50% 50%, color-mix(in srgb, var(--rk) 40%, transparent), transparent), #0b1024; }
.pc-back span { font-family: var(--font-shout, 'Barlow Condensed', sans-serif); font-weight: 800; font-style: italic; font-size: 34cqw; line-height: 1; color: rgba(255, 255, 255, .85); text-shadow: 0 1.5cqw 0 rgba(0, 0, 0, .3); }
.is-flipping { animation: pc-flip .45s ease-in-out; }
@keyframes pc-flip { 0% { transform: rotateY(90deg); } 100% { transform: rotateY(0); } }
.is-tilt { will-change: transform; }

@media (prefers-reduced-motion: reduce) {
  .pcard, .pc-shine, .is-flipping { animation: none !important; }
}
</style>
