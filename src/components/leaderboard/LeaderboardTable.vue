<script setup>
/**
 * LISTA DEL RANKING (v4) — una sola lista, sin podio ni medallas infantiles:
 * los 3 primeros van más altos, con el número en degradé metálico (oro,
 * plata, bronce) y una franja de color a la izquierda. Del 4.º para abajo,
 * filas comunes. Tu fila se resalta en azul.
 *
 * rows: [{ rank, user_id, display_name, avatar_url, level, tier, total_xp, cos? }]
 * compact: versión chica para el hub Social (sin nivel/rango debajo del nombre).
 */
import { RouterLink } from 'vue-router'
import UserAvatar from '../common/UserAvatar.vue'
import { initialOf } from '../../services/social-hub'

defineProps({
  rows: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  meId: { type: String, default: '' },
  compact: { type: Boolean, default: false },
  skeleton: { type: Number, default: 8 },
  emptyText: { type: String, default: 'Todavía no hay nadie en este ranking' },
})

const MED = {
  1: { cls: 'med-1', ring: '#fbbf24' },
  2: { cls: 'med-2', ring: '#e2e8f0' },
  3: { cls: 'med-3', ring: '#fb923c' },
}
const fmt = (n) => (Number(n) || 0).toLocaleString('es-AR')
</script>

<template>
  <div>
    <div v-if="loading" class="flex flex-col gap-2" aria-busy="true" aria-label="Cargando ranking">
      <div v-for="i in skeleton" :key="i" class="rk-skel" :class="i <= 3 ? 'h-16' : 'h-[52px]'"></div>
    </div>

    <div v-else-if="!rows.length" class="rounded-2xl border border-white/10 bg-white/[0.03] py-10 px-6 text-center text-sm text-slate-400">{{ emptyText }}</div>

    <ol v-else class="flex flex-col gap-2" role="list">
      <li v-for="(r, i) in rows" :key="r.user_id" class="rk-in" :style="{ animationDelay: Math.min(i, 10) * 30 + 'ms' }">
        <RouterLink :to="'/u/' + r.user_id"
          class="rk-row"
          :class="[MED[r.rank] ? ['rk-medal', MED[r.rank].cls] : 'rk-plain', r.user_id === meId ? 'rk-me' : '']"
          :aria-label="`Puesto ${r.rank}: ${r.user_id === meId ? 'vos' : r.display_name}, ${fmt(r.total_xp)} XP`">
          <template v-if="MED[r.rank]">
            <span class="rk-stripe" aria-hidden="true"></span>
            <span class="rk-pos-metal" aria-hidden="true">{{ r.rank }}</span>
          </template>
          <span v-else class="rk-pos" aria-hidden="true">{{ r.rank }}</span>

          <span class="rk-av" :style="MED[r.rank] && (!r.cos?.frameKey || r.cos.frameKey === 'none') ? { boxShadow: `0 0 0 2px ${MED[r.rank].ring}` } : null">
            <UserAvatar :size="MED[r.rank] && !compact ? 42 : 36" :avatar-url="r.avatar_url || ''" :initial="initialOf(r.display_name)"
              :frame-key="r.cos?.frameKey || 'none'" :icon-glyph="r.cos?.iconGlyph || ''" :icon-bg="r.cos?.iconBg || 'emerald'" :glow="false"
              :level="r.cos?.frameLevel ?? r.level ?? null" :streak="r.cos?.dailyStreak || 0" />
          </span>

          <span class="flex-1 min-w-0 flex flex-col gap-px">
            <span class="rk-name truncate">{{ r.user_id === meId ? 'Vos' : r.display_name }}</span>
            <span v-if="!compact && (r.level != null || r.tier)" class="text-[11px] text-slate-400 truncate">
              <template v-if="r.level != null">Nivel {{ r.level }}</template><template v-if="r.level != null && r.tier"> · </template><template v-if="r.tier">{{ r.tier.label }}</template>
            </span>
          </span>
          <span class="rk-xp tabular-nums">{{ fmt(r.total_xp) }} XP</span>
        </RouterLink>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.rk-row {
  display: flex; align-items: center; gap: 12px; box-sizing: border-box; min-height: 52px;
  padding: 0 12px; border-radius: 16px; color: #fff; text-decoration: none;
  background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
  transition: transform .15s ease, background-color .15s ease;
}
.rk-row:active { transform: scale(.985); }
.rk-medal { min-height: 64px; }
.med-1 { background: linear-gradient(90deg, rgba(251,191,36,0.24), rgba(251,191,36,0.03) 70%); border-color: rgba(251,191,36,0.55); --metal: linear-gradient(180deg,#fff7d6 0%,#fbbf24 50%,#b45309 100%); --accent: linear-gradient(180deg,#fde68a,#d97706); --xp: #fde68a; }
.med-2 { background: linear-gradient(90deg, rgba(203,213,225,0.2), rgba(203,213,225,0.03) 70%); border-color: rgba(203,213,225,0.45); --metal: linear-gradient(180deg,#ffffff 0%,#cbd5e1 50%,#64748b 100%); --accent: linear-gradient(180deg,#f8fafc,#94a3b8); --xp: #e2e8f0; }
.med-3 { background: linear-gradient(90deg, rgba(234,88,12,0.22), rgba(234,88,12,0.03) 70%); border-color: rgba(251,146,60,0.5); --metal: linear-gradient(180deg,#ffedd5 0%,#fb923c 50%,#9a3412 100%); --accent: linear-gradient(180deg,#fed7aa,#c2410c); --xp: #fdba74; }
.rk-me { background: rgba(59,130,246,0.16); border-color: rgba(147,197,253,0.5); }
.rk-stripe { width: 4px; align-self: stretch; margin: 10px 0; border-radius: 999px; background: var(--accent); flex-shrink: 0; }
.rk-pos-metal {
  width: 30px; flex-shrink: 0; text-align: center; font-family: var(--font-shout); font-weight: 800; font-style: italic;
  font-size: 30px; line-height: 1; background: var(--metal); -webkit-background-clip: text; background-clip: text; color: transparent;
}
.rk-pos { width: 38px; flex-shrink: 0; text-align: center; font-family: var(--font-shout); font-weight: 800; font-size: 18px; color: #64748b; }
.rk-av { display: inline-flex; border-radius: 50%; flex-shrink: 0; }
.rk-name { font-weight: 700; font-size: 14px; }
.rk-medal .rk-name { font-size: 15px; }
.rk-xp { font-family: var(--font-display); font-weight: 700; font-size: 13px; color: #e2e8f0; white-space: nowrap; }
.rk-medal .rk-xp { font-size: 15px; color: var(--xp); }
.rk-skel { border-radius: 16px; background: rgba(255,255,255,0.05); animation: rk-pulse 1.4s ease-in-out infinite; }
@keyframes rk-pulse { 50% { opacity: .5 } }
.rk-in { animation: rk-in .32s cubic-bezier(.2,.8,.2,1) both; }
@keyframes rk-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) {
  .rk-in, .rk-skel { animation: none; }
  .rk-row { transition: none; }
}
</style>
