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
  levelUpActive: false,   // hay una escena de nivel/rango en pantalla
  achievementActive: false, // hay una escena central de logro en pantalla (nivel y logro nunca se pisan)
  cosmeticActive: false,  // hay un carrusel de cosméticos en pantalla → la subida de nivel espera a que termine
  proWelcome: null,       // { plan, planName } → popup de bienvenida PRO (gatea los desbloqueables hasta cerrarlo)
  claimNotifications: [],
  pendingChecks: 0,       // chequeos de logros/cosméticos en curso (el resumen espera antes de navegar)
  albumNew: [],           // códigos desbloqueados sin ver en la Colección (badge NUEVO; services/cosmetics.js)
  claimShown: null,       // el ÚNICO aviso chico en pantalla (arriba, nunca apilados ni sobre botones)
})

// ── Deduplicación por sesión ──
// Un mismo logro o cosmético se anuncia UNA sola vez por sesión aunque llegue dos veces
// (Realtime duplicado al reconectar el celu, chequeos que se pisan, etc.).
const _achAnnounced = new Set()
const _cosAnnounced = new Set()
// Niveles cuya escena de subida ya se encoló en esta sesión: sus cosméticos se ven en el
// "Desbloqueaste" de esa escena y no se repiten como carta aparte.
const _levelScenes = new Set()
export function isLevelCovered(level) { return _levelScenes.has(Number(level)) }

// Después de un logro o una subida de nivel puede haber cosméticos nuevos: se revisan solos.
function _scheduleCosmeticCheck(ms = 1200) {
  import('../services/cosmetics').then(m => m.scheduleCosmeticCheck?.(ms)).catch(() => {})
}

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

export function queueAchievementOverlay({ code = '', title, iconUrl, earnedAt, points = 0, description = '', unlockPercent = null }) {
  const key = code || title
  if (key && _achAnnounced.has(key)) return null
  if (key) _achAnnounced.add(key)
  _scheduleCosmeticCheck()
  const id = _genId()
  state.achievementQueue.push({ id, code, title, iconUrl, earnedAt, points, description, unlockPercent })
  addPendingReward('achievement', { title, iconUrl, points, description, id })
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
  for (let l = Number(oldLevel) + 1; l <= Number(newLevel); l++) _levelScenes.add(l)
  _scheduleCosmeticCheck()

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
// `level`: cosmético por nivel que no se vio en ninguna escena de subida (ej. subiste en otro
// dispositivo). Si cuando le toca mostrarse esa escena ya existe, se descarta (no se repite).
export function queueCosmeticOverlay({ code, name, type, rarity, styleKey, reason, level = null }) {
  if (code && _cosAnnounced.has(code)) return null
  if (code) _cosAnnounced.add(code)
  const id = _genId()
  state.cosmeticQueue.push({ id, code, name, type, rarity: rarity || 'common', styleKey: styleKey || '', reason: reason || '', level })
  return id
}
/** Marca un cosmético como ya anunciado en esta sesión (lo mostró otra escena). */
export function markCosmeticAnnounced(code) { if (code) _cosAnnounced.add(code) }

export function shiftCosmeticQueue() {
  return state.cosmeticQueue.shift()
}

// ── Claim notifications (bottom-right stack) ──

// Un aviso por vez, arriba (ClaimNotificationStack). Mientras hay una escena o el resumen
// de partida en pantalla, esperan: nunca se apilan sobre botones.
const CLAIM_SUB = { cosmetic: 'Ya está en tu Vestuario', powerup: 'Se sumó a tus ayudas', xp: 'Sumado a tu nivel', achievement: 'Logro cobrado', levelUp: 'Bonus de nivel cobrado', milestone: 'Premio de rango cobrado' }
let _claimTimer = null
function _overlayBusy() {
  return state.suppressOverlays || state.levelUpActive || state.achievementActive || state.cosmeticActive || !!state.proWelcome
    || state.achievementQueue.length > 0 || state.levelUpQueue.length > 0 || state.cosmeticQueue.length > 0
}
function _pumpClaims() {
  if (state.claimShown || _claimTimer) return
  if (!state.claimNotifications.length) return
  if (_overlayBusy()) { _claimTimer = setTimeout(() => { _claimTimer = null; _pumpClaims() }, 700); return }
  state.claimShown = state.claimNotifications.shift()
  _claimTimer = setTimeout(() => {
    state.claimShown = null
    _claimTimer = setTimeout(() => { _claimTimer = null; _pumpClaims() }, 250)
  }, 2600)
}
export function pushClaimNotification({ type, title, xp, emoji, sub }) {
  const id = _genId()
  state.claimNotifications.push({ id, type, title, xp: xp || 0, emoji: emoji || '🎁', sub: sub || CLAIM_SUB[type] || '' })
  // como mucho 3 esperando: los más viejos se descartan (son respaldo de algo que ya se vio)
  while (state.claimNotifications.length > 3) state.claimNotifications.shift()
  _pumpClaims()
}

/**
 * Se resuelve cuando no queda ninguna escena en pantalla ni en cola (logros → nivel →
 * cosméticos), después de `settleMs` sin novedades (los logros llegan por Realtime con
 * un poco de demora). Lo usa el resumen para navegar al próximo juego recién al final.
 */
export function beginPendingCheck() { state.pendingChecks++ }
export function endPendingCheck() { state.pendingChecks = Math.max(0, state.pendingChecks - 1) }

export function whenOverlaysIdle({ settleMs = 900, maxMs = 120000 } = {}) {
  return new Promise((resolve) => {
    const t0 = Date.now()
    let quietSince = null
    const tick = () => {
      // Los chequeos en curso cuentan solo los primeros 10 s (si una red lenta los traba, no bloquean)
      const checking = state.pendingChecks > 0 && Date.now() - t0 < 10000
      const busy = checking || state.levelUpActive || state.achievementActive || state.cosmeticActive || !!state.proWelcome
        || state.achievementQueue.length > 0 || state.levelUpQueue.length > 0 || state.cosmeticQueue.length > 0
      if (busy) quietSince = null
      else if (quietSince == null) quietSince = Date.now()
      if ((quietSince != null && Date.now() - quietSince >= settleMs) || Date.now() - t0 > maxMs) return resolve()
      setTimeout(tick, 150)
    }
    tick()
  })
}

// ── Silent XP award (no level-up detection to prevent cascade) ──

async function _awardBonusXpSilent(amount) {
  try {
    if (import.meta.env.VITE_SERVER_ECONOMY === '1') {
      // El servidor calcula y paga los bonus de nivel pendientes (1 vez por
      // nivel, ver supabase/pendientes/2026-11-24-04-xp-servidor.sql). El
      // monto local solo se usa para mostrar.
      await supabase.rpc('claim_level_up_bonus')
      import('../services/xp').then(m => m.detectAndToastLevelUp?.()).catch(() => {})
      return
    }
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
  // Un logro aparece una sola vez en la Bandeja aunque se anuncie dos veces
  if (type === 'achievement' && data?.title && state.pendingRewards.some(r => r.type === 'achievement' && r.data?.title === data.title)) return null
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

export function claimReward(id, { quiet = false } = {}) {
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
  // quiet: la recompensa ya viajó a su contador (reward-flight) → sin toast
  if (!quiet) pushClaimNotification({ type: r.type, title, xp: displayXp, emoji })
}

export function claimAllRewards({ quiet = false } = {}) {
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
    if (!quiet) setTimeout(() => pushClaimNotification({ type: r.type, title, xp: displayXp, emoji }), i * 150)
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

export function pushAchievementToast({ code = '', title, iconUrl, earnedAt, points = null, description = '' }) {
  return queueAchievementOverlay({ code, title, iconUrl, earnedAt, points: points || 0, description })
}

export function pushLevelUpToast({ level, oldLevel }) {
  const resolvedOld = oldLevel ?? parseInt(localStorage.getItem('gl:last_known_level') || '1')
  return queueLevelUpOverlay({ oldLevel: resolvedOld, newLevel: level })
}

export function setSuppressOverlays(val) { state.suppressOverlays = !!val }
export function setLevelUpActive(val) { state.levelUpActive = !!val }
export function setAchievementActive(val) { state.achievementActive = !!val }
export function setCosmeticActive(val) { state.cosmeticActive = !!val }

// ── Bienvenida PRO ──
// Se muestra UNA vez, la primera vez que detectamos plan pago (guard por usuario).
// Mientras está activo, la escena de cosméticos espera (ver CosmeticUnlockOverlay).
export function clearProWelcome() { state.proWelcome = null }

export async function maybeShowProWelcome() {
  try {
    const { getAuthUser } = await import('../services/auth')
    const { id } = getAuthUser() || {}
    if (!id) return
    const key = `gl:pro_welcome_seen:${id}`
    if (localStorage.getItem(key)) return

    const { getUserPlan } = await import('../services/premium')
    const plan = await getUserPlan()
    if (!plan || plan.plan === 'free') return   // solo PRO / Legend

    state.proWelcome = {
      plan: plan.plan,
      planName: plan.planName || 'PRO',
      xpMultiplier: plan.xpMultiplier ?? 1,
      dailyPowerups: plan.dailyPowerups ?? 0,
      weeklyStreakProtectors: plan.weeklyStreakProtectors ?? 0,
    }
    // El guard se setea al CERRAR el popup (así si recarga sin cerrarlo, reaparece).
  } catch {}
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

// Toast efímero de mensaje directo entrante (estilo WhatsApp): avatar + nombre + preview.
// Click → abre ese chat en la sidebar (ver stores/sidebar.js requestOpenChat).
// El ícono/marco equipado (frameKey/iconGlyph/iconBg) ya viene cacheado en FriendsDock
// (se pidió una vez al cargar la lista de amigos), así que mostrarlo acá no pega a la red.
export function pushDmToast({ peerId, name, avatarUrl, message, frameKey, iconGlyph, iconBg, initial, level, streak }, ttlMs = 6000) {
  return push({
    type: 'dm',
    peerId,
    title: name || 'Mensaje nuevo',
    message: (message || '').slice(0, 160),
    avatarUrl: avatarUrl || '',
    frameKey: frameKey || 'none',
    iconGlyph: iconGlyph || '',
    iconBg: iconBg || 'emerald',
    level: level ?? null,
    streak: streak || 0,
    initial: initial || (name || '?').trim().charAt(0).toUpperCase(),
  }, ttlMs)
}

function normalizeMessage(msg) {
  if (!msg) return 'Operación realizada'
  if (typeof msg === 'string') return msg
  return msg.message || msg.error || 'Ocurrió un error'
}
