<script setup>
import { RouterLink } from 'vue-router'
const props = defineProps({
  rows: { type: Array, default: () => [] }, // [{rank, user_id, display_name, total_xp, level?}]
  loading: { type: Boolean, default: false },
})
</script>

<template>
  <div class="rounded-xl border border-white/10 overflow-hidden">
    <div class="overflow-x-auto x-scroll">
      <table class="w-full text-xs sm:text-sm text-slate-200" style="min-width: 380px;">
        <thead class="bg-white/5">
          <tr>
            <th class="px-2 sm:px-3 py-2 text-left whitespace-nowrap" style="width: 35px;">#</th>
            <th class="px-2 sm:px-3 py-2 text-left whitespace-nowrap" style="width: 140px;">Usuario</th>
            <th class="px-2 sm:px-3 py-2 text-right whitespace-nowrap" style="width: 70px;">Nivel</th>
            <th class="px-2 sm:px-3 py-2 text-right whitespace-nowrap" style="width: 70px;">XP</th>
          </tr>
        </thead>
        <tbody>
          <template v-if="loading">
            <tr v-for="i in 8" :key="i" class="border-t border-white/10 animate-pulse">
              <td class="px-2 sm:px-3 py-2"><div class="h-4 w-6 bg-white/10 rounded"/></td>
              <td class="px-2 sm:px-3 py-2">
                <div class="flex items-center gap-2">
                  <div class="h-7 w-7 rounded-full bg-white/10 flex-shrink-0"/>
                  <div class="h-4 w-16 bg-white/10 rounded"/>
                </div>
              </td>
              <td class="px-2 sm:px-3 py-2 text-right"><div class="h-4 w-10 bg-white/10 rounded ml-auto"/></td>
              <td class="px-2 sm:px-3 py-2 text-right"><div class="h-4 w-12 bg-white/10 rounded ml-auto"/></td>
            </tr>
          </template>
          <tr v-else-if="!rows.length">
            <td colspan="4" class="px-2 sm:px-3 py-4 text-slate-400 text-center">Sin resultados</td>
          </tr>
          <tr v-else v-for="(r, i) in rows" :key="r.user_id" :class="[
              'border-t border-white/10',
              (r.rank ?? (i+1)) === 1 ? 'bg-amber-500/10 text-amber-100' : '',
              (r.rank ?? (i+1)) === 2 ? 'bg-slate-500/10 text-slate-100' : '',
              (r.rank ?? (i+1)) === 3 ? 'bg-orange-500/10 text-orange-100' : ''
            ]">
            <td class="px-2 sm:px-3 py-2 whitespace-nowrap">
              <span v-if="(r.rank ?? (i+1)) === 1">🥇</span>
              <span v-else-if="(r.rank ?? (i+1)) === 2">🥈</span>
              <span v-else-if="(r.rank ?? (i+1)) === 3">🥉</span>
              <span v-else class="text-xs">{{ r.rank ?? (i+1) }}</span>
            </td>
            <td class="px-2 sm:px-3 py-2" style="max-width: 140px;">
              <div class="flex items-center gap-1.5 min-w-0">
                <div class="h-6 w-6 sm:h-7 sm:w-7 rounded-lg overflow-hidden bg-white/10 grid place-items-center text-[10px] font-bold text-slate-200 flex-shrink-0">
                  <img v-if="r.avatar_url" :src="r.avatar_url" alt="avatar" class="w-full h-full object-cover" />
                  <span v-else>{{ (r.display_name || r.email || '?')?.[0]?.toUpperCase() ?? '?' }}</span>
                </div>
                <RouterLink :to="{ path: '/u/' + r.user_id }" class="hover:underline truncate block text-xs sm:text-sm" :title="r.display_name || r.email || r.user_id?.slice(0,8) || '—'">
                  {{ r.display_name || r.email || r.user_id?.slice(0,8) || '—' }}
                </RouterLink>
              </div>
            </td>
            <td class="px-2 sm:px-3 py-2 text-right whitespace-nowrap">
              <span v-if="r.level != null"
                :class="[
                  'inline-flex items-center rounded-lg px-1.5 py-0.5 text-[10px] sm:text-xs font-bold border shadow-md',
                  r.level >= 30 ? 'border-red-500/50 bg-gradient-to-r from-red-500/20 to-orange-500/20 text-red-200' :
                  r.level >= 20 ? 'border-orange-500/50 bg-gradient-to-r from-orange-500/20 to-amber-500/20 text-orange-200' :
                  r.level >= 10 ? 'border-amber-500/50 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-200' :
                                  'border-emerald-500/50 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-emerald-200'
                ]">
                {{ r.level }}
              </span>
              <span v-else class="text-slate-400 text-xs">—</span>
            </td>
            <td class="px-2 sm:px-3 py-2 text-right font-semibold text-white whitespace-nowrap text-xs sm:text-sm">{{ r.total_xp }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
  
</template>

<style scoped>
.x-scroll {
  -webkit-overflow-scrolling: touch; /* smooth scroll on iOS */
  touch-action: pan-x; /* allow horizontal gestures */
}
</style>

