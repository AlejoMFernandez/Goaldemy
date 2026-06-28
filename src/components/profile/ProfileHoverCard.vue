<script setup>
import { ref, computed, onMounted } from 'vue'
import { getEquippedCosmetics, frameStyle, bannerStyle, iconBgStyle, rarity } from '../../services/cosmetics'
import { getUserLevel } from '../../services/xp'
import { getTierForLevel } from '../../services/tiers'
import CosmeticIcon from '../rewards/CosmeticIcon.vue'

const props = defineProps({
  userId: { type: String, required: true },
  name: { type: String, default: 'Usuario' },
  avatarUrl: { type: String, default: '' },
})

const eq = ref(null)
const level = ref(1)
const loading = ref(true)

onMounted(async () => {
  try {
    const [e, lvl] = await Promise.all([getEquippedCosmetics(props.userId), getUserLevel(props.userId)])
    eq.value = e
    const info = Array.isArray(lvl?.data) ? lvl.data[0] : lvl?.data
    level.value = Number(info?.level) || 1
  } catch { /* preview no disponible */ } finally { loading.value = false }
})

const tier = computed(() => getTierForLevel(level.value))
const initial = computed(() => (props.name || '?').trim()[0]?.toUpperCase() || '?')
</script>

<template>
  <div class="w-60 rounded-xl border border-white/15 bg-slate-900 shadow-2xl shadow-black/50 overflow-hidden">
    <!-- Banner de fondo -->
    <div class="h-14 relative" :class="[bannerStyle(eq?.bannerKey || 'default'), eq?.bannerPremium ? 'anim-pan' : '']"></div>
    <div class="relative z-10 px-3 pb-3 -mt-7">
      <!-- Avatar (ícono + borde) -->
      <div class="inline-block" :class="[frameStyle(eq?.frameKey || 'none').wrap, frameStyle(eq?.frameKey || 'none').pad, 'rounded-xl', eq?.framePremium ? 'anim-pan' : '']">
        <div class="size-12 rounded-[10px] overflow-hidden grid place-items-center text-white font-bold ring-2 ring-slate-900" :class="iconBgStyle(eq?.iconBg || 'emerald')">
          <CosmeticIcon v-if="eq?.iconGlyph" :iconKey="eq.iconGlyph" :size="34" />
          <img v-else-if="avatarUrl" :src="avatarUrl" class="w-full h-full object-cover" alt="" />
          <span v-else>{{ initial }}</span>
        </div>
      </div>
      <!-- Nombre + rango -->
      <p class="mt-1.5 text-sm font-bold text-white truncate">{{ name }}</p>
      <div class="mt-1.5 flex items-center gap-1.5">
        <img v-if="tier?.image" :src="tier.image" :alt="tier.label" class="w-4 h-4 object-contain" />
        <span class="text-[11px] text-slate-400">{{ tier?.label }} · Nivel {{ level }}</span>
      </div>
    </div>
  </div>
</template>
