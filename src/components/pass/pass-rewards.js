/**
 * Helpers puros del Abono de temporada (pase mensual).
 *
 * Normaliza un tier de get_monthly_pass a "un premio por mitad de entrada"
 * (Popular = track free, Platea = track premium) y calcula su estado.
 * Sin lógica de negocio nueva: el servidor decide qué se puede cobrar
 * (claim_pass_tier); acá sólo se replica la regla para pintar la UI.
 */
import { powerupLabel } from '../../services/rewards'
import { rarity as rarityInfo } from '../../services/cosmetics'

// Color de rareza para el borde/glow del premio y la etiqueta.
// [color, oscuro, glow]
export const RARITY_COLORS = {
  common: ['#94a3b8', '#475569', 'rgba(148,163,184,0.5)'],
  rare: ['#60a5fa', '#1d4ed8', 'rgba(96,165,250,0.6)'],
  epic: ['#a855f7', '#7e22ce', 'rgba(168,85,247,0.65)'],
  legendary: ['#fbbf24', '#b45309', 'rgba(251,191,36,0.7)'],
}
export function rarityColors(r) {
  return RARITY_COLORS[r] || RARITY_COLORS.common
}

const COSMETIC_TYPE = { icon: 'Ícono', frame: 'Borde', banner: 'Banner', title: 'Título' }

/**
 * Premio principal de una mitad. Prioridad visual: cosmético > ayuda >
 * monedas > XP (si un tier trae varias cosas, el reclamo las paga todas).
 * Fichas/Balones: get_monthly_pass hoy no los devuelve; si algún día vienen
 * como `<track>_fichas` / `<track>_balones`, se pintan solos.
 */
export function rewardOf(tier, track) {
  const p = track === 'free' ? 'free_' : 'premium_'
  const cos = tier[p + 'cosmetic']
  const xp = Number(tier[p + 'xp']) || 0
  if (cos) {
    return {
      kind: 'cosmetic', cos, xp, rarity: cos.rarity || 'common',
      tag: rarityInfo(cos.rarity).label,
      name: `${COSMETIC_TYPE[cos.type] || 'Cosmético'} ${cos.name}`,
    }
  }
  const pu = tier[p + 'powerup']
  if (pu) {
    const qty = Number(tier[p + 'powerup_qty']) || 1
    return { kind: 'powerup', powerup: pu, qty, xp, tag: '×' + qty, name: `Ayuda ${powerupLabel(pu)} ×${qty}` }
  }
  const fichas = Number(tier[p + 'fichas']) || 0
  if (fichas > 0) return { kind: 'coin', currency: 'fichas', amount: fichas, xp, tag: '+' + fichas, name: `${fichas} Fichas` }
  const balones = Number(tier[p + 'balones']) || 0
  if (balones > 0) return { kind: 'coin', currency: 'balones', amount: balones, xp, tag: '×' + balones, name: `${balones} Balón de Oro` }
  if (xp > 0) return { kind: 'xp', xp, tag: '+' + xp, name: `${xp} XP` }
  return null
}

/**
 * Estado de una mitad:
 *  empty    — no hay premio en ese track
 *  claimed  — ya cobrado (sello)
 *  locked   — nivel no alcanzado (gris)
 *  pro-lock — Platea alcanzada pero sin PRO (candado → /pricing)
 *  ready    — listo para cobrar (brilla + chip "Cobrar")
 */
export function stubState(tier, track, isPremium) {
  if (!rewardOf(tier, track)) return 'empty'
  const claimed = track === 'free' ? tier.free_claimed : tier.premium_claimed
  if (claimed) return 'claimed'
  if (!tier.unlocked) return 'locked'
  if (track === 'premium' && !isPremium) return 'pro-lock'
  return 'ready'
}
