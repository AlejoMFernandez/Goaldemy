<script setup>
// Previsualiza un cosmético del pase (ícono / borde / banner / título)
// a partir de { code, type, name, rarity, style_key } que devuelve get_monthly_pass.
import CosmeticIcon from './CosmeticIcon.vue'
import { frameStyle, bannerStyle, rarity } from '../../services/cosmetics'

const props = defineProps({
  cos: { type: Object, required: true },
  size: { type: Number, default: 44 },
})
</script>

<template>
  <div class="grid place-items-center">
    <!-- Ícono -->
    <div v-if="cos.type === 'icon'" class="rounded-lg overflow-hidden ring-1 ring-white/10" :style="{ width: size + 'px', height: size + 'px' }">
      <CosmeticIcon :iconKey="cos.style_key" :rarity="cos.rarity" :size="size" />
    </div>

    <!-- Borde: anillo alrededor de un disco -->
    <div
      v-else-if="cos.type === 'frame'"
      class="rounded-full"
      :class="[frameStyle(cos.style_key).wrap, frameStyle(cos.style_key).pad]"
      :style="{ width: size + 'px', height: size + 'px' }"
    >
      <div class="w-full h-full rounded-full bg-gradient-to-br from-slate-800 to-slate-900"></div>
    </div>

    <!-- Banner: rectángulo con patrón -->
    <div
      v-else-if="cos.type === 'banner'"
      class="rounded-md overflow-hidden ring-1 ring-white/15"
      :class="bannerStyle(cos.style_key)"
      :style="{ width: Math.round(size * 1.6) + 'px', height: Math.round(size * 0.72) + 'px' }"
    ></div>

    <!-- Título: texto -->
    <div v-else class="px-1 text-center text-[11px] font-bold leading-tight" :class="rarity(cos.rarity).text">
      "{{ cos.name }}"
    </div>
  </div>
</template>
