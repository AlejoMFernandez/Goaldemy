<script setup>
import { ref, watch } from 'vue'
import { getEquippedCosmeticsBatch, frameStyle, iconBgStyle, iconThemeBg } from '../../services/cosmetics'
import CosmeticIcon from '../rewards/CosmeticIcon.vue'
import ProfileHoverCard from './ProfileHoverCard.vue'

const props = defineProps({
  followerCount: { type: Number, default: 0 },
  followingCount: { type: Number, default: 0 },
  groupCount: { type: Number, default: 0 },
  connections: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
})

const cos = ref({})
const hoveredId = ref(null)

async function loadCos() {
  const ids = (props.connections || []).map(c => c.id).filter(Boolean)
  if (!ids.length) { cos.value = {}; return }
  try { cos.value = await getEquippedCosmeticsBatch(ids) } catch { cos.value = {} }
}
watch(() => props.connections, loadCos, { immediate: true, deep: false })

function initial(c) { return ((c.display_name || c.email || '?').trim()[0] || '?').toUpperCase() }
</script>

<template>
  <div class="card p-6">
    <div class="flex items-center gap-2.5 mb-4">
      <span class="w-1 h-5 rounded-full bg-gradient-to-b from-violet-400 to-fuchsia-500"></span>
      <h3 class="font-display font-bold text-white flex-1">Conexiones</h3>
      <span class="text-[11px] text-slate-400 tabular-nums">{{ connections.length }}</span>
    </div>

    <div v-if="loading" class="text-slate-400 text-sm">Cargando…</div>
    <div v-else-if="!connections.length" class="text-slate-400 text-sm text-center py-3">Sin conexiones todavía</div>
    <div v-else class="grid grid-cols-5 gap-3">
      <div
        v-for="c in connections"
        :key="c.id"
        class="relative flex justify-center"
        @mouseenter="hoveredId = c.id"
        @mouseleave="hoveredId = null"
      >
        <router-link :to="`/u/${c.id}`" class="block">
          <div class="size-11 rounded-[14px] transition-transform hover:scale-110" :class="[frameStyle(cos[c.id]?.frameKey || 'none').wrap, frameStyle(cos[c.id]?.frameKey || 'none').pad]">
            <div class="w-full h-full rounded-[11px] overflow-hidden grid place-items-center text-xs font-bold text-white" :class="cos[c.id]?.iconGlyph ? iconThemeBg(cos[c.id].iconGlyph) : iconBgStyle(cos[c.id]?.iconBg || 'emerald')">
              <CosmeticIcon v-if="cos[c.id]?.iconGlyph" :iconKey="cos[c.id].iconGlyph" :size="28" />
              <img v-else-if="c.avatar_url" :src="c.avatar_url" class="w-full h-full object-cover" alt="" />
              <span v-else>{{ initial(c) }}</span>
            </div>
          </div>
        </router-link>

        <!-- Previsualización tipo Steam (al hover) -->
        <div v-if="hoveredId === c.id" class="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
          <ProfileHoverCard :user-id="c.id" :name="c.display_name || c.email || 'Usuario'" :avatar-url="c.avatar_url" />
        </div>
      </div>
    </div>
  </div>
</template>
