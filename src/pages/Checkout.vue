<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchPlans } from '../services/premium'
import { getAuthUser } from '../services/auth'
import { startCheckout, handleReturnFromCheckout } from '../services/checkout'
import { pushSuccessToast, pushErrorToast, pushInfoToast } from '../stores/notifications'
import { planStyle, formatPrice } from '../services/plans-ui'

const route = useRoute()
const router = useRouter()

const plan = ref(null)
const loading = ref(true)
const payLoading = ref(false)
const billingType = ref('recurring') // 'recurring' | 'one_time'
const accountEmail = computed(() => getAuthUser()?.email || '')
const useOtherEmail = ref(false)
const billingEmail = ref('')
const emailError = ref('')
const acceptedTerms = ref(false)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function planPerks(p) {
  if (!p) return []
  const perks = []
  if (p.xp_multiplier > 1) perks.push(`Bonus de XP +${Math.round((p.xp_multiplier - 1) * 100)}%`)
  if (p.daily_powerups) perks.push(`${p.daily_powerups} power-up${p.daily_powerups === 1 ? '' : 's'} por día`)
  perks.push('Pase de Batalla PRO + cosméticos exclusivos')
  if (p.badge) perks.push(`Badge ${p.slug === 'legend' ? 'Legend dorado' : 'Pro'} en perfil`)
  return perks
}

async function pay() {
  if (!plan.value || payLoading.value || !acceptedTerms.value) return

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

  payLoading.value = true
  try {
    await startCheckout(plan.value.slug, 'mercadopago', payerEmail, billingType.value)
  } catch (e) {
    pushErrorToast(e.message || 'Error al iniciar el pago')
    payLoading.value = false
  }
}

onMounted(async () => {
  const returnResult = await handleReturnFromCheckout()
  if (returnResult) {
    if (returnResult.status === 'success') {
      pushSuccessToast('Pago procesado. Tu plan se activará en unos segundos.')
      setTimeout(() => router.push('/pricing'), 2500)
    } else if (returnResult.status === 'pending') {
      pushInfoToast('Tu pago está pendiente de aprobación en Mercado Pago.')
    } else if (returnResult.status === 'cancelled') {
      pushInfoToast('Pago cancelado')
    }
    window.history.replaceState({}, '', `/checkout?plan=${route.query.plan || ''}`)
  }

  const slug = route.query.plan
  const allPlans = await fetchPlans()
  plan.value = allPlans.find(p => p.slug === slug) || null
  loading.value = false

  if (!plan.value) {
    pushErrorToast('Plan no encontrado')
    router.push('/pricing')
  }
})
</script>

<template>
  <div class="min-h-[calc(100dvh-4rem)] text-white max-w-5xl mx-auto px-4 py-10">
    <div v-if="loading" class="flex justify-center py-20">
      <div class="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
    </div>

    <div v-else-if="plan" class="grid grid-cols-1 md:grid-cols-[1fr_360px] gap-8 items-start">
      <!-- Columna izquierda: formulario -->
      <div class="order-2 md:order-1 space-y-6">
        <div>
          <h1 class="text-2xl font-extrabold mb-1">Completá tu compra</h1>
          <p class="text-sm text-slate-400">Plan {{ plan.name }}</p>
        </div>

        <!-- Modalidad de pago -->
        <div>
          <div class="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-3">Modalidad de pago</div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              @click="billingType = 'recurring'"
              class="text-left rounded-xl border p-4 transition"
              :class="billingType === 'recurring' ? 'border-violet-400/60 bg-violet-500/10' : 'border-white/10 hover:border-white/20'"
            >
              <div class="font-bold text-white text-sm mb-1">Débito automático</div>
              <div class="text-xs text-slate-400">Se renueva solo cada mes. Cancelás cuando quieras.</div>
            </button>
            <button
              type="button"
              @click="billingType = 'one_time'"
              class="text-left rounded-xl border p-4 transition"
              :class="billingType === 'one_time' ? 'border-violet-400/60 bg-violet-500/10' : 'border-white/10 hover:border-white/20'"
            >
              <div class="font-bold text-white text-sm mb-1">Pago único</div>
              <div class="text-xs text-slate-400">Pagás una vez, dura 30 días, no se renueva.</div>
            </button>
          </div>
        </div>

        <!-- Mail de facturación -->
        <div>
          <div class="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-3">Mail de facturación</div>
          <p class="text-sm text-slate-300 leading-relaxed mb-2">
            Se cobra a tu cuenta de Mercado Pago con el e-mail <strong class="text-white">{{ accountEmail }}</strong>.
          </p>
          <label class="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
            <input type="checkbox" v-model="useOtherEmail" class="accent-indigo-500 w-4 h-4 rounded" />
            Mi cuenta de Mercado Pago usa otro e-mail
          </label>
          <div v-if="useOtherEmail" class="mt-3">
            <input
              v-model="billingEmail"
              type="email"
              inputmode="email"
              autocomplete="email"
              placeholder="tu-email-de-mercadopago@ejemplo.com"
              class="w-full rounded-xl border bg-slate-900/60 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-violet-400/60"
              :class="emailError ? 'border-red-500/60' : 'border-white/15'"
            />
            <p v-if="emailError" class="text-xs text-red-400 mt-1.5">{{ emailError }}</p>
          </div>
        </div>

        <!-- Términos -->
        <label class="flex items-start gap-2.5 text-xs text-slate-300 cursor-pointer select-none">
          <input type="checkbox" v-model="acceptedTerms" class="accent-indigo-500 w-4 h-4 rounded mt-0.5" />
          <span>
            Acepto los <RouterLink to="/terms" target="_blank" class="text-violet-300 hover:underline">Términos y Condiciones</RouterLink>
            y la <RouterLink to="/cancellation-policy" target="_blank" class="text-violet-300 hover:underline">Política de cancelación</RouterLink>.
          </span>
        </label>
      </div>

      <!-- Columna derecha: resumen -->
      <div class="order-1 md:order-2 md:sticky md:top-24 rounded-2xl border border-white/15 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
        <div class="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-3">Resumen</div>

        <div class="flex items-center gap-3 mb-4">
          <div class="w-12 h-12 rounded-2xl grid place-items-center border" :class="planStyle(plan.slug).badge">
            <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
          </div>
          <div class="font-display font-bold text-white text-lg leading-tight">Fulvo {{ plan.name }}</div>
        </div>

        <ul class="space-y-1.5 mb-4">
          <li v-for="(perk, i) in planPerks(plan)" :key="i" class="flex items-center gap-2 text-sm text-slate-300">
            <svg class="w-4 h-4 flex-shrink-0" :class="planStyle(plan.slug).accent" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
            {{ perk }}
          </li>
        </ul>

        <div class="border-t border-white/10 pt-4 mb-5">
          <div class="flex items-center justify-between text-sm text-slate-300 mb-1">
            <span>{{ billingType === 'one_time' ? '1 mes (sin renovación)' : '1 mes (renovación automática)' }}</span>
          </div>
          <div class="flex items-end gap-1">
            <span class="text-2xl font-extrabold text-white">{{ formatPrice(plan) }}</span>
            <span class="text-slate-400 text-xs mb-1">ARS</span>
          </div>
        </div>

        <button
          @click="pay"
          :disabled="payLoading || !acceptedTerms"
          class="w-full rounded-xl py-3 text-sm font-bold transition disabled:opacity-50 flex items-center justify-center gap-2"
          :class="planStyle(plan.slug).cta"
        >
          <span v-if="payLoading" class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
          {{ payLoading ? 'Redirigiendo…' : 'Pagar con Mercado Pago' }}
        </button>

        <div class="mt-4 flex items-center gap-2 text-xs text-slate-500">
          <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
          Pagos seguros con Mercado Pago
        </div>
      </div>
    </div>
  </div>
</template>
