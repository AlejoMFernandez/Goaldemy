<script setup>
// Previsualización de "qué cosmético desbloqueás/desbloqueaste" en el hover de logros.
// Cada item es una chip con borde/fondo de SU PROPIA rareza (no genérico) +
// etiqueta de rareza — mismo lenguaje visual que la tienda, no un ícono suelto.
import { rarity } from '../../services/cosmetics'
import PassCosmetic from './PassCosmetic.vue'

const props = defineProps({
  items: { type: Array, default: () => [] },
  label: { type: String, default: 'Desbloqueás' },
  // true = este popup NO tiene nada arriba (ya se ve en la tarjeta) → sin borde/margen superior.
  bare: { type: Boolean, default: false },
})
</script>

<template>
  <template v-if="items.length">
    <div class="flex items-center gap-1.5 mb-2" :class="bare ? '' : 'mt-2 pt-2 border-t border-white/10'">
      <svg class="w-3 h-3 text-violet-400 flex-none" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
      <span class="text-[10px] uppercase tracking-wider font-bold text-violet-300">{{ label }}</span>
    </div>
    <div class="grid grid-cols-3 gap-2">
      <div v-for="u in items" :key="u.code"
        class="flex flex-col items-center gap-1 rounded-lg border p-2"
        :class="[rarity(u.rarity).border, rarity(u.rarity).bg]">
        <PassCosmetic :cos="u" :size="40" />
        <!-- Título ya muestra su propio nombre entre comillas dentro de PassCosmetic -->
        <div v-if="u.type !== 'title'" class="text-[9px] font-bold text-white text-center leading-tight">{{ u.name }}</div>
        <div class="text-[7px] font-bold uppercase tracking-wide" :class="rarity(u.rarity).text">{{ rarity(u.rarity).label }}</div>
      </div>
    </div>
  </template>
</template>
