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
  <table class="min-w-[420px] w-full text-xs sm:text-sm text-slate-200">
      <thead class="bg-white/5">
        <tr>
          <th class="px-3 py-2 text-left">#</th>
          <th class="px-3 py-2 text-left">Usuario</th>
          <th class="px-3 py-2 text-right">Nivel</th>
          <th class="px-3 py-2 text-right">XP</th>
        </tr>
      </thead>
      <tbody>
        <template v-if="loading">
          <tr v-for="i in 8" :key="i" class="border-t border-white/10 animate-pulse">
            <td class="px-3 py-2"><div class="h-4 w-6 bg-white/10 rounded"/></td>
            <td class="px-3 py-2">
              <div class="flex items-center gap-2">
                <div class="h-7 w-7 rounded-full bg-white/10"/>
                <div class="h-4 w-40 bg-white/10 rounded"/>
              </div>
            </td>
            <td class="px-3 py-2 text-right"><div class="h-4 w-10 bg-white/10 rounded ml-auto"/></td>
          </tr>
        </template>
        <tr v-else-if="!rows.length">
          <td colspan="3" class="px-3 py-4 text-slate-400">Sin resultados</td>
        </tr>
        <tr v-else v-for="(r, i) in rows" :key="r.user_id" :class="[
            'border-t border-white/10',
            (r.rank ?? (i+1)) === 1 ? 'bg-amber-500/10 text-amber-100' : '',
            (r.rank ?? (i+1)) === 2 ? 'bg-slate-500/10 text-slate-100' : '',
            (r.rank ?? (i+1)) === 3 ? 'bg-orange-500/10 text-orange-100' : ''
          ]">
          <td class="px-3 py-2">
            <span v-if="(r.rank ?? (i+1)) === 1">🥇</span>
            <span v-else-if="(r.rank ?? (i+1)) === 2">🥈</span>
            <span v-else-if="(r.rank ?? (i+1)) === 3">🥉</span>
            <span v-else>{{ r.rank ?? (i+1) }}</span>
          </td>
          <td class="px-3 py-2">
            <div class="flex items-center gap-2 min-w-0">
              <div class="h-7 w-7 rounded-lg overflow-hidden bg-white/10 grid place-items-center text-[11px] font-bold text-slate-200">
                <img v-if="r.avatar_url" :src="r.avatar_url" alt="avatar" class="w-full h-full object-cover" />
                <span v-else>{{ (r.display_name || r.email || '?')?.[0]?.toUpperCase() ?? '?' }}</span>
              </div>
              <RouterLink :to="{ path: '/u/' + r.user_id }" class="hover:underline truncate max-w-[180px] sm:max-w-none">
                {{ r.display_name || r.email || r.user_id?.slice(0,8) || '—' }}
              </RouterLink>
            </div>
          </td>
          <td class="px-3 py-2 text-right">
            <span v-if="r.level != null"
              :class="[
                'inline-flex items-center rounded-full px-2 py-0.5 text-sm ml-auto border',
                r.level >= 30 ? 'border-red-500/40 bg-red-500/10 text-red-300' :
                r.level >= 20 ? 'border-orange-500/40 bg-orange-500/10 text-orange-300' :
                r.level >= 10 ? 'border-amber-500/40 bg-amber-500/10 text-amber-300' :
                                'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
              ]">
              {{ r.level }}
            </span>
            <span v-else class="text-slate-400">—</span>
          </td>
          <td class="px-3 py-2 text-right font-semibold text-white text-base">{{ r.total_xp }}</td>
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
