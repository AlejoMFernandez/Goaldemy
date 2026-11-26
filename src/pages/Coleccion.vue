<script setup>
/**
 * COLECCIÓN / VESTUARIO (diseño V4 · V4Coleccion.dc.html) — 2ª pestaña.
 * Arriba tu vestuario equipado (banner, ícono + borde, título). Abajo el álbum
 * por tipo: piezas grandes (3 columnas, 2 en banners) con su arte real y texto
 * mínimo; el "cómo se consigue" aparece solo en las bloqueadas. Tocás una pieza
 * tuya y se equipa al instante. Al final, el acceso a las colecciones por rango.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { getCosmetics, equipCosmetic, bannerStyle, hintFor } from '../services/cosmetics'
import { getShop } from '../services/shop'
import { collectionsState } from '../services/collections'
import { getTierForLevel } from '../services/tiers'
import { shellState, loadShellStats } from '../components/shell/shell-state'
import { pushErrorToast } from '../stores/notifications'
import { tap, success } from '../services/haptics'
import UserAvatar from '../components/common/UserAvatar.vue'
import PiecePreview from '../components/collection/PiecePreview.vue'
import { pieceRarity, hexA, howToGet } from '../components/collection/piece-style'

const TABS = [
  { key: 'icon', label: 'Íconos', page: 'ÍCONOS' },
  { key: 'frame', label: 'Bordes', page: 'BORDES' },
  { key: 'banner', label: 'Banners', page: 'BANNERS' },
  { key: 'title', label: 'Títulos', page: 'TÍTULOS' },
]

const items = ref([])
const shopByCode = ref({})
const loading = ref(true)
const busy = ref('')
const tab = ref('icon')
const fx = ref({ type: '', n: 0 })

const name = computed(() => shellState.user?.display_name || (shellState.user?.email || '').split('@')[0] || 'Vos')
const initial = computed(() => (name.value.trim()[0] || '?').toUpperCase())
const level = computed(() => Number(shellState.stats.level) || 1)

const byType = (t) => items.value.filter(c => c.type === t)
const eqIcon = computed(() => byType('icon').find(c => c.equipped) || null)
const eqFrame = computed(() => byType('frame').find(c => c.equipped) || null)
const eqBanner = computed(() => byType('banner').find(c => c.equipped) || null)
const eqTitle = computed(() => byType('title').find(c => c.equipped) || null)
const eqIconKey = computed(() => eqIcon.value?.style_key || shellState.equipped?.iconGlyph || '')

// Número fijo de figurita por tipo: por cómo se consigue (nivel), después código.
const albumNo = computed(() => {
  const map = {}
  for (const t of ['icon', 'frame', 'banner', 'title']) {
    byType(t).filter(c => !['frame_none', 'icon_none'].includes(c.code) && c.style_key !== 'none')
      .sort((a, b) => (a.unlock_level || 0) - (b.unlock_level || 0) || String(a.code).localeCompare(String(b.code)))
      .forEach((c, i) => { map[c.code] = '#' + String(i + 1).padStart(2, '0') })
  }
  return map
})
const cards = computed(() => byType(tab.value)
  .filter(c => albumNo.value[c.code])
  .sort((a, b) => albumNo.value[a.code].localeCompare(albumNo.value[b.code])))
const have = computed(() => cards.value.filter(c => c.owned).length)
const pagePct = computed(() => cards.value.length ? Math.round(have.value / cards.value.length * 100) : 0)
const pageTitle = computed(() => TABS.find(t => t.key === tab.value)?.page || '')

// Lo nuevo lleva etiqueta NUEVA hasta que lo ves (la 1ª visita no marca nada).
const SEEN_KEY = 'fulvo:album_seen'
function readSeen() { try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')) } catch { return new Set() } }
const seen = ref(readSeen())
const firstVisit = ref(seen.value.size === 0)
const isNew = (c) => c.owned && !c.equipped && !firstVisit.value && !seen.value.has(c.code)
watch(loading, (l) => {
  if (l) return
  setTimeout(() => {
    const next = new Set(seen.value)
    for (const c of items.value) if (c.owned) next.add(c.code)
    try { localStorage.setItem(SEEN_KEY, JSON.stringify([...next])) } catch {}
  }, 400)
})

function how(c) {
  const s = shopByCode.value[c.code]
  if (s) {
    if (s.price_fichas != null) return `Tienda · ${new Intl.NumberFormat('es-AR').format(s.price_fichas)} Fichas`
    if (s.price_balones != null) return `Tienda · ${s.price_balones} Balones`
  }
  if (c.unlock_achievement) return `Logro: ${hintFor(c)}`
  return howToGet(c)
}
function cardStyle(c) {
  const r = pieceRarity(c.rarity)
  if (c.equipped) return { border: '2px solid #4ade80', background: 'linear-gradient(180deg, rgba(34,197,94,0.18), rgba(34,197,94,0.03))' }
  if (c.owned) return { border: `1px solid ${hexA(r.c, 0.45)}`, background: `linear-gradient(180deg, ${hexA(r.c, 0.16)}, rgba(255,255,255,0.02) 75%)` }
  return { border: '1px dashed rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.02)' }
}
function aria(c) {
  const r = pieceRarity(c.rarity)
  return `Figurita ${albumNo.value[c.code]}, ${c.name}, ${r.label}` + (c.owned ? (c.equipped ? ', equipada' : ', tocá para equipar') : `, bloqueada: ${how(c)}`)
}

async function load() {
  loading.value = true
  try {
    const [cos, shop] = await Promise.all([getCosmetics(), getShop().catch(() => [])])
    items.value = cos || []
    const m = {}
    for (const s of shop || []) if (s?.cosmetic_code) m[s.cosmetic_code] = s
    shopByCode.value = m
  } finally { loading.value = false }
}
async function equip(c) {
  if (!c.owned || busy.value) return
  if (c.equipped) { tap(); return }
  busy.value = c.code
  tap()
  const res = await equipCosmetic(c.code)
  if (res?.ok) {
    items.value = items.value.map(x => x.type === c.type ? { ...x, equipped: x.code === c.code } : x)
    fx.value = { type: c.type, n: fx.value.n + 1 }
    success()
  } else pushErrorToast('No se pudo equipar')
  busy.value = ''
}
async function unequipTitle() {
  if (busy.value) return
  busy.value = 'untitle'
  tap()
  const res = await equipCosmetic('')
  if (res?.ok) items.value = items.value.map(x => x.type === 'title' ? { ...x, equipped: false } : x)
  busy.value = ''
}
function pickTab(k) { if (tab.value !== k) tap(); tab.value = k }

// ── Colecciones (resumen de 3) ──
const colRows = computed(() => {
  const owned = new Set(items.value.filter(c => c.owned).map(c => c.code))
  const rows = collectionsState(owned, level.value)
  const curKey = getTierForLevel(level.value)?.key
  const pick = []
  const claim = rows.find(r => r.state === 'claim')
  if (claim) pick.push(claim)
  const current = rows.find(r => r.col.tierKey === curKey)
  if (current && !pick.includes(current)) pick.push(current)
  for (const r of rows) { if (pick.length >= 3) break; if (!pick.includes(r) && r.state === 'locked') pick.push(r) }
  for (const r of rows) { if (pick.length >= 3) break; if (!pick.includes(r)) pick.push(r) }
  return pick.slice(0, 3).map(r => {
    const full = r.state === 'claim' || r.state === 'done'
    const locked = r.state === 'locked'
    return {
      key: r.col.key, name: r.col.name, count: `${r.have}/${r.total}`,
      status: r.state === 'claim' ? 'COBRÁ' : r.state === 'done' ? 'LISTA' : r.col.tierLabel.toUpperCase(),
      pct: r.total ? Math.round(r.have / r.total * 100) : 0,
      color: full ? '#4ade80' : locked ? '#94a3b8' : '#fcd34d',
      bar: full ? '#22c55e' : locked ? '#64748b' : 'linear-gradient(90deg,#fcd34d,#f59e0b)',
      bg: full ? 'rgba(34,197,94,0.12)' : locked ? 'rgba(255,255,255,0.03)' : 'rgba(251,191,36,0.1)',
      ring: full ? 'rgba(74,222,128,0.45)' : locked ? 'rgba(255,255,255,0.08)' : 'rgba(251,191,36,0.4)',
    }
  })
})

onMounted(() => { load(); loadShellStats().catch(() => {}) })
</script>

<template>
  <section class="col relative -mx-6 -mt-10 lg:mx-auto lg:mt-0 lg:max-w-xl pb-6">
    <!-- Banner equipado -->
    <section :aria-label="`Banner equipado${eqBanner ? ': ' + eqBanner.name : ''}`" class="relative h-[104px] lg:rounded-b-3xl overflow-hidden"
      :class="[bannerStyle(eqBanner?.style_key || 'default'), eqBanner?.premium_only ? 'anim-pan' : '']">
      <div :key="'b' + (fx.type === 'banner' ? fx.n : 0)" class="absolute inset-0" :class="fx.type === 'banner' && fx.n ? 'col-flash' : ''"></div>
      <div class="absolute top-3 left-3.5 right-3.5 flex justify-between items-center gap-2">
        <h1 class="m-0 px-3 py-1.5 rounded-full bg-black/50 font-display font-bold text-lg text-white">Tu vestuario</h1>
        <span class="px-2.5 py-1 rounded-full bg-black/50 text-[11px] font-bold text-slate-200 truncate">Tocá una pieza para equiparla</span>
      </div>
    </section>

    <!-- Vista previa -->
    <section aria-label="Vista previa" class="relative -mt-[34px] px-4 flex items-end gap-3">
      <span :key="'a' + ((fx.type === 'icon' || fx.type === 'frame') ? fx.n : 0)" class="shrink-0 rounded-[22px] shadow-[0_8px_22px_rgba(0,0,0,0.5)]" :class="(fx.type === 'icon' || fx.type === 'frame') && fx.n ? 'col-pop' : ''">
        <UserAvatar :size="76" :avatar-url="shellState.user?.avatar_url || ''" :initial="initial" :frame-key="eqFrame?.style_key || 'none'" :icon-glyph="eqIconKey" :frame-premium="!!eqFrame?.premium_only" />
      </span>
      <span class="flex-1 min-w-0 pb-0.5 flex flex-col items-start gap-1">
        <span class="font-display font-bold text-xl leading-none truncate max-w-full">{{ name }} <span class="font-bug font-extrabold text-sm text-indigo-300">NV {{ level }}</span></span>
        <span v-if="eqTitle" :key="'t' + (fx.type === 'title' ? fx.n : 0)" class="col-title" :class="fx.type === 'title' && fx.n ? 'col-pop' : ''">{{ eqTitle.name.toUpperCase() }}</span>
        <span v-else class="text-xs text-slate-500">Sin título</span>
      </span>
    </section>

    <!-- Tipo de pieza -->
    <div role="tablist" aria-label="Tipo de pieza" class="mx-3.5 mt-3 grid grid-cols-4 p-1 rounded-full bg-white/[0.06] border border-white/[0.08]">
      <button v-for="t in TABS" :key="t.key" type="button" role="tab" :aria-selected="tab === t.key" @click="pickTab(t.key)"
        class="min-h-[40px] rounded-full font-extrabold text-[13px] transition-colors"
        :class="tab === t.key ? 'text-slate-900 shadow-[0_2px_8px_rgba(0,0,0,0.35)]' : 'text-slate-400'"
        :style="tab === t.key ? { background: 'linear-gradient(180deg,#ffffff,#e2e8f0)' } : null">{{ t.label }}</button>
    </div>

    <!-- Página del álbum -->
    <div class="mx-3.5 mt-2.5 flex items-center gap-2.5">
      <span class="font-bug font-extrabold text-[15px] tracking-[0.5px] whitespace-nowrap">PÁGINA {{ pageTitle }}</span>
      <span class="flex-1 h-2 rounded-full bg-white/[0.08] overflow-hidden block" role="progressbar" :aria-valuenow="pagePct" aria-valuemin="0" aria-valuemax="100" :aria-label="`Página ${pageTitle}: ${have} de ${cards.length}`">
        <span class="col-fill block h-full rounded-full" :style="{ width: pagePct + '%' }"></span>
      </span>
      <span class="font-bug font-extrabold text-[17px] text-cyan-300">{{ loading ? '–' : `${have}/${cards.length}` }}</span>
      <RouterLink to="/colecciones" aria-label="Ver las colecciones por rango" class="col-link" @click="tap">Colecciones<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg></RouterLink>
    </div>

    <!-- Piezas -->
    <section aria-label="Piezas" class="mx-3.5 mt-3 grid gap-2.5 items-start" :class="tab === 'banner' ? 'grid-cols-2' : 'grid-cols-3'">
      <template v-if="loading">
        <span v-for="n in 9" :key="n" class="rounded-2xl bg-white/5 animate-pulse" :class="tab === 'banner' ? 'h-[110px]' : 'h-[136px]'"></span>
      </template>
      <p v-else-if="!cards.length" class="col-span-full py-10 text-center text-sm text-slate-400">Todavía no hay piezas en esta página.</p>
      <template v-else>
      <button v-for="c in cards" :key="c.code" type="button" :aria-label="aria(c)" :aria-disabled="!c.owned"
        class="col-card" :class="[c.owned ? 'is-owned' : 'is-locked', busy === c.code ? 'is-busy' : '']" :style="cardStyle(c)" @click="equip(c)">
        <span class="col-num" :class="c.owned ? 'text-slate-200/55' : 'text-slate-700'" aria-hidden="true">{{ albumNo[c.code] }}</span>
        <span class="flex items-center justify-center shrink-0" :style="{ height: tab === 'banner' ? '66px' : tab === 'title' ? '64px' : '84px' }">
          <PiecePreview :cos="c" :size="tab === 'banner' ? 82 : 80" :inner-icon="eqIconKey" :initial="initial" :locked="!c.owned" />
        </span>
        <span class="flex items-center gap-[5px] min-w-0">
          <span class="w-[7px] h-[7px] shrink-0 rounded-full" :style="{ background: pieceRarity(c.rarity).c, opacity: c.owned ? 1 : 0.4 }"></span>
          <span class="font-bold text-xs leading-[1.2] truncate" :class="c.owned ? 'text-slate-100' : 'text-slate-500'">{{ c.name }}</span>
        </span>
        <span v-if="!c.owned" class="-mt-[3px] flex items-center gap-1 min-w-0 text-[10px] font-semibold text-slate-500">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" class="shrink-0" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></svg>
          <span class="truncate">{{ how(c) }}</span>
        </span>
        <span v-if="c.equipped" class="col-tag" style="background:#22c55e;color:#052e16">EQUIPADO</span>
        <span v-else-if="isNew(c)" class="col-tag col-new" style="background:#f43f5e;color:#fff">NUEVA</span>
        <span v-if="c.premium_only" class="col-pro" aria-hidden="true">PRO</span>
      </button>
      </template>
    </section>

    <div v-if="tab === 'title' && eqTitle" class="mx-3.5 mt-2">
      <button type="button" class="min-h-[44px] px-2 text-xs font-bold text-slate-400 active:text-slate-200" @click="unequipTitle">Quitar título</button>
    </div>

    <!-- Colecciones por rango -->
    <RouterLink to="/colecciones" aria-label="Ver las colecciones por rango" class="col-cols" @click="tap">
      <span class="w-[86px] shrink-0 flex flex-col gap-0.5">
        <strong class="font-display text-[14px] text-slate-100">Colecciones</strong>
        <span class="flex items-center gap-0.5 text-[11px] font-bold text-amber-400">Ver todas<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg></span>
      </span>
      <span v-for="k in colRows" :key="k.key" class="flex-1 min-w-0 px-[7px] py-1.5 rounded-[10px] flex flex-col gap-[3px]" :style="{ background: k.bg, border: `1px solid ${k.ring}` }">
        <span class="text-[11px] font-bold truncate text-slate-100">{{ k.name }}</span>
        <span class="flex justify-between font-bug font-extrabold text-xs" :style="{ color: k.color }"><span>{{ k.count }}</span><span class="truncate ml-1">{{ k.status }}</span></span>
        <span class="h-1 rounded-full bg-white/10 overflow-hidden block"><span class="block h-full" :style="{ width: k.pct + '%', background: k.bar }"></span></span>
      </span>
    </RouterLink>
  </section>
</template>

<style scoped>
.font-bug { font-family: var(--font-bug); }
.col-title {
  padding: 3px 12px; border-radius: 999px; background: linear-gradient(90deg, rgba(251, 191, 36, 0.2), rgba(251, 191, 36, 0.05));
  border: 1px solid rgba(251, 191, 36, 0.5); font-family: var(--font-bug); font-weight: 800; font-style: italic; font-size: 15px;
  letter-spacing: 0.4px; color: #fde68a; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.col-fill { background: linear-gradient(90deg, #34d399, #22d3ee, #818cf8); transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1); }
.col-link {
  min-height: 32px; padding: 0 10px; border-radius: 999px; background: rgba(251, 191, 36, 0.1); border: 1px solid rgba(251, 191, 36, 0.35);
  display: flex; align-items: center; gap: 2px; font-size: 12px; font-weight: 700; color: #fbbf24; white-space: nowrap; position: relative;
}
.col-link::after { content: ''; position: absolute; inset: -6px 0; }
.col-card {
  position: relative; box-sizing: border-box; padding: 20px 8px 9px; border-radius: 16px; color: #f1f5f9; font-family: inherit;
  text-align: left; display: flex; flex-direction: column; gap: 7px; overflow: hidden; min-width: 0; transition: transform 0.12s ease;
}
.col-card.is-owned { cursor: pointer; }
.col-card.is-owned:active { transform: scale(0.97); }
.col-card.is-locked { cursor: default; }
.col-card.is-busy { opacity: 0.7; }
.col-num { position: absolute; top: 6px; left: 8px; font-family: var(--font-bug); font-weight: 800; font-size: 11px; z-index: 1; }
.col-tag { position: absolute; top: 6px; right: 6px; z-index: 1; padding: 1px 6px; border-radius: 6px; font-family: var(--font-bug); font-weight: 800; font-size: 11px; letter-spacing: 0.5px; }
.col-new { animation: colnew 1.6s ease-in-out infinite; }
@keyframes colnew { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.08); } }
.col-pro { position: absolute; bottom: 30px; right: 6px; padding: 0 4px; border-radius: 4px; background: #fbbf24; color: #451a03; font-size: 8px; font-weight: 800; }
.col-cols {
  margin: 14px 14px 0; min-height: 64px; box-sizing: border-box; padding: 8px 10px; border-radius: 16px; background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1); display: flex; align-items: center; gap: 8px; text-decoration: none;
}
.col-pop { animation: colpop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1); }
@keyframes colpop { 0% { transform: scale(0.82); } 100% { transform: scale(1); } }
.col-flash { animation: colflash 0.6s ease-out; }
@keyframes colflash { 0% { background: rgba(255, 255, 255, 0.35); } 100% { background: transparent; } }
@media (prefers-reduced-motion: reduce) {
  .col-new, .col-pop, .col-flash { animation: none; }
  .col-fill, .col-card { transition: none; }
}
</style>
