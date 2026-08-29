// Liquida los pronósticos de PRODE contra resultados reales de FotMob.
// Pensada para dispararse cada 15-30 min vía pg_cron (ver el bloque comentado
// al final de supabase/prode.sql). No requiere secrets de terceros: pega
// directo a fotmob.com igual que hace el proxy /fotmob del frontend, con el
// mismo User-Agent para evitar que FotMob la trate distinto a un browser real.
//
// Secrets necesarios (Project Settings > Edge Functions > Secrets):
//   CRON_SECRET — mismo valor que el header del cron (ver supabase/prode.sql)
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY ya vienen inyectados automáticamente.
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-goaldemy-cron-secret',
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

// Competencias con pick de campeón habilitado (bracket:true en src/services/competitions.js).
// Mantené esta lista sincronizada a mano si agregás/sacás torneos con bracket ahí.
const CHAMPION_COMPETITIONS: Record<string, number> = {
  'world-cup': 77, 'copa-america': 44, 'champions-league': 42, 'europa-league': 73,
  'libertadores': 45, 'sudamericana': 299, 'mundial-clubes': 78, 'afc-champions': 525,
  'fa-cup': 132, 'copa-del-rey': 138, 'coppa-italia': 141, 'dfb-pokal': 209,
  'coupe-de-france': 134, 'efl-cup': 133, 'liga-argentina': 112,
}
// Todas las competiciones live (para pronóstico de partidos, incluye ligas sin bracket).
const ALL_COMPETITIONS: Record<string, number> = {
  ...CHAMPION_COMPETITIONS,
  'premier-league': 47, 'la-liga': 87, 'serie-a': 55, 'bundesliga': 54, 'ligue-1': 53,
  'eredivisie': 57, 'liga-portugal': 61, 'championship': 48, 'super-lig': 71,
  'liga-mx': 230, 'mls': 130, 'scottish-premiership': 64, 'pro-league': 40, 'brasileirao': 268,
}

type Fixture = {
  id: string
  round: string | null
  homeId: string
  awayId: string
  finished: boolean
  scoreStr: string | undefined
}

let cachedBuildId: string | null = null
async function getBuildId(): Promise<string | null> {
  if (cachedBuildId) return cachedBuildId
  try {
    const res = await fetch('https://www.fotmob.com/', { headers: { 'User-Agent': UA } })
    const html = await res.text()
    const m = html.match(/"buildId"\s*:\s*"([^"]+)"/)
    cachedBuildId = m ? m[1] : null
  } catch (_e) {
    cachedBuildId = null
  }
  return cachedBuildId
}

async function fetchFotMobData(leagueId: number, tab: 'fixtures' | 'overview'): Promise<any | null> {
  const buildId = await getBuildId()
  if (!buildId) return null
  try {
    const url = `https://www.fotmob.com/_next/data/${buildId}/en/leagues/${leagueId}/${tab}.json`
    let res = await fetch(url, { headers: { 'User-Agent': UA } })
    if (!res.ok) {
      if (res.status === 404) {
        // El buildId cacheado quedó viejo (FotMob redeployó su frontend) — refrescar y reintentar una vez.
        cachedBuildId = null
        const retryBuildId = await getBuildId()
        if (!retryBuildId) return null
        const retryUrl = `https://www.fotmob.com/_next/data/${retryBuildId}/en/leagues/${leagueId}/${tab}.json`
        res = await fetch(retryUrl, { headers: { 'User-Agent': UA } })
        if (!res.ok) return null
      } else {
        return null
      }
    }
    const raw = await res.json()
    return raw.pageProps || raw
  } catch (_e) {
    return null
  }
}

async function fetchFixtures(leagueId: number): Promise<Fixture[] | null> {
  const data = await fetchFotMobData(leagueId, 'fixtures')
  if (!data) return null
  const allMatches = data.fixtures?.allMatches || data.allMatches || []
  return allMatches.map((m: any) => ({
    id: String(m.id),
    round: m.roundName ?? null,
    homeId: String(m.home.id),
    awayId: String(m.away.id),
    finished: !!m.status.finished,
    scoreStr: m.status.scoreStr as string | undefined,
  }))
}

/** ID del equipo campeón, o null si la final todavía no se jugó / FotMob no respondió. */
async function fetchChampionTeamId(leagueId: number): Promise<string | null> {
  const data = await fetchFotMobData(leagueId, 'overview')
  if (!data) return null
  const finalRound = (data.playoff?.rounds || []).find((r: any) => r.stage === 'final')
  const winner = finalRound?.matchups?.[0]?.winner
  return winner != null ? String(winner) : null
}

function parseScore(scoreStr: string | undefined): { home: number; away: number } | null {
  if (!scoreStr) return null
  const m = scoreStr.match(/^(\d+)\s*-\s*(\d+)$/)
  if (!m) return null
  return { home: parseInt(m[1], 10), away: parseInt(m[2], 10) }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const cronSecret = Deno.env.get('CRON_SECRET')
    if (cronSecret && req.headers.get('x-goaldemy-cron-secret') !== cronSecret) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    let matchesSettled = 0
    let championsSettled = 0

    for (const [slug, leagueId] of Object.entries(ALL_COMPETITIONS)) {
      const { count: pendingMatchPicks } = await supabase
        .from('prode_picks').select('id', { count: 'exact', head: true })
        .eq('competition', slug).is('settled_at', null)

      const championEnabled = slug in CHAMPION_COMPETITIONS
      let pendingChampionPicks = 0
      if (championEnabled) {
        const { count } = await supabase
          .from('prode_champion_picks').select('user_id', { count: 'exact', head: true })
          .eq('competition', slug).is('settled_at', null)
        pendingChampionPicks = count || 0
      }

      if (!pendingMatchPicks && !pendingChampionPicks) continue

      if (pendingMatchPicks) {
        const fixtures = await fetchFixtures(leagueId)
        if (fixtures) {
          const { data: picks } = await supabase
            .from('prode_picks').select('id, match_id, home_pick, away_pick')
            .eq('competition', slug).is('settled_at', null)

          for (const pick of picks || []) {
            const fixture = fixtures.find(f => f.id === pick.match_id)
            if (!fixture || !fixture.finished) continue
            const real = parseScore(fixture.scoreStr)
            if (!real) continue

            let points = 0
            if (pick.home_pick === real.home && pick.away_pick === real.away) {
              points = 3
            } else if (Math.sign(pick.home_pick - pick.away_pick) === Math.sign(real.home - real.away)) {
              points = 1
            }
            const xp = points === 3 ? 30 : points === 1 ? 10 : 0
            const fichas = points === 3 ? 15 : points === 1 ? 5 : 0

            const { error } = await supabase.rpc('settle_prode_match_pick', {
              p_pick_id: pick.id, p_points: points, p_xp: xp, p_fichas: fichas,
            })
            if (!error) matchesSettled++
          }
        }
      }

      if (pendingChampionPicks) {
        const championId = await fetchChampionTeamId(leagueId)
        if (championId) {
          const { data: championPicks } = await supabase
            .from('prode_champion_picks').select('user_id, team_id')
            .eq('competition', slug).is('settled_at', null)

          for (const cp of championPicks || []) {
            const won = cp.team_id === championId
            const { error } = await supabase.rpc('settle_prode_champion_pick', {
              p_user_id: cp.user_id, p_competition: slug, p_won: won,
              p_xp: 500, p_fichas: 300, p_balones: 20,
            })
            if (!error) championsSettled++
          }
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, matchesSettled, championsSettled }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('settle-prode error:', e)
    return new Response(JSON.stringify({ error: e.message || 'Error interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
