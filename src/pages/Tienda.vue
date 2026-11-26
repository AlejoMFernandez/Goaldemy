<script setup>
/**
 * TIENDA (diseño V4 · V4Tienda.dc.html) — 1ª pestaña.
 *  Destacado: oferta del día + ofertas de hoy (rotan a las 00:00) + Balones + PRO.
 *  Cosméticos: todo el vestuario en venta.
 *  Balones: la moneda dorada (las recargas todavía no existen → "próximamente").
 *
 * Catálogo, precios y compra salen de services/shop (get_shop / purchase_shop_item).
 * La rotación diaria es de la UI: un orden fijo por día sobre el catálogo real
 * (mismo día = mismas ofertas para todos). No hay descuentos inventados.
 * Fichas = moneda blanda (se gana jugando) · Balón de Oro = moneda dura.
 */
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { getShop, purchaseItem, PURCHASE_ERRORS } from '../services/shop'
import { checkCosmeticUnlocks } from '../services/cosmetics'
import { fetchPlans, getUserPlan } from '../services/premium'
import { pushSuccessToast, pushErrorToast } from '../stores/notifications'
import { shellState, loadShellStats } from '../components/shell/shell-state'
import { tap, success, error as hapticError } from '../services/haptics'
import ShopOfferCard from '../components/shop/ShopOfferCard.vue'
import CurrencyIcon from '../components/shop/CurrencyIcon.vue'
import PiecePreview from '../components/collection/PiecePreview.vue'
import { pieceRarity, KIND_LABEL } from '../components/collection/piece-style'

const SEGS = [{ key: 'destacado', label: 'Destacado' }, { key: 'cosmeticos', label: 'Cosméticos' }, { key: 'balones', label: 'Balones' }]
const seg = ref('destacado')
const loading = ref(true)
const items = ref([])
const plans = ref([])
const myPlan = ref('free')
const buying = ref(false)
const confirm = ref(null) // { item, currency, price }

const nf = (n) => new Intl.NumberFormat('es-AR').format(n || 0)
const wallet = computed(() => ({ fichas: shellState.stats.fichas || 0, balones: shellState.stats.balones || 0 }))
const eqIcon = computed(() => shellState.equipped?.iconGlyph || '')
const initial = computed(() => ((shellState.user?.display_name || shellState.user?.email || '?').trim()[0] || '?').toUpperCase())

// ── Rotación del día (00:00 hora local) ──
const now = ref(Date.now())
let clock = 0
const dayKey = computed(() => { const d = new Date(now.value); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate() })
function seeded(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
function shuffle(list, seed) {
  const rnd = seeded(seed), a = list.slice()
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}
const rotation = computed(() => {
  const all = items.value.slice().sort((a, b) => String(a.id).localeCompare(String(b.id)))
  const notOwned = all.filter(i => !i.owned)
  const pool = shuffle(notOwned.length >= 5 ? notOwned : all, dayKey.value)
  const featPool = pool.filter(i => i.featured)
  const daily = featPool[0] || pool[0] || null
  return { daily, today: pool.filter(i => i !== daily).slice(0, 4) }
})
const resetIn = computed(() => {
  const d = new Date(now.value); const mid = new Date(d); mid.setHours(24, 0, 0, 0)
  const mins = Math.max(0, Math.floor((mid - d) / 60000))
  return { text: `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`, h: Math.floor(mins / 60), m: mins % 60 }
})
const catalog = computed(() => items.value.slice().sort((a, b) => (a.owned - b.owned) || ((b.featured ? 1 : 0) - (a.featured ? 1 : 0))))
const daily = computed(() => rotation.value.daily)
const dailyR = computed(() => daily.value ? pieceRarity(daily.value.rarity) : null)

// ── PRO (datos reales de la tabla plans) ──
const pro = computed(() => plans.value.find(p => p.slug === 'pro') || null)
const proLine = computed(() => {
  const p = pro.value
  if (!p) return 'Más XP, más ayudas y la Platea del Abono'
  const parts = []
  if (p.xp_multiplier > 1) parts.push(`XP ×${String(Number(p.xp_multiplier)).replace('.', ',')}`)
  if (p.daily_powerups) parts.push(`${p.daily_powerups} ayudas por día`)
  parts.push('Platea del Abono')
  return parts.join(' · ')
})

function priceOf(item, currency) { return currency === 'fichas' ? item.price_fichas : item.price_balones }
function canAfford(item, currency) {
  const p = priceOf(item, currency)
  return p != null && (currency === 'fichas' ? wallet.value.fichas : wallet.value.balones) >= p
}
function askBuy(item) {
  tap()
  if (item.owned) { pushSuccessToast('Ya la tenés: equipala en tu Colección'); return }
  const currency = item.price_fichas != null ? 'fichas' : item.price_balones != null ? 'balones' : null
  if (!currency) return
  confirm.value = { item, currency }
}
async function doBuy() {
  if (!confirm.value || buying.value) return
  const { item, currency } = confirm.value
  if (!canAfford(item, currency)) { hapticError(); pushErrorToast(currency === 'fichas' ? 'No te alcanzan las Fichas' : 'No te alcanzan los Balones'); return }
  buying.value = true
  try {
    const res = await purchaseItem(item.id, currency)
    if (res.ok) {
      success()
      pushSuccessToast(`¡Desbloqueaste "${item.name}"!`)
      confirm.value = null
      await Promise.all([load(false), loadShellStats(true)])
      try { await checkCosmeticUnlocks() } catch {}
    } else {
      hapticError()
      pushErrorToast(PURCHASE_ERRORS[res.error] || 'No se pudo completar la compra')
    }
  } catch (e) {
    pushErrorToast(e.message || 'Error en la compra')
  } finally { buying.value = false }
}

async function load(withSpinner = true) {
  if (withSpinner) loading.value = true
  try {
    const [s, pl, me] = await Promise.all([getShop(), fetchPlans().catch(() => []), getUserPlan().catch(() => null)])
    items.value = s || []
    plans.value = pl || []
    myPlan.value = me?.plan || 'free'
  } catch (e) {
    pushErrorToast(e.message || 'No se pudo cargar la tienda')
  } finally { loading.value = false }
}
function pickSeg(k) { if (seg.value !== k) tap(); seg.value = k }

onMounted(() => {
  load(); loadShellStats().catch(() => {})
  clock = setInterval(() => { now.value = Date.now() }, 30000)
})
onUnmounted(() => clearInterval(clock))
</script>

<template>
  <section class="td relative -mx-2 sm:mx-auto max-w-xl -mt-6 lg:mt-0 pb-6">
    <div class="td-glow pointer-events-none absolute inset-x-0 -top-10 h-72" aria-hidden="true"></div>
    <h1 class="sr-only">Tienda</h1>

    <div role="tablist" aria-label="Secciones de la tienda" class="relative grid grid-cols-3 p-1 rounded-full bg-white/[0.06] border border-white/[0.08]">
      <button v-for="s in SEGS" :key="s.key" type="button" role="tab" :aria-selected="seg === s.key" @click="pickSeg(s.key)"
        class="min-h-[40px] rounded-full font-extrabold text-sm transition-colors"
        :class="seg === s.key ? 'text-slate-900 shadow-[0_2px_8px_rgba(0,0,0,0.35)]' : 'text-slate-400'"
        :style="seg === s.key ? { background: 'linear-gradient(180deg,#ffffff,#e2e8f0)' } : null">{{ s.label }}</button>
    </div>

    <div class="relative mt-3 flex flex-col gap-3">
      <div v-if="loading" class="flex flex-col gap-3" aria-busy="true">
        <span class="h-[124px] rounded-[20px] bg-white/5 animate-pulse"></span>
        <div class="grid grid-cols-2 gap-2"><span v-for="n in 4" :key="n" class="h-[108px] rounded-2xl bg-white/5 animate-pulse"></span></div>
      </div>

      <!-- ═══ DESTACADO ═══ -->
      <template v-else-if="seg === 'destacado'">
        <p v-if="!items.length" class="py-10 text-center text-sm text-slate-400">La tienda está vacía por ahora. ¡Volvé pronto!</p>
        <template v-else>
          <section v-if="daily" aria-label="Oferta del día" class="td-daily">
            <span class="td-shine" aria-hidden="true"></span>
            <span class="relative w-[98px] h-[98px] shrink-0 flex items-center justify-center">
              <span class="td-spin absolute inset-0 rounded-[30px]" :style="{ background: `conic-gradient(from 0deg, ${dailyR.c}, transparent 30%, ${dailyR.t}, transparent 70%, ${dailyR.c})`, boxShadow: `0 0 22px ${dailyR.c}88` }" aria-hidden="true"></span>
              <span class="relative w-[84px] h-[84px] rounded-[24px] flex items-center justify-center p-1.5 overflow-hidden" style="background: radial-gradient(circle at 50% 35%, #1e293b, #0b1220)">
                <PiecePreview :cos="daily" :size="daily.type === 'banner' ? 80 : 64" :inner-icon="eqIcon" :initial="initial" :title-size="12" />
              </span>
            </span>
            <span class="flex-1 min-w-0 flex flex-col justify-between">
              <span class="flex items-center justify-between gap-1.5">
                <span class="font-bug font-extrabold text-[13px] tracking-[1px] text-amber-400">OFERTA DEL DÍA</span>
                <span :aria-label="`Se renueva en ${resetIn.h} horas y ${resetIn.m} minutos`" class="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-950/60 font-bug font-extrabold text-sm text-amber-200">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" aria-hidden="true"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l3 2" /></svg>{{ resetIn.text }}
                </span>
              </span>
              <span class="flex flex-col gap-px min-w-0">
                <span class="font-display font-bold text-[19px] leading-[1.1] truncate">{{ KIND_LABEL[daily.type] }} {{ daily.name }}</span>
                <span class="text-[11px] font-extrabold tracking-[0.6px] uppercase" :style="{ color: dailyR.c }">{{ dailyR.label }}<template v-if="daily.premium_only"> · PRO</template></span>
              </span>
              <span class="flex items-center justify-between gap-2">
                <span v-if="daily.price_fichas != null" class="flex items-center gap-1 font-bug font-extrabold text-[22px] text-emerald-200"><CurrencyIcon type="fichas" :size="20" />{{ nf(daily.price_fichas) }}</span>
                <span v-else-if="daily.price_balones != null" class="flex items-center gap-1 font-bug font-extrabold text-[22px] text-amber-200"><CurrencyIcon type="balones" :size="20" />{{ nf(daily.price_balones) }}</span>
                <button v-if="!daily.owned" type="button" class="td-buy" @click="askBuy(daily)">COMPRAR</button>
                <span v-else class="font-bug font-extrabold text-base text-emerald-400">LA TENÉS</span>
              </span>
            </span>
          </section>

          <div class="flex justify-between items-baseline">
            <h2 class="m-0 font-display font-bold text-lg">Ofertas de hoy</h2>
            <span class="font-bug font-extrabold text-sm text-slate-400">ROTAN A LAS 00:00</span>
          </div>
          <div class="grid grid-cols-2 gap-2 -mt-1">
            <ShopOfferCard v-for="it in rotation.today" :key="it.id" :it="it" :inner-icon="eqIcon" :initial="initial" @buy="askBuy" />
          </div>

          <div class="flex justify-between items-baseline">
            <h2 class="m-0 font-display font-bold text-lg">Balones de Oro</h2>
            <span class="flex items-center gap-1 font-bug font-extrabold text-sm text-amber-200">TENÉS {{ nf(wallet.balones) }} <CurrencyIcon type="balones" :size="15" /></span>
          </div>
          <button type="button" class="td-soon" @click="pickSeg('balones')">
            <span class="flex items-center"><CurrencyIcon v-for="n in 3" :key="n" type="balones" :size="30" :class="n > 1 ? '-ml-3' : ''" class="drop-shadow-[0_3px_4px_rgba(0,0,0,0.5)]" /></span>
            <span class="flex-1 min-w-0 flex flex-col text-left">
              <strong class="text-sm">Recargas de Balones</strong>
              <span class="text-xs text-slate-400">Muy pronto vas a poder comprarlos acá.</span>
            </span>
            <span class="td-soon-tag">PRONTO</span>
          </button>
        </template>
      </template>

      <!-- ═══ COSMÉTICOS ═══ -->
      <template v-else-if="seg === 'cosmeticos'">
        <div class="flex justify-between items-baseline gap-2">
          <h2 class="m-0 font-display font-bold text-lg">Vestuario en venta</h2>
          <span class="font-bug font-extrabold text-sm text-slate-400 whitespace-nowrap">{{ catalog.length }} {{ catalog.length === 1 ? 'PIEZA' : 'PIEZAS' }}</span>
        </div>
        <p v-if="!catalog.length" class="py-10 text-center text-sm text-slate-400">La tienda está vacía por ahora. ¡Volvé pronto!</p>
        <div v-else class="grid grid-cols-2 gap-2 -mt-1">
          <ShopOfferCard v-for="it in catalog" :key="it.id" :it="it" big :inner-icon="eqIcon" :initial="initial" @buy="askBuy" />
        </div>
        <p class="m-0 text-xs text-slate-400 text-center">Las Fichas se ganan jugando. Los Balones de Oro son la moneda dorada.</p>
      </template>

      <!-- ═══ BALONES ═══ -->
      <template v-else>
        <div class="flex flex-col gap-0.5">
          <h2 class="m-0 font-display font-bold text-xl">Balones de Oro</h2>
          <span class="text-[13px] text-slate-400">La moneda dorada: cosméticos épicos, legendarios y ofertas del día.</span>
        </div>
        <div class="td-wallet">
          <CurrencyIcon type="balones" :size="40" />
          <span class="flex-1 flex flex-col">
            <span class="font-bug font-extrabold text-[26px] leading-none text-amber-200">{{ nf(wallet.balones) }} Balones</span>
            <span class="text-xs text-slate-400">Tu saldo</span>
          </span>
        </div>
        <div class="td-soon is-static">
          <span class="flex items-center"><CurrencyIcon v-for="n in 3" :key="n" type="balones" :size="34" :class="n > 1 ? '-ml-4' : ''" class="drop-shadow-[0_3px_4px_rgba(0,0,0,0.5)]" /></span>
          <span class="flex-1 min-w-0 flex flex-col text-left">
            <strong class="text-[15px]">Recargas de Balones</strong>
            <span class="text-xs text-slate-400">Todavía no están a la venta. Te avisamos cuando lleguen.</span>
          </span>
          <span class="td-soon-tag">PRONTO</span>
        </div>
        <p class="m-0 text-xs text-slate-500 text-center">Los Balones no vencen.</p>
      </template>

      <!-- PRO -->
      <RouterLink v-if="!loading" to="/pricing" class="td-pro" @click="tap">
        <span class="w-9 h-9 shrink-0 rounded-[10px] bg-white/[0.14] grid place-items-center">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f5d0fe" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7h18v4a2 2 0 000 4v4H3v-4a2 2 0 000-4z" /><path d="M14 7v12" stroke-dasharray="2 2" /></svg>
        </span>
        <span class="flex-1 min-w-0 flex flex-col">
          <strong class="font-bug font-extrabold italic text-[19px] tracking-[0.4px] leading-[1.05]">{{ myPlan === 'free' ? 'HACETE PRO' : 'TU PLAN ' + (myPlan === 'legend' ? 'LEGEND' : 'PRO') }}</strong>
          <span class="text-[11px] text-fuchsia-200 truncate">{{ proLine }}</span>
        </span>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
      </RouterLink>
    </div>

    <!-- Confirmación de compra -->
    <Teleport to="body">
      <Transition name="td-modal">
        <div v-if="confirm" class="fixed inset-0 z-[70]" role="dialog" aria-modal="true" :aria-label="`Comprar ${confirm.item.name}`">
          <div class="fixed inset-0 bg-black/80 backdrop-blur-sm" @click="confirm = null"></div>
          <div class="relative min-h-full flex items-end sm:items-center justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div class="relative w-full max-w-sm rounded-3xl border border-white/15 bg-slate-900 p-5 shadow-2xl text-center">
              <div class="h-24 flex items-center justify-center mb-3">
                <PiecePreview :cos="confirm.item" :size="confirm.item.type === 'banner' ? 120 : 88" :inner-icon="eqIcon" :initial="initial" :title-size="18" />
              </div>
              <h3 class="m-0 text-lg font-bold text-white">{{ confirm.item.name }}</h3>
              <p class="m-0 mt-0.5 text-[11px] font-extrabold tracking-[0.5px] uppercase" :style="{ color: pieceRarity(confirm.item.rarity).c }">{{ KIND_LABEL[confirm.item.type] }} · {{ pieceRarity(confirm.item.rarity).label }}</p>
              <div v-if="confirm.item.price_fichas != null && confirm.item.price_balones != null" role="radiogroup" aria-label="Pagar con" class="mt-4 grid grid-cols-2 gap-2">
                <button v-for="cur in ['fichas', 'balones']" :key="cur" type="button" role="radio" :aria-checked="confirm.currency === cur" @click="confirm.currency = cur"
                  class="min-h-[48px] rounded-xl border flex items-center justify-center gap-1.5 font-bug font-extrabold text-lg"
                  :class="confirm.currency === cur ? 'border-amber-300 bg-amber-400/10 text-white' : 'border-white/10 text-slate-400'">
                  <CurrencyIcon :type="cur" :size="18" />{{ nf(priceOf(confirm.item, cur)) }}
                </button>
              </div>
              <p class="m-0 mt-4 text-sm text-slate-300 inline-flex items-center justify-center gap-1.5 flex-wrap">
                Comprar por <strong class="text-white inline-flex items-center gap-1"><CurrencyIcon :type="confirm.currency" :size="18" />{{ nf(priceOf(confirm.item, confirm.currency)) }} {{ confirm.currency === 'fichas' ? 'Fichas' : 'Balones' }}</strong>
              </p>
              <p class="m-0 mt-1 text-xs" :class="canAfford(confirm.item, confirm.currency) ? 'text-slate-500' : 'text-rose-300'">
                Tenés {{ nf(confirm.currency === 'fichas' ? wallet.fichas : wallet.balones) }} {{ confirm.currency === 'fichas' ? 'Fichas' : 'Balones' }}
              </p>
              <div class="mt-5 flex gap-2.5">
                <button type="button" class="flex-1 min-h-[48px] rounded-xl border border-white/15 text-white text-sm font-semibold" @click="confirm = null">Cancelar</button>
                <button type="button" class="flex-1 min-h-[48px] rounded-xl text-sm font-extrabold disabled:opacity-60 flex items-center justify-center gap-2"
                  :disabled="buying || !canAfford(confirm.item, confirm.currency)"
                  :class="confirm.currency === 'fichas' ? 'bg-gradient-to-b from-emerald-400 to-emerald-600 text-white' : 'bg-gradient-to-b from-amber-300 to-amber-500 text-slate-900'"
                  @click="doBuy">
                  <span v-if="buying" class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                  {{ buying ? 'Comprando…' : 'Comprar' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </section>
</template>

<style scoped>
.font-bug { font-family: var(--font-bug); }
.td-glow { background: radial-gradient(90% 60% at 50% 20%, rgba(251, 191, 36, 0.14), transparent 70%); }
.td-daily {
  position: relative; min-height: 124px; box-sizing: border-box; border-radius: 20px; padding: 12px; display: flex; gap: 14px; overflow: hidden;
  background: radial-gradient(70% 120% at 0% 50%, rgba(251, 191, 36, 0.28), transparent 70%), linear-gradient(135deg, #1f2937, #111a2e);
  border: 1px solid rgba(251, 191, 36, 0.55); box-shadow: 0 10px 30px rgba(245, 158, 11, 0.15);
}
.td-shine { position: absolute; top: 0; bottom: 0; left: 0; width: 70px; background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.08), transparent); pointer-events: none; animation: tdshine 3.2s ease-in-out infinite; }
@keyframes tdshine { 0% { transform: translateX(-120%) skewX(-18deg); } 60%, 100% { transform: translateX(560%) skewX(-18deg); } }
.td-spin { animation: tdspin 6s linear infinite; }
@keyframes tdspin { to { transform: rotate(360deg); } }
.td-buy {
  min-height: 44px; padding: 0 16px; border: 0; border-radius: 12px; background: linear-gradient(180deg, #fcd34d, #f59e0b); border-bottom: 3px solid #b45309;
  color: #1c1206; font-family: var(--font-bug); font-weight: 800; font-style: italic; font-size: 19px; letter-spacing: 0.5px; cursor: pointer;
}
.td-buy:active { transform: translateY(1px); }
.td-soon {
  min-height: 72px; box-sizing: border-box; padding: 12px 14px; border-radius: 18px; border: 1px solid rgba(251, 191, 36, 0.3);
  background: linear-gradient(180deg, rgba(251, 191, 36, 0.12), rgba(251, 191, 36, 0.02)); color: #f1f5f9; display: flex; align-items: center; gap: 12px;
  font-family: inherit; cursor: pointer;
}
.td-soon.is-static { cursor: default; }
.td-soon-tag { padding: 4px 8px; border-radius: 8px; background: rgba(255, 255, 255, 0.08); font-family: var(--font-bug); font-weight: 800; font-size: 13px; color: #fde68a; letter-spacing: 0.5px; }
.td-wallet { padding: 14px; border-radius: 18px; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.1); display: flex; align-items: center; gap: 12px; }
.td-pro {
  position: relative; min-height: 52px; box-sizing: border-box; padding: 8px 12px; border-radius: 16px; background: linear-gradient(100deg, #86198f, #6d28d9);
  border: 1px solid rgba(240, 171, 252, 0.5); color: #fff; text-decoration: none; display: flex; align-items: center; gap: 12px; overflow: hidden;
}
.td-modal-enter-active, .td-modal-leave-active { transition: opacity 0.2s ease; }
.td-modal-enter-from, .td-modal-leave-to { opacity: 0; }
@media (prefers-reduced-motion: reduce) {
  .td-shine, .td-spin { animation: none; }
  .td-modal-enter-active, .td-modal-leave-active { transition: none; }
}
</style>
