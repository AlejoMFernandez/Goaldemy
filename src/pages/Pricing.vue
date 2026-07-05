<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { fetchPlans, getUserPlan, invalidatePlanCache } from '../services/premium'
import { getAuthUser } from '../services/auth'
import { startCheckout, handleReturnFromCheckout } from '../services/checkout'
import { pushSuccessToast, pushErrorToast, pushInfoToast } from '../stores/notifications'
import PlanCard from '../components/pricing/PlanCard.vue'
import { planStyle, formatPrice } from '../services/plans-ui'

const router = useRouter()
const plans = ref([])
const currentPlan = ref('free')
const loading = ref(true)
const checkoutLoading = ref(null)
const openFaq = ref(null)
const confirmPlan = ref(null) // plan pendiente de confirmar antes de ir a Mercado Pago
const accountEmail = computed(() => getAuthUser()?.email || '')
const useOtherEmail = ref(false)     // ¿paga con otra cuenta de Mercado Pago?
const billingEmail = ref('')         // mail de MP alternativo
const emailError = ref('')
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const sortedPlans = computed(() =>
  [...plans.value].sort((a, b) => a.sort_order - b.sort_order)
)

// Paso 1: abrir el popup de confirmación (no redirige todavía).
function askSubscribe(plan) {
  const { id } = getAuthUser() || {}
  if (!id) {
    router.push('/login')
    return
  }
  // Reset del campo de mail de facturación en cada apertura.
  useOtherEmail.value = false
  billingEmail.value = ''
  emailError.value = ''
  confirmPlan.value = plan
}

// Paso 2: el usuario confirma → recién ahí vamos a Mercado Pago.
async function confirmCheckout() {
  const plan = confirmPlan.value
  if (!plan || checkoutLoading.value) return

  // Si eligió pagar con otra cuenta, validamos el mail antes de redirigir.
  let payerEmail = null
  if (useOtherEmail.value) {
    const val = billingEmail.value.trim()
    if (!EMAIL_RE.test(val)) {
      emailError.value = 'Ingresá un e-mail válido'
      return
    }
    emailError.value = ''
    payerEmail = val
  }

  checkoutLoading.value = plan.slug
  try {
    await startCheckout(plan.slug, 'mercadopago', payerEmail)
  } catch (e) {
    pushErrorToast(e.message || 'Error al iniciar el pago')
    checkoutLoading.value = null
    confirmPlan.value = null
  }
}

// Features clave para el popup de confirmación.
function planPerks(plan) {
  if (!plan) return []
  const perks = []
  if (plan.xp_multiplier > 1) perks.push(`Bonus de XP +${Math.round((plan.xp_multiplier - 1) * 100)}%`)
  if (plan.daily_powerups) perks.push(`${plan.daily_powerups} power-up${plan.daily_powerups === 1 ? '' : 's'} por día`)
  perks.push('Pase de Batalla PRO + cosméticos exclusivos')
  if (plan.weekly_streak_protectors > 0) perks.push(`${plan.weekly_streak_protectors} protector${plan.weekly_streak_protectors === 1 ? '' : 'es'} de racha/semana`)
  if (plan.badge) perks.push(`Badge ${plan.slug === 'legend' ? 'Legend dorado' : 'Pro'} en perfil`)
  return perks
}

const COMPARISON = [
  { label: 'Power-ups por día', key: 'daily_powerups' },
  { label: 'Bonus de XP', key: 'xp_multiplier', format: v => v > 1 ? `+${Math.round((v - 1) * 100)}%` : 'Base' },
  { label: 'Pase de Batalla PRO', proOnly: true },
  { label: 'Íconos, bordes y banners exclusivos', proOnly: true },
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
  <div class="min-h-[calc(100dvh-4rem)] text-white">

    <!-- Hero -->
    <div class="relative overflow-hidden">
      <div class="absolute inset-0 bg-gradient-to-b from-emerald-500/5 via-transparent to-transparent"></div>
      <div class="relative max-w-5xl mx-auto px-4 pt-12 pb-6 text-center">
        <h1 class="text-3xl sm:text-4xl font-extrabold mb-3">Elegí tu plan</h1>
        <p class="text-slate-400 max-w-lg mx-auto">
          Más XP, power-ups, cosméticos exclusivos y el Pase de Batalla PRO para dominar Goaldemy. Cancelá cuando quieras.
        </p>
      </div>
    </div>

    <!-- Plans -->
    <div class="max-w-5xl mx-auto px-4 pb-8">
      <div v-if="loading" class="flex justify-center py-20">
        <div class="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-3 gap-5">
        <PlanCard
          v-for="plan in sortedPlans"
          :key="plan.slug"
          :plan="plan"
          :current-plan="currentPlan"
          @subscribe="askSubscribe"
        />
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
                :class="planStyle(plan.slug).accent"
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
                <template v-else-if="row.proOnly">
                  <svg v-if="plan.slug !== 'free'" class="w-5 h-5 mx-auto" :class="planStyle(plan.slug).accent" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
                  <span v-else class="text-slate-600">—</span>
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

    <!-- ════ Popup de confirmación antes de Mercado Pago ════ -->
    <Teleport to="body">
      <Transition name="pay-modal">
        <div v-if="confirmPlan" class="fixed inset-0 z-[60] overflow-y-auto">
          <div class="fixed inset-0 bg-black/80 backdrop-blur-sm" @click="confirmPlan = null"></div>
          <div class="relative min-h-full flex items-center justify-center p-4" @click.self="confirmPlan = null">
            <div class="relative w-full max-w-md rounded-2xl border border-white/15 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 shadow-2xl">
              <button @click="confirmPlan = null" class="absolute top-4 right-4 text-slate-400 hover:text-white transition">
                <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>

              <div class="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-3">Confirmá tu suscripción</div>

              <!-- Plan + precio -->
              <div class="flex items-center gap-3 mb-4">
                <div class="w-12 h-12 rounded-2xl grid place-items-center border" :class="planStyle(confirmPlan.slug).badge">
                  <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                </div>
                <div>
                  <div class="font-display font-extrabold text-white text-lg leading-tight">Plan {{ confirmPlan.name }}</div>
                  <div class="flex items-end gap-1">
                    <span class="text-2xl font-extrabold text-white">{{ formatPrice(confirmPlan) }}</span>
                    <span class="text-slate-400 text-xs mb-1">ARS / mes</span>
                  </div>
                </div>
              </div>

              <!-- Qué incluye -->
              <ul class="space-y-1.5 mb-4">
                <li v-for="(perk, i) in planPerks(confirmPlan)" :key="i" class="flex items-center gap-2 text-sm text-slate-300">
                  <svg class="w-4 h-4 flex-shrink-0" :class="planStyle(confirmPlan.slug).accent" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
                  {{ perk }}
                </li>
              </ul>

              <!-- Aviso Mercado Pago -->
              <div class="rounded-xl border border-white/10 bg-white/[0.03] p-3 flex gap-2.5 mb-4">
                <svg class="w-5 h-5 text-slate-300 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>
                <p class="text-xs text-slate-300 leading-relaxed">
                  Al continuar te llevamos a <strong class="text-white">Mercado Pago</strong> para completar el pago de forma segura. Podés pagar con tarjeta, débito, dinero en cuenta o efectivo. Cancelás cuando quieras.
                </p>
              </div>

              <!-- E-mail de facturación (opcional) -->
              <div class="mb-5">
                <p class="text-xs text-slate-400 leading-relaxed mb-2">
                  La suscripción se cobra a tu cuenta de Mercado Pago con el e-mail
                  <strong class="text-slate-200">{{ accountEmail }}</strong>.
                </p>
                <label class="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                  <input type="checkbox" v-model="useOtherEmail" class="accent-emerald-500 w-4 h-4 rounded" />
                  Mi cuenta de Mercado Pago usa otro e-mail
                </label>

                <Transition name="faq-expand">
                  <div v-if="useOtherEmail" class="mt-3">
                    <input
                      v-model="billingEmail"
                      type="email"
                      inputmode="email"
                      autocomplete="email"
                      placeholder="tu-email-de-mercadopago@ejemplo.com"
                      class="w-full rounded-xl border bg-slate-900/60 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-emerald-400/60"
                      :class="emailError ? 'border-red-500/60' : 'border-white/15'"
                      @keyup.enter="confirmCheckout"
                    />
                    <p v-if="emailError" class="text-xs text-red-400 mt-1.5">{{ emailError }}</p>
                    <p v-else class="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                      Usá el e-mail con el que iniciás sesión en Mercado Pago. Tu plan de Goaldemy se activa igual en <strong class="text-slate-400">{{ accountEmail }}</strong>.
                    </p>
                  </div>
                </Transition>
              </div>

              <!-- Acciones -->
              <div class="flex gap-3">
                <button @click="confirmPlan = null" class="flex-1 rounded-xl border border-white/15 hover:bg-white/5 text-white py-3 text-sm font-semibold transition">
                  Cancelar
                </button>
                <button
                  @click="confirmCheckout"
                  :disabled="checkoutLoading"
                  class="flex-1 rounded-xl py-3 text-sm font-bold transition disabled:opacity-60 flex items-center justify-center gap-2"
                  :class="planStyle(confirmPlan.slug).cta"
                >
                  <span v-if="checkoutLoading" class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                  {{ checkoutLoading ? 'Redirigiendo…' : 'Pagar con Mercado Pago' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.faq-expand-enter-active { transition: all 0.2s ease; }
.faq-expand-leave-active { transition: all 0.15s ease; }
.faq-expand-enter-from, .faq-expand-leave-to { opacity: 0; max-height: 0; }
.faq-expand-enter-to, .faq-expand-leave-from { opacity: 1; max-height: 200px; }
.pay-modal-enter-active, .pay-modal-leave-active { transition: opacity 0.2s ease; }
.pay-modal-enter-from, .pay-modal-leave-to { opacity: 0; }
</style>
