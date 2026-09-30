<script setup>
/**
 * ÍNDICE DE JUEGOS = LA JORNADA DE HOY (Moodboard 07 · v3 con los ajustes de Alejo)
 *
 * · Marcador de jornada en UNA barra (jugados, ganados, perdidos, racha y el
 *   reloj de reinicio al final, rojo en la última hora). Sin huecos.
 * · Premios de hoy compacto: fila de pelotas (una por juego) con los premios
 *   encima de la pelota donde se ganan. Lo que ya tenés queda con tilde verde.
 * · Al volver de un partido ganado, la pelota vuela del póster a su lugar en la fila.
 * · Juegos: primero los que te quedan, después los jugados (con ✓ / ✕ bien
 *   visible) y al final los bloqueados.
 */
import { onMounted, onBeforeUnmount, reactive, computed, ref, nextTick } from 'vue'
import { fetchGames, gameRouteForSlug } from '../services/games'
import { isChallengeAvailable, fetchDailyWinStreak } from '../services/game-modes'
import { getGameUnlockLevel, isGameUnlocked } from '../services/level-rewards'
import { getUserLevel } from '../services/xp'
import { getAchievementsCatalog, getUserAchievements } from '../services/achievements'
import { achievementIcon } from '../services/achievement-icons'
import { flyTo, sparks, center, reducedMotion } from '../services/game-fx'
import { soundManager } from '../services/sounds'
import { BALL_SVG } from '../services/game-art'
import DailyStreakCalendar from '../components/rewards/DailyStreakCalendar.vue'
import AyudasPanel from '../components/game/AyudasPanel.vue'
import GameCard from '../components/game/GameCard.vue'
import AchievementTile from '../components/rewards/AchievementTile.vue'
import { supabase } from '../services/supabase'

const streakOpen = ref(false)

const state = reactive({
  games: [],
  availability: {},
  streaks: {},
  loading: true,
  dailyStreak: { current: 0, best: 0 },
  userLevel: 1,
  catalog: {},
  owned: new Set(),
})

async function load() {
  state.loading = true
  try {
    const all = await fetchGames()
    const list = (all || []).filter(g => !!g?.slug && gameRouteForSlug(g.slug) !== '/games')
    state.games = list
    const entriesAv = await Promise.all(list.map(async g => [g.slug, await isChallengeAvailable(g.slug)]))
    state.availability = Object.fromEntries(entriesAv)
    const entriesSt = await Promise.all(list.map(async g => [g.slug, await fetchDailyWinStreak(g.slug)]))
    state.streaks = Object.fromEntries(entriesSt)

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const [profileRes, levelRes, catalog, mine] = await Promise.all([
        supabase.from('user_profiles').select('daily_streak, best_daily_streak').eq('id', user.id).single(),
        getUserLevel(null),
        getAchievementsCatalog().catch(() => ({})),
        getUserAchievements(user.id).catch(() => ({ data: [] })),
      ])
      if (profileRes.data) {
        state.dailyStreak.current = profileRes.data.daily_streak || 0
        state.dailyStreak.best = profileRes.data.best_daily_streak || 0
      }
      const lvlInfo = Array.isArray(levelRes.data) ? levelRes.data[0] : levelRes.data
      state.userLevel = Number(lvlInfo?.level) || 1
      state.catalog = catalog || {}
      state.owned = new Set((mine?.data || []).map(r => r?.achievements?.code).filter(Boolean))
    }
  } catch (e) {
    console.error('PlayPoints load error:', e)
  } finally {
    state.loading = false
    nextTick(flyNewWins)
  }
}

onMounted(load)

function toChallenge(slug) {
  const av = state.availability[slug]
  if (av && av.available === false) return `${gameRouteForSlug(slug)}?mode=review`
  return `${gameRouteForSlug(slug)}?mode=challenge`
}

const wonSlugs = computed(() => Object.entries(state.availability || {}).filter(([, av]) => av?.available === false && av.result === 'win').map(([s]) => s))
const totals = computed(() => {
  let loss = 0
  for (const av of Object.values(state.availability || {})) if (av?.available === false && av.result === 'loss') loss++
  return { win: wonSlugs.value.length, loss }
})
const playedCount = computed(() => Object.values(state.availability).filter(a => a?.available === false).length)
const playable = computed(() => state.games.filter(g => isGameUnlocked(g.slug, state.userLevel)))

// Orden de la grilla: los que te quedan → los jugados → los bloqueados
const sortedGames = computed(() => {
  const rank = (g) => {
    if (!isGameUnlocked(g.slug, state.userLevel)) return 2
    return state.availability[g.slug]?.available === false ? 1 : 0
  }
  return state.games.map((g, i) => ({ g, i })).sort((a, b) => rank(a.g) - rank(b.g) || a.i - b.i).map(x => x.g)
})

// ── Premios de hoy (logros por victorias del día) ──
const slotsTotal = computed(() => Math.max(1, playable.value.length))
const MILESTONES = computed(() => {
  const n = slotsTotal.value
  const list = [
    { at: 3, code: 'hat_trick', fallback: 'Hat-trick' },
    { at: 5, code: 'daily_wins_5', fallback: '5 en un día' },
    { at: 10, code: 'daily_wins_10', fallback: '10 en un día' },
    { at: n, code: 'daily_wins_all', fallback: 'Pleno' },
  ]
  const seen = new Set()
  return list.filter(m => m.at <= n && !seen.has(m.at) && seen.add(m.at)).map(m => {
    const cat = state.catalog[m.code] || {}
    return { ...m, name: cat.name || m.fallback, points: cat.points || 0, icon: achievementIcon(m.code), owned: state.owned.has(m.code) }
  })
})
// Las pelotas que se ven: durante el vuelo, las nuevas todavía no llegaron
const shownWins = ref(null)
const winsOnTrack = computed(() => shownWins.value ?? totals.value.win)
const nextMilestone = computed(() => MILESTONES.value.find(m => m.at > winsOnTrack.value && !m.owned) || null)
const allOwned = computed(() => MILESTONES.value.length > 0 && MILESTONES.value.every(m => m.owned))
function msState(m) {
  if (m.owned) return 'owned'
  if (winsOnTrack.value >= m.at) return 'got'
  if (nextMilestone.value === m) return 'near'
  return ''
}

// ── La pelota vuela del póster ganado a la fila (al volver de un partido) ──
const WON_KEY = 'fulvo:jornada_won'
const trackEl = ref(null)
async function flyNewWins() {
  const today = new Date().toDateString()
  let prev = null
  try { const s = JSON.parse(sessionStorage.getItem(WON_KEY) || 'null'); if (s?.date === today) prev = new Set(s.slugs || []) } catch {}
  try { sessionStorage.setItem(WON_KEY, JSON.stringify({ date: today, slugs: wonSlugs.value })) } catch {}
  if (!prev || reducedMotion) return
  const fresh = wonSlugs.value.filter(s => !prev.has(s))
  if (!fresh.length) return
  shownWins.value = totals.value.win - fresh.length
  await nextTick()
  await new Promise(r => setTimeout(r, 450))
  for (const slug of fresh) {
    const from = document.querySelector(`[data-game-slug="${slug}"]`)
    const slot = trackEl.value?.querySelectorAll('.slot')[shownWins.value]
    if (from && slot) {
      soundManager.play('swoosh')
      await flyTo({ from, to: slot, html: `<span class="jor-flyball">${BALL_SVG}</span>`, className: 'gfx-ball', duration: 700, arc: 120 })
    }
    shownWins.value++
    soundManager.play('coin')
    if (slot) { const c = center(slot); sparks(c.x, c.y, 12, ['#fff', '#4ade80', '#fcd34d'], 40) }
    const hit = MILESTONES.value.find(m => m.at === shownWins.value)
    if (hit) {
      await nextTick()
      const chip = trackEl.value?.querySelector(`[data-ms="${hit.at}"] .gifts`)
      if (chip) { const c = center(chip); sparks(c.x, c.y, 22, ['#fcd34d', '#fff'], 70) }
      soundManager.play('combo')
    }
    await new Promise(r => setTimeout(r, 250))
  }
  shownWins.value = null
}

// ── Reloj de reinicio (medianoche) ──
const now = ref(Date.now())
let clock = null
onMounted(() => { clock = setInterval(() => { now.value = Date.now() }, 1000) })
onBeforeUnmount(() => clearInterval(clock))
const msLeft = computed(() => { const m = new Date(now.value); m.setHours(24, 0, 0, 0); return m - now.value })
const resetText = computed(() => {
  const s = Math.max(0, Math.floor(msLeft.value / 1000))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`
})
const lastHour = computed(() => msLeft.value < 3600000)
</script>

<template>
  <section class="mx-auto max-w-5xl jor">
    <!-- ═══ MARCADOR DE LA JORNADA (una sola barra) ═══ -->
    <div class="jbar" role="group" aria-label="Tu jornada de hoy">
      <span class="jf">Jornada</span>
      <span class="jp"><small>Jugados</small><b>{{ playedCount }}<em>/{{ state.loading ? '—' : playable.length }}</em></b></span>
      <span class="jw"><small>Ganados</small><b>{{ totals.win }}</b></span>
      <span class="jl"><small>Perdidos</small><b>{{ totals.loss }}</b></span>
      <button type="button" class="js" :aria-expanded="streakOpen" @click="streakOpen = !streakOpen">
        <small>Racha</small>
        <b><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67z"/></svg>{{ state.dailyStreak.current }}</b>
      </button>
      <span class="jc" :class="{ soon: lastHour }">
        <small>Se reinicia en</small>
        <b><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/></svg>{{ resetText }}</b>
      </span>
    </div>

    <!-- Calendario de racha: se despliega desde el marcador -->
    <div class="streak-panel" :class="{ open: streakOpen }">
      <DailyStreakCalendar :currentStreak="state.dailyStreak.current" :bestStreak="state.dailyStreak.best" :playedToday="playedCount > 0" />
    </div>

    <!-- ═══ PREMIOS DE HOY ═══ -->
    <div v-if="!state.loading" class="prz" :class="{ done: allOwned }">
      <div class="prz-h">
        <span class="t">Premios de hoy</span>
        <span v-if="allOwned" class="ok-pill"><svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 011.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z" clip-rule="evenodd"/></svg>Ya los tenés todos</span>
        <span class="c">Ganados <b>{{ winsOnTrack }}</b>/{{ slotsTotal }}</span>
      </div>
      <div ref="trackEl" class="track" :style="{ '--n': slotsTotal }">
        <div class="balls">
          <span v-for="i in slotsTotal" :key="i" class="slot" :class="{ w: i <= winsOnTrack }">
            <span v-if="i <= winsOnTrack" class="ball" v-html="BALL_SVG"></span>
          </span>
        </div>
        <div
          v-for="m in MILESTONES" :key="m.code" class="ms" :class="'is-' + (msState(m) || 'idle')" :data-ms="m.at"
          :style="{ left: ((m.at - 0.5) / slotsTotal * 100) + '%' }"
          :title="`${m.name}${m.points ? ' · +' + m.points + ' XP' : ''}`"
        >
          <span class="gifts">
            <AchievementTile :icon-key="m.icon.icon" :rarity="m.icon.rarity" :size="26" />
            <span v-if="m.points" class="xp">+{{ m.points }}</span>
            <span v-if="msState(m) === 'owned' || msState(m) === 'got'" class="tick" aria-label="Ya lo tenés">✓</span>
          </span>
        </div>
      </div>
      <p class="prz-n" :class="{ ok: allOwned || (!nextMilestone && totals.win >= slotsTotal) }">
        <template v-if="nextMilestone">Ganá <b>{{ nextMilestone.at - winsOnTrack }} más</b> y te llevás <b>{{ nextMilestone.name }}</b><template v-if="nextMilestone.points"> y +{{ nextMilestone.points }} XP</template>.</template>
        <template v-else-if="totals.win >= slotsTotal">¡Pleno! Ganaste todos los juegos de hoy.</template>
        <template v-else>Ya ganaste todos estos logros. Cada victoria suma a tu racha de cada juego.</template>
      </p>
    </div>

    <!-- Esqueleto mientras carga -->
    <div v-if="state.loading" class="grid-g" aria-busy="true" aria-label="Preparando la jornada">
      <div v-for="k in 10" :key="k" class="sk"></div>
    </div>

    <!-- ═══ JUEGOS: los que te quedan, los jugados y los bloqueados ═══ -->
    <div v-else class="games">
      <div class="grid-g stagger-grid">
        <GameCard
          v-for="g in sortedGames" :key="g.slug"
          :data-game-slug="g.slug"
          :game="g"
          :unlocked="isGameUnlocked(g.slug, state.userLevel)"
          :unlock-level="getGameUnlockLevel(g.slug)"
          :user-level="state.userLevel"
          :availability="state.availability[g.slug]"
          :streak="state.streaks[g.slug] || 0"
          :to="toChallenge(g.slug)"
        />
      </div>

      <!-- Panel de ayudas: qué tenés y en qué juegos aplican (secundario, bajo los juegos) -->
      <AyudasPanel />
    </div>
  </section>
</template>

<style scoped>
.jor { display: grid; gap: 14px; }

/* ── Marcador: una barra que ocupa todo el ancho ── */
.jbar { display: flex; align-items: stretch; min-height: 56px; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 24px rgba(0, 0, 0, .45); font-family: var(--font-bug); font-weight: 800; text-transform: uppercase; }
.jbar > * { display: flex; flex-direction: column; justify-content: center; padding: 6px 16px; white-space: nowrap; line-height: 1; border: 0; font: inherit; text-transform: inherit; text-align: left; flex: 1 1 0; min-width: 0; }
.jbar small { font-size: 11px; letter-spacing: .1em; opacity: .75; margin-bottom: 4px; }
.jbar b { font-size: 26px; font-variant-numeric: tabular-nums; display: flex; align-items: center; gap: 5px; }
.jbar b em { font-style: normal; font-size: .62em; color: #5b6388; }
.jbar b svg { width: 20px; height: 20px; flex: none; }
.jbar .jf { flex: 0 0 auto; background: #fcd34d; color: #141005; font-family: var(--font-shout); font-weight: 800; font-style: italic; font-size: 22px; letter-spacing: .02em; align-items: center; justify-content: center; }
.jbar .jp { background: #141a38; color: #fff; }
.jbar .jw { background: #0b1f18; color: #86efac; }
.jbar .jl { background: #2a0d12; color: #fca5a5; }
.jbar .js { background: #1f1606; color: #fcd34d; cursor: pointer; }
.jbar .js:hover { filter: brightness(1.25); }
.jbar .jc { flex: 1.4 1 0; background: #fff; color: #070a1a; align-items: flex-end; transition: background .3s, color .3s; }
.jbar .jc small { color: #475569; opacity: 1; }
.jbar .jc.soon { background: #ef4444; color: #fff; }
.jbar .jc.soon small { color: #fee2e2; }
@media (max-width: 720px) {
  .jbar { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .jbar > * { padding: 8px 10px; }
  .jbar .jf { grid-column: 1 / 3; font-size: 18px; padding: 8px; }
  .jbar .jc { grid-column: 3 / 5; grid-row: 1; flex-direction: row; align-items: center; justify-content: center; gap: 8px; }
  .jbar .jc small { margin: 0; font-size: 9px; max-width: 5.5em; white-space: normal; line-height: 1.05; }
  .jbar small { font-size: 9.5px; letter-spacing: .06em; }
  .jbar b { font-size: 21px; }
  .jbar .jc b { font-size: 19px; }
}

/* ── Premios de hoy ── */
.prz { background: linear-gradient(180deg, #10163a, #0b1024); border: 1px solid rgba(255, 255, 255, .1); border-radius: 14px; padding: 12px 14px 12px; }
.prz.done { border-color: rgba(74, 222, 128, .35); }
.prz-h { display: flex; align-items: center; gap: 10px; font-family: var(--font-bug); font-weight: 800; text-transform: uppercase; letter-spacing: .08em; font-size: 14px; color: #8b93b8; }
.prz-h .t { color: #dfe4ff; }
.prz-h .c { margin-left: auto; }
.prz-h b { color: #fff; font-size: 1.15em; }
.ok-pill { display: inline-flex; align-items: center; gap: 4px; padding: 3px 9px 3px 6px; border-radius: 999px; background: #16a34a; color: #fff; font-size: 12px; letter-spacing: .06em; box-shadow: 0 0 14px rgba(74, 222, 128, .35); }
.ok-pill svg { width: 14px; height: 14px; }
.track { position: relative; margin-top: 50px; }
.balls { display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); gap: clamp(3px, .7vw, 8px); }
.slot { aspect-ratio: 1; width: 100%; max-width: 38px; justify-self: center; border-radius: 50%; border: 2px dashed rgba(255, 255, 255, .18); display: grid; place-items: center; }
.slot.w { border: 0; box-shadow: 0 0 0 2px #4ade80, 0 0 12px rgba(74, 222, 128, .45); animation: spop .5s cubic-bezier(.34, 1.56, .64, 1) both; border-radius: 50%; }
.ball { display: block; width: 100%; height: 100%; }
.ball :deep(svg) { width: 100%; height: 100%; display: block; }
@keyframes spop { 0% { transform: scale(.2); } 100% { transform: scale(1); } }
.ms { position: absolute; bottom: calc(100% + 8px); transform: translateX(-50%); z-index: 2; display: grid; justify-items: center; }
.ms::after { content: ""; width: 2px; height: 7px; background: rgba(255, 255, 255, .25); }
.ms[data-ms]:last-child { transform: translateX(-80%); }
.ms[data-ms]:last-child::after { justify-self: end; margin-right: 20%; }
.ms .gifts { position: relative; display: flex; gap: 4px; align-items: center; padding: 3px 7px 3px 3px; border-radius: 10px; background: rgba(8, 10, 25, .9); border: 1.5px solid rgba(255, 255, 255, .14); transition: border-color .3s, background .3s; }
.ms .xp { font-family: var(--font-bug); font-weight: 800; font-size: 13px; color: #fcd34d; }
.ms .tick { position: absolute; top: -8px; right: -8px; width: 18px; height: 18px; border-radius: 50%; display: grid; place-items: center; background: #22c55e; color: #fff; font-size: 11px; font-weight: 900; box-shadow: 0 2px 6px rgba(0, 0, 0, .4); }
.ms.is-near .gifts { border-color: #fcd34d; animation: near 1.3s ease-in-out infinite; }
@keyframes near { 0%, 100% { transform: translateY(0); box-shadow: 0 0 0 rgba(252, 211, 77, 0); } 50% { transform: translateY(-3px); box-shadow: 0 0 16px rgba(252, 211, 77, .45); } }
.ms.is-owned .gifts, .ms.is-got .gifts { border-color: #4ade80; background: rgba(22, 101, 52, .55); }
.ms.is-owned .xp, .ms.is-got .xp { color: #bbf7d0; }
.prz-n { margin: 10px 0 0; font-size: 14px; color: #c5cbe8; }
.prz-n b { color: #fcd34d; }
.prz-n.ok { color: #bbf7d0; }
@media (max-width: 560px) {
  .track { margin-top: 56px; }
  .ms .xp { display: none; }
  .ms .gifts { padding: 3px; }
  .prz-h { font-size: 12.5px; flex-wrap: wrap; }
}

/* ── Juegos ── */
.games { display: grid; gap: 20px; }
.grid-g { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 14px; }
@media (max-width: 900px) { .grid-g { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; } }
@media (max-width: 700px) { .grid-g { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; } }
@media (max-width: 460px) { .grid-g { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; } }
.sk { aspect-ratio: 4 / 5; border-radius: 14px; background: linear-gradient(100deg, rgba(255, 255, 255, .04) 30%, rgba(255, 255, 255, .09) 50%, rgba(255, 255, 255, .04) 70%) 0 0 / 300% 100%; animation: sk 1.3s linear infinite; }
@keyframes sk { from { background-position: 100% 0; } to { background-position: -50% 0; } }

/* Racha diaria: se despliega desde el marcador */
.streak-panel { max-height: 0; overflow: hidden; opacity: 0; transition: max-height 0.35s ease, opacity 0.25s ease; margin-top: -14px; }
.streak-panel.open { max-height: 520px; opacity: 1; margin-top: 0; }

@media (prefers-reduced-motion: reduce) {
  .slot.w, .ms.is-near .gifts, .sk { animation: none; }
}
</style>

<style>
/* La pelota que vuela del póster (vive en la capa global de game-fx) */
.jor-flyball { display: block; width: 38px; height: 38px; filter: drop-shadow(0 0 8px rgba(255, 255, 255, .7)); }
.jor-flyball svg { width: 100%; height: 100%; display: block; }
</style>
