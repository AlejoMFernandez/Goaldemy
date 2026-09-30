<script setup>
// Tarjeta de juego del índice = PÓSTER (Moodboard 07). Mantiene la misma API
// que antes (game, unlocked, unlockLevel, availability, streak, to) y suma
// userLevel para dibujar cuánto falta en los bloqueados.
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import GamePoster from './GamePoster.vue'

const props = defineProps({
  game: { type: Object, required: true },
  unlocked: { type: Boolean, default: true },
  unlockLevel: { type: [Number, String], default: null },
  userLevel: { type: Number, default: 1 },
  availability: { type: Object, default: null },
  streak: { type: Number, default: 0 },
  showAyudas: { type: Boolean, default: false },
  to: { type: String, default: '' },
})

const played = computed(() => props.availability?.available === false)
const state = computed(() => {
  if (!props.unlocked) return 'locked'
  if (!played.value) return ''
  return props.availability?.result === 'win' ? 'win' : props.availability?.result === 'loss' ? 'loss' : ''
})
const missLevels = computed(() => Math.max(1, (Number(props.unlockLevel) || 1) - (Number(props.userLevel) || 1)))
const lockPct = computed(() => {
  const need = Number(props.unlockLevel) || 1
  return need > 1 ? Math.round(((Number(props.userLevel) || 1) / need) * 100) : 0
})
// "revancha en 7 h" (el día se reinicia a medianoche)
const revenge = computed(() => {
  const now = new Date(); const mid = new Date(); mid.setHours(24, 0, 0, 0)
  const h = Math.floor((mid - now) / 3600000)
  return h >= 1 ? `revancha en ${h} h` : 'revancha pronto'
})
</script>

<template>
  <div v-if="!unlocked" class="block cursor-not-allowed select-none" :aria-label="`${game.name}: se desbloquea en el nivel ${unlockLevel}`">
    <GamePoster :slug="game.slug" :name="game.name" state="locked" :lock-level="unlockLevel" :miss-levels="missLevels" :lock-pct="lockPct" />
  </div>
  <RouterLink v-else :to="to" class="block no-underline rounded-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 active:scale-[0.98] transition-transform" :aria-label="game.name">
    <GamePoster
      :slug="game.slug"
      :name="game.name"
      :state="state"
      :score="availability?.ficha?.score || ''"
      :stars="availability?.ficha?.stars || 0"
      :streak="streak"
      :revenge="revenge"
    />
  </RouterLink>
</template>
