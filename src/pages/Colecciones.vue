<script setup>
/**
 * COLECCIONES POR RANGO (diseño V4 · V4Colecciones.dc.html) — /colecciones
 * Una colección por rango (src/data/collections.js). Arriba, destacada, la de tu
 * rango actual con sus casilleros; abajo el resto en filas compactas con progreso,
 * premio al completarla y COBRAR cuando está lista.
 * Las piezas que todavía no tienen arte (no están en el catálogo) se ven apagadas.
 * El cobro usa claim_collection_prize (SQL pendiente): si no está activo, avisa.
 */
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getCosmetics, checkCosmeticUnlocks } from '../services/cosmetics'
import { collectionsState, claimCollectionPrize, CLAIM_ERRORS } from '../services/collections'
import { collectionPrize, pathPieces } from '../data/collections'
import { TIERS, getTierForLevel, tierGlow } from '../services/tiers'
import { shellState, loadShellStats } from '../components/shell/shell-state'
import { pushErrorToast, pushSuccessToast } from '../stores/notifications'
import { tap, success, error as hapticError } from '../services/haptics'
import PiecePreview from '../components/collection/PiecePreview.vue'
import { pieceRarity, hexA, KIND_LABEL } from '../components/collection/piece-style'

const router = useRouter()
const items = ref([])
const loading = ref(true)
const claiming = ref('')
const openKey = ref('')

const level = computed(() => Number(shellState.stats.level) || 1)
const curTierKey = computed(() => getTierForLevel(level.value)?.key)
const catalog = computed(() => Object.fromEntries(items.value.map(c => [c.code, c])))
const owned = computed(() => new Set(items.value.filter(c => c.owned).map(c => c.code)))
const rows = computed(() => collectionsState(owned.value, level.value))
const completeCount = computed(() => rows.value.filter(r => r.state === 'claim' || r.state === 'done').length)

/** Pieza del data → objeto que entiende PiecePreview (con arte si está en el catálogo). */
function asCos(p) {
  const c = catalog.value[p.code]
  return c ? { ...c } : { code: p.code, type: p.kind, name: p.name, rarity: p.rarity, style_key: '' }
}
function prizeOf(col) {
  const pr = collectionPrize(col)
  // Lo que se ve: el borde/banner/ícono del premio (el título va en el texto)
  const main = pr.find(p => p.kind !== 'title') || pr[0]
  return main ? { piece: main, cos: asCos(main), title: pr.find(p => p.kind === 'title' && p !== main) || null } : null
}
function prizeText(col) {
  const pr = prizeOf(col)
  if (!pr) return 'Sin premio extra'
  return `${KIND_LABEL[pr.piece.kind]} ${pr.piece.name}` + (pr.title ? ` + título` : '')
}
function how(p) {
  if (p.route === 'kit') return `Al llegar a Nv ${p.level}`
  if (p.route === 'camino') return `Nv ${p.level}`
  if (p.route === 'logro') return 'Con un logro'
  return 'Premio'
}

const featured = computed(() => rows.value.find(r => r.col.tierKey === curTierKey.value) || rows.value[0])
const featTier = computed(() => TIERS.find(t => t.key === featured.value?.col.tierKey))
const featSlots = computed(() => {
  const col = featured.value?.col
  if (!col) return []
  return col.pieces.filter(p => p.route !== 'premio').map(p => {
    const has = owned.value.has(p.code)
    const c = pieceRarity(p.rarity).c
    return { code: p.code, has, bg: has ? `linear-gradient(160deg, ${c}, ${hexA(c, 0.35)})` : 'rgba(255,255,255,0.03)', border: has ? `1px solid ${hexA(c, 0.8)}` : '1px dashed rgba(255,255,255,0.18)' }
  })
})
const others = computed(() => rows.value.filter(r => r !== featured.value))

function rowStyle(r) {
  const locked = r.state === 'locked'
  const tier = TIERS.find(t => t.key === r.col.tierKey)
  const color = locked ? '#64748b' : tierGlow(tier)
  const full = r.state === 'claim' || r.state === 'done'
  return {
    locked, color, full,
    bg: r.state === 'claim' ? 'linear-gradient(90deg, rgba(34,197,94,0.16), rgba(34,197,94,0.03))' : locked ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.04)',
    ring: r.state === 'claim' ? 'rgba(74,222,128,0.55)' : locked ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.1)',
    bar: full ? 'linear-gradient(90deg,#4ade80,#22c55e)' : locked ? '#475569' : 'linear-gradient(90deg,#fcd34d,#f59e0b)',
    countColor: full ? '#4ade80' : locked ? '#64748b' : '#fde68a',
    shieldFill: locked ? 'rgba(255,255,255,0.03)' : hexA(color, 0.18),
  }
}
function pct(r) { return r.total ? Math.round(r.have / r.total * 100) : 0 }

async function load() {
  loading.value = true
  try { items.value = (await getCosmetics()) || [] } finally { loading.value = false }
}
async function claim(r) {
  if (claiming.value) return
  claiming.value = r.col.key
  tap()
  const res = await claimCollectionPrize(r.col.key)
  if (res?.ok) {
    success()
    pushSuccessToast(`¡Cobraste el premio de ${r.col.name}!`)
    await load()
    try { await checkCosmeticUnlocks() } catch {}
  } else {
    hapticError()
    pushErrorToast(CLAIM_ERRORS[res?.error] || 'No se pudo cobrar el premio')
  }
  claiming.value = ''
}
function toggle(key) { tap(); openKey.value = openKey.value === key ? '' : key }
function piecesOf(col) {
  const road = pathPieces(col).map(p => p.code)
  return col.pieces.filter(p => p.route !== 'premio')
    .slice().sort((a, b) => (road.indexOf(a.code) === -1) - (road.indexOf(b.code) === -1))
}
function goBack() { tap(); if (window.history.length > 1) router.back(); else router.push('/coleccion') }

onMounted(() => { load(); loadShellStats().catch(() => {}) })
</script>

<template>
  <section class="cls relative -mx-2 sm:mx-auto max-w-xl -mt-6 lg:mt-0 pb-6">
    <div class="cls-glow pointer-events-none absolute inset-x-0 -top-10 h-56" aria-hidden="true"></div>

    <header class="relative flex flex-col gap-1">
      <div class="flex items-center gap-2">
        <button type="button" aria-label="Volver a la colección" class="w-11 h-11 -ml-2 rounded-xl grid place-items-center text-slate-100 active:bg-white/10" @click="goBack">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <h1 class="m-0 flex-1 font-display font-bold text-2xl">Colecciones</h1>
        <span class="px-2.5 py-[5px] rounded-full bg-white/[0.06] border border-white/10 font-bug font-extrabold text-[15px] text-slate-300 whitespace-nowrap">{{ loading ? '–' : completeCount }} / {{ rows.length }} COMPLETAS</span>
      </div>
      <p class="m-0 text-[13px] text-slate-400">Una por rango. Juntá todas sus piezas y cobrá el premio.</p>
    </header>

    <div class="relative mt-3 flex flex-col gap-1.5">
      <!-- Tu rango: destacada -->
      <section v-if="featured" :aria-label="`Colección actual: ${featured.col.name}`" class="cls-feat">
        <div class="flex items-center gap-3">
          <img v-if="featTier" :src="featTier.image" :alt="`Rango ${featTier.label}`" width="46" height="54" class="w-[46px] h-auto drop-shadow-[0_4px_10px_rgba(245,158,11,0.5)]" />
          <span class="flex-1 min-w-0 flex flex-col gap-0.5">
            <span class="self-start px-[7px] py-px rounded-[5px] bg-amber-400 text-[#1c1206] font-bug font-extrabold text-[11px] tracking-[0.6px]">TU RANGO · {{ featured.col.tierLabel.toUpperCase() }}</span>
            <span class="font-display font-bold text-[22px] leading-[1.1]">{{ featured.col.name }}</span>
            <span class="text-xs text-slate-300">
              <template v-if="featured.state === 'claim'">¡Completa! Cobrá el premio.</template>
              <template v-else-if="featured.state === 'done'">Completa y cobrada.</template>
              <template v-else>Te {{ featured.missing === 1 ? 'falta 1 pieza' : `faltan ${featured.missing} piezas` }}: salen subiendo de nivel y con logros.</template>
            </span>
          </span>
          <span class="font-bug font-extrabold text-[30px] leading-none text-amber-200">{{ loading ? '–' : featured.have }}<span class="text-lg text-slate-400">/{{ featured.total }}</span></span>
        </div>
        <div :aria-label="`${featured.have} de ${featured.total} piezas`" class="cls-slots" :style="{ gridTemplateColumns: `repeat(${Math.min(10, featSlots.length)}, minmax(0, 1fr))` }">
          <span v-for="s in featSlots" :key="s.code" class="cls-slot" :style="{ background: s.bg, border: s.border }" aria-hidden="true">
            <svg v-if="s.has" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10" /></svg>
            <template v-else>?</template>
          </span>
        </div>
        <div class="flex items-center gap-2.5 p-2 pl-2.5 rounded-[14px] bg-slate-950/50">
          <span class="w-11 h-10 shrink-0 flex items-center justify-center">
            <PiecePreview v-if="prizeOf(featured.col)" :cos="prizeOf(featured.col).cos" :size="38" :inner-icon="shellState.equipped?.iconGlyph || ''" :title-size="9" />
          </span>
          <span class="flex-1 min-w-0 flex flex-col">
            <span class="text-[11px] text-slate-400">Premio al completarla</span>
            <strong class="text-sm truncate">{{ prizeText(featured.col) }} <span v-if="prizeOf(featured.col)" class="text-[11px] font-extrabold" :style="{ color: pieceRarity(prizeOf(featured.col).piece.rarity).t }">{{ pieceRarity(prizeOf(featured.col).piece.rarity).label.toUpperCase() }}</span></strong>
          </span>
          <button v-if="featured.state === 'claim'" type="button" class="cls-claim cls-pulse" :disabled="!!claiming" @click="claim(featured)">{{ claiming === featured.col.key ? '…' : 'COBRAR' }}</button>
          <button v-else type="button" class="cls-see" :aria-expanded="openKey === featured.col.key" @click="toggle(featured.col.key)">{{ openKey === featured.col.key ? 'OCULTAR' : 'VER PIEZAS' }}</button>
        </div>
        <Transition name="cls-open">
          <div v-if="openKey === featured.col.key" class="cls-pieces">
            <div v-for="p in piecesOf(featured.col)" :key="p.code" class="cls-piece" :class="owned.has(p.code) ? '' : 'is-off'">
              <span class="h-12 w-full flex items-center justify-center"><PiecePreview :cos="asCos(p)" :size="44" :inner-icon="shellState.equipped?.iconGlyph || ''" :locked="!owned.has(p.code)" :title-size="10" /></span>
              <span class="text-[11px] font-bold leading-tight text-center truncate w-full">{{ p.name }}</span>
              <span class="text-[10px] font-semibold" :class="owned.has(p.code) ? 'text-emerald-400' : 'text-slate-500'">{{ owned.has(p.code) ? 'La tenés' : how(p) }}</span>
            </div>
          </div>
        </Transition>
      </section>

      <!-- El resto -->
      <template v-for="r in others" :key="r.col.key">
        <div class="cls-row" :style="{ background: rowStyle(r).bg, border: `1px solid ${rowStyle(r).ring}` }">
          <button type="button" class="flex-1 min-w-0 flex items-center gap-2.5 text-left min-h-[44px]" :aria-expanded="openKey === r.col.key" :aria-label="`${r.col.name}, rango ${r.col.tierLabel}, ${r.have} de ${r.total} piezas`" @click="toggle(r.col.key)">
            <span aria-hidden="true" class="relative w-[34px] h-[38px] shrink-0" :style="{ opacity: rowStyle(r).locked ? 0.45 : 1 }">
              <svg width="34" height="38" viewBox="0 0 34 38" class="absolute inset-0"><path d="M17 1L32 6v12c0 9-6.5 15.5-15 19C8.5 33.5 2 27 2 18V6z" :fill="rowStyle(r).shieldFill" :stroke="rowStyle(r).color" stroke-width="1.8" /></svg>
              <span class="absolute inset-0 pt-1.5 flex flex-col items-center font-bug font-extrabold leading-none" :style="{ color: rowStyle(r).color }"><span class="text-[8px]">NV</span><span class="text-[15px]">{{ r.col.minLevel }}</span></span>
            </span>
            <span class="flex-1 min-w-0 flex flex-col gap-[3px]">
              <span class="flex items-baseline gap-1.5 whitespace-nowrap min-w-0">
                <span class="font-bold text-sm truncate" :class="rowStyle(r).locked ? 'text-slate-400' : 'text-slate-100'">{{ r.col.name }}</span>
                <span class="flex items-center gap-[3px] font-bug font-extrabold text-xs tracking-[0.4px]" :style="{ color: rowStyle(r).color }">
                  <svg v-if="rowStyle(r).locked" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></svg>{{ (rowStyle(r).locked ? 'RANGO ' : '') + r.col.tierLabel.toUpperCase() }}
                </span>
              </span>
              <span class="flex items-center gap-1.5">
                <span class="flex-1 h-[5px] rounded-full bg-white/[0.08] overflow-hidden block"><span class="block h-full rounded-full" :style="{ width: pct(r) + '%', background: rowStyle(r).bar }"></span></span>
                <span class="font-bug font-extrabold text-[13px]" :style="{ color: rowStyle(r).countColor }">{{ r.have }}/{{ r.total }}</span>
              </span>
              <span class="text-[10.5px] text-slate-400 truncate">Premio: <span class="font-bold" :style="{ color: rowStyle(r).locked ? '#94a3b8' : pieceRarity(prizeOf(r.col)?.piece.rarity).t }">{{ prizeText(r.col) }}</span></span>
            </span>
          </button>
          <span class="w-10 h-10 shrink-0 flex items-center justify-center">
            <PiecePreview v-if="prizeOf(r.col)" :cos="prizeOf(r.col).cos" :size="34" :inner-icon="shellState.equipped?.iconGlyph || ''" :locked="rowStyle(r).locked" :title-size="8" />
          </span>
          <button v-if="r.state === 'claim'" type="button" class="cls-claim cls-pulse" :disabled="!!claiming" @click="claim(r)">{{ claiming === r.col.key ? '…' : 'COBRAR' }}</button>
          <span v-else-if="r.state === 'done'" aria-label="Premio cobrado" class="w-7 h-7 shrink-0 rounded-full grid place-items-center" style="background: rgba(34,197,94,0.18); border: 1.5px solid #4ade80">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
          </span>
        </div>
        <Transition name="cls-open">
          <div v-if="openKey === r.col.key" class="cls-pieces mx-1">
            <div v-for="p in piecesOf(r.col)" :key="p.code" class="cls-piece" :class="owned.has(p.code) ? '' : 'is-off'">
              <span class="h-12 w-full flex items-center justify-center"><PiecePreview :cos="asCos(p)" :size="44" :inner-icon="shellState.equipped?.iconGlyph || ''" :locked="!owned.has(p.code)" :title-size="10" /></span>
              <span class="text-[11px] font-bold leading-tight text-center truncate w-full">{{ p.name }}</span>
              <span class="text-[10px] font-semibold" :class="owned.has(p.code) ? 'text-emerald-400' : 'text-slate-500'">{{ owned.has(p.code) ? 'La tenés' : how(p) }}</span>
            </div>
          </div>
        </Transition>
      </template>
    </div>
  </section>
</template>

<style scoped>
.font-bug { font-family: var(--font-bug); }
.cls-glow { background: radial-gradient(80% 60% at 50% 0%, rgba(245, 158, 11, 0.16), transparent 70%); }
.cls-feat {
  position: relative; margin: 4px 0; padding: 12px; border-radius: 20px; display: flex; flex-direction: column; gap: 10px;
  background: radial-gradient(90% 120% at 100% 0%, rgba(245, 158, 11, 0.3), transparent 60%), linear-gradient(160deg, #1f2937, #111a2e);
  border: 1.5px solid rgba(251, 191, 36, 0.6); box-shadow: 0 10px 30px rgba(245, 158, 11, 0.15);
}
.cls-slots { display: grid; gap: 5px; }
.cls-slot { height: 30px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-family: var(--font-bug); font-weight: 800; font-size: 14px; color: #64748b; }
.cls-see, .cls-claim {
  min-height: 44px; padding: 0 12px; border-radius: 12px; font-family: var(--font-bug); font-weight: 800; font-size: 17px; white-space: nowrap; flex-shrink: 0;
}
.cls-see { background: linear-gradient(180deg, #fcd34d, #f59e0b); border-bottom: 3px solid #b45309; color: #1c1206; font-style: italic; }
.cls-claim { border: 0; background: #22c55e; box-shadow: 0 4px 0 #15803d; color: #fff; }
.cls-claim:disabled { opacity: 0.7; }
.cls-pulse { animation: clpulse 1.8s ease-in-out infinite; }
@keyframes clpulse { 0%, 100% { box-shadow: 0 4px 0 #15803d, 0 0 0 0 rgba(74, 222, 128, 0.5); } 50% { box-shadow: 0 4px 0 #15803d, 0 0 0 7px rgba(74, 222, 128, 0); } }
.cls-row { min-height: 56px; box-sizing: border-box; padding: 6px 10px; border-radius: 16px; display: flex; align-items: center; gap: 10px; }
.cls-pieces { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; padding: 4px 0 6px; }
.cls-piece {
  border-radius: 12px; padding: 8px 6px; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08);
  display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 0;
}
.cls-piece.is-off { border-style: dashed; background: rgba(255, 255, 255, 0.02); }
.cls-open-enter-active, .cls-open-leave-active { transition: opacity 0.18s ease, transform 0.18s ease; }
.cls-open-enter-from, .cls-open-leave-to { opacity: 0; transform: translateY(-4px); }
@media (prefers-reduced-motion: reduce) {
  .cls-pulse { animation: none; }
  .cls-open-enter-active, .cls-open-leave-active { transition: none; }
  .cls-open-enter-from, .cls-open-leave-to { transform: none; }
}
</style>
