// Estilo visual + formato de precio de los planes, COMPARTIDO por PlanCard
// (home + pricing) y por el popup de confirmación de Pricing.
// Recolor por RAREZA: PRO = fucsia (épica), Legend = dorado (legendaria).
// Sin celeste, sin emojis.
export function planStyle(slug) {
  if (slug === 'legend') return {
    border: 'border-amber-500/50',
    ring: 'md:ring-1 md:ring-amber-500/20',
    badge: 'bg-amber-500/15 border-amber-500/40 text-amber-300',
    cta: 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:brightness-110 text-black font-bold shadow-lg shadow-amber-500/20',
    accent: 'text-amber-300',
    dot: 'bg-amber-400',
    glow: 'shadow-[0_0_14px_rgba(251,191,36,0.5)]',
  }
  if (slug === 'pro') return {
    border: 'border-fuchsia-500/50',
    ring: 'md:ring-1 md:ring-fuchsia-500/20',
    badge: 'bg-fuchsia-500/15 border-fuchsia-500/40 text-fuchsia-300',
    cta: 'bg-gradient-to-r from-fuchsia-500 to-violet-500 hover:brightness-110 text-white font-bold shadow-lg shadow-fuchsia-500/20',
    accent: 'text-fuchsia-300',
    dot: 'bg-fuchsia-400',
    glow: 'shadow-[0_0_14px_rgba(232,121,249,0.5)]',
  }
  return {
    border: 'border-white/10',
    ring: '',
    badge: 'bg-white/5 border-white/10 text-slate-300',
    cta: 'bg-white/10 hover:bg-white/15 text-white',
    accent: 'text-slate-300',
    dot: 'bg-slate-400',
    glow: '',
  }
}

export function formatPrice(plan) {
  if (plan.price_ars === 0) return 'Gratis'
  const ars = plan.price_ars / 100
  return `$${ars.toLocaleString('es-AR')}`
}
