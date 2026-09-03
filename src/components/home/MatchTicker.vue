<script setup>
defineProps({
  matches: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
})
</script>

<template>
  <div class="relative z-10 full-bleed -mt-10 lg:-mt-12 border-b border-white/8 bg-slate-950/60 backdrop-blur-sm">
    <!-- Loading skeleton -->
    <div v-if="loading && !matches.length" class="flex items-center gap-6 py-2.5 px-4 overflow-hidden">
      <div v-for="i in 8" :key="i" class="h-9 w-[110px] rounded bg-white/5 animate-pulse shrink-0"></div>
    </div>

    <!-- Tira continua tipo Copero: columnas sin caja, separadas por líneas finas -->
    <div v-else-if="matches.length" class="flex items-stretch overflow-x-auto no-scrollbar px-4 sm:px-6">
      <template v-for="(m, i) in matches" :key="m.id">
        <div class="flex flex-col justify-center gap-0.5 py-2 px-3.5 shrink-0 w-[150px]">
          <div class="flex items-center gap-1.5 mb-0.5">
            <img
              v-if="m.leagueLogo"
              :src="m.leagueLogo" width="12" height="12" loading="lazy" decoding="async"
              class="w-3 h-3 object-contain shrink-0 opacity-75" alt=""
              @error="$event.target.style.display='none'"
            />
            <span
              class="text-[9px] font-semibold uppercase tracking-wide truncate"
              :class="m.isLive ? 'text-emerald-400' : 'text-slate-500'"
            >{{ m.isLive ? 'EN VIVO' : m.statusText }}</span>
          </div>
          <div class="flex items-center justify-between gap-1.5">
            <span class="flex items-center gap-1.5 min-w-0">
              <img
                v-if="m.homeId"
                :src="`https://images.fotmob.com/image_resources/logo/teamlogo/${m.homeId}_xsmall.png`"
                width="15" height="15" loading="lazy" decoding="async"
                class="w-[15px] h-[15px] object-contain shrink-0" :alt="m.homeName"
                @error="$event.target.style.display='none'"
              />
              <span class="text-[12px] font-medium text-slate-200 truncate">{{ m.homeName }}</span>
            </span>
            <span class="text-[10px] font-bold tabular-nums text-slate-500 shrink-0">{{ m.homeScore ?? '-' }}</span>
          </div>
          <div class="flex items-center justify-between gap-1.5">
            <span class="flex items-center gap-1.5 min-w-0">
              <img
                v-if="m.awayId"
                :src="`https://images.fotmob.com/image_resources/logo/teamlogo/${m.awayId}_xsmall.png`"
                width="15" height="15" loading="lazy" decoding="async"
                class="w-[15px] h-[15px] object-contain shrink-0" :alt="m.awayName"
                @error="$event.target.style.display='none'"
              />
              <span class="text-[12px] font-medium text-slate-200 truncate">{{ m.awayName }}</span>
            </span>
            <span class="text-[10px] font-bold tabular-nums text-slate-500 shrink-0">{{ m.awayScore ?? '-' }}</span>
          </div>
        </div>
        <div v-if="i < matches.length - 1" class="w-px shrink-0 bg-white/8 my-2.5"></div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.no-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
.no-scrollbar::-webkit-scrollbar { display: none; }
/* Rompe el max-width/padding de <main> para ocupar el 100% del viewport. */
.full-bleed {
  width: 100vw;
  position: relative;
  left: 50%;
  right: 50%;
  margin-left: -50vw;
  margin-right: -50vw;
}
</style>
