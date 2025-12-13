# 📦 Scripts de Goaldemy

Este directorio contiene scripts de utilidad para gestionar datos del proyecto.

## 🚀 download-api-football.js (PRINCIPAL - API PREMIUM)

Descarga datos de API-Football (https://www.api-football.com/) con todas las ligas principales.

### Uso:

```bash
# Ejecutar script
node scripts/download-api-football.js
```

### ¿Qué hace?

1. Se conecta a API-Football con tu API key (61123bbd7a76ae2029a22dc714425af5)
2. Descarga datos de **6 LIGAS PRINCIPALES**:
   - ✅ Premier League (Inglaterra)
   - ✅ La Liga (España)
   - ✅ Serie A (Italia)
   - ✅ Bundesliga (Alemania)
   - ✅ Ligue 1 (Francia)
   - ✅ Champions League (Europa)
3. Por cada liga:
   - Crea archivo JSON con todos los equipos
   - Descarga plantilla completa de cada equipo con **ESTADÍSTICAS REALES**
   - Calcula valores de transferencia basados en rating + edad
4. Guarda todo en `src/data/teams/` y `src/data/players/`

### ✨ Ventajas sobre football-data.org:

- ✅ **Datos completos**: Rating, estadísticas detalladas, pases, duelos, etc.
- ✅ **Todas las ligas top**: Premier, La Liga, Serie A, Bundesliga, Ligue 1
- ✅ **Champions League**: Datos de competiciones europeas
- ✅ **Valoraciones reales**: Estimación basada en performance
- ✅ **Más jugadores**: Plantillas completas actualizadas

### ⚙️ Configuración:

- **Rate limiting**: 7 segundos entre requests (automático)
- **Temporada**: 2024
- **API Key**: 61123bbd7a76ae2029a22dc714425af5
- **Endpoint**: https://v3.football.api-sports.io

### ⏱️ Tiempo estimado:

- 6 ligas × ~20 equipos × 7 segundos = **~15 minutos**

---

## 🔽 fetch-football-data.js (DEPRECADO)

⚠️ **Este script está obsoleto. Usar `download-api-football.js` en su lugar.**

Descarga datos de la API gratuita de football-data.org y genera archivos JSON estructurados.

### Uso:

```bash
# Instalar dependencias (solo la primera vez)
npm install

# Ejecutar script
node scripts/fetch-football-data.js
```

### ¿Qué hace?

1. Se conecta a football-data.org con tu API key
2. Descarga datos de las ligas GRATUITAS disponibles:
   - Brasileirão (Brasil)
   - Eredivisie (Holanda)
   - Championship (Inglaterra 2da división)
   - Primeira Liga (Portugal)
3. Por cada liga:
   - Crea un archivo JSON con todos los equipos
   - Descarga la plantilla completa de cada equipo
   - Genera archivos individuales por equipo
4. Guarda todo en `src/data/teams/` y `src/data/players/`

### ⚠️ Limitaciones:

- **10 requests por minuto** (el script hace pausas automáticas)
- **Solo ligas gratuitas** (Premier, La Liga, Champions requieren plan pago)
- **Algunos datos incompletos** (valores de mercado, stats de temporada)

### 💡 Tips:

- El script tarda ~30-40 minutos en descargar todo
- Los datos de valor de mercado hay que completarlos manualmente
- Podés editar `FREE_LEAGUES` para descargar solo las que te interesan

---

## 📝 Datos Premium (La Liga, Premier)

Para ligas premium, hay 3 opciones:

### Opción 1: Entrada Manual
Crear archivos JSON a mano con los equipos top que te interesan.

### Opción 2: Web Scraping
Usar Puppeteer/Cheerio para extraer datos de sitios públicos (Transfermarkt, FotMob).

### Opción 3: API Alternativa
Probar API-Football en RapidAPI (100 requests/día gratis).

---

## 🏗️ Estructura de Archivos Generados

```
src/data/
├── leagues.json              # Catálogo de ligas
├── teams/
│   ├── bsa.json             # Brasileirão
│   ├── ded.json             # Eredivisie
│   └── premier-league.json  # (manual)
└── players/
    ├── liverpool.json
    ├── flamengo.json
    └── ajax.json
```

---

## 🔄 Actualización de Datos

Para mantener los datos actualizados:

1. **Semanalmente**: Re-ejecutar el script para ligas gratuitas
2. **Manualmente**: Actualizar stats de equipos premium
3. **Después de mercado de pases**: Actualizar plantillas

---

## 🆘 Troubleshooting

### Error 403: "restricted"
Estás intentando acceder a una liga premium. Cambiá a una gratuita.

### Error 429: "Too many requests"
Excediste el límite de 10 req/min. El script maneja esto automáticamente.

### Error 401: "Unauthorized"
Tu API key es inválida o expiró. Pedí una nueva en football-data.org.

---

**Última actualización**: 11 de diciembre de 2025
