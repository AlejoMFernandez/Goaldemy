/**
 * SERVICIO — TIENDA + BILLETERA
 *
 * Doble moneda: Fichas (blanda, grindeable) y Balón de Oro (dura, plata real).
 * Envuelve las RPCs de supabase/mejoras11-currency-shop.sql.
 */
import { supabase } from './supabase'
import { getAuthUser } from './auth'

/** Saldo del usuario: { fichas, balones }. */
export async function getWallet() {
  const { id } = getAuthUser() || {}
  if (!id) return { fichas: 0, balones: 0 }
  const { data, error } = await supabase.rpc('get_wallet')
  if (error) {
    console.warn('[shop] get_wallet:', error.message)
    return { fichas: 0, balones: 0 }
  }
  return data || { fichas: 0, balones: 0 }
}

/** Catálogo de la tienda con flag owned. */
export async function getShop() {
  const { id } = getAuthUser() || {}
  if (!id) return []
  const { data, error } = await supabase.rpc('get_shop')
  if (error) {
    console.warn('[shop] get_shop:', error.message)
    return []
  }
  return Array.isArray(data) ? data : []
}

/** Compra un ítem con la moneda elegida. Devuelve { ok, error?, ... }. */
export async function purchaseItem(itemId, currency) {
  const { data, error } = await supabase.rpc('purchase_shop_item', { p_item_id: itemId, p_currency: currency })
  if (error) return { ok: false, error: error.message }
  return data || { ok: false }
}

/** Etiquetas legibles de error de compra. */
export const PURCHASE_ERRORS = {
  auth: 'Iniciá sesión para comprar',
  bad_currency: 'Moneda inválida',
  not_found: 'El ítem ya no está disponible',
  already_owned: 'Ya tenés este cosmético',
  currency_not_accepted: 'Ese ítem no se compra con esa moneda',
  insufficient: 'No te alcanza el saldo',
}
