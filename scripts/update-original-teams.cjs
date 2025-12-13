/**
 * 🔄 ACTUALIZAR EQUIPOS ORIGINALES
 * 
 * Elimina y re-descarga los 8 equipos originales con datos actualizados de FotMob
 */

const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'src', 'dataGAMES.json');
const BACKUP_PATH = path.join(__dirname, '..', 'src', 'dataGAMES.backup-before-update.json');

// Los 8 equipos originales a actualizar (IDs extraídos de dataGAMES.json)
const TEAMS_TO_UPDATE = [
  'Liverpool',
  'Barcelona', 
  'Arsenal',
  'Inter',
  'Real Madrid',
  'Bayern München', // Buscar Bayern
  'Paris Saint-Germain',
  'Manchester City'
];

function main() {
  console.log('🔄 ACTUALIZAR EQUIPOS ORIGINALES');
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
    
    // Filtrar equipos (eliminar los 8 originales)
    console.log('\n🗑️  Eliminando equipos originales para re-descarga...');
    const filtered = data.filter(team => {
      const shouldRemove = TEAMS_TO_UPDATE.some(name => 
        team.name.toLowerCase().includes(name.toLowerCase()) ||
        name.toLowerCase().includes(team.name.toLowerCase())
      );
      
      if (shouldRemove) {
        console.log(`  ❌ Eliminado: ${team.name} (ID: ${team.id})`);
      }
      
      return !shouldRemove;
    });
    
    // Guardar
    fs.writeFileSync(DATA_PATH, JSON.stringify(filtered, null, 2));
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ EQUIPOS ELIMINADOS - LISTOS PARA RE-DESCARGA');
    console.log('='.repeat(60));
    console.log(`📊 Resumen:`);
    console.log(`   - Equipos antes: ${data.length}`);
    console.log(`   - Equipos eliminados: ${data.length - filtered.length}`);
    console.log(`   - Equipos restantes: ${filtered.length}`);
    console.log(`\n💡 Ahora ejecutá el script add-teams-fotmob.cjs para re-descargar`);
    
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

main();
