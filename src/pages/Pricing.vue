<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { fetchPlans, getUserPlan, invalidatePlanCache } from '../services/premium'
import { getAuthUser } from '../services/auth'
import { startCheckout, handleReturnFromCheckout } from '../services/checkout'
import { pushSuccessToast, pushErrorToast, pushInfoToast } from '../stores/notifications'

const router = useRouter()
const plans = ref([])
const currentPlan = ref('free')
const loading = ref(true)
const checkoutLoading = ref(null)
const openFaq = ref(null)

const sortedPlans = computed(() =>
  [...plans.value].sort((a, b) => a.sort_order - b.sort_order)
)

function formatPrice(plan) {
  if (plan.price_ars === 0) return 'Gratis'
  const ars = plan.price_ars / 100
  return `$${ars.toLocaleString('es-AR')}`
}

function planStyle(slug) {
  if (slug === 'legend') return {
    border: 'border-amber-500/50',
    bg: 'bg-gradient-to-b from-amber-500/10 to-transparent',
    badge: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
    cta: 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold shadow-lg shadow-amber-500/20',
    icon: '⭐',
  }
  if (slug === 'pro') return {
    border: 'border-cyan-500/50',
    bg: 'bg-gradient-to-b from-cyan-500/10 to-transparent',
    badge: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300',
    cta: 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-black font-bold shadow-lg shadow-cyan-500/20',
    icon: '⚡',
  }
  return {
    border: 'border-white/10',
    bg: '',
    badge: 'bg-white/5 border-white/10 text-slate-300',
    cta: 'bg-white/10 hover:bg-white/15 text-white',
    icon: '👤',
  }
}

async function handleSubscribe(slug) {
  const { id } = getAuthUser() || {}
  if (!id) {
    router.push('/login')
    return
  }
  checkoutLoading.value = slug
  try {
    await startCheckout(slug, 'mercadopago')
  } catch (e) {
    pushErrorToast(e.message || 'Error al iniciar el pago')
    checkoutLoading.value = null
  }
}

const COMPARISON = [
  { label: 'Desafíos por juego / día', key: 'daily_challenges_per_game' },
  { label: 'Power-ups por día', key: 'daily_powerups' },
  { label: 'Bonus de XP', key: 'xp_multiplier', format: v => v > 1 ? `+${Math.round((v - 1) * 100)}%` : 'Base' },
  { label: 'Protectores de racha / semana', key: 'weekly_streak_protectors', format: v => v > 0 ? v : '—' },
  { label: '9 modos de juego', static: true },
  { label: 'Sistema de XP y niveles', static: true },
  { label: 'Ranking global', static: true },
  { label: 'Badge exclusivo en perfil', key: 'badge', format: v => v ? '✓' : '—' },
]

const FAQ = [
  { q: '¿Puedo cancelar en cualquier momento?', a: 'Sí, podés cancelar tu suscripción cuando quieras desde Mercado Pago. No hay contratos ni permanencia mínima.' },
  { q: '¿Cómo se procesan los pagos?', a: 'Los pagos se procesan de forma segura a través de Mercado Pago. Podés pagar con tarjeta de crédito, débito, dinero en cuenta o efectivo.' },
  { q: '¿Qué pasa con mis power-ups si cancelo?', a: 'Si cancelás, tu plan vuelve a Free al final del período pagado. Los power-ups no usados se pierden, pero conservás todo tu progreso, XP y logros.' },
  { q: '¿Puedo cambiar de plan?', a: 'Sí, podés subir o bajar de plan en cualquier momento. El cambio se aplica en el siguiente ciclo de facturación.' },
]

onMounted(async () => {
  const returnResult = await handleReturnFromCheckout()
  if (returnResult) {
    if (returnResult.status === 'success') {
      pushSuccessToast('Pago procesado. Tu plan se activará en unos segundos.')
      invalidatePlanCache()
      setTimeout(async () => {
        const userPlan = await getUserPlan(true)
        currentPlan.value = userPlan.plan || 'free'
      }, 3000)
    } else if (returnResult.status === 'cancelled') {
      pushInfoToast('Pago cancelado')
    }
    window.history.replaceState({}, '', '/pricing')
  }

  const [allPlans, userPlan] = await Promise.all([fetchPlans(), getUserPlan()])
  plans.value = allPlans
  currentPlan.value = userPlan.plan || 'free'
  loading.value = false
})
</script>

<template>
  <div class="min-h-[calc(100dvh-4rem)] bg-slate-900 text-white">

    <!-- Hero -->
    <div class="relative overflow-hidden">
      <div class="absolute inset-0 bg-gradient-to-b from-cyan-500/5 via-transparent to-transparent"></div>
      <div class="relative max-w-5xl mx-auto px-4 pt-12 pb-6 text-center">
        <h1 class="text-3xl sm:text-4xl font-extrabold mb-3">Elegí tu plan</h1>
        <p class="text-slate-400 max-w-lg mx-auto">
          Desbloqueá más desafíos, power-ups y ventajas para dominar Goaldemy. Cancelá cuando quieras.
        </p>
      </div>
    </div>

    <!-- Plans -->
    <div class="max-w-5xl mx-auto px-4 pb-8">
      <div v-if="loading" class="flex justify-center py-20">
        <div class="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div
          v-for="plan in sortedPlans"
          :key="plan.slug"
          class="relative rounded-2xl border p-6 flex flex-col transition-transform hover:scale-[1.02]"
          :class="[planStyle(plan.slug).border, planStyle(plan.slug).bg, plan.slug === 'pro' ? 'md:-mt-2 md:mb-0 md:shadow-xl md:shadow-cyan-500/10 ring-1 ring-cyan-500/20' : '']"
        >
          <div
            v-if="plan.slug === 'pro'"
            class="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-0.5 rounded-full text-xs font-bold bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg"
          >
            Popular
          </div>

          <div
            v-if="plan.slug === currentPlan"
            class="absolute -top-3 right-4 px-3 py-0.5 rounded-full text-xs font-bold bg-emerald-500 text-black"
          >
            Tu plan
          </div>

          <div class="mb-4">
            <div
              class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold mb-3"
              :class="planStyle(plan.slug).badge"
            >
              <span>{{ planStyle(plan.slug).icon }}</span>
              {{ plan.name }}
            </div>
            <div class="flex items-end gap-1">
              <span class="text-3xl font-extrabold">{{ formatPrice(plan) }}</span>
              <span v-if="plan.price_ars > 0" class="text-slate-500 text-sm mb-1">ARS/mes</span>
            </div>
          </div>

          <ul class="space-y-2.5 flex-1 mb-6">
            <li class="flex items-center gap-2 text-sm">
              <svg class="w-4 h-4 text-emerald-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
              <span class="text-slate-300">{{ plan.daily_challenges_per_game }} {{ plan.daily_challenges_per_game === 1 ? 'desafío' : 'desafíos' }} por día por juego</span>
            </li>
            <li class="flex items-center gap-2 text-sm">
              <svg class="w-4 h-4 text-emerald-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
              <span class="text-slate-300">{{ plan.daily_powerups }} power-up{{ plan.daily_powerups === 1 ? '' : 's' }} por día</span>
            </li>
            <li v-if="plan.xp_multiplier > 1" class="flex items-center gap-2 text-sm">
              <svg class="w-4 h-4 text-emerald-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
              <span class="text-slate-300">Bonus de XP +{{ Math.round((plan.xp_multiplier - 1) * 100) }}%</span>
            </li>
            <li v-if="plan.weekly_streak_protectors > 0" class="flex items-center gap-2 text-sm">
              <svg class="w-4 h-4 text-emerald-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
              <span class="text-slate-300">{{ plan.weekly_streak_protectors }} protector{{ plan.weekly_streak_protectors === 1 ? '' : 'es' }} de racha por semana</span>
            </li>
            <li v-if="plan.badge" class="flex items-center gap-2 text-sm">
              <svg class="w-4 h-4 text-emerald-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
              <span class="text-slate-300">Badge {{ plan.slug === 'legend' ? 'Legend dorado' : 'Pro' }} en perfil</span>
            </li>
          </ul>

          <button
            v-if="plan.slug !== currentPlan && plan.slug !== 'free'"
            class="w-full py-3 rounded-xl text-sm transition-all duration-200"
            :class="planStyle(plan.slug).cta"
            :disabled="checkoutLoading === plan.slug"
            @click="handleSubscribe(plan.slug)"
          >
            <span v-if="checkoutLoading === plan.slug" class="flex items-center justify-center gap-2">
              <span class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
              Redirigiendo a Mercado Pago...
            </span>
            <span v-else>Suscribirme</span>
          </button>
          <div
            v-else-if="plan.slug === currentPlan"
            class="w-full py-3 rounded-xl text-sm text-center bg-white/5 text-white/40 cursor-default"
          >
            Plan actual
          </div>
          <div v-else class="w-full py-3 rounded-xl text-sm text-center text-white/30">
            Incluido
          </div>
        </div>
      </div>
    </div>

    <!-- Feature comparison table -->
    <div v-if="!loading && sortedPlans.length" class="max-w-5xl mx-auto px-4 py-12">
      <h2 class="text-xl sm:text-2xl font-bold text-center mb-8">Comparar planes en detalle</h2>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-white/10">
              <th class="text-left py-3 pr-4 text-slate-400 font-medium">Característica</th>
              <th
                v-for="plan in sortedPlans"
                :key="plan.slug"
                class="text-center py-3 px-3 font-bold"
                :class="plan.slug === 'pro' ? 'text-cyan-400' : plan.slug === 'legend' ? 'text-amber-400' : 'text-slate-300'"
              >
                {{ plan.name }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, i) in COMPARISON"
              :key="i"
              class="border-b border-white/5"
              :class="i % 2 === 0 ? 'bg-white/[0.02]' : ''"
            >
              <td class="py-3 pr-4 text-slate-300">{{ row.label }}</td>
              <td
                v-for="plan in sortedPlans"
                :key="plan.slug"
                class="text-center py-3 px-3 font-semibold"
              >
                <template v-if="row.static">
                  <svg class="w-5 h-5 text-emerald-400 mx-auto" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
                </template>
                <template v-else>
                  {{ row.format ? row.format(plan[row.key]) : plan[row.key] }}
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- FAQ -->
    <div class="max-w-3xl mx-auto px-4 py-12">
      <h2 class="text-xl sm:text-2xl font-bold text-center mb-8">Preguntas frecuentes</h2>
      <div class="space-y-3">
        <div
          v-for="(item, i) in FAQ"
          :key="i"
          class="rounded-xl border border-white/10 overflow-hidden transition-colors"
          :class="openFaq === i ? 'bg-white/[0.03]' : ''"
        >
          <button
            class="w-full flex items-center justify-between px-5 py-4 text-left text-sm font-semibold text-white hover:bg-white/[0.03] transition"
            @click="openFaq = openFaq === i ? null : i"
          >
            <span>{{ item.q }}</span>
            <svg
              class="w-4 h-4 text-slate-400 flex-shrink-0 ml-3 transition-transform duration-200"
              :class="openFaq === i ? 'rotate-180' : ''"
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
            </svg>
          </button>
          <Transition name="faq-expand">
            <div v-if="openFaq === i" class="px-5 pb-4">
              <p class="text-sm text-slate-400 leading-relaxed">{{ item.a }}</p>
            </div>
          </Transition>
        </div>
      </div>
    </div>

    <!-- Trust footer -->
    <div class="max-w-3xl mx-auto px-4 pb-16">
      <div class="flex flex-col sm:flex-row items-center justify-center gap-6 text-xs text-slate-500">
        <div class="flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
          Pagos seguros con Mercado Pago
        </div>
        <div class="flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          Cancelá cuando quieras
        </div>
        <div class="flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>
          Tarjeta, débito o efectivo
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.faq-expand-enter-active { transition: all 0.2s ease; }
.faq-expand-leave-active { transition: all 0.15s ease; }
.faq-expand-enter-from, .faq-expand-leave-to { opacity: 0; max-height: 0; }
.faq-expand-enter-to, .faq-expand-leave-from { opacity: 1; max-height: 200px; }
</style>
