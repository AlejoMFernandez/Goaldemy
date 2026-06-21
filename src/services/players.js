/**
 * SERVICIO DE JUGADORES
 * 
 * Maneja toda la lógica relacionada con los datos de jugadores y equipos.
 * Los datos se cargan desde dataGAMES.json (archivo estático con 500+ jugadores).
 * 
 * ESTRUCTURA DE DATOS:
 * - dataGAMES.json contiene un array de equipos
 * - Cada equipo tiene: id, name, logo, squad[]
 * - squad[] se divide en secciones (GK, DF, MF, FW)
 * - Cada member tiene: id, name, ccode, cname, positionId, height, age, etc.
 * 
 * POSICIONES:
 * - positionId (numérico): 0=GK, 1=DF, 2=MF, 3=FW
 * - position (string): Ej: "CB", "LB,LWB", "ST" (descripción detallada)
 * 
 * IMÁGENES:
 * - Las fotos de jugadores vienen de FotMob CDN
 * - URL pattern: https://images.fotmob.com/image_resources/playerimages/{id}.png
 * 
 * UTILIDADES:
 * - getAllPlayers(): Retorna array flat de todos los jugadores
 * - sampleDistinct(): Selecciona N jugadores aleatorios sin repetir
 * - buildOptions(): Crea opciones múltiple choice con la correcta incluida
 */
import teams from '../dataGAMES.json'
import { getDifficulty, filterPlayersByDifficulty } from './difficulty';

const EXCLUDED_TEAMS = new Set(['Boca Juniors', 'River Plate', 'Racing Club'])

const MIN_TRANSFER_VALUE = 500_000

const TEAM_LEAGUE_MAP = {
  8455: 47, 8586: 47, 10260: 47, 8650: 47, 9825: 47, 8456: 47, // Premier League
  8634: 87, 9906: 87, 8633: 87, // La Liga
  8564: 55, 9875: 55, 8636: 55, // Serie A
  9789: 54, 9823: 54, // Bundesliga
  9847: 53, // Ligue 1
}

// Clubes top adicionales SOLO para el selector de "Favoritos" del perfil
// (no entran a los juegos). Logo vía FotMob CDN por ID.
const EXTRA_FAVORITE_TEAMS = [
  // Premier League
  { id: 10261, name: 'Newcastle United' },
  { id: 10252, name: 'Aston Villa' },
  { id: 8654, name: 'West Ham United' },
  { id: 10204, name: 'Brighton & Hove Albion' },
  { id: 8668, name: 'Everton' },
  // La Liga
  { id: 8302, name: 'Sevilla' },
  { id: 8603, name: 'Real Betis' },
  { id: 8560, name: 'Real Sociedad' },
  { id: 10205, name: 'Villarreal' },
  { id: 10267, name: 'Valencia' },
  { id: 8315, name: 'Athletic Club' },
  // Serie A
  { id: 9885, name: 'Juventus' },
  { id: 8686, name: 'AS Roma' },
  { id: 8543, name: 'Lazio' },
  { id: 8524, name: 'Atalanta' },
  { id: 8535, name: 'Fiorentina' },
  // Bundesliga
  { id: 178475, name: 'RB Leipzig' },
  { id: 8178, name: 'Bayer Leverkusen' },
  { id: 9810, name: 'Eintracht Frankfurt' },
  { id: 8721, name: 'VfL Wolfsburg' },
  // Ligue 1
  { id: 8592, name: 'Olympique de Marseille' },
  { id: 9829, name: 'AS Monaco' },
  { id: 9748, name: 'Olympique Lyonnais' },
  { id: 8639, name: 'Lille' },
  { id: 9831, name: 'OGC Nice' },
]

// Módulo-level cache: se llena con datos de FotMob cuando initializePlayers() completa
let _fotmobCache = null

/**
 * Inicializa el cache de jugadores desde FotMob API + localStorage.
 * Llamar una vez desde App.vue en background (no bloquea la UI).
 */
export async function initializePlayers() {
  try {
    const { loadPlayersFromFotMob } = await import('./fotmob-players')
    const data = await loadPlayersFromFotMob()
    if (data && data.length > 0) {
      _fotmobCache = data
      console.debug(`[players] FotMob cache: ${data.length} jugadores`)
    }
  } catch (e) {
    console.warn('[players] No se pudo cargar desde FotMob, usando JSON estático', e)
  }
}

/**
 * Construye la URL de la imagen de un jugador según FotMob
 * @param {number} playerId - ID del jugador en FotMob
 * @returns {string} URL de la imagen
 */
export function playerImageUrl(playerId) {
  return `https://images.fotmob.com/image_resources/playerimages/${playerId}.png`;
}

/**
 * Obtiene un array flat con todos los jugadores de todos los equipos
 * Cada jugador incluye datos de su equipo, posición, altura, edad, valor, etc.
 * @returns {Array} Array de objetos jugador con todas sus propiedades
 */
export function getAllPlayers() {
  if (_fotmobCache && _fotmobCache.length > 0) return _fotmobCache.filter(isNotablePlayer)

  const players = [];
  for (const team of teams) {
    if (EXCLUDED_TEAMS.has(team.name)) continue
    for (const section of team.squad) {
      for (const member of section.members) {
        const p = {
          id: member.id,
          name: member.name,
          teamId: team.id,
          teamName: team.name,
          teamLogo: team.logo,
          ccode: member.ccode,
          cname: member.cname,
          positionId: member.positionId,
          position: member.positionIdsDesc,
          height: member.height ?? null,
          age: member.age ?? null,
          transferValue: member.transferValue ?? null,
          shirtNumber: member.shirtNumber ?? null,
          image: playerImageUrl(member.id),
          stats: member.stats || null,
          leagueId: TEAM_LEAGUE_MAP[team.id] ?? null,
        }
        if (isNotablePlayer(p)) players.push(p)
      }
    }
  }
  return players;
}

function isNotablePlayer(p) {
  if (!p) return false
  const tv = p.transferValue ?? 0
  if (tv >= MIN_TRANSFER_VALUE) return true
  const apps = p.stats?.appearances ?? 0
  if (apps >= 10) return true
  return false
}

export function getAllTeams() {
  const base = teams.map(t => ({ id: t.id, name: t.name, logo: t.logo }));
  const seen = new Set(base.map(t => t.id));
  for (const t of EXTRA_FAVORITE_TEAMS) {
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    base.push({ id: t.id, name: t.name, logo: `https://images.fotmob.com/image_resources/logo/teamlogo/${t.id}.png` });
  }
  return base.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es'));
}

/**
 * Versión asíncrona: si el cache FotMob no está listo, lo espera.
 * Ideal para usar en mounted() de los juegos para datos siempre frescos.
 */
export async function getAllPlayersAsync() {
  if (!(_fotmobCache && _fotmobCache.length > 0)) await initializePlayers()
  return filterPlayersByDifficulty(getAllPlayers(), getDifficulty())
}

function _normalizeName(s) {
  return (s || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
}

export function findTeamByName(name) {
  const target = _normalizeName(name)
  if (!target) return null
  const all = getAllTeams()
  return all.find(t => _normalizeName(t.name) === target) || null
}

export function findPlayerByName(name) {
  const target = _normalizeName(name)
  if (!target) return null
  const all = getAllPlayers()
  return all.find(p => _normalizeName(p.name) === target) || null
}

/**
 * Selecciona N elementos aleatorios distintos de un array
 * Útil para generar opciones múltiple choice sin repetir jugadores
 * @param {Array} arr - Array de items
 * @param {number} n - Cantidad de items a seleccionar
 * @param {Set} excludeIds - Set de IDs a excluir (opcional)
 * @returns {Array} Array de items seleccionados aleatoriamente
 */
export function sampleDistinct(arr, n, excludeIds = new Set(), rng) {
  const rand = rng || Math.random
  const pool = arr.filter(x => !excludeIds.has(x.id));
  const result = [];
  const used = new Set();
  while (result.length < Math.min(n, pool.length)) {
    const idx = Math.floor(rand() * pool.length);
    const item = pool[idx];
    if (!used.has(item.id)) {
      used.add(item.id);
      result.push(item);
    }
  }
  return result;
}

// Build multiple choice options including the correct answer
export function buildOptions(allItems, correct, count = 4, key = 'name', rng) {
  const rand = rng || Math.random
  const others = allItems.filter(x => x[key] !== correct[key]);
  const distractors = sampleDistinct(others, count - 1, new Set(), rng);
  const options = [correct, ...distractors]
    .map(x => ({ label: x[key], value: x[key] }));
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return options;
}
