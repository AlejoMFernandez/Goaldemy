import { supabase } from './supabase'
import { pushLevelUpToast } from '../stores/notifications'

let channel = null
let currentUserId = null
let lastKnownLevel = null
let initialized = false
let authUnsubscribe = null

const storageKeyForUser = (id) => `gl:last_level:${id}`

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
    try { if (lastKnownLevel != null) localStorage.setItem(storageKeyForUser(currentUserId), String(lastKnownLevel)) } catch {}
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
          try { if (lastKnownLevel != null) localStorage.setItem(storageKeyForUser(currentUserId), String(lastKnownLevel)) } catch {}
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

// Allow other modules (e.g., fallback post-award checks) to sync the known level
export function setKnownLevel(level) {
  lastKnownLevel = typeof level === 'number' ? level : Number(level || 0) || lastKnownLevel
  try { if (currentUserId && lastKnownLevel != null) localStorage.setItem(storageKeyForUser(currentUserId), String(lastKnownLevel)) } catch {}
}
