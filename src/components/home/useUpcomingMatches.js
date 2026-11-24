/**
 * Próximos partidos de TODAS las ligas conocidas (FotMob), normalizados para
 * MatchTicker / TodayMatchesGrid. Extraído de Landing.vue para que la home y
 * Social → Fútbol usen exactamente la misma lógica (sin duplicarla).
 */
import { ref, computed } from 'vue'
import { LEAGUES, getUpcomingMatches } from '../../services/fotmob'

export function useUpcomingMatches({ limitPerLeague = 5, max = 24 } = {}) {
  const raw = ref([])
  const loading = ref(false)
  const error = ref(false)

  async function load() {
    loading.value = true
    error.value = false
    try {
      const results = await Promise.allSettled(
        Object.values(LEAGUES).map(l => getUpcomingMatches(l.id, limitPerLeague).then(matches => ({ league: l, matches })))
      )
      const ok = results.filter(r => r.status === 'fulfilled')
      if (!ok.length && results.length) throw new Error('sin respuesta de ninguna liga')
      raw.value = ok
        .flatMap(r => r.value.matches.map(m => ({ ...m, league: r.value.league })))
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(0, max)
    } catch (e) {
      console.warn('[matches] load error', e)
      raw.value = []
      error.value = true
    } finally {
      loading.value = false
    }
  }

  const matches = computed(() => raw.value.map((m, i) => {
    const parts = (m.status?.score || '').split('-').map(s => s.trim())
    const [homeScore, awayScore] = parts.length === 2 ? parts : [null, null]
    const live = !!(m.status?.started && !m.status?.finished)
    return {
      id: m.id ?? i,
      date: m.date,
      leagueId: m.league.id, leagueName: m.league.name,
      leagueLogo: `https://images.fotmob.com/image_resources/logo/leaguelogo/${m.league.id}.png`,
      homeId: m.homeTeamId, homeName: m.homeTeam,
      awayId: m.awayTeamId, awayName: m.awayTeam,
      homeScore, awayScore,
      isLive: live,
      finished: !!m.status?.finished,
      statusText: m.status?.finished ? 'FIN' : new Date(m.date).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }),
      pageUrl: m.pageUrl || null,
    }
  }))

  // "Partidos de hoy": próximos disponibles, en vivo primero (ver nota en Landing).
  const todayMatches = computed(() => (
    [...matches.value].sort((a, b) => (b.isLive ? 1 : 0) - (a.isLive ? 1 : 0)).slice(0, 9)
  ))

  return { raw, loading, error, load, matches, todayMatches }
}
