/**
 * DATOS DE LA PÁGINA /logros — módulo puro (sin Supabase ni DOM).
 *
 * La tabla `achievements` no tiene categoría, ni flag de secreto, ni progreso:
 * solo code/name/description/points. Así que acá se INFIEREN, con mapas chicos
 * y explícitos por código, para no tocar el servidor:
 *
 *  - CATEGORÍA: CATEGORY_BY_CODE (+ prefijos). Lo que no esté mapeado cae en
 *    'juegos'. Al sumar un logro nuevo, agregalo acá si no es de juegos.
 *  - SECRETOS: SECRET_CODES. Se muestran como "???" hasta desbloquearlos.
 *    Es una decisión de producto: editá la lista para cambiar cuáles son.
 *  - PROGRESO: solo los logros cuyo dato ya tenemos sin consultas extra.
 *    Hoy: la racha diaria (user_profiles.daily_streak) para daily_streak_N.
 *    El resto se muestra como bloqueado/desbloqueado, sin barra (no se inventa).
 *  - RAREZA: sale de achievement-icons.js (la misma que usa el resto de la app).
 */
import { achievementIcon } from '../../services/achievement-icons'

export const CATEGORIES = [
  { key: 'todos', label: 'Todos' },
  { key: 'juegos', label: 'Juegos' },
  { key: 'racha', label: 'Racha' },
  { key: 'coleccion', label: 'Colección' },
  { key: 'social', label: 'Social' },
  { key: 'secretos', label: 'Secretos' },
]

const CATEGORY_BY_CODE = {
  // Racha: días seguidos / victorias o aciertos encadenados
  daily_super_5x3: 'racha',
  doble_jornada: 'racha',
  especialista: 'racha',
  semana_primera: 'racha',
  relojero: 'racha',
  invicto: 'racha',
  invicto_temporada: 'racha',
  sin_red: 'racha',
  fuego_azul: 'racha',
  // Colección: juntar cosas (juegos distintos, sobres, respuestas)
  trotamundos: 'coleccion',
  todoterreno: 'coleccion',
  coleccionista: 'coleccion',
  enciclopedia: 'coleccion',
  // Social
  social_butterfly: 'social',
  chat_master: 'social',
}
const CATEGORY_BY_PREFIX = [
  ['daily_streak_', 'racha'],
  ['streak_', 'racha'],
]

export function categoryFor(code) {
  if (!code) return 'juegos'
  if (CATEGORY_BY_CODE[code]) return CATEGORY_BY_CODE[code]
  for (const [prefix, cat] of CATEGORY_BY_PREFIX) if (code.startsWith(prefix)) return cat
  return 'juegos'
}

export const SECRET_CODES = new Set([
  'comeback_king',
  'lucky_first',
  'salvado_escudo',
  'tiempo_descuento',
])

export const SECRET_DESC = 'Logro secreto. Seguí jugando para descubrirlo.'

// Paleta de la medalla hexagonal (diseño V4 Logros).
export const RARITY = {
  common: { label: 'COMÚN', short: 'Común', color: '#94a3b8', ink: '#0f172a', metal: 'linear-gradient(160deg,#e2e8f0,#64748b 60%,#334155)', inner: 'linear-gradient(160deg,#475569,#1e293b)', glow: 'rgba(148,163,184,0.35)' },
  rare: { label: 'RARO', short: 'Raro', color: '#60a5fa', ink: '#fff', metal: 'linear-gradient(160deg,#bfdbfe,#3b82f6 55%,#1e3a8a)', inner: 'linear-gradient(160deg,#2563eb,#172554)', glow: 'rgba(96,165,250,0.45)' },
  epic: { label: 'ÉPICO', short: 'Épico', color: '#c084fc', ink: '#fff', metal: 'linear-gradient(160deg,#e9d5ff,#a855f7 55%,#581c87)', inner: 'linear-gradient(160deg,#7e22ce,#3b0764)', glow: 'rgba(168,85,247,0.5)' },
  legendary: { label: 'LEGENDARIO', short: 'Leg.', color: '#fbbf24', ink: '#451a03', metal: 'linear-gradient(160deg,#fff7d6,#fbbf24 50%,#b45309)', inner: 'linear-gradient(160deg,#d97706,#451a03)', glow: 'rgba(251,191,36,0.55)' },
}
export const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary']

export const NEW_WINDOW_MS = 48 * 3600 * 1000

/**
 * Progreso medible. `ctx` = { dailyStreak, progressByCode? }. Devuelve { done, total } o null.
 */
export function progressFor(code, ctx = {}) {
  // Avance real calculado por services/achievement-progress.js (contadores de sesiones, conexiones…)
  const ext = ctx.progressByCode?.[code]
  if (ext && Number(ext.target) > 0) {
    const total = Number(ext.target)
    return { done: Math.min(Math.max(0, Number(ext.current) || 0), total), total }
  }
  const m = /^daily_streak_(\d+)$/.exec(code || '')
  if (m && Number.isFinite(ctx.dailyStreak)) {
    const total = Number(m[1])
    return { done: Math.min(Math.max(0, ctx.dailyStreak), total), total }
  }
  return null
}

/**
 * Arma la lista completa: catálogo activo ∪ logros que el usuario ya tiene
 * (incluye retirados que conserva). `owned` = filas de getUserAchievements.
 */
export function buildAchievementList(catalog = {}, owned = [], ctx = {}, now = Date.now()) {
  const byCode = new Map()
  for (const code of Object.keys(catalog || {})) {
    byCode.set(code, { ...catalog[code], earnedAt: null })
  }
  for (const row of owned || []) {
    const a = row?.achievements
    if (!a?.code) continue
    // Logros retirados (ya no están en el catálogo activo) no cuentan: así el total
    // coincide con el del perfil (catálogo = fuente de verdad).
    if (byCode.size && !byCode.has(a.code)) continue
    byCode.set(a.code, { ...(byCode.get(a.code) || {}), ...a, earnedAt: row.earned_at || null })
  }

  const out = []
  for (const [code, a] of byCode) {
    const { icon, rarity } = achievementIcon(code)
    const done = !!a.earnedAt
    const secret = SECRET_CODES.has(code)
    const earnedMs = done ? Date.parse(a.earnedAt) : NaN
    const progress = done ? null : progressFor(code, ctx)
    out.push({
      code,
      name: a.name || 'Logro',
      description: a.description || '',
      points: a.points ?? null,
      icon,
      rarity: RARITY[rarity] ? rarity : 'common',
      category: categoryFor(code),
      secret,
      hidden: secret && !done, // se muestra como "???"
      done,
      earnedAt: a.earnedAt,
      isNew: done && Number.isFinite(earnedMs) && now - earnedMs < NEW_WINDOW_MS,
      progress,
    })
  }

  // Orden: nuevos → con progreso (más cerca primero) → bloqueados → secretos → conseguidos (recientes primero).
  const rank = (x) => (x.isNew ? 0 : !x.done && x.progress ? 1 : !x.done && !x.hidden ? 2 : x.hidden ? 3 : 4)
  out.sort((a, b) => {
    const r = rank(a) - rank(b)
    if (r) return r
    if (a.done && b.done) return Date.parse(b.earnedAt) - Date.parse(a.earnedAt)
    if (a.progress && b.progress) return (b.progress.done / b.progress.total) - (a.progress.done / a.progress.total)
    return RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity) || a.name.localeCompare(b.name)
  })
  return out
}

export function matchesFilter(item, key) {
  if (key === 'todos') return true
  if (key === 'secretos') return item.secret
  return item.category === key
}

/** 'hoy' · 'ayer' · 'dd/mm' */
export function shortDate(iso, now = Date.now()) {
  if (!iso) return ''
  const d = new Date(iso)
  const today = new Date(now)
  const sameDay = (x, y) => x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate()
  if (sameDay(d, today)) return 'hoy'
  if (sameDay(d, new Date(now - 86400000))) return 'ayer'
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
}
