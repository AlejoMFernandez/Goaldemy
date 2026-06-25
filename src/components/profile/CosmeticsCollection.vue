<script setup>
import { ref, computed, onMounted } from 'vue'
import { getAuthUser } from '../../services/auth'
import {
  getCosmetics, getEquippedCosmetics, equipCosmetic, setIconBg,
  frameStyle, bannerStyle, iconBgStyle, ICON_BG_KEYS, rarity,
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
const activeTab = ref('datos')

const TABS = [
  { key: 'datos', label: 'Datos', icon: '👤' },
  { key: 'frame', label: 'Bordes', icon: '🖼️' },
  { key: 'title', label: 'Títulos', icon: '🏷️' },
  { key: 'icon', label: 'Íconos', icon: '⭐' },
  { key: 'banner', label: 'Banners', icon: '🎴' },
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
            <div class="size-16 rounded-[13px] overflow-hidden grid place-items-center text-white font-extrabold text-2xl" :class="iconBgStyle(iconBg)">
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
        <span aria-hidden="true">{{ t.icon }}</span>{{ t.label }}
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

            <!-- Bordes / Íconos -->
            <div v-if="activeTab === 'frame' || activeTab === 'icon'" class="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <button v-for="c in grp.list" :key="c.code" :disabled="!c.owned || busy === c.code" @click="equip(c)"
                      class="relative rounded-xl border p-3 flex flex-col items-center gap-2 transition-all"
                      :class="[ c.equipped ? 'border-emerald-400/50 bg-emerald-500/[0.07]' : rarity(c.rarity).border + ' bg-white/[0.02]', c.owned ? 'hover:bg-white/5 cursor-pointer' : 'opacity-50 cursor-not-allowed' ]">
                <div v-if="activeTab === 'frame'" :class="[frameStyle(c.style_key).wrap, frameStyle(c.style_key).pad, 'rounded-2xl', c.premium_only ? 'anim-pan' : '']">
                  <div class="size-16 rounded-[14px] grid place-items-center text-slate-300 text-xs" :class="iconBgStyle(iconBg)">●</div>
                </div>
                <div v-else class="grid place-items-center py-1">
                  <CosmeticIcon v-if="c.style_key" :iconKey="c.style_key" :rarity="c.rarity" framed :size="80" />
                  <div v-else class="size-14 rounded-xl grid place-items-center text-slate-400 text-sm" :class="iconBgStyle(iconBg)">—</div>
                </div>
                <span class="text-[11px] font-medium text-white truncate w-full text-center">{{ c.name }}</span>
                <span v-if="c.premium_only" class="absolute top-1.5 right-1.5 text-[8px] font-bold text-amber-300">PRO</span>
                <span v-if="!c.owned" class="text-[9px] text-slate-500">{{ lockLabel(c) }}</span>
                <span v-else-if="c.equipped" class="text-[9px] text-emerald-400 font-bold">Equipado</span>
              </button>
            </div>

            <!-- Banners -->
            <div v-else-if="activeTab === 'banner'" class="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <button v-for="c in grp.list" :key="c.code" :disabled="!c.owned || busy === c.code" @click="equip(c)"
                      class="relative rounded-xl border overflow-hidden transition-all"
                      :class="[ c.equipped ? 'border-emerald-400/60' : c.owned ? 'border-white/10 hover:border-white/25 cursor-pointer' : 'border-white/10 opacity-50 cursor-not-allowed' ]">
                <div class="h-12" :class="[bannerStyle(c.style_key), c.premium_only ? 'anim-pan' : '']"></div>
                <div class="flex items-center justify-between px-2.5 py-1.5 bg-slate-900/80">
                  <span class="text-[11px] font-medium text-white truncate">{{ c.name }}</span>
                  <span v-if="c.premium_only" class="text-[8px] font-bold text-amber-300">PRO</span>
                  <span v-else-if="!c.owned" class="text-[9px] text-slate-500">{{ lockLabel(c) }}</span>
                  <span v-else-if="c.equipped" class="text-[9px] text-emerald-400 font-bold">✓</span>
                </div>
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
