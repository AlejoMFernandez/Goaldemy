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
          ccode: member.ccode,
          cname: member.cname,
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
