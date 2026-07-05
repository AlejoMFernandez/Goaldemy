<script setup>
/**
 * TIENDA de cosméticos con doble moneda (estilo LoL/Fortnite).
 *  • Fichas ⚽        — moneda blanda, se gana jugando.
 *  • Balón de Oro 🏆 — moneda dura, sólo con plata real.
 */
import { ref, computed, onMounted } from 'vue'
import { getWallet, getShop, purchaseItem, PURCHASE_ERRORS } from '../services/shop'
import { pushSuccessToast, pushErrorToast } from '../stores/notifications'
import ShopCard from '../components/shop/ShopCard.vue'
import PassCosmetic from '../components/rewards/PassCosmetic.vue'

const loading = ref(true)
const wallet = ref({ fichas: 0, balones: 0 })
const items = ref([])
const buying = ref(false)
const confirm = ref(null)          // { item, currency, price }

const nf = (n) => new Intl.NumberFormat('es-AR').format(n || 0)

const featured = computed(() => items.value.filter(i => i.featured))
const rest = computed(() => items.value.filter(i => !i.featured))

async function load() {
  loading.value = true
  try {
    const [w, s] = await Promise.all([getWallet(), getShop()])
    wallet.value = w
    items.value = s
  } catch (e) {
    pushErrorToast(e.message || 'No se pudo cargar la tienda')
  } finally {
    loading.value = false
  }
}

function canAfford(item, currency) {
  const price = currency === 'fichas' ? item.price_fichas : item.price_balones
  if (price == null) return false
  return (currency === 'fichas' ? wallet.value.fichas : wallet.value.balones) >= price
}

function askBuy(item, currency) {
  const price = currency === 'fichas' ? item.price_fichas : item.price_balones
  if (price == null) return
  if (!canAfford(item, currency)) {
    pushErrorToast(currency === 'fichas' ? 'No te alcanzan las Fichas' : 'No te alcanzan los Balones')
    return
  }
  confirm.value = { item, currency, price }
}

async function doBuy() {
  if (!confirm.value || buying.value) return
  const { item, currency } = confirm.value
  buying.value = true
  try {
    const res = await purchaseItem(item.id, currency)
    if (res.ok) {
      pushSuccessToast(`¡Desbloqueaste "${item.name}"! 🎉`)
      confirm.value = null
      await load()
    } else {
      pushErrorToast(PURCHASE_ERRORS[res.error] || 'No se pudo completar la compra')
    }
  } catch (e) {
    pushErrorToast(e.message || 'Error en la compra')
  } finally {
    buying.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="min-h-[calc(100dvh-4rem)] text-white max-w-6xl mx-auto px-4 py-8">
    <!-- Header + billetera -->
    <div class="flex flex-wrap items-end justify-between gap-4 mb-2">
      <div>
        <h1 class="text-3xl sm:text-4xl font-extrabold">Tienda</h1>
        <p class="text-slate-400 text-sm mt-1">Cosméticos para tu perfil. Gastá Fichas ganadas jugando o Balones de Oro.</p>
      </div>
      <div class="flex gap-3">
        <div class="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5">
          <span class="text-lg">⚽</span>
          <div>
            <div class="text-[10px] uppercase tracking-wide text-emerald-300/70 leading-none">Fichas</div>
            <div class="text-lg font-extrabold text-white leading-tight">{{ nf(wallet.fichas) }}</div>
          </div>
        </div>
        <div class="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5">
          <span class="text-lg">🏆</span>
          <div>
            <div class="text-[10px] uppercase tracking-wide text-amber-300/70 leading-none">Balón de Oro</div>
            <div class="text-lg font-extrabold text-white leading-tight">{{ nf(wallet.balones) }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Cómo se gana -->
    <div class="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 mb-8 text-xs text-slate-400">
      <span class="text-emerald-300 font-semibold">Fichas ⚽</span> se ganan jugando: ganar partidas, retos diarios, pase de batalla, logros y desafíos progresivos.
      <span class="text-amber-300 font-semibold ml-1">Balón de Oro 🏆</span> es la moneda premium (próximamente con recargas).
    </div>

    <div v-if="loading" class="flex justify-center py-20">
      <div class="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
    </div>

    <div v-else-if="!items.length" class="text-center py-20 text-slate-500">
      La tienda está vacía por ahora. ¡Volvé pronto!
    </div>

    <template v-else>
      <!-- Destacados -->
      <section v-if="featured.length" class="mb-10">
        <h2 class="text-lg font-bold mb-4 flex items-center gap-2"><span>⭐</span> Destacados</h2>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <ShopCard
            v-for="it in featured" :key="it.id" :it="it"
            :afford-fichas="canAfford(it, 'fichas')" :afford-balones="canAfford(it, 'balones')"
            @buy="c => askBuy(it, c)"
          />
        </div>
      </section>

      <!-- Resto -->
      <section>
        <h2 v-if="featured.length" class="text-lg font-bold mb-4">Catálogo</h2>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <ShopCard
            v-for="it in rest" :key="it.id" :it="it"
            :afford-fichas="canAfford(it, 'fichas')" :afford-balones="canAfford(it, 'balones')"
            @buy="c => askBuy(it, c)"
          />
        </div>
      </section>
    </template>

    <!-- Modal de confirmación -->
    <Teleport to="body">
      <div v-if="confirm" class="fixed inset-0 z-[70]">
        <div class="fixed inset-0 bg-black/80 backdrop-blur-sm" @click="confirm = null"></div>
        <div class="relative min-h-full flex items-center justify-center p-4">
          <div class="relative w-full max-w-sm rounded-2xl border border-white/15 bg-slate-900 p-6 shadow-2xl text-center">
            <div class="flex justify-center mb-4"><PassCosmetic :cos="confirm.item" :size="72" /></div>
            <h3 class="text-lg font-bold text-white">{{ confirm.item.name }}</h3>
            <p class="text-xs text-slate-400 mb-5 capitalize">{{ confirm.item.type }} · {{ confirm.item.rarity }}</p>
            <p class="text-sm text-slate-300 mb-5">
              Comprar por
              <strong class="text-white">{{ nf(confirm.price) }} {{ confirm.currency === 'fichas' ? '⚽ Fichas' : '🏆 Balones' }}</strong>
            </p>
            <div class="flex gap-3">
              <button @click="confirm = null" class="flex-1 rounded-xl border border-white/15 hover:bg-white/5 text-white py-2.5 text-sm font-semibold transition">Cancelar</button>
              <button
                @click="doBuy"
                :disabled="buying"
                class="flex-1 rounded-xl py-2.5 text-sm font-bold transition disabled:opacity-60 flex items-center justify-center gap-2"
                :class="confirm.currency === 'fichas' ? 'bg-gradient-to-r from-emerald-500 to-cyan-600 text-white' : 'bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-900'"
              >
                <span v-if="buying" class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                {{ buying ? 'Comprando…' : 'Confirmar' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
