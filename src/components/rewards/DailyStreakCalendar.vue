<script setup>
/**
 * DailyStreakCalendar — "escalera" de los 7 sobres de la semana (diseño V4Sobre).
 *
 * Lunes a domingo (hora Argentina). Cada día es un mini sobre igual al grande:
 *  - cobrado: verde con tilde (user_daily_claims de esta semana)
 *  - hoy: índigo con sello dorado que late (o verde si ya lo abriste)
 *  - pasado sin cobrar: apagado
 *  - futuro: gris, con lo que trae
 *  - domingo: sobre DORADO, más grande
 * Lo que trae cada día sale de la regla del servidor (get_daily_reward):
 * lunes a viernes +100 XP, sábado y domingo una ayuda.
 *
 * API sin cambios: props currentStreak/bestStreak/playedToday/todayOpened,
 * emite `open-today` al tocar el sobre de hoy (y `claim`, que queda por compatibilidad).
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { RouterLink } from 'vue-router'
import { appToday, msUntilAppMidnight } from '@/services/app-date'
import { addDaysKey, weekMondayKey, getWeekDailyClaims } from '@/services/streak-calendar'
import { tap } from '@/services/haptics'

const props = defineProps({
  currentStreak: { type: Number, default: 0 },
  bestStreak: { type: Number, default: 0 },
  playedToday: { type: Boolean, default: false },
  // El sobre del día (DailyEnvelope) es la recompensa real: el calendario solo lo refleja
  todayOpened: { type: Boolean, default: false },
})
const emit = defineEmits(['claim', 'open-today'])

const WEEKDAY = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const WIDTHS = [34, 36, 38, 40, 42, 43, 64]

const todayKey = ref(appToday())
const claims = ref(new Set())
const left = ref('')
let timer = null

function tick() {
  const ms = msUntilAppMidnight()
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000)
  left.value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  const k = appToday()
  if (k !== todayKey.value) { todayKey.value = k; loadClaims() }
}
async function loadClaims() { claims.value = await getWeekDailyClaims() }

onMounted(() => { tick(); timer = setInterval(tick, 1000); loadClaims() })
onUnmounted(() => clearInterval(timer))

const monday = computed(() => weekMondayKey(todayKey.value))
const todayIdx = computed(() => WEEKDAY.findIndex((_, i) => addDaysKey(monday.value, i) === todayKey.value))

const PAL = {
  done: { body: '#15803d', pocket: '#22c55e', flap: '#4ade80', ring: '#4ade80' },
  today: { body: '#312e81', pocket: '#4338ca', flap: '#818cf8', ring: '#fbbf24' },
  gold: { body: '#b45309', pocket: '#f59e0b', flap: '#fde68a', ring: '#fff7d6' },
  off: { body: '#1e293b', pocket: '#273449', flap: '#334155', ring: 'rgba(255,255,255,0.12)' },
}

const days = computed(() => WIDTHS.map((w, i) => {
  const key = addDaysKey(monday.value, i)
  const isToday = i === todayIdx.value
  const past = i < todayIdx.value
  const gold = i === 6
  const done = claims.value.has(key) || (isToday && props.todayOpened)
  const missed = past && !done
  const state = done ? 'done' : isToday ? 'today' : gold ? 'gold' : 'off'
  const weekend = i >= 5
  const seal = gold && !done ? 22 : isToday && !done ? 16 : 12
  return {
    key, i, w, h: Math.round(w * 29 / 40), rad: Math.round(w * 4 / 40),
    isToday, done, gold, missed, state, pal: PAL[state], seal,
    showLogo: !done && (isToday || gold),
    canOpen: isToday && !done,
    tag: isToday ? 'HOY' : gold ? 'DORADO' : '',
    val: done || missed ? '' : (weekend ? 'Ayuda' : '+100'),
    unit: done || missed || weekend ? '' : 'XP',
    label: `Día ${i + 1}`,
    aria: `${WEEKDAY[i]}, día ${i + 1}: ${done ? 'sobre cobrado' : missed ? 'no se cobró' : isToday ? 'sobre de hoy, sin abrir' : 'trae ' + (weekend ? 'una ayuda' : '100 XP')}${gold ? ', sobre dorado' : ''}`,
  }
}))

function openToday(d) {
  if (!d.canOpen) return
  tap()
  emit('open-today')
}
</script>

<template>
  <section class="dsc" aria-label="Sobres de la semana">
    <header class="dsc-head">
      <p class="dsc-sub">
        Día {{ todayIdx + 1 }} de 7 · se renueva en <b class="tabular-nums">{{ left }}</b>
      </p>
      <RouterLink to="/racha" class="dsc-streak" :aria-label="`Racha de ${currentStreak} días: ver tu racha`" @click="tap()">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 23c-3.6 0-8-3.1-8-8.5C4 9 8 4 11.5 1c.2-.1.4-.1.5 0 .2.1.2.3.1.5C11 4 14 6 14 6s1-1.5 1.5-4c0-.2.2-.3.4-.3s.3.1.4.3C18 5 20 9 20 14.5 20 19.9 15.6 23 12 23z" fill="currentColor" /></svg>
        <b>{{ currentStreak }}</b>
        <span class="sr-only">días de racha</span>
      </RouterLink>
    </header>

    <ol class="dsc-row">
      <li v-for="d in days" :key="d.key">
        <component :is="d.canOpen ? 'button' : 'div'" :type="d.canOpen ? 'button' : undefined"
                   class="dsc-day" :class="{ open: d.canOpen }" :aria-label="d.aria" @click="openToday(d)">
          <span class="dsc-tag" :class="{ gold: d.gold && !d.isToday }">{{ d.tag }}</span>
          <span class="dsc-env" :class="{ today: d.canOpen, glow: d.gold && !d.done, dim: d.missed }"
                :style="{ width: d.w + 'px', height: d.h + 'px', borderRadius: d.rad + 'px' }">
            <svg aria-hidden="true" viewBox="0 0 40 29" preserveAspectRatio="none">
              <rect x="0" y="0" width="40" height="29" rx="4" :fill="d.pal.body" :stroke="d.pal.ring" stroke-width="0.8" />
              <path d="M0 4.6 L17.6 14.2 Q20 15.8 22.4 14.2 L40 4.6 V25 Q40 29 36 29 H4 Q0 29 0 25 Z" :fill="d.pal.pocket" />
              <path d="M0 4 Q0 0 4 0 H36 Q40 0 40 4 V4.6 L22.5 15.6 Q20 17.2 17.5 15.6 L0 4.6 Z" :fill="d.pal.flap" />
            </svg>
            <span class="dsc-seal" :class="'s-' + d.state" :style="{ width: d.seal + 'px', height: d.seal + 'px' }">
              <svg v-if="d.done" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
              <img v-else-if="d.showLogo" src="/iconclaro.png" alt="" :style="{ width: (d.gold ? 14 : 10) + 'px' }">
            </span>
          </span>
          <span class="dsc-val" :class="{ gold: d.gold, today: d.isToday }">{{ d.val }}<small v-if="d.unit"> {{ d.unit }}</small></span>
          <span class="dsc-lbl" :class="{ done: d.done, today: d.isToday && !d.done, gold: d.gold && !d.done && !d.isToday }">{{ d.label }}</span>
        </component>
      </li>
    </ol>

    <p v-if="bestStreak > 0" class="dsc-best">Mejor racha: <b>{{ bestStreak }} días</b></p>
  </section>
</template>

<style scoped>
.dsc { display: grid; gap: 8px; }
.dsc-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.dsc-sub { margin: 0; font-size: 12px; font-weight: 700; color: #94a3b8; }
.dsc-sub b { color: #fde68a; font-weight: 800; }
.dsc-streak { min-width: 44px; height: 44px; padding: 0 12px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; gap: 4px;
  background: rgba(249, 115, 22, .14); border: 1px solid rgba(249, 115, 22, .45); color: #fb923c; text-decoration: none; }
.dsc-streak svg { width: 16px; height: 16px; }
.dsc-streak b { font-family: var(--font-bug); font-weight: 800; font-size: 18px; color: #fed7aa; line-height: 1; }
.dsc-streak:active { transform: scale(.96); }

.dsc-row { list-style: none; margin: 0; padding: 0; height: 118px; display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)) minmax(0, 1.55fr); gap: 5px; align-items: end; }
.dsc-row > li { display: flex; justify-content: center; min-width: 0; }
.dsc-day { width: 100%; min-height: 44px; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 0; border: 0; background: none; color: inherit; font: inherit; }
.dsc-day.open { cursor: pointer; border-radius: 12px; }
.dsc-day.open:focus-visible { outline: 2px solid #fbbf24; outline-offset: 2px; }
.dsc-day.open:active .dsc-env { transform: scale(.94); }

.dsc-tag { min-height: 13px; font-family: var(--font-bug); font-weight: 800; font-size: 11px; letter-spacing: .5px; line-height: 1.2; color: #fde68a; }
.dsc-tag.gold { color: #fbbf24; }
.dsc-env { position: relative; display: block; flex-shrink: 0; transition: transform .15s; }
.dsc-env > svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.dsc-env.today { filter: drop-shadow(0 4px 6px rgba(0, 0, 0, .4)); animation: dsc-today 2s ease-in-out infinite; }
.dsc-env.glow { filter: drop-shadow(0 0 8px rgba(251, 191, 36, .55)); }
.dsc-env.dim { opacity: .45; }
@keyframes dsc-today { 0%, 100% { box-shadow: 0 0 0 2px #fbbf24, 0 0 0 0 rgba(251, 191, 36, .5); } 50% { box-shadow: 0 0 0 2px #fde68a, 0 0 0 7px rgba(251, 191, 36, 0); } }

.dsc-seal { position: absolute; left: 50%; top: 52%; transform: translate(-50%, -50%); border-radius: 50%; box-sizing: border-box; display: flex; align-items: center; justify-content: center; border: 1.5px solid rgba(255, 255, 255, .15); background: #475569; }
.dsc-seal img { height: auto; }
.s-done { background: #16a34a; border-color: #bbf7d0; }
.s-today { background: radial-gradient(circle at 38% 32%, #fde68a, #f59e0b 60%, #b45309); border-color: #fff7d6; }
.s-gold { background: #1c1206; border-color: #fde68a; }

.dsc-val { min-height: 12px; font-family: var(--font-bug); font-weight: 800; font-size: 12px; line-height: 1; color: #64748b; white-space: nowrap; }
.dsc-val small { font-size: 9px; }
.dsc-val.today { color: #fde68a; }
.dsc-val.gold { color: #fbbf24; font-size: 14px; }
.dsc-lbl { font-size: 10px; font-weight: 700; color: #64748b; white-space: nowrap; }
.dsc-lbl.done { color: #4ade80; }
.dsc-lbl.today { color: #fde68a; }
.dsc-lbl.gold { color: #fbbf24; }

.dsc-best { margin: 0; font-size: 11.5px; color: #94a3b8; }
.dsc-best b { color: #fbbf24; }

@media (prefers-reduced-motion: reduce) { .dsc-env.today { animation: none; box-shadow: 0 0 0 2px #fbbf24; } .dsc-env { transition: none; } }
</style>
