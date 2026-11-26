<script setup>
/**
 * CosmeticUnlockGroup — "Desbloqueaste N piezas": UNA sola pantalla para 2 o más
 * cosméticos que llegan juntos (logros, abono, tienda, colección, sobre, nivel sin escena).
 *
 *  · Carrusel: una carta grande por pieza, con swipe + scroll-snap, puntos y flechas
 *    (las flechas solo con mouse). Cada carta: rareza, nombre completo, de dónde salió
 *    y su EQUIPAR.
 *  · "Ver todas": grilla de 3 columnas con todas las piezas; tocar una vuelve al
 *    carrusel en esa pieza.
 *  · Entrada: la pieza de mayor rareza (la primera, ver CosmeticUnlockOverlay) abre con su
 *    escena de RarityReveal (temblor / apagón según rareza) y las demás entran en cascada.
 *  · Un solo LISTO cierra todo.
 */
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import PrizeCard from './PrizeCard.vue'
import RarityReveal from './RarityReveal.vue'
import { prizeFromCosmetic } from '@/services/prize-card'
import { rarityOf } from '@/services/rarity'
import { TYPE_LABEL } from '@/services/cosmetics'
import { reducedMotion } from '@/services/game-fx'
import { tap, success } from '@/services/haptics'

const props = defineProps({
  items: { type: Array, required: true },
  equipped: { type: Object, default: () => ({}) },
  busy: { type: Boolean, default: false },
})
const emit = defineEmits(['equip', 'close'])

const vw = ref(window.innerWidth)
const vh = ref(window.innerHeight)
function onResize() { vw.value = window.innerWidth; vh.value = window.innerHeight; nextTick(() => goTo(idx.value, false)) }

// Carta grande: entra a 375×664 con encabezado, datos, EQUIPAR, puntos y botonera.
const cardW = computed(() => Math.round(Math.max(130, Math.min(240, vw.value * 0.6, (vh.value - 350) / 1.4))))
const slideW = computed(() => Math.round(Math.min(vw.value * 0.76, cardW.value + 24)))
// Grilla: 3 columnas a 375 (4 desde 520 px)
const cols = computed(() => vw.value >= 520 ? 4 : 3)
const cellW = computed(() => Math.floor((Math.min(vw.value, 560) - 32 - (cols.value - 1) * 10) / cols.value))

const view = ref('carousel')   // 'carousel' | 'grid'
const idx = ref(0)
const introDone = ref(false)
// Después de la escena: el apagón y los rayos se apagan y recién ahí la pista recorta y
// se puede deslizar (si no, sus capas gigantes agrandan el área de scroll).
const settled = ref(false)
let settleTimer = 0
const track = ref(null)

const prizes = computed(() => props.items.map(prizeFromCosmetic))
function rarLabel(it) { return rarityOf(it.rarity).label }
function typeLabel(it) { return TYPE_LABEL[it.type] || (it.type === 'powerup' ? 'Ayuda' : 'Cosmético') }
function rarStyle(it) { return { '--rk': rarityOf(it.rarity).c } }

function onIntroDone() {
  introDone.value = true
  settleTimer = setTimeout(() => { settled.value = true }, reducedMotion ? 0 : 450)
}

let scrollRaf = 0
function onScroll() {
  if (scrollRaf) return
  scrollRaf = requestAnimationFrame(() => {
    scrollRaf = 0
    const el = track.value
    if (!el || view.value !== 'carousel') return
    const i = Math.max(0, Math.min(props.items.length - 1, Math.round(el.scrollLeft / slideW.value)))
    if (i !== idx.value) { idx.value = i; tap() }
  })
}
function goTo(i, smooth = true) {
  const el = track.value
  const n = Math.max(0, Math.min(props.items.length - 1, i))
  if (!el) { idx.value = n; return }
  el.scrollTo({ left: n * slideW.value, behavior: smooth && !reducedMotion ? 'smooth' : 'auto' })
  if (!smooth) idx.value = n
}
function prev() { goTo(idx.value - 1) }
function next() { goTo(idx.value + 1) }

function toggleView() {
  tap()
  if (view.value === 'carousel') { view.value = 'grid'; return }
  view.value = 'carousel'
  nextTick(() => goTo(idx.value, false))
}
function pick(i) {
  tap()
  idx.value = i
  view.value = 'carousel'
  introDone.value = true
  settled.value = true
  nextTick(() => goTo(i, false))
}

function onKey(e) {
  if (view.value !== 'carousel') return
  if (e.key === 'ArrowRight') { e.preventDefault(); next() }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); prev() }
}

// Piezas que llegan con la pantalla ya abierta (otro chequeo): entran al final, en cascada
watch(() => props.items.length, () => { if (idx.value > props.items.length - 1) idx.value = 0 })

onMounted(() => {
  window.addEventListener('resize', onResize)
  window.addEventListener('keydown', onKey)
  success()
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  window.removeEventListener('keydown', onKey)
  if (scrollRaf) cancelAnimationFrame(scrollRaf)
  clearTimeout(settleTimer)
})
</script>

<template>
  <div class="cg" :class="{ ready: introDone, settled, grid: view === 'grid' }" :style="{ '--cw': cardW + 'px', '--sw': slideW + 'px', '--gw': cellW + 'px', '--cols': cols }">
    <header class="cg-head">
      <p class="cg-kick">¡Nuevas piezas!</p>
      <h2 class="cg-title">Desbloqueaste <b>{{ items.length }}</b> piezas</h2>
    </header>

    <!-- CARRUSEL -->
    <div v-show="view === 'carousel'" class="cg-car">
      <div class="cg-stage">
      <div ref="track" class="cg-track" tabindex="-1" @scroll.passive="onScroll">
        <div
          v-for="(it, i) in items"
          :key="it.code"
          class="cg-slide"
          :class="{ on: i === idx }"
          :style="[{ '--i': Math.min(i, 8) }, rarStyle(it)]"
          :aria-hidden="i !== idx"
          role="group"
          :aria-label="`Pieza ${i + 1} de ${items.length}: ${it.name}`"
        >
          <div class="cg-cardbox">
            <RarityReveal v-if="i === 0" compact :size="cardW" :prize="prizes[i]" @revealed="onIntroDone" />
            <PrizeCard v-else :prize="prizes[i]" :size="cardW" :state="equipped[it.code] ? 'equipped' : 'new'" />
          </div>
          <div class="cg-info">
            <p class="cg-rar">{{ typeLabel(it) }} · {{ rarLabel(it) }}</p>
            <p class="cg-name">{{ it.name }}</p>
            <p v-if="it.reason" class="cg-why">{{ it.reason }}</p>
            <button
              v-if="it.type !== 'powerup'"
              type="button"
              class="cg-eq"
              :class="{ done: equipped[it.code] }"
              :disabled="busy || !!equipped[it.code]"
              :tabindex="i === idx ? 0 : -1"
              @click="emit('equip', it)"
            >{{ equipped[it.code] ? '✓ Equipado' : 'Equipar' }}</button>
          </div>
        </div>
      </div>
      <button type="button" class="cg-arrow prev" :disabled="idx === 0" aria-label="Pieza anterior" @click="prev">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
      </button>
      <button type="button" class="cg-arrow next" :disabled="idx >= items.length - 1" aria-label="Pieza siguiente" @click="next">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
      </button>
      </div>
      <div class="cg-dots" aria-hidden="true">
        <i v-for="(it, i) in items" :key="it.code" :class="{ on: i === idx }" :style="rarStyle(it)"></i>
      </div>
      <p class="sr-only" aria-live="polite">Pieza {{ idx + 1 }} de {{ items.length }}</p>
    </div>

    <!-- GRILLA -->
    <div v-if="view === 'grid'" class="cg-grid" role="list">
      <button
        v-for="(it, i) in items"
        :key="it.code"
        type="button"
        role="listitem"
        class="cg-cell"
        :class="{ on: i === idx }"
        :style="[{ '--i': Math.min(i, 12) }, rarStyle(it)]"
        :aria-label="`${it.name}, ${rarLabel(it)}`"
        @click="pick(i)"
      >
        <PrizeCard :prize="prizes[i]" :size="cellW" :state="equipped[it.code] ? 'equipped' : ''" />
        <span class="cg-cell-rar">{{ rarLabel(it) }}</span>
      </button>
    </div>

    <footer class="cg-foot">
      <button type="button" class="cg-btn ghost" @click="toggleView">{{ view === 'grid' ? 'Ver de a una' : 'Ver todas' }}</button>
      <button type="button" class="cg-btn" @click="emit('close')">Listo</button>
    </footer>
  </div>
</template>

<style scoped>
.cg {
  position: relative; z-index: 1; width: 100%; height: 100%; max-width: 560px; margin: 0 auto;
  display: flex; flex-direction: column; align-items: stretch;
  padding: calc(env(safe-area-inset-top, 0px) + 12px) calc(env(safe-area-inset-right, 0px) + 16px) calc(env(safe-area-inset-bottom, 0px) + 12px) calc(env(safe-area-inset-left, 0px) + 16px);
}
.cg-head { flex: none; text-align: center; opacity: 0; transform: translateY(-8px); transition: opacity .35s, transform .35s; }
.cg-kick { margin: 0; font-family: var(--font-bug); font-weight: 800; text-transform: uppercase; letter-spacing: .2em; font-size: 13px; color: #fcd34d; }
.cg-title { margin: 2px 0 0; font-family: var(--font-shout); font-weight: 800; font-style: italic; text-transform: uppercase; font-size: 27px; line-height: 1.05; color: #fff; letter-spacing: .01em; }
.cg-title b { color: #fcd34d; }

/* ── Carrusel ── */
.cg-car { position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; justify-content: center; margin: 0 calc(-16px - env(safe-area-inset-right, 0px)) 0 calc(-16px - env(safe-area-inset-left, 0px)); }
.cg-stage { position: relative; }
/* Mientras abre la escena la pista no recorta (el apagón y los rayos salen de la carta) */
.cg-track {
  display: flex; overflow: visible; touch-action: pan-x; outline: none;
  padding-inline: calc(50% - var(--sw) / 2);
  /* aire arriba y abajo para que el brillo de la carta no quede cortado por la pista */
  padding-block: 36px; margin-block: -36px;
  scrollbar-width: none; overscroll-behavior-x: contain; -webkit-overflow-scrolling: touch;
}
.cg.settled .cg-track { overflow-x: auto; overflow-y: hidden; scroll-snap-type: x mandatory; }
.cg-track::-webkit-scrollbar { display: none; }
.cg-slide { flex: none; width: var(--sw); scroll-snap-align: center; scroll-snap-stop: always; display: flex; flex-direction: column; align-items: center; gap: 14px; padding-top: 4px; }
.cg-cardbox { display: grid; place-items: center; width: var(--cw); transition: transform .3s cubic-bezier(.2, .9, .3, 1), opacity .3s; }
.cg.ready .cg-cardbox :deep(.rr-dim), .cg.ready .cg-cardbox :deep(.rr-rays) { opacity: 0 !important; transition: opacity .4s; }
.cg.settled .cg-cardbox :deep(.rr-dim), .cg.settled .cg-cardbox :deep(.rr-rays), .cg.settled .cg-cardbox :deep(.rr-flash) { display: none; }
/* El sello ÉPICA / LEGENDARIA es de la entrada: se va cuando la pantalla queda lista */
.cg.settled .cg-cardbox :deep(.rr-stamp) { opacity: 0 !important; transition: opacity .5s .9s; }
.cg-slide:not(.on) .cg-cardbox { transform: scale(.86); opacity: .55; }
.cg-slide:not(:first-child) { opacity: 0; transform: translateX(60px); }
.cg.ready .cg-slide:not(:first-child) { opacity: 1; transform: none; transition: opacity .4s ease, transform .5s cubic-bezier(.16, 1, .3, 1); transition-delay: calc(var(--i) * 70ms); }

.cg-info { width: 100%; padding: 0 10px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 3px; opacity: 0; transition: opacity .35s; }
.cg.ready .cg-slide.on .cg-info { opacity: 1; }
.cg.ready .cg-slide:not(.on) .cg-info { opacity: .35; }
.cg-rar { margin: 0; font-family: var(--font-bug); font-weight: 800; text-transform: uppercase; letter-spacing: .12em; font-size: 13px; color: var(--rk); }
.cg-name { margin: 0; font-family: var(--font-bug); font-weight: 800; text-transform: uppercase; font-size: 21px; line-height: 1.05; color: #fff; text-wrap: balance; overflow-wrap: anywhere; }
.cg-why { margin: 0; font-size: 13px; line-height: 1.3; color: #c5cbe8; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.cg-eq { margin-top: 5px; min-height: 44px; min-width: 132px; padding: 0 22px; border-radius: 12px; cursor: pointer;
  font-family: var(--font-bug); font-weight: 800; text-transform: uppercase; letter-spacing: .1em; font-size: 15px;
  color: #fff; background: rgba(255, 255, 255, .08); border: 1px solid color-mix(in srgb, var(--rk) 55%, transparent); }
.cg-eq.done { color: #86efac; border-color: rgba(134, 239, 172, .45); }
.cg-eq:disabled { cursor: default; }
.cg-eq:not(:disabled):active { transform: scale(.96); }

.cg-arrow { display: none; }
@media (hover: hover) and (pointer: fine) {
  .cg-arrow { display: grid; place-items: center; position: absolute; top: calc(40px + var(--cw) * .7); transform: translateY(-50%); width: 44px; height: 44px; border-radius: 50%; z-index: 4; cursor: pointer;
    background: rgba(10, 14, 34, .78); border: 1px solid rgba(255, 255, 255, .2); color: #fff; opacity: 0; transition: opacity .3s, background .2s; }
  .cg.ready .cg-arrow { opacity: 1; }
  .cg.ready .cg-arrow:disabled { opacity: .25; cursor: default; }
  .cg-arrow:not(:disabled):hover { background: rgba(40, 50, 100, .9); }
  .cg-arrow.prev { left: max(8px, calc(50% - var(--sw) / 2 - 22px)); }
  .cg-arrow.next { right: max(8px, calc(50% - var(--sw) / 2 - 22px)); }
  .cg-arrow svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round; }
}

.cg-dots { flex: none; display: flex; flex-wrap: wrap; justify-content: center; gap: 5px; padding: 10px 24px 0; opacity: 0; transition: opacity .35s; }
.cg.ready .cg-dots { opacity: 1; }
.cg-dots i { width: 6px; height: 6px; border-radius: 3px; background: rgba(255, 255, 255, .25); transition: width .25s, background .25s; }
.cg-dots i.on { width: 18px; background: var(--rk); }

/* ── Grilla ── */
.cg-grid { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; margin: 12px -4px 0; padding: 4px 4px 12px;
  display: grid; grid-template-columns: repeat(var(--cols), var(--gw)); justify-content: center; align-content: start; gap: 12px 10px;
  -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 12px, #000 calc(100% - 14px), transparent); mask-image: linear-gradient(to bottom, transparent 0, #000 12px, #000 calc(100% - 14px), transparent); }
.cg-cell { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 0; border: 0; background: none; cursor: pointer; color: inherit; border-radius: 12px;
  animation: cg-pop .35s cubic-bezier(.2, 1.3, .4, 1) both; animation-delay: calc(var(--i) * 30ms); }
.cg-cell.on :deep(.pcard) { box-shadow: 0 0 0 2px #fff, 0 0 18px var(--rk); }
.cg-cell:active { transform: scale(.96); }
.cg-cell-rar { font-family: var(--font-bug); font-weight: 800; text-transform: uppercase; letter-spacing: .1em; font-size: 12px; color: var(--rk); }
@keyframes cg-pop { from { opacity: 0; transform: scale(.85) translateY(8px); } to { opacity: 1; transform: none; } }

/* ── Botonera ── */
.cg-foot { flex: none; display: flex; gap: 10px; padding-top: 12px; opacity: 0; transition: opacity .35s; }
.cg-btn { flex: 1; min-height: 48px; border-radius: 14px; border: 0; cursor: pointer;
  font-family: var(--font-bug); font-weight: 800; text-transform: uppercase; letter-spacing: .1em; font-size: 17px;
  color: #141005; background: linear-gradient(180deg, #fde68a, #f59e0b); box-shadow: 0 10px 26px rgba(245, 158, 11, .35); }
.cg-btn.ghost { color: #fff; background: rgba(255, 255, 255, .08); border: 1px solid rgba(255, 255, 255, .18); box-shadow: none; }
.cg-btn:active { transform: scale(.97); }

.cg.ready .cg-head, .cg.ready .cg-foot { opacity: 1; transform: none; }
.cg:not(.ready) .cg-foot { pointer-events: none; }

.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

@media (prefers-reduced-motion: reduce) {
  .cg-head, .cg-foot, .cg-dots, .cg-info, .cg-cardbox, .cg-arrow { transition: opacity .12s; }
  .cg-slide:not(:first-child), .cg.ready .cg-slide:not(:first-child) { transform: none; transition: opacity .12s; transition-delay: 0s; }
  .cg.ready .cg-cardbox :deep(.rr-dim), .cg.ready .cg-cardbox :deep(.rr-rays) { opacity: 0 !important; transition: opacity .4s; }
.cg.settled .cg-cardbox :deep(.rr-dim), .cg.settled .cg-cardbox :deep(.rr-rays), .cg.settled .cg-cardbox :deep(.rr-flash) { display: none; }
/* El sello ÉPICA / LEGENDARIA es de la entrada: se va cuando la pantalla queda lista */
.cg.settled .cg-cardbox :deep(.rr-stamp) { opacity: 0 !important; transition: opacity .5s .9s; }
.cg-slide:not(.on) .cg-cardbox { transform: none; }
  .cg-head { transform: none; }
  .cg-cell { animation: none; }
}
</style>
