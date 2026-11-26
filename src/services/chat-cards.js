/**
 * TARJETAS EN EL CHAT (v4): "mandar resultado" y "retar a este juego".
 *
 * direct_messages solo tiene `content` (texto), así que la tarjeta viaja
 * DENTRO del texto, legible para cualquier versión vieja de la app:
 *
 *   Te reto a Mayor o menor: superá mi 14
 *   /games/higher-or-lower#fulvo=<json en base64url>
 *
 * Una app vieja muestra la frase y la ruta; la v4 detecta `#fulvo=` y dibuja
 * la tarjeta. No hace falta tocar la base. (Si en el futuro se agrega una
 * columna `payload jsonb` a direct_messages, este módulo es el único lugar a
 * cambiar.)
 */
import { DAILY_GAMES, isChallengeAvailable } from './game-modes'
import { friendlyNameForSlug, gameRouteForSlug } from './games'
import { appDateKey } from './app-date'

const MARK = /#fulvo=([A-Za-z0-9_-]+)\s*$/

function b64urlEncode(str) {
  const bytes = new TextEncoder().encode(str)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function b64urlDecode(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)
  const bin = atob(b64)
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function starsText(n) {
  const k = Math.max(0, Math.min(3, Number(n) || 0))
  return k ? '★'.repeat(k) + '☆'.repeat(3 - k) : ''
}

/**
 * Arma el texto del mensaje para una tarjeta.
 * @param {'res'|'reto'} kind
 * @param {{slug:string, score:string, win:boolean, stars:number}} g
 */
export function encodeCard(kind, g) {
  const name = friendlyNameForSlug(g.slug)
  const data = { v: 1, k: kind, g: g.slug, s: g.score || '', w: g.win ? 1 : 0, st: Number(g.stars) || 0 }
  const line = kind === 'reto'
    ? (g.score ? `Te reto a ${name}: superá mi ${g.score}` : `Te reto a ${name}`)
    : `${name} · hoy: ${g.win ? 'Ganado' : 'Perdido'}${g.score ? ' ' + g.score : ''}${starsText(g.stars) ? ' ' + starsText(g.stars) : ''}`
  return `${line}\n${gameRouteForSlug(g.slug)}#fulvo=${b64urlEncode(JSON.stringify(data))}`
}

/** Si el mensaje es una tarjeta, devuelve { kind, slug, name, score, win, stars }; si no, null. */
export function decodeCard(content) {
  const m = String(content || '').match(MARK)
  if (!m) return null
  try {
    const d = JSON.parse(b64urlDecode(m[1]))
    if (!d || (d.k !== 'res' && d.k !== 'reto') || !d.g) return null
    if (gameRouteForSlug(d.g) === '/games') return null
    return { kind: d.k, slug: d.g, name: friendlyNameForSlug(d.g), score: String(d.s || ''), win: !!d.w, stars: Math.max(0, Math.min(3, Number(d.st) || 0)) }
  } catch { return null }
}

/** Texto corto para la lista de conversaciones. */
export function previewText(content, fromMe = false) {
  const c = decodeCard(content)
  if (!c) return content || ''
  if (c.kind === 'reto') return fromMe ? `Retaste a ${c.name}` : `Te retó a ${c.name}`
  return fromMe ? `Compartiste ${c.name}` : `Compartió ${c.name}`
}

/**
 * Juegos que YA jugaste hoy (desafío diario), con su resultado.
 * Solo lectura: isChallengeAvailable() de game-modes, la misma fuente del índice.
 * Devuelve { played: [{ slug, name, win, score, stars }], total }.
 */
export async function loadTodayPlayed() {
  const rows = await Promise.all(DAILY_GAMES.map(async (slug) => {
    try {
      const av = await isChallengeAvailable(slug)
      if (!av || av.available !== false || !av.result) return null
      return {
        slug,
        name: friendlyNameForSlug(slug),
        win: av.result === 'win',
        score: av.ficha?.score || '',
        stars: Number(av.ficha?.stars) || 0,
      }
    } catch { return null }
  }))
  return { played: rows.filter(Boolean), total: DAILY_GAMES.length }
}

/** ¿El reto se mandó hoy? (los desafíos se renuevan a las 00:00 de Argentina, como el server). */
export function isSentToday(iso) {
  try { return appDateKey(new Date(iso)) === appDateKey() } catch { return false }
}
