"""
🚀 GOALDEMY - DESCARGA DE DATOS DESDE SOFIFA (FIFA)

Este script usa la librería soccerdata para descargar datos COMPLETOS
de jugadores desde SoFIFA (base de datos de FIFA).

VENTAJAS:
- ✅ Plantillas COMPLETAS (todos los jugadores registrados)
- ✅ Datos de FIFA (rating, potencial, edad, posición)
- ✅ Valores de mercado oficiales
- ✅ Actualizaciones cada versión de FIFA
- ✅ GRATIS y sin límites

REQUISITOS:
1. Instalar Python 3.8+
2. Instalar dependencias: pip install soccerdata pandas

USO:
python scripts/download-sofifa.py
"""

import json
import os
from pathlib import Path
from datetime import datetime

try:
    import soccerdata as sd
    import pandas as pd
    print("✅ Librerías cargadas correctamente")
except ImportError as e:
    print(f"❌ Error: {e}")
    print("\n📦 Ejecutá estos comandos:")
    print("   pip install soccerdata")
    print("   pip install pandas")
    exit(1)

# ============================================
# CONFIGURACIÓN
# ============================================

# Ligas a descargar (SoFIFA usa códigos específicos)
LEAGUES_CONFIG = [
    {'id': 'ENG-Premier League', 'name': 'Premier League', 'file': 'premier-league.json'},
    {'id': 'ESP-La Liga', 'name': 'La Liga', 'file': 'la-liga.json'},
    {'id': 'ITA-Serie A', 'name': 'Serie A', 'file': 'serie-a.json'},
    {'id': 'GER-Bundesliga', 'name': 'Bundesliga', 'file': 'bundesliga.json'},
    {'id': 'FRA-Ligue 1', 'name': 'Ligue 1', 'file': 'ligue-1.json'},
]

# Equipos específicos que te interesan (opcional - si querés solo algunos)
SPECIFIC_TEAMS = [
    'Liverpool', 'Manchester City', 'Manchester United', 'Arsenal', 'Chelsea', 'Tottenham',
    'Real Madrid', 'Barcelona', 'Atletico Madrid',
    'Bayern Munich', 'Borussia Dortmund',
    'Paris Saint-Germain',
    'Juventus', 'AC Milan', 'Inter Milan'
]

# Paths
BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / 'src' / 'data'
PLAYERS_DIR = DATA_DIR / 'players'
TEAMS_DIR = DATA_DIR / 'teams'

# ============================================
# FUNCIONES AUXILIARES
# ============================================

def normalize_position(fifa_position):
    """Convierte posiciones de FIFA al formato de Goaldemy."""
    position_map = {
        'GK': 'GK',
        'CB': 'CB', 'LB': 'LB', 'RB': 'RB', 'LWB': 'LB', 'RWB': 'RB',
        'CDM': 'CDM', 'CM': 'CM', 'CAM': 'CAM', 'LM': 'LM', 'RM': 'RM',
        'LW': 'LW', 'RW': 'RW', 'ST': 'ST', 'CF': 'ST', 'LF': 'LW', 'RF': 'RW'
    }
    return position_map.get(fifa_position, fifa_position)

def calculate_age(birthdate_str):
    """Calcula edad actual desde fecha de nacimiento."""
    if pd.isna(birthdate_str):
        return None
    try:
        birth = pd.to_datetime(birthdate_str)
        today = pd.Timestamp.now()
        age = today.year - birth.year
        if (today.month, today.day) < (birth.month, birth.day):
            age -= 1
        return age
    except:
        return None

def clean_team_name(team_name):
    """Normaliza nombres de equipos."""
    replacements = {
        'Manchester United': 'Manchester United',
        'Manchester City': 'Manchester City',
        'Paris Saint Germain': 'Paris Saint-Germain',
        'Paris SG': 'Paris Saint-Germain',
        'Bayern München': 'Bayern Munich',
        'Internazionale': 'Inter Milan',
    }
    return replacements.get(team_name, team_name)

# ============================================
# DESCARGA DE DATOS
# ============================================

def download_league_data(league_config):
    """Descarga datos de una liga completa."""
    print(f"\n🏆 Procesando: {league_config['name']}")
    print("=" * 60)
    
    try:
        # Inicializar SoFIFA para la liga
        print(f"📡 Conectando a SoFIFA...")
        sofifa = sd.SoFIFA(leagues=[league_config['id']])
        
        # Obtener equipos
        print(f"⚽ Descargando equipos...")
        teams_df = sofifa.read_teams()
        
        if teams_df.empty:
            print(f"⚠️  No se encontraron equipos para {league_config['name']}")
            return None
        
        print(f"✅ Encontrados {len(teams_df)} equipos")
        
        # Obtener jugadores
        print(f"👥 Descargando jugadores...")
        players_df = sofifa.read_players()
        
        if players_df.empty:
            print(f"⚠️  No se encontraron jugadores")
            return None
        
        print(f"✅ Descargados {len(players_df)} jugadores")
        
        # Obtener ratings (valoraciones)
        print(f"📊 Descargando ratings...")
        try:
            ratings_df = sofifa.read_player_ratings()
            # Merge con players
            players_full = players_df.merge(ratings_df, left_index=True, right_index=True, how='left')
        except Exception as e:
            print(f"⚠️  Error obteniendo ratings: {e}")
            players_full = players_df
        
        return {
            'league': league_config,
            'teams': teams_df,
            'players': players_full
        }
        
    except Exception as e:
        print(f"❌ Error procesando {league_config['name']}: {e}")
        return None

def process_and_save_data(league_data):
    """Procesa y guarda datos en formato Goaldemy."""
    if not league_data:
        return
    
    league_config = league_data['league']
    teams_df = league_data['teams']
    players_df = league_data['players']
    
    print(f"\n💾 Guardando datos de {league_config['name']}...")
    
    # Crear directorios
    PLAYERS_DIR.mkdir(parents=True, exist_ok=True)
    TEAMS_DIR.mkdir(parents=True, exist_ok=True)
    
    # Agrupar jugadores por equipo
    teams_data = []
    
    for team_name in teams_df['team'].unique():
        team_players = players_df[players_df['team'] == team_name]
        
        if team_players.empty:
            continue
        
        # Filtrar si solo queremos equipos específicos
        if SPECIFIC_TEAMS and team_name not in SPECIFIC_TEAMS:
            continue
        
        team_name_clean = clean_team_name(team_name)
        
        # Construir datos de jugadores
        players_list = []
        for idx, player in team_players.iterrows():
            player_data = {
                'id': int(idx),
                'name': player.get('player', 'Unknown'),
                'position': normalize_position(player.get('position', 'N/A')),
                'nationality': player.get('nationality', 'Unknown'),
                'age': calculate_age(player.get('date_of_birth')),
                'birthdate': str(player.get('date_of_birth')) if pd.notna(player.get('date_of_birth')) else None,
                'height': int(player.get('height_cm', 0)) if pd.notna(player.get('height_cm')) else None,
                'weight': int(player.get('weight_kg', 0)) if pd.notna(player.get('weight_kg')) else None,
                'shirtNumber': None,  # SoFIFA no tiene números de camiseta
                'photo': f"https://cdn.sofifa.net/players/{str(idx).zfill(3)[:3]}/{idx}.png",
                
                # Ratings FIFA
                'overall': int(player.get('overall', 0)) if pd.notna(player.get('overall')) else None,
                'potential': int(player.get('potential', 0)) if pd.notna(player.get('potential')) else None,
                
                # Valor de mercado (en euros)
                'transferValue': int(player.get('value_eur', 0)) if pd.notna(player.get('value_eur')) else 0,
                
                # Estadísticas de juego (placeholders)
                'stats': {
                    'appearances': 0,
                    'goals': 0,
                    'assists': 0,
                    'yellowCards': 0,
                    'redCards': 0,
                    'minutes': 0
                }
            }
            players_list.append(player_data)
        
        if not players_list:
            continue
        
        # Guardar archivo de jugadores del equipo
        team_file = team_name_clean.lower().replace(' ', '-') + '.json'
        team_data = {
            'team': team_name_clean,
            'league': league_config['name'],
            'season': '2024/25',
            'lastUpdated': datetime.now().isoformat(),
            'source': 'SoFIFA (FIFA Database)',
            'playerCount': len(players_list),
            'players': players_list
        }
        
        player_path = PLAYERS_DIR / team_file
        with open(player_path, 'w', encoding='utf-8') as f:
            json.dump(team_data, f, indent=2, ensure_ascii=False)
        
        print(f"  ✅ {team_name_clean}: {len(players_list)} jugadores")
        
        teams_data.append({
            'name': team_name_clean,
            'playersFile': team_file,
            'playerCount': len(players_list)
        })
    
    # Guardar archivo de equipos de la liga
    league_file_data = {
        'league': league_config['name'],
        'season': '2024/25',
        'lastUpdated': datetime.now().isoformat(),
        'source': 'SoFIFA',
        'teams': teams_data
    }
    
    teams_path = TEAMS_DIR / league_config['file']
    with open(teams_path, 'w', encoding='utf-8') as f:
        json.dump(league_file_data, f, indent=2, ensure_ascii=False)
    
    print(f"  💾 Guardado: teams/{league_config['file']}")

def generate_leagues_file(processed_leagues):
    """Genera archivo leagues.json con todas las ligas."""
    leagues_data = {
        'lastUpdated': datetime.now().isoformat(),
        'season': '2024/25',
        'source': 'SoFIFA (FIFA Database)',
        'leagues': [
            {
                'id': league['id'].replace('-', '_').upper(),
                'name': league['name'],
                'teamsFile': league['file'],
                'enabled': True
            }
            for league in processed_leagues
        ]
    }
    
    leagues_path = DATA_DIR / 'leagues.json'
    with open(leagues_path, 'w', encoding='utf-8') as f:
        json.dump(leagues_data, f, indent=2, ensure_ascii=False)
    
    print(f"\n💾 Actualizado: leagues.json")

# ============================================
# EJECUCIÓN PRINCIPAL
# ============================================

def main():
    print("🚀 GOALDEMY - DESCARGA DESDE SOFIFA (FIFA)")
    print("=" * 60)
    print(f"📁 Directorio de datos: {DATA_DIR}")
    print(f"⚽ Ligas a procesar: {len(LEAGUES_CONFIG)}")
    if SPECIFIC_TEAMS:
        print(f"🎯 Equipos específicos: {len(SPECIFIC_TEAMS)}")
    print()
    
    start_time = datetime.now()
    processed_leagues = []
    total_players = 0
    total_teams = 0
    
    for league_config in LEAGUES_CONFIG:
        league_data = download_league_data(league_config)
        
        if league_data:
            process_and_save_data(league_data)
            processed_leagues.append(league_config)
            total_players += len(league_data['players'])
            total_teams += len(league_data['teams'])
    
    if processed_leagues:
        generate_leagues_file(processed_leagues)
    
    duration = (datetime.now() - start_time).total_seconds()
    
    print("\n" + "=" * 60)
    print("✅ DESCARGA COMPLETADA")
    print("=" * 60)
    print(f"⏱️  Duración: {duration:.1f}s")
    print(f"🏆 Ligas procesadas: {len(processed_leagues)}")
    print(f"⚽ Equipos totales: {total_teams}")
    print(f"👥 Jugadores totales: {total_players}")
    print(f"\n📁 Archivos generados:")
    print(f"   - {DATA_DIR / 'leagues.json'}")
    print(f"   - {TEAMS_DIR}/*.json")
    print(f"   - {PLAYERS_DIR}/*.json")
    print("\n🎮 ¡Datos de FIFA listos para Goaldemy!")

if __name__ == '__main__':
    main()
