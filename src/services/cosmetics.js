/**
 * SERVICIO DE COSMÉTICOS (Fase 4)
 * Bordes de foto de perfil + títulos. Se desbloquean por nivel (y premium).
 * Envuelve las RPCs de supabase/rewards-phase4.sql.
 */
import { supabase } from './supabase'
import { getAuthUser } from './auth'

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
  const out = { frameKey: 'none', titleText: '', titleRarity: 'common' }
  if (!userId) return out
  try {
    const { data: prof } = await supabase
      .from('user_profiles').select('equipped_frame, equipped_title').eq('id', userId).maybeSingle()
    if (!prof || (!prof.equipped_frame && !prof.equipped_title)) return out
    const { data: cat } = await supabase.from('cosmetics').select('code, name, rarity, style_key')
    const byCode = Object.fromEntries((cat || []).map(c => [c.code, c]))
    const fr = byCode[prof.equipped_frame]
    const ti = byCode[prof.equipped_title]
    if (fr) out.frameKey = fr.style_key || 'none'
    if (ti) { out.titleText = ti.name || ''; out.titleRarity = ti.rarity || 'common' }
  } catch { /* schema sin cosméticos: defaults */ }
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
  legend:  { wrap: 'bg-gradient-to-br from-fuchsia-400 via-amber-300 to-cyan-400 shadow-[0_0_18px_rgba(232,121,249,0.45)]', pad: 'p-[3px]' },
  premium: { wrap: 'bg-gradient-to-br from-amber-400 via-yellow-200 to-amber-500 shadow-[0_0_18px_rgba(251,191,36,0.5)]', pad: 'p-[3px]' },
}

export function frameStyle(styleKey) {
  return FRAME_STYLES[styleKey] || FRAME_STYLES.none
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
