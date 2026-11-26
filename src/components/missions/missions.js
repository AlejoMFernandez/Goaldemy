/**
 * MISIONES — helpers de presentación (sin lógica de negocio: los datos y los
 * reclamos siguen saliendo de src/services/rewards.js).
 *
 *  - normalizeDaily / normalizeProgressive: llevan los retos diarios y los
 *    progresivos a una misma forma para <MissionRow>.
 *  - pickMonthly: el "Desafío FULVO del mes" = el reto progresivo activo más
 *    grande (mayor objetivo). Si no hay ninguno, null → la tarjeta se oculta.
 *  - passClaimableCount: cuántos niveles del pase hay para cobrar (para el
 *    contador rojo del segmento Pase; mismas reglas que MonthlyPass.vue).
 */
import { APP_TZ } from '../../services/app-date'
import { stubState } from '../pass/pass-rewards'

// Fondos de ícono del diseño V4 (se reparten por posición, estables por código).
export const ICON_BGS = [
  'linear-gradient(160deg,#10b981,#064e3b)',
  'linear-gradient(160deg,#38bdf8,#0369a1)',
  'linear-gradient(160deg,#a855f7,#3b0764)',
  'linear-gradient(160deg,#ef4444,#450a0a)',
  'linear-gradient(160deg,#f472b6,#be185d)',
  'linear-gradient(160deg,#f59e0b,#78350f)',
]
export const BAR_FILLS = [
  'linear-gradient(90deg,#34d399,#6ee7b7)',
  'linear-gradient(90deg,#38bdf8,#7dd3fc)',
  'linear-gradient(90deg,#a78bfa,#c4b5fd)',
  'linear-gradient(90deg,#f87171,#fca5a5)',
  'linear-gradient(90deg,#f472b6,#fb7185)',
  'linear-gradient(90deg,#fbbf24,#fcd34d)',
]

function hashIdx(code, n) {
  let h = 0
  for (const ch of String(code || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h % n
}

export function themeFor(code) {
  const i = hashIdx(code, ICON_BGS.length)
  return { iconBg: ICON_BGS[i], bar: BAR_FILLS[i] }
}

/** Reto diario → misión. state: 'claim' | 'done' | 'progress' */
export function normalizeDaily(c) {
  const target = Math.max(1, Number(c.target) || 1)
  const progress = Math.max(0, Number(c.progress) || 0)
  const complete = progress >= target
  return {
    key: 'd_' + c.code,
    code: c.code,
    kind: 'daily',
    icon: c.icon || '🎯',
    title: c.title,
    description: c.description,
    progress: Math.min(progress, target),
    target,
    xp: Number(c.reward_xp) || 0,
    powerup: c.reward_powerup || null,
    powerupQty: Number(c.reward_powerup_qty) || 0,
    state: c.claimed ? 'done' : complete ? 'claim' : 'progress',
    ...themeFor(c.code),
    raw: c,
  }
}

/** Reto progresivo → misión (nunca queda "tachado": al cobrar sube de nivel). */
export function normalizeProgressive(c) {
  const target = Math.max(1, Number(c.target) || 1)
  const progress = Math.max(0, Number(c.progress) || 0)
  return {
    key: 'p_' + c.code,
    code: c.code,
    kind: 'progressive',
    icon: c.icon || '🏆',
    title: c.title,
    description: c.description,
    tier: Number(c.tier) || 1,
    progress: Math.min(progress, target),
    target,
    xp: Number(c.reward_xp) || 0,
    powerup: c.reward_powerup && Number(c.reward_powerup_qty) > 0 ? c.reward_powerup : null,
    powerupQty: Number(c.reward_powerup_qty) || 0,
    state: c.claimable ? 'claim' : 'progress',
    ...themeFor(c.code),
    raw: c,
  }
}

const ORDER = { claim: 0, progress: 1, done: 2 }
export function sortMissions(list) {
  return [...list].sort((a, b) => ORDER[a.state] - ORDER[b.state])
}

/** El progresivo de mayor objetivo (desempate: mayor premio). */
export function pickMonthly(progressive) {
  if (!Array.isArray(progressive) || !progressive.length) return null
  return [...progressive].sort((a, b) =>
    (Number(b.target) || 0) - (Number(a.target) || 0) || (Number(b.reward_xp) || 0) - (Number(a.reward_xp) || 0)
  )[0] || null
}

/** Nombre del mes en Argentina ("noviembre"). */
export function appMonthName(date = new Date()) {
  try {
    return new Intl.DateTimeFormat('es-AR', { month: 'long', timeZone: APP_TZ }).format(date)
  } catch {
    return ''
  }
}

/** Niveles del pase con premio sin cobrar (mismas reglas que MonthlyPass.canClaim). */
export function passClaimableCount(pass) {
  const tiers = Array.isArray(pass?.tiers) ? pass.tiers : []
  // Mismas reglas que el Abono (incluye nivel 0 y talones de Fichas)
  const ready = (t, tr) => stubState(t, tr, !!pass.is_premium) === 'ready'
  return tiers.filter(t => ready(t, 'free') || ready(t, 'premium')).length
}
