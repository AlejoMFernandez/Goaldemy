<script setup>
/** Tarjeta de un ítem de la tienda. Emite (buy, currency) al padre. */
import { computed } from 'vue'
import { rarity as rarityMeta } from '../../services/cosmetics'
import PassCosmetic from '../rewards/PassCosmetic.vue'
import CurrencyIcon from './CurrencyIcon.vue'

const props = defineProps({
  it: { type: Object, required: true },
  affordFichas: { type: Boolean, default: true },
  affordBalones: { type: Boolean, default: true },
})
const emit = defineEmits(['buy'])

const rar = computed(() => rarityMeta(props.it.rarity))
const nf = (n) => new Intl.NumberFormat('es-AR').format(n || 0)
</script>

<template>
  <div
    class="rounded-2xl border bg-slate-800/60 p-4 flex flex-col items-center text-center transition"
    :class="it.owned ? 'border-emerald-500/30' : 'border-white/10 hover:border-white/20'"
  >
    <div class="mb-3 mt-1"><PassCosmetic :cos="it" :size="64" /></div>
    <div class="text-sm font-bold text-white truncate w-full">{{ it.name }}</div>
    <div class="text-[11px] mb-3 capitalize" :class="rar.text">
      {{ it.rarity }}<span class="text-slate-500"> · {{ it.type }}</span>
    </div>

    <div v-if="it.owned" class="mt-auto w-full rounded-lg bg-emerald-500/15 text-emerald-300 text-xs font-bold py-2">
      ✓ Ya lo tenés
    </div>
    <div v-else class="mt-auto w-full space-y-2">
      <button
        v-if="it.price_fichas != null"
        @click="emit('buy', 'fichas')"
        :disabled="!affordFichas"
        class="w-full rounded-lg text-xs font-bold py-2 transition bg-gradient-to-r from-emerald-500/90 to-cyan-600/90 hover:from-emerald-500 hover:to-cyan-600 text-white disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5"
      >
        <CurrencyIcon type="fichas" :size="16" /> {{ nf(it.price_fichas) }}
      </button>
      <button
        v-if="it.price_balones != null"
        @click="emit('buy', 'balones')"
        :disabled="!affordBalones"
        class="w-full rounded-lg text-xs font-bold py-2 transition bg-gradient-to-r from-amber-500/90 to-yellow-600/90 hover:from-amber-500 hover:to-yellow-600 text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5"
      >
        <CurrencyIcon type="balones" :size="16" /> {{ nf(it.price_balones) }}
      </button>
    </div>
  </div>
</template>
