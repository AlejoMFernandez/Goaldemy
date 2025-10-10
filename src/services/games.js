import { supabase } from './supabase';

// Fetch list of games from Supabase 'games' table
export async function fetchGames() {
  const { data, error } = await supabase
    .from('games')
    .select('id,name,description,image,created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[games.js fetchGames] Error fetching games:', error);
    throw error;
  }

  return data || [];
}

// Optionally fetch a single game by id (useful later)
export async function fetchGameById(id) {
  const { data, error } = await supabase
    .from('games')
    .select('id,name,description,image,created_at')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('[games.js fetchGameById] Error fetching game:', error);
    throw error;
  }

  return data;
}
