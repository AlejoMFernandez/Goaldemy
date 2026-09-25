<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import UserAvatar from '../common/UserAvatar.vue'

const props = defineProps({
  spotlight: { type: Object, required: true }, // { loading, period, top: [...] }
  isAuthenticated: { type: Boolean, default: false },
})
const emit = defineEmits(['set-period'])

// Orden visual del podio, igual que LeaderboardTable.vue: 2° (izq) · 1° (centro) · 3° (der).
const podiumCells = computed(() => {
  const [first, second, third] = props.spotlight.top
  return [
    { p: second, rank: 2 },
    { p: first, rank: 1 },
    { p: third, rank: 3 },
  ].filter(c => c.p)
})

const MEDAL = {
  1: { ring: 'ring-amber-400',  glow: 'shadow-[0_0_26px_rgba(251,191,36,0.45)]',  text: 'text-amber-300',  ped: 'from-amber-500/25 to-transparent border-amber-400/50' },
  2: { ring: 'ring-slate-300',  glow: 'shadow-[0_0_20px_rgba(203,213,225,0.35)]', text: 'text-slate-200',  ped: 'from-slate-300/20 to-transparent border-slate-300/40' },
  3: { ring: 'ring-orange-400', glow: 'shadow-[0_0_20px_rgba(251,146,60,0.35)]',  text: 'text-orange-300', ped: 'from-orange-500/20 to-transparent border-orange-400/40' },
}
const nf = new Intl.NumberFormat('es-AR')
</script>

<template>
  <div class="min-h-[260px]">
    <div class="flex items-center justify-between gap-3 mb-6">
      <h2 class="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">Top jugador</h2>
      <div class="inline-flex rounded-xl border border-white/10 bg-white/5 p-1 shrink-0">
        <button
          @click="emit('set-period', 'weekly')"
          :class="['px-3 py-1.5 text-xs font-semibold rounded-lg transition', spotlight.period === 'weekly' ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white' : 'text-slate-400 hover:text-white']"
        >Semana</button>
        <button
          @click="emit('set-period', 'monthly')"
          :class="['px-3 py-1.5 text-xs font-semibold rounded-lg transition', spotlight.period === 'monthly' ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white' : 'text-slate-400 hover:text-white']"
        >Mes</button>
      </div>
    </div>

    <div v-if="spotlight.loading && !spotlight.top.length" class="rounded-3xl border border-white/10 bg-slate-900/40 h-[220px] animate-pulse"></div>

    <div
      v-else-if="podiumCells.length"
      class="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900/70 to-slate-800/40 p-6 sm:p-8 transition-opacity duration-200"
      :class="spotlight.loading ? 'opacity-40 pointer-events-none' : 'opacity-100'"
    >
      <div v-if="!isAuthenticated" class="pointer-events-none absolute -top-24 -right-20 w-72 h-72 rounded-full opacity-20" style="background: radial-gradient(circle, rgba(99,102,241,0.55), transparent 70%);"></div>
      <div v-if="!isAuthenticated" class="pointer-events-none absolute -bottom-28 -left-16 w-72 h-72 rounded-full opacity-10" style="background: radial-gradient(circle, rgba(168,85,247,0.5), transparent 70%);"></div>

      <!-- Podio 2-1-3, mismo patrón que /leaderboards. Ya no hay título "de la
           semana/del mes" acá — es redundante con el toggle Semana/Mes de arriba. -->
      <div class="relative grid grid-cols-3 gap-2 sm:gap-6 items-end max-w-lg mx-auto">
        <div v-for="c in podiumCells" :key="c.rank" class="flex flex-col items-center"
             :class="c.rank === 1 ? 'order-2' : (c.rank === 2 ? 'order-1' : 'order-3')">
          <RouterLink :to="'/u/' + c.p.userId" class="relative block group">
            <div class="rounded-2xl ring-2 transition-transform group-hover:scale-105" :class="[MEDAL[c.rank].ring, MEDAL[c.rank].glow]">
              <UserAvatar
                :size="c.rank === 1 ? 88 : 68"
                :avatar-url="c.p.avatarUrl"
                :initial="(c.p.name || '?')[0]?.toUpperCase()"
                :frame-key="c.p.frameKey"
                :icon-glyph="c.p.iconGlyph"
                :icon-bg="c.p.iconBg"
                :frame-premium="c.p.framePremium"
              />
            </div>
            <div class="absolute -top-2.5 -right-2.5 size-7 rounded-full grid place-items-center font-display font-bold text-sm bg-slate-950 border-2 border-slate-900 shadow-lg" :class="MEDAL[c.rank].text">{{ c.rank }}</div>
          </RouterLink>
          <div class="mt-2.5 text-center min-w-0 w-full px-1">
            <div class="font-bold text-white text-xs sm:text-sm truncate">{{ c.p.name }}</div>
            <div class="text-[11px] font-semibold" :class="MEDAL[c.rank].text">Nivel {{ c.p.level ?? '—' }}</div>
            <div class="font-display font-bold text-white tabular-nums text-sm">{{ nf.format(c.p.xp) }}<span class="text-[9px] text-slate-500 ml-0.5">XP</span></div>
          </div>
          <div class="w-full mt-2 rounded-t-lg bg-gradient-to-b border-t-2" :class="[MEDAL[c.rank].ped, c.rank === 1 ? 'h-12' : (c.rank === 2 ? 'h-8' : 'h-5')]"></div>
        </div>
      </div>

      <div class="relative mt-5 flex justify-end">
        <RouterLink to="/leaderboards" class="group inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-violet-400 transition-colors">
          Ver ranking completo
          <svg class="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
        </RouterLink>
      </div>
    </div>

    <div v-else class="rounded-2xl border border-white/10 bg-slate-900/40 p-10 text-center">
      <p class="text-slate-300 font-medium">Todavía no hay suficiente actividad para armar el ranking {{ spotlight.period === 'weekly' ? 'semanal' : 'mensual' }}</p>
    </div>
  </div>
</template>
