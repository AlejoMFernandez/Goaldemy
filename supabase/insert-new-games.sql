-- Insert the 5 new games into the games table
-- Run this in Supabase SQL Editor

INSERT INTO public.games (slug, name, description, cover_url) VALUES
  ('football-wordle', 'Adiviná el Crack', 'Adiviná el jugador misterioso con pistas de colores', '/games/football-wordle.svg'),
  ('higher-or-lower', 'Mayor o Menor', '¿Quién tiene más? Armá la cadena más larga', '/games/higher-or-lower.svg'),
  ('connections', 'Conexiones', 'Agrupá 16 jugadores en 4 grupos por rasgo compartido', '/games/connections.svg'),
  ('football-grid', 'La Grilla', 'Completá la grilla 3x3 con jugadores que cumplan ambas condiciones', '/games/football-grid.svg'),
  ('stat-challenge', 'Duelo de Stats', 'Identificá al jugador a partir de sus estadísticas reales', '/games/stat-challenge.svg')
ON CONFLICT (slug) DO NOTHING;
