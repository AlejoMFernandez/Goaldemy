import { supabase } from './supabase'

// Get achievements for a user, joined with achievements table
export async function getUserAchievements(userId) {
  const { data, error } = await supabase
    .from('user_achievements')
    .select('earned_at, achievements:achievement_id (id, code, name, description, icon_url, points)')
    .eq('user_id', userId)
    .order('earned_at', { ascending: false })
  return { data, error }
}
