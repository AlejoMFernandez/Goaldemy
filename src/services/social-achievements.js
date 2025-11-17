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
 * Check chat master achievement (100+ messages sent)
 * Call after sending a message in global chat
 */
export async function checkChatMasterAchievement() {
  const { id: userId } = getAuthUser() || {}
  if (!userId) return

  try {
    const { data, error } = await supabase
      .from('global_chat_messages')
      .select('id')
      .eq('sender_id', userId)

    if (error) return

    const messageCount = (data || []).length

    if (messageCount >= 100) {
      await unlockAchievementWithToast('chat_master')
    }
  } catch (e) {
    console.error('[social-achievements] chat_master error:', e)
  }
}
