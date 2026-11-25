<script setup>
/**
 * Fila de la lista de /logros. En vez del "COBRAR" del diseño (los logros se
 * otorgan solos al desbloquearse) muestra "NUEVO" si se consiguió hace < 48 h.
 */
import { computed } from 'vue'
import AchievementMedal from './AchievementMedal.vue'
import { RARITY, SECRET_DESC, shortDate } from './logros-data'

const props = defineProps({
  item: { type: Object, required: true },
})

const r = computed(() => RARITY[props.item.rarity] || RARITY.common)
const title = computed(() => (props.item.hidden ? '???' : props.item.name))
const desc = computed(() => (props.item.hidden ? SECRET_DESC : props.item.description))
const rarLabel = computed(() => (props.item.secret ? `SECRETO · ${r.value.label}` : r.value.label))
const rarColor = computed(() => (props.item.hidden ? '#64748b' : r.value.color))
const medalState = computed(() => (props.item.hidden ? 'secret' : props.item.done ? 'done' : 'locked'))
const pct = computed(() => {
  const p = props.item.progress
  return p ? Math.round((100 * p.done) / (p.total || 1)) : 0
})
const date = computed(() => shortDate(props.item.earnedAt))
const ariaLabel = computed(() => {
  const parts = [title.value, rarLabel.value]
  if (props.item.done) parts.push(props.item.isNew ? 'nuevo, conseguido ' + date.value : 'conseguido ' + date.value)
  else if (props.item.progress) parts.push(`progreso ${props.item.progress.done} de ${props.item.progress.total}`)
  else parts.push('bloqueado')
  return parts.join(', ')
})
</script>

<template>
  <li class="log-row flex items-center gap-3 px-3 py-2.5 border-b border-white/[0.06] last:border-b-0"
    :class="item.isNew ? 'bg-emerald-500/10' : ''" :aria-label="ariaLabel">
    <AchievementMedal :icon="item.icon" :rarity="item.rarity" :state="medalState" :shine="item.isNew" />

    <span class="flex-1 min-w-0 flex flex-col gap-[3px]">
      <span class="flex items-center gap-1.5 min-w-0">
        <span class="font-extrabold text-sm truncate" :class="item.hidden ? 'text-slate-500' : 'text-slate-100'">{{ title }}</span>
        <span class="shrink-0 text-[9px] font-extrabold tracking-[0.8px]" :style="{ color: rarColor }">{{ rarLabel }}</span>
      </span>
      <span class="text-xs text-slate-400 leading-[1.25]">{{ desc }}</span>
      <span v-if="item.progress" class="flex items-center gap-2">
        <span class="flex-1 h-[7px] rounded-full bg-white/[0.08] overflow-hidden block"
          role="progressbar" :aria-valuenow="item.progress.done" aria-valuemin="0" :aria-valuemax="item.progress.total">
          <span class="log-bar block h-full rounded-full" :style="{ width: pct + '%', background: `linear-gradient(90deg, ${r.color}, #e2e8f0)` }"></span>
        </span>
        <span class="font-bug font-extrabold text-[13px] text-slate-300">{{ item.progress.done }}/{{ item.progress.total }}</span>
      </span>
    </span>

    <span v-if="item.isNew" class="shrink-0 flex flex-col items-center justify-center min-h-[44px] px-3 rounded-xl bg-emerald-500 shadow-[0_4px_0_#15803d] text-white leading-none">
      <span class="font-bug font-extrabold text-[17px]">NUEVO</span>
      <span class="text-[11px] text-emerald-100 mt-0.5">{{ date }}</span>
    </span>
    <span v-else-if="item.done" class="shrink-0 flex flex-col items-end gap-0.5 text-[10px] text-slate-500">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
      {{ date }}
    </span>
  </li>
</template>

<style scoped>
.font-bug { font-family: var(--font-bug); }
.log-bar { transition: width 0.6s cubic-bezier(0.22, 1, 0.36, 1); }
@media (prefers-reduced-motion: reduce) { .log-bar { transition: none; } }
</style>
