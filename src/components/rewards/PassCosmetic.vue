<script setup>
// Previsualiza un cosmético del pase (ícono / borde / banner / título)
// a partir de { code, type, name, rarity, style_key } que devuelve get_monthly_pass.
import CosmeticIcon from './CosmeticIcon.vue'
import { frameStyle, isSceneFrame, titleClass } from '../../services/cosmetics'
import AvatarFrame from '../common/AvatarFrame.vue'
import BannerScene from '../common/BannerScene.vue'

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

    <!-- Borde del vestuario nuevo -->
    <AvatarFrame v-else-if="cos.type === 'frame' && isSceneFrame(cos.style_key)" :frame-key="cos.style_key" :size="size" :level="24" :streak="12">
      <div class="w-full h-full rounded-full bg-gradient-to-br from-slate-800 to-slate-900"></div>
    </AvatarFrame>

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
    <BannerScene
      v-else-if="cos.type === 'banner'"
      class="rounded-md ring-1 ring-white/15"
      :style-key="cos.style_key"
      :animate="false"
      :style="{ width: Math.round(size * 1.6) + 'px', height: Math.round(size * 0.72) + 'px' }"
    />

    <!-- Título: texto. Mismo ancho/alto que un ícono (para no quedar "estirado" al
         lado de otros), pero pegado ABAJO del box (no centrado verticalmente) para
         que quede pegado a la rareza que va justo debajo, no flotando en el medio. -->
    <div v-else class="flex items-end justify-center text-center px-1 text-[11px] leading-tight" :style="{ width: size + 'px', height: size + 'px' }">
      <span :class="titleClass(cos.rarity)">{{ cos.name }}</span>
    </div>
  </div>
</template>
