<script setup>
/**
 * JUGAR · LOS 14 JUEGOS (diseño V4 aprobado: V4Jugar)
 *
 * · Cabecera: volver al Inicio, "Los N juegos" y cuándo se reinicia la jornada.
 * · Resumen de la jornada: jugados/total, ganados, perdidos y los que quedan.
 * · Premios de hoy: los logros por victorias del día (3, 5, 10 y todos), con
 *   su estado (cobrado / el próximo / faltan N).
 * · Filtro por tipo (Todos · Contrarreloj · Ordenar · Pensar).
 * · "Te quedan N" (más los bloqueados al final) y "Jugados hoy" con ✓ / ✕.
 * Los datos salen de useJornada (mismos services que el Inicio).
 */
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useJornada, filterTypeFor } from '../components/home/useJornada'
import GameCard from '../components/game/GameCard.vue'
import { tap as tapHaptic } from '../services/haptics'

const j = useJornada()
const { state } = j
onMounted(j.load)

// ── Filtro por tipo ──
const filter = ref('todos')
const FILTERS = [['todos', 'Todos'], ['reloj', 'Contrarreloj'], ['ordenar', 'Ordenar'], ['pensar', 'Pensar']]
const match = (g) => filter.value === 'todos' || filterTypeFor(g.slug) === filter.value
const filters = computed(() => FILTERS.map(([key, label]) => ({
  key, label,
  count: state.games.filter(g => key === 'todos' || filterTypeFor(g.slug) === key).length,
})))
function pick(key) {
  if (filter.value === key) return
  tapHaptic()
  filter.value = key
}

const todoShown = computed(() => j.todo.value.filter(match))
const lockedShown = computed(() => j.locked.value.filter(match))
const playedShown = computed(() => j.played.value.filter(match))
const playedWins = computed(() => playedShown.value.filter(g => j.resultOf(g.slug) === 'win').length)
const playedLosses = computed(() => playedShown.value.length - playedWins.value)

// "1 intento por juego": el límite real del día (PRO puede tener más)
const attempts = computed(() => {
  const r = j.todo.value.map(g => Number(state.availability[g.slug]?.remaining) || 0)
  return Math.max(1, ...r, 1)
})

const kpis = computed(() => [
  { value: j.wins.value, label: j.wins.value === 1 ? 'ganado' : 'ganados', color: '#4ade80' },
  { value: j.losses.value, label: j.losses.value === 1 ? 'perdido' : 'perdidos', color: '#f87171' },
  { value: j.todo.value.length, label: 'te quedan', color: '#fcd34d' },
])

// Premios de hoy: cobrado (✓) · el próximo (dorado) · pendientes
const prizes = computed(() => {
  const next = j.nextMilestone.value
  return j.milestones.value.map(m => {
    const st = m.got ? 'done' : (next && next.at === m.at ? 'next' : '')
    return {
      ...m, st,
      label: m.name,
      sub: m.got ? 'cobrado' : `faltan ${m.left}`,
      aria: `Al ganar ${m.at}: ${m.name}${m.points ? `, +${m.points} XP` : ''}${m.got ? ', cobrado' : ''}`,
    }
  })
})
</script>

<template>
  <section class="jg" aria-label="Los juegos de hoy">
    <!-- Cabecera -->
    <header class="jg-head">
      <RouterLink to="/" class="jg-back" aria-label="Volver al Inicio">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
      </RouterLink>
      <h1 class="jg-title">Los {{ state.games.length || 14 }} juegos</h1>
      <span class="jg-reset" :class="{ soon: j.lastHour.value }">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l3 2" /></svg>
        se reinicia en <span class="tabular-nums">{{ j.resetText.value }}</span>
      </span>
    </header>

    <!-- Resumen de la jornada + premios de hoy -->
    <section class="jg-sum" aria-label="Resumen de la jornada">
      <div class="jg-sum-top">
        <div class="jg-count">
          <span class="lb">JORNADA</span>
          <span class="n">{{ state.loading ? '–' : j.played.value.length }}<small>/{{ state.loading ? '–' : j.total.value }}</small></span>
        </div>
        <div class="jg-kpis">
          <div v-for="k in kpis" :key="k.label" class="kpi">
            <b :style="{ color: k.color }">{{ state.loading ? '–' : k.value }}</b>
            <span>{{ k.label }}</span>
          </div>
        </div>
      </div>
      <div v-if="prizes.length" class="jg-prz">
        <span class="lb">PREMIOS DE HOY</span>
        <div class="jg-prz-row" :style="{ '--n': prizes.length }">
          <div v-for="p in prizes" :key="p.code" class="pz" :class="'is-' + (p.st || 'idle')" :aria-label="p.aria" role="img">
            <span class="dot">
              <svg v-if="p.st === 'done'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
              <template v-else>{{ p.at }}</template>
            </span>
            <span class="nm">{{ p.label }}</span>
            <span class="sb">{{ p.sub }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Filtro por tipo -->
    <div role="tablist" aria-label="Filtrar por tipo de juego" class="jg-filters no-scrollbar">
      <button
        v-for="f in filters" :key="f.key" type="button" role="tab"
        :aria-selected="filter === f.key" :class="{ on: filter === f.key }" @click="pick(f.key)"
      >{{ f.label }}<span class="c">{{ f.count }}</span></button>
    </div>

    <!-- Esqueleto -->
    <div v-if="state.loading" class="jg-grid" aria-busy="true" aria-label="Preparando la jornada">
      <div v-for="k in 9" :key="k" class="sk"></div>
    </div>

    <template v-else>
      <!-- Te quedan -->
      <template v-if="todoShown.length || lockedShown.length">
        <div class="jg-h">
          <h2>Te quedan <span class="g">{{ todoShown.length }}</span></h2>
          <span class="aside">{{ attempts }} {{ attempts === 1 ? 'intento' : 'intentos' }} por juego</span>
        </div>
        <div class="jg-grid">
          <div v-for="(g, i) in todoShown" :key="g.slug" class="cell" :style="{ animationDelay: (i * 40) + 'ms' }">
            <GameCard :data-game-slug="g.slug" :game="g" :unlocked="true" :user-level="state.level"
              :availability="state.availability[g.slug]" :streak="state.streaks[g.slug] || 0" :to="j.toChallenge(g.slug)" />
          </div>
          <div v-for="g in lockedShown" :key="g.slug" class="cell">
            <GameCard :game="g" :unlocked="false" :unlock-level="j.getGameUnlockLevel(g.slug)" :user-level="state.level" />
          </div>
        </div>
      </template>
      <p v-else-if="filter !== 'todos' && !playedShown.length" class="jg-empty">No hay juegos de este tipo.</p>

      <!-- Jugados hoy -->
      <template v-if="playedShown.length">
        <div class="jg-h">
          <h2>Jugados hoy</h2>
          <span class="wl"><span class="w">{{ playedWins }} {{ playedWins === 1 ? 'ganado' : 'ganados' }}</span><span class="sep"> · </span><span class="l">{{ playedLosses }} {{ playedLosses === 1 ? 'perdido' : 'perdidos' }}</span></span>
        </div>
        <div class="jg-grid">
          <div v-for="g in playedShown" :key="g.slug" class="cell">
            <GameCard :data-game-slug="g.slug" :game="g" :unlocked="true" :user-level="state.level"
              :availability="state.availability[g.slug]" :streak="state.streaks[g.slug] || 0" :to="j.toChallenge(g.slug)" />
          </div>
        </div>
      </template>
    </template>
  </section>
</template>

<style scoped>
.jg { --pad: 14px; position: relative; max-width: 640px; margin: -40px auto 0; padding: 0 0 24px; display: flex; flex-direction: column; gap: 12px; color: #f1f5f9; }
.jg::before { content: ""; position: absolute; left: 50%; top: -40px; width: 100vw; height: 240px; transform: translateX(-50%); background: radial-gradient(90% 100% at 50% 0%, rgba(16, 185, 129, .16), transparent 70%); pointer-events: none; z-index: -1; }
@media (max-width: 639px) { .jg { margin-left: -10px; margin-right: -10px; } }

/* cabecera */
.jg-head { height: 56px; display: flex; align-items: center; gap: 4px; margin-left: -10px; }
.jg-back { width: 44px; height: 44px; border-radius: 12px; display: grid; place-items: center; color: #e2e8f0; flex: none; }
.jg-back:active { background: rgba(255, 255, 255, .06); }
.jg-title { flex: 1; min-width: 0; margin: 0; font-family: var(--font-display); font-weight: 700; font-size: 22px; white-space: nowrap; }
.jg-reset { display: flex; align-items: center; gap: 5px; padding: 5px 10px; border-radius: 999px; background: rgba(255, 255, 255, .06); border: 1px solid rgba(255, 255, 255, .08); font-family: var(--font-bug); font-weight: 700; font-size: 14px; color: #cbd5e1; white-space: nowrap; }
.jg-reset.soon { background: rgba(239, 68, 68, .18); border-color: rgba(248, 113, 113, .45); color: #fecaca; }

/* resumen */
.jg-sum { border-radius: 18px; padding: 12px; background: linear-gradient(160deg, #13233f 0%, #0f172a 70%); border: 1px solid rgba(255, 255, 255, .08); display: flex; flex-direction: column; gap: 10px; }
.jg-sum-top { display: flex; align-items: center; gap: 10px; }
.lb { font-size: 10.5px; font-weight: 800; letter-spacing: 1.2px; color: #94a3b8; }
.jg-count { display: flex; flex-direction: column; padding-right: 6px; }
.jg-count .n { font-family: var(--font-bug); font-weight: 800; font-size: 38px; line-height: .9; font-variant-numeric: tabular-nums; }
.jg-count .n small { font-size: 22px; color: #475569; }
.jg-kpis { flex: 1; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
.kpi { border-radius: 12px; padding: 7px 4px; background: rgba(255, 255, 255, .04); display: flex; flex-direction: column; align-items: center; gap: 1px; }
.kpi b { font-family: var(--font-bug); font-weight: 800; font-size: 19px; line-height: 1; font-variant-numeric: tabular-nums; }
.kpi span { font-size: 10.5px; color: #94a3b8; }
.jg-prz { display: flex; flex-direction: column; gap: 6px; }
.jg-prz-row { display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); gap: 6px; }
.pz { position: relative; border-radius: 12px; padding: 7px 4px 6px; background: rgba(255, 255, 255, .03); border: 1px solid rgba(255, 255, 255, .07); display: flex; flex-direction: column; align-items: center; gap: 3px; min-width: 0; }
.pz .dot { width: 26px; height: 26px; border-radius: 50%; background: #1e293b; display: grid; place-items: center; font-family: var(--font-bug); font-weight: 800; font-size: 13px; color: #cbd5e1; }
.pz .nm { font-family: var(--font-bug); font-weight: 800; font-size: 13px; line-height: 1; color: #cbd5e1; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pz .sb { font-size: 10px; color: #64748b; white-space: nowrap; }
.pz.is-done { background: rgba(34, 197, 94, .1); border-color: rgba(74, 222, 128, .35); }
.pz.is-done .dot { background: #22c55e; }
.pz.is-done .nm { color: #86efac; }
.pz.is-next { background: rgba(251, 191, 36, .1); border-color: rgba(251, 191, 36, .45); }
.pz.is-next .dot { background: #fbbf24; color: #451a03; }
.pz.is-next .nm { color: #fde68a; }

/* filtro */
.jg-filters { display: flex; gap: 6px; overflow-x: auto; margin: 0 calc(-1 * var(--pad)); padding: 0 var(--pad); }
.jg-filters button { min-height: 44px; padding: 0 11px; border-radius: 999px; border: 1px solid rgba(255, 255, 255, .1); background: rgba(255, 255, 255, .04); color: #cbd5e1; font: inherit; font-weight: 700; font-size: 13px; display: flex; align-items: center; gap: 6px; cursor: pointer; white-space: nowrap; flex: none; transition: background .2s, color .2s; }
.jg-filters button .c { min-width: 18px; padding: 0 5px; box-sizing: border-box; border-radius: 999px; background: rgba(255, 255, 255, .08); font-family: var(--font-bug); font-weight: 800; font-size: 12px; line-height: 18px; text-align: center; }
.jg-filters button.on { background: linear-gradient(180deg, #fff, #e2e8f0); border-color: #fff; color: #0f172a; }
.jg-filters button.on .c { background: rgba(15, 23, 42, .12); }

/* grillas */
.jg-h { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin-top: 2px; }
.jg-h h2 { margin: 0; font-family: var(--font-display); font-weight: 700; font-size: 17px; }
.jg-h .g { color: #4ade80; }
.jg-h .aside { font-size: 12px; color: #64748b; }
.jg-h .wl { font-family: var(--font-bug); font-weight: 800; font-size: 14px; }
.jg-h .wl .w { color: #4ade80; } .jg-h .wl .l { color: #f87171; } .jg-h .wl .sep { color: #475569; }
.jg-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px 8px; align-items: start; }
@media (min-width: 560px) { .jg-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
.cell { animation: jg-in .32s ease-out both; }
@keyframes jg-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
.jg-empty { margin: 8px 0; text-align: center; font-size: 13px; color: #64748b; }
.sk { aspect-ratio: 4 / 5; border-radius: 14px; background: linear-gradient(100deg, rgba(255, 255, 255, .04) 30%, rgba(255, 255, 255, .09) 50%, rgba(255, 255, 255, .04) 70%) 0 0 / 300% 100%; animation: sk 1.3s linear infinite; }
@keyframes sk { from { background-position: 100% 0; } to { background-position: -50% 0; } }
@media (prefers-reduced-motion: reduce) { .cell, .sk { animation: none; } }
</style>
