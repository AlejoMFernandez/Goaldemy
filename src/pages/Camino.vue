<script setup>
/**
 * EL CAMINO (diseño V4 · V4Camino.dc.html) — /camino
 * Los 11 rangos de abajo (Aficionado) hacia arriba (GOAT) unidos por una ruta:
 * lo recorrido en dorado, dónde estás con un pin, lo que viene apagado.
 * Abajo, qué ganás al llegar al rango elegido (por defecto, el próximo):
 * el kit real del rango (ícono, borde y banner de public/cosmetics/rank/) + el título del
 * camino de su colección. Escudos: public/badges/<rango>.svg (rangos-100).
 * Tocás cualquier escudo y la tarjeta de abajo cambia a ese rango.
 * Nivel: del shell (shellState.stats). Invitado → nivel 1.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { TIERS, getTierForLevel, tierGlow, TIER_RARITY } from '../services/tiers'
import { getCollectionForTier } from '../data/collections'
import { tierPrizes } from '../services/prize-card'
import { RARITY, rarityOf } from '../services/rarity'
import { shellState, loadShellStats } from '../components/shell/shell-state'
import { tap } from '../services/haptics'
import { pieceRarity, hexA } from '../components/collection/piece-style'

const router = useRouter()

// Plano del diseño (390×624): x/y del centro de cada escudo, de Aficionado a GOAT.
const W = 390, H = 624
const XS = [150, 250, 120, 255, 135, 260, 125, 255, 130, 250, 195]
const YS = [590, 525, 425, 322, 278, 236, 196, 158, 120, 80, 34]
// Leyenda: la rareza de las piezas sube con la carrera (Camino 1–100)
const LEGEND = ['common', 'rare', 'epic', 'legendary'].map(k => ({ label: RARITY[k].label, color: RARITY[k].c }))

const level = computed(() => Math.max(1, Number(shellState.stats.level) || 1))
const cur = computed(() => Math.max(0, TIERS.findIndex(t => t.key === getTierForLevel(level.value)?.key)))
const curTier = computed(() => TIERS[cur.value])
const nextTier = computed(() => TIERS[cur.value + 1] || null)

function range(t) { return t.minLevel === t.maxLevel ? `Nv ${t.minLevel}` : `Nv ${t.minLevel}–${t.maxLevel}` }

const nodes = computed(() => TIERS.map((t, i) => {
  const done = i < cur.value
  const isCur = i === cur.value
  const next = i === cur.value + 1
  const goat = i === TIERS.length - 1
  const w = goat ? 42 : (next ? 38 : 34)
  const right = XS[i] >= 195
  const rar = rarityOf(TIER_RARITY[t.key])
  return {
    i, t, done, isCur, next, goat, w, right,
    x: XS[i], y: YS[i],
    sub: done ? `${range(t)} · listo` : `Nv ${t.minLevel} · ${rar.label.toLowerCase()}`,
    nameColor: done ? '#e2e8f0' : next ? '#5eead4' : goat ? '#f5d0fe' : '#64748b',
    subColor: done ? '#4ade80' : next ? '#99f6e4' : '#475569',
    aria: `${t.label}, ${done ? 'completado' : isCur ? 'tu rango actual' : 'se desbloquea en nivel ' + t.minLevel}`,
  }
}))

// Ruta: curvas suaves de un escudo al siguiente (igual que el diseño)
function curve(from, to) {
  if (to <= from) return ''
  let s = `M ${XS[from]} ${YS[from]}`
  for (let i = from; i < to; i++) {
    const my = (YS[i] + YS[i + 1]) / 2
    s += ` C ${XS[i]} ${my}, ${XS[i + 1]} ${my}, ${XS[i + 1]} ${YS[i + 1]}`
  }
  return s
}
const pathAll = curve(0, TIERS.length - 1)
const pathDone = computed(() => curve(0, cur.value))
const pathTodo = computed(() => curve(cur.value, TIERS.length - 1))

// Tarjeta del rango actual (al lado del pin)
const curPct = computed(() => {
  const t = curTier.value
  if (!t || !nextTier.value) return 100
  const span = Math.max(1, t.maxLevel - t.minLevel + 1)
  return Math.round(Math.min(1, Math.max(0, (level.value - t.minLevel) / span)) * 100)
})
const levelsLeft = computed(() => nextTier.value ? Math.max(0, nextTier.value.minLevel - level.value) : 0)
// Tarjeta del rango actual: se busca un lugar libre (sin pisar escudos, rótulos,
// el pin ni el escudo propio). Coordenadas del plano (W×H); tamaño fijo de la tarjeta.
const CARD_W = 198, CARD_H = 88
function hit(a, b) {
  const w = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1), h = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1)
  return w > 0 && h > 0 ? w * h : 0
}
const cardPos = computed(() => {
  const i = cur.value, cx = XS[i], cy = YS[i]
  const obs = [
    { x1: cx - 48, x2: cx + 48, y1: cy - 48, y2: cy + 48 },          // tu escudo (88px + aro)
    cy < 80 ? { x1: cx - 52, x2: cx + 52, y1: cy + 42, y2: cy + 78 } : { x1: cx - 52, x2: cx + 52, y1: cy - 78, y2: cy - 42 }, // "ESTÁS ACÁ"
  ]
  for (const n of nodes.value) {
    if (n.isCur) continue
    const r = n.w / 2 + 6
    obs.push({ x1: n.x - r, x2: n.x + r, y1: n.y - r - 4, y2: n.y + r + 4 })
    const lx = n.right ? n.x + n.w / 2 + 8 : n.x - n.w / 2 - 8 - 108
    obs.push({ x1: lx, x2: lx + 108, y1: n.y - 17, y2: n.y + 19 })
  }
  // Barrido del plano: el lugar libre más cercano a tu escudo. Si no hay ninguno,
  // la tarjeta baja abajo del mapa (en el flujo), así nunca tapa nada.
  let best = null
  for (let y = 4; y <= H - 4 - CARD_H; y += 4) {
    for (let x = 6; x <= W - 6 - CARD_W; x += 4) {
      const r = { x1: x, x2: x + CARD_W, y1: y, y2: y + CARD_H }
      if (obs.some(o => hit(r, o))) continue
      const d = Math.hypot(x + CARD_W / 2 - cx, y + CARD_H / 2 - cy)
      if (d < 190 && (!best || d < best.d)) best = { x, y, d }
    }
  }
  return best
})
const pct = (v, total) => (v / total * 100) + '%'

// ── Tarjeta de premios (por defecto: el próximo rango) ──
const selected = ref(null)
watch(cur, () => { selected.value = null })
const selIdx = computed(() => selected.value ?? Math.min(TIERS.length - 1, cur.value + 1))
const sel = computed(() => TIERS[selIdx.value])
const selState = computed(() => selIdx.value < cur.value ? 'done' : selIdx.value === cur.value ? 'current' : 'locked')
const prizes = computed(() => {
  const t = sel.value
  // Kit de rango (arte de rangos-100): ícono, borde y banner
  const ART = { icon: t.kit.icon, frame: t.kit.border, banner: t.kit.banner }
  const ORDER = { icon: 0, frame: 1, banner: 2 }
  const kit = tierPrizes(t).map(p => ({ ...p, part: p.kind, src: ART[p.kind], rar: pieceRarity(p.rarity) })).sort((a, b) => ORDER[a.part] - ORDER[b.part])
  const col = getCollectionForTier(t.key)
  const title = (col?.pieces || []).find(p => p.route === 'camino' && p.kind === 'title')
  if (title) kit.push({ kind: 'title', part: 'title', name: title.name, rarity: title.rarity, rar: pieceRarity(title.rarity), label: 'Título' })
  return kit
})
const selHeading = computed(() => {
  if (selState.value === 'done') return `Ganaste en ${sel.value.label}`
  if (selState.value === 'current') return `Ganaste al llegar a ${sel.value.label}`
  return `Al llegar a ${sel.value.label} ganás`
})
const selColor = computed(() => tierGlow(sel.value))
function pick(i) { tap(); selected.value = i }
function shortName(p) {
  if (p.part === 'icon') return `Ícono de rango`
  if (p.part === 'frame') return `Borde ${sel.value.label}`
  if (p.part === 'banner') return `Banner ${sel.value.label}`
  return p.name
}
function goBack() { tap(); if (window.history.length > 1) router.back(); else router.push('/profile') }

onMounted(() => { loadShellStats().catch(() => {}) })
</script>

<template>
  <section class="camino relative -mx-6 -mt-10 lg:mx-auto lg:mt-0 max-w-[430px] lg:max-w-[430px] pb-4">
    <div class="camino-bg pointer-events-none absolute inset-0" aria-hidden="true"></div>

    <header class="relative h-[76px] px-3 pt-2.5 flex items-start gap-2">
      <button type="button" aria-label="Volver" class="w-11 h-11 shrink-0 rounded-[14px] bg-white/5 border border-white/[0.08] text-white grid place-items-center active:scale-95 transition" @click="goBack">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
      </button>
      <div class="flex-1 min-w-0 flex flex-col gap-1 pt-0.5">
        <h1 class="m-0 font-display font-bold text-[21px] leading-none">El camino</h1>
        <span class="flex items-center gap-2 flex-wrap text-[10.5px] font-bold text-slate-400">
          <span v-for="l in LEGEND" :key="l.label" class="flex items-center gap-[3px]"><span class="w-2 h-2 rounded-full block" :style="{ background: l.color }"></span>{{ l.label }}</span>
        </span>
      </div>
      <span class="cm-lvl mt-[7px]">NV {{ level }}</span>
    </header>

    <!-- Mapa -->
    <section aria-label="Mapa de rangos, de Aficionado a GOAT" class="relative w-full" :style="{ aspectRatio: `${W} / ${H}` }">
      <svg class="absolute inset-0 w-full h-full" :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" aria-hidden="true">
        <path :d="pathAll" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="18" stroke-linecap="round" />
        <path v-if="pathTodo" :d="pathTodo" fill="none" stroke="#334155" stroke-width="3" stroke-linecap="round" stroke-dasharray="2 9" />
        <path v-if="pathDone" :d="pathDone" fill="none" stroke="#f59e0b" stroke-width="12" stroke-linecap="round" opacity="0.25" />
        <path v-if="pathDone" class="cm-done" :d="pathDone" fill="none" stroke="#fbbf24" stroke-width="4" stroke-linecap="round" pathLength="1" />
      </svg>

      <template v-for="n in nodes" :key="n.t.key">
        <template v-if="!n.isCur">
          <button type="button" class="cm-node" :class="{ 'is-sel': selIdx === n.i }" :aria-label="n.aria" :aria-pressed="selIdx === n.i"
            :style="{ left: pct(n.x, W), top: pct(n.y, H), width: n.w + 'px' }" @click="pick(n.i)">
            <span v-if="n.goat" class="cm-goat" aria-hidden="true"></span>
            <span v-if="n.next" class="cm-next" aria-hidden="true"></span>
            <img :src="n.t.image" alt="" :width="n.w" :height="Math.round(n.w * 140 / 120)" class="relative block h-auto" :style="{ width: n.w + 'px' }" :class="n.done ? 'drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]' : 'cm-off'" />
            <span class="cm-badge" :class="n.done ? 'is-done' : ''" aria-hidden="true">
              <svg v-if="n.done" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
              <svg v-else width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="3" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></svg>
            </span>
          </button>
          <span class="cm-label" :class="n.right ? 'is-right' : 'is-left'" :style="{ left: `calc(${pct(n.x, W)} ${n.right ? '+' : '-'} ${n.w / 2 + 12}px)`, top: `calc(${pct(n.y, H)} - 15px)` }" aria-hidden="true">
            <span class="cm-name" :style="{ color: n.nameColor }">{{ n.t.label }}</span>
            <span class="cm-sub" :style="{ color: n.subColor }">{{ n.sub }}</span>
          </span>
        </template>
      </template>

      <!-- Estás acá -->
      <div class="cm-pin" :class="{ 'is-below': YS[cur] < 80 }" :style="{ left: pct(XS[cur], W), top: YS[cur] < 80 ? `calc(${pct(YS[cur], H)} + 46px)` : `calc(${pct(YS[cur], H)} - 73px)` }" aria-hidden="true">
        <span class="cm-pin-tag">ESTÁS ACÁ</span>
        <span class="cm-pin-tip"></span>
      </div>
      <button type="button" class="cm-here" :style="{ left: pct(XS[cur], W), top: pct(YS[cur], H) }" :aria-label="`Tu rango actual: ${curTier.label}, nivel ${level}`" @click="pick(cur)">
        <span class="cm-here-in"><img :src="curTier.image" alt="" width="54" height="63" class="w-[54px] h-auto drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)]" /></span>
      </button>
      <div v-if="cardPos" class="cm-card" :style="{ top: pct(cardPos.y, H), left: pct(cardPos.x, W), width: pct(CARD_W, W) }">
        <span class="flex items-baseline justify-between gap-2">
          <span class="font-bug font-extrabold text-xl leading-none tracking-[0.4px] text-amber-200 uppercase truncate">{{ curTier.label }}</span>
          <span class="font-bug font-bold text-[13px] text-slate-400 whitespace-nowrap">{{ range(curTier) }}</span>
        </span>
        <span class="relative h-3.5 rounded-full bg-white/[0.08] overflow-hidden block" role="progressbar" :aria-valuenow="curPct" aria-valuemin="0" aria-valuemax="100" :aria-label="`Avance en ${curTier.label}`">
          <span class="cm-fill block h-full rounded-full" :style="{ width: curPct + '%' }"></span>
        </span>
        <span class="flex justify-between gap-1 text-[11.5px] font-bold">
          <span class="text-slate-200">Nv {{ level }}</span>
          <span v-if="nextTier" class="text-slate-400 text-right">{{ levelsLeft }} {{ levelsLeft === 1 ? 'nivel' : 'niveles' }} a <span class="text-teal-300">{{ nextTier.label }}</span></span>
          <span v-else class="text-pink-200">¡Llegaste a la cima!</span>
        </span>
      </div>
    </section>
    <!-- Sin lugar libre en el mapa: la tarjeta va abajo, sin tapar nada -->
    <div v-if="!cardPos" class="cm-card is-flow relative mx-3 mb-4">
      <span class="flex items-baseline justify-between gap-2">
        <span class="font-bug font-extrabold text-xl leading-none tracking-[0.4px] text-amber-200 uppercase truncate">{{ curTier.label }}</span>
        <span class="font-bug font-bold text-[13px] text-slate-400 whitespace-nowrap">{{ range(curTier) }}</span>
      </span>
      <span class="relative h-3.5 rounded-full bg-white/[0.08] overflow-hidden block" role="progressbar" :aria-valuenow="curPct" aria-valuemin="0" aria-valuemax="100" :aria-label="`Avance en ${curTier.label}`">
        <span class="cm-fill block h-full rounded-full" :style="{ width: curPct + '%' }"></span>
      </span>
      <span class="flex justify-between gap-1 text-[11.5px] font-bold">
        <span class="text-slate-200">Nv {{ level }}</span>
        <span v-if="nextTier" class="text-slate-400 text-right">{{ levelsLeft }} {{ levelsLeft === 1 ? 'nivel' : 'niveles' }} a <span class="text-teal-300">{{ nextTier.label }}</span></span>
        <span v-else class="text-pink-200">¡Llegaste a la cima!</span>
      </span>
    </div>

    <!-- Premios del rango elegido -->
    <section :aria-label="`Premios de ${sel.label}`" class="cm-prizes relative mx-3 -mt-2 flex flex-col gap-2.5" aria-live="polite">
      <div class="flex items-center justify-between gap-2">
        <span class="font-display font-bold text-base">{{ selHeading }}</span>
        <span class="font-bug font-extrabold text-sm whitespace-nowrap" :style="{ color: selColor }">NV {{ sel.minLevel }}</span>
      </div>
      <div class="grid grid-cols-4 gap-2">
        <div v-for="p in prizes" :key="p.part" class="cm-prize" :class="selState === 'locked' ? 'is-locked' : ''">
          <span class="h-10 w-full flex items-center justify-center overflow-hidden">
            <img v-if="p.src" :src="p.src" :alt="p.name" class="cm-art" :class="'is-' + p.part" />
            <span v-else class="cm-title" :style="{ background: hexA(p.rar.c, 0.18), borderColor: hexA(p.rar.c, 0.6), color: p.rar.t }">{{ p.name.toUpperCase() }}</span>
          </span>
          <span class="text-[11px] font-bold text-center leading-[1.15]">{{ shortName(p) }}</span>
          <span class="font-bug font-bold text-[11px]" :style="{ color: p.rar.c }">{{ p.rar.label.toLowerCase() }}</span>
        </div>
      </div>
    </section>
  </section>
</template>

<style scoped>
.camino-bg { background: radial-gradient(70% 30% at 50% 4%, rgba(217, 70, 239, 0.16), transparent 70%), radial-gradient(80% 30% at 30% 52%, rgba(245, 158, 11, 0.12), transparent 70%); }
.font-bug { font-family: var(--font-bug); }
.cm-lvl {
  height: 30px; padding: 0 10px; border-radius: 8px; background: linear-gradient(180deg, #818cf8, #4f46e5); border: 1.5px solid #c7d2fe;
  display: flex; align-items: center; font-family: var(--font-bug); font-weight: 800; font-size: 18px; white-space: nowrap;
}
.cm-done { stroke-dasharray: 1; stroke-dashoffset: 1; animation: cmdraw 1.1s cubic-bezier(0.16, 1, 0.3, 1) 0.2s forwards; }
@keyframes cmdraw { to { stroke-dashoffset: 0; } }
.cm-node {
  position: absolute; transform: translate(-50%, -50%); padding: 0; border: 0; background: none; cursor: pointer;
  min-width: 44px; min-height: 44px; display: flex; align-items: center; justify-content: center;
}
.cm-node.is-sel::before { content: ''; position: absolute; inset: -4px; border-radius: 50%; background: rgba(255, 255, 255, 0.07); }
.cm-goat {
  position: absolute; left: -12px; top: -10px; right: -12px; bottom: -10px; border-radius: 50%;
  background: conic-gradient(from 0deg, #f0abfc, #67e8f9, #fde68a, #86efac, #f0abfc); filter: blur(8px); opacity: 0.55;
}
.cm-next { position: absolute; left: -4px; top: -3px; right: -4px; bottom: -3px; border-radius: 50%; border: 2px dashed rgba(251, 191, 36, 0.6); }
.cm-badge {
  position: absolute; right: -2px; bottom: 0; width: 18px; height: 18px; box-sizing: border-box; border-radius: 50%;
  background: #1e293b; border: 2px solid #0b1220; display: flex; align-items: center; justify-content: center;
}
.cm-badge.is-done { background: #22c55e; }
.cm-off { opacity: .8; filter: grayscale(.7) brightness(.75); }
.cm-art { display: block; height: 40px; width: auto; max-width: 100%; object-fit: contain; }
.cm-art.is-banner { height: auto; width: 100%; border-radius: 6px; }
.cm-prize.is-locked .cm-art { filter: grayscale(.85) brightness(.6); }
.cm-label { position: absolute; width: 104px; display: flex; flex-direction: column; gap: 1px; pointer-events: none; }
.cm-label.is-left { transform: translateX(-100%); text-align: right; }
.cm-name { font-family: var(--font-bug); font-weight: 800; font-size: 15px; line-height: 1; text-transform: uppercase; letter-spacing: 0.4px; }
.cm-sub { font-family: var(--font-bug); font-weight: 700; font-size: 12.5px; line-height: 1.1; }
.cm-pin { position: absolute; transform: translateX(-50%); width: 100px; display: flex; flex-direction: column; align-items: center; pointer-events: none; animation: cmbob 1.8s ease-in-out infinite; }
.cm-pin-tag {
  padding: 3px 10px; border-radius: 8px; background: linear-gradient(180deg, #fcd34d, #f59e0b); border-bottom: 2px solid #b45309;
  font-family: var(--font-bug); font-weight: 800; font-style: italic; font-size: 14px; letter-spacing: 0.5px; color: #1c1206; white-space: nowrap;
}
.cm-pin.is-below { flex-direction: column-reverse; }
.cm-pin.is-below .cm-pin-tip { transform: rotate(180deg); }
.cm-pin-tip { width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 7px solid #f59e0b; display: block; }
@keyframes cmbob { 0%, 100% { transform: translate(-50%, 0); } 50% { transform: translate(-50%, -5px); } }
.cm-here {
  position: absolute; width: 88px; height: 88px; transform: translate(-50%, -50%); box-sizing: border-box; border-radius: 50%; padding: 4px; border: 0; cursor: pointer;
  background: conic-gradient(from 200deg, #fde68a, #b45309, #fde68a, #92400e, #fde68a); animation: cmhere 2.2s ease-in-out infinite;
}
.cm-here-in { width: 100%; height: 100%; border-radius: 50%; background: radial-gradient(circle at 50% 38%, #3b2a10, #140d05 80%); display: flex; align-items: center; justify-content: center; }
@keyframes cmhere { 0%, 100% { box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.45); } 50% { box-shadow: 0 0 0 10px rgba(251, 191, 36, 0); } }
.cm-card.is-flow { position: relative; }
.cm-card {
  position: absolute; box-sizing: border-box; border-radius: 16px; padding: 10px 12px;
  background: rgba(17, 26, 46, 0.92); border: 1px solid rgba(251, 191, 36, 0.4); box-shadow: 0 10px 24px rgba(0, 0, 0, 0.45);
  display: flex; flex-direction: column; gap: 6px;
}
.cm-fill { background: linear-gradient(90deg, #34d399, #22d3ee, #818cf8); }
.cm-prizes {
  border-radius: 20px; padding: 12px; background: linear-gradient(160deg, #13233f 0%, #111a2e 70%);
  border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 -10px 30px rgba(11, 18, 32, 0.9);
}
.cm-prize {
  border-radius: 12px; padding: 8px 4px 6px; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08);
  display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 0;
}
.cm-title {
  padding: 3px 6px; border-radius: 999px; border: 1px solid; font-family: var(--font-bug); font-weight: 800; font-style: italic;
  font-size: 11px; line-height: 1.05; text-align: center; max-width: 100%; overflow-wrap: anywhere;
}
@media (prefers-reduced-motion: reduce) {
  .cm-pin, .cm-here { animation: none; }
  .cm-done { animation: none; stroke-dashoffset: 0; }
}
</style>
