/**
 * 🔍 BUSCADOR DE IDs DE FOTMOB
 * 
 * Busca equipos en FotMob y muestra sus IDs
 */

const https = require('https');

function searchTeam(query) {
  return new Promise((resolve, reject) => {
    const url = `https://www.fotmob.com/api/searchapi/${encodeURIComponent(query)}`;
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

async function main() {
  const teams = [
    'Napoli',
    'Boca Juniors',
    'River Plate',
    'Racing Club'
  ];

  console.log('🔍 BUSCADOR DE IDs DE FOTMOB');
  console.log('='.repeat(60));
  
  for (const team of teams) {
    console.log(`\n🔎 Buscando: ${team}`);
    
    try {
      const results = await searchTeam(team);
      
      if (results.teams && results.teams.length > 0) {
        console.log('   Resultados:');
        results.teams.slice(0, 5).forEach((t, i) => {
          console.log(`   ${i + 1}. ${t.name} (${t.country || 'N/A'}) - ID: ${t.id}`);
        });
      } else {
        console.log('   ⚠️  No se encontraron resultados');
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('💡 Copiá los IDs correctos y actualiza el script');
}

main();
