const PROXY_BASE = import.meta.env.DEV ? '/fotmob' : '';

const LEAGUES = {
  WORLD_CUP: { id: 77, name: 'Copa del Mundo 2026', country: 'Internacional', ccode: 'INT', active: true, slug: 'world-cup' },
  PREMIER_LEAGUE: { id: 47, name: 'Premier League', country: 'England', ccode: 'ENG', active: false, slug: 'premier-league' },
  LA_LIGA: { id: 87, name: 'La Liga', country: 'Spain', ccode: 'ESP', active: false, slug: 'la-liga' },
  SERIE_A: { id: 55, name: 'Serie A', country: 'Italy', ccode: 'ITA', active: false, slug: 'serie-a' },
  BUNDESLIGA: { id: 54, name: 'Bundesliga', country: 'Germany', ccode: 'GER', active: false, slug: 'bundesliga' },
  LIGUE_1: { id: 53, name: 'Ligue 1', country: 'France', ccode: 'FRA', active: false, slug: 'ligue-1' },
  LIGA_ARGENTINA: { id: 112, name: 'Liga Profesional', country: 'Argentina', ccode: 'ARG', active: false, slug: 'liga-argentina' }
};

const ACTIVE_LEAGUES = Object.values(LEAGUES).filter(l => l.active);
const PAUSED_LEAGUES = Object.values(LEAGUES).filter(l => !l.active);

let _buildId = null;

async function getBuildId() {
  if (_buildId) return _buildId;
  try {
    const html = await fetch(`${PROXY_BASE}/`).then(r => r.text());
    const match = html.match(/"buildId"\s*:\s*"([^"]+)"/);
    if (match) {
      _buildId = match[1];
      return _buildId;
    }
  } catch (e) {
    console.warn('Failed to fetch FotMob buildId:', e);
  }
  return null;
}

async function fetchFotMob(leagueId, tab = 'overview') {
  const buildId = await getBuildId();
  if (!buildId) throw new Error('Could not resolve FotMob buildId');
  const url = `${PROXY_BASE}/_next/data/${buildId}/en/leagues/${leagueId}/${tab}.json`;
  const response = await fetch(url);
  if (!response.ok) {
    if (response.status === 404) {
      _buildId = null;
      const retryBuildId = await getBuildId();
      if (retryBuildId) {
        const retryUrl = `${PROXY_BASE}/_next/data/${retryBuildId}/en/leagues/${leagueId}/${tab}.json`;
        const retryResponse = await fetch(retryUrl);
        if (retryResponse.ok) return retryResponse.json();
      }
    }
    throw new Error(`FotMob API error: ${response.status}`);
  }
  return response.json();
}

export async function getLeagueTable(leagueId) {
  try {
    const raw = await fetchFotMob(leagueId, 'table');
    const data = raw.pageProps || raw;
    if (!data.table || !data.table[0]) {
      return { league: {}, table: [], tables: [], lastUpdated: new Date().toISOString() };
    }
    const tableData = data.table[0];
    const teamForm = tableData.teamForm || {};
    const addFormToTeams = (teams) => teams.map(team => ({
      ...team,
      form: teamForm[team.id]?.map(match => match.resultString) || []
    }));

    if (tableData.data?.tables && Array.isArray(tableData.data.tables)) {
      const separateTables = tableData.data.tables
        .filter(zone => zone.table?.all && Array.isArray(zone.table.all))
        .map(zone => ({ name: zone.leagueName, teams: addFormToTeams(zone.table.all) }));
      return {
        league: { id: tableData.data?.leagueId || leagueId, name: tableData.data?.leagueName || '', season: tableData.data?.selectedSeason || '' },
        table: [], tables: separateTables, lastUpdated: new Date().toISOString()
      };
    }

    return {
      league: { id: tableData.data?.leagueId || leagueId, name: tableData.data?.leagueName || '', season: tableData.data?.selectedSeason || '' },
      table: addFormToTeams(tableData.data?.table?.all || []), tables: [], lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error getting league table:', error);
    return { league: {}, table: [], tables: [], lastUpdated: new Date().toISOString() };
  }
}

export async function getTopScorers(leagueId, limit = 10) {
  try {
    const raw = await fetchFotMob(leagueId, 'stats');
    const data = raw.pageProps || raw;
    if (!data.stats?.players) return [];
    const scorersCategory = data.stats.players.find(cat => cat.name === 'goals');
    if (!scorersCategory?.topThree) return [];
    return scorersCategory.topThree.slice(0, limit).map(player => ({
      id: player.id, name: player.name, rank: player.rank,
      teamId: player.teamId, teamName: player.teamName,
      goals: player.value, country: player.ccode
    }));
  } catch (error) {
    console.error('Error getting top scorers:', error);
    return [];
  }
}

export async function getTopAssists(leagueId, limit = 10) {
  try {
    const raw = await fetchFotMob(leagueId, 'stats');
    const data = raw.pageProps || raw;
    if (!data.stats?.players) return [];
    const assistsCategory = data.stats.players.find(cat => cat.name === 'goal_assist');
    if (!assistsCategory?.topThree) return [];
    return assistsCategory.topThree.slice(0, limit).map(player => ({
      id: player.id, name: player.name, rank: player.rank,
      teamId: player.teamId, teamName: player.teamName,
      assists: player.value, country: player.ccode
    }));
  } catch (error) {
    console.error('Error getting top assists:', error);
    return [];
  }
}

export async function getUpcomingMatches(leagueId, limit = 5) {
  try {
    const raw = await fetchFotMob(leagueId, 'fixtures');
    const data = raw.pageProps || raw;
    const allMatches = data.fixtures?.allMatches || data.allMatches || [];
    if (!allMatches.length) return [];
    const now = new Date();
    return allMatches
      .filter(match => new Date(match.status.utcTime) >= now || !match.status.finished)
      .slice(0, limit)
      .map(match => ({
        id: match.id, round: match.roundName, date: match.status.utcTime, time: match.status.utcTime,
        homeTeamId: match.home.id, homeTeam: match.home.name,
        awayTeamId: match.away.id, awayTeam: match.away.name,
        status: { finished: match.status.finished, started: match.status.started, score: match.status.scoreStr, statusText: match.status.reason?.short || 'Scheduled' }
      }));
  } catch (error) {
    console.error('Error getting upcoming matches:', error);
    return [];
  }
}

export async function getTodayMatches(leagueId) {
  try {
    const raw = await fetchFotMob(leagueId, 'fixtures');
    const data = raw.pageProps || raw;
    const allMatches = data.fixtures?.allMatches || data.allMatches || [];
    if (!allMatches.length) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return allMatches
      .filter(match => {
        const matchDate = new Date(match.status.utcTime);
        return matchDate >= today && matchDate < tomorrow;
      })
      .map(match => ({
        id: match.id, date: match.status.utcTime, home: match.home, away: match.away, status: match.status
      }));
  } catch (error) {
    console.error('Error getting today matches:', error);
    return [];
  }
}

export async function getAllMatches(leagueId) {
  try {
    const raw = await fetchFotMob(leagueId, 'fixtures');
    const data = raw.pageProps || raw;
    const allMatches = data.fixtures?.allMatches || data.allMatches || [];
    return allMatches.map(match => ({
      id: match.id, round: match.roundName, time: match.status.utcTime,
      homeTeamId: match.home.id, homeTeam: match.home.name,
      awayTeamId: match.away.id, awayTeam: match.away.name,
      status: { finished: match.status.finished, started: match.status.started, score: match.status.scoreStr }
    }));
  } catch (error) {
    console.error('Error getting all matches:', error);
    return [];
  }
}

export async function getLeagueOverview(leagueId) {
  try {
    const [table, scorers, assists, matches, allMatches] = await Promise.all([
      getLeagueTable(leagueId).catch(() => ({ league: {}, table: [], tables: [], lastUpdated: new Date().toISOString() })),
      getTopScorers(leagueId, 5).catch(() => []),
      getTopAssists(leagueId, 5).catch(() => []),
      getUpcomingMatches(leagueId, 5).catch(() => []),
      getAllMatches(leagueId).catch(() => [])
    ]);
    return { table, topScorers: scorers, topAssists: assists, upcomingMatches: matches, allMatches };
  } catch (error) {
    console.error('Error getting league overview:', error);
    return {
      table: { league: {}, table: [], tables: [], lastUpdated: new Date().toISOString() },
      topScorers: [], topAssists: [], upcomingMatches: [], allMatches: []
    };
  }
}

export async function getTeamDetails(teamId) {
  try {
    const buildId = await getBuildId();
    if (!buildId) return null;
    const url = `${PROXY_BASE}/_next/data/${buildId}/en/teams/${teamId}/overview.json`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const raw = await response.json();
    const data = raw.pageProps || raw;
    return {
      id: teamId, name: data.details?.name || '', shortName: data.details?.shortName || '',
      logo: `https://images.fotmob.com/image_resources/logo/teamlogo/${teamId}.png`,
      country: data.details?.country || '',
      stadium: { name: data.overview?.venue?.widget?.name || '', city: data.overview?.venue?.widget?.city || '' },
      overview: data.overview || null, table: data.table || null, fixtures: data.fixtures || null,
      squad: data.squad || null, stats: data.stats || null, history: data.history || null, tabs: data.tabs || []
    };
  } catch (error) {
    console.error(`Error fetching team details for ${teamId}:`, error);
    return null;
  }
}

export { LEAGUES, ACTIVE_LEAGUES, PAUSED_LEAGUES };
export default {
  getLeagueTable, getTopScorers, getTopAssists, getUpcomingMatches,
  getTodayMatches, getAllMatches, getLeagueOverview, getTeamDetails,
  LEAGUES, ACTIVE_LEAGUES, PAUSED_LEAGUES
};
