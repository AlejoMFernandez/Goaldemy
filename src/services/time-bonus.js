/**
 * ¡BASTA! — bonus por tiempo sobrante (Moodboard 01 · decisión aprobada)
 *
 * Los juegos contrarreloj terminan al llegar al objetivo (10 aciertos). Los
 * segundos que sobran se convierten en los aciertos que el jugador "hubiera
 * hecho" a su propio ritmo, castigados por su precisión para que no convenga
 * responder al azar. Así se corta el farmeo de seguir sumando XP con +15 s.
 *
 *   ritmo            = segundos usados / aciertos   (mínimo 1,5 s)
 *   aciertos posibles = round(sobrante / ritmo × precisión), tope 10
 *   bonus            = aciertos posibles × XP por acierto de la dificultad
 *
 * Ejemplo (Normal, 20 XP): 10 aciertos en 34 s con 12 intentos → ritmo 3,4 s,
 * precisión 83 %, sobran 11 s → 3 aciertos → +60 XP.
 */
export const MIN_PACE_SECONDS = 1.5
export const MAX_EXTRA_CORRECTS = 10

export function computeTimeBonus({ secondsUsed, secondsLeft, corrects, attempts, xpPerCorrect }) {
  const left = Math.max(0, Number(secondsLeft) || 0)
  const ok = Math.max(0, Number(corrects) || 0)
  if (!left || !ok) return { extra: 0, xp: 0, pace: 0, accuracy: 0, secondsLeft: left }
  const pace = Math.max(MIN_PACE_SECONDS, (Number(secondsUsed) || 0) / ok)
  const tries = Math.max(ok, Number(attempts) || ok)
  const accuracy = Math.min(1, ok / tries)
  const extra = Math.min(MAX_EXTRA_CORRECTS, Math.round((left / pace) * accuracy))
  return { extra, xp: extra * (Number(xpPerCorrect) || 10), pace, accuracy, secondsLeft: left }
}
