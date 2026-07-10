/**
 * SERVICIO DE COMPARTIR (motor viral)
 *
 * Genera el texto estilo Wordle que el jugador comparte en X / WhatsApp / IG.
 * NO revela respuestas: solo una barra de emojis con el puntaje + el link a Goaldemy.
 * Cada resultado compartido es un cartel publicitario gratis de la app.
 *
 * Usado por GameSummaryPopup (juegos logueados) y la página /reto (invitados).
 */

/**
 * Origen real del sitio para el link compartido. Soporta dominio propio a futuro;
 * en dev (localhost/con puerto) cae al dominio de producción.
 */
export function shareBaseUrl() {
  try {
    const o = window.location?.origin || ''
    if (o && !/localhost|127\.0\.0\.1|:\d{2,5}$/.test(o)) return o
  } catch {}
  return 'https://goaldemy.vercel.app'
}

/**
 * Construye el texto compartible.
 * @param {Object} opts
 * @param {string} opts.gameName - Nombre del juego/reto (ej: "Reto del día")
 * @param {number} opts.corrects - Aciertos
 * @param {number} opts.total    - Total (umbral de victoria / preguntas)
 * @param {number} opts.accuracy - Precisión 0-100
 * @param {number} opts.maxStreak- Mejor racha de aciertos seguidos
 * @param {boolean} opts.won     - Si ganó (cambia el call-to-action)
 * @returns {string}
 */
export function buildShareText({ gameName = '', corrects = 0, total = 0, accuracy = 0, maxStreak = 0, won = false } = {}) {
  const t = Math.max(total || 0, 1)
  const got = Math.max(0, Math.min(corrects || 0, t))
  // Barra de emojis: 🟩 acierto / ⬛ fallado, en filas de a 10 para no romper el salto de línea
  const cells = []
  for (let i = 0; i < t; i++) cells.push(i < got ? '🟩' : '⬛')
  const rows = []
  for (let i = 0; i < cells.length; i += 10) rows.push(cells.slice(i, i + 10).join(''))
  const name = gameName ? ` · ${gameName}` : ''
  return [
    `GOALDEMY ⚽${name}`,
    rows.join('\n'),
    `✅ ${got}/${t}   🎯 ${accuracy}%   🔥 x${maxStreak || 0}`,
    won ? '¿Podés superarme? 👇' : '¿Le ganás a mi intento? 👇',
    shareBaseUrl(),
  ].join('\n')
}

/**
 * Comparte el texto: Web Share API (nativa en celular) con fallback a portapapeles.
 * @returns {Promise<'shared'|'copied'|'cancelled'|'failed'>}
 */
export async function shareOrCopy(text) {
  try {
    if (navigator.share) {
      await navigator.share({ title: 'GOALDEMY', text })
      return 'shared'
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return 'cancelled' // el usuario cerró la hoja
  }
  try {
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch {}
  return 'failed'
}
