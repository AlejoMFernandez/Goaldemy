import { supabase } from './supabase'
import { getAuthUser } from './auth'
import { unlockAchievementWithToast } from './xp'

/**
 * Check social butterfly achievement (10+ connections)
 * Call after accepting/making a connection
 */
export async function checkSocialButterflyAchievement() {
  const { id: userId } = getAuthUser() || {}
  if (!userId) return

  try {
    const { data, error } = await supabase
      .from('connections')
      .select('id')
      .or(`user_a.eq.${userId},user_b.eq.${userId}`)
      .eq('status', 'accepted')

    if (error) return

    const connectionCount = (data || []).length

    if (connectionCount >= 10) {
      await unlockAchievementWithToast('social_butterfly')
    }
  } catch (e) {
    console.error('[social-achievements] social_butterfly error:', e)
  }
}

/**
 * Check chat master achievement (100+ direct messages sent, lifetime).
 * Call after sending a direct message.
 *
 * Cuenta un contador persistente (user_profiles.direct_messages_sent_count,
 * ver supabase/chat-dm-retention.sql) en vez de filas vivas de direct_messages:
 * esa tabla se purga cada 48hs para no explotar la base, así que contar filas
 * directamente rompería el logro apenas se borraran mensajes viejos.
 */
export async function checkChatMasterAchievement() {
  const { id: userId } = getAuthUser() || {}
  if (!userId) return

  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('direct_messages_sent_count')
      .eq('id', userId)
      .single()

    if (error) return

    const messageCount = data?.direct_messages_sent_count || 0

    if (messageCount >= 100) {
      await unlockAchievementWithToast('chat_master')
    }
  } catch (e) {
    console.error('[social-achievements] chat_master error:', e)
  }
}
