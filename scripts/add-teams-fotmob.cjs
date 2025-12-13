/**
 * 🚀 GOALDEMY - AGREGAR EQUIPOS DESDE FOTMOB
 * 
 * Descarga equipos específicos de FotMob y los agrega a dataGAMES.json
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// ============================================
// CONFIGURACIÓN - EQUIPOS A AGREGAR
// ============================================

const TEAMS_TO_ADD = [
  // 8 EQUIPOS ORIGINALES (actualización)
  { name: 'Liverpool', fotmobId: 8650 },
  { name: 'Barcelona', fotmobId: 8634 },
  { name: 'Arsenal', fotmobId: 9825 },
  { name: 'Inter', fotmobId: 8636 },
  { name: 'Real Madrid', fotmobId: 8633 },
  { name: 'Bayern München', fotmobId: 9823 },
  { name: 'Paris Saint-Germain', fotmobId: 9847 },
  { name: 'Manchester City', fotmobId: 8456 },
];

const DATA_PATH = path.join(__dirname, '..', 'src', 'dataGAMES.json');
const BACKUP_PATH = path.join(__dirname, '..', 'src', 'dataGAMES.backup-before-add.json');

// ============================================
// FUNCIONES AUXILIARES
// ============================================

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      }
    };

    https.get(url, options, (res) => {
      let data = '';
      
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Error parsing JSON: ${e.message}`));
        }
      });
    }).on('error', reject);
  });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizePosition(position) {
  const posMap = {
    'Goalkeeper': 'GK',
    'keepers': 'GK',
    'Defender': 'DEF',
    'defenders': 'DEF',
    'Midfielder': 'MID',
    'midfielders': 'MID',
    'Attacker': 'FWD',
    'attackers': 'FWD',
    'forwards': 'FWD',
    'Forward': 'FWD'
  };
  return posMap[position] || position;
}

function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return null;
  
  const birth = new Date(dateOfBirth);
  const today = new Date();
  
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  return age;
}

// ============================================
// DESCARGA Y PROCESAMIENTO
// ============================================

async function downloadTeam(team) {
  console.log(`\n⚽ Descargando: ${team.name}`);
  
  try {
    // Primero obtener detalles básicos
    const detailsUrl = `https://www.fotmob.com/api/teams?id=${team.fotmobId}`;
    const detailsData = await httpsGet(detailsUrl);
    
    await delay(500);
    
    // Luego obtener plantilla
    const squadUrl = `https://www.fotmob.com/api/teams?id=${team.fotmobId}&tab=squad&type=team&timeZone=America/Argentina/Buenos_Aires`;
    const squadData = await httpsGet(squadUrl);
    
    if (!squadData.squad || !squadData.squad.squad) {
      console.log(`  ⚠️  No se encontró plantilla para ${team.name}`);
      return null;
    }

    // Procesar plantilla
    const squad = [];
    let totalPlayers = 0;

    for (const section of squadData.squad.squad) {
      // Saltar entrenadores
      if (section.title === 'coach') continue;
      
      const members = [];
      
      for (const player of section.members || []) {
        members.push({
          id: player.id,
          name: player.name,
          shirtNumber: player.shirtNumber || null,
          cname: player.cname || null,
          ccode: player.ccode?.toLowerCase() || null,
          role: {
            key: player.role?.key || normalizePosition(section.title).toLowerCase(),
            fallback: player.role?.fallback || normalizePosition(section.title)
          },
          positionId: player.positionId || 0,
          positionIdsDesc: player.positionIdsDesc || normalizePosition(section.title),
          height: player.height || null,
          age: player.age || calculateAge(player.dateOfBirth),
          dateOfBirth: player.dateOfBirth || null,
          transferValue: player.transferValue || 0,
          stats: {
            appearances: player.rating ? 1 : 0,
            goals: player.goals || 0,
            assists: player.assists || 0,
            yellowCards: player.ycards || 0,
            redCards: player.rcards || 0,
            minutes: 0
          }
        });
      }

      if (members.length > 0) {
        squad.push({
          title: section.title,
          members: members
        });
        totalPlayers += members.length;
      }
    }

    console.log(`  ✅ Descargados ${totalPlayers} jugadores`);

    return {
      name: detailsData.details?.name || team.name,
      shortName: detailsData.details?.shortName || team.name,
      id: team.fotmobId,
      logo: detailsData.details?.sportsTeamJSONLD?.logo || '',
      squad: squad
    };

  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    return null;
  }
}

// ============================================
// EJECUCIÓN PRINCIPAL
// ============================================

async function main() {
  console.log('🚀 GOALDEMY - AGREGAR EQUIPOS DESDE FOTMOB');
  console.log('=' .repeat(60));
  console.log(`📋 Equipos a agregar: ${TEAMS_TO_ADD.length}`);
  
  try {
    // Leer dataGAMES.json actual
    console.log('\n📖 Leyendo dataGAMES.json actual...');
    const currentData = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    console.log(`✅ Equipos actuales: ${currentData.length}`);
    
    // Crear backup
    console.log('\n💾 Creando backup...');
    fs.writeFileSync(BACKUP_PATH, JSON.stringify(currentData, null, 2));
    console.log(`✅ Backup: ${path.basename(BACKUP_PATH)}`);
    
    // Descargar nuevos equipos
    console.log('\n📥 Descargando equipos desde FotMob...');
    const newTeams = [];
    
    for (let i = 0; i < TEAMS_TO_ADD.length; i++) {
      const team = TEAMS_TO_ADD[i];
      
      // Verificar si ya existe
      const exists = currentData.find(t => 
        t.id === team.fotmobId || 
        t.name.toLowerCase() === team.name.toLowerCase()
      );
      
      if (exists) {
        console.log(`\n⚠️  ${team.name} ya existe, saltando...`);
        continue;
      }
      
      const teamData = await downloadTeam(team);
      
      if (teamData) {
        newTeams.push(teamData);
      }
      
      // Rate limiting: esperar 1 segundo entre requests
      if (i < TEAMS_TO_ADD.length - 1) {
        await delay(1000);
      }
    }
    
    if (newTeams.length === 0) {
      console.log('\n⚠️  No se descargaron nuevos equipos');
      return;
    }
    
    // Combinar datos
    console.log('\n🔄 Agregando equipos a dataGAMES.json...');
    const updatedData = [...currentData, ...newTeams];
    
    // Guardar
    fs.writeFileSync(DATA_PATH, JSON.stringify(updatedData, null, 2));
    
    // Contar jugadores totales
    let totalPlayers = 0;
    for (const team of updatedData) {
      for (const squad of team.squad) {
        totalPlayers += squad.members.length;
      }
    }
    
    // Resumen
    console.log('\n' + '='.repeat(60));
    console.log('✅ EQUIPOS AGREGADOS EXITOSAMENTE');
    console.log('='.repeat(60));
    console.log(`📊 Resumen:`);
    console.log(`   - Equipos anteriores: ${currentData.length}`);
    console.log(`   - Equipos nuevos: ${newTeams.length}`);
    console.log(`   - Total equipos: ${updatedData.length}`);
    console.log(`   - Total jugadores: ${totalPlayers}`);
    console.log(`\n📁 Archivos:`);
    console.log(`   - Actualizado: src/dataGAMES.json`);
    console.log(`   - Backup: src/${path.basename(BACKUP_PATH)}`);
    console.log(`\n✨ Equipos agregados:`);
    newTeams.forEach(team => {
      const playerCount = team.squad.reduce((sum, s) => sum + s.members.length, 0);
      console.log(`   - ${team.name} (${playerCount} jugadores)`);
    });
    
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

main();
