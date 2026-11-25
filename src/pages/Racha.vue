<script setup>
/**
 * RACHA — pantalla de la racha diaria (diseño V4Racha).
 *
 * Datos reales:
 *  - racha actual / récord / último día: user_profiles (getStreakProfile)
 *  - protectores que te quedan: inventario del plan (getPowerupCounts().streakProtector)
 *  - días jugados del mes: game_sessions + xp_events agrupados por día ART
 *    (src/services/streak-calendar.js)
 * "Protectores usados este mes" y la marca celeste del calendario quedan ocultas:
 * el servidor consume los protectores (touch_daily_streak) pero no guarda en qué
 * día, así que no hay de dónde sacarlo.
 */
import { ref, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { appToday } from '@/services/app-date'
import { getPlayedDaysInMonth, getStreakProfile, streakRange, appWeekday, addDaysKey } from '@/services/streak-calendar'
import { getPowerupCounts } from '@/services/premium'

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const HEAD = ['D', 'L', 'M', 'M', 'J', 'V', 'S']

const today = appToday()
const [Y, M] = today.split('-').map(Number)
const monthLabel = `${MONTHS[M - 1]} ${Y}`

const loading = ref(true)
const profile = ref(null)
const protectors = ref(null)   // null = sin datos
const played = ref(new Set())

onMounted(async () => {
  const [p, d, c] = await Promise.allSettled([getStreakProfile(), getPlayedDaysInMonth(Y, M), getPowerupCounts()])
  if (p.status === 'fulfilled') profile.value = p.value
  if (d.status === 'fulfilled') played.value = d.value
  if (c.status === 'fulfilled' && c.value && typeof c.value.streakProtector === 'number') protectors.value = c.value.streakProtector
  loading.value = false
})

const streak = computed(() => profile.value?.current || 0)
const best = computed(() => profile.value?.best || 0)
const range = computed(() => streakRange(profile.value, today))
const playedToday = computed(() => !!profile.value?.lastActivity && profile.value.lastActivity >= today)

const badge = computed(() => streak.value >= 7 ? 'RACHA EN LLAMAS' : streak.value >= 1 ? 'RACHA ENCENDIDA' : 'ARRANCÁ TU RACHA')
const protectorText = computed(() => {
  const n = protectors.value
  if (n == null) return ''
  if (n === 0) return 'No te quedan protectores.'
  return n === 1 ? 'Te queda 1 protector.' : `Te quedan ${n} protectores.`
})

// ─── Calendario del mes ─────────────────────────────────
const cells = computed(() => {
  const first = `${Y}-${String(M).padStart(2, '0')}-01`
  const lead = appWeekday(first)
  const out = []
  for (let i = 0; i < lead; i++) out.push({ blank: true, key: 'b' + i })
  const r = range.value
  for (let n = 1; n <= 31; n++) {
    const key = addDaysKey(first, n - 1)
    if (Number(key.slice(5, 7)) !== M) break
    const dow = appWeekday(key)
    const inBand = !!r && key >= r.start && key <= r.end
    const p = played.value.has(key) || (key === today && playedToday.value)
    const lastOfMonth = Number(addDaysKey(key, 1).slice(5, 7)) !== M
    out.push({
      key, n, played: p, today: key === today, future: key > today, inBand,
      bandL: inBand && (key === r.start || dow === 0 || n === 1),
      bandR: inBand && (key === r.end || dow === 6 || lastOfMonth),
      aria: `${n} de ${MONTHS[M - 1].toLowerCase()}${p ? ', jugado' : ''}${key === today ? ', hoy' : ''}${inBand ? ', dentro de tu racha' : ''}`,
    })
  }
  return out
})
const playedCount = computed(() => cells.value.filter(c => c.played).length)
</script>

<template>
  <section class="racha max-w-xl mx-auto -mt-4 lg:mt-0">
    <!-- Cabecera naranja -->
    <section class="hero" aria-label="Tu racha">
      <span class="hero-badge">{{ badge }}</span>
      <div class="hero-row">
        <div>
          <div class="hero-n" :aria-label="`${streak} días de racha`">{{ loading ? '–' : streak }}</div>
          <div class="hero-l">{{ streak === 1 ? 'día de racha' : 'días de racha' }}</div>
        </div>
        <svg class="flame" :class="{ off: !loading && streak === 0 }" width="120" height="140" viewBox="0 0 24 28" aria-hidden="true">
          <path d="M12 27c-4.6 0-9-3.4-9-9.3C3 11.8 7.5 6 11.4 2.2c.3-.3.8-.1.8.3C12 5.5 15 7.8 15 7.8s1.2-1.7 1.7-4.4c.1-.4.6-.5.8-.2C20 6.4 21 11 21 17.7 21 23.6 16.6 27 12 27z" fill="#fde68a" />
          <path d="M12 27c-2.8 0-5.5-2.1-5.5-5.7 0-3.6 2.7-6.8 5-9 .2-.2.5 0 .5.2 0 1.8 1.8 3.2 1.8 3.2s.8-1 1-2.6c0-.3.4-.3.5-.1 1.3 1.9 2.2 4.4 2.2 8.3 0 3.6-2.7 5.7-5.5 5.7z" fill="#fff7ed" />
        </svg>
      </div>
      <div class="hero-msg">
        <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l8 3.5v6c0 5-3.4 9-8 10.5C7.4 20.5 4 16.5 4 11.5v-6z" fill="#38bdf8" stroke="#0369a1" stroke-width="1.5" /><path d="M8.5 12l2.5 2.5 4.5-5" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" /></svg>
        <span>
          <template v-if="!loading && streak > 0 && !playedToday">Todavía no jugaste hoy: <strong>jugá 1 juego</strong> para no perderla.</template>
          <template v-else-if="!loading && streak === 0">Jugá <strong>1 juego hoy</strong> para arrancarla.</template>
          <template v-else>Jugá al menos <strong>1 juego por día</strong> para no perderla.</template>
          {{ protectorText }}
        </span>
      </div>
      <RouterLink v-if="!loading && !playedToday" to="/" class="hero-cta">Jugar ahora</RouterLink>
    </section>

    <div class="body">
      <!-- Récord (y "protectores usados este mes" cuando el servidor lo registre) -->
      <div v-if="best > 0" class="stats">
        <div class="stat">
          <span class="stat-tag">RÉCORD</span>
          <div class="stat-n">{{ best }}</div>
          <div class="stat-l">racha más larga</div>
        </div>
      </div>

      <!-- Calendario del mes -->
      <section class="cal" :aria-label="`Calendario de ${monthLabel}`">
        <div class="cal-h">
          <span class="cal-t">{{ monthLabel }}</span>
          <span class="cal-c">{{ loading ? '…' : `${playedCount} ${playedCount === 1 ? 'día jugado' : 'días jugados'}` }}</span>
        </div>
        <div class="cal-g" role="list">
          <span v-for="(h, i) in HEAD" :key="'h' + i" class="cal-hd" aria-hidden="true">{{ h }}</span>
          <span v-for="c in cells" :key="c.key" class="cal-cell" role="listitem" :aria-label="c.blank ? undefined : c.aria" :aria-hidden="c.blank ? 'true' : undefined"
                :class="{ band: c.inBand, bl: c.bandL, br: c.bandR }">
            <span v-if="!c.blank" class="cal-d" :class="{ played: c.played, today: c.today, future: c.future }">{{ c.n }}</span>
          </span>
        </div>
        <div class="cal-legend">
          <span><i class="lg-played"></i>Jugado</span>
          <span><i class="lg-band"></i>Racha actual</span>
          <span><i class="lg-today"></i>Hoy</span>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.racha { color: #f1f5f9; }
.hero { position: relative; overflow: hidden; border-radius: 24px; padding: 20px 18px 18px;
  background: linear-gradient(165deg, #f97316 0%, #c2410c 70%, #7c2d12 100%); box-shadow: 0 14px 34px rgba(194, 65, 12, .35); }
.hero-badge { display: inline-block; padding: 4px 10px; border-radius: 8px; background: rgba(255, 255, 255, .22); border: 1px solid rgba(255, 255, 255, .4);
  font-family: var(--font-bug); font-weight: 800; font-size: 13px; letter-spacing: 1.5px; }
.hero-row { display: flex; align-items: center; justify-content: space-between; }
.hero-n { font-family: var(--font-shout); font-weight: 800; font-style: italic; font-size: 96px; line-height: .95; text-shadow: 0 4px 0 rgba(124, 45, 18, .6); font-variant-numeric: tabular-nums; }
.hero-l { font-family: var(--font-display); font-weight: 700; font-size: 20px; }
.flame { flex-shrink: 0; transform-origin: 50% 90%; animation: flick 2.4s ease-in-out infinite; filter: drop-shadow(0 6px 14px rgba(254, 215, 170, .45)); }
.flame.off { opacity: .45; animation: none; }
@keyframes flick { 0%, 100% { transform: scale(1) rotate(0); } 40% { transform: scale(1.06) rotate(-3deg); } 70% { transform: scale(.98) rotate(2deg); } }
.hero-msg { margin-top: 10px; border-radius: 14px; background: rgba(255, 255, 255, .95); color: #431407; padding: 10px 12px; display: flex; align-items: center; gap: 10px; font-size: 13px; font-weight: 600; line-height: 1.35; }
.hero-msg svg { flex-shrink: 0; }
.hero-msg strong { color: #c2410c; }
.hero-cta { margin-top: 10px; min-height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; background: #1c1206; color: #fde68a;
  font-family: var(--font-shout); font-weight: 800; font-style: italic; font-size: 20px; letter-spacing: 1px; text-transform: uppercase; text-decoration: none; }
.hero-cta:active { transform: scale(.98); }

.body { padding: 16px 0 8px; display: flex; flex-direction: column; gap: 14px; }
.stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; padding-top: 6px; }
.stat { position: relative; border-radius: 14px; border: 1px solid rgba(255, 255, 255, .1); padding: 10px 12px; }
.stat-tag { position: absolute; top: -10px; right: 10px; padding: 2px 8px; border-radius: 6px; background: #f97316; font-family: var(--font-bug); font-weight: 800; font-size: 12px; }
.stat-n { font-family: var(--font-bug); font-weight: 800; font-size: 28px; line-height: 1; }
.stat-l { font-size: 12px; color: #94a3b8; }

.cal { border-radius: 18px; border: 1px solid rgba(255, 255, 255, .1); padding: 12px; }
.cal-h { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.cal-t { font-family: var(--font-display); font-weight: 700; font-size: 17px; }
.cal-c { font-size: 12px; color: #94a3b8; }
.cal-g { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); row-gap: 6px; text-align: center; }
.cal-hd { font-size: 11px; font-weight: 700; color: #64748b; }
.cal-cell { height: 32px; display: flex; align-items: center; justify-content: center; }
.cal-cell.band { background: rgba(249, 115, 22, .18); }
.cal-cell.bl { border-top-left-radius: 16px; border-bottom-left-radius: 16px; }
.cal-cell.br { border-top-right-radius: 16px; border-bottom-right-radius: 16px; }
.cal-d { width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: #64748b; }
.cal-d.future { color: #334155; }
.cal-d.played { background: #f97316; color: #fff; }
.cal-d.today { box-shadow: 0 0 0 2px #fbbf24; }
.cal-legend { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 10px; font-size: 11px; color: #94a3b8; }
.cal-legend span { display: flex; align-items: center; gap: 5px; }
.cal-legend i { width: 10px; height: 10px; border-radius: 50%; display: inline-block; box-sizing: border-box; }
.lg-played { background: #f97316; }
.lg-band { background: rgba(249, 115, 22, .35); }
.lg-today { border: 2px solid #fbbf24; }

@media (prefers-reduced-motion: reduce) { .flame { animation: none; } }
</style>
