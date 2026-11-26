/**
 * COLECCIONES POR RANGO — estado del usuario + cobro del premio.
 *
 * Las colecciones y sus piezas viven en src/data/collections.js (fuente única,
 * de ahí sale el SQL). Acá se cruza eso con lo que el usuario TIENE (codes de
 * get_cosmetics) y su nivel, para saber qué colección está bloqueada, en curso,
 * lista para cobrar o ya cobrada.
 *
 * El cobro usa claim_collection_prize (supabase/pendientes/2026-11-24-11-colecciones.sql).
 * Mientras ese SQL no esté aplicado, el RPC no existe: claimCollectionPrize
 * devuelve { ok:false, error:'unavailable' } y la UI lo explica sin romper.
 */
import { supabase } from './supabase'
import { COLLECTIONS, collectionProgress, collectionPrize } from '../data/collections'

export { COLLECTIONS }

/**
 * Estado de cada colección para un usuario.
 * @param {Iterable<string>} ownedCodes codes de cosméticos que tiene
 * @param {number} level nivel actual
 * @returns {Array<{ col, have, total, missing, complete, prizeOwned, state }>}
 *   state: 'locked' (rango no alcanzado) | 'current' (tu rango) | 'claim' (completa, premio sin cobrar)
 *          | 'done' (premio cobrado) | 'open' (rango pasado, incompleta)
 */
export function collectionsState(ownedCodes, level) {
  const owned = ownedCodes instanceof Set ? ownedCodes : new Set(ownedCodes || [])
  const lvl = Number(level) || 1
  return COLLECTIONS.map(col => {
    // El Álbum (GOAT) pide TODAS las piezas no-premio de todas las colecciones (igual que el RPC).
    const { have, total, complete } = col.key === 'album'
      ? collectionProgress({ pieces: COLLECTIONS.flatMap(c => c.pieces) }, owned)
      : collectionProgress(col, owned)
    const prize = collectionPrize(col)
    const prizeOwned = prize.length > 0 && prize.every(p => owned.has(p.code))
    let state
    if (complete && prize.length && !prizeOwned) state = 'claim'
    else if (complete) state = 'done'
    else if (lvl < col.minLevel) state = 'locked'
    else if (lvl <= col.maxLevel) state = 'current'
    else state = 'open'
    return { col, have, total, missing: Math.max(0, total - have), complete, prizeOwned, state }
  })
}

/** Cobra el premio de una colección completa. */
export async function claimCollectionPrize(key) {
  const { data, error } = await supabase.rpc('claim_collection_prize', { p_collection: key })
  if (error) {
    const missing = error.code === 'PGRST202' || /could not find the function/i.test(error.message || '')
    return { ok: false, error: missing ? 'unavailable' : (error.message || 'error') }
  }
  return data || { ok: false, error: 'error' }
}

export const CLAIM_ERRORS = {
  unavailable: 'El cobro de colecciones todavía no está activo. Ya llega.',
  already_claimed: 'Ya cobraste este premio.',
  incomplete: 'Te faltan piezas para cobrarlo.',
  no_prize: 'Esta colección todavía no tiene premio cargado.',
}
