import { reactive } from 'vue'
import { supabase } from '../services/supabase'
import { getLevelUpXpBonus, getMilestone } from '../services/level-rewards'

const state = reactive({
  items: [],
  achievementQueue: [],
  levelUpQueue: [],
  cosmeticQueue: [],
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

// ── Cosmetic unlock overlay queue ──
// Escena premium (estilo logro/Forager) SOLO para cosméticos EXCLUSIVOS al reclamarlos.
// Los cosméticos default (por nivel) NO usan esto: solo la notificación apilada chica.
export function queueCosmeticOverlay({ code, name, type, rarity, styleKey, reason }) {
  const id = _genId()
  state.cosmeticQueue.push({ id, code, name, type, rarity: rarity || 'epic', styleKey: styleKey || '', reason: reason || '' })
  return id
}

export function shiftCosmeticQueue() {
  return state.cosmeticQueue.shift()
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
    // El bonus puede cruzar un umbral de nivel: detectar level-up sin pasar por
    // awardXp(). Import dinámico para evitar el ciclo notifications<->xp.
    import('../services/xp').then(m => m.detectAndToastLevelUp?.()).catch(() => {})
  } catch {}
}

// ── Pending rewards (Reward Center) — SCOPEADO POR USUARIO ──
// Antes la clave era global ('gl:pending_rewards'): en el mismo navegador, una
// cuenta nueva veía las recompensas/logros de otra cuenta. Ahora se scopea por
// user id y se recarga al cambiar de sesión.
let _rewardsUserId = null

function _rewardsKey() {
  return _rewardsUserId ? `gl:pending_rewards:${_rewardsUserId}` : null
}

function _loadRewards() {
  const key = _rewardsKey()
  if (!key) { state.pendingRewards = []; return }
  try {
    const raw = localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : []
    state.pendingRewards = Array.isArray(parsed) ? parsed : []
  } catch { state.pendingRewards = [] }
}

function _saveRewards() {
  const key = _rewardsKey()
  if (!key) return
  try { localStorage.setItem(key, JSON.stringify(state.pendingRewards)) } catch {}
}

function _setRewardsUser(userId) {
  const next = userId || null
  if (next === _rewardsUserId) return
  _rewardsUserId = next
  _loadRewards()
}

// Limpiar la clave global vieja (filtraba datos entre cuentas).
try { localStorage.removeItem('gl:pending_rewards') } catch {}

supabase.auth.getUser().then(({ data }) => _setRewardsUser(data?.user?.id || null)).catch(() => {})
supabase.auth.onAuthStateChange((_evt, session) => _setRewardsUser(session?.user?.id || null))

export function addPendingReward(type, data) {
  const id = _genId()
  state.pendingRewards.push({ id, type, data, claimed: false, createdAt: Date.now() })
  _saveRewards()
  return id
}

function _rewardNotifMeta(r) {
  const title = r.type === 'milestone' ? `Rango: ${r.data?.tier}`
    : r.type === 'levelUp' ? `Nivel ${r.data?.level}`
    : r.type === 'achievement' ? (r.data?.title || 'Logro')
    : 'Recompensa'
  const emoji = r.type === 'achievement' ? '🏆'
    : r.type === 'milestone' ? '🏅'
    : r.type === 'levelUp' ? '⬆️'
    : '🎁'
  return { title, emoji }
}

export function claimReward(id) {
  const r = state.pendingRewards.find(r => r.id === id)
  if (!r || r.claimed) return
  r.claimed = true
  _saveRewards()

  // XP a OTORGAR ahora: solo bonus de nivel/rango (xpBonus). Los logros ya
  // otorgaron su XP (points) al desbloquearse → no se re-otorga.
  const xpBonus = r.data?.xpBonus || 0
  if (xpBonus > 0) {
    _awardBonusXpSilent(xpBonus)
  }

  // XP a MOSTRAR en la notificación: bonus o, para logros, sus points.
  const displayXp = xpBonus || r.data?.points || 0
  const { title, emoji } = _rewardNotifMeta(r)
  pushClaimNotification({ type: r.type, title, xp: displayXp, emoji })
}

export function claimAllRewards() {
  const unclaimed = state.pendingRewards.filter(r => !r.claimed)
  if (!unclaimed.length) return
  let totalXpBonus = 0
  unclaimed.forEach((r, i) => {
    r.claimed = true
    const xpBonus = r.data?.xpBonus || 0
    totalXpBonus += xpBonus
    const displayXp = xpBonus || r.data?.points || 0
    const { title, emoji } = _rewardNotifMeta(r)
    // Apiladas: una tras otra, pero todas visibles (no unificadas)
    setTimeout(() => pushClaimNotification({ type: r.type, title, xp: displayXp, emoji }), i * 150)
  })
  _saveRewards()

  if (totalXpBonus > 0) {
    _awardBonusXpSilent(totalXpBonus)
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
