<script setup>
/**
 * PrizePeek — carta de premio chica que se puede agrandar.
 * Desktop: hover muestra una vista flotante ampliada al lado de la carta.
 * Mobile/touch: tap abre una vista grande centrada (lightbox).
 * Usar en cualquier lugar donde hoy se muestre un <PrizeCard> chico como
 * preview de "próximo premio" (GameSummaryPopup, GamePreviewModal, etc.)
 */
import { ref } from 'vue'
import PrizeCard from './PrizeCard.vue'

const props = defineProps({
  prize: { type: Object, required: true },
  size: { type: [String, Number], default: 46 },
})

const hovering = ref(false)
const open = ref(false)
const hoverCapable = typeof window !== 'undefined' && window.matchMedia?.('(hover: hover)').matches

function onEnter() { if (hoverCapable) hovering.value = true }
function onLeave() { hovering.value = false }
function toggle() { open.value = !open.value }
</script>

<template>
  <button
    type="button"
    class="pp-trigger"
    @mouseenter="onEnter"
    @mouseleave="onLeave"
    @click="toggle"
    :aria-label="`Ver en grande: ${prize.name}`"
  >
    <PrizeCard :prize="prize" :size="size" />
    <Transition name="pp-float">
      <div v-if="hovering && !open" class="pp-float" @click.stop>
        <PrizeCard :prize="prize" size="l" />
      </div>
    </Transition>
  </button>
  <Teleport to="body">
    <Transition name="pp-modal">
      <div v-if="open" class="pp-modal" @click.self="open = false">
        <button type="button" class="pp-close" aria-label="Cerrar" @click="open = false">✕</button>
        <PrizeCard :prize="prize" size="l" />
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.pp-trigger { position: relative; display: inline-block; padding: 0; border: 0; background: none; cursor: pointer; line-height: 0; }
.pp-float {
  position: absolute; left: 50%; bottom: calc(100% + 10px); transform: translateX(-50%); z-index: 40;
  filter: drop-shadow(0 20px 40px rgba(0, 0, 0, .55)); pointer-events: none;
}
.pp-float-enter-active, .pp-float-leave-active { transition: opacity .18s ease, transform .18s ease; }
.pp-float-enter-from, .pp-float-leave-to { opacity: 0; transform: translateX(-50%) translateY(6px) scale(.92); }

.pp-modal { position: fixed; inset: 0; z-index: 95; display: grid; place-items: center; padding: 24px; background: rgba(3, 5, 14, .85); backdrop-filter: blur(4px); }
.pp-close { position: absolute; top: 16px; right: 16px; width: 38px; height: 38px; border-radius: 50%; border: 1px solid rgba(255, 255, 255, .15); background: rgba(0, 0, 0, .5); color: #fff; font-size: 16px; cursor: pointer; }
.pp-modal-enter-active, .pp-modal-leave-active { transition: opacity .2s ease; }
.pp-modal-enter-from, .pp-modal-leave-to { opacity: 0; }
@media (prefers-reduced-motion: reduce) {
  .pp-float-enter-active, .pp-float-leave-active, .pp-modal-enter-active, .pp-modal-leave-active { transition: none; }
}
</style>
