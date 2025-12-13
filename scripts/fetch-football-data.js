/**
 * SCRIPT DE DESCARGA DE DATOS DE FOOTBALL-DATA.ORG
 * 
 * Este script descarga datos de la API gratuita de football-data.org
 * y genera archivos JSON estructurados para Goaldemy.
 * 
 * USO:
 * node scripts/fetch-football-data.js
 * 
 * NOTA: Solo funciona con ligas del FREE TIER:
 * - Brasileirão (BSA)
 * - Eredivisie (DED)
 * - Championship (ELC)
 * - Primera División Portugal (PPL)
 */

const fs = require('fs');
const path = require('path');

// TU API KEY
const API_KEY = '6fe40b27ccb847569ead4243d7a1cd2b';
const BASE_URL = 'https://api.football-data.org/v4';

// Ligas GRATUITAS disponibles
const FREE_LEAGUES = [
  { code: 'BSA', name: 'Brasileirão', country: 'Brazil' },
  { code: 'DED', name: 'Eredivisie', country: 'Netherlands' },
  { code: 'ELC', name: 'Championship', country: 'England' },
  { code: 'PPL', name: 'Primeira Liga', country: 'Portugal' }
];

/**
 * Hace un request a la API con la auth key
 */
async function fetchAPI(endpoint) {
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      headers: { 'X-Auth-Token': API_KEY }
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.error(`❌ Error ${response.status}:`, error.message);
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error(`❌ Error en request:`, error.message);
    return null;
  }
}

/**
 * Descarga datos de una liga específica
 */
async function downloadLeagueData(league) {
  console.log(`\n📥 Descargando ${league.name} (${league.code})...`);
  
  try {
    // 1. Obtener información de la competición
    const competition = await fetchAPI(`/competitions/${league.code}`);
    if (!competition) return;
    
    console.log(`✓ Competición: ${competition.name}`);
    console.log(`  Temporada: ${competition.currentSeason?.startDate} - ${competition.currentSeason?.endDate}`);
    
    // 2. Obtener equipos
    const teamsData = await fetchAPI(`/competitions/${league.code}/teams`);
    if (!teamsData) return;
    
    const teams = teamsData.teams || [];
    console.log(`✓ Equipos encontrados: ${teams.length}`);
    
    // 3. Preparar estructura de datos
    const leagueFile = {
      league: league.name,
      leagueId: league.code,
      season: competition.currentSeason?.startDate?.substring(0, 4) + '/' + competition.currentSeason?.endDate?.substring(0, 4),
      country: league.country,
      lastUpdated: new Date().toISOString().split('T')[0],
      teams: teams.map(team => ({
        id: team.id,
        name: team.name,
        shortName: team.shortName,
        tla: team.tla,
        logo: team.crest,
        playersFile: `${team.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}.json`,
        stadium: team.venue,
        founded: team.founded,
        colors: team.clubColors,
        stats: {
          position: null,
          points: null,
          played: null
        }
      })),
      metadata: {
        totalTeams: teams.length,
        apiSource: 'football-data.org',
        downloadedAt: new Date().toISOString()
      }
    };
    
    // 4. Guardar archivo de equipos
    const teamsDir = path.join(__dirname, '../src/data/teams');
    if (!fs.existsSync(teamsDir)) fs.mkdirSync(teamsDir, { recursive: true });
    
    const filename = `${league.code.toLowerCase()}.json`;
    fs.writeFileSync(
      path.join(teamsDir, filename),
      JSON.stringify(leagueFile, null, 2)
    );
    console.log(`✓ Guardado: teams/${filename}`);
    
    // 5. Descargar plantilla de cada equipo
    const playersDir = path.join(__dirname, '../src/data/players');
    if (!fs.existsSync(playersDir)) fs.mkdirSync(playersDir, { recursive: true });
    
    for (let i = 0; i < teams.length; i++) {
      const team = teams[i];
      console.log(`  [${i + 1}/${teams.length}] Descargando plantilla de ${team.shortName}...`);
      
      const teamData = await fetchAPI(`/teams/${team.id}`);
      if (!teamData) {
        console.log(`    ⚠ No se pudo descargar`);
        continue;
      }
      
      const squad = teamData.squad || [];
      const playersFile = {
        team: team.name,
        teamId: team.id,
        league: league.name,
        lastUpdated: new Date().toISOString().split('T')[0],
        players: squad.map(player => ({
          id: player.id,
          name: player.name,
          position: player.position,
          nationality: player.nationality,
          dateOfBirth: player.dateOfBirth,
          age: calculateAge(player.dateOfBirth),
          shirtNumber: player.shirtNumber || null,
          image: `https://img.a.transfermarkt.technology/portrait/medium/${player.id}.jpg?lm=1`,
          stats: {
            // Estos datos habría que completarlos manualmente o con otra API
            transferValue: null,
            goals: null,
            assists: null,
            appearances: null
          }
        }))
      };
      
      const playerFilename = team.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '.json';
      fs.writeFileSync(
        path.join(playersDir, playerFilename),
        JSON.stringify(playersFile, null, 2)
      );
      console.log(`    ✓ Guardado: players/${playerFilename} (${squad.length} jugadores)`);
      
      // Delay para no saturar la API (10 requests por minuto)
      await sleep(7000);
    }
    
    console.log(`\n✅ ${league.name} completado!`);
    
  } catch (error) {
    console.error(`❌ Error procesando ${league.name}:`, error.message);
  }
}

/**
 * Calcula edad a partir de fecha de nacimiento
 */
function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return null;
  const today = new Date();
  const birth = new Date(dateOfBirth);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 DESCARGA DE DATOS DE FOOTBALL-DATA.ORG');
  console.log('='.repeat(50));
  console.log(`API Key: ${API_KEY.substring(0, 10)}...`);
  console.log(`Ligas a descargar: ${FREE_LEAGUES.map(l => l.name).join(', ')}`);
  console.log('='.repeat(50));
  
  // Probar acceso a la API
  console.log('\n🔍 Verificando acceso a la API...');
  const test = await fetchAPI('/competitions');
  if (!test) {
    console.error('❌ No se pudo conectar a la API. Verificá tu API key.');
    return;
  }
  console.log('✓ API key válida!');
  
  // Descargar cada liga
  for (const league of FREE_LEAGUES) {
    await downloadLeagueData(league);
    await sleep(2000); // Pausa entre ligas
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('✅ DESCARGA COMPLETA!');
  console.log('='.repeat(50));
  console.log('\nArchivos generados en:');
  console.log('  - src/data/teams/');
  console.log('  - src/data/players/');
  console.log('\n💡 TIP: Revisá los archivos y completá datos faltantes manualmente.');
}

// Ejecutar
main().catch(console.error);
