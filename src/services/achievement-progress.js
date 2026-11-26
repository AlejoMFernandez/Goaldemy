/**
 * PROGRESO DE LOGROS BLOQUEADOS (para el vestuario)
 *
 * Devuelve, para un set de códigos de logro, cuánto le falta al usuario cuando ese
 * avance tiene un contador natural (ej.: 32/50). Es de SOLO LECTURA — nunca desbloquea
 * nada, no duplica la lógica de las reglas: reusa las mismas fuentes que los triggers
 * reales (achievement-triggers.js, achievement-rules.js, game-modes.js, daily-streak).
 *
 * Se agrupa por lote (una sola pasada de sesiones para todos los logros del sistema
 * nuevo) para no disparar una consulta por cosmético bloqueado en la grilla.
 *
 * Logros SIN progreso (de una sola partida, no acumulativos): tiempo_descuento,
 * ni_la_mitad, relampago, salvado_escudo, scout, ojo_halcon, jornada_primera,
 * comeback_king, perfectionist, first_win. Para esos, el que llama solo muestra
 * nombre + descripción del logro (sin número).
 */
import { supabase } from './supabase'
import { getAuthUser } from './auth'
import { getDailyStreak } from './cosmetics'
import { countTodayDailyWins, getPlayableGameCount } from './game-modes'
import { fetchFinishedChallengeSessions, getGamesForAchievements } from './achievement-triggers'
import { normalizeSessionRow, progressOfNewAchievements } from './achievement-rules'

const NEW_RULE_CODES = new Set([
  'trotamundos', 'todoterreno', 'semana_primera', 'relojero', 'especialista',
  'doble_jornada', 'invicto', 'invicto_temporada', 'sin_red', 'fuego_azul',
  'cazador_cracks', 'enciclopedia',
])

/**
 * @param {string[]} codes  códigos de logro de los cosméticos bloqueados que se ven ahora
 * @returns {Promise<Object<string,{current:number,target:number}>>}  solo los que se pudieron calcular
 */
export async function getLockedAchievementProgress(codes) {
  const want = new Set((codes || []).filter(Boolean))
  const out = {}
  if (!want.size) return out
  const { id: userId } = getAuthUser() || {}
  if (!userId) return out

  const jobs = []

  // ── daily_streak_N: racha diaria actual (misma columna que el borde "Racha encendida") ──
  const streakCodes = [...want].filter(c => /^daily_streak_\d+$/.test(c))
  if (streakCodes.length) {
    jobs.push((async () => {
      const current = await getDailyStreak(userId)
      for (const code of streakCodes) {
        const target = Number(code.split('_').pop())
        if (target > 0) out[code] = { current, target }
      }
    })())
  }

  // ── daily_wins_5 / daily_wins_10 / daily_wins_all: juegos distintos ganados HOY ──
  if (want.has('daily_wins_5') || want.has('daily_wins_10') || want.has('daily_wins_all')) {
    jobs.push((async () => {
      try {
        const [current, totalGames] = await Promise.all([countTodayDailyWins(), getPlayableGameCount()])
        if (want.has('daily_wins_5')) out.daily_wins_5 = { current, target: 5 }
        if (want.has('daily_wins_10')) out.daily_wins_10 = { current, target: 10 }
        if (want.has('daily_wins_all') && totalGames > 0) out.daily_wins_all = { current, target: totalGames }
      } catch { /* sin datos hoy */ }
    })())
  }

  // ── social_butterfly: conexiones aceptadas ──
  if (want.has('social_butterfly')) {
    jobs.push((async () => {
      try {
        const { data, error } = await supabase.from('connections').select('id')
          .or(`user_a.eq.${userId},user_b.eq.${userId}`).eq('status', 'accepted')
        if (!error) out.social_butterfly = { current: (data || []).length, target: 10 }
      } catch { /* noop */ }
    })())
  }

  // ── chat_master: mensajes directos enviados (contador persistente) ──
  if (want.has('chat_master')) {
    jobs.push((async () => {
      try {
        const { data, error } = await supabase.from('user_profiles').select('direct_messages_sent_count').eq('id', userId).single()
        if (!error) out.chat_master = { current: data?.direct_messages_sent_count || 0, target: 100 }
      } catch { /* noop */ }
    })())
  }

  // ── nationality_expert / position_guru: respuestas correctas en TODAS las sesiones de ese juego ──
  const correctsGame = { nationality_expert: 'nationality', position_guru: 'player-position' }
  for (const [code, slug] of Object.entries(correctsGame)) {
    if (!want.has(code)) continue
    jobs.push((async () => {
      try {
        const { data: game } = await supabase.from('games').select('id').eq('slug', slug).single()
        if (!game) return
        const { data, error } = await supabase.from('game_sessions').select('metadata').eq('user_id', userId).eq('game_id', game.id)
        if (error) return
        const current = (data || []).reduce((sum, s) => sum + (s?.metadata?.corrects || 0), 0)
        out[code] = { current, target: 50 }
      } catch { /* noop */ }
    })())
  }

  // ── guess_master: victorias en "Adiviná el jugador" ──
  if (want.has('guess_master')) {
    jobs.push((async () => {
      try {
        const { data: game } = await supabase.from('games').select('id').eq('slug', 'guess-player').single()
        if (!game) return
        const { data, error } = await supabase.from('game_sessions').select('id').eq('user_id', userId).eq('game_id', game.id).contains('metadata', { result: 'win' })
        if (!error) out.guess_master = { current: (data || []).length, target: 20 }
      } catch { /* noop */ }
    })())
  }

  // ── centurion: victorias totales, todos los juegos ──
  if (want.has('centurion')) {
    jobs.push((async () => {
      try {
        const { data, error } = await supabase.from('game_sessions').select('id').eq('user_id', userId).contains('metadata', { result: 'win' })
        if (!error) out.centurion = { current: (data || []).length, target: 100 }
      } catch { /* noop */ }
    })())
  }

  // ── hat_trick / grand_slam: juegos distintos ganados hoy / en los últimos 7 días ──
  if (want.has('hat_trick') || want.has('grand_slam')) {
    jobs.push((async () => {
      try {
        if (want.has('hat_trick')) {
          const today = new Date().toISOString().split('T')[0]
          const { data, error } = await supabase.from('game_sessions').select('game_id').eq('user_id', userId).gte('started_at', today + 'T00:00:00Z').contains('metadata', { result: 'win' })
          if (!error) out.hat_trick = { current: new Set((data || []).map(r => r.game_id)).size, target: 3 }
        }
        if (want.has('grand_slam')) {
          const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7)
          const [{ data, error }, totalGames] = await Promise.all([
            supabase.from('game_sessions').select('game_id').eq('user_id', userId).gte('started_at', weekAgo.toISOString()).contains('metadata', { result: 'win' }),
            getPlayableGameCount(),
          ])
          if (!error && totalGames > 0) out.grand_slam = { current: new Set((data || []).map(r => r.game_id)).size, target: totalGames }
        }
      } catch { /* noop */ }
    })())
  }

  // ── lucky_first: aciertos al primer intento (últimas 200 partidas, igual que el trigger) ──
  if (want.has('lucky_first')) {
    jobs.push((async () => {
      try {
        const { data, error } = await supabase.from('game_sessions').select('metadata').eq('user_id', userId).order('started_at', { ascending: false }).limit(200)
        if (error) return
        let n = 0
        for (const s of data || []) { const m = s?.metadata || {}; if (m.firstTryCorrect === true || m.attempts === 1) n++ }
        out.lucky_first = { current: n, target: 10 }
      } catch { /* noop */ }
    })())
  }

  // ── logros nuevos (achievement-rules.js): una sola pasada de sesiones para todos ──
  const wantsNewRules = [...want].some(c => NEW_RULE_CODES.has(c))
  if (wantsNewRules) {
    jobs.push((async () => {
      try {
        const [{ slugById, activeSlugs }, rows] = await Promise.all([getGamesForAchievements(), fetchFinishedChallengeSessions(userId)])
        const sessions = rows.map(r => normalizeSessionRow(r, slugById))
        const progress = progressOfNewAchievements({ sessions, activeSlugs })
        for (const code of want) if (NEW_RULE_CODES.has(code) && progress[code]) out[code] = progress[code]
      } catch { /* noop */ }
    })())
  }

  await Promise.all(jobs)
  return out
}
