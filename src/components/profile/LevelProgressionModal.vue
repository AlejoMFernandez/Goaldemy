<script setup>
/**
 * El camino (Moodboard 03)
 * Mapa de los 11 rangos unidos por una ruta (hace scroll horizontal si no entra): lo recorrido en dorado, tu posición
 * marcada con un pin, lo que falta apagado con candado. Tocás un escudo y abajo
 * se abre su vitrina: "Al llegar ganás" (cartas reales) y "En el camino"
 * (lo que dan los niveles de ese rango). Por defecto se abre en el PRÓXIMO rango,
 * para que siempre se vea lo que viene.
 */
import { computed, onMounted, onUnmounted, ref, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { TIERS, getTierForLevel } from '../../services/tiers'
import { FALLBACK_THRESHOLDS } from '../../services/xp'
import { forgeTier } from '../../services/rank-forge'
import { MILESTONES } from '../../services/level-rewards'
import { tierPrizes, prizesForLevelRange, xpPrize } from '../../services/prize-card'
import PrizeCard from '../rewards/PrizeCard.vue'

const props = defineProps({
  currentLevel: { type: Number, default: 1 },
})
const emit = defineEmits(['close'])
const router = useRouter()

// XP acumulada para llegar a cada nivel (para "Se alcanza a los X XP"): XP_TABLE[nivel - 1].
const XP_TABLE = FALLBACK_THRESHOLDS.map(t => t.xp_required)
const glowOf = (t) => forgeTier(t.key)?.glow || '#fcd34d'
const lvl = computed(() => Math.max(1, Number(props.currentLevel) || 1))
const currentTier = computed(() => getTierForLevel(lvl.value))
const currentIdx = computed(() => Math.max(0, TIERS.findIndex(t => t.key === currentTier.value?.key)))

// ── Mapa: posiciones de los escudos sobre la ruta (viewBox MAP_W×MAP_H) ──
const MAP_W = 60 + (TIERS.length - 1) * 98 + 60
const MAP_H = 280
const NODES = TIERS.map((_, i) => ({ x: 60 + i * 98, y: i % 2 === 0 ? 215 - i * 9 : 115 - i * 4 }))
const ROAD = NODES.map((n, i) => {
  if (i === 0) return `M${n.x} ${n.y}`
  const m = (NODES[i - 1].x + n.x) / 2
  return `C ${m} ${NODES[i - 1].y}, ${m} ${n.y}, ${n.x} ${n.y}`
}).join(' ')
// Avance total sobre la ruta (0..1): cada tramo entre escudos pesa lo mismo
const progress = computed(() => {
  const i = currentIdx.value
  const t = TIERS[i]
  if (!t || i >= TIERS.length - 1) return 1
  const span = Math.max(1, (t.maxLevel || t.minLevel) - t.minLevel + 1)
  const within = Math.min(1, Math.max(0, (lvl.value - t.minLevel) / span))
  return (i + within) / (TIERS.length - 1)
})
const roadEl = ref(null)
const mapScroll = ref(null)
const pin = ref({ x: NODES[0].x, y: NODES[0].y })
const drawn = ref(0) // animación de la ruta (0 → progress)

// ── Vitrina ──
const nextIdx = computed(() => Math.min(TIERS.length - 1, currentIdx.value + 1))
const selected = ref(nextIdx.value)
watch(() => props.currentLevel, () => { selected.value = nextIdx.value })

watch(selected, (i) => centerOn(i, true))
function stateOf(i) {
  if (i < currentIdx.value) return 'done'
  if (i === currentIdx.value) return 'current'
  return 'locked'
}
const show = computed(() => {
  const i = selected.value
  const tier = TIERS[i]
  const st = stateOf(i)
  const ms = MILESTONES.find(m => m.level === tier.minLevel)
  const arrival = [
    { kind: 'tier', name: tier.label, rarity: 'legendary', image: tier.image },
    ...tierPrizes(tier),
  ]
  if (ms?.xpBonus) arrival.push(xpPrize(ms.xpBonus))
  // "En el camino": lo que dan los niveles del rango (sin repetir lo del ascenso)
  const from = tier.minLevel, to = tier.maxLevel || tier.minLevel
  const road = prizesForLevelRange(from, to).filter(p => !p.fromTier && p.kind !== 'tier')
  const levelsLeft = Math.max(0, tier.minLevel - lvl.value)
  const xpLeft = Math.max(0, (XP_TABLE[tier.minLevel - 1] ?? 0) - (XP_TABLE[lvl.value - 1] ?? 0))
  const span = Math.max(1, to - from + 1)
  const pct = st === 'current' ? (i === TIERS.length - 1 ? 100 : Math.round(Math.min(1, (lvl.value - from) / span) * 100)) : 0
  return { tier, st, arrival, road, levelsLeft, xpLeft, pct, glow: glowOf(tier), next: TIERS[i + 1] || null }
})
function fmtXp(n) { return n >= 1000 ? (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1).replace('.', ',') + 'K' : String(n) }

// ── Apertura: la ruta se dibuja hasta donde llegaste, los escudos aparecen de a uno ──
const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
function placePin(f) {
  const p = roadEl.value
  if (!p?.getTotalLength) return
  const L = p.getTotalLength()
  const pt = p.getPointAtLength(L * f)
  pin.value = { x: pt.x, y: pt.y }
}
let raf = 0
function centerOn(i, smooth) {
  const el = mapScroll.value
  if (!el) return
  const x = NODES[i].x - el.clientWidth / 2
  el.scrollTo({ left: Math.max(0, x), behavior: smooth && !reduce ? 'smooth' : 'auto' })
}
onMounted(() => {
  document.body.style.overflow = 'hidden'
  document.addEventListener('keydown', onKeyDown)
  nextTick(() => {
    centerOn(selected.value, false)
    const target = progress.value
    if (reduce) { drawn.value = target; placePin(target); return }
    const t0 = performance.now(), dur = 700 + target * 900
    const step = (t) => {
      const k = Math.min(1, (t - t0 - 250) / dur)
      const e = k <= 0 ? 0 : 1 - Math.pow(1 - k, 3)
      drawn.value = target * e
      placePin(drawn.value)
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
  })
})
onUnmounted(() => {
  document.body.style.overflow = ''
  document.removeEventListener('keydown', onKeyDown)
  cancelAnimationFrame(raf)
})
function onKeyDown(e) { if (e.key === 'Escape') emit('close') }
function goPlay() { emit('close'); router.push('/play/points') }
</script>

<template>
  <Teleport to="body">
    <div class="rd-back" @click.self="emit('close')">
      <section v-pop class="rd" role="dialog" aria-modal="true" aria-label="El camino">
        <header class="rd-head">
          <h2>El camino</h2>
          <span class="rd-now">NV {{ lvl }} · {{ currentTier?.label }}</span>
          <button type="button" class="rd-x" aria-label="Cerrar" @click="emit('close')">
            <svg viewBox="0 0 20 20" fill="currentColor"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>
          </button>
        </header>

        <div class="rd-scroll">
          <!-- Mapa de los 11 escudos: scroll horizontal, abre centrado en el próximo rango -->
          <div ref="mapScroll" class="rd-map-scroll">
          <div class="rd-map" :style="{ width: MAP_W + 'px' }">
            <svg class="rd-road" :viewBox="`0 0 ${MAP_W} ${MAP_H}`" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
              <path :d="ROAD" class="base" />
              <path ref="roadEl" :d="ROAD" class="done" pathLength="1" :style="{ strokeDashoffset: 1 - drawn }" />
            </svg>
            <button
              v-for="(t, i) in TIERS" :key="t.key" type="button"
              class="rd-node" :class="['is-' + stateOf(i), { 'is-sel': selected === i }]"
              :style="{ left: (NODES[i].x / MAP_W * 100) + '%', top: (NODES[i].y / MAP_H * 100) + '%', '--d': (0.15 + i * 0.09) + 's', '--g': glowOf(t) }"
              :aria-label="`${t.label}, nivel ${t.minLevel}`" :aria-pressed="selected === i"
              @click="selected = i"
            >
              <img :src="t.image" alt="" draggable="false" />
              <span class="lb">{{ t.label }}</span>
              <span v-if="stateOf(i) === 'locked'" class="lk">🔒 NV {{ t.minLevel }}</span>
            </button>
            <span class="rd-pin" :style="{ left: (pin.x / MAP_W * 100) + '%', top: (pin.y / MAP_H * 100) + '%' }" aria-hidden="true"><b>{{ lvl }}</b></span>
          </div>
          </div>

          <!-- Vitrina del rango elegido -->
          <Transition name="rd-case" mode="out-in">
            <div :key="show.tier.key" class="rd-case" :style="{ '--g': show.glow }">
              <div class="rd-case-top">
                <img class="rd-shield" :class="{ 'is-off': show.st === 'locked' }" :src="show.tier.image" alt="" />
                <div class="rd-case-txt">
                  <h3>{{ show.tier.label }}</h3>
                  <p class="rd-range">Niveles {{ show.tier.minLevel }}<template v-if="show.tier.maxLevel !== show.tier.minLevel">–{{ show.tier.maxLevel }}</template></p>
                  <p v-if="show.st === 'done'" class="rd-state ok">✓ Ya es tuyo</p>
                  <template v-else-if="show.st === 'current'">
                    <div class="rd-bar"><i :style="{ width: show.pct + '%' }"></i></div>
                    <p class="rd-state">Estás acá<template v-if="show.next"> · te faltan <b>{{ show.next.minLevel - lvl }}</b> niveles para {{ show.next.label }}</template></p>
                  </template>
                  <p v-else class="rd-state">Te faltan <b>{{ show.levelsLeft }}</b> {{ show.levelsLeft === 1 ? 'nivel' : 'niveles' }} · <b>{{ fmtXp(show.xpLeft) }} XP</b></p>
                </div>
              </div>

              <h4>{{ show.st === 'done' ? 'Ganaste al llegar' : 'Al llegar ganás' }}</h4>
              <div class="rd-row">
                <div v-for="(p, k) in show.arrival" :key="'a' + k" class="rd-card" :style="{ '--k': k }">
                  <PrizeCard :prize="p" :size="104" :state="show.st === 'locked' ? 'locked' : ''" :lock-level="show.tier.minLevel" />
                </div>
              </div>

              <template v-if="show.road.length">
                <h4>En el camino</h4>
                <div class="rd-row rd-row--s">
                  <div v-for="(p, k) in show.road" :key="'r' + k" class="rd-card" :style="{ '--k': k }">
                    <PrizeCard :prize="p" size="s" :state="(p.level || 0) > lvl ? 'locked' : ''" :lock-level="p.level" />
                    <span class="rd-lv" :class="{ ok: (p.level || 0) <= lvl }">{{ p.kind === 'xp' ? 'En total' : 'NV ' + p.level }}</span>
                  </div>
                </div>
              </template>
            </div>
          </Transition>
        </div>

        <footer class="rd-foot">
          <button type="button" class="rd-play" @click="goPlay">Jugar para avanzar</button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.rd-back { position: fixed; inset: 0; z-index: 90; display: grid; place-items: center; padding: 16px; background: rgba(3, 6, 18, .82); backdrop-filter: blur(8px); animation: rd-fade .25s ease both; }
.rd { width: min(100%, 640px); max-height: min(92vh, 900px); display: flex; flex-direction: column; border-radius: 20px; overflow: hidden;
  background: radial-gradient(120% 70% at 50% 0%, #17204d 0%, #0b1024 60%, #070a1a 100%); border: 1px solid rgba(255, 255, 255, .1);
  box-shadow: 0 30px 80px rgba(0, 0, 0, .6); }
@media (max-width: 520px) { .rd-back { padding: 0; place-items: end center; } .rd { border-radius: 20px 20px 0 0; max-height: 94vh; } }
@keyframes rd-fade { from { opacity: 0; } }
@keyframes rd-pop { from { opacity: 0; transform: translateY(16px) scale(.97); } }

.rd-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 12px; padding: 16px 16px 4px 20px; }
.rd-head h2 { margin: 0; font-family: var(--font-shout, 'Barlow Condensed', sans-serif); font-weight: 800; font-style: italic; text-transform: uppercase; font-size: 30px; line-height: 1; color: #fff; white-space: nowrap; }
.rd-now { font-family: var(--font-bug, 'Barlow Condensed', sans-serif); font-weight: 800; text-transform: uppercase; letter-spacing: .08em; font-size: 14px; color: #fcd34d; }
.rd-x { margin-left: auto; width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; background: rgba(255, 255, 255, .06); border: 1px solid rgba(255, 255, 255, .1); color: #cbd5e1; cursor: pointer; align-self: center; }
.rd-x svg { width: 16px; height: 16px; }
.rd-scroll { flex: 1; overflow-y: auto; padding: 0 16px 12px; overscroll-behavior: contain; }

/* Mapa */
.rd-map-scroll { overflow-x: auto; overscroll-behavior-x: contain; margin: 4px -16px 8px; padding: 0 16px; scrollbar-width: thin; scrollbar-color: rgba(255, 255, 255, .2) transparent; -webkit-overflow-scrolling: touch; }
.rd-map { position: relative; aspect-ratio: 1100 / 280; flex: none; }
.rd-road { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.rd-road path { fill: none; stroke-linecap: round; }
.rd-road .base { stroke: rgba(255, 255, 255, .14); stroke-width: 6; stroke-dasharray: 2 12; }
.rd-road .done { stroke: #fcd34d; stroke-width: 6; stroke-dasharray: 1; filter: drop-shadow(0 0 6px rgba(252, 211, 77, .6)); }
.rd-node { position: absolute; width: 60px; transform: translate(-50%, -50%); display: grid; justify-items: center; gap: 2px; padding: 0; border: 0; background: none; cursor: pointer; color: #fff;
  animation: rd-node-in .45s cubic-bezier(.34, 1.56, .64, 1) var(--d) both; z-index: 1; }
@keyframes rd-node-in { from { opacity: 0; transform: translate(-50%, -30%) scale(.5); } }
.rd-node img { width: 100%; aspect-ratio: 1; object-fit: contain; filter: drop-shadow(0 6px 10px rgba(0, 0, 0, .5)); transition: transform .25s cubic-bezier(.34, 1.56, .64, 1), filter .25s; }
.rd-node .lb { font-family: var(--font-bug, sans-serif); font-weight: 800; text-transform: uppercase; letter-spacing: .06em; font-size: 12px; white-space: nowrap; text-shadow: 0 1px 2px #000; }
.rd-node .lk { margin-top: -1px; font-family: var(--font-bug, sans-serif); font-weight: 800; font-size: 10px; white-space: nowrap; padding: 1px 6px; border-radius: 999px; background: #0b1024; border: 1px solid rgba(255, 255, 255, .15); color: #94a3b8; }
.rd-node.is-locked img { filter: grayscale(1) brightness(.55) drop-shadow(0 6px 10px rgba(0, 0, 0, .5)); }
.rd-node.is-locked .lb { color: #64748b; }
.rd-node.is-current img { filter: drop-shadow(0 0 14px var(--g)) drop-shadow(0 6px 10px rgba(0, 0, 0, .5)); animation: rd-glow 2.2s ease-in-out infinite; }
@keyframes rd-glow { 50% { transform: scale(1.06); } }
.rd-node.is-sel img { transform: scale(1.14); }
.rd-node.is-sel .lb { color: #fcd34d; }
.rd-node:focus-visible { outline: 2px solid #fcd34d; outline-offset: 4px; border-radius: 12px; }
.rd-pin { position: absolute; z-index: 2; transform: translate(-50%, -100%); pointer-events: none; }
.rd-pin b { position: relative; isolation: isolate; display: grid; place-items: center; width: 30px; height: 30px; margin-bottom: 6px; color: #141005;
  font-family: var(--font-bug, sans-serif); font-weight: 800; font-size: 13px; }
.rd-pin b::before { content: ""; position: absolute; inset: 0; z-index: -1; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); background: #fcd34d;
  box-shadow: 0 4px 12px rgba(0, 0, 0, .5), 0 0 16px rgba(252, 211, 77, .6); }

/* Vitrina */
.rd-case { --g: #fcd34d; border-radius: 16px; padding: 14px; background: radial-gradient(90% 60% at 20% 0%, color-mix(in srgb, var(--g) 18%, transparent), transparent 70%), rgba(255, 255, 255, .03); border: 1px solid color-mix(in srgb, var(--g) 30%, rgba(255, 255, 255, .08)); }
.rd-case-top { display: flex; align-items: center; gap: 14px; }
.rd-shield { flex: none; width: 84px; height: 84px; object-fit: contain; filter: drop-shadow(0 0 18px color-mix(in srgb, var(--g) 70%, transparent)); animation: rd-shield-in .5s cubic-bezier(.34, 1.56, .64, 1) both; }
.rd-shield.is-off { filter: grayscale(.85) brightness(.7); }
@keyframes rd-shield-in { from { transform: scale(.6) rotate(-8deg); opacity: 0; } }
.rd-case-txt { min-width: 0; flex: 1; display: grid; gap: 3px; }
.rd-case-txt h3 { margin: 0; font-family: var(--font-shout, 'Barlow Condensed', sans-serif); font-weight: 800; font-style: italic; text-transform: uppercase; font-size: 28px; line-height: 1; color: var(--g); }
.rd-range { margin: 0; font-size: 13px; color: #94a3b8; }
.rd-state { margin: 2px 0 0; font-size: 13.5px; color: #e2e8f0; }
.rd-state b { color: #fcd34d; font-family: var(--font-bug, sans-serif); font-size: 16px; }
.rd-state.ok { color: #4ade80; font-weight: 600; }
.rd-bar { height: 8px; border-radius: 8px; background: rgba(255, 255, 255, .08); overflow: hidden; margin-top: 4px; }
.rd-bar i { display: block; height: 100%; border-radius: 8px; background: linear-gradient(90deg, #f59e0b, #fcd34d); transition: width .8s cubic-bezier(.16, 1, .3, 1); }
.rd-case h4 { margin: 14px 0 8px; font-family: var(--font-bug, sans-serif); font-weight: 800; text-transform: uppercase; letter-spacing: .12em; font-size: 12px; color: #8b93b8; }
.rd-row { display: flex; gap: 10px; overflow-x: auto; padding: 4px 2px 8px; scroll-snap-type: x proximity; }
.rd-row--s { gap: 8px; }
.rd-card { flex: none; display: grid; justify-items: center; gap: 4px; scroll-snap-align: start; animation: rd-card-in .4s cubic-bezier(.34, 1.56, .64, 1) calc(.08s * var(--k)) both; }
@keyframes rd-card-in { from { opacity: 0; transform: translateY(10px) scale(.9); } }
.rd-lv { font-family: var(--font-bug, sans-serif); font-weight: 800; font-size: 12px; color: #64748b; }
.rd-lv.ok { color: #4ade80; }
.rd-case-enter-active, .rd-case-leave-active { transition: opacity .18s ease, transform .18s ease; }
.rd-case-enter-from { opacity: 0; transform: translateY(8px); }
.rd-case-leave-to { opacity: 0; transform: translateY(-6px); }

.rd-foot { padding: 12px 16px 16px; border-top: 1px solid rgba(255, 255, 255, .06); }
.rd-play { width: 100%; border: 0; border-radius: 12px; padding: 13px; cursor: pointer; font-family: var(--font-bug, sans-serif); font-weight: 800; text-transform: uppercase; letter-spacing: .08em; font-size: 16px;
  background: linear-gradient(90deg, #f59e0b, #fcd34d); color: #141005; box-shadow: 0 8px 20px rgba(245, 158, 11, .3); transition: transform .12s, filter .2s; }
.rd-play:hover { filter: brightness(1.08); }
.rd-play:active { transform: scale(.98); }

@media (prefers-reduced-motion: reduce) {
  .rd-back, .rd, .rd-node, .rd-node.is-current img, .rd-shield, .rd-card { animation: none !important; }
}
</style>
