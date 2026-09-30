/**
 * CARTA DE RECOMPENSA ESTÁNDAR (Moodboard 08)
 *
 * Adaptadores: convierten cualquier recompensa de FULVO (cosmético, recompensa
 * de nivel, rango, juego, XP, ayuda) al formato único que dibuja
 * <PrizeCard>. Así "Desbloqueaste", "Lo que viene", el álbum, el pase y los
 * premios de la jornada muestran todo con la misma carta.
 *
 * Forma del objeto:
 *   { kind, name, rarity, styleKey?, image?, slug?, amount?, count?, powerup?, iconKey? }
 *   kind: 'icon' | 'frame' | 'banner' | 'title' | 'tier' | 'game' | 'xp' | 'powerup'
 * Los logros NO usan carta: tienen su propia escena y medalla (moodboard 02).
 */
import { getLevelRewards } from './level-rewards'
import { TIERS, TIER_UNLOCKS } from './tiers'

export const PRIZE_TYPE_LABEL = {
  icon: 'Ícono', frame: 'Borde', banner: 'Banner', title: 'Título',
  tier: 'Rango', game: 'Juego', xp: 'Experiencia', powerup: 'Ayuda',
}

export const RARITY_ORDER = { common: 0, rare: 1, epic: 2, legendary: 3 }

export const POWERUP_NAME = { fifty_fifty: '50/50', shield: 'Escudo', extra_time: '+15 s', reveal_hint: 'Pista' }

/** Recompensa de nivel (services/level-rewards → getLevelRewards) → carta. */
export function prizeFromLevelReward(r) {
  if (!r) return null
  if (r.kind === 'xp') {
    const amount = Number(String(r.label || '').replace(/[^0-9]/g, '')) || 0
    return xpPrize(amount)
  }
  if (r.kind === 'tier') return { kind: 'tier', name: r.name || String(r.label || '').replace(/^Rango:\s*/, ''), rarity: 'legendary', image: r.image }
  if (r.kind === 'game') return { kind: 'game', name: r.name || r.label, rarity: 'epic', slug: r.slug }
  return { kind: r.kind, name: r.name, rarity: r.rarity || 'common', styleKey: r.styleKey || '' }
}

/** Cosmético del catálogo ({ type, name, rarity, style_key | styleKey }) → carta. */
export function prizeFromCosmetic(c) {
  if (!c) return null
  return { kind: c.type || c.kind, name: c.name, rarity: c.rarity || 'common', styleKey: c.styleKey ?? c.style_key ?? '', code: c.code }
}

export function xpPrize(amount) {
  return { kind: 'xp', name: `+${amount} XP`, rarity: 'common', amount }
}

export function powerupPrize(key, count = 1) {
  return { kind: 'powerup', name: `${POWERUP_NAME[key] || 'Ayuda'}${count > 1 ? ` ×${count}` : ''}`, rarity: count >= 3 ? 'rare' : 'common', powerup: key, count }
}

/** Todas las cartas que se ganan al pasar de oldLevel a newLevel (ambos incluidos los intermedios). */
export function prizesForLevelRange(oldLevel, newLevel) {
  const out = []
  let xpTotal = 0
  for (let l = Number(oldLevel) + 1; l <= Number(newLevel); l++) {
    for (const r of getLevelRewards(l)) {
      if (r.kind === 'xp') { xpTotal += Number(String(r.label || '').replace(/[^0-9]/g, '')) || 0; continue }
      const p = prizeFromLevelReward(r)
      if (p) out.push({ ...p, level: l })
    }
    // El rango trae además su banner, borde e ícono (supabase/rank-cosmetics.sql)
    const tier = TIERS.find(t => t.minLevel === l && l > 1)
    const tu = tier && TIER_UNLOCKS[tier.key]
    if (tu) {
      out.push({ kind: 'banner', name: `Banner ${tier.label}`, rarity: 'epic', styleKey: tu.banner, level: l, fromTier: true })
      out.push({ kind: 'frame', name: `Medalla ${tier.label}`, rarity: 'epic', styleKey: tu.frame, level: l, fromTier: true })
      out.push({ kind: 'icon', name: `Escudo ${tier.label}`, rarity: 'epic', styleKey: tu.icon, level: l, fromTier: true })
    }
  }
  // El XP bonus va en una sola carta, al principio (la más común abre la tanda)
  if (xpTotal > 0) out.unshift({ ...xpPrize(xpTotal), level: Number(newLevel) })
  return out
}

/**
 * "Lo que viene": una carta por nivel para los próximos `count` niveles.
 * Si el nivel no trae nada especial, muestra su XP → ningún nivel queda vacío.
 */
export function upcomingPrizes(level, count = 8, maxLevel = 60) {
  const out = []
  for (let l = Number(level) + 1; l <= maxLevel && out.length < count; l++) {
    const rewards = getLevelRewards(l)
    const special = rewards
      .filter(r => r.kind !== 'xp')
      .map(prizeFromLevelReward)
      .sort((a, b) => (RARITY_ORDER[b.rarity] || 0) - (RARITY_ORDER[a.rarity] || 0))
    const main = special[0] || prizeFromLevelReward(rewards.find(r => r.kind === 'xp'))
    if (main) out.push({ level: l, prize: main, extra: Math.max(0, special.length - 1) })
  }
  return out
}

/**
 * Próxima recompensa REAL (cosmético, rango, juego): saltea los niveles que solo dan XP o ayudas.
 * Devuelve { level, prize } o null.
 */
export function nextRealPrize(level, within = 20) {
  const list = upcomingPrizes(level, within)
  return list.find(u => u.prize && u.prize.kind !== 'xp' && u.prize.kind !== 'powerup') || null
}

/** Lo que trae un rango al llegar (banner, borde e ícono del rango). */
export function tierPrizes(tier) {
  const tu = tier && TIER_UNLOCKS[tier.key]
  if (!tu) return []
  return [
    { kind: 'banner', name: `Banner ${tier.label}`, rarity: 'epic', styleKey: tu.banner },
    { kind: 'frame', name: `Medalla ${tier.label}`, rarity: 'epic', styleKey: tu.frame },
    { kind: 'icon', name: `Escudo ${tier.label}`, rarity: 'legendary', styleKey: tu.icon },
  ]
}

/** Rareza más alta de una lista de cartas. */
export function topRarity(prizes) {
  let best = 'common'
  for (const p of prizes || []) if ((RARITY_ORDER[p?.rarity] || 0) > (RARITY_ORDER[best] || 0)) best = p.rarity
  return best
}
