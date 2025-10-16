import { supabase } from './supabase'
import { pushLevelUpToast } from '../stores/notifications'

let channel = null
let currentUserId = null
let lastKnownLevel = null
let initialized = false
let authUnsubscribe = null

async function fetchLevel(userId) {
  try {
    const { data, error } = await supabase.rpc('get_user_level', { p_user_id: userId })
    if (error) return null
    const info = Array.isArray(data) ? data[0] : data
    return info?.level ?? null
  } catch {
    return null
  }
}

export function initLevelUpRealtime() {
  if (initialized) return channel
  initialized = true

  const ensureSubscribed = async () => {
    if (!currentUserId || channel) return
    lastKnownLevel = await fetchLevel(currentUserId)
    channel = supabase
      .channel('xp_events_levelup')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'xp_events' },
        async payload => {
          if (!currentUserId) return
          const row = payload?.new
          if (!row || row.user_id !== currentUserId) return
          const newLevel = await fetchLevel(currentUserId)
          if (newLevel && lastKnownLevel && newLevel > lastKnownLevel) {
            pushLevelUpToast({ level: newLevel })
          }
          lastKnownLevel = newLevel ?? lastKnownLevel
        }
      )
      .subscribe()
  }

  supabase.auth.onAuthStateChange(async (_evt, session) => {
    currentUserId = session?.user?.id || null
    if (!currentUserId) {
      if (channel) supabase.removeChannel(channel)
      channel = null
      lastKnownLevel = null
      return
    }
    await ensureSubscribed()
  })

  supabase.auth.getUser().then(async ({ data }) => {
    currentUserId = data?.user?.id || null
    if (currentUserId) await ensureSubscribed()
  })

  return channel
}

export function teardownLevelUpRealtime() {
  try {
    if (channel) supabase.removeChannel(channel)
    if (typeof authUnsubscribe === 'function') authUnsubscribe()
  } finally {
    channel = null
    lastKnownLevel = null
    initialized = false
  }
}
