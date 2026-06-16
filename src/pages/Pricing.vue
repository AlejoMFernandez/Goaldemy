<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { fetchPlans, getUserPlan, invalidatePlanCache } from '../services/premium'
import { getAuthUser } from '../services/auth'
import { startCheckout, handleReturnFromCheckout } from '../services/checkout'
import { pushSuccessToast, pushErrorToast, pushInfoToast } from '../stores/notifications'

const router = useRouter()
const route = useRoute()
const plans = ref([])
const currentPlan = ref('free')
const loading = ref(true)
const checkoutLoading = ref(null)

const FEATURES = [
  { label: 'Desafíos por juego / día', key: 'daily_challenges_per_game' },
  { label: 'Power-ups por día', key: 'daily_powerups' },
  { label: 'Bonus de XP', key: 'xp_multiplier', format: v => v > 1 ? `+${Math.round((v - 1) * 100)}%` : '—' },
  { label: 'Protectores de racha / semana', key: 'weekly_streak_protectors', format: v => v > 0 ? v : '—' },
]

const sortedPlans = computed(() =>
  [...plans.value].sort((a, b) => a.sort_order - b.sort_order)
)

function formatPrice(plan) {
  if (plan.price_usd_cents === 0) return 'Gratis'
  return `$${(plan.price_usd_cents / 100).toFixed(2)}`
}

function featureValue(plan, feat) {
  const val = plan[feat.key]
  if (feat.format) return feat.format(val)
  return val
}

function planStyle(slug) {
  if (slug === 'legend') return {
    border: 'border-amber-500/60',
    bg: 'bg-gradient-to-b from-amber-500/10 to-transparent',
    badge: 'bg-amber-500 text-black',
    cta: 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold',
  }
  if (slug === 'pro') return {
    border: 'border-cyan-500/60',
    bg: 'bg-gradient-to-b from-cyan-500/10 to-transparent',
    badge: 'bg-cyan-500 text-black',
    cta: 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-black font-bold',
  }
  return {
    border: 'border-white/10',
    bg: '',
    badge: 'bg-white/10 text-white/70',
    cta: 'bg-white/10 hover:bg-white/20 text-white',
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
  <div class="min-h-[calc(100dvh-4rem)] bg-slate-900 text-white px-4 py-8">
    <div class="max-w-5xl mx-auto">
      <div class="text-center mb-10">
        <h1 class="text-3xl sm:text-4xl font-extrabold mb-2">Elegí tu plan</h1>
        <p class="text-white/60 max-w-md mx-auto">
          Desbloqueá más desafíos, power-ups y ventajas para dominar Goaldemy
        </p>
      </div>

      <div v-if="loading" class="flex justify-center py-20">
        <div class="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div
          v-for="plan in sortedPlans"
          :key="plan.slug"
          class="relative rounded-2xl border p-6 flex flex-col transition-transform hover:scale-[1.02]"
          :class="[planStyle(plan.slug).border, planStyle(plan.slug).bg]"
        >
          <!-- Popular badge -->
          <div
            v-if="plan.slug === 'pro'"
            class="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-bold bg-cyan-500 text-black"
          >
            Popular
          </div>

          <!-- Current plan badge -->
          <div
            v-if="plan.slug === currentPlan"
            class="absolute -top-3 right-4 px-3 py-0.5 rounded-full text-xs font-bold bg-emerald-500 text-black"
          >
            Tu plan
          </div>

          <div class="mb-4">
            <span
              class="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold mb-3"
              :class="planStyle(plan.slug).badge"
            >
              {{ plan.name }}
            </span>
            <div class="flex items-end gap-1">
              <span class="text-3xl font-extrabold">{{ formatPrice(plan) }}</span>
              <span v-if="plan.price_usd_cents > 0" class="text-white/40 text-sm mb-1">/mes</span>
            </div>
          </div>

          <ul class="space-y-3 flex-1 mb-6">
            <li
              v-for="feat in FEATURES"
              :key="feat.key"
              class="flex items-center justify-between text-sm"
            >
              <span class="text-white/70">{{ feat.label }}</span>
              <span class="font-semibold">{{ featureValue(plan, feat) }}</span>
            </li>
          </ul>

          <button
            v-if="plan.slug !== currentPlan && plan.slug !== 'free'"
            class="w-full py-2.5 rounded-xl text-sm transition-all duration-200"
            :class="planStyle(plan.slug).cta"
            :disabled="checkoutLoading === plan.slug"
            @click="handleSubscribe(plan.slug)"
          >
            <span v-if="checkoutLoading === plan.slug" class="flex items-center justify-center gap-2">
              <span class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
              Redirigiendo...
            </span>
            <span v-else>Suscribirme</span>
          </button>
          <div
            v-else-if="plan.slug === currentPlan"
            class="w-full py-2.5 rounded-xl text-sm text-center bg-white/5 text-white/40 cursor-default"
          >
            Plan actual
          </div>
          <div v-else class="w-full py-2.5 rounded-xl text-sm text-center text-white/30">
            Incluido
          </div>
        </div>
      </div>


      <div class="text-center mt-8 text-white/40 text-xs">
        Pagos procesados de forma segura por Mercado Pago.
        Podés cancelar en cualquier momento.
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>
