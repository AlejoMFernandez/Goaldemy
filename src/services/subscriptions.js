// Simple subscription catalog for Landing Page.
// Each tier can later map to Supabase products / Stripe prices.
export const SUBSCRIPTION_PACKAGES = [
  {
    id: 'conference',
    name: 'Conference Pack',
    tagline: 'Entrenamiento base continuo',
    priceMonthly: 0,
    highlight: 'Ideal para empezar',
    features: [
        'Único desafío diario por día',
        'Sin aumentos de XP',
    ],
    cta: 'Jugar gratis',
    ctaTo: '/register',
    popular: false,
  },
  {
    id: 'europa',
    name: 'Europa Pack',
    tagline: 'Más desafíos y progreso',
    priceMonthly: 4.99,
    highlight: 'XP acelerado',
    features: [
        '3 desafíos diarios por día',
        '+15% XP ganado',
        '1 escudo de racha por día',
        'Insignia "Europa"',
    ],
    cta: 'Subir de nivel',
    ctaTo: '/register',
    popular: true,
  },
  {
    id: 'champions',
    name: 'Champions Pack',
    tagline: 'Máxima competitividad',
    priceMonthly: 9.99,
    highlight: 'Ventaja pro',
    features: [
        '5 desafíos diarios por día',
        '+30% XP ganado',
        '3 escudos de racha por día',
        'Insignia "Champions"',
    ],
    cta: 'Convertirme en Pro',
    ctaTo: '/register',
    popular: false,
  },
];

export function formatPrice(p) {
  return p === 0 ? 'Free' : `$${p}`;
}
