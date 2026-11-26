/**
 * LA JORNADA DE HOY — datos compartidos entre el Inicio (Landing logueada) y
 * el índice de los 14 juegos (/play/points). Solo LECTURA: junta lo que ya
 * exponen los services (fetchGames, isChallengeAvailable, nivel, logros) y
 * arma las listas y los premios del día. Sin lógica de negocio nueva.
 *
 *  - todo / played / locked: los que te quedan, los jugados y los bloqueados.
 *  - milestones: los premios de hoy = logros por victorias del día (3, 5, 10 y
 *    todos), con su XP real del catálogo. Mismas reglas que tenía PlayPoints.
 *  - countdown: cuánto falta para la nueva jornada (medianoche de Argentina).
 */
import { reactive, computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { fetchGames, gameRouteForSlug } from '../../services/games'
import { getGameUnlockLevel, isGameUnlocked } from '../../services/level-rewards'
import { msUntilAppMidnight } from '../../services/app-date'
import { GAME_POSTER_META } from '../../services/game-art'

/** Tipo de filtro del índice (diseño V4): Contrarreloj · Ordenar · Pensar. */
export function filterTypeFor(slug) {
  const t = GAME_POSTER_META[slug]?.type
  if (t === 'timed') return 'reloj'
  if (t === 'order') return 'ordenar'
  return 'pensar'
}

/** "09:42" (h:mm) o "42:10" (mm:ss en la última hora). */
export function formatReset(ms) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60
  return h > 0 ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`
}

export function useJornada({ withStreaks = true } = {}) {
  const state = reactive({
    loading: true,
    error: false,
    games: [],
    availability: {},
    streaks: {},
    level: 1,
    catalog: {},
    owned: new Set(),
  })

  async function load() {
    state.loading = true
    state.error = false
    try {
      // Import diferido: game-modes / logros arrastran un grafo pesado que no
      // tiene que caer en el chunk inicial de la home.
      const [{ isChallengeAvailable, fetchDailyWinStreak }, { getUserLevel }, ach, { supabase }] = await Promise.all([
        import('../../services/game-modes'),
        import('../../services/xp'),
        import('../../services/achievements'),
        import('../../services/supabase'),
      ])
      const all = await fetchGames()
      const list = (all || []).filter(g => !!g?.slug && gameRouteForSlug(g.slug) !== '/games')
      state.games = list
      const { data: { user } = {} } = await supabase.auth.getUser().catch(() => ({ data: {} }))
      const [avs, lvlRes, catalog, mine] = await Promise.all([
        Promise.all(list.map(async g => [g.slug, await isChallengeAvailable(g.slug).catch(() => null)])),
        user ? getUserLevel(null).catch(() => null) : null,
        user ? ach.getAchievementsCatalog().catch(() => ({})) : {},
        user ? ach.getUserAchievements(user.id).catch(() => ({ data: [] })) : { data: [] },
      ])
      state.availability = Object.fromEntries(avs)
      const info = Array.isArray(lvlRes?.data) ? lvlRes.data[0] : lvlRes?.data
      state.level = Number(info?.level) || 1
      state.catalog = catalog || {}
      state.owned = new Set((mine?.data || []).map(r => r?.achievements?.code).filter(Boolean))
      state.loading = false
      if (withStreaks) {
        const sts = await Promise.all(list.map(async g => [g.slug, await fetchDailyWinStreak(g.slug).catch(() => 0)]))
        state.streaks = Object.fromEntries(sts)
      }
    } catch (e) {
      console.warn('[jornada] load error', e)
      state.error = true
    } finally {
      state.loading = false
    }
  }

  const isPlayed = (slug) => state.availability[slug]?.available === false
  const resultOf = (slug) => state.availability[slug]?.result || null
  const unlocked = (slug) => isGameUnlocked(slug, state.level)

  const playable = computed(() => state.games.filter(g => unlocked(g.slug)))
  const todo = computed(() => playable.value.filter(g => !isPlayed(g.slug)))
  const played = computed(() => playable.value.filter(g => isPlayed(g.slug)))
  const locked = computed(() => state.games.filter(g => !unlocked(g.slug)))
  const wins = computed(() => played.value.filter(g => resultOf(g.slug) === 'win').length)
  const losses = computed(() => played.value.length - wins.value)
  const total = computed(() => playable.value.length)
  const allDone = computed(() => !state.loading && total.value > 0 && todo.value.length === 0)

  // ── Premios de hoy (logros por victorias del día) ──
  const milestones = computed(() => {
    const n = Math.max(1, total.value)
    const list = [
      { at: 3, code: 'hat_trick', fallback: 'Hat-trick' },
      { at: 5, code: 'daily_wins_5', fallback: '5 en un día' },
      { at: 10, code: 'daily_wins_10', fallback: '10 en un día' },
      { at: n, code: 'daily_wins_all', fallback: 'Pleno' },
    ]
    const seen = new Set()
    return list.filter(m => m.at <= n && !seen.has(m.at) && seen.add(m.at)).map(m => {
      const cat = state.catalog[m.code] || {}
      const owned = state.owned.has(m.code)
      // 'got' = alcanzado HOY (la barra es del día). 'owned' = logro ya cobrado alguna vez.
      const got = wins.value >= m.at
      return { ...m, name: cat.name || m.fallback, points: Number(cat.points) || 0, owned, got, left: Math.max(0, m.at - wins.value) }
    })
  })
  const nextMilestone = computed(() => milestones.value.find(m => !m.got && !m.owned) || milestones.value.find(m => !m.got) || null)

  function toChallenge(slug) {
    return `${gameRouteForSlug(slug)}?mode=${isPlayed(slug) ? 'review' : 'challenge'}`
  }

  // ── Reloj de la nueva jornada ──
  const now = ref(Date.now())
  let clock = null
  const msLeft = computed(() => msUntilAppMidnight(new Date(now.value)))
  const resetText = computed(() => formatReset(msLeft.value))
  const lastHour = computed(() => msLeft.value < 3600000)
  let reloadedAt = 0
  onMounted(() => {
    clock = setInterval(() => {
      now.value = Date.now()
      // Pasó la medianoche con la pantalla abierta → nueva jornada.
      if (msLeft.value > 86000000 && Date.now() - reloadedAt > 60000) { reloadedAt = Date.now(); load() }
    }, 1000)
  })
  onBeforeUnmount(() => clearInterval(clock))

  return {
    state, load, isPlayed, resultOf, unlocked, getGameUnlockLevel,
    playable, todo, played, locked, wins, losses, total, allDone,
    milestones, nextMilestone, toChallenge, resetText, lastHour, msLeft,
  }
}
