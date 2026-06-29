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

/**
 * Cosméticos equipados de un usuario, resueltos a estilo/texto.
 * Resiliente: si el schema de cosméticos no existe todavía, devuelve defaults.
 */
export async function getEquippedCosmetics(userId) {
  const out = { frameKey: 'none', titleText: '', titleRarity: 'common', iconGlyph: '', bannerKey: 'default', iconBg: 'emerald', framePremium: false, titlePremium: false, bannerPremium: false }
  if (!userId) return out
  let byCode = {}
  try {
    const { data: cat } = await supabase.from('cosmetics').select('code, name, rarity, style_key, premium_only')
    byCode = Object.fromEntries((cat || []).map(c => [c.code, c]))
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
  return out
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
    const { data: cat } = await supabase.from('cosmetics').select('code, style_key')
    byCode = Object.fromEntries((cat || []).map(c => [c.code, c]))
  } catch { return out }

  // Intento con icon_bg (fase 4d); si la columna no existe, sin ella.
  let profs = null
  let res = await supabase.from('user_profiles').select('id, equipped_frame, equipped_icon, equipped_icon_bg').in('id', ids)
  if (res.error) {
    res = await supabase.from('user_profiles').select('id, equipped_frame, equipped_icon').in('id', ids)
  }
  if (!res.error) profs = res.data

  for (const p of profs || []) {
    const fr = byCode[p.equipped_frame]
    const ic = byCode[p.equipped_icon]
    out[p.id] = {
      frameKey: fr?.style_key || 'none',
      iconGlyph: ic?.style_key || '',
      iconBg: p.equipped_icon_bg || 'emerald',
    }
  }
  return out
}

/** Equipa un cosmético (o desequipa el título pasando ''). */
export async function equipCosmetic(code) {
  const { data, error } = await supabase.rpc('equip_cosmetic', { p_code: code })
  if (error) return { ok: false, error: error.message }
  return data || { ok: false }
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
  medal_bronze:  { wrap: 'bg-gradient-to-br from-amber-300 via-amber-600 to-amber-900 border-2 border-dotted border-amber-200/60 shadow-[0_0_16px_rgba(180,120,60,0.5)]', pad: 'p-[5px]' },
  medal_silver:  { wrap: 'bg-gradient-to-br from-white via-slate-300 to-slate-500 border-2 border-dotted border-white/70 shadow-[0_0_16px_rgba(203,213,225,0.5)]', pad: 'p-[5px]' },
  medal_gold:    { wrap: 'bg-gradient-to-br from-yellow-200 via-amber-400 to-amber-700 border-2 border-dotted border-yellow-100/70 shadow-[0_0_18px_rgba(251,191,36,0.6)]', pad: 'p-[5px]' },
  medal_diamond: { wrap: 'bg-gradient-to-br from-cyan-100 via-sky-300 to-blue-500 border-2 border-dotted border-white/80 shadow-[0_0_20px_rgba(125,211,252,0.65)]', pad: 'p-[5px]' },
}

export function frameStyle(styleKey) {
  return FRAME_STYLES[styleKey] || FRAME_STYLES.none
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
}

export function bannerStyle(styleKey) {
  return BANNER_STYLES[styleKey] || BANNER_STYLES.default
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

// ── Aviso de cosméticos recién desbloqueados ──
// Scopeado por usuario: sin scope, una cuenta veía/silenciaba los cosméticos de otra.
const SEEN_KEY_PREFIX = 'gl:seen_cosmetics'
const seenKeyFor = (id) => `${SEEN_KEY_PREFIX}:${id}`
const TYPE_LABEL = { frame: 'Borde', title: 'Título', icon: 'Ícono', banner: 'Banner' }
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
      if (isExclusiveCosmetic(c)) {
        // Exclusivos (legendarios/épicos, por logro o premium): escena premium tipo logro.
        queueCosmeticOverlay({ code: c.code, name: c.name, type: c.type, rarity: c.rarity, styleKey: c.style_key })
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
