/**
 * SERVICIO DE COSMÉTICOS (Fase 4)
 * Bordes de foto de perfil + títulos. Se desbloquean por nivel (y premium).
 * Envuelve las RPCs de supabase/rewards-phase4.sql.
 */
import { supabase } from './supabase'
import { getAuthUser } from './auth'
import { pushClaimNotification, queueCosmeticOverlay } from '../stores/notifications'

/** Catálogo de cosméticos con estado owned/equipped del usuario. */
export async function getCosmetics() {
  const { id } = getAuthUser() || {}
  if (!id) return []
  const { data, error } = await supabase.rpc('get_cosmetics')
  if (error) {
    console.warn('[cosmetics] get_cosmetics:', error.message)
    return []
  }
  return Array.isArray(data) ? data : []
}

// Catálogo estático (code, name, rarity, style_key, premium_only): cambia solo
// cuando se agrega un cosmético nuevo, así que cachearlo evita re-pedirlo en
// CADA carga de perfil (era una query extra secuencial en getEquippedCosmetics).
let _catalogByCodeCache = null
let _catalogByCodeAt = 0
const CATALOG_TTL_MS = 5 * 60_000
async function catalogByCode() {
  const now = Date.now()
  if (_catalogByCodeCache && (now - _catalogByCodeAt < CATALOG_TTL_MS)) return _catalogByCodeCache
  const { data: cat, error } = await supabase.from('cosmetics').select('code, name, rarity, style_key, premium_only')
  if (error) {
    if (_catalogByCodeCache) return _catalogByCodeCache // seguí usando el caché viejo antes que nada
    throw error
  }
  _catalogByCodeCache = Object.fromEntries((cat || []).map(c => [c.code, c]))
  _catalogByCodeAt = now
  return _catalogByCodeCache
}

/**
 * Cosméticos equipados de un usuario, resueltos a estilo/texto.
 * Resiliente: si el schema de cosméticos no existe todavía, devuelve defaults.
 */
export async function getEquippedCosmetics(userId) {
  const out = { frameKey: 'none', titleText: '', titleRarity: 'common', iconGlyph: '', bannerKey: 'default', iconBg: 'emerald', framePremium: false, titlePremium: false, bannerPremium: false, dailyStreak: 0, frameLevel: null }
  if (!userId) return out
  let byCode = {}
  try {
    byCode = await catalogByCode()
  } catch { return out }
  // Fase 4: bordes + títulos
  try {
    const { data: p } = await supabase
      .from('user_profiles').select('equipped_frame, equipped_title').eq('id', userId).maybeSingle()
    if (p) {
      const fr = byCode[p.equipped_frame]; const ti = byCode[p.equipped_title]
      if (fr) { out.frameKey = fr.style_key || 'none'; out.framePremium = !!fr.premium_only }
      if (ti) { out.titleText = ti.name || ''; out.titleRarity = ti.rarity || 'common'; out.titlePremium = !!ti.premium_only }
    }
  } catch { /* sin columnas de fase 4 */ }
  // Fase 4b: íconos + banners (query aparte por si las columnas no existen)
  try {
    const { data: p2 } = await supabase
      .from('user_profiles').select('equipped_icon, equipped_banner, equipped_icon_bg').eq('id', userId).maybeSingle()
    if (p2) {
      const ic = byCode[p2.equipped_icon]; const ba = byCode[p2.equipped_banner]
      if (ic) out.iconGlyph = ic.style_key || ''
      if (ba) { out.bannerKey = ba.style_key || 'default'; out.bannerPremium = !!ba.premium_only }
      if (p2.equipped_icon_bg) out.iconBg = p2.equipped_icon_bg
    }
  } catch { /* sin columnas de fase 4b/4d */ }
  // Racha diaria actual (solo la usa el borde "Racha encendida")
  // Chapitas reales de los bordes vivos: nivel (Placa de nivel) y racha (Racha encendida)
  if (out.frameKey === 'level_plate' || out.frameKey === 'streak') {
    const st = (await getCosmeticStatsBatch([userId]))[userId]
    if (st) { out.frameLevel = st.level; out.dailyStreak = st.dailyStreak }
  }
  return out
}

/**
 * Nivel + racha diaria efectiva de VARIOS usuarios en UNA llamada (RPC get_users_cosmetic_stats,
 * supabase/vestuario-batch-stats.sql). Devuelve { [userId]: { level, dailyStreak } }; {} si falla.
 */
export async function getCosmeticStatsBatch(userIds) {
  const ids = Array.from(new Set((userIds || []).filter(Boolean)))
  if (!ids.length) return {}
  try {
    const { data, error } = await supabase.rpc('get_users_cosmetic_stats', { p_user_ids: ids })
    if (error || !Array.isArray(data)) return {}
    return Object.fromEntries(data.map(r => [r.user_id, { level: r.level ?? null, dailyStreak: effectiveStreak(r.daily_streak, r.last_activity_date) }]))
  } catch { return {} }
}

/** Racha diaria actual de un usuario (0 si se cortó o no hay columnas). */
export async function getDailyStreak(userId) {
  if (!userId) return 0
  try {
    const { data } = await supabase
      .from('user_profiles').select('daily_streak, last_activity_date').eq('id', userId).maybeSingle()
    return data ? effectiveStreak(data.daily_streak, data.last_activity_date) : 0
  } catch { return 0 }
}

/**
 * Cosméticos equipados de VARIOS usuarios de una (para el ranking).
 * Hace 1 query al catálogo + 1 a user_profiles. Devuelve un map:
 *   { [userId]: { frameKey, iconGlyph, iconBg } }
 * Resiliente: si faltan columnas de fase 4, devuelve defaults.
 */
export async function getEquippedCosmeticsBatch(userIds) {
  const out = {}
  const ids = Array.from(new Set((userIds || []).filter(Boolean)))
  if (!ids.length) return out

  let byCode = {}
  try {
    byCode = await catalogByCode()
  } catch { return out }

  // Intento con icon_bg (fase 4d); si la columna no existe, sin ella.
  let profs = null
  let res = await supabase.from('user_profiles').select('id, equipped_frame, equipped_icon, equipped_icon_bg').in('id', ids)
  if (res.error) {
    res = await supabase.from('user_profiles').select('id, equipped_frame, equipped_icon').in('id', ids)
  }
  if (!res.error) profs = res.data

  // Nivel + racha: una sola llamada por lote, solo para quienes llevan un borde vivo.
  const liveIds = (profs || []).filter(p => ['level_plate', 'streak'].includes(byCode[p.equipped_frame]?.style_key)).map(p => p.id)
  const stats = await getCosmeticStatsBatch(liveIds)

  for (const p of profs || []) {
    const fr = byCode[p.equipped_frame]
    const ic = byCode[p.equipped_icon]
    out[p.id] = {
      frameKey: fr?.style_key || 'none',
      iconGlyph: ic?.style_key || '',
      iconBg: p.equipped_icon_bg || 'emerald',
      dailyStreak: stats[p.id]?.dailyStreak || 0,
      frameLevel: stats[p.id]?.level ?? null,
    }
  }
  return out
}

/**
 * Racha diaria que se muestra HOY. daily_streak queda guardado hasta la próxima
 * partida, así que si el último día jugado no es hoy ni ayer (UTC, igual que
 * services/daily-streak.js) la racha ya se cortó y vale 0.
 */
export function effectiveStreak(dailyStreak, lastActivityDate) {
  const n = Number(dailyStreak) || 0
  if (n <= 0 || !lastActivityDate) return 0
  const last = new Date(String(lastActivityDate).slice(0, 10) + 'T00:00:00Z')
  const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z')
  return Math.round((today - last) / 86400000) <= 1 ? n : 0
}

// Tope del aro de "Racha encendida": con 30 días seguidos el aro está al 100 %.
export const STREAK_FULL_DAYS = 30
export function streakPercent(days) {
  return Math.max(0, Math.min(100, Math.round(((Number(days) || 0) / STREAK_FULL_DAYS) * 100)))
}

/** Equipa un cosmético (o desequipa el título pasando ''). */
export async function equipCosmetic(code) {
  const { data, error } = await supabase.rpc('equip_cosmetic', { p_code: code })
  if (error) return { ok: false, error: error.message }
  return data || { ok: false }
}

// ── Forma de los avatares ──
// PRUEBA: todos los avatares redondos. Para volver al cuadrado redondeado de antes,
// cambiá esta UNA línea a 'square' (los bordes del vestuario nuevo siempre son círculo).
export const AVATAR_SHAPE = 'round' // 'round' | 'square'
export const AVATAR_ROUND = AVATAR_SHAPE === 'round'
/** Clase de radio para un contenedor de avatar: círculo, o el radio de siempre si vuelve el cuadrado. */
export function avatarRadiusClass(squareClass = 'rounded-2xl') {
  return AVATAR_ROUND ? 'rounded-full' : squareClass
}

// ── Estilos de bordes (ring alrededor del avatar) por style_key ──
// El frame es un wrapper con gradiente; el avatar va adentro con inset.
export const FRAME_STYLES = {
  none:    { wrap: '', pad: '' },
  bronze:  { wrap: 'bg-gradient-to-br from-amber-600 to-amber-800', pad: 'p-[3px]' },
  silver:  { wrap: 'bg-gradient-to-br from-slate-200 to-slate-500', pad: 'p-[3px]' },
  gold:    { wrap: 'bg-gradient-to-br from-amber-300 to-yellow-600 shadow-[0_0_14px_rgba(251,191,36,0.45)]', pad: 'p-[3px]' },
  emerald: { wrap: 'bg-gradient-to-br from-emerald-300 to-cyan-500 shadow-[0_0_14px_rgba(16,185,129,0.45)]', pad: 'p-[3px]' },
  legend:  { wrap: 'frm-prismatic shadow-[0_0_18px_rgba(232,121,249,0.5)]', pad: 'p-[3px]' },
  premium: { wrap: 'bg-gradient-to-br from-amber-400 via-yellow-200 to-amber-500 shadow-[0_0_18px_rgba(251,191,36,0.5)]', pad: 'p-[3px]' },
  champion:{ wrap: 'frm-champion shadow-[0_0_22px_rgba(251,191,36,0.6)]', pad: 'p-[3px]' },
  diamond: { wrap: 'frm-diamond shadow-[0_0_22px_rgba(125,211,252,0.7)]', pad: 'p-[3px]' },
  // Familia "medallón": anillo metálico + remaches (borde punteado) + glow por rareza.
  // Pad igual al resto de los bordes (3px) y borde de 1px: antes (5px + border-2) se
  // comía demasiado espacio del ícono en avatares chicos (rail de amigos).
  medal_bronze:  { wrap: 'bg-gradient-to-br from-amber-300 via-amber-600 to-amber-900 border border-dotted border-amber-200/60 shadow-[0_0_16px_rgba(180,120,60,0.5)]', pad: 'p-[3px]' },
  medal_silver:  { wrap: 'bg-gradient-to-br from-white via-slate-300 to-slate-500 border border-dotted border-white/70 shadow-[0_0_16px_rgba(203,213,225,0.5)]', pad: 'p-[3px]' },
  medal_gold:    { wrap: 'bg-gradient-to-br from-yellow-200 via-amber-400 to-amber-700 border border-dotted border-yellow-100/70 shadow-[0_0_18px_rgba(251,191,36,0.6)]', pad: 'p-[3px]' },
  medal_diamond: { wrap: 'bg-gradient-to-br from-cyan-100 via-sky-300 to-blue-500 border border-dotted border-white/80 shadow-[0_0_20px_rgba(125,211,252,0.65)]', pad: 'p-[3px]' },
  medal_emerald: { wrap: 'bg-gradient-to-br from-emerald-200 via-emerald-400 to-teal-700 border border-dotted border-emerald-100/70 shadow-[0_0_18px_rgba(16,185,129,0.6)]', pad: 'p-[3px]' },
  medal_champion:{ wrap: 'bg-gradient-to-br from-amber-200 via-yellow-400 to-cyan-500 border border-dotted border-amber-100/80 shadow-[0_0_22px_rgba(251,191,36,0.65)] anim-pan', pad: 'p-[3px]' },

  // ── Vestuario nuevo (moodboard vestuario, 09/2026) ──
  // Estos NO usan wrap/pad: los dibuja <AvatarFrame> (aro de diseño 108 px escalado + overlay).
  //   ring   = clase .frm-* del aro (style.css)      padPx = grosor del aro en el diseño de 108 px
  //   badge  = chapita a tamaño real (level | streak | captain)   fx = pieza extra del overlay
  //   moves  = tiene animación propia (se congela en avatares chicos)   glow = sombra exterior
  chalk:       { wrap: '', pad: '', round: true, ring: 'frm-tiza',        padPx: 6, fx: 'chalk' },
  grass:       { wrap: '', pad: '', round: true, ring: 'frm-cesped',      padPx: 7 },
  net:         { wrap: '', pad: '', round: true, ring: 'frm-red',         padPx: 7 },
  level_plate: { wrap: '', pad: '', round: true, ring: 'frm-nivel',       padPx: 7, badge: 'level' },
  captain:     { wrap: '', pad: '', round: true, ring: 'frm-capitan',     padPx: 7, badge: 'captain' },
  fence:       { wrap: '', pad: '', round: true, ring: 'frm-alambrado',   padPx: 7 },
  led:         { wrap: '', pad: '', round: true, ring: 'frm-led',         padPx: 7, moves: true, glow: true },
  floodlights: { wrap: '', pad: '', round: true, ring: 'frm-reflectores', padPx: 7, moves: true, glow: true },
  laurel:      { wrap: '', pad: '', round: true, ring: 'frm-laurel',      padPx: 5, fx: 'laurel' },
  streak:      { wrap: '', pad: '', round: true, ring: 'frm-racha',       padPx: 7, badge: 'streak', glow: true },
  fire_ring:   { wrap: '', pad: '', round: true, ring: 'frm-fuego',       padPx: 7, moves: true, glow: true },
  stars:       { wrap: '', pad: '', round: true, ring: 'frm-estrellas',   padPx: 7, fx: 'stars', moves: true, glow: true },
}

export function frameStyle(styleKey) {
  return FRAME_STYLES[styleKey] || FRAME_STYLES.none
}

/** true si el borde es del vestuario nuevo (se dibuja con <AvatarFrame>). */
export function isSceneFrame(styleKey) {
  return !!FRAME_STYLES[styleKey]?.ring
}

// ── Estilos de banners (fondo del header) por style_key ──
// style_key → clase CSS con PATRÓN (definidas en style.css: .bnr-*).
export const BANNER_STYLES = {
  default: 'bnr-default',
  pitch:   'bnr-pitch',
  night:   'bnr-night',
  fire:    'bnr-fire',
  galaxy:  'bnr-galaxy',
  gold:    'bnr-gold',
  neon:    'bnr-neon',
  // Banners de categoría (desbloqueables por nivel del tier)
  tier_aficionado:  'bnr-tier-aficionado',
  tier_juvenil:     'bnr-tier-juvenil',
  tier_amateur:     'bnr-tier-amateur',
  tier_reserva:     'bnr-tier-reserva',
  tier_profesional: 'bnr-tier-profesional',
  tier_crack:       'bnr-tier-crack',
  // Vestuario nuevo (moodboard vestuario, 09/2026): el fondo va en la clase, las capas
  // (SVG, pelota, reloj, papelitos…) las dibuja <BannerScene>.
  mowed:       'bnr-mowed',
  penalty:     'bnr-penalty',
  leather:     'bnr-leather',
  scoreboard:  'bnr-scoreboard',
  away_kit:    'bnr-away-kit',
  live:        'bnr-live',
  var:         'bnr-var',
  tactics:     'bnr-tactics',
  newspaper:   'bnr-newspaper',
  rain:        'bnr-rain',
  heatmap:     'bnr-heatmap',
  lights:      'bnr-lights',
  passmap:     'bnr-passmap',
  commentary:  'bnr-commentary',
  ticker_tape: 'bnr-ticker-tape',
}

export function bannerStyle(styleKey) {
  return BANNER_STYLES[styleKey] || BANNER_STYLES.default
}

// Banners del vestuario nuevo: llevan capas, se dibujan con <BannerScene>.
export const SCENE_BANNER_KEYS = ['mowed', 'penalty', 'leather', 'scoreboard', 'away_kit', 'live', 'var', 'tactics', 'newspaper', 'rain', 'heatmap', 'lights', 'passmap', 'commentary', 'ticker_tape']
export function isSceneBanner(styleKey) {
  return SCENE_BANNER_KEYS.includes(styleKey)
}

// "Tapa de diario" es papel claro: el texto del usuario que se pone encima va oscuro.
export function bannerHasLightPaper(styleKey) {
  return styleKey === 'newspaper'
}

// ── Títulos: tratamiento visual por rareza (igual que .tt del moodboard) ──
// común liso · rara rombo celeste + marco · épica sello violeta · legendaria Anton dorado con brillo.
// El título PRO (premium) conserva su shimmer dorado propio.
export function titleClass(rar, premium = false) {
  if (premium) return 'title-premium-anim'
  return 'ttl ttl-' + (RARITY[rar] ? rar : 'common')
}

// ── Colores de fondo del ícono/avatar ──
export const ICON_BG_STYLES = {
  emerald: 'bg-gradient-to-br from-emerald-500 to-cyan-500',
  cyan:    'bg-gradient-to-br from-cyan-500 to-teal-600',
  sky:     'bg-gradient-to-br from-sky-500 to-blue-600',
  violet:  'bg-gradient-to-br from-violet-500 to-fuchsia-600',
  fuchsia: 'bg-gradient-to-br from-fuchsia-500 to-purple-600',
  rose:    'bg-gradient-to-br from-rose-500 to-pink-600',
  amber:   'bg-gradient-to-br from-amber-500 to-orange-600',
  orange:  'bg-gradient-to-br from-orange-500 to-red-600',
  slate:   'bg-gradient-to-br from-slate-600 to-slate-800',
}
export const ICON_BG_KEYS = Object.keys(ICON_BG_STYLES)
export function iconBgStyle(key) {
  return ICON_BG_STYLES[key] || ICON_BG_STYLES.emerald
}

// ── Fondo TEMÁTICO por ícono (estilo LoL) ──
// Cada ícono trae su propia escena. Se usa como fondo del avatar CUANDO hay un
// ícono equipado; si no hay ícono, se usa el color elegido (iconBgStyle).
// Clave = style_key del cosmético (emoji legacy) o clave semántica.
export const ICON_THEME_BG = {
  '⚽': 'bg-gradient-to-b from-emerald-600 to-emerald-950',
  '👟': 'bg-gradient-to-b from-orange-600 to-orange-950',
  '🧤': 'bg-gradient-to-b from-sky-600 to-blue-950',
  '🏅': 'bg-gradient-to-b from-amber-500 to-amber-900',
  '🏆': 'bg-gradient-to-b from-violet-600 to-violet-950',
  '⭐': 'bg-gradient-to-b from-amber-400 to-orange-800',
  '🛡️': 'bg-gradient-to-b from-slate-500 to-slate-800',
  '🛡': 'bg-gradient-to-b from-slate-500 to-slate-800',
  '👑': 'bg-gradient-to-b from-fuchsia-600 to-indigo-950',
  '🐐': 'bg-gradient-to-b from-amber-500 to-yellow-950',
  ball: 'bg-gradient-to-b from-emerald-600 to-emerald-950',
  boot: 'bg-gradient-to-b from-orange-600 to-orange-950',
  gloves: 'bg-gradient-to-b from-sky-600 to-blue-950',
  medal: 'bg-gradient-to-b from-amber-500 to-amber-900',
  trophy: 'bg-gradient-to-b from-violet-600 to-violet-950',
  star: 'bg-gradient-to-b from-amber-400 to-orange-800',
  shield: 'bg-gradient-to-b from-slate-500 to-slate-800',
  crown: 'bg-gradient-to-b from-fuchsia-600 to-indigo-950',
  goat: 'bg-gradient-to-b from-amber-500 to-yellow-950',
  // íconos secretos (por logro)
  bolt: 'bg-gradient-to-b from-yellow-400 to-amber-950',
  flame: 'bg-gradient-to-b from-orange-500 to-red-950',
  gem: 'bg-gradient-to-b from-cyan-400 to-blue-950',
  owl: 'bg-gradient-to-b from-indigo-500 to-slate-950',
  broom: 'bg-gradient-to-b from-emerald-500 to-emerald-950',
  sun: 'bg-gradient-to-b from-amber-400 to-orange-950',
  clover: 'bg-gradient-to-b from-green-500 to-green-950',
  sword: 'bg-gradient-to-b from-rose-600 to-slate-950',
  hat: 'bg-gradient-to-b from-violet-500 to-slate-950',
  laurel: 'bg-gradient-to-b from-amber-500 to-yellow-950',
  chat: 'bg-gradient-to-b from-sky-500 to-blue-950',
  butterfly: 'bg-gradient-to-b from-fuchsia-500 to-purple-950',
  globe: 'bg-gradient-to-b from-teal-500 to-blue-950',
  comet: 'bg-gradient-to-b from-indigo-500 to-slate-950',
  phoenix: 'bg-gradient-to-b from-orange-500 to-rose-950',
  // insignias de rango (fondo temático por metal/marca)
  rank_bronze: 'bg-gradient-to-b from-amber-700 to-amber-950',
  rank_silver: 'bg-gradient-to-b from-slate-500 to-slate-900',
  rank_gold: 'bg-gradient-to-b from-yellow-600 to-amber-950',
  rank_emerald: 'bg-gradient-to-b from-emerald-600 to-emerald-950',
  rank_cyan: 'bg-gradient-to-b from-cyan-600 to-cyan-950',
  rank_champion: 'bg-gradient-to-b from-teal-700 to-slate-950',
}
export function iconThemeBg(styleKey) {
  return ICON_THEME_BG[styleKey] || 'bg-gradient-to-b from-emerald-600 to-cyan-900'
}

/** Guarda el color de fondo del ícono del usuario. */
export async function setIconBg(color) {
  const { data, error } = await supabase.rpc('set_icon_bg', { p_color: color })
  if (error) return { ok: false, error: error.message }
  return data || { ok: false }
}

// ── Colores por rareza ──
export const RARITY = {
  common:    { text: 'text-slate-300',    border: 'border-white/15',        bg: 'bg-white/5',            label: 'Común' },
  rare:      { text: 'text-sky-300',      border: 'border-sky-500/30',      bg: 'bg-sky-500/10',         label: 'Rara' },
  epic:      { text: 'text-fuchsia-300',  border: 'border-fuchsia-500/30',  bg: 'bg-fuchsia-500/10',     label: 'Épica' },
  legendary: { text: 'text-amber-300',    border: 'border-amber-500/40',    bg: 'bg-amber-500/10',       label: 'Legendaria' },
}

export function rarity(r) {
  return RARITY[r] || RARITY.common
}

// ── Pistas de cómo conseguir cosméticos por LOGRO (secretos) ──
// Clave = código del logro. Se usa para el hover del editor y el "por qué" de la escena de reclamo.
export const ACHIEVEMENT_HINTS = {
  streak_15: 'Conseguí 15 aciertos seguidos en un juego',
  daily_streak_7: 'Jugá 7 días seguidos',
  daily_streak_30: 'Jugá 30 días seguidos',
  perfectionist: 'Completá un juego sin ningún error',
  daily_wins_all: 'Ganá todos los juegos del día',
  centurion: 'Acumulá 100 victorias totales',
  guess_master: 'Ganá 20 partidas de "Adivina el jugador"',
  comeback_king: 'Ganá un juego que perdiste el día anterior',
  lucky_first: 'Acertá al primer intento 10 veces',
  hat_trick: 'Ganá 3 juegos distintos el mismo día',
  chat_master: 'Enviá 100 mensajes en el chat',
  social_butterfly: 'Conectá con 10 usuarios',
  nationality_expert: 'Acertá 50 nacionalidades correctas',
  grand_slam: 'Ganá todos los juegos en una semana',
}
export function hintFor(c) { return ACHIEVEMENT_HINTS[c?.unlock_achievement] || 'Conseguí un logro secreto' }
// Por qué se desbloqueó un cosmético (para la escena de reclamo).
export function unlockReason(c) {
  if (!c) return ''
  if (c.unlock_achievement) return ACHIEVEMENT_HINTS[c.unlock_achievement] || 'Conseguiste un logro secreto'
  if (c.premium_only) return 'Recompensa Premium'
  if (c.unlock_level > 100) return 'Completar el Pase mensual'
  if (c.unlock_level > 1) return 'Alcanzaste el nivel ' + c.unlock_level
  return 'Recompensa desbloqueada'
}

// Qué cosmético(s) desbloquea cada logro (para el hover de la tarjeta de logros).
// code → [{ code, name, type, rarity, styleKey }]
let _unlocksByAchievementCache = null
export async function getCosmeticUnlocksByAchievement() {
  if (_unlocksByAchievementCache) return _unlocksByAchievementCache
  const { data, error } = await supabase
    .from('cosmetics')
    .select('code, name, type, rarity, style_key, unlock_achievement')
    .not('unlock_achievement', 'is', null)
  if (error || !data) return {}
  const map = {}
  for (const c of data) {
    const key = c.unlock_achievement
    if (!map[key]) map[key] = []
    // style_key (no camelCase): PassCosmetic.vue espera esta forma exacta (viene de get_monthly_pass).
    map[key].push({ code: c.code, name: c.name, type: c.type, rarity: c.rarity || 'common', style_key: c.style_key || '' })
  }
  _unlocksByAchievementCache = map
  return map
}

// ── Aviso de cosméticos recién desbloqueados ──
// Scopeado por usuario: sin scope, una cuenta veía/silenciaba los cosméticos de otra.
const SEEN_KEY_PREFIX = 'gl:seen_cosmetics'
const seenKeyFor = (id) => `${SEEN_KEY_PREFIX}:${id}`
export const TYPE_LABEL = { frame: 'Borde', title: 'Título', icon: 'Ícono', banner: 'Banner' }
const RARITY_EMOJI = { common: '✨', rare: '🔷', epic: '🟪', legendary: '🌟' }

// Exclusivo = merece la escena premium (logros difíciles, últimos tiers del pase, premium).
// Los default por nivel (común/raro) NO lo son → solo notificación chica.
export function isExclusiveCosmetic(c) {
  if (!c) return false
  return c.rarity === 'legendary' || c.rarity === 'epic' || !!c.unlock_achievement || !!c.premium_only
}

/**
 * Compara los cosméticos que tenés ahora con los ya vistos y avisa los nuevos.
 * La primera vez solo cachea (no spamea con los que ya tenías).
 */
export async function checkCosmeticUnlocks() {
  const { id } = getAuthUser() || {}
  if (!id) return
  let items
  try { items = await getCosmetics() } catch { return }
  if (!Array.isArray(items) || items.length === 0) return

  // Limpiar la clave global vieja (filtraba estado entre cuentas).
  try { localStorage.removeItem(SEEN_KEY_PREFIX) } catch {}

  const seenKey = seenKeyFor(id)
  const owned = items.filter(c => c.owned).map(c => c.code)
  let seen = []
  let hadCache = false
  try {
    const raw = localStorage.getItem(seenKey)
    if (raw) { seen = JSON.parse(raw) || []; hadCache = true }
  } catch {}

  if (hadCache) {
    const seenSet = new Set(seen)
    const fresh = items.filter(c => c.owned && !seenSet.has(c.code) && c.code !== 'frame_none' && c.code !== 'icon_none')
    for (const c of fresh) {
      // Los cosméticos por NIVEL ya se muestran como cartas en la escena de nivel
      // ("Desbloqueaste", moodboard 03/08): no se repiten en la escena grande.
      const byLevel = c.unlock_level > 1 && c.unlock_level <= 100 && !c.unlock_achievement && !c.premium_only
      if (isExclusiveCosmetic(c) && !byLevel) {
        // Exclusivos (legendarios/épicos, por logro o premium): escena premium tipo logro.
        queueCosmeticOverlay({ code: c.code, name: c.name, type: c.type, rarity: c.rarity, styleKey: c.style_key, reason: unlockReason(c) })
      } else {
        // Default (por nivel, común/raro): solo notificación apilada chica.
        pushClaimNotification({
          type: 'cosmetic',
          title: `${TYPE_LABEL[c.type] || 'Cosmético'}: ${c.name}`,
          emoji: RARITY_EMOJI[c.rarity] || '🎨',
        })
      }
    }
  }

  try { localStorage.setItem(seenKey, JSON.stringify(owned)) } catch {}
}
