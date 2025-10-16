import { reactive } from 'vue'

// Simple global notifications store (singleton)
// Currently supports only 'achievement' toasts, but can be extended.
const state = reactive({
  items: [], // { id, type, title, iconUrl, earnedAt }
})

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

export function pushAchievementToast({ title, iconUrl, earnedAt }) {
  return push({ type: 'achievement', title, iconUrl, earnedAt })
}

export function pushLevelUpToast({ level }) {
  // Title can be derived in the renderer; we keep data minimal
  return push({ type: 'level', title: `Nivel ${level}`, level })
}

export { state as notificationsState, remove as removeNotification }
