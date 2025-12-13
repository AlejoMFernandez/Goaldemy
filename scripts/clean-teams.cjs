/**
 * 🗑️ LIMPIAR EQUIPOS ESPECÍFICOS
 * 
 * Elimina equipos del dataGAMES.json por nombre o ID
 */

const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'src', 'dataGAMES.json');
const BACKUP_PATH = path.join(__dirname, '..', 'src', 'dataGAMES.backup-before-clean.json');

// Equipos a eliminar
const TEAMS_TO_REMOVE = [
  'Chelsea',
  'Tottenham Hotspur',
  'Manchester United',
  'Milan',
  'Napoli',
  'Atletico Madrid',
  'Borussia Dortmund',
  'Boca Juniors',
  'River Plate',
  'Racing Club',
  // Equipos incorrectos
  'AEK Athens',
  'Deportivo La Coruna',
  'FK Vitebsk',
  'Willem II'
];

function main() {
  console.log('🗑️  LIMPIAR EQUIPOS DE dataGAMES.json');
  console.log('='.repeat(60));
  
  try {
    // Leer datos
    console.log('\n📖 Leyendo dataGAMES.json...');
    const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    console.log(`✅ Equipos actuales: ${data.length}`);
    
    // Crear backup
    console.log('\n💾 Creando backup...');
    fs.writeFileSync(BACKUP_PATH, JSON.stringify(data, null, 2));
    console.log(`✅ Backup: ${path.basename(BACKUP_PATH)}`);
    
    // Filtrar equipos
    console.log('\n🗑️  Eliminando equipos...');
    const filtered = data.filter(team => {
      const shouldRemove = TEAMS_TO_REMOVE.some(name => 
        team.name.toLowerCase().includes(name.toLowerCase()) ||
        name.toLowerCase().includes(team.name.toLowerCase())
      );
      
      if (shouldRemove) {
        console.log(`  ❌ Eliminado: ${team.name}`);
      }
      
      return !shouldRemove;
    });
    
    // Guardar
    fs.writeFileSync(DATA_PATH, JSON.stringify(filtered, null, 2));
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ LIMPIEZA COMPLETADA');
    console.log('='.repeat(60));
    console.log(`📊 Resumen:`);
    console.log(`   - Equipos antes: ${data.length}`);
    console.log(`   - Equipos eliminados: ${data.length - filtered.length}`);
    console.log(`   - Equipos restantes: ${filtered.length}`);
    
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

main();
