/**
 * SERVICIO DE XP PARA JUEGOS
 * 
 * Maneja el otorgamiento de XP por respuestas correctas en los juegos.
 * Este servicio actúa como capa intermedia entre los juegos y el sistema de XP base.
 * 
 * FLUJO:
 * 1. El jugador responde correctamente en un juego
 * 2. El juego llama a awardXpForCorrect()
 * 3. Se otorga XP usando el RPC award_xp (seguro, server-side)
 * 4. Se actualiza la racha de inicio de sesión diario
 *
 * CACHE DE GAME IDs:
 * - Los slugs de juegos (ej: 'guess-player') se convierten a UUIDs
 * - Se cachean en memoria para evitar consultas repetitivas a la BD
 * - Map<slug, uuid> persiste durante la sesión del navegador
 *
 * NOTA: first_correct y ten_correct quedaron `active = false`
 * (supabase/achievements-curation-2.sql) y ya no se evalúan acá.
 */
import { awardXp } from './xp'
import { supabase } from './supabase'
import { updateDailyLoginStreak } from './daily-streak'

// Cache en memoria para evitar consultas repetitivas de game_id por slug
const gameIdCache = new Map()

/**
 * Obtiene el UUID de un juego a partir de su slug (ej: 'guess-player')
 * Usa cache para evitar consultas repetitivas
 */
async function getGameIdBySlug(slug) {
  if (gameIdCache.has(slug)) return gameIdCache.get(slug)
  const { data, error } = await supabase.from('games').select('id').eq('slug', slug).maybeSingle()
  const id = error ? null : data?.id ?? null
  if (id) gameIdCache.set(slug, id)
  return id
}

/**
 * Otorga XP por una respuesta correcta y verifica logros automáticos
 * @param {Object} opts
 * @param {string} opts.gameCode - Código corto del juego (ej: 'guess-player', 'nationality')
 * @param {number} [opts.amount=10] - XP base por respuesta correcta (puede variar según juego)
 * @param {number} [opts.attemptIndex=0] - Índice del intento (base 0, no usado actualmente)
 * @param {number} [opts.corrects=1] - Total de respuestas correctas en esta sesión
 * @param {number} [opts.streak=0] - Racha actual (opcional, para metadata)
 * @param {string} [opts.difficulty='normal'] - Dificultad seleccionada (easy, normal, hard)
 */
export async function awardXpForCorrect({ gameCode, amount = 10, attemptIndex = 0, corrects = 1, streak = 0, difficulty = 'normal' }) {
  try {
    // Convertir slug del juego a UUID y otorgar XP de forma segura via RPC
    const gameId = await getGameIdBySlug(gameCode)
    await awardXp({ amount, reason: 'correct_answer', gameId, sessionId: null, meta: { game: gameCode, corrects, streak, difficulty } })
  } catch {}
  
  try {
    // Actualizar racha de inicio de sesión diario (solo la primera vez del día)
    await updateDailyLoginStreak()
    // first_correct y ten_correct quedaron `active = false` (saturaban la
    // primera partida de cuentas nuevas): ya no se evalúan acá.
  } catch {}
}

export async function awardXpBatch({ gameCode, totalXp, corrects = 0 }) {
  if (totalXp <= 0) return
  try {
    const gameId = await getGameIdBySlug(gameCode)
    await awardXp({ amount: totalXp, reason: 'correct_answer', gameId, sessionId: null, meta: { game: gameCode, corrects, batch: true } })
  } catch {}
  try { await updateDailyLoginStreak() } catch {}
  // first_correct y ten_correct quedaron `active = false`: ya no se evalúan acá.
}
