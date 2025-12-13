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
import teams from '../dataGAMES.json';

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
  const players = [];
  for (const team of teams) {
    for (const section of team.squad) {
      for (const member of section.members) {
        players.push({
          id: member.id,
          name: member.name,
          teamId: team.id,
          teamName: team.name,
          teamLogo: team.logo,
          ccode: member.ccode,
          cname: member.cname,
          // Include both a broad numeric positionId (0: GK, 1: DF, 2: MF, 3: FW)
          // and the descriptive string list (e.g., "CB", "LB,LWB", "ST"),
          // so game logic can group reliably and still have a readable descriptor.
          positionId: member.positionId,
          position: member.positionIdsDesc,
          height: member.height ?? null,
          age: member.age ?? null,
          transferValue: member.transferValue ?? null,
          shirtNumber: member.shirtNumber ?? null,
          image: playerImageUrl(member.id),
        });
      }
    }
  }
  return players;
}

export function getAllTeams() {
  return teams.map(t => ({ id: t.id, name: t.name, logo: t.logo }));
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
export function sampleDistinct(arr, n, excludeIds = new Set()) {
  const pool = arr.filter(x => !excludeIds.has(x.id));
  const result = [];
  const used = new Set();
  while (result.length < Math.min(n, pool.length)) {
    const idx = Math.floor(Math.random() * pool.length);
    const item = pool[idx];
    if (!used.has(item.id)) {
      used.add(item.id);
      result.push(item);
    }
  }
  return result;
}

// Build multiple choice options including the correct answer
export function buildOptions(allItems, correct, count = 4, key = 'name') {
  const others = allItems.filter(x => x[key] !== correct[key]);
  const distractors = sampleDistinct(others, count - 1);
  const options = [correct, ...distractors]
    .map(x => ({ label: x[key], value: x[key] }));
  // shuffle
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return options;
}
