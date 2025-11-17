import { supabase } from './supabase'
import { pushAchievementToast } from '../stores/notifications'
import { playAchievementSound } from './sounds'

let channel = null
let currentUserId = null
let initialized = false
let authUnsubscribe = null

export function initAchievementsRealtime() {
  try {
    if (initialized) return channel
    initialized = true

    const ensureSubscribed = () => {
      if (!currentUserId || channel) return
      channel = supabase
        .channel('user_achievements_inserts')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'user_achievements' },
          async payload => {
            const row = payload?.new
            if (!row) return
            if (!currentUserId || row.user_id !== currentUserId) return
            const { data: achievement, error } = await supabase
              .from('achievements')
              .select('name, icon_url, points')
              .eq('id', row.achievement_id)
              .single()
            if (!error && achievement) {
              // Stagger slightly when multiple achievements arrive at the exact same time
              const delay = 120 * (Math.random() * 2) // 0-240ms random
              setTimeout(() => {
                pushAchievementToast({
                  title: achievement.name,
                  iconUrl: achievement.icon_url || null,
                  earnedAt: row.earned_at || new Date().toISOString(),
                  points: achievement.points || null,
                })
                // Solo sonido, sin confetti (puede ser tedioso con muchos logros)
                playAchievementSound()
              }, delay)
            }
          }
        )
        .subscribe()
    }

    // Auth state wiring (single listener)
    authUnsubscribe = supabase.auth.onAuthStateChange((_event, session) => {
      currentUserId = session?.user?.id || null
      if (!currentUserId) {
        if (channel) {
          supabase.removeChannel(channel)
          channel = null
        }
        return
      }
      ensureSubscribed()
    }).data?.subscription?.unsubscribe

    // Kick once with current state
    supabase.auth.getUser().then(({ data }) => {
      currentUserId = data?.user?.id || null
      if (currentUserId) ensureSubscribed()
    })

    return channel
  } catch (e) {
    return null
  }
}

export function teardownAchievementsRealtime() {
  try {
    if (channel) supabase.removeChannel(channel)
    if (typeof authUnsubscribe === 'function') authUnsubscribe()
  } catch (e) {
    // ignore
  }
  channel = null
  currentUserId = null
  initialized = false
}
