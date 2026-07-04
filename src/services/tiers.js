// RANGOS (tiers) de Goaldemy. Paleta "escalera de prestigio" (Propuesta A):
// bronce → plata → oro (metales) → esmeralda → cian → campeón (marca Goaldemy).
export const TIERS = [
  { key: 'aficionado', label: 'Aficionado', minLevel: 1, maxLevel: 9, color: 'bronze', emoji: '🥉', image: '/badges/aficionado.svg' },
  { key: 'juvenil', label: 'Juvenil', minLevel: 10, maxLevel: 19, color: 'silver', emoji: '🥈', image: '/badges/juvenil.svg' },
  { key: 'amateur', label: 'Amateur', minLevel: 20, maxLevel: 29, color: 'gold', emoji: '🥇', image: '/badges/amateur.svg' },
  { key: 'reserva', label: 'Reserva', minLevel: 30, maxLevel: 39, color: 'emerald', emoji: '🛡️', image: '/badges/reserva.svg' },
  { key: 'profesional', label: 'Profesional', minLevel: 40, maxLevel: 49, color: 'cyan', emoji: '💎', image: '/badges/profesional.svg' },
  { key: 'crack', label: 'Crack', minLevel: 50, maxLevel: 50, color: 'champion', emoji: '👑', image: '/badges/crack.svg' },
]

// DESBLOQUEABLES por rango (lo que se muestra en el popup "Ver todos los rangos").
// style_keys reales para renderizar: banner (bnr-tier-*), frame (medallón/marca) e ícono
// (nuevos por rango en CosmeticIcon). El GRANT real por nivel lo hace supabase/rank-cosmetics.sql.
export const TIER_UNLOCKS = {
  aficionado:  { banner: 'tier_aficionado',  frame: 'medal_bronze',   icon: 'rank_bronze' },
  juvenil:     { banner: 'tier_juvenil',     frame: 'medal_silver',   icon: 'rank_silver' },
  amateur:     { banner: 'tier_amateur',     frame: 'medal_gold',     icon: 'rank_gold' },
  reserva:     { banner: 'tier_reserva',     frame: 'medal_emerald',  icon: 'rank_emerald' },
  profesional: { banner: 'tier_profesional', frame: 'medal_diamond',  icon: 'rank_cyan' },
  crack:       { banner: 'tier_crack',       frame: 'medal_champion', icon: 'rank_champion' },
}

export function getTierForLevel(level) {
  const lvl = Number(level || 0)
  let found = null
  for (const t of TIERS) {
    if (lvl >= (t.minLevel || 1) && (t.maxLevel ? lvl <= t.maxLevel : true)) {
      if (!found || t.minLevel > found.minLevel) found = t
    }
  }
  return found
}

export function getNextTier(level) {
  const lvl = Number(level || 0)
  const future = TIERS.filter(t => (t.minLevel || 1) > lvl)
  future.sort((a, b) => (a.minLevel || 0) - (b.minLevel || 0))
  return future[0] || null
}

// Texto de acento por color de rango (fuente única para header/perfil/level-up/popup).
export const TIER_ACCENT_TEXT = {
  bronze: 'text-amber-400', silver: 'text-slate-300', gold: 'text-yellow-400',
  emerald: 'text-emerald-400', cyan: 'text-cyan-400', champion: 'text-amber-300',
  // compat con colores viejos por si quedó alguno
  amber: 'text-amber-400', orange: 'text-orange-400', red: 'text-red-400',
  sky: 'text-sky-400', violet: 'text-violet-400',
}
export function tierAccentText(colorKey) {
  return TIER_ACCENT_TEXT[colorKey] || 'text-emerald-400'
}

export function tierColorClasses(colorKey) {
  switch (colorKey) {
    case 'bronze': return 'border-amber-600/40 bg-amber-600/10 text-amber-400'
    case 'silver': return 'border-slate-400/40 bg-slate-400/10 text-slate-300'
    case 'gold': return 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300'
    case 'cyan': return 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300'
    case 'champion': return 'border-amber-400/50 bg-amber-400/10 text-amber-300'
    case 'red': return 'border-red-500/40 bg-red-500/10 text-red-300'
    case 'orange': return 'border-orange-500/40 bg-orange-500/10 text-orange-300'
    case 'amber': return 'border-amber-500/40 bg-amber-500/10 text-amber-300'
    case 'emerald': return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
    case 'sky': return 'border-sky-500/40 bg-sky-500/10 text-sky-300'
    case 'blue': return 'border-blue-500/40 bg-blue-500/10 text-blue-300'
    case 'violet': return 'border-violet-500/40 bg-violet-500/10 text-violet-300'
    default: return 'border-white/20 text-slate-200'
  }
}
