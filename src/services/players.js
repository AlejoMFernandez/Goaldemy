import teams from '../dataGAMES.json';

// Build image URL given a player id per FotMob pattern
export function playerImageUrl(playerId) {
  return `https://images.fotmob.com/image_resources/playerimages/${playerId}.png`;
}

// Flatten all players across teams with useful fields
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

// Utility: pick n distinct random items from an array
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
