<script setup>
/**
 * "TU DÍA" — tarjeta de arriba del Inicio (diseño V4 · opción A).
 * Jugados/total, cuántos te quedan, ganados · perdidos · XP de hoy y la barra
 * de premios del día (logros por victorias: 3, 5, 10 y todos) con su nodo.
 * Todo llega por props desde useJornada (Landing); acá solo se dibuja.
 */
import { computed } from 'vue'

const props = defineProps({
  loading: { type: Boolean, default: false },
  played: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  wins: { type: Number, default: 0 },
  losses: { type: Number, default: 0 },
  xpToday: { type: Number, default: null },   // null = sin dato → "—"
  milestones: { type: Array, default: () => [] },
  next: { type: Object, default: null },
  resetText: { type: String, default: '' },
})

const left = computed(() => Math.max(0, props.total - props.played))
const fmt = (n) => Number(n || 0).toLocaleString('es-AR')
const kpis = computed(() => [
  { value: props.loading ? '–' : fmt(props.wins), label: props.wins === 1 ? 'ganado' : 'ganados', color: '#4ade80' },
  { value: props.loading ? '–' : fmt(props.losses), label: props.losses === 1 ? 'perdido' : 'perdidos', color: '#f87171' },
  { value: props.xpToday == null ? '—' : `+${fmt(props.xpToday)}`, label: 'XP hoy', color: '#fcd34d' },
])
// La barra avanza con las VICTORIAS (los premios se ganan ganando)
const pct = computed(() => props.total > 0 ? Math.min(100, (props.wins / props.total) * 100) : 0)
const nodes = computed(() => props.milestones.map(m => {
  const isNext = props.next && props.next.at === m.at
  const st = m.got ? 'done' : isNext ? 'next' : ''
  const left = Math.max(5, Math.min(95, props.total > 0 ? (m.at / props.total) * 100 : 0))
  return {
    ...m, st, left,
    icon: m.got ? '' : isNext ? 'XP' : String(m.at),
    label: m.owned && !m.got ? `${m.at} · ya es tuyo` : `${m.at} · ${m.points ? `+${fmt(m.points)} XP` : m.name}`,
    aria: `Al ganar ${m.at}: ${m.name}${m.points ? `, más ${m.points} XP` : ''}${m.owned ? ' (ya lo tenés)' : ''}`,
  }
}))
</script>

<template>
  <section class="hd" aria-label="Tu día">
    <div class="hd-top">
      <span class="hd-k">Tu día</span>
      <span v-if="resetText" class="hd-reset">nueva jornada en <span class="tabular-nums">{{ resetText }}</span></span>
    </div>
    <div class="hd-row">
      <div class="hd-count">
        <span class="n">{{ loading ? '–' : played }}<small>/{{ loading ? '–' : total }}</small></span>
        <span class="lft">{{ loading ? '…' : (left > 0 ? `te ${left === 1 ? 'queda' : 'quedan'} ${left}` : '¡completa!') }}</span>
      </div>
      <div class="hd-kpis">
        <div v-for="k in kpis" :key="k.label" class="kpi">
          <b :style="{ color: k.color }">{{ k.value }}</b>
          <span>{{ k.label }}</span>
        </div>
      </div>
    </div>
    <template v-if="nodes.length">
      <div class="hd-track" role="group" :aria-label="`Premios de hoy: ganaste ${wins} de ${total}`">
        <span class="rail"></span>
        <span class="fill" :style="{ width: pct + '%' }"></span>
        <span v-for="n in nodes" :key="n.code" class="node" :class="'is-' + (n.st || 'idle')" :style="{ left: n.left + '%' }" role="img" :aria-label="n.aria">
          <svg v-if="n.st === 'done'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          <template v-else>{{ n.icon }}</template>
        </span>
      </div>
      <div class="hd-labels" aria-hidden="true">
        <span v-for="n in nodes" :key="n.code" :class="'is-' + (n.st || 'idle')">{{ n.label }}</span>
      </div>
    </template>
  </section>
</template>

<style scoped>
.hd { border-radius: 20px; padding: 14px; background: linear-gradient(160deg, #13233f 0%, #0f172a 70%); border: 1px solid rgba(255, 255, 255, .08); display: flex; flex-direction: column; gap: 12px; }
.hd-top { display: flex; align-items: center; justify-content: space-between; }
.hd-k { font-size: 12px; font-weight: 800; letter-spacing: 1.2px; text-transform: uppercase; color: #94a3b8; }
.hd-reset { font-family: var(--font-bug); font-weight: 700; font-size: 14px; color: #64748b; }
.hd-row { display: flex; align-items: center; gap: 14px; }
.hd-count { display: flex; flex-direction: column; }
.hd-count .n { font-family: var(--font-bug); font-weight: 800; font-size: 46px; line-height: .9; font-variant-numeric: tabular-nums; color: #fff; }
.hd-count .n small { font-size: 26px; color: #475569; }
.hd-count .lft { font-size: 13px; font-weight: 700; color: #4ade80; white-space: nowrap; }
.hd-kpis { flex: 1; min-width: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
.kpi { border-radius: 12px; padding: 8px 6px; background: rgba(255, 255, 255, .04); display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 0; }
.kpi b { font-family: var(--font-bug); font-weight: 800; font-size: 20px; line-height: 1; font-variant-numeric: tabular-nums; white-space: nowrap; }
.kpi span { font-size: 10.5px; color: #94a3b8; text-align: center; }
.hd-track { position: relative; height: 40px; }
.hd-track .rail, .hd-track .fill { position: absolute; left: 0; top: 13px; height: 10px; border-radius: 999px; display: block; }
.hd-track .rail { right: 12px; background: rgba(255, 255, 255, .08); }
.hd-track .fill { background: linear-gradient(90deg, #34d399, #22d3ee); transition: width .8s cubic-bezier(.16, 1, .3, 1); }
.node { position: absolute; top: 1px; margin-left: -17px; width: 34px; height: 34px; box-sizing: border-box; border-radius: 50%; display: grid; place-items: center; font-family: var(--font-bug); font-weight: 800; font-size: 13px; background: #1e293b; border: 2px solid #475569; color: #cbd5e1; }
.node.is-done { background: #22c55e; border-color: #bbf7d0; color: #fff; }
.node.is-next { background: #fbbf24; border-color: #fff7d6; color: #451a03; animation: hd-near 1.6s ease-in-out infinite; }
@keyframes hd-near { 0%, 100% { box-shadow: 0 0 0 0 rgba(251, 191, 36, .45); } 50% { box-shadow: 0 0 0 6px rgba(251, 191, 36, 0); } }
.hd-labels { display: flex; justify-content: space-between; gap: 4px; font-size: 10.5px; font-weight: 700; margin-top: -6px; color: #94a3b8; }
.hd-labels span { white-space: nowrap; }
.hd-labels .is-done { color: #4ade80; }
.hd-labels .is-next { color: #fcd34d; }
@media (prefers-reduced-motion: reduce) { .node.is-next { animation: none; } .hd-track .fill { transition: none; } }
</style>
