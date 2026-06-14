import { reactive } from 'vue'
import { supabase } from '../services/supabase'
import { getLevelUpXpBonus, getMilestone } from '../services/level-rewards'

const state = reactive({
  items: [],
  achievementQueue: [],
  levelUpQueue: [],
  pendingRewards: [],
  suppressOverlays: false,
  claimNotifications: [],
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

  const xpBonus = getLevelUpXpBonus(newLevel)
  const milestone = getMilestone(newLevel)
  const totalBonus = milestone ? milestone.xpBonus : xpBonus

  const rewardId = addPendingReward(milestone ? 'milestone' : 'levelUp', {
    level: newLevel,
    xpBonus: totalBonus,
    tier: milestone?.tier || null,
    color: milestone?.color || null,
  })

  const id = _genId()
  state.levelUpQueue.push({
    id, oldLevel, newLevel, xpBonus: totalBonus, rewardId,
    milestone: milestone || null,
  })

  return id
}

export function shiftLevelUpQueue() {
  return state.levelUpQueue.shift()
}

// ── Claim notifications (bottom-right stack) ──

export function pushClaimNotification({ type, title, xp, emoji }) {
  const id = _genId()
  state.claimNotifications.push({ id, type, title, xp: xp || 0, emoji: emoji || '🎁' })
  setTimeout(() => {
    const idx = state.claimNotifications.findIndex(n => n.id === id)
    if (idx !== -1) state.claimNotifications.splice(idx, 1)
  }, 3500)
}

// ── Silent XP award (no level-up detection to prevent cascade) ──

async function _awardBonusXpSilent(amount) {
  try {
    await supabase.rpc('award_xp', {
      p_amount: amount,
      p_reason: 'level_up_bonus',
      p_game_id: null,
      p_session_id: null,
      p_meta: { source: 'reward_claim' },
    })
  } catch {}
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
  if (!r || r.claimed) return
  r.claimed = true
  _saveRewards()

  const xpBonus = r.data?.xpBonus || 0
  if (xpBonus > 0) {
    _awardBonusXpSilent(xpBonus)
  }

  const notifTitle = r.type === 'milestone' ? `Rango: ${r.data?.tier}`
    : r.type === 'levelUp' ? `Nivel ${r.data?.level}`
    : r.type === 'achievement' ? (r.data?.title || 'Logro')
    : 'Recompensa'
  const emoji = r.type === 'achievement' ? '🏆'
    : r.type === 'milestone' ? '🏅'
    : r.type === 'levelUp' ? '⬆️'
    : '🎁'

  pushClaimNotification({ type: r.type, title: notifTitle, xp: xpBonus, emoji })
}

export function claimAllRewards() {
  const unclaimed = state.pendingRewards.filter(r => !r.claimed)
  let totalXpBonus = 0
  for (const r of unclaimed) {
    r.claimed = true
    totalXpBonus += (r.data?.xpBonus || 0)
  }
  _saveRewards()

  if (totalXpBonus > 0) {
    _awardBonusXpSilent(totalXpBonus)
  }

  if (unclaimed.length > 0) {
    pushClaimNotification({
      type: 'batch',
      title: `${unclaimed.length} recompensa${unclaimed.length > 1 ? 's' : ''}`,
      xp: totalXpBonus,
      emoji: '🎁',
    })
  }
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

export function pushLevelUpToast({ level, oldLevel }) {
  const resolvedOld = oldLevel ?? parseInt(localStorage.getItem('gl:last_known_level') || '1')
  return queueLevelUpOverlay({ oldLevel: resolvedOld, newLevel: level })
}

export function setSuppressOverlays(val) { state.suppressOverlays = !!val }

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
