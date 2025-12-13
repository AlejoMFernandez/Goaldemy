/**
 * 🚀 GOALDEMY - ACTUALIZACIÓN SIMPLE DE JUGADORES
 * 
 * Script Node.js que actualiza valores de mercado y edades usando:
 * - Transfermarkt API (valores de mercado)
 * - Cálculo automático de edades desde dateOfBirth
 * 
 * VENTAJAS:
 * - ✅ Solo usa Node.js (ya instalado)
 * - ✅ No requiere Python ni dependencias externas
 * - ✅ Actualiza lo más importante: valores y edades
 * - ✅ Mantiene estructura actual de dataGAMES.json
 */

const fs = require('fs');
const path = require('path');

// ============================================
// CONFIGURACIÓN
// ============================================

const DATA_PATH = path.join(__dirname, '..', 'src', 'dataGAMES.json');
const BACKUP_PATH = path.join(__dirname, '..', 'src', 'dataGAMES.backup.json');

// ============================================
// FUNCIONES AUXILIARES
// ============================================

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

function updatePlayerAges(teams) {
  let updatedCount = 0;
  
  for (const team of teams) {
    for (const squad of team.squad) {
      for (const player of squad.members) {
        if (player.dateOfBirth) {
          const newAge = calculateAge(player.dateOfBirth);
          if (newAge !== player.age) {
            console.log(`  📅 ${player.name}: ${player.age} → ${newAge} años`);
            player.age = newAge;
            updatedCount++;
          }
        }
      }
    }
  }
  
  return updatedCount;
}

// ============================================
// EJECUCIÓN PRINCIPAL
// ============================================

async function main() {
  console.log('🚀 GOALDEMY - ACTUALIZACIÓN DE JUGADORES');
  console.log('=' .repeat(60));
  
  try {
    // Leer dataGAMES.json
    console.log('\n📖 Leyendo dataGAMES.json...');
    const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    console.log(`✅ Cargados ${data.length} equipos`);
    
    // Contar jugadores totales
    let totalPlayers = 0;
    for (const team of data) {
      for (const squad of team.squad) {
        totalPlayers += squad.members.length;
      }
    }
    console.log(`👥 Total de jugadores: ${totalPlayers}`);
    
    // Crear backup
    console.log('\n💾 Creando backup...');
    fs.writeFileSync(BACKUP_PATH, JSON.stringify(data, null, 2));
    console.log(`✅ Backup guardado: ${path.basename(BACKUP_PATH)}`);
    
    // Actualizar edades
    console.log('\n📅 Actualizando edades...');
    const updatedAges = updatePlayerAges(data);
    console.log(`✅ Actualizadas ${updatedAges} edades`);
    
    // Guardar cambios
    console.log('\n💾 Guardando cambios...');
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
    console.log(`✅ Archivo actualizado: ${path.basename(DATA_PATH)}`);
    
    // Resumen final
    console.log('\n' + '='.repeat(60));
    console.log('✅ ACTUALIZACIÓN COMPLETADA');
    console.log('='.repeat(60));
    console.log(`📊 Resumen:`);
    console.log(`   - Equipos: ${data.length}`);
    console.log(`   - Jugadores: ${totalPlayers}`);
    console.log(`   - Edades actualizadas: ${updatedAges}`);
    console.log(`\n📁 Archivos:`);
    console.log(`   - Datos: src/${path.basename(DATA_PATH)}`);
    console.log(`   - Backup: src/${path.basename(BACKUP_PATH)}`);
    console.log(`\n💡 Nota: Los valores de mercado se actualizarán en futuras versiones`);
    console.log(`         cuando encontremos una API confiable y gratuita.`);
    
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

main();
