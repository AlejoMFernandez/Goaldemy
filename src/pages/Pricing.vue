<script setup>
/**
 * PLANES (diseño V4 · V4Premium.dc.html) — /pricing
 * Arriba solo el logo de FULVO. Comparación clara Gratis / Pro / Legend: qué
 * tenés a favor (✓ o el número) y qué no (—). Todo sale de la tabla `plans`
 * (fetchPlans): precio, multiplicador de XP, ayudas por día, protectores de racha
 * e insignia. El pago no cambia: confirmación → Mercado Pago (services/checkout).
 */
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { fetchPlans, getUserPlan, invalidatePlanCache } from '../services/premium'
import { getAuthUser } from '../services/auth'
import { startCheckout, handleReturnFromCheckout } from '../services/checkout'
import { pushSuccessToast, pushErrorToast, pushInfoToast } from '../stores/notifications'
import { tap } from '../services/haptics'
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
  if (plan.badge) perks.push(`Badge ${plan.slug === 'legend' ? 'Legend dorado' : 'Pro'} en perfil`)
  return perks
}

// ── Comparación (datos de la tabla plans) ──
const selectedSlug = ref('pro')
const selectedPlan = computed(() => sortedPlans.value.find(p => p.slug === selectedSlug.value) || null)
const COLORS = { free: { c: '#cbd5e1', rgb: '148,163,184' }, pro: { c: '#f0abfc', rgb: '217,70,239' }, legend: { c: '#fde68a', rgb: '251,191,36' } }
const colorOf = (slug) => COLORS[slug] || COLORS.free
const planLabel = (p) => (p.slug === 'free' ? 'Gratis' : p.name)
const mult = (v) => '×' + String(Number(v || 1)).replace('.', ',')
// Cada celda: { kind: 't' texto | 'c' incluido | '-' no incluido | 'b' insignia, v }
const ROWS = [
  { label: 'XP por partida', cell: p => ({ kind: 't', v: mult(p.xp_multiplier) }) },
  { label: 'Ayudas por día', sub: '50/50, Escudo, +15 seg, Pista', cell: p => (p.daily_powerups ? { kind: 't', v: String(p.daily_powerups) } : { kind: '-' }) },
  { label: 'Protectores de racha', sub: 'por semana', cell: p => (p.weekly_streak_protectors ? { kind: 't', v: String(p.weekly_streak_protectors) } : { kind: '-' }) },
  { label: 'Platea del Abono', sub: 'los premios PRO del pase', cell: p => (p.slug !== 'free' ? { kind: 'c' } : { kind: '-' }) },
  { label: 'Cosméticos exclusivos', sub: 'íconos, bordes y banners', cell: p => (p.slug !== 'free' ? { kind: 'c' } : { kind: '-' }) },
  { label: 'Insignia en el perfil', cell: p => (p.badge ? { kind: 'b', v: p.slug === 'legend' ? 'LEGEND' : 'PRO' } : { kind: '-' }) },
]
const cta = computed(() => {
  const p = selectedPlan.value
  if (!p) return null
  if (p.slug === currentPlan.value) return { label: 'ES TU PLAN', sub: p.slug === 'free' ? 'Jugás igual todos los juegos del día' : `${formatPrice(p)} por mes`, kind: 'mine' }
  if (p.slug === 'free') return { label: 'SEGUIR GRATIS', sub: 'Jugás igual todos los juegos del día', kind: 'free' }
  return { label: `HACETE ${p.name.toUpperCase()}`, sub: `${formatPrice(p)} por mes`, kind: 'buy' }
})
function pickPlan(slug) { if (selectedSlug.value !== slug) tap(); selectedSlug.value = slug }
function onCta() {
  const c = cta.value
  if (!c || c.kind === 'mine') return
  tap()
  if (c.kind === 'free') { router.push('/'); return }
  askSubscribe(selectedPlan.value)
}
function close() { tap(); if (window.history.length > 1) router.back(); else router.push('/tienda') }

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
  // Arranca elegido el plan que te conviene mirar: Pro si sos Gratis, el tuyo si ya pagás.
  if (currentPlan.value !== 'free' && allPlans.some(p => p.slug === currentPlan.value)) selectedSlug.value = currentPlan.value
  else if (!allPlans.some(p => p.slug === 'pro') && allPlans.length) selectedSlug.value = allPlans[allPlans.length - 1].slug
  loading.value = false
})
</script>

<template>
  <div class="pm relative -mx-2 sm:mx-auto max-w-xl -mt-6 lg:mt-0 pb-8 text-white">
    <div class="pm-glow pointer-events-none absolute inset-x-0 -top-10 h-[420px]" aria-hidden="true"></div>
    <svg class="pm-beam pointer-events-none absolute left-1/2 -translate-x-1/2 -top-10" width="390" height="260" viewBox="0 0 390 260" aria-hidden="true">
      <defs><linearGradient id="pm-beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fef9c3" stop-opacity="0.35" /><stop offset="1" stop-color="#fef9c3" stop-opacity="0" /></linearGradient></defs>
      <path d="M18 0 L70 0 L190 260 L120 260 Z" fill="url(#pm-beam)" />
      <path d="M320 0 L372 0 L270 260 L200 260 Z" fill="url(#pm-beam)" />
      <g fill="#fef9c3"><circle cx="44" cy="6" r="4" /><circle cx="346" cy="6" r="4" /></g>
    </svg>

    <header class="relative h-[52px] flex items-center justify-center">
      <button type="button" aria-label="Cerrar" class="absolute right-0 top-1 w-11 h-11 rounded-full bg-white/[0.06] text-slate-300 grid place-items-center active:scale-95 transition" @click="close">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
    </header>
    <div class="relative -mt-2 flex justify-center">
      <img src="/iconclaro.png" alt="FULVO" width="58" height="78" class="h-[78px] w-auto drop-shadow-[0_0_18px_rgba(251,191,36,0.35)]" />
    </div>
    <div class="relative mt-4 px-3 text-center">
      <h1 class="m-0 font-display font-bold text-[30px] leading-[1.1]">Jugá en Platea</h1>
      <p class="m-0 mt-1.5 text-sm leading-[1.35] text-slate-300">Más XP en cada partida, más ayudas y todos los premios Platea del Abono.</p>
    </div>

    <!-- Comparación -->
    <section aria-label="Comparación de planes" class="relative mt-6">
      <div v-if="loading" class="h-[360px] rounded-2xl bg-white/5 animate-pulse"></div>
      <p v-else-if="!sortedPlans.length" class="py-10 text-center text-sm text-slate-400">No pudimos cargar los planes. Probá de nuevo en un rato.</p>
      <template v-else>
        <div role="radiogroup" aria-label="Elegí tu plan" class="pm-grid" :style="{ gridTemplateColumns: `1.25fr repeat(${sortedPlans.length}, minmax(0, 1fr))` }">
          <span></span>
          <button v-for="p in sortedPlans" :key="p.slug" type="button" role="radio" :aria-checked="selectedSlug === p.slug"
            :aria-label="`${planLabel(p)}${p.slug === 'pro' ? ', recomendado' : ''}, ${p.price_ars ? formatPrice(p) + ' por mes' : 'sin costo'}${p.slug === currentPlan ? ', es tu plan' : ''}`"
            class="pm-head" :style="selectedSlug === p.slug ? { background: `rgba(${colorOf(p.slug).rgb},0.2)`, boxShadow: `inset 0 2px 0 rgba(${colorOf(p.slug).rgb},0.9)` } : null"
            @click="pickPlan(p.slug)">
            <span v-if="p.slug === currentPlan" class="pm-flag" style="background: #22c55e; color: #052e16">TU PLAN</span>
            <span v-else-if="p.slug === 'pro'" class="pm-flag" style="background: linear-gradient(90deg, #d946ef, #8b5cf6); color: #fff">RECOMENDADO</span>
            <span class="font-bug font-extrabold italic text-[22px] leading-none" :style="{ color: colorOf(p.slug).c }">{{ planLabel(p) }}</span>
            <span class="font-bug font-extrabold text-[15px] leading-[1.1]">{{ p.price_ars ? formatPrice(p) : 'Siempre' }}</span>
            <span class="text-[10px] text-slate-400">{{ p.price_ars ? 'por mes' : 'sin costo' }}</span>
          </button>
        </div>
        <div v-for="(row, ri) in ROWS" :key="row.label" class="pm-grid border-t border-white/[0.07]" :style="{ gridTemplateColumns: `1.25fr repeat(${sortedPlans.length}, minmax(0, 1fr))` }">
          <span class="min-h-[42px] py-1 pr-1.5 pl-0.5 flex flex-col justify-center">
            <span class="text-xs font-bold leading-[1.2]">{{ row.label }}</span>
            <span v-if="row.sub" class="text-[10px] text-slate-500">{{ row.sub }}</span>
          </span>
          <span v-for="(p, pi) in sortedPlans" :key="p.slug" class="pm-cell"
            :style="{ background: selectedSlug === p.slug ? `rgba(${colorOf(p.slug).rgb},0.12)` : 'transparent', borderRadius: selectedSlug === p.slug && ri === ROWS.length - 1 ? '0 0 14px 14px' : '0' }">
            <template v-if="row.cell(p).kind === 't'"><span :style="{ color: p.slug === 'free' ? '#94a3b8' : colorOf(p.slug).c, fontSize: p.slug === 'free' ? '17px' : '19px' }">{{ row.cell(p).v }}</span></template>
            <svg v-else-if="row.cell(p).kind === 'c'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Incluido" :style="{ color: p.slug === 'legend' ? '#fbbf24' : '#e879f9' }"><path d="M5 12l5 5 9-10" /></svg>
            <span v-else-if="row.cell(p).kind === 'b'" class="px-1.5 py-0.5 rounded-[5px] text-xs tracking-[0.6px]"
              :style="p.slug === 'legend' ? { background: 'linear-gradient(180deg,#fcd34d,#f59e0b)', color: '#1c1206' } : { background: 'linear-gradient(180deg,#e879f9,#a21caf)', color: '#fff' }">{{ row.cell(p).v }}</span>
            <span v-else role="img" aria-label="No incluido" class="block w-3 h-0.5 rounded-sm bg-slate-600"></span>
          </span>
        </div>
      </template>
    </section>

    <!-- Acción -->
    <div v-if="!loading && cta" class="relative mt-6 flex flex-col items-center gap-2.5">
      <button type="button" class="pm-cta" :class="'is-' + cta.kind" :disabled="cta.kind === 'mine'" @click="onCta">
        <span class="text-2xl leading-none">{{ cta.label }}</span>
        <span class="text-[13px] not-italic tracking-[0.3px] opacity-80">{{ cta.sub }}</span>
      </button>
      <span class="text-[13px] font-bold text-slate-200">Cancelá cuando quieras.</span>
      <span class="px-2 text-[11px] leading-[1.4] text-slate-500 text-center">Se renueva solo cada mes y se paga con Mercado Pago (tarjeta, débito, dinero en cuenta o efectivo). Lo que ya ganaste queda en tu vestuario.</span>
      <span class="flex gap-1 text-xs">
        <RouterLink to="/terminos" class="min-h-[32px] px-1.5 flex items-center text-slate-400">Términos</RouterLink>
        <RouterLink to="/privacidad" class="min-h-[32px] px-1.5 flex items-center text-slate-400">Privacidad</RouterLink>
      </span>
    </div>

    <!-- Preguntas frecuentes -->
    <section v-if="!loading" aria-label="Preguntas frecuentes" class="relative mt-6">
      <h2 class="m-0 mb-2.5 font-display font-bold text-base text-center">Preguntas frecuentes</h2>
      <div class="flex flex-col gap-2">
        <div v-for="(item, i) in FAQ" :key="i" class="rounded-xl border border-white/10 overflow-hidden" :class="openFaq === i ? 'bg-white/[0.03]' : ''">
          <button type="button" class="w-full min-h-[48px] flex items-center justify-between px-4 py-3 text-left text-sm font-semibold text-white" :aria-expanded="openFaq === i" @click="openFaq = openFaq === i ? null : i">
            <span>{{ item.q }}</span>
            <svg class="w-4 h-4 text-slate-400 shrink-0 ml-3 transition-transform duration-200" :class="openFaq === i ? 'rotate-180' : ''" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
          </button>
          <Transition name="faq-expand">
            <div v-if="openFaq === i" class="px-4 pb-3.5"><p class="m-0 text-sm text-slate-400 leading-relaxed">{{ item.a }}</p></div>
          </Transition>
        </div>
      </div>
    </section>

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
                  <div class="font-display font-bold text-white text-lg leading-tight">Plan {{ confirmPlan.name }}</div>
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
                  <input type="checkbox" v-model="useOtherEmail" class="accent-indigo-500 w-4 h-4 rounded" />
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
                      class="w-full rounded-xl border bg-slate-900/60 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-violet-400/60"
                      :class="emailError ? 'border-red-500/60' : 'border-white/15'"
                      @keyup.enter="confirmCheckout"
                    />
                    <p v-if="emailError" class="text-xs text-red-400 mt-1.5">{{ emailError }}</p>
                    <p v-else class="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                      Usá el e-mail con el que iniciás sesión en Mercado Pago. Tu plan de Fulvo se activa igual en <strong class="text-slate-400">{{ accountEmail }}</strong>.
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
.font-bug { font-family: var(--font-bug); }
.pm-glow { background: radial-gradient(70% 45% at 50% 18%, rgba(217, 70, 239, 0.22), transparent 70%), radial-gradient(60% 30% at 50% 50%, rgba(251, 191, 36, 0.12), transparent 70%); }
.pm-beam { animation: pmbeam 4s ease-in-out infinite; }
@keyframes pmbeam { 0%, 100% { opacity: 0.55; } 50% { opacity: 0.9; } }
.pm-grid { display: grid; }
.pm-head {
  position: relative; min-height: 76px; box-sizing: border-box; padding: 12px 2px 8px; border: 0; border-radius: 14px 14px 0 0; background: transparent;
  color: #f1f5f9; font-family: inherit; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 2px;
}
.pm-flag {
  position: absolute; top: -10px; left: 50%; transform: translateX(-50%); white-space: nowrap; padding: 2px 7px; border-radius: 6px;
  font-family: var(--font-bug); font-weight: 800; font-size: 11px; letter-spacing: 0.6px;
}
.pm-cell { min-height: 42px; display: flex; align-items: center; justify-content: center; text-align: center; font-family: var(--font-bug); font-weight: 800; line-height: 1; }
.pm-cta {
  width: 100%; min-height: 58px; box-sizing: border-box; border-radius: 16px; display: flex; flex-direction: column; align-items: center; justify-content: center;
  font-family: var(--font-bug); font-weight: 800; font-style: italic; letter-spacing: 0.8px; border: 0; cursor: pointer;
}
.pm-cta.is-buy { background: linear-gradient(180deg, #fcd34d, #f59e0b); border-bottom: 4px solid #b45309; color: #1c1206; }
.pm-cta.is-buy:active { transform: translateY(2px); border-bottom-width: 2px; }
.pm-cta.is-free, .pm-cta.is-mine { background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.14); color: #e2e8f0; }
.pm-cta.is-mine { cursor: default; }
@media (prefers-reduced-motion: reduce) {
  .pm-beam { animation: none; }
  .pm-cta.is-buy:active { transform: none; }
}
.faq-expand-enter-active { transition: all 0.2s ease; }
.faq-expand-leave-active { transition: all 0.15s ease; }
.faq-expand-enter-from, .faq-expand-leave-to { opacity: 0; max-height: 0; }
.faq-expand-enter-to, .faq-expand-leave-from { opacity: 1; max-height: 200px; }
.pay-modal-enter-active, .pay-modal-leave-active { transition: opacity 0.2s ease; }
.pay-modal-enter-from, .pay-modal-leave-to { opacity: 0; }
</style>
