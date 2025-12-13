<script setup>
defineProps({
  levelInfo: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  xpNow: { type: Number, default: 0 },
  progressPercent: { type: Number, default: 0 },
  achievementsCount: { type: Number, default: 0 },
  topRank: { type: Number, default: null },
})
</script>

<template>
  <div class="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/50 backdrop-blur p-6 shadow-xl">
    <div>
      <div v-if="loading" class="text-center py-8 text-slate-400">
        <div class="animate-pulse">Cargando progreso...</div>
      </div>
      <div v-else>
        <div class="flex items-center gap-2 flex-wrap mb-4">
          <span
            v-if="levelInfo"
            :class="[
              'inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-bold border shadow-lg',
              levelInfo.level >= 30 ? 'border-red-500/50 bg-gradient-to-r from-red-500/20 to-orange-500/20 text-red-200' :
              levelInfo.level >= 20 ? 'border-orange-500/50 bg-gradient-to-r from-orange-500/20 to-amber-500/20 text-orange-200' :
              levelInfo.level >= 10 ? 'border-amber-500/50 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-200' :
                                       'border-emerald-500/50 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-emerald-200'
            ]">
            🎯 Nivel {{ levelInfo.level }}
          </span>
          <span v-else class="inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-bold border border-white/20 bg-slate-700/30 text-slate-300">Nivel —</span>
          
          <!-- TOP badge -->
          <span v-if="topRank === 1" class="inline-flex items-center rounded-lg px-3 py-1.5 text-sm border border-amber-400/50 bg-gradient-to-r from-amber-500/30 to-yellow-500/30 text-amber-100 font-bold shadow-lg shadow-amber-500/20">
            🥇 TOP 1
          </span>
          <span v-else-if="topRank === 2" class="inline-flex items-center rounded-lg px-3 py-1.5 text-sm border border-slate-400/50 bg-gradient-to-r from-slate-500/30 to-slate-400/30 text-slate-100 font-bold shadow-lg">
            🥈 TOP 2
          </span>
          <span v-else-if="topRank === 3" class="inline-flex items-center rounded-lg px-3 py-1.5 text-sm border border-orange-400/50 bg-gradient-to-r from-orange-600/30 to-amber-600/30 text-orange-100 font-bold shadow-lg">
            🥉 TOP 3
          </span>
        </div>
        
        <div class="grid grid-cols-2 gap-3 mb-5">
          <div class="rounded-xl border border-white/10 bg-gradient-to-br from-slate-800/60 to-slate-700/40 p-4 hover:border-emerald-500/30 transition-all">
            <p class="text-[10px] uppercase tracking-wider text-slate-400 mb-1">XP Total</p>
            <p class="text-white text-2xl font-bold">{{ xpNow.toLocaleString() }}</p>
          </div>
          <div class="rounded-xl border border-white/10 bg-gradient-to-br from-slate-800/60 to-slate-700/40 p-4 hover:border-emerald-500/30 transition-all">
            <p class="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Logros</p>
            <p class="text-white text-2xl font-bold">{{ achievementsCount }}</p>
          </div>
        </div>
        
        <div class="rounded-xl border border-white/10 bg-slate-800/30 p-4">
          <p class="text-[10px] uppercase tracking-wider text-slate-400 mb-2">Progreso al próximo nivel</p>
          <div class="h-3 w-full rounded-full bg-slate-900/50 overflow-hidden shadow-inner border border-white/5">
            <div class="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400 transition-all duration-700 shadow-lg" :style="{ width: progressPercent + '%' }"></div>
          </div>
          <div class="mt-2 flex items-center justify-between text-xs">
            <span class="text-slate-400">{{ progressPercent }}%</span>
            <span class="font-semibold" :class="levelInfo?.xp_to_next <= 100 ? 'text-emerald-300' : 'text-slate-300'">
              <template v-if="levelInfo && levelInfo.next_level">
                {{ levelInfo.xp_to_next }} XP → Nivel {{ levelInfo.next_level }}
              </template>
              <template v-else>
                Nivel máximo alcanzado
              </template>
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

