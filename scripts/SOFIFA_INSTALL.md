# 📦 INSTALACIÓN Y USO - SCRIPT SOFIFA

## 🎯 ¿Qué hace este script?

Descarga datos COMPLETOS de jugadores desde SoFIFA (base de datos oficial de FIFA):
- ✅ Plantillas completas (todos los jugadores)
- ✅ Ratings de FIFA (overall, potential)
- ✅ Valores de mercado oficiales
- ✅ Datos físicos (edad, altura, peso)
- ✅ Posiciones precisas

---

## 📋 PASOS DE INSTALACIÓN

### 1. Instalar Python

**Opción A - Microsoft Store (RECOMENDADA):**
1. Abrir Microsoft Store
2. Buscar "Python 3.12"
3. Instalar (tarda 2-3 minutos)

**Opción B - Descarga directa:**
1. Ir a https://www.python.org/downloads/
2. Descargar Python 3.12+
3. ✅ IMPORTANTE: Marcar "Add Python to PATH" durante instalación

### 2. Verificar instalación

Abrir PowerShell y ejecutar:
```powershell
python --version
```
Debería mostrar: `Python 3.12.x`

### 3. Instalar dependencias

```powershell
cd Goaldemy
pip install soccerdata pandas
```

Esto instala:
- `soccerdata`: Librería para descargar datos de fútbol
- `pandas`: Procesamiento de datos

---

## 🚀 EJECUCIÓN

### Opción 1: Descargar TODO

```powershell
cd Goaldemy
python scripts/download-sofifa.py
```

Descarga:
- Premier League (20 equipos)
- La Liga (20 equipos)
- Serie A (20 equipos)
- Bundesliga (18 equipos)
- Ligue 1 (18 equipos)

**Tiempo estimado:** 10-15 minutos
**Jugadores totales:** ~2500

### Opción 2: Solo equipos específicos

Editar `download-sofifa.py` línea 52:
```python
SPECIFIC_TEAMS = [
    'Liverpool', 'Manchester City', 'Real Madrid', 'Barcelona'
]
```

Luego ejecutar:
```powershell
python scripts/download-sofifa.py
```

---

## 📊 ESTRUCTURA DE DATOS GENERADA

### leagues.json
```json
{
  "leagues": [
    {
      "id": "PREMIER_LEAGUE",
      "name": "Premier League",
      "teamsFile": "premier-league.json"
    }
  ]
}
```

### teams/premier-league.json
```json
{
  "league": "Premier League",
  "teams": [
    {
      "name": "Liverpool",
      "playersFile": "liverpool.json",
      "playerCount": 30
    }
  ]
}
```

### players/liverpool.json
```json
{
  "team": "Liverpool",
  "players": [
    {
      "id": 192985,
      "name": "Mohamed Salah",
      "position": "RW",
      "age": 32,
      "overall": 89,
      "potential": 89,
      "transferValue": 65000000,
      "nationality": "Egypt"
    }
  ]
}
```

---

## ⚙️ CONFIGURACIÓN AVANZADA

### Cambiar ligas

Editar línea 42 de `download-sofifa.py`:
```python
LEAGUES_CONFIG = [
    {'id': 'ENG-Premier League', 'name': 'Premier League', 'file': 'premier-league.json'},
    # Agregar más ligas...
]
```

Ligas disponibles:
- `ENG-Premier League`
- `ESP-La Liga`
- `ITA-Serie A`
- `GER-Bundesliga`
- `FRA-Ligue 1`
- `POR-Liga Portugal`
- `NED-Eredivisie`
- etc.

---

## 🐛 TROUBLESHOOTING

### Error: "Python was not found"
- Instalar Python desde Microsoft Store
- O agregar Python al PATH

### Error: "No module named 'soccerdata'"
```powershell
pip install soccerdata
```

### Error: "No module named 'pandas'"
```powershell
pip install pandas
```

### Descarga muy lenta
- SoFIFA tiene rate limiting
- Es normal que tarde 10-15 minutos
- No interrumpir el proceso

### Error de conexión
- Verificar internet
- SoFIFA puede estar temporalmente inaccesible
- Reintentar más tarde

---

## 📝 NOTAS

- **Primera ejecución:** Tarda más (descarga y cachea datos)
- **Ejecuciones siguientes:** Usa caché (más rápido)
- **Actualización:** Re-ejecutar script cuando salga nueva versión de FIFA
- **Datos offline:** Una vez descargados, no necesita internet

---

## 🔄 ACTUALIZACIÓN DE DATOS

### Frecuencia recomendada:
- **Cada actualización de FIFA:** ~2-3 veces al año
- **Después de mercado de pases:** Enero y Julio

### Proceso:
```powershell
# Limpiar caché anterior
Remove-Item -Path "$HOME/.soccerdata/SoFIFA/*" -Recurse -Force

# Descargar datos actualizados
python scripts/download-sofifa.py
```

---

**¡Listo! Una vez instalado Python, ejecutá el script y tenés datos de FIFA completos y actualizados.**
