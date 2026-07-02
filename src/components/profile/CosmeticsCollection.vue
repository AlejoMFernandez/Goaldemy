<script setup>
import { ref, computed, onMounted } from 'vue'
import {
  getCosmetics, equipCosmetic,
  frameStyle, bannerStyle, iconBgStyle, iconThemeBg, rarity, hintFor,
} from '../../services/cosmetics'
import { pushSuccessToast, pushErrorToast } from '../../stores/notifications'
import CosmeticIcon from '../rewards/CosmeticIcon.vue'

const props = defineProps({
  avatarUrl: { type: String, default: '' },
  name: { type: String, default: '' },
  initial: { type: String, default: '?' },
})

// Color de fondo único para avatares SIN ícono (marca esmeralda→cian).
const DEFAULT_BG = 'emerald'
const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary']

const items = ref([])
const loading = ref(true)
const busy = ref(null)
const activeTab = ref('icon')
const filterRarity = ref(null)
const search = ref('')

const TABS = [
  { key: 'icon',   label: 'Íconos',   path: 'M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z' },
  { key: 'frame',  label: 'Bordes',   path: 'M5.25 7.5A2.25 2.25 0 0 1 7.5 5.25h9a2.25 2.25 0 0 1 2.25 2.25v9a2.25 2.25 0 0 1-2.25 2.25h-9a2.25 2.25 0 0 1-2.25-2.25v-9Z' },
  { key: 'banner', label: 'Banners',  path: 'M2.25 15.75l5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 19.5h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Z' },
  { key: 'title',  label: 'Títulos',  path: 'M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z' },
  { key: 'datos',  label: 'Detalles', path: 'M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Zm6-10.125a1.875 1.875 0 1 1-3.75 0 1.875 1.875 0 0 1 3.75 0Zm1.294 6.336a6.721 6.721 0 0 1-3.17.789 6.721 6.721 0 0 1-3.168-.789 3.376 3.376 0 0 1 6.338 0Z' },
]
const isCosmeticTab = computed(() => activeTab.value !== 'datos')

function setTab(k) { activeTab.value = k; filterRarity.value = null; search.value = '' }
function toggleRarity(r) { filterRarity.value = filterRarity.value === r ? null : r }

function byType(t) { return items.value.filter(c => c.type === t) }
function matchesFilter(c) {
  if (filterRarity.value && c.rarity !== filterRarity.value) return false
  const q = search.value.trim().toLowerCase()
  if (q && !(c.name || '').toLowerCase().includes(q)) return false
  return true
}
// Bloqueados: primero previsualizables (por nivel), después secretos (por logro).
const ownedList = computed(() => byType(activeTab.value).filter(c => c.owned && matchesFilter(c)))
const lockedList = computed(() => byType(activeTab.value).filter(c => !c.owned && matchesFilter(c))
  .sort((a, b) => (a.unlock_achievement ? 1 : 0) - (b.unlock_achievement ? 1 : 0)))

const ownedCount = computed(() => byType(activeTab.value).filter(c => c.owned).length)
const totalCount = computed(() => byType(activeTab.value).length)
const rarityCounts = computed(() => {
  const c = {}
  for (const it of byType(activeTab.value)) if (it.owned) c[it.rarity] = (c[it.rarity] || 0) + 1
  return c
})
const currentTabLabel = computed(() => TABS.find(t => t.key === activeTab.value)?.label || '')

const equippedFrame = computed(() => byType('frame').find(f => f.equipped) || byType('frame').find(f => f.style_key === 'none') || {})
const equippedTitle = computed(() => byType('title').find(t => t.equipped) || null)
const equippedIcon = computed(() => byType('icon').find(i => i.equipped) || null)
const equippedBanner = computed(() => byType('banner').find(b => b.equipped) || byType('banner').find(b => b.style_key === 'default') || {})

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

// Cómo se consigue / cómo lo conseguiste (para el popup, también en los desbloqueados).
function requirement(c) {
  if (c.unlock_achievement) return hintFor(c)
  if (c.premium_only) return 'Suscripción Premium'
  if (c.unlock_level > 100) return 'Pase mensual'
  if (c.unlock_level > 1) return 'Nivel ' + c.unlock_level
  return 'Disponible desde el inicio'
}
function displayName(c) { return (!c.owned && c.unlock_achievement) ? 'Ícono secreto' : c.name }

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

      <!-- Cosméticos: dos columnas (izq info/filtro · der grilla) -->
      <div v-if="isCosmeticTab" class="grid grid-cols-1 lg:grid-cols-[210px_1fr] gap-4">
        <!-- ── Columna izquierda: colección + filtros ── -->
        <aside class="space-y-3">
          <!-- Preview del equipado -->
          <div class="rounded-xl border border-white/10 bg-slate-900/40 p-4 flex flex-col items-center gap-2.5">
            <div v-if="activeTab === 'icon'" class="size-24 rounded-2xl overflow-hidden grid place-items-center text-white text-3xl font-extrabold" :class="(equippedIcon && equippedIcon.style_key) ? iconThemeBg(equippedIcon.style_key) : iconBgStyle(DEFAULT_BG)">
              <CosmeticIcon v-if="equippedIcon && equippedIcon.style_key" :iconKey="equippedIcon.style_key" :rarity="equippedIcon.rarity" :size="88" />
              <span v-else>{{ initial }}</span>
            </div>
            <div v-else-if="activeTab === 'frame'" class="size-24 rounded-2xl" :class="[frameStyle(equippedFrame.style_key).wrap, frameStyle(equippedFrame.style_key).pad, equippedFrame.premium_only ? 'anim-pan' : '']">
              <div class="w-full h-full rounded-xl bg-gradient-to-br from-slate-600 to-slate-800"></div>
            </div>
            <div v-else-if="activeTab === 'banner'" class="w-full h-20 rounded-xl border border-white/10" :class="[bannerStyle(equippedBanner.style_key), equippedBanner.premium_only ? 'anim-pan' : '']"></div>
            <div v-else class="py-6 text-center">
              <span v-if="equippedTitle" class="font-display font-bold text-lg" :class="equippedTitle.premium_only ? 'title-premium-anim' : rarity(equippedTitle.rarity).text">{{ equippedTitle.name }}</span>
              <span v-else class="text-slate-500 text-sm">Sin título</span>
            </div>
            <div class="text-center">
              <div class="text-[10px] uppercase tracking-wider text-emerald-400 font-bold">Equipado</div>
              <div class="text-sm font-bold text-white">{{ currentTabLabel }}</div>
            </div>
          </div>

          <!-- Colección: contador + rarezas (clickeables para filtrar) -->
          <div class="rounded-xl border border-white/10 bg-slate-900/40 p-3">
            <div class="flex items-baseline gap-1.5 mb-2 px-1">
              <span class="text-2xl font-display font-extrabold text-white leading-none">{{ ownedCount }}</span>
              <span class="text-xs text-slate-500">de {{ totalCount }}</span>
            </div>
            <div class="space-y-0.5">
              <button v-for="r in RARITY_ORDER" :key="r" @click="toggleRarity(r)"
                      class="w-full flex items-center justify-between rounded-lg px-2 py-1.5 text-xs transition border"
                      :class="filterRarity === r ? [rarity(r).border, rarity(r).bg] : 'border-transparent hover:bg-white/5'">
                <span class="font-semibold flex items-center gap-1.5" :class="rarity(r).text">
                  <span class="size-2 rounded-full" :class="rarity(r).bg.replace('/10','')"></span>{{ rarity(r).label }}
                </span>
                <span class="text-slate-400 tabular-nums">{{ rarityCounts[r] || 0 }}</span>
              </button>
            </div>
            <button v-if="filterRarity" @click="filterRarity = null" class="mt-1.5 w-full text-[11px] text-slate-500 hover:text-slate-300 transition">Quitar filtro</button>
          </div>

          <!-- Buscador -->
          <div class="relative">
            <input v-model="search" type="text" placeholder="Buscar por nombre…" class="w-full text-sm pl-9 pr-3 py-2 rounded-lg bg-black/30 border border-white/10 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-400/30 transition" />
            <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zM9.5 14C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
          </div>
        </aside>

        <!-- ── Columna derecha: grilla ── -->
        <div>
          <template v-for="grp in [{ k:'owned', label:'Tenés', list: ownedList }, { k:'locked', label:'Bloqueados', list: lockedList }]" :key="grp.k">
            <div v-if="grp.list.length" class="mb-5">
              <div class="text-[11px] uppercase tracking-wider font-semibold mb-2.5" :class="grp.k === 'owned' ? 'text-emerald-400' : 'text-slate-500'">{{ grp.label }} ({{ grp.list.length }})</div>

              <!-- Íconos / Bordes -->
              <div v-if="activeTab === 'frame' || activeTab === 'icon'" class="grid grid-cols-4 sm:grid-cols-5 gap-2">
                <button v-for="c in grp.list" :key="c.code" :disabled="!c.owned || busy === c.code" @click="equip(c)"
                        class="relative group aspect-square rounded-lg transition"
                        :class="[ c.owned ? 'cursor-pointer hover:brightness-110' : 'cursor-not-allowed', c.equipped ? 'ring-2 ring-emerald-400 z-10' : (c.premium_only ? 'ring-2 ring-amber-400/80 shadow-[0_0_10px_rgba(251,191,36,0.4)]' : '') ]">
                  <div v-if="!c.owned && c.unlock_achievement" class="absolute inset-0 rounded-lg overflow-hidden border-2 border-amber-500/20 grid place-items-center bg-gradient-to-br from-slate-800 to-slate-950">
                    <span class="text-3xl font-black text-slate-500 group-hover:text-slate-300 transition-colors">?</span>
                  </div>
                  <div v-else class="absolute inset-0 rounded-lg overflow-hidden border-2 grid place-items-center"
                       :class="[ c.premium_only ? 'border-amber-400/60' : rarity(c.rarity).border, !c.owned ? 'grayscale opacity-50' : '', activeTab === 'icon' ? (c.style_key ? iconThemeBg(c.style_key) : iconBgStyle(DEFAULT_BG)) : 'bg-slate-900/50' ]">
                    <CosmeticIcon v-if="activeTab === 'icon' && c.style_key" :iconKey="c.style_key" :rarity="c.rarity" :size="64" />
                    <span v-else-if="activeTab === 'icon'" class="text-slate-400">—</span>
                    <div v-else class="size-[62%] rounded-2xl" :class="[frameStyle(c.style_key).wrap, frameStyle(c.style_key).pad, c.premium_only ? 'anim-pan' : '']">
                      <div class="w-full h-full rounded-xl bg-gradient-to-br from-slate-600 to-slate-800"></div>
                    </div>
                  </div>
                  <span v-if="c.premium_only" class="absolute top-0.5 right-0.5 z-10 px-1 rounded bg-amber-400 text-[7px] font-extrabold text-amber-950">PRO</span>
                  <span v-if="!c.owned" class="absolute top-0.5 left-0.5 z-10 grid place-items-center size-4 rounded-full bg-slate-950/85 text-slate-200">
                    <svg viewBox="0 0 24 24" fill="currentColor" class="size-2.5"><path d="M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5zm3 8H9V6a3 3 0 1 1 6 0v3z"/></svg>
                  </span>
                  <span v-else-if="c.equipped" class="absolute bottom-0.5 right-0.5 z-10 grid place-items-center size-4 rounded-full bg-emerald-500 text-white shadow">
                    <svg viewBox="0 0 24 24" fill="currentColor" class="size-2.5"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                  </span>
                  <!-- Popup (sale del ícono, arriba) -->
                  <div class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-30 w-40 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                    <div class="rounded-lg bg-slate-950/95 border border-white/15 shadow-xl px-3 py-2 text-center">
                      <div class="font-bold text-white text-xs leading-tight truncate">{{ displayName(c) }}</div>
                      <div class="text-[10px] font-semibold mt-0.5" :class="rarity(c.rarity).text">{{ rarity(c.rarity).label }}</div>
                      <div class="text-[10px] text-slate-300 mt-1 leading-snug"><span class="text-slate-500">{{ c.owned ? 'Conseguido: ' : 'Cómo conseguir: ' }}</span>{{ requirement(c) }}</div>
                    </div>
                    <div class="w-2.5 h-2.5 bg-slate-950 border-r border-b border-white/15 rotate-45 mx-auto -mt-[6px]"></div>
                  </div>
                </button>
              </div>

              <!-- Banners -->
              <div v-else-if="activeTab === 'banner'" class="grid grid-cols-2 gap-2.5">
                <button v-for="c in grp.list" :key="c.code" :disabled="!c.owned || busy === c.code" @click="equip(c)"
                        class="relative group rounded-xl transition"
                        :class="[ c.owned ? 'cursor-pointer hover:brightness-110' : 'cursor-not-allowed', c.equipped ? 'ring-2 ring-emerald-400 z-10' : (c.premium_only ? 'ring-2 ring-amber-400/80' : '') ]">
                  <div class="h-16 rounded-xl overflow-hidden border-2"
                       :class="[ c.premium_only ? 'border-amber-400/60' : rarity(c.rarity).border, bannerStyle(c.style_key), c.premium_only ? 'anim-pan' : '', !c.owned ? 'grayscale opacity-50' : '' ]"></div>
                  <span v-if="c.premium_only" class="absolute top-1 right-1 z-10 px-1 rounded bg-amber-400 text-[8px] font-extrabold text-amber-950">PRO</span>
                  <span v-if="!c.owned" class="absolute top-1 left-1 z-10 grid place-items-center size-5 rounded-full bg-slate-950/85 text-slate-200">
                    <svg viewBox="0 0 24 24" fill="currentColor" class="size-3"><path d="M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5zm3 8H9V6a3 3 0 1 1 6 0v3z"/></svg>
                  </span>
                  <span v-else-if="c.equipped" class="absolute bottom-1 right-1 z-10 grid place-items-center size-5 rounded-full bg-emerald-500 text-white shadow-lg">
                    <svg viewBox="0 0 24 24" fill="currentColor" class="size-3.5"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                  </span>
                  <div class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-30 w-44 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                    <div class="rounded-lg bg-slate-950/95 border border-white/15 shadow-xl px-3 py-2 text-center">
                      <div class="font-bold text-white text-xs leading-tight truncate">{{ displayName(c) }}</div>
                      <div class="text-[10px] font-semibold mt-0.5" :class="rarity(c.rarity).text">{{ rarity(c.rarity).label }}</div>
                      <div class="text-[10px] text-slate-300 mt-1 leading-snug"><span class="text-slate-500">{{ c.owned ? 'Conseguido: ' : 'Cómo conseguir: ' }}</span>{{ requirement(c) }}</div>
                    </div>
                    <div class="w-2.5 h-2.5 bg-slate-950 border-r border-b border-white/15 rotate-45 mx-auto -mt-[6px]"></div>
                  </div>
                </button>
              </div>

              <!-- Títulos -->
              <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button v-for="c in grp.list" :key="c.code" :disabled="!c.owned || busy === c.code" @click="equip(c)"
                        class="relative rounded-xl border px-3 py-2.5 text-left transition-all"
                        :class="[ c.equipped ? 'border-emerald-400/50 bg-emerald-500/[0.07]' : (c.premium_only ? 'border-amber-400/50 bg-amber-500/[0.05]' : rarity(c.rarity).border + ' ' + rarity(c.rarity).bg), c.owned ? 'hover:brightness-110 cursor-pointer' : 'opacity-50 cursor-not-allowed' ]">
                  <div class="text-sm font-bold truncate" :class="c.premium_only ? 'title-premium-anim' : rarity(c.rarity).text">{{ c.name }}</div>
                  <div class="text-[9px] mt-0.5 truncate" :class="c.owned ? 'text-slate-500' : 'text-slate-600'">
                    <span v-if="c.equipped" class="text-emerald-400 font-bold">Equipado</span>
                    <span v-else>{{ c.owned ? rarity(c.rarity).label : requirement(c) }}</span>
                  </div>
                </button>
              </div>
            </div>
          </template>

          <div v-if="!ownedList.length && !lockedList.length" class="text-center text-slate-500 text-sm py-12">Sin resultados para el filtro</div>

          <!-- Quitar título -->
          <div v-if="activeTab === 'title' && equippedTitle" class="mt-1">
            <button @click="unequipTitle" class="text-[11px] text-slate-500 hover:text-slate-300 transition">Quitar título</button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
