<script setup>
// Premio del abono en GRANDE (protagonista de cada mitad de la entrada):
// cosmético con su arte real, chapa de XP, moneda (Fichas/Balones) o ayuda.
// Sin texto: la etiqueta mínima (+250 / rareza) la pone PassStub debajo.
import { computed } from 'vue'
import CosmeticIcon from '../rewards/CosmeticIcon.vue'
import PowerupIcon from '../rewards/PowerupIcon.vue'
import CurrencyIcon from '../shop/CurrencyIcon.vue'
import { frameStyle, bannerStyle } from '../../services/cosmetics'
import { rarityColors } from './pass-rewards'

const props = defineProps({
  reward: { type: Object, required: true },
  // sin glow de rareza (bloqueado)
  muted: { type: Boolean, default: false },
})

const PU_GRAD = {
  fifty_fifty: ['#e879f9', '#a21caf'],
  shield: ['#38bdf8', '#0369a1'],
  extra_time: ['#fbbf24', '#b45309'],
  reveal_hint: ['#34d399', '#047857'],
}

const rc = computed(() => rarityColors(props.reward.rarity))
const glow = computed(() => (props.muted ? 'none' : `0 0 12px ${rc.value[2]}, 0 3px 6px rgba(0,0,0,0.35)`))
const cos = computed(() => props.reward.cos || null)
const puGrad = computed(() => {
  const [a, b] = PU_GRAD[props.reward.powerup] || PU_GRAD.reveal_hint
  return `linear-gradient(160deg, ${a}, ${b})`
})
</script>

<template>
  <!-- ── Cosméticos ── -->
  <template v-if="reward.kind === 'cosmetic' && cos">
    <span v-if="cos.type === 'icon'" class="pz-icon" :style="{ borderColor: rc[0], boxShadow: glow }">
      <CosmeticIcon :iconKey="cos.style_key" :rarity="cos.rarity" :size="49" />
    </span>

    <span v-else-if="cos.type === 'frame'" class="pz-ring" :class="frameStyle(cos.style_key).wrap" :style="{ boxShadow: glow }">
      <span class="pz-ring-in"><img src="/iconclaro.png" alt="" width="26" height="26" /></span>
    </span>

    <span v-else-if="cos.type === 'banner'" class="pz-banner" :class="bannerStyle(cos.style_key)" :style="{ borderColor: rc[0], boxShadow: glow }">
      <span class="pz-scan" aria-hidden="true"></span>
    </span>

    <span v-else class="pz-plate" :style="{ borderColor: rc[0], boxShadow: glow }">{{ cos.name }}</span>
  </template>

  <!-- ── Ayuda ── -->
  <span v-else-if="reward.kind === 'powerup'" class="pz-help" :style="{ background: puGrad }">
    <PowerupIcon :type="reward.powerup" :size="28" />
  </span>

  <!-- ── Fichas / Balones ── -->
  <span v-else-if="reward.kind === 'coin'" class="pz-coin">
    <CurrencyIcon :type="reward.currency" :size="52" />
  </span>

  <!-- ── XP: chapa ── -->
  <span v-else class="pz-xp">XP</span>
</template>

<style scoped>
.pz-icon {
  width: 54px; height: 54px; box-sizing: border-box; border-radius: 13px; border: 2.5px solid;
  overflow: hidden; display: grid; place-items: center; background: #0b1220;
}
.pz-ring { width: 54px; height: 54px; border-radius: 50%; padding: 5px; box-sizing: border-box; display: block; }
.pz-ring-in {
  width: 100%; height: 100%; border-radius: 50%; display: grid; place-items: center;
  background: radial-gradient(circle at 35% 30%, #334155, #0b1220);
}
.pz-ring-in img { opacity: 0.85; }
.pz-banner {
  position: relative; width: 74px; height: 44px; box-sizing: border-box; border-radius: 9px;
  overflow: hidden; border: 2.5px solid; display: block;
}
.pz-scan { position: absolute; inset: 0; background: repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0 2px, transparent 2px 4px); }
.pz-plate {
  max-width: 136px; padding: 6px 9px; border-radius: 9px; border: 2px solid;
  background: linear-gradient(180deg, #1e3a8a, #172554); color: #fff; text-align: center;
  font-family: var(--font-bug); font-weight: 800; font-style: italic; font-size: 15px; line-height: 0.95;
  text-transform: uppercase; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.pz-help {
  width: 50px; height: 50px; border-radius: 14px; color: #fff; display: grid; place-items: center;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.4), 0 3px 6px rgba(0,0,0,0.35);
}
.pz-coin { display: grid; place-items: center; filter: drop-shadow(0 3px 5px rgba(0,0,0,0.4)); }
.pz-xp {
  width: 50px; height: 50px; border-radius: 50%; box-sizing: border-box; border: 3px solid #e0f2fe;
  background: linear-gradient(135deg, #34d399, #22d3ee, #818cf8);
  box-shadow: inset 0 2px 0 rgba(255,255,255,0.45), 0 3px 6px rgba(0,0,0,0.35);
  display: grid; place-items: center; color: #0b1220;
  font-family: var(--font-bug); font-weight: 800; font-style: italic; font-size: 20px;
}
</style>
