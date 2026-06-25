<script setup>
import { RouterLink } from 'vue-router'
import { frameStyle, iconBgStyle } from '../../services/cosmetics'
import CosmeticIcon from '../rewards/CosmeticIcon.vue'
const props = defineProps({
  rows: { type: Array, default: () => [] }, // [{rank, user_id, display_name, total_xp, level?, frameKey?, iconGlyph?, iconBg?}]
  loading: { type: Boolean, default: false },
})
</script>

<template>
  <div class="rounded-2xl border border-white/10 overflow-hidden bg-gradient-to-b from-white/[0.04] to-white/[0.01]">
    <div class="overflow-x-auto x-scroll">
      <table class="w-full text-xs sm:text-sm text-slate-200" style="min-width: 380px;">
        <thead class="bg-white/5 text-[11px] uppercase tracking-wider text-slate-400">
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
              <div v-if="(r.rank ?? (i+1)) === 1" class="w-6 h-6 rounded-full bg-amber-500/20 border border-amber-400/40 grid place-items-center"><svg class="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 24 24"><path d="M5 3h14l-1.5 5H20a1 1 0 011 1v1a5 5 0 01-3.5 4.77V16a1 1 0 01-1 1h-1.1l.6 3H8l.6-3H7.5a1 1 0 01-1-1v-1.23A5 5 0 013 10V9a1 1 0 011-1h2.5L5 3z"/></svg></div>
              <div v-else-if="(r.rank ?? (i+1)) === 2" class="w-6 h-6 rounded-full bg-slate-400/15 border border-slate-400/30 grid place-items-center"><svg class="w-3.5 h-3.5 text-slate-300" fill="currentColor" viewBox="0 0 24 24"><path d="M5 3h14l-1.5 5H20a1 1 0 011 1v1a5 5 0 01-3.5 4.77V16a1 1 0 01-1 1h-1.1l.6 3H8l.6-3H7.5a1 1 0 01-1-1v-1.23A5 5 0 013 10V9a1 1 0 011-1h2.5L5 3z"/></svg></div>
              <div v-else-if="(r.rank ?? (i+1)) === 3" class="w-6 h-6 rounded-full bg-orange-500/15 border border-orange-400/30 grid place-items-center"><svg class="w-3.5 h-3.5 text-orange-400" fill="currentColor" viewBox="0 0 24 24"><path d="M5 3h14l-1.5 5H20a1 1 0 011 1v1a5 5 0 01-3.5 4.77V16a1 1 0 01-1 1h-1.1l.6 3H8l.6-3H7.5a1 1 0 01-1-1v-1.23A5 5 0 013 10V9a1 1 0 011-1h2.5L5 3z"/></svg></div>
              <span v-else class="text-xs text-slate-400">{{ r.rank ?? (i+1) }}</span>
            </td>
            <td class="px-2 sm:px-3 py-2" style="max-width: 140px;">
              <div class="flex items-center gap-1.5 min-w-0">
                <div :class="['flex-shrink-0 rounded-full', frameStyle(r.frameKey).wrap, frameStyle(r.frameKey).pad]">
                  <div :class="['h-6 w-6 sm:h-7 sm:w-7 rounded-full overflow-hidden grid place-items-center text-[11px] sm:text-sm', iconBgStyle(r.iconBg)]">
                    <img v-if="r.avatar_url" :src="r.avatar_url" alt="avatar" class="w-full h-full object-cover" />
                    <CosmeticIcon v-else-if="r.iconGlyph" :iconKey="r.iconGlyph" :size="24" />
                    <span v-else class="font-bold text-white">{{ (r.display_name || r.email || '?')?.[0]?.toUpperCase() ?? '?' }}</span>
                  </div>
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
            <td class="px-2 sm:px-3 py-2 text-right font-display font-bold text-white whitespace-nowrap text-xs sm:text-sm tabular-nums">{{ r.total_xp }}</td>
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

