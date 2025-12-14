/**
 * 🏆 FOTMOB API SERVICE
 * 
 * Servicio para obtener datos de ligas en tiempo real desde FotMob API
 * - Tablas de posiciones
 * - Goleadores y asistidores
 * - Próximos partidos
 * - Estadísticas de equipos
 */

const FOTMOB_BASE_URL = 'https://www.fotmob.com/api';

const LEAGUES = {
  PREMIER_LEAGUE: { id: 47, name: 'Premier League', country: 'England', ccode: 'ENG' },
  LA_LIGA: { id: 87, name: 'La Liga', country: 'Spain', ccode: 'ESP' },
  SERIE_A: { id: 55, name: 'Serie A', country: 'Italy', ccode: 'ITA' },
  BUNDESLIGA: { id: 54, name: 'Bundesliga', country: 'Germany', ccode: 'GER' },
  LIGUE_1: { id: 53, name: 'Ligue 1', country: 'France', ccode: 'FRA' },
  LIGA_ARGENTINA: { id: 112, name: 'Liga Profesional', country: 'Argentina', ccode: 'ARG' }
};

/**
 * Fetch genérico para FotMob API
 */
async function fetchFotMob(endpoint) {
  try {
    const response = await fetch(`${FOTMOB_BASE_URL}${endpoint}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`FotMob API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching from FotMob:', error);
    throw error;
  }
}

/**
 * Obtener tabla de posiciones de una liga
 */
export async function getLeagueTable(leagueId) {
  try {
    const data = await fetchFotMob(`/leagues?id=${leagueId}&tab=table`);
    
    if (!data.table || !data.table[0]) {
      console.warn('No table data found for league:', leagueId);
      return { league: {}, table: [], tables: [], lastUpdated: new Date().toISOString() };
    }
    
    const tableData = data.table[0];
    const teamForm = tableData.teamForm || {};
    
    // Función para agregar form a los equipos
    const addFormToTeams = (teams) => {
      return teams.map(team => ({
        ...team,
        form: teamForm[team.id]?.map(match => match.resultString) || []
      }));
    };
    
    // Caso especial: Liga Argentina con múltiples tablas (Zona A, Zona B, etc.)
    if (tableData.data?.tables && Array.isArray(tableData.data.tables)) {
      // Filtrar solo las tablas de Clausura (las más recientes)
      const separateTables = tableData.data.tables
        .filter(zone => {
          const isClausura = zone.leagueName?.toLowerCase().includes('clausura');
          const hasTeams = zone.table?.all && Array.isArray(zone.table.all);
          return isClausura && hasTeams;
        })
        .map(zone => ({
          name: zone.leagueName,
          teams: addFormToTeams(zone.table.all)
        }));
      
      return {
        league: {
          id: tableData.data?.leagueId || leagueId,
          name: tableData.data?.leagueName || '',
          season: tableData.data?.selectedSeason || '',
          isCurrentSeason: tableData.data?.isCurrentSeason || false
        },
        table: [], // Vacío para indicar que se usan tables
        tables: separateTables, // Array de tablas separadas (solo Clausura)
        lastUpdated: new Date().toISOString()
      };
    }
    
    // Caso estándar: tabla única
    const tableTeams = tableData.data?.table?.all || [];
    
    return {
      league: {
        id: tableData.data?.leagueId || leagueId,
        name: tableData.data?.leagueName || '',
        season: tableData.data?.selectedSeason || '',
        isCurrentSeason: tableData.data?.isCurrentSeason || false
      },
      table: addFormToTeams(tableTeams),
      tables: [], // Vacío para indicar que se usa table
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error getting league table:', error);
    return { league: {}, table: [], tables: [], lastUpdated: new Date().toISOString() };
  }
}

/**
 * Obtener goleadores de una liga
 */
export async function getTopScorers(leagueId, limit = 10) {
  try {
    const data = await fetchFotMob(`/leagues?id=${leagueId}&tab=stats`);
    
    if (!data.stats || !data.stats.players) {
      throw new Error('No stats data found');
    }
    
    // Buscar categoría de goleadores
    const scorersCategory = data.stats.players.find(cat => cat.name === 'goals');
    
    if (!scorersCategory || !scorersCategory.topThree) {
      return [];
    }
    
    // Obtener top scorers del fetchAllUrl si existe
    let topScorers = scorersCategory.topThree || [];
    
    // Si hay fetchAllUrl, podríamos obtener la lista completa
    // Por ahora usamos los top 3 disponibles
    
    return topScorers.slice(0, limit).map(player => ({
      id: player.id,
      name: player.name,
      rank: player.rank,
      teamId: player.teamId,
      teamName: player.teamName,
      goals: player.value,
      country: player.ccode
    }));
  } catch (error) {
    console.error('Error getting top scorers:', error);
    return [];
  }
}

/**
 * Obtener asistidores de una liga
 */
export async function getTopAssists(leagueId, limit = 10) {
  try {
    const data = await fetchFotMob(`/leagues?id=${leagueId}&tab=stats`);
    
    if (!data.stats || !data.stats.players) {
      throw new Error('No stats data found');
    }
    
    // Buscar categoría de asistencias
    const assistsCategory = data.stats.players.find(cat => cat.name === 'goal_assist');
    
    if (!assistsCategory || !assistsCategory.topThree) {
      return [];
    }
    
    return assistsCategory.topThree.slice(0, limit).map(player => ({
      id: player.id,
      name: player.name,
      rank: player.rank,
      teamId: player.teamId,
      teamName: player.teamName,
      assists: player.value,
      country: player.ccode
    }));
  } catch (error) {
    console.error('Error getting top assists:', error);
    return [];
  }
}

/**
 * Obtener próximos partidos de una liga
 */
export async function getUpcomingMatches(leagueId, limit = 5) {
  try {
    const data = await fetchFotMob(`/leagues?id=${leagueId}&tab=fixtures`);
    
    if (!data.fixtures || !data.fixtures.allMatches) {
      throw new Error('No fixtures data found');
    }
    
    const now = new Date();
    
    // Filtrar partidos futuros o en vivo
    const upcoming = data.fixtures.allMatches
      .filter(match => {
        const matchTime = new Date(match.status.utcTime);
        return matchTime >= now || !match.status.finished;
      })
      .slice(0, limit)
      .map(match => ({
        id: match.id,
        round: match.roundName,
        date: match.status.utcTime,
        time: match.status.utcTime,
        homeTeamId: match.home.id,
        homeTeam: match.home.name,
        awayTeamId: match.away.id,
        awayTeam: match.away.name,
        status: {
          finished: match.status.finished,
          started: match.status.started,
          score: match.status.scoreStr,
          statusText: match.status.reason?.short || 'Scheduled'
        }
      }));
    
    return upcoming;
  } catch (error) {
    console.error('Error getting upcoming matches:', error);
    return [];
  }
}

/**
 * Obtener partidos de hoy
 */
export async function getTodayMatches(leagueId) {
  try {
    const data = await fetchFotMob(`/leagues?id=${leagueId}&tab=fixtures`);
    
    if (!data.fixtures || !data.fixtures.allMatches) {
      return [];
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return data.fixtures.allMatches
      .filter(match => {
        const matchDate = new Date(match.status.utcTime);
        return matchDate >= today && matchDate < tomorrow;
      })
      .map(match => ({
        id: match.id,
        date: match.status.utcTime,
        home: match.home,
        away: match.away,
        status: match.status
      }));
  } catch (error) {
    console.error('Error getting today matches:', error);
    return [];
  }
}

/**
 * Obtener todos los partidos de una liga
 */
export async function getAllMatches(leagueId) {
  try {
    const data = await fetchFotMob(`/leagues?id=${leagueId}&tab=fixtures`);
    
    if (!data.fixtures || !data.fixtures.allMatches) {
      return [];
    }
    
    return data.fixtures.allMatches.map(match => ({
      id: match.id,
      round: match.roundName,
      time: match.status.utcTime,
      homeTeamId: match.home.id,
      homeTeam: match.home.name,
      awayTeamId: match.away.id,
      awayTeam: match.away.name,
      status: {
        finished: match.status.finished,
        started: match.status.started,
        score: match.status.scoreStr
      }
    }));
  } catch (error) {
    console.error('Error getting all matches:', error);
    return [];
  }
}

/**
 * Obtener información completa de una liga
 */
export async function getLeagueOverview(leagueId) {
  try {
    const [table, scorers, assists, matches, allMatches] = await Promise.all([
      getLeagueTable(leagueId).catch(err => {
        console.error('Error loading table:', err);
        return { league: {}, table: [], lastUpdated: new Date().toISOString() };
      }),
      getTopScorers(leagueId, 5).catch(err => {
        console.error('Error loading scorers:', err);
        return [];
      }),
      getTopAssists(leagueId, 5).catch(err => {
        console.error('Error loading assists:', err);
        return [];
      }),
      getUpcomingMatches(leagueId, 5).catch(err => {
        console.error('Error loading matches:', err);
        return [];
      }),
      getAllMatches(leagueId).catch(err => {
        console.error('Error loading all matches:', err);
        return [];
      })
    ]);
    
    return {
      table,
      topScorers: scorers,
      topAssists: assists,
      upcomingMatches: matches,
      allMatches: allMatches
    };
  } catch (error) {
    console.error('Error getting league overview:', error);
    // Retornar datos vacíos en lugar de lanzar error
    return {
      table: { league: {}, table: [], lastUpdated: new Date().toISOString() },
      topScorers: [],
      topAssists: [],
      upcomingMatches: [],
      allMatches: []
    };
  }
}

/**
 * Obtener información completa de un equipo
 */
export async function getTeamDetails(teamId) {
  try {
    const data = await fetchFotMob(`/teams?id=${teamId}`);
    
    if (!data) return null;
    
    // Extraer información relevante
    return {
      id: teamId,
      name: data.details?.name || '',
      shortName: data.details?.shortName || '',
      logo: `https://images.fotmob.com/image_resources/logo/teamlogo/${teamId}.png`,
      country: data.details?.country || '',
      
      // Información del estadio
      stadium: {
        name: data.overview?.venue?.widget?.name || '',
        city: data.overview?.venue?.widget?.city || '',
        capacity: data.overview?.venue?.statPairs?.find(p => p[0] === 'Capacity')?.[1] || null,
        opened: data.overview?.venue?.statPairs?.find(p => p[0] === 'Opened')?.[1] || null
      },
      
      // Overview tab
      overview: data.overview || null,
      
      // Tabla/posición
      table: data.table || null,
      
      // Fixtures/partidos
      fixtures: data.fixtures || null,
      
      // Plantilla
      squad: data.squad || null,
      
      // Estadísticas
      stats: data.stats || null,
      
      // Historia
      history: data.history || null,
      
      // Tabs disponibles
      tabs: data.tabs || []
    };
  } catch (error) {
    console.error(`Error fetching team details for ${teamId}:`, error);
    return null;
  }
}

export { LEAGUES };
export default {
  getLeagueTable,
  getTopScorers,
  getTopAssists,
  getUpcomingMatches,
  getTodayMatches,
  getAllMatches,
  getLeagueOverview,
  getTeamDetails,
  LEAGUES
};
