/**
 * SERVICIO DE DATOS DE LIGAS Y EQUIPOS V2
 * 
 * Maneja la carga de datos estructurados desde archivos JSON locales.
 * Reemplaza el antiguo dataGAMES.json con un sistema modular por ligas.
 * 
 * ESTRUCTURA:
 * - leagues.json: Catálogo de ligas disponibles
 * - teams/[league].json: Equipos por liga
 * - players/[team].json: Jugadores por equipo
 */

// Cache en memoria para evitar múltiples cargas
let _leaguesCache = null;
const _teamsCache = new Map();
const _playersCache = new Map();

/**
 * Obtiene el catálogo completo de ligas
 * @returns {Promise<Object>} Objeto con array de ligas y metadata
 */
export async function getLeagues() {
  if (_leaguesCache) return _leaguesCache;
  
  try {
    const response = await fetch('/src/data/leagues.json');
    const data = await response.json();
    _leaguesCache = data;
    return data;
  } catch (error) {
    console.error('[data-loader] Error loading leagues:', error);
    return { leagues: [], metadata: {} };
  }
}

/**
 * Obtiene los equipos de una liga específica
 * @param {string} leagueId - ID de la liga (ej: 'PL', 'LLP', 'BSA')
 * @returns {Promise<Object>} Objeto con array de equipos y metadata
 */
export async function getTeamsByLeague(leagueId) {
  const cacheKey = leagueId.toLowerCase();
  if (_teamsCache.has(cacheKey)) return _teamsCache.get(cacheKey);
  
  try {
    // Primero obtener info de la liga para saber qué archivo cargar
    const leaguesData = await getLeagues();
    const league = leaguesData.leagues.find(l => l.id === leagueId);
    
    if (!league) {
      console.warn(`[data-loader] League ${leagueId} not found`);
      return { teams: [], metadata: {} };
    }
    
    const response = await fetch(`/src/data/teams/${league.teamsFile}`);
    const data = await response.json();
    _teamsCache.set(cacheKey, data);
    return data;
  } catch (error) {
    console.error(`[data-loader] Error loading teams for ${leagueId}:`, error);
    return { teams: [], metadata: {} };
  }
}

/**
 * Obtiene la plantilla de un equipo específico
 * @param {string} teamFileName - Nombre del archivo del equipo (ej: 'liverpool.json')
 * @returns {Promise<Object>} Objeto con array de jugadores y metadata
 */
export async function getPlayersByTeam(teamFileName) {
  const cacheKey = teamFileName.toLowerCase();
  if (_playersCache.has(cacheKey)) return _playersCache.get(cacheKey);
  
  try {
    const response = await fetch(`/src/data/players/${teamFileName}`);
    const data = await response.json();
    _playersCache.set(cacheKey, data);
    return data;
  } catch (error) {
    console.error(`[data-loader] Error loading players for ${teamFileName}:`, error);
    return { players: [], metadata: {} };
  }
}

/**
 * Obtiene TODOS los jugadores de todas las ligas habilitadas
 * (Útil para los juegos que mezclan jugadores de diferentes ligas)
 * @returns {Promise<Array>} Array con todos los jugadores
 */
export async function getAllPlayers() {
  try {
    const leaguesData = await getLeagues();
    const enabledLeagues = leaguesData.leagues.filter(l => l.enabled);
    
    const allPlayers = [];
    
    for (const league of enabledLeagues) {
      const teamsData = await getTeamsByLeague(league.id);
      
      for (const team of teamsData.teams || []) {
        if (!team.playersFile) continue;
        
        try {
          const playersData = await getPlayersByTeam(team.playersFile);
          
          // Agregar info de liga y equipo a cada jugador
          for (const player of playersData.players || []) {
            allPlayers.push({
              ...player,
              team: team.name,
              teamLogo: team.logo,
              league: league.name,
              leagueId: league.id
            });
          }
        } catch (err) {
          console.warn(`[data-loader] Could not load players for ${team.name}`);
        }
      }
    }
    
    console.log(`[data-loader] Loaded ${allPlayers.length} players from ${enabledLeagues.length} leagues`);
    return allPlayers;
  } catch (error) {
    console.error('[data-loader] Error loading all players:', error);
    return [];
  }
}

/**
 * Obtiene jugadores filtrados por liga
 * @param {string} leagueId - ID de la liga
 * @returns {Promise<Array>} Array de jugadores de esa liga
 */
export async function getPlayersByLeague(leagueId) {
  try {
    const teamsData = await getTeamsByLeague(leagueId);
    const players = [];
    
    for (const team of teamsData.teams || []) {
      if (!team.playersFile) continue;
      
      const playersData = await getPlayersByTeam(team.playersFile);
      for (const player of playersData.players || []) {
        players.push({
          ...player,
          team: team.name,
          teamLogo: team.logo
        });
      }
    }
    
    return players;
  } catch (error) {
    console.error(`[data-loader] Error loading players for league ${leagueId}:`, error);
    return [];
  }
}

/**
 * Busca un jugador por nombre (fuzzy search)
 * @param {string} query - Nombre a buscar
 * @param {number} limit - Máximo de resultados (default: 10)
 * @returns {Promise<Array>} Array de jugadores que coinciden
 */
export async function searchPlayers(query, limit = 10) {
  if (!query || query.length < 2) return [];
  
  const allPlayers = await getAllPlayers();
  const normalizedQuery = query.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  
  const matches = allPlayers.filter(player => {
    const normalizedName = (player.name || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
    return normalizedName.includes(normalizedQuery);
  });
  
  return matches.slice(0, limit);
}

/**
 * Limpia el cache (útil para forzar recarga)
 */
export function clearCache() {
  _leaguesCache = null;
  _teamsCache.clear();
  _playersCache.clear();
  console.log('[data-loader] Cache cleared');
}

/**
 * Obtiene estadísticas del sistema de datos
 * @returns {Promise<Object>} Objeto con stats del sistema
 */
export async function getDataStats() {
  const leaguesData = await getLeagues();
  const allPlayers = await getAllPlayers();
  
  const stats = {
    totalLeagues: leaguesData.leagues.length,
    enabledLeagues: leaguesData.leagues.filter(l => l.enabled).length,
    totalPlayers: allPlayers.length,
    playersByLeague: {},
    cacheSize: {
      leagues: _leaguesCache ? 1 : 0,
      teams: _teamsCache.size,
      players: _playersCache.size
    }
  };
  
  for (const league of leaguesData.leagues) {
    const players = await getPlayersByLeague(league.id);
    stats.playersByLeague[league.id] = players.length;
  }
  
  return stats;
}
