import { reactive } from 'vue'

const state = reactive({
  items: [],
  achievementQueue: [],
  levelUpQueue: [],
  pendingRewards: [],
})

const _lastLevelToastAt = new Map()
const LEVEL_TOAST_DEDUPE_MS = 8000

function remove(id) {
  const idx = state.items.findIndex(n => n.id === id)
  if (idx !== -1) state.items.splice(idx, 1)
}

function _genId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function push(item, ttlMs = 5000) {
  const id = _genId()
  const entry = { id, ...item }
  state.items.push(entry)
  setTimeout(() => remove(id), ttlMs)
  return id
}

// ── Achievement overlay queue ──

export function queueAchievementOverlay({ title, iconUrl, earnedAt, points = 0, description = '', unlockPercent = null }) {
  const id = _genId()
  state.achievementQueue.push({ id, title, iconUrl, earnedAt, points, description, unlockPercent })
  addPendingReward('achievement', { title, iconUrl, points, id })
  return id
}

export function shiftAchievementQueue() {
  return state.achievementQueue.shift()
}

// ── Level-up overlay queue ──

export function queueLevelUpOverlay({ oldLevel, newLevel }) {
  const now = Date.now()
  const lastAt = _lastLevelToastAt.get(newLevel) || 0
  if (now - lastAt < LEVEL_TOAST_DEDUPE_MS) return null
  _lastLevelToastAt.set(newLevel, now)

  const id = _genId()
  state.levelUpQueue.push({ id, oldLevel, newLevel })
  addPendingReward('levelUp', { level: newLevel, id })
  return id
}

export function shiftLevelUpQueue() {
  return state.levelUpQueue.shift()
}

// ── Pending rewards (Reward Center) ──

function _loadRewards() {
  try {
    const raw = localStorage.getItem('gl:pending_rewards')
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) state.pendingRewards = parsed
    }
  } catch {}
}

function _saveRewards() {
  localStorage.setItem('gl:pending_rewards', JSON.stringify(state.pendingRewards))
}

_loadRewards()

export function addPendingReward(type, data) {
  const id = _genId()
  state.pendingRewards.push({ id, type, data, claimed: false, createdAt: Date.now() })
  _saveRewards()
  return id
}

export function claimReward(id) {
  const r = state.pendingRewards.find(r => r.id === id)
  if (r) r.claimed = true
  _saveRewards()
}

export function claimAllRewards() {
  state.pendingRewards.forEach(r => { r.claimed = true })
  _saveRewards()
}

export function getUnclaimedCount() {
  return state.pendingRewards.filter(r => !r.claimed).length
}

export function clearClaimedRewards() {
  state.pendingRewards = state.pendingRewards.filter(r => !r.claimed)
  _saveRewards()
}

// ── Legacy toast API (still used for errors, success, info) ──

export function pushAchievementToast({ title, iconUrl, earnedAt, points = null }) {
  return queueAchievementOverlay({ title, iconUrl, earnedAt, points: points || 0 })
}

export function pushLevelUpToast({ level }) {
  const currentLevel = parseInt(localStorage.getItem('gl:last_known_level') || '1')
  return queueLevelUpOverlay({ oldLevel: currentLevel, newLevel: level })
}

export { state as notificationsState, remove as removeNotification }

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
