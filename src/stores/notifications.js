import { reactive } from 'vue'

// Simple global notifications store (singleton)
// Supports 'achievement' and 'level' toasts.
const state = reactive({
  items: [], // { id, type, title, iconUrl, earnedAt, level }
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

// Generic helpers
export function pushErrorToast(message, ttlMs = 6000) {
  return push({ type: 'error', title: normalizeMessage(message) }, ttlMs)
}
export function pushSuccessToast(message, ttlMs = 4000) {
  return push({ type: 'success', title: normalizeMessage(message) }, ttlMs)
}
export function pushInfoToast(message, ttlMs = 4000) {
  return push({ type: 'info', title: normalizeMessage(message) }, ttlMs)
}

function normalizeMessage(msg) {
  if (!msg) return 'Operación realizada'
  if (typeof msg === 'string') return msg
  return msg.message || msg.error || 'Ocurrió un error'
}
