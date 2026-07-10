<script setup>
import { ref, computed, onMounted } from 'vue'
import {
  getCosmetics, equipCosmetic,
  frameStyle, bannerStyle, iconBgStyle, iconThemeBg, rarity, hintFor,
} from '../../services/cosmetics'
import { pushSuccessToast, pushErrorToast } from '../../stores/notifications'
import CosmeticIcon from '../rewards/CosmeticIcon.vue'
import RarityGem from '../rewards/RarityGem.vue'
import UserAvatar from '../common/UserAvatar.vue'

const props = defineProps({
  avatarUrl: { type: String, default: '' },
  name: { type: String, default: '' },
  initial: { type: String, default: '?' },
})

// Color de fondo único para avatares SIN ícono (marca esmeralda→cian).
const DEFAULT_BG = 'emerald'
// Grupos por rareza, del más exclusivo al más común (estilo "mejor 10% / 25%…").
const RARITY_GROUP_ORDER = ['legendary', 'epic', 'rare', 'common']
// Para el mini-dashboard: de común a legendaria (izq→der, rareza creciente).
const RARITY_DASH_ORDER = ['common', 'rare', 'epic', 'legendary']

const items = ref([])
const loading = ref(true)
const busy = ref(null)
const activeTab = ref('icon')

const TABS = [
  { key: 'icon',   label: 'Íconos',   path: 'M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z' },
  { key: 'frame',  label: 'Bordes',   path: 'M5.25 7.5A2.25 2.25 0 0 1 7.5 5.25h9a2.25 2.25 0 0 1 2.25 2.25v9a2.25 2.25 0 0 1-2.25 2.25h-9a2.25 2.25 0 0 1-2.25-2.25v-9Z' },
  { key: 'banner', label: 'Banners',  path: 'M2.25 15.75l5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 19.5h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Z' },
  { key: 'title',  label: 'Títulos',  path: 'M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z' },
  { key: 'datos',  label: 'Detalles', path: 'M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Zm6-10.125a1.875 1.875 0 1 1-3.75 0 1.875 1.875 0 0 1 3.75 0Zm1.294 6.336a6.721 6.721 0 0 1-3.17.789 6.721 6.721 0 0 1-3.168-.789 3.376 3.376 0 0 1 6.338 0Z' },
]
const isCosmeticTab = computed(() => activeTab.value !== 'datos')

function setTab(k) { activeTab.value = k }
function byType(t) { return items.value.filter(c => c.type === t) }

// Fecha de obtención si el RPC la trae (acquired_at); si no, 0 → cae al proxy por nivel.
function acquiredTs(c) { const t = c.acquired_at ? Date.parse(c.acquired_at) : 0; return Number.isFinite(t) ? t : 0 }

// Secciones de la grilla (estilo LoL):
//  1) "Tuyos": lo que tenés, más NUEVOS primero (por fecha; si no hay, por nivel desc), mezclando rarezas.
//  2) Por rareza (Legendaria→Común): lo que NO tenés y se desbloquea por nivel/premium.
//  3) "Secretos": los que se consiguen por logro (ocultos), al final.
const sections = computed(() => {
  const list = byType(activeTab.value)
  const owned = list.filter(c => c.owned)
    .sort((a, b) => acquiredTs(b) - acquiredTs(a) || (b.unlock_level || 0) - (a.unlock_level || 0))
  const lockedNormal = list.filter(c => !c.owned && !c.unlock_achievement)
  const secret = list.filter(c => !c.owned && c.unlock_achievement)
  const out = []
  if (owned.length) out.push({ key: 'owned', tone: 'owned', label: 'Tuyos', items: owned })
  let firstLock = true
  for (const r of RARITY_GROUP_ORDER) {
    const grp = lockedNormal.filter(c => (c.rarity || 'common') === r)
      .sort((a, b) => (a.unlock_level || 0) - (b.unlock_level || 0))
    if (grp.length) { out.push({ key: 'lock-' + r, tone: 'rarity', rarity: r, label: rarity(r).label, items: grp, firstLocked: firstLock }); firstLock = false }
  }
  if (secret.length) out.push({ key: 'secret', tone: 'secret', label: 'Secretos', items: secret })
  return out
})
const hasAny = computed(() => sections.value.length > 0)

// Mini-dashboard: cuántos TENÉS de cada rareza en la sección activa.
const rarityCounts = computed(() => {
  const c = { common: 0, rare: 0, epic: 0, legendary: 0 }
  for (const it of byType(activeTab.value)) if (it.owned) { const r = it.rarity || 'common'; c[r] = (c[r] || 0) + 1 }
  return c
})

const ownedCount = computed(() => byType(activeTab.value).filter(c => c.owned).length)
const totalCount = computed(() => byType(activeTab.value).length)
const currentTabLabel = computed(() => TABS.find(t => t.key === activeTab.value)?.label || '')

// ── Loadout equipado (preview estático de la izquierda) ──
const equippedTitle = computed(() => byType('title').find(t => t.equipped) || null)
const equippedIcon = computed(() => byType('icon').find(i => i.equipped) || null)
const equippedFrame = computed(() => byType('frame').find(f => f.equipped) || byType('frame').find(f => f.style_key === 'none') || {})
const equippedBanner = computed(() => byType('banner').find(b => b.equipped) || byType('banner').find(b => b.style_key === 'default') || {})
const eqFrameKey = computed(() => equippedFrame.value?.style_key || 'none')
const eqFramePremium = computed(() => !!equippedFrame.value?.premium_only)
const eqIconGlyph = computed(() => equippedIcon.value?.style_key || '')
const eqBannerKey = computed(() => equippedBanner.value?.style_key || 'default')
const eqBannerPremium = computed(() => !!equippedBanner.value?.premium_only)

async function load() {
  loading.value = true
  items.value = await getCosmetics()
  loading.value = false
}
async function equip(c) {
  if (!c.owned || busy.value) return
  busy.value = c.code
  const res = await equipCosmetic(c.code)
  if (res.ok) {
    items.value = items.value.map(x => x.type === c.type ? { ...x, equipped: x.code === c.code } : x)
    pushSuccessToast('Equipado')
  } else { pushErrorToast('No se pudo equipar') }
  busy.value = null
}
async function unequipTitle() {
  if (busy.value) return
  busy.value = 'untitle'
  const res = await equipCosmetic('')
  if (res.ok) items.value = items.value.map(x => x.type === 'title' ? { ...x, equipped: false } : x)
  busy.value = null
}

// Cómo se consigue / cómo lo conseguiste.
function requirement(c) {
  if (c.unlock_achievement) return hintFor(c)
  if (c.premium_only) return 'Suscripción Premium'
  if (c.unlock_level > 100) return 'Pase mensual'
  if (c.unlock_level > 1) return 'Nivel ' + c.unlock_level
  return 'Disponible desde el inicio'
}
// Nivel/etiqueta corta para mostrar SIN hover (bordes).
function shortReq(c) {
  if (c.premium_only) return 'Premium'
  if (c.unlock_achievement) return 'Logro secreto'
  if (c.unlock_level > 100) return 'Pase mensual'
  if (c.unlock_level > 1) return 'Nivel ' + c.unlock_level
  return 'Inicial'
}
function displayName(c) { return (!c.owned && c.unlock_achievement) ? 'Secreto' : c.name }

onMounted(load)
</script>

<template>
  <div class="card p-5 sm:p-6">
    <!-- Tabs -->
    <div class="flex gap-1 rounded-xl border border-white/10 bg-slate-900/50 p-1 mb-5 overflow-x-auto">
      <button v-for="t in TABS" :key="t.key" @click="setTab(t.key)"
              class="flex-1 min-w-max rounded-lg px-3 py-2 text-sm font-semibold transition flex items-center justify-center gap-1.5"
              :class="activeTab === t.key ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white' : 'text-slate-300 hover:text-white hover:bg-white/5'">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4 shrink-0" aria-hidden="true"><path :d="t.path" /></svg>{{ t.label }}
      </button>
    </div>

    <div v-if="loading" class="h-40 rounded-xl bg-white/5 animate-pulse"></div>

    <template v-else>
      <!-- Datos (form a ancho completo) -->
      <div v-show="activeTab === 'datos'">
        <slot name="datos" />
      </div>

      <!-- Cosméticos: preview ESTÁTICO (izq) · secciones (der) -->
      <div v-if="isCosmeticTab" class="grid grid-cols-1 lg:grid-cols-[268px_1fr] gap-5">
        <!-- ── Preview fijo del perfil (no cambia por sección) ── -->
        <aside class="lg:sticky lg:top-4 self-start space-y-3">
          <div class="rounded-2xl border border-white/10 bg-slate-900/40 overflow-hidden shadow-lg">
            <div class="h-24" :class="[bannerStyle(eqBannerKey), eqBannerPremium ? 'anim-pan' : '']"></div>
            <!-- relative z-10 → el avatar/borde pinta POR ENCIMA del banner (antes se veía por debajo) -->
            <div class="relative z-10 px-4 pb-5 -mt-10 flex flex-col items-center text-center">
              <UserAvatar :size="88" :avatar-url="avatarUrl" :initial="initial" :frame-key="eqFrameKey" :icon-glyph="eqIconGlyph" :frame-premium="eqFramePremium" />
              <h3 class="mt-2.5 text-lg font-bold text-white leading-tight truncate max-w-full">{{ name || 'Tu perfil' }}</h3>
              <p v-if="equippedTitle" class="text-sm font-bold mt-0.5 truncate max-w-full" :class="equippedTitle.premium_only ? 'title-premium-anim' : rarity(equippedTitle.rarity).text">{{ equippedTitle.name }}</p>
              <p v-else class="text-xs text-slate-500 mt-0.5">Sin título</p>
            </div>
          </div>
          <div class="rounded-xl border border-white/10 bg-slate-900/40 p-3">
            <div class="flex items-baseline justify-center gap-1.5">
              <span class="text-2xl font-display font-extrabold text-white leading-none">{{ ownedCount }}</span>
              <span class="text-xs text-slate-500">de {{ totalCount }}</span>
            </div>
            <!-- Mini-dashboard: cuántos tenés por rareza -->
            <div class="mt-3 grid grid-cols-4 gap-1">
              <div v-for="r in RARITY_DASH_ORDER" :key="r" :title="rarity(r).label" class="flex flex-col items-center gap-1 rounded-lg py-1">
                <RarityGem :rarity="r" :size="19" />
                <span class="text-[11px] font-bold tabular-nums" :class="rarity(r).text">{{ rarityCounts[r] || 0 }}</span>
              </div>
            </div>
          </div>
        </aside>

        <!-- ── Secciones agrupadas por rareza ── -->
        <div class="min-w-0">
          <div v-if="!hasAny" class="text-center text-slate-500 text-sm py-12">Sin cosméticos en esta sección</div>

          <div v-for="sec in sections" :key="sec.key" class="mb-8 last:mb-0">
            <!-- Encabezado del bloque "los que no tenés" (antes de la 1ª rareza) -->
            <div v-if="sec.firstLocked" class="flex items-center gap-2.5 mb-4 -mt-1">
              <span class="text-sm font-display font-extrabold uppercase tracking-wide text-slate-300">Por desbloquear</span>
              <div class="flex-1 h-px bg-gradient-to-r from-white/20 to-transparent"></div>
            </div>
            <!-- Título de sección: Tuyos (esmeralda) / rareza (gema) / Secretos (candado) -->
            <div class="flex items-center gap-2.5 mb-4">
              <RarityGem v-if="sec.tone === 'rarity'" :rarity="sec.rarity" :size="18" />
              <span v-else-if="sec.tone === 'owned'" class="grid place-items-center h-5 w-5 rounded-full bg-emerald-500/20 text-emerald-300"><svg viewBox="0 0 24 24" fill="currentColor" class="w-3 h-3"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></span>
              <svg v-else viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4 text-slate-400"><path d="M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5zm3 8H9V6a3 3 0 1 1 6 0v3z"/></svg>
              <h4 class="font-display font-bold text-base" :class="sec.tone === 'rarity' ? rarity(sec.rarity).text : (sec.tone === 'owned' ? 'text-emerald-300' : 'text-slate-400')">{{ sec.label }}</h4>
              <span class="text-xs text-slate-500 tabular-nums">{{ sec.items.length }}</span>
              <div class="flex-1 h-px bg-white/10"></div>
            </div>

            <!-- ═══ ÍCONOS: grilla apretada (7 col), gema abajo-centro, hover con detalle ═══ -->
            <div v-if="activeTab === 'icon'" class="grid grid-cols-4 sm:grid-cols-6 xl:grid-cols-7 gap-x-2.5 gap-y-4">
              <button v-for="c in sec.items" :key="c.code" :disabled="!c.owned || busy === c.code" @click="equip(c)"
                      class="relative group aspect-square rounded-xl transition hover:z-30"
                      :class="[ c.owned ? 'cursor-pointer hover:brightness-110' : 'cursor-not-allowed', c.equipped ? 'ring-2 ring-emerald-400' : (c.premium_only ? 'ring-2 ring-amber-400/70' : '') ]">
                <div v-if="!c.owned && c.unlock_achievement" class="absolute inset-0 rounded-xl overflow-hidden border border-amber-500/20 grid place-items-center bg-gradient-to-br from-slate-800 to-slate-950">
                  <span class="text-3xl font-black text-slate-500 group-hover:text-slate-300 transition-colors">?</span>
                </div>
                <div v-else class="absolute inset-0 rounded-xl overflow-hidden grid place-items-center"
                     :class="[ c.style_key ? iconThemeBg(c.style_key) : iconBgStyle(DEFAULT_BG), !c.owned ? 'grayscale opacity-45' : '' ]">
                  <CosmeticIcon v-if="c.style_key" :iconKey="c.style_key" :rarity="c.rarity" :size="72" />
                  <span v-else class="text-slate-400">—</span>
                </div>
                <span v-if="c.premium_only" class="absolute top-0.5 right-0.5 z-10 px-1 rounded bg-amber-400 text-[7px] font-extrabold text-amber-950">PRO</span>
                <span v-if="!c.owned" class="absolute top-0.5 left-0.5 z-10 grid place-items-center size-4 rounded-full bg-slate-950/85 text-slate-200">
                  <svg viewBox="0 0 24 24" fill="currentColor" class="size-2.5"><path d="M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5zm3 8H9V6a3 3 0 1 1 6 0v3z"/></svg>
                </span>
                <span v-else-if="c.equipped" class="absolute top-0.5 right-0.5 z-10 grid place-items-center size-4 rounded-full bg-emerald-500 text-white shadow">
                  <svg viewBox="0 0 24 24" fill="currentColor" class="size-2.5"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                </span>
                <!-- Gema de rareza: abajo-centro, mitad afuera / mitad adentro -->
                <span class="absolute left-1/2 -translate-x-1/2 -bottom-2 z-10 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"><RarityGem :rarity="c.rarity" :size="16" /></span>
                <!-- Popup (nombre, cómo, y la gema en una esquina) -->
                <div class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-30 w-44 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  <div class="relative rounded-lg bg-slate-950/95 border border-white/15 shadow-xl px-3 py-2 text-center">
                    <div class="font-bold text-white text-xs leading-tight truncate">{{ displayName(c) }}</div>
                    <div class="text-[10px] text-slate-300 mt-1 leading-snug"><span class="text-slate-500">{{ c.owned ? 'Conseguido: ' : 'Cómo conseguir: ' }}</span>{{ requirement(c) }}</div>
                  </div>
                  <div class="w-2.5 h-2.5 bg-slate-950 border-r border-b border-white/15 rotate-45 mx-auto -mt-[6px]"></div>
                </div>
              </button>
            </div>

            <!-- ═══ BORDES: como los íconos — borde SOLO + gema + hover informativo ═══ -->
            <div v-else-if="activeTab === 'frame'" class="grid grid-cols-3 sm:grid-cols-4 xl:grid-cols-5 gap-x-2.5 gap-y-4">
              <button v-for="c in sec.items" :key="c.code" :disabled="!c.owned || busy === c.code" @click="equip(c)"
                      class="relative group aspect-square rounded-xl grid place-items-center bg-slate-900/40 transition hover:z-30"
                      :class="[ c.owned ? 'cursor-pointer hover:brightness-110' : 'cursor-not-allowed', c.equipped ? 'ring-2 ring-emerald-400' : (c.premium_only ? 'ring-2 ring-amber-400/70' : 'ring-1 ring-white/5') ]">
                <!-- Borde solo, alrededor de un disco liso (sin persona/emoji adentro) -->
                <div class="size-[64%] rounded-full" :class="[frameStyle(c.style_key).wrap, frameStyle(c.style_key).pad, c.premium_only ? 'anim-pan' : '', !c.owned ? 'grayscale opacity-45' : '']">
                  <div class="w-full h-full rounded-full bg-gradient-to-br from-slate-700 to-slate-900"></div>
                </div>
                <span v-if="c.premium_only" class="absolute top-0.5 right-0.5 z-10 px-1 rounded bg-amber-400 text-[7px] font-extrabold text-amber-950">PRO</span>
                <span v-if="!c.owned" class="absolute top-0.5 left-0.5 z-10 grid place-items-center size-4 rounded-full bg-slate-950/85 text-slate-200">
                  <svg viewBox="0 0 24 24" fill="currentColor" class="size-2.5"><path d="M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5zm3 8H9V6a3 3 0 1 1 6 0v3z"/></svg>
                </span>
                <span v-else-if="c.equipped" class="absolute top-0.5 right-0.5 z-10 grid place-items-center size-4 rounded-full bg-emerald-500 text-white shadow">
                  <svg viewBox="0 0 24 24" fill="currentColor" class="size-2.5"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                </span>
                <!-- Gema de rareza: abajo-centro (la rareza va acá, no en el hover) -->
                <span class="absolute left-1/2 -translate-x-1/2 -bottom-2 z-10 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"><RarityGem :rarity="c.rarity" :size="16" /></span>
                <!-- Popup informativo: título centrado, sin rareza -->
                <div class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-30 w-44 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  <div class="relative rounded-lg bg-slate-950/95 border border-white/15 shadow-xl px-3 py-2 text-center">
                    <div class="font-bold text-white text-xs leading-tight truncate">{{ displayName(c) }}</div>
                    <div class="text-[10px] text-slate-300 mt-1 leading-snug"><span class="text-slate-500">{{ c.owned ? 'Conseguido: ' : 'Cómo conseguir: ' }}</span>{{ requirement(c) }}</div>
                  </div>
                  <div class="w-2.5 h-2.5 bg-slate-950 border-r border-b border-white/15 rotate-45 mx-auto -mt-[6px]"></div>
                </div>
              </button>
            </div>

            <!-- ═══ BANNERS: cards HORIZONTALES (como se ven en el perfil real), hover como íconos ═══ -->
            <div v-else-if="activeTab === 'banner'" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button v-for="c in sec.items" :key="c.code" :disabled="!c.owned || busy === c.code" @click="equip(c)"
                      class="relative group rounded-xl transition hover:z-30"
                      :class="[ c.owned ? 'cursor-pointer hover:brightness-110' : 'cursor-not-allowed', c.equipped ? 'ring-2 ring-emerald-400' : (c.premium_only ? 'ring-2 ring-amber-400/70' : '') ]">
                <div class="h-20 rounded-xl overflow-hidden border border-white/10 relative"
                     :class="[ bannerStyle(c.style_key), c.premium_only ? 'anim-pan' : '', !c.owned ? 'grayscale opacity-50' : '' ]">
                  <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2.5 py-1.5">
                    <div class="text-[11px] font-bold text-white truncate">{{ displayName(c) }}</div>
                  </div>
                  <span class="absolute top-1.5 left-1.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"><RarityGem :rarity="c.rarity" :size="15" /></span>
                </div>
                <span v-if="c.premium_only" class="absolute top-1.5 right-1.5 z-10 px-1 rounded bg-amber-400 text-[8px] font-extrabold text-amber-950">PRO</span>
                <span v-if="!c.owned" class="absolute top-1.5 right-1.5 z-10 grid place-items-center size-5 rounded-full bg-slate-950/85 text-slate-200">
                  <svg viewBox="0 0 24 24" fill="currentColor" class="size-3"><path d="M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5zm3 8H9V6a3 3 0 1 1 6 0v3z"/></svg>
                </span>
                <span v-else-if="c.equipped" class="absolute bottom-1.5 right-1.5 z-10 grid place-items-center size-5 rounded-full bg-emerald-500 text-white shadow-lg">
                  <svg viewBox="0 0 24 24" fill="currentColor" class="size-3.5"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                </span>
                <!-- Popup (como los íconos): título centrado, sin rareza -->
                <div class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-30 w-44 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  <div class="relative rounded-lg bg-slate-950/95 border border-white/15 shadow-xl px-3 py-2 text-center">
                    <div class="font-bold text-white text-xs leading-tight truncate">{{ displayName(c) }}</div>
                    <div class="text-[10px] text-slate-300 mt-1 leading-snug"><span class="text-slate-500">{{ c.owned ? 'Conseguido: ' : 'Cómo conseguir: ' }}</span>{{ requirement(c) }}</div>
                  </div>
                  <div class="w-2.5 h-2.5 bg-slate-950 border-r border-b border-white/15 rotate-45 mx-auto -mt-[6px]"></div>
                </div>
              </button>
            </div>

            <!-- ═══ TÍTULOS: chips, hover = por qué lo desbloqueaste ═══ -->
            <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button v-for="c in sec.items" :key="c.code" :disabled="!c.owned || busy === c.code" @click="equip(c)"
                      class="group relative rounded-xl border px-3.5 py-3 text-left transition-all"
                      :class="[ c.equipped ? 'border-emerald-400/50 bg-emerald-500/[0.07]' : (c.premium_only ? 'border-amber-400/50 bg-amber-500/[0.05]' : rarity(c.rarity).border + ' ' + rarity(c.rarity).bg), c.owned ? 'hover:brightness-110 cursor-pointer' : 'opacity-60 cursor-not-allowed' ]">
                <div class="text-sm font-bold truncate" :class="c.premium_only ? 'title-premium-anim' : rarity(c.rarity).text">{{ c.name }}</div>
                <div class="text-[10px] mt-0.5 truncate" :class="c.owned ? 'text-slate-500' : 'text-slate-600'">
                  <span v-if="c.equipped" class="text-emerald-400 font-bold">Equipado</span>
                  <span v-else-if="c.owned">Disponible</span>
                  <span v-else>{{ shortReq(c) }}</span>
                </div>
                <!-- Popup: por qué lo desbloqueaste -->
                <div class="pointer-events-none absolute bottom-full left-4 mb-2 z-30 w-52 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  <div class="rounded-lg bg-slate-950/95 border border-white/15 shadow-xl px-3 py-2">
                    <div class="text-[10px] text-slate-300 leading-snug"><span class="text-slate-500">{{ c.owned ? 'Lo conseguiste por: ' : 'Cómo conseguir: ' }}</span>{{ requirement(c) }}</div>
                  </div>
                  <div class="w-2.5 h-2.5 bg-slate-950 border-r border-b border-white/15 rotate-45 ml-4 -mt-[6px]"></div>
                </div>
              </button>
            </div>
          </div>

          <!-- Quitar título -->
          <div v-if="activeTab === 'title' && equippedTitle" class="mt-1">
            <button @click="unequipTitle" class="text-[11px] text-slate-500 hover:text-slate-300 transition">Quitar título</button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
