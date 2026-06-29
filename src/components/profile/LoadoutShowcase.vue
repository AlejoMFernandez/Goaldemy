<script setup>
import { ref, computed, onMounted } from 'vue'
import { getCosmetics, frameStyle, bannerStyle, iconBgStyle, iconThemeBg, rarity } from '../../services/cosmetics'
import CosmeticIcon from '../rewards/CosmeticIcon.vue'

const props = defineProps({
  frameKey: { type: String, default: 'none' },
  iconGlyph: { type: String, default: '' },
  iconBg: { type: String, default: 'emerald' },
  titleText: { type: String, default: '' },
  titleRarity: { type: String, default: 'common' },
  bannerKey: { type: String, default: 'default' },
  framePremium: { type: Boolean, default: false },
  titlePremium: { type: Boolean, default: false },
  bannerPremium: { type: Boolean, default: false },
  isSelf: { type: Boolean, default: false },
})

// Catálogo (nombres/rarezas + progreso de colección, solo correcto en perfil propio).
const items = ref([])
onMounted(async () => { try { items.value = await getCosmetics() } catch {} })

function lookup(type, styleKey) {
  return items.value.find(c => c.type === type && c.style_key === styleKey) || null
}
const frameCos = computed(() => lookup('frame', props.frameKey))
const iconCos = computed(() => lookup('icon', props.iconGlyph))
const bannerCos = computed(() => lookup('banner', props.bannerKey))

const ownedCount = computed(() => items.value.filter(c => c.owned).length)
const totalCount = computed(() => items.value.length)
const progressPct = computed(() => totalCount.value ? Math.round((ownedCount.value / totalCount.value) * 100) : 0)

const RARITY_LABEL = { common: 'Común', rare: 'Raro', epic: 'Épico', legendary: 'Legendario' }
function rarLabel(r) { return RARITY_LABEL[r] || 'Común' }
</script>

<template>
  <div class="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 via-slate-800/60 to-slate-900/80 overflow-hidden">
    <!-- Header -->
    <div class="flex items-center justify-between gap-3 px-5 pt-4 pb-1">
      <div class="flex items-center gap-2.5">
        <span class="w-1 h-5 rounded-full bg-gradient-to-b from-amber-300 to-amber-600"></span>
        <h3 class="font-display font-bold text-white">Mi loadout</h3>
      </div>
      <span class="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Equipado</span>
    </div>

    <!-- Slots -->
    <div class="px-5 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
      <!-- Borde -->
      <div class="flex flex-col items-center text-center gap-2">
        <div class="h-[72px] grid place-items-center">
          <div class="size-14 rounded-2xl" :class="[frameStyle(frameKey).wrap, frameStyle(frameKey).pad, framePremium ? 'anim-pan' : '']">
            <div class="w-full h-full rounded-[12px] bg-gradient-to-br from-slate-700 to-slate-900"></div>
          </div>
        </div>
        <div>
          <div class="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Borde</div>
          <div class="text-[11px] font-bold text-white truncate max-w-[120px]">{{ frameCos?.name || 'Ninguno' }}</div>
          <div v-if="frameCos" class="text-[9px]" :class="rarity(frameCos.rarity).text">{{ rarLabel(frameCos.rarity) }}</div>
        </div>
      </div>

      <!-- Ícono -->
      <div class="flex flex-col items-center text-center gap-2">
        <div class="h-[72px] grid place-items-center">
          <div v-if="iconGlyph" class="size-14 rounded-2xl overflow-hidden grid place-items-center shadow-lg shadow-black/30" :class="iconThemeBg(iconGlyph)">
            <CosmeticIcon :iconKey="iconGlyph" :rarity="iconCos?.rarity || 'common'" :size="46" />
          </div>
          <div v-else class="size-14 rounded-2xl grid place-items-center text-slate-500 text-lg" :class="iconBgStyle(iconBg)">—</div>
        </div>
        <div>
          <div class="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Ícono</div>
          <div class="text-[11px] font-bold text-white truncate max-w-[120px]">{{ iconCos?.name || 'Ninguno' }}</div>
          <div v-if="iconCos" class="text-[9px]" :class="rarity(iconCos.rarity).text">{{ rarLabel(iconCos.rarity) }}</div>
        </div>
      </div>

      <!-- Título -->
      <div class="flex flex-col items-center text-center gap-2">
        <div class="h-[72px] grid place-items-center">
          <div class="px-4 py-2 rounded-full border" :class="titleText ? [rarity(titleRarity).border, rarity(titleRarity).bg] : 'border-white/10 bg-white/5'">
            <span class="font-display font-bold text-sm" :class="titleText ? (titlePremium ? 'title-premium-anim' : rarity(titleRarity).text) : 'text-slate-500'">{{ titleText || '—' }}</span>
          </div>
        </div>
        <div>
          <div class="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Título</div>
          <div class="text-[11px] font-bold text-white truncate max-w-[120px]">{{ titleText ? rarLabel(titleRarity) : 'Sin título' }}</div>
        </div>
      </div>

      <!-- Banner -->
      <div class="flex flex-col items-center text-center gap-2">
        <div class="h-[72px] grid place-items-center">
          <div class="w-[88px] h-12 rounded-xl border border-white/15 shadow-lg shadow-black/30" :class="[bannerStyle(bannerKey), bannerPremium ? 'anim-pan' : '']"></div>
        </div>
        <div>
          <div class="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Banner</div>
          <div class="text-[11px] font-bold text-white truncate max-w-[120px]">{{ bannerCos?.name || 'Por defecto' }}</div>
          <div v-if="bannerCos && bannerCos.style_key !== 'default'" class="text-[9px]" :class="rarity(bannerCos.rarity).text">{{ rarLabel(bannerCos.rarity) }}</div>
        </div>
      </div>
    </div>

    <!-- Progreso de colección (solo perfil propio) -->
    <div v-if="isSelf && totalCount > 0" class="px-5 pb-5 pt-1">
      <router-link to="/profile-edit" class="block rounded-xl border border-white/10 bg-black/20 hover:bg-black/30 transition px-4 py-3">
        <div class="flex items-center justify-between text-xs mb-1.5">
          <span class="text-slate-300 font-semibold">Colección desbloqueada</span>
          <span class="text-emerald-300 font-bold tabular-nums">{{ ownedCount }}/{{ totalCount }}</span>
        </div>
        <div class="h-2.5 rounded-full bg-black/40 overflow-hidden ring-1 ring-white/5">
          <div class="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all duration-700" :style="{ width: progressPct + '%' }"></div>
        </div>
        <div class="mt-1.5 text-[10px] text-slate-500 flex items-center justify-between">
          <span>{{ progressPct }}% completado</span>
          <span class="text-slate-400 hover:text-white">Personalizar →</span>
        </div>
      </router-link>
    </div>
  </div>
</template>
