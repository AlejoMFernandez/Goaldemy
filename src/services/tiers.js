// Tier mapping utilities: map level to a rank/badge with label, colors and optional image

export const TIERS = [
  { key: 'aficionado', label: 'Aficionado', minLevel: 1, maxLevel: 9, color: 'emerald', emoji: '🎯', image: '/badges/aficionado.png' },
  { key: 'juvenil', label: 'Juvenil', minLevel: 10, maxLevel: 19, color: 'amber', emoji: '🌱', image: '/badges/juvenil.png' },
  { key: 'amateur', label: 'Amateur', minLevel: 20, maxLevel: 29, color: 'orange', emoji: '💪', image: '/badges/amateur.png' },
  { key: 'reserva', label: 'Reserva', minLevel: 30, maxLevel: 30, color: 'red', emoji: '🔥', image: '/badges/reserva.png' },
  // Future tiers (placeholder; inactive until levels > 30)
  { key: 'profesional', label: 'Profesional', minLevel: 31, color: 'sky', emoji: '🛡️', image: '/badges/profesional.svg' },
  { key: 'titular', label: 'Titular', minLevel: 36, color: 'blue', emoji: '⚽', image: '/badges/titular.svg' },
  { key: 'crack', label: 'Crack', minLevel: 42, color: 'violet', emoji: '🌟', image: '/badges/crack.svg' },
  { key: 'idolo', label: 'Ídolo', minLevel: 49, color: 'fuchsia', emoji: '🏆', image: '/badges/idolo.svg' },
  { key: 'leyenda', label: 'Leyenda', minLevel: 57, color: 'rose', emoji: '👑', image: '/badges/leyenda.svg' },
  { key: 'goat', label: 'GOAT', minLevel: 66, color: 'yellow', emoji: '🐐', image: '/badges/goat.svg' },
]

export function getTierForLevel(level) {
  const lvl = Number(level || 0)
  // Find the highest tier whose minLevel <= level and (no max or level <= max)
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
  // Next tier is the one with minLevel > current level, with the smallest minLevel
  const future = TIERS.filter(t => (t.minLevel || 1) > lvl)
  future.sort((a, b) => (a.minLevel || 0) - (b.minLevel || 0))
  return future[0] || null
}

export function tierColorClasses(colorKey) {
  // Tailwind color classes for chips/cards per color key
  switch (colorKey) {
    case 'red': return 'border-red-500/40 bg-red-500/10 text-red-300'
    case 'orange': return 'border-orange-500/40 bg-orange-500/10 text-orange-300'
    case 'amber': return 'border-amber-500/40 bg-amber-500/10 text-amber-300'
    case 'emerald': return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
    case 'sky': return 'border-sky-500/40 bg-sky-500/10 text-sky-300'
    case 'blue': return 'border-blue-500/40 bg-blue-500/10 text-blue-300'
    case 'violet': return 'border-violet-500/40 bg-violet-500/10 text-violet-300'
    case 'fuchsia': return 'border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300'
    case 'rose': return 'border-rose-500/40 bg-rose-500/10 text-rose-300'
    case 'yellow': return 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300'
    default: return 'border-white/20 text-slate-200'
  }
}
