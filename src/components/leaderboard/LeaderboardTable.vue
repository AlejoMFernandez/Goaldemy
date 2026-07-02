<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { frameStyle, iconBgStyle, iconThemeBg } from '../../services/cosmetics'
import CosmeticIcon from '../rewards/CosmeticIcon.vue'

const props = defineProps({
  rows: { type: Array, default: () => [] }, // [{rank, user_id, display_name, total_xp, level?, frameKey?, iconGlyph?, iconBg?, avatar_url?}]
  loading: { type: Boolean, default: false },
  podium: { type: Boolean, default: false }, // mostrar podio del top 3 (solo página 0)
  meId: { type: String, default: '' },       // resaltar mi fila
})

const showPodium = computed(() => props.podium && props.rows.length >= 3)
// Orden visual del podio: 2° (izq) · 1° (centro) · 3° (der)
const podiumCells = computed(() => showPodium.value
  ? [{ r: props.rows[1], rank: 2 }, { r: props.rows[0], rank: 1 }, { r: props.rows[2], rank: 3 }]
  : [])
const ladderRows = computed(() => showPodium.value ? props.rows.slice(3) : props.rows)

const MEDAL = {
  1: { ring: 'ring-amber-400',  glow: 'shadow-[0_0_26px_rgba(251,191,36,0.45)]',  text: 'text-amber-300',  ped: 'from-amber-500/25 to-transparent border-amber-400/50' },
  2: { ring: 'ring-slate-300',  glow: 'shadow-[0_0_20px_rgba(203,213,225,0.35)]', text: 'text-slate-200',  ped: 'from-slate-300/20 to-transparent border-slate-300/40' },
  3: { ring: 'ring-orange-400', glow: 'shadow-[0_0_20px_rgba(251,146,60,0.35)]',  text: 'text-orange-300', ped: 'from-orange-500/20 to-transparent border-orange-400/40' },
}

function name(r) { return r?.display_name || r?.email || r?.user_id?.slice(0, 8) || '—' }
function initial(r) { return (name(r)[0] || '?').toUpperCase() }
function levelClass(lvl) {
  if (lvl == null) return 'border-white/10 text-slate-400'
  if (lvl >= 30) return 'border-red-500/50 bg-gradient-to-r from-red-500/20 to-orange-500/20 text-red-200'
  if (lvl >= 20) return 'border-orange-500/50 bg-gradient-to-r from-orange-500/20 to-amber-500/20 text-orange-200'
  if (lvl >= 10) return 'border-amber-500/50 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-200'
  return 'border-emerald-500/50 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-emerald-200'
}
</script>

<template>
  <div>
    <!-- Loading -->
    <div v-if="loading" class="space-y-2">
      <div class="h-40 rounded-2xl bg-white/5 animate-pulse mb-4"></div>
      <div v-for="i in 6" :key="i" class="h-12 rounded-xl bg-white/5 animate-pulse"></div>
    </div>

    <div v-else-if="!rows.length" class="rounded-2xl border border-white/10 bg-white/[0.02] py-14 text-center text-slate-400">Sin resultados</div>

    <template v-else>
      <!-- PODIO (top 3) -->
      <div v-if="showPodium" class="grid grid-cols-3 gap-2 sm:gap-5 items-end mb-6">
        <div v-for="c in podiumCells" :key="c.rank" class="flex flex-col items-center"
             :class="c.rank === 1 ? 'order-2' : (c.rank === 2 ? 'order-1' : 'order-3')">
          <RouterLink :to="'/u/' + c.r.user_id" class="relative block group">
            <div class="rounded-2xl ring-2 transition-transform group-hover:scale-105" :class="[MEDAL[c.rank].ring, MEDAL[c.rank].glow]">
              <div :class="[frameStyle(c.r.frameKey).wrap, frameStyle(c.r.frameKey).pad, 'rounded-2xl']">
                <div :class="['rounded-xl overflow-hidden grid place-items-center text-white font-extrabold', c.rank === 1 ? 'size-20 sm:size-24 text-3xl' : 'size-16 sm:size-20 text-2xl', c.r.iconGlyph ? iconThemeBg(c.r.iconGlyph) : iconBgStyle(c.r.iconBg)]">
                  <img v-if="c.r.avatar_url" :src="c.r.avatar_url" alt="" class="w-full h-full object-cover" />
                  <CosmeticIcon v-else-if="c.r.iconGlyph" :iconKey="c.r.iconGlyph" :size="c.rank === 1 ? 72 : 56" />
                  <span v-else>{{ initial(c.r) }}</span>
                </div>
              </div>
            </div>
            <div class="absolute -top-2.5 -right-2.5 size-7 rounded-full grid place-items-center font-display font-extrabold text-sm bg-slate-950 border-2 border-slate-900 shadow-lg" :class="MEDAL[c.rank].text">{{ c.rank }}</div>
          </RouterLink>
          <div class="mt-2.5 text-center min-w-0 w-full px-1">
            <div class="font-bold text-white text-xs sm:text-sm truncate">{{ name(c.r) }}</div>
            <div class="text-[11px] font-semibold" :class="MEDAL[c.rank].text">Nivel {{ c.r.level ?? '—' }}</div>
            <div class="font-display font-extrabold text-white tabular-nums text-sm">{{ (c.r.total_xp || 0).toLocaleString() }}<span class="text-[9px] text-slate-500 ml-0.5">XP</span></div>
          </div>
          <div class="w-full mt-2 rounded-t-lg bg-gradient-to-b border-t-2" :class="[MEDAL[c.rank].ped, c.rank === 1 ? 'h-12' : (c.rank === 2 ? 'h-8' : 'h-5')]"></div>
        </div>
      </div>

      <!-- LADDER (resto) -->
      <div class="space-y-1.5">
        <RouterLink v-for="r in ladderRows" :key="r.user_id" :to="'/u/' + r.user_id"
          class="flex items-center gap-2.5 sm:gap-3 rounded-xl border px-2.5 sm:px-3 py-2 transition"
          :class="r.user_id === meId ? 'border-emerald-400/50 bg-emerald-500/[0.12]' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'">
          <span class="w-6 sm:w-7 text-center font-display font-bold text-slate-400 tabular-nums shrink-0">{{ r.rank }}</span>
          <div :class="[frameStyle(r.frameKey).wrap, frameStyle(r.frameKey).pad, 'rounded-lg shrink-0']">
            <div :class="['size-8 sm:size-9 rounded-md overflow-hidden grid place-items-center text-xs font-bold text-white', r.iconGlyph ? iconThemeBg(r.iconGlyph) : iconBgStyle(r.iconBg)]">
              <img v-if="r.avatar_url" :src="r.avatar_url" alt="" class="w-full h-full object-cover" />
              <CosmeticIcon v-else-if="r.iconGlyph" :iconKey="r.iconGlyph" :size="24" />
              <span v-else>{{ initial(r) }}</span>
            </div>
          </div>
          <span class="flex-1 min-w-0 truncate text-sm text-white font-medium">
            {{ name(r) }}<span v-if="r.user_id === meId" class="text-[10px] text-emerald-300 ml-1 font-bold">(vos)</span>
          </span>
          <span class="inline-flex items-center rounded-lg px-1.5 py-0.5 text-[10px] sm:text-xs font-bold border shrink-0" :class="levelClass(r.level)">{{ r.level ?? '—' }}</span>
          <span class="font-display font-bold text-white tabular-nums text-xs sm:text-sm w-14 sm:w-16 text-right shrink-0">{{ (r.total_xp || 0).toLocaleString() }}</span>
        </RouterLink>
      </div>
    </template>
  </div>
</template>
