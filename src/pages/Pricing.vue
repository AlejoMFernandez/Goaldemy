<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { fetchPlans, getUserPlan, invalidatePlanCache } from '../services/premium'
import { getAuthUser } from '../services/auth'
import { startCheckout, handleReturnFromCheckout } from '../services/checkout'
import { pushSuccessToast, pushErrorToast, pushInfoToast } from '../stores/notifications'
import PassCosmetic from '../components/rewards/PassCosmetic.vue'
import PowerupIcon from '../components/rewards/PowerupIcon.vue'

const router = useRouter()
const plans = ref([])
const currentPlan = ref('free')
const loading = ref(true)
const checkoutLoading = ref(null)
const openFaq = ref(null)
const confirmPlan = ref(null) // plan pendiente de confirmar antes de ir a Mercado Pago

const sortedPlans = computed(() =>
  [...plans.value].sort((a, b) => a.sort_order - b.sort_order)
)

function formatPrice(plan) {
  if (plan.price_ars === 0) return 'Gratis'
  const ars = plan.price_ars / 100
  return `$${ars.toLocaleString('es-AR')}`
}

// Recolor por RAREZA: PRO = violeta (épica), Legend = dorado (legendaria). Sin celeste, sin emojis.
function planStyle(slug) {
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

// ── Datos de preview para los hovers ──
const POWERUP_PREVIEW = [
  { type: 'fifty_fifty', name: '50/50', desc: 'Elimina 2 opciones incorrectas' },
  { type: 'shield', name: 'Escudo', desc: 'Protege de un error sin perder' },
  { type: 'extra_time', name: '+15 seg', desc: 'Suma tiempo al reloj' },
  { type: 'reveal_hint', name: 'Pista', desc: 'Revela una pista extra' },
]
const ICON_PREVIEW = [
  { type: 'icon', style_key: 'crown', rarity: 'legendary', name: 'Corona' },
  { type: 'icon', style_key: 'goat', rarity: 'legendary', name: 'GOAT' },
  { type: 'icon', style_key: 'trophy', rarity: 'epic', name: 'Trofeo' },
]
const COSMETIC_PREVIEW = [
  { type: 'frame', style_key: 'premium', rarity: 'legendary', name: 'Élite' },
  { type: 'frame', style_key: 'champion', rarity: 'legendary', name: 'Campeón' },
  { type: 'banner', style_key: 'gold', rarity: 'legendary', name: 'Oro' },
  { type: 'banner', style_key: 'galaxy', rarity: 'legendary', name: 'Galaxia' },
]

// Lista de features por plan (con marca de hover). Sin "desafíos por día por juego".
function planFeatures(plan) {
  const f = []
  if (plan.xp_multiplier > 1) f.push({ text: `Bonus de XP +${Math.round((plan.xp_multiplier - 1) * 100)}%`, strong: true })
  f.push({ text: `${plan.daily_powerups} power-up${plan.daily_powerups === 1 ? '' : 's'} por día`, hover: 'powerups' })
  if (plan.slug === 'free') {
    f.push({ text: 'Pase de Batalla — recompensas gratis' })
    f.push({ text: '9 modos, XP y ranking global' })
  } else {
    f.push({ text: 'Pase de Batalla PRO — recompensas premium', strong: true })
    f.push({ text: 'Íconos exclusivos', hover: 'icons' })
    f.push({ text: 'Bordes y banners exclusivos', hover: 'cosmetics' })
    if (plan.weekly_streak_protectors > 0)
      f.push({ text: `${plan.weekly_streak_protectors} protector${plan.weekly_streak_protectors === 1 ? '' : 'es'} de racha/semana` })
    if (plan.badge) f.push({ text: `Badge ${plan.slug === 'legend' ? 'Legend dorado' : 'Pro'} en perfil`, hover: 'badge' })
  }
  return f
}

// Paso 1: abrir el popup de confirmación (no redirige todavía).
function askSubscribe(plan) {
  const { id } = getAuthUser() || {}
  if (!id) {
    router.push('/login')
    return
  }
  confirmPlan.value = plan
}

// Paso 2: el usuario confirma → recién ahí vamos a Mercado Pago.
async function confirmCheckout() {
  const plan = confirmPlan.value
  if (!plan || checkoutLoading.value) return
  checkoutLoading.value = plan.slug
  try {
    await startCheckout(plan.slug, 'mercadopago')
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
        <div
          v-for="plan in sortedPlans"
          :key="plan.slug"
          class="relative rounded-2xl border bg-white/[0.02] p-6 flex flex-col transition-transform hover:scale-[1.02]"
          :class="[planStyle(plan.slug).border, planStyle(plan.slug).ring, plan.slug === 'pro' ? 'md:-mt-2' : '']"
        >
          <div
            v-if="plan.slug === 'pro'"
            class="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-0.5 rounded-full text-xs font-bold bg-gradient-to-r from-fuchsia-500 to-violet-500 text-white shadow-lg"
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
              <span class="w-2 h-2 rounded-full" :class="planStyle(plan.slug).dot"></span>
              {{ plan.name }}
            </div>
            <div class="flex items-end gap-1">
              <span class="text-3xl font-extrabold">{{ formatPrice(plan) }}</span>
              <span v-if="plan.price_ars > 0" class="text-slate-500 text-sm mb-1">ARS/mes</span>
            </div>
          </div>

          <ul class="space-y-2.5 flex-1 mb-6">
            <li
              v-for="(feat, fi) in planFeatures(plan)"
              :key="fi"
              class="group/feat relative flex items-center gap-2 text-sm"
            >
              <svg class="w-4 h-4 flex-shrink-0" :class="planStyle(plan.slug).accent" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
              <span :class="feat.strong ? 'text-white font-semibold' : 'text-slate-300'">{{ feat.text }}</span>

              <!-- Indicador de que hay preview -->
              <svg v-if="feat.hover" class="w-3.5 h-3.5 text-slate-500 group-hover/feat:text-slate-300 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>

              <!-- ── POPUP: power-ups ── -->
              <div v-if="feat.hover === 'powerups'" class="pointer-events-none absolute bottom-full left-0 mb-2 z-30 w-64 rounded-xl border border-white/15 bg-slate-900/95 backdrop-blur p-3 opacity-0 translate-y-1 shadow-2xl transition-all group-hover/feat:opacity-100 group-hover/feat:translate-y-0">
                <div class="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-2">Tus ayudas en partida</div>
                <div class="space-y-2">
                  <div v-for="pu in POWERUP_PREVIEW" :key="pu.type" class="flex items-center gap-2.5">
                    <div class="w-10 h-10 rounded-lg bg-white/5 border border-white/10 grid place-items-center shrink-0"><PowerupIcon :type="pu.type" :size="30" /></div>
                    <div class="min-w-0">
                      <div class="text-xs font-bold text-white leading-tight">{{ pu.name }}</div>
                      <div class="text-[10px] text-slate-400 leading-tight">{{ pu.desc }}</div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- ── POPUP: íconos exclusivos ── -->
              <div v-else-if="feat.hover === 'icons'" class="pointer-events-none absolute bottom-full left-0 mb-2 z-30 w-56 rounded-xl border border-white/15 bg-slate-900/95 backdrop-blur p-3 opacity-0 translate-y-1 shadow-2xl transition-all group-hover/feat:opacity-100 group-hover/feat:translate-y-0">
                <div class="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-2">Íconos que desbloqueás</div>
                <div class="flex items-center justify-around gap-2">
                  <div v-for="c in ICON_PREVIEW" :key="c.style_key" class="flex flex-col items-center gap-1">
                    <PassCosmetic :cos="c" :size="42" />
                    <div class="text-[9px] font-semibold text-slate-300">{{ c.name }}</div>
                  </div>
                </div>
                <div class="mt-2 text-[10px] text-slate-500 text-center">y muchos más</div>
              </div>

              <!-- ── POPUP: bordes y banners ── -->
              <div v-else-if="feat.hover === 'cosmetics'" class="pointer-events-none absolute bottom-full left-0 mb-2 z-30 w-64 rounded-xl border border-white/15 bg-slate-900/95 backdrop-blur p-3 opacity-0 translate-y-1 shadow-2xl transition-all group-hover/feat:opacity-100 group-hover/feat:translate-y-0">
                <div class="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-2">Bordes y banners</div>
                <div class="grid grid-cols-4 gap-2 place-items-center">
                  <div v-for="c in COSMETIC_PREVIEW" :key="c.style_key" class="flex flex-col items-center gap-1">
                    <PassCosmetic :cos="c" :size="38" />
                    <div class="text-[8px] font-semibold text-slate-400">{{ c.name }}</div>
                  </div>
                </div>
              </div>

              <!-- ── POPUP: badge en el perfil ── -->
              <div v-else-if="feat.hover === 'badge'" class="pointer-events-none absolute bottom-full left-0 mb-2 z-30 w-60 rounded-xl border border-white/15 bg-slate-900/95 backdrop-blur p-3 opacity-0 translate-y-1 shadow-2xl transition-all group-hover/feat:opacity-100 group-hover/feat:translate-y-0">
                <div class="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-2">Así se ve en tu perfil</div>
                <div class="flex items-center gap-3 rounded-lg bg-black/40 ring-1 ring-white/10 p-2.5">
                  <div class="w-11 h-11 rounded-full bg-gradient-to-br from-slate-500 to-slate-700 blur-[2px] shrink-0"></div>
                  <div class="flex-1 min-w-0">
                    <div class="h-2.5 w-20 rounded bg-white/25 blur-[1px] mb-1.5"></div>
                    <span
                      class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold"
                      :class="[planStyle(plan.slug).badge, planStyle(plan.slug).glow]"
                    >
                      <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                      {{ plan.slug === 'legend' ? 'LEGEND' : 'PRO' }}
                    </span>
                  </div>
                </div>
              </div>
            </li>
          </ul>

          <button
            v-if="plan.slug !== currentPlan && plan.slug !== 'free'"
            class="w-full py-3 rounded-xl text-sm font-bold transition-all duration-200"
            :class="planStyle(plan.slug).cta"
            @click="askSubscribe(plan)"
          >
            Suscribirme
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
              <div class="rounded-xl border border-white/10 bg-white/[0.03] p-3 flex gap-2.5 mb-5">
                <svg class="w-5 h-5 text-slate-300 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>
                <p class="text-xs text-slate-300 leading-relaxed">
                  Al continuar te llevamos a <strong class="text-white">Mercado Pago</strong> para completar el pago de forma segura. Podés pagar con tarjeta, débito, dinero en cuenta o efectivo. Cancelás cuando quieras.
                </p>
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
