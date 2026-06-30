<script setup>
import { ref, computed, onMounted } from 'vue'
import { getAuthUser } from '../../services/auth'
import {
  getCosmetics, getEquippedCosmetics, equipCosmetic, setIconBg,
  frameStyle, bannerStyle, iconBgStyle, iconThemeBg, ICON_BG_KEYS, rarity,
} from '../../services/cosmetics'
import { pushSuccessToast, pushErrorToast } from '../../stores/notifications'
import CosmeticIcon from '../rewards/CosmeticIcon.vue'

const props = defineProps({
  avatarUrl: { type: String, default: '' },
  name: { type: String, default: '' },
  initial: { type: String, default: '?' },
})

const items = ref([])
const loading = ref(true)
const busy = ref(null)
const iconBg = ref('emerald')
// Abre en la estética; "Detalles" (datos de cuenta) queda al final.
const activeTab = ref('icon')

// Íconos de línea (sin emojis). path = trazo outline 24x24.
const TABS = [
  { key: 'icon',   label: 'Íconos',   path: 'M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z' },
  { key: 'frame',  label: 'Bordes',   path: 'M5.25 7.5A2.25 2.25 0 0 1 7.5 5.25h9a2.25 2.25 0 0 1 2.25 2.25v9a2.25 2.25 0 0 1-2.25 2.25h-9a2.25 2.25 0 0 1-2.25-2.25v-9Z' },
  { key: 'banner', label: 'Banners',  path: 'M2.25 15.75l5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 19.5h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Z' },
  { key: 'title',  label: 'Títulos',  path: 'M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z' },
  { key: 'datos',  label: 'Detalles', path: 'M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Zm6-10.125a1.875 1.875 0 1 1-3.75 0 1.875 1.875 0 0 1 3.75 0Zm1.294 6.336a6.721 6.721 0 0 1-3.17.789 6.721 6.721 0 0 1-3.168-.789 3.376 3.376 0 0 1 6.338 0Z' },
]
const isCosmeticTab = computed(() => activeTab.value !== 'datos')

function byType(t) { return items.value.filter(c => c.type === t) }
function ownedOf(t) { return byType(t).filter(c => c.owned) }
function lockedOf(t) { return byType(t).filter(c => !c.owned) }

const equippedFrame = computed(() => byType('frame').find(f => f.equipped) || byType('frame').find(f => f.style_key === 'none') || {})
const equippedTitle = computed(() => byType('title').find(t => t.equipped) || null)
const equippedIcon = computed(() => byType('icon').find(i => i.equipped) || null)
const equippedBanner = computed(() => byType('banner').find(b => b.equipped) || byType('banner').find(b => b.style_key === 'default') || {})

async function load() {
  loading.value = true
  const [cos, eq] = await Promise.all([
    getCosmetics(),
    getEquippedCosmetics(getAuthUser()?.id),
  ])
  items.value = cos
  iconBg.value = eq.iconBg || 'emerald'
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

async function chooseBg(color) {
  if (busy.value === 'bg' || color === iconBg.value) { iconBg.value = color; }
  busy.value = 'bg'
  const res = await setIconBg(color)
  if (res.ok) iconBg.value = color
  busy.value = null
}

function lockLabel(c) {
  if (c.unlock_achievement) return '🏆 Logro'
  if (c.unlock_level > 100) return 'Pase'
  return 'Nivel ' + c.unlock_level
}

onMounted(load)
</script>

<template>
  <div class="card p-5 sm:p-6">
    <!-- Preview fija -->
    <div class="sticky top-2 z-10 mb-5">
      <div class="relative overflow-hidden rounded-2xl border border-white/10 shadow-lg shadow-black/30">
        <div class="absolute inset-0 opacity-90" :class="[bannerStyle(equippedBanner.style_key), equippedBanner.premium_only ? 'anim-pan' : '']"></div>
        <div class="relative flex items-center gap-4 p-4">
          <div :class="[frameStyle(equippedFrame.style_key).wrap, frameStyle(equippedFrame.style_key).pad, 'rounded-2xl shrink-0', equippedFrame.premium_only ? 'anim-pan' : '']">
            <div class="size-16 rounded-[13px] overflow-hidden grid place-items-center text-white font-extrabold text-2xl" :class="(equippedIcon && equippedIcon.style_key) ? iconThemeBg(equippedIcon.style_key) : iconBgStyle(iconBg)">
              <CosmeticIcon v-if="equippedIcon && equippedIcon.style_key" :iconKey="equippedIcon.style_key" :rarity="equippedIcon.rarity" :size="52" />
              <img v-else-if="avatarUrl" :src="avatarUrl" alt="" class="w-full h-full object-cover" />
              <span v-else>{{ initial }}</span>
            </div>
          </div>
          <div class="min-w-0">
            <p class="text-white font-bold text-lg truncate drop-shadow">{{ name || 'Tu nombre' }}</p>
            <p v-if="equippedTitle" class="text-sm font-semibold" :class="equippedTitle.premium_only ? 'title-premium-anim' : rarity(equippedTitle.rarity).text">{{ equippedTitle.name }}</p>
            <p v-else class="text-sm text-slate-300/80">Sin título</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex gap-1 rounded-xl border border-white/10 bg-slate-900/50 p-1 mb-5 overflow-x-auto">
      <button v-for="t in TABS" :key="t.key" @click="activeTab = t.key"
              class="flex-1 min-w-max rounded-lg px-3 py-2 text-sm font-semibold transition flex items-center justify-center gap-1.5"
              :class="activeTab === t.key ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white' : 'text-slate-300 hover:text-white hover:bg-white/5'">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4 shrink-0" aria-hidden="true"><path :d="t.path" /></svg>{{ t.label }}
      </button>
    </div>

    <div v-if="loading" class="h-32 rounded-xl bg-white/5 animate-pulse"></div>

    <template v-else>
      <!-- Datos -->
      <div v-show="activeTab === 'datos'">
        <slot name="datos" />
      </div>

      <!-- Íconos: picker de color de fondo -->
      <div v-if="activeTab === 'icon'" class="mb-5">
        <div class="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-2">Color de fondo</div>
        <div class="flex flex-wrap gap-2">
          <button v-for="c in ICON_BG_KEYS" :key="c" @click="chooseBg(c)"
                  class="w-9 h-9 rounded-lg transition-transform hover:scale-110 ring-2"
                  :class="[iconBgStyle(c), iconBg === c ? 'ring-white' : 'ring-transparent']" :aria-label="c"></button>
        </div>
      </div>

      <!-- Grilla de cosméticos (owned arriba / locked abajo) -->
      <template v-if="isCosmeticTab">
        <template v-for="grp in [{ k:'owned', label:'Tenés', list: ownedOf(activeTab) }, { k:'locked', label:'Bloqueados', list: lockedOf(activeTab) }]" :key="grp.k">
          <div v-if="grp.list.length" class="mb-5">
            <div class="text-[11px] uppercase tracking-wider font-semibold mb-2.5" :class="grp.k === 'owned' ? 'text-emerald-400' : 'text-slate-500'">{{ grp.label }} ({{ grp.list.length }})</div>

            <!-- Bordes / Íconos (grilla densa estilo LoL, info en hover) -->
            <div v-if="activeTab === 'frame' || activeTab === 'icon'" class="grid grid-cols-3 sm:grid-cols-4 gap-2">
              <button v-for="c in grp.list" :key="c.code" :disabled="!c.owned || busy === c.code" @click="equip(c)"
                      class="relative group aspect-square rounded-xl transition-transform"
                      :class="[ c.owned ? 'cursor-pointer hover:scale-105' : 'cursor-not-allowed', c.equipped ? 'ring-2 ring-emerald-400' : '' ]">
                <div class="absolute inset-0 rounded-xl overflow-hidden border-2 grid place-items-center"
                     :class="[ rarity(c.rarity).border, !c.owned ? 'grayscale opacity-50' : '', activeTab === 'icon' ? (c.style_key ? iconThemeBg(c.style_key) : iconBgStyle(iconBg)) : 'bg-slate-900/50' ]">
                  <CosmeticIcon v-if="activeTab === 'icon' && c.style_key" :iconKey="c.style_key" :rarity="c.rarity" :size="72" />
                  <span v-else-if="activeTab === 'icon'" class="text-slate-400 text-lg">—</span>
                  <div v-else class="size-[62%] rounded-2xl" :class="[frameStyle(c.style_key).wrap, frameStyle(c.style_key).pad, c.premium_only ? 'anim-pan' : '']">
                    <div class="w-full h-full rounded-xl bg-gradient-to-br from-slate-600 to-slate-800"></div>
                  </div>
                  <!-- Info en hover -->
                  <div class="absolute inset-x-0 bottom-0 px-1.5 pt-5 pb-1 bg-gradient-to-t from-black/95 via-black/75 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <div class="text-[10px] font-bold text-white truncate leading-tight">{{ c.name }}</div>
                    <div class="text-[9px] truncate font-medium" :class="!c.owned ? 'text-slate-300' : (c.equipped ? 'text-emerald-300' : rarity(c.rarity).text)">{{ !c.owned ? lockLabel(c) : (c.equipped ? 'Equipado' : rarity(c.rarity).label) }}</div>
                  </div>
                </div>
                <span v-if="c.premium_only" class="absolute top-1 right-1 z-10 px-1 rounded bg-amber-400 text-[8px] font-extrabold text-amber-950">PRO</span>
                <span v-if="!c.owned" class="absolute top-1 left-1 z-10 grid place-items-center size-5 rounded-full bg-slate-950/85 text-slate-200">
                  <svg viewBox="0 0 24 24" fill="currentColor" class="size-3"><path d="M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5zm3 8H9V6a3 3 0 1 1 6 0v3z"/></svg>
                </span>
                <span v-else-if="c.equipped" class="absolute bottom-1 right-1 z-10 grid place-items-center size-5 rounded-full bg-emerald-500 text-white shadow-lg">
                  <svg viewBox="0 0 24 24" fill="currentColor" class="size-3.5"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                </span>
              </button>
            </div>

            <!-- Banners (más grandes, info en hover) -->
            <div v-else-if="activeTab === 'banner'" class="grid grid-cols-2 gap-2.5">
              <button v-for="c in grp.list" :key="c.code" :disabled="!c.owned || busy === c.code" @click="equip(c)"
                      class="relative group rounded-xl transition-transform"
                      :class="[ c.owned ? 'cursor-pointer hover:scale-[1.03]' : 'cursor-not-allowed', c.equipped ? 'ring-2 ring-emerald-400' : '' ]">
                <div class="relative h-16 rounded-xl overflow-hidden border-2"
                     :class="[ rarity(c.rarity).border, bannerStyle(c.style_key), c.premium_only ? 'anim-pan' : '', !c.owned ? 'grayscale opacity-50' : '' ]">
                  <div class="absolute inset-x-0 bottom-0 px-2 pt-5 pb-1 bg-gradient-to-t from-black/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <div class="text-[10px] font-bold text-white truncate leading-tight">{{ c.name }}</div>
                    <div class="text-[9px] truncate font-medium" :class="!c.owned ? 'text-slate-300' : (c.equipped ? 'text-emerald-300' : rarity(c.rarity).text)">{{ !c.owned ? lockLabel(c) : (c.equipped ? 'Equipado' : rarity(c.rarity).label) }}</div>
                  </div>
                </div>
                <span v-if="c.premium_only" class="absolute top-1 right-1 z-10 px-1 rounded bg-amber-400 text-[8px] font-extrabold text-amber-950">PRO</span>
                <span v-if="!c.owned" class="absolute top-1 left-1 z-10 grid place-items-center size-5 rounded-full bg-slate-950/85 text-slate-200">
                  <svg viewBox="0 0 24 24" fill="currentColor" class="size-3"><path d="M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5zm3 8H9V6a3 3 0 1 1 6 0v3z"/></svg>
                </span>
                <span v-else-if="c.equipped" class="absolute bottom-1 right-1 z-10 grid place-items-center size-5 rounded-full bg-emerald-500 text-white shadow-lg">
                  <svg viewBox="0 0 24 24" fill="currentColor" class="size-3.5"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                </span>
              </button>
            </div>

            <!-- Títulos -->
            <div v-else class="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <button v-for="c in grp.list" :key="c.code" :disabled="!c.owned || busy === c.code" @click="equip(c)"
                      class="relative rounded-xl border px-3 py-2.5 text-left transition-all"
                      :class="[ c.equipped ? 'border-emerald-400/50 bg-emerald-500/[0.07]' : rarity(c.rarity).border + ' ' + rarity(c.rarity).bg, c.owned ? 'hover:brightness-110 cursor-pointer' : 'opacity-50 cursor-not-allowed' ]">
                <div class="text-sm font-bold truncate" :class="c.premium_only ? 'title-premium-anim' : rarity(c.rarity).text">{{ c.name }}</div>
                <div class="text-[9px] mt-0.5" :class="c.owned ? 'text-slate-500' : 'text-slate-600'">
                  <span v-if="c.premium_only" class="text-amber-300 font-bold">PREMIUM</span>
                  <span v-else-if="!c.owned">{{ lockLabel(c) }}</span>
                  <span v-else-if="c.equipped" class="text-emerald-400 font-bold">Equipado</span>
                  <span v-else>{{ rarity(c.rarity).label }}</span>
                </div>
              </button>
            </div>
          </div>
        </template>

        <!-- Quitar título -->
        <div v-if="activeTab === 'title' && equippedTitle" class="mt-1">
          <button @click="unequipTitle" class="text-[11px] text-slate-500 hover:text-slate-300 transition">Quitar título</button>
        </div>
      </template>
    </template>
  </div>
</template>
