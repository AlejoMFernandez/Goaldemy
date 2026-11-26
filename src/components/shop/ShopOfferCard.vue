<script setup>
/**
 * Carta de un ítem de la tienda (diseño V4 Tienda): la pieza arriba sobre una
 * bandeja oscura, nombre, tipo · rareza y precio. Toda la carta es el botón de
 * compra (emite `buy`). Si ya la tenés, muestra "La tenés".
 */
import { computed } from 'vue'
import PiecePreview from '../collection/PiecePreview.vue'
import CurrencyIcon from './CurrencyIcon.vue'
import { pieceRarity, hexA, KIND_LABEL } from '../collection/piece-style'

const props = defineProps({
  it: { type: Object, required: true },
  big: { type: Boolean, default: false },   // 124 px (Cosméticos) vs 108 px (Destacado)
  innerIcon: { type: String, default: '' },
  initial: { type: String, default: '' },
})
const emit = defineEmits(['buy'])

const r = computed(() => pieceRarity(props.it.rarity))
const nf = (n) => new Intl.NumberFormat('es-AR').format(n || 0)
// Precio principal: Fichas si se puede, si no Balones.
const price = computed(() => {
  if (props.it.price_fichas != null) return { cur: 'fichas', n: props.it.price_fichas, color: '#a7f3d0', label: 'Fichas' }
  if (props.it.price_balones != null) return { cur: 'balones', n: props.it.price_balones, color: '#fde68a', label: 'Balones de Oro' }
  return null
})
const aria = computed(() => `${KIND_LABEL[props.it.type] || 'Pieza'} ${props.it.name}, ${r.value.label}` + (props.it.owned ? ', ya la tenés' : price.value ? `, ${nf(price.value.n)} ${price.value.label}` : ''))
</script>

<template>
  <button type="button" class="so" :class="[big ? 'is-big' : '', it.owned ? 'is-owned' : '']" :aria-label="aria"
    :style="{ borderColor: hexA(r.c, 0.4), background: `linear-gradient(180deg, ${hexA(r.c, 0.16)}, rgba(255,255,255,0.02) 70%)` }"
    @click="emit('buy', it)">
    <span class="so-tray">
      <PiecePreview :cos="it" :size="big ? 48 : 38" :inner-icon="innerIcon" :initial="initial" :title-size="big ? 15 : 13" />
    </span>
    <span class="so-name">{{ it.name }}</span>
    <span class="flex justify-between items-center gap-1 min-w-0">
      <span class="so-kind truncate" :style="{ color: r.c }">{{ KIND_LABEL[it.type] || 'Pieza' }} · {{ r.label }}</span>
      <span v-if="it.owned" class="so-own">LA TENÉS</span>
      <span v-else-if="price" class="so-price" :style="{ color: price.color }"><CurrencyIcon :type="price.cur" :size="16" />{{ nf(price.n) }}</span>
    </span>
  </button>
</template>

<style scoped>
.so {
  position: relative; min-height: 108px; box-sizing: border-box; padding: 8px; border-radius: 16px; border: 1px solid; color: #f1f5f9;
  font-family: inherit; text-align: left; cursor: pointer; display: flex; flex-direction: column; gap: 6px; overflow: hidden; min-width: 0;
  transition: transform 0.12s ease;
}
.so:active { transform: scale(0.97); }
.so.is-big { min-height: 124px; }
.so.is-owned { opacity: 0.75; }
.so-tray {
  height: 48px; flex-shrink: 0; box-sizing: border-box; border-radius: 10px; background: rgba(2, 6, 23, 0.5);
  display: flex; align-items: center; justify-content: center; padding: 0 8px; overflow: hidden;
}
.is-big .so-tray { height: 62px; }
.so-name { flex-shrink: 0; line-height: 1.25; font-weight: 700; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.so-kind { font-size: 10px; font-weight: 800; letter-spacing: 0.4px; text-transform: uppercase; min-width: 0; }
.so-price { display: flex; align-items: center; gap: 3px; font-family: var(--font-bug); font-weight: 800; font-size: 17px; flex-shrink: 0; }
.so-own { font-family: var(--font-bug); font-weight: 800; font-size: 12px; color: #4ade80; flex-shrink: 0; }
@media (prefers-reduced-motion: reduce) { .so { transition: none; } }
</style>
