/**
 * SERVICIO ADMIN — PASE DE BATALLA
 *
 * CRUD de temporadas (pass_seasons), asignación de cosméticos por
 * nivel/track (pass_season_rewards) y catálogo de cosméticos.
 * La escritura la protege RLS (ver supabase/mejoras11-admin-pass.sql):
 * sólo user_profiles.role = 'admin'. Igual chequeamos isAdmin() en
 * la app para dar errores claros antes de pegarle a la DB.
 */
import { supabase } from './supabase.js'
import { isAdmin } from './admin.js'

/** 'YYYY-MM-01' del primer día del mes de una fecha. */
export function monthKey(date = new Date()) {
  const d = new Date(date)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}-01`
}

/** Mes de la plantilla por defecto (se usa cuando un mes no tiene filas propias). */
export const TEMPLATE_MONTH = '0001-01-01'

async function requireAdmin() {
  if (!(await isAdmin())) throw new Error('No tenés permisos de administrador')
}

// ─── Temporadas ─────────────────────────────────────────────

/** Todas las temporadas, más recientes primero (la plantilla al final). */
export async function listSeasons() {
  const { data, error } = await supabase
    .from('pass_seasons')
    .select('month, name, theme, accent')
    .order('month', { ascending: false })
  if (error) throw error
  return data || []
}

/** Crea o actualiza una temporada. */
export async function upsertSeason({ month, name, theme, accent }) {
  await requireAdmin()
  const { data, error } = await supabase
    .from('pass_seasons')
    .upsert({ month, name, theme: theme || null, accent: accent || 'amber' }, { onConflict: 'month' })
    .select()
    .single()
  if (error) throw error
  return data
}

/** Elimina una temporada (sus recompensas se borran en cascada). */
export async function deleteSeason(month) {
  await requireAdmin()
  if (month === TEMPLATE_MONTH) throw new Error('No se puede borrar la plantilla por defecto')
  // Primero limpiamos las recompensas del mes (no hay cascada month→rewards).
  await supabase.from('pass_season_rewards').delete().eq('month', month)
  const { error } = await supabase.from('pass_seasons').delete().eq('month', month)
  if (error) throw error
}

// ─── Escalera de niveles (solo lectura en v1) ───────────────

/** Los 30 niveles del pase con sus umbrales de puntos. */
export async function listTiers() {
  const { data, error } = await supabase
    .from('monthly_pass_tiers')
    .select('tier, points_required, free_xp, free_powerup, free_powerup_qty, premium_xp, premium_powerup, premium_powerup_qty')
    .order('tier', { ascending: true })
  if (error) throw error
  return data || []
}

// ─── Recompensas cosméticas por temporada ───────────────────

/** Recompensas cosméticas de un mes, con los datos del cosmético embebidos. */
export async function listSeasonRewards(month) {
  const { data, error } = await supabase
    .from('pass_season_rewards')
    .select('month, tier, track, cosmetic_code, cosmetics:cosmetic_code (code, type, name, rarity, style_key)')
    .eq('month', month)
  if (error) throw error
  return data || []
}

/** Asigna (o reemplaza) el cosmético de un nivel/track de un mes. */
export async function setReward({ month, tier, track, cosmetic_code }) {
  await requireAdmin()
  const { error } = await supabase
    .from('pass_season_rewards')
    .upsert({ month, tier, track, cosmetic_code }, { onConflict: 'month,tier,track' })
  if (error) throw error
}

/** Quita el cosmético de un nivel/track. */
export async function clearReward({ month, tier, track }) {
  await requireAdmin()
  const { error } = await supabase
    .from('pass_season_rewards')
    .delete()
    .eq('month', month).eq('tier', tier).eq('track', track)
  if (error) throw error
}

// ─── Catálogo de cosméticos ─────────────────────────────────

/** Todos los cosméticos del catálogo. */
export async function listCosmetics() {
  const { data, error } = await supabase
    .from('cosmetics')
    .select('code, type, name, rarity, style_key, unlock_level, premium_only, sort_order, active')
    .order('type', { ascending: true })
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data || []
}

/** Crea o actualiza un cosmético del catálogo. */
export async function upsertCosmetic(payload) {
  await requireAdmin()
  const row = {
    code: payload.code,
    type: payload.type,
    name: payload.name,
    rarity: payload.rarity || 'common',
    style_key: payload.style_key || null,
    unlock_level: payload.unlock_level ?? 1,
    premium_only: !!payload.premium_only,
    sort_order: payload.sort_order ?? 0,
    active: payload.active !== false,
  }
  const { data, error } = await supabase
    .from('cosmetics')
    .upsert(row, { onConflict: 'code' })
    .select()
    .single()
  if (error) throw error
  return data
}

/** Elimina un cosmético del catálogo. */
export async function deleteCosmetic(code) {
  await requireAdmin()
  const { error } = await supabase.from('cosmetics').delete().eq('code', code)
  if (error) throw error
}
