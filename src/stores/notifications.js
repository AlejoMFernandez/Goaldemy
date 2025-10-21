import { reactive } from 'vue'

// Simple global notifications store (singleton)
// Supports 'achievement' and 'level' toasts.
const state = reactive({
  items: [], // { id, type, title, iconUrl, earnedAt }
})

// Dedupe guard for level-up toasts: avoid duplicates within a short window
const _lastLevelToastAt = new Map() // level -> timestamp
const LEVEL_TOAST_DEDUPE_MS = 8000

function remove(id) {
  const idx = state.items.findIndex(n => n.id === id)
  if (idx !== -1) state.items.splice(idx, 1)
}

function push(item, ttlMs = 5000) {
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const entry = { id, ...item }
  state.items.push(entry)
  // Auto dismiss
  setTimeout(() => remove(id), ttlMs)
  return id
}

export function pushAchievementToast({ title, iconUrl, earnedAt, points = null }) {
  return push({ type: 'achievement', title, iconUrl, earnedAt, points })
}

export function pushLevelUpToast({ level }) {
  // Title can be derived in the renderer; we keep data minimal
  const now = Date.now()
  const lastAt = _lastLevelToastAt.get(level) || 0
  if (now - lastAt < LEVEL_TOAST_DEDUPE_MS) return null
  _lastLevelToastAt.set(level, now)
  return push({ type: 'level', title: `Nivel ${level}`, level })
}

export { state as notificationsState, remove as removeNotification }
