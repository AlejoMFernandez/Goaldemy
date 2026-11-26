<script setup>
/**
 * BannerScene — el banner equipado (fondo + capas). Fuente única de banners: perfil,
 * hover card, vestuario, PrizeCard, PassCosmetic, escenas de desbloqueo.
 *
 * · Banners viejos: una clase de fondo (.bnr-*), sin capas — siguen funcionando igual.
 * · Banners del vestuario nuevo: fondo + capas dibujadas como en docs/vestuario/moodboard.html.
 *   Las capas viven en un escenario de 300×120 escalado por altura (--k) y pegado a la
 *   derecha; lluvia, papelitos y pasto del "en vivo" ocupan todo el ancho.
 *
 * Movimiento: `animate=false` o prefers-reduced-motion → cuadro quieto; fuera de pantalla
 * las animaciones se pausan (IntersectionObserver). El tamaño lo pone quien lo usa
 * (class="h-36 …"); el contenido del slot va encima de las capas.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { bannerStyle, isSceneBanner } from '../../services/cosmetics'

const props = defineProps({
  styleKey: { type: String, default: 'default' },
  premium: { type: Boolean, default: false }, // banners viejos: gradiente que se mueve (PRO)
  animate: { type: Boolean, default: true },
  score: { type: String, default: '3 - 0' },  // "Marcador del estadio"
  // Banner de ancho completo (perfil): el dibujo se ancla al borde derecho de la COLUMNA de
  // contenido (el padre, menos su padding), no al de la pantalla, y en lg+ nunca queda a menos
  // de `edgeGap` px del borde de la ventana (ahí vive la barra de amigos: 58 px + right-5).
  contain: { type: Boolean, default: false },
  edgeGap: { type: Number, default: 96 },
})

// El dibujo escala por alto y no ocupa más de este % del ancho del banner (modo contain).
const SCENE_MAX_SHARE = 0.6
const SCENE_WIDE_MIN = 600 // px de ancho desde donde se aplica el tope

const el = ref(null)
const scene = computed(() => isSceneBanner(props.styleKey))
const k = ref(1)
const bh = ref(120)
const ready = ref(false)
const onScreen = ref(true)
const reduced = ref(false)
const still = computed(() => !props.animate || reduced.value)
const right = ref(0) // px entre el dibujo y el borde derecho del banner
const boxStyle = computed(() => scene.value ? { '--k': k.value.toFixed(4), '--bh': bh.value + 'px', '--bs-right': right.value.toFixed(1) + 'px' } : undefined)

let ro = null
let io = null
let mq = null
const onMq = () => { reduced.value = !!mq?.matches }

function measure() {
  const h = el.value?.clientHeight || 0
  if (!h) return
  bh.value = h
  let scale = h / 120
  let gap = 0
  if (props.contain) {
    const r = el.value.getBoundingClientRect()
    const parent = el.value.parentElement
    const pr = parent?.getBoundingClientRect()
    const padR = parent ? parseFloat(getComputedStyle(parent).paddingRight) || 0 : 0
    const vw = document.documentElement.clientWidth // sin la barra de scroll
    const colRight = pr ? pr.right - padR : r.right
    const edge = vw >= 1024 ? vw - props.edgeGap : vw // lg+: lejos de la barra de amigos
    gap = Math.max(0, r.right - Math.min(colRight, edge))
    // por alto, sin deformar, y en banners anchos (desktop) sin pasar del 60 % del ancho.
    // En el celu (banner de ~390 px) el tope achicaba el dibujo y lo dejaba cortado a mitad
    // de alto: ahí manda el alto, como en el moodboard.
    if (r.width >= SCENE_WIDE_MIN) scale = Math.min(scale, (r.width * SCENE_MAX_SHARE) / 300)
  }
  k.value = scale
  right.value = gap
  ready.value = true
}

onMounted(() => {
  try { mq = window.matchMedia('(prefers-reduced-motion: reduce)'); onMq(); mq.addEventListener?.('change', onMq) } catch { /* sin matchMedia */ }
  // Siempre se miden y observan, aunque hoy el banner sea el 'default': en el perfil el banner
  // equipado llega async y pasa a ser de escena DESPUÉS de montar (antes quedaba sin medir y
  // .bs:not(.bs-ready) escondía las capas: banner en color plano).
  if (!el.value) return
  measure()
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(measure)
    ro.observe(el.value)
    if (props.contain && el.value.parentElement) ro.observe(el.value.parentElement)
  }
  if (props.contain) window.addEventListener('resize', measure)
  if (typeof IntersectionObserver !== 'undefined') {
    io = new IntersectionObserver(([e]) => { onScreen.value = e.isIntersecting })
    io.observe(el.value)
  }
})
// Si el banner cambia (dato async, equipar en el vestuario), volver a medir cuando el DOM ya cambió.
watch(() => props.styleKey, () => nextTick(measure))
onBeforeUnmount(() => {
  ro?.disconnect(); io?.disconnect()
  window.removeEventListener('resize', measure)
  try { mq?.removeEventListener?.('change', onMq) } catch { /* noop */ }
  stopClock()
})

// ── Reloj del "En vivo": un solo intervalo compartido por todos los banners ──
const clock = ref('89:40')
const wantsClock = computed(() => props.styleKey === 'live' && !still.value && onScreen.value)
watch(wantsClock, (v) => { v ? startClock() : stopClock() }, { immediate: true })
function startClock() { if (!_subs.has(clock)) { _subs.add(clock); tickStart() } }
function stopClock() { if (_subs.delete(clock)) tickStop() }

// ── Datos de las capas (mismos que el JS del moodboard) ──
const passNodes = [[150, 60], [195, 28], [195, 92], [240, 48], [240, 80], [282, 60]]
const passLinks = [[0, 1], [0, 2], [1, 3], [2, 4], [3, 4], [3, 5], [4, 5], [1, 2]]
const waveBars = Array.from({ length: 30 }, (_, i) => ({ delay: -(((i * 37) % 11) / 10), dur: 0.6 + ((i * 13) % 7) / 10 }))
const papers = Array.from({ length: 36 }, (_, i) => ({
  left: (i * 97) % 100, dur: 2 + ((i * 7) % 10) / 5, delay: -(((i * 13) % 30) / 10), bg: i % 4 ? '#f8fafc' : '#7dd3fc',
}))
const towers = [46, 61, 76, 91]
</script>

<script>
// Módulo (compartido entre instancias): reloj del banner "En vivo" (89:40 → 90:59 en loop)
const _subs = new Set()
let _timer = null
let _sec = 5380
const _fmt = (s) => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0')
function tickStart() {
  if (_timer) return
  _timer = setInterval(() => {
    _sec = _sec >= 5459 ? 5380 : _sec + 1
    for (const r of _subs) r.value = _fmt(_sec)
  }, 1000)
}
function tickStop() {
  if (_subs.size === 0 && _timer) { clearInterval(_timer); _timer = null }
}
</script>

<template>
  <div
    ref="el"
    class="bs"
    :class="[bannerStyle(styleKey), premium && !scene ? 'anim-pan' : '', scene && ready ? 'bs-ready' : '', scene && (still || !onScreen) ? (still ? 'bs-still' : 'bs-off') : '']"
    :style="boxStyle"
  >
    <template v-if="scene">
      <!-- capas de atmósfera: todo el ancho -->
      <div v-if="styleKey === 'live'" class="bs-fill"><div class="bs-live-fx"></div></div>
      <div v-else-if="styleKey === 'rain'" class="bs-fill"><div class="bs-rain-fx"></div></div>
      <!-- patrón que continúa hacia la izquierda (banners anchos) -->
      <div v-else-if="['leather', 'newspaper', 'passmap', 'commentary'].includes(styleKey)" class="bs-fill bs-lead" :class="styleKey === 'leather' ? 'bs-lead-nofade' : ''"><div :class="'bs-lead-' + styleKey"></div></div>
      <div v-else-if="styleKey === 'ticker_tape'" class="bs-fill bs-paper">
        <i v-for="(p, i) in papers" :key="i" :style="{ left: p.left + '%', animationDuration: p.dur + 's', animationDelay: p.delay + 's', background: p.bg }"></i>
      </div>

      <!-- escenario 300×120 -->
      <div class="bs-stage" aria-hidden="true">
        <div v-if="styleKey === 'mowed'" class="bs-mowed-fx"></div>

        <template v-else-if="styleKey === 'penalty'">
          <div class="bs-area"></div><div class="bs-arc"></div><div class="bs-ball"></div>
        </template>

        <svg v-else-if="styleKey === 'leather'" class="bs-svg" viewBox="0 0 300 120" preserveAspectRatio="none">
          <g stroke="#f5deb3" stroke-width="1.6" stroke-dasharray="5 4" opacity=".75"><path d="M110 0v120M170 0v120M230 0v120" /><path d="M0 60h110M170 40h60M230 80h70" /></g>
          <g stroke="rgba(0,0,0,.35)" stroke-width="3"><path d="M107 0v120M167 0v120M227 0v120" /></g>
          <path d="M250 24l14 8-14 8 14 8-14 8 14 8-14 8 14 8" fill="none" stroke="#f5deb3" stroke-width="4" stroke-linejoin="round" />
        </svg>

        <div v-else-if="styleKey === 'scoreboard'" class="bs-score">{{ score }}</div>

        <template v-else-if="styleKey === 'away_kit'">
          <div class="bs-band"></div><div class="bs-num">10</div>
        </template>

        <template v-else-if="styleKey === 'live'">
          <div class="bs-bug"><span class="lv">EN VIVO</span><span class="sc">2 - 1</span><span class="clk">{{ clock }}</span></div>
          <div class="bs-lt"></div>
        </template>

        <template v-else-if="styleKey === 'var'">
          <div class="bs-zone"></div><div class="bs-vt">VAR · REVISANDO</div>
        </template>

        <svg v-else-if="styleKey === 'tactics'" class="bs-svg" viewBox="0 0 300 120" preserveAspectRatio="none" style="opacity:.8">
          <g fill="none" stroke="#e7f5ee" stroke-width="2.2" stroke-linecap="round">
            <circle cx="170" cy="36" r="8" /><circle cx="210" cy="84" r="8" />
            <path d="M240 28l12 12m0-12-12 12M262 70l12 12m0-12-12 12" />
            <path d="M178 42q24 18 26 34" stroke-dasharray="5 5" />
            <path d="M218 80q20-4 34-34" /><path d="M248 50l4-6 3 7" />
          </g>
        </svg>

        <template v-else-if="styleKey === 'newspaper'">
          <div class="bs-hd"><small>DEPORTES · EDICIÓN DEL DÍA</small>¡GOLEADA!</div><div class="bs-cl"></div>
        </template>

        <div v-else-if="styleKey === 'rain'" class="bs-cone"></div>

        <template v-else-if="styleKey === 'heatmap'">
          <div class="bs-heat"></div><div class="bs-pitch"></div>
        </template>

        <template v-else-if="styleKey === 'lights'">
          <div v-for="(l, i) in towers" :key="l" class="bs-tw" :style="{ left: l + '%', animationDelay: i * 0.35 + 's' }"></div>
        </template>

        <svg v-else-if="styleKey === 'passmap'" class="bs-svg" viewBox="0 0 300 120">
          <line v-for="([a, b], i) in passLinks" :key="'l' + i" class="bs-lk" :x1="passNodes[a][0]" :y1="passNodes[a][1]" :x2="passNodes[b][0]" :y2="passNodes[b][1]" />
          <circle v-for="([x, y], i) in passNodes" :key="'n' + i" :cx="x" :cy="y" :r="i === 3 ? 7 : 5" fill="#e0f2fe" style="filter:drop-shadow(0 0 4px #22d3ee)" />
        </svg>

        <template v-else-if="styleKey === 'commentary'">
          <div class="bs-gol">GOOOOL</div>
          <div class="bs-wave"><i v-for="(b, i) in waveBars" :key="i" :style="{ animationDelay: b.delay + 's', animationDuration: b.dur + 's' }"></i></div>
        </template>
      </div>
    </template>
    <slot />
  </div>
</template>
