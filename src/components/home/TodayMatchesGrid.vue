<script setup>
import { ref } from 'vue'
import MatchSummaryModal from './MatchSummaryModal.vue'

defineProps({
  matches: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
})

const selectedMatch = ref(null)
</script>

<template>
  <div>
    <h2 class="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight mb-6">Partidos de hoy</h2>

    <div v-if="loading && !matches.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <div v-for="i in 6" :key="i" class="h-24 rounded-2xl border border-white/10 bg-slate-900/50 animate-pulse"></div>
    </div>

    <div v-else-if="matches.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <button
        v-for="m in matches"
        :key="m.id"
        type="button"
        class="group text-left rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-all hover:border-violet-400/30 hover:bg-white/[0.05] active:scale-[0.98]"
        @click="selectedMatch = m"
      >
        <div class="flex items-center gap-1.5 mb-3">
          <img v-if="m.leagueLogo" :src="m.leagueLogo" width="14" height="14" class="w-3.5 h-3.5 object-contain shrink-0 opacity-75" alt="" @error="$event.target.style.display='none'" />
          <span class="text-[10px] uppercase tracking-wide text-slate-500 font-semibold truncate">{{ m.leagueName }}</span>
          <span v-if="m.isLive" class="ml-auto shrink-0 text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded animate-pulse">VIVO</span>
          <span v-else class="ml-auto shrink-0 text-[10px] text-slate-500 font-semibold">{{ m.finished ? 'Finalizado' : m.statusText }}</span>
        </div>

        <div class="flex items-center gap-2">
          <div class="flex-1 min-w-0 flex items-center gap-2">
            <img v-if="m.homeId" :src="`https://images.fotmob.com/image_resources/logo/teamlogo/${m.homeId}.png`" width="26" height="26" class="w-[26px] h-[26px] object-contain shrink-0" :alt="m.homeName" @error="$event.target.style.display='none'" />
            <span class="text-sm font-semibold text-slate-200 truncate group-hover:text-white transition-colors">{{ m.homeName }}</span>
          </div>
          <span class="shrink-0 font-display text-base font-extrabold text-white tabular-nums">{{ m.homeScore ?? '-' }}</span>
        </div>
        <div class="flex items-center gap-2 mt-2">
          <div class="flex-1 min-w-0 flex items-center gap-2">
            <img v-if="m.awayId" :src="`https://images.fotmob.com/image_resources/logo/teamlogo/${m.awayId}.png`" width="26" height="26" class="w-[26px] h-[26px] object-contain shrink-0" :alt="m.awayName" @error="$event.target.style.display='none'" />
            <span class="text-sm font-semibold text-slate-200 truncate group-hover:text-white transition-colors">{{ m.awayName }}</span>
          </div>
          <span class="shrink-0 font-display text-base font-extrabold text-white tabular-nums">{{ m.awayScore ?? '-' }}</span>
        </div>
      </button>
    </div>

    <div v-else class="rounded-2xl border border-white/10 bg-slate-900/40 p-8 text-center">
      <p class="text-slate-400 text-sm font-medium">No hay partidos programados para hoy en las ligas que seguimos.</p>
    </div>

    <MatchSummaryModal :match="selectedMatch" @close="selectedMatch = null" />
  </div>
</template>
