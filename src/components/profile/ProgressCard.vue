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
  <div class="card p-6">
    <div>
      <div v-if="loading" class="text-slate-300">Cargando…</div>
      <div v-else>
        <div class="flex items-center gap-2 flex-wrap">
          <span
            v-if="levelInfo"
            :class="[
              'inline-flex items-center rounded-full px-2 py-0.5 text-sm border',
              levelInfo.level >= 30 ? 'border-red-500/40 bg-red-500/10 text-red-300' :
              levelInfo.level >= 20 ? 'border-orange-500/40 bg-orange-500/10 text-orange-300' :
              levelInfo.level >= 10 ? 'border-amber-500/40 bg-amber-500/10 text-amber-300' :
                                       'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
            ]">
            Nivel {{ levelInfo.level }}
          </span>
          <span v-else class="inline-flex items-center rounded-full px-2 py-0.5 text-sm border border-white/20 text-slate-300">Nivel —</span>
          
          <!-- TOP badge -->
          <span v-if="topRank === 1" class="inline-flex items-center rounded-full px-2 py-0.5 text-sm border border-amber-400/50 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-200 font-bold">
            🥇 TOP 1
          </span>
          <span v-else-if="topRank === 2" class="inline-flex items-center rounded-full px-2 py-0.5 text-sm border border-slate-400/50 bg-gradient-to-r from-slate-500/20 to-slate-400/20 text-slate-200 font-bold">
            🥈 TOP 2
          </span>
          <span v-else-if="topRank === 3" class="inline-flex items-center rounded-full px-2 py-0.5 text-sm border border-orange-400/50 bg-gradient-to-r from-orange-600/20 to-amber-600/20 text-orange-200 font-bold">
            🥉 TOP 3
          </span>
        </div>
        <div class="mt-3 grid grid-cols-2 gap-3">
          <div class="rounded-lg border border-white/10 p-3">
            <p class="text-[10px] uppercase tracking-wider text-slate-400">XP actual</p>
            <p class="text-white text-lg font-semibold">{{ xpNow }}</p>
          </div>
          <div class="rounded-lg border border-white/10 p-3">
            <p class="text-[10px] uppercase tracking-wider text-slate-400">Logros</p>
            <p class="text-white text-lg font-semibold">{{ achievementsCount }}</p>
          </div>
        </div>
        <div class="mt-4">
          <p class="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Progreso al próximo nivel</p>
          <div class="h-2 w-full rounded-full bg-white/10 overflow-hidden">
            <div class="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400 transition-all duration-700" :style="{ width: progressPercent + '%' }"></div>
          </div>
          <div class="mt-1 text-xs text-slate-400">
            <template v-if="levelInfo && levelInfo.next_level">
              Faltan {{ levelInfo.xp_to_next }} XP para nivel {{ levelInfo.next_level }}
            </template>
            <template v-else>
              Nivel máximo configurado alcanzado
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
