<script setup>
import { ref } from 'vue'
import MatchSummaryModal from './MatchSummaryModal.vue'

defineProps({
  matches: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
})

const selectedMatch = ref(null)

// Arrastre con mouse/touch (click y mantené para deslizar) además del scroll
// nativo — igual que un carrusel de app. dragged marca si HUBO arrastre real
// (más de unos pocos px) para no abrir el popup de resumen al soltar después
// de haber arrastrado, solo al hacer click limpio.
const trackEl = ref(null)
const drag = { active: false, startX: 0, startScroll: 0, moved: false }

function dragStart(e) {
  if (!trackEl.value) return
  drag.active = true
  drag.moved = false
  drag.startX = (e.touches ? e.touches[0].clientX : e.clientX)
  drag.startScroll = trackEl.value.scrollLeft
  // El scroll nativo (rueda) queda "smooth"; el arrastre necesita 1:1 directo
  // con el puntero — si dejamos smooth puesto, cada frame del drag se anima
  // en vez de moverse al instante, y se siente pesado/con retraso.
  trackEl.value.style.scrollBehavior = 'auto'
}
function dragMove(e) {
  if (!drag.active || !trackEl.value) return
  const x = (e.touches ? e.touches[0].clientX : e.clientX)
  const dx = x - drag.startX
  if (Math.abs(dx) > 3) drag.moved = true
  trackEl.value.scrollLeft = drag.startScroll - dx
  if (!e.touches) e.preventDefault()
}
function dragEnd() {
  drag.active = false
  if (trackEl.value) trackEl.value.style.scrollBehavior = ''
}

function openMatch(m) {
  if (drag.moved) return // fue un arrastre, no un click
  selectedMatch.value = m
}
</script>

<template>
  <div class="relative z-10 full-bleed -mt-10 lg:-mt-12 border-b border-white/8 bg-slate-950/60 backdrop-blur-sm">
    <!-- Loading skeleton -->
    <div v-if="loading && !matches.length" class="flex items-center gap-6 py-2.5 px-4 overflow-hidden">
      <div v-for="i in 8" :key="i" class="h-9 w-[110px] rounded bg-white/5 animate-pulse shrink-0"></div>
    </div>

    <!-- Tira continua tipo Copero: columnas sin caja, separadas por líneas finas.
         cursor-grab/active:cursor-grabbing comunica que se puede arrastrar. -->
    <div
      v-else-if="matches.length"
      ref="trackEl"
      class="flex items-stretch overflow-x-auto no-scrollbar px-4 sm:px-6 cursor-grab active:cursor-grabbing select-none"
      @mousedown="dragStart"
      @mousemove="dragMove"
      @mouseup="dragEnd"
      @mouseleave="dragEnd"
      @touchstart="dragStart"
      @touchmove="dragMove"
      @touchend="dragEnd"
    >
      <template v-for="(m, i) in matches" :key="m.id">
        <button
          type="button"
          class="group flex flex-col justify-center gap-0.5 py-2 px-3.5 shrink-0 w-[150px] rounded-lg transition-colors duration-75 hover:bg-white/5"
          @click="openMatch(m)"
        >
          <div class="flex items-center gap-1.5 mb-0.5">
            <img
              v-if="m.leagueLogo"
              :src="m.leagueLogo" width="12" height="12" loading="lazy" decoding="async"
              class="w-3 h-3 object-contain shrink-0 opacity-75" alt=""
              @error="$event.target.style.display='none'"
            />
            <span
              class="text-[9px] font-semibold uppercase tracking-wide truncate"
              :class="m.isLive ? 'text-emerald-400' : 'text-slate-500'"
            >{{ m.isLive ? 'EN VIVO' : m.statusText }}</span>
          </div>
          <div class="flex items-center justify-between gap-1.5">
            <span class="flex items-center gap-1.5 min-w-0">
              <img
                v-if="m.homeId"
                :src="`https://images.fotmob.com/image_resources/logo/teamlogo/${m.homeId}_xsmall.png`"
                width="15" height="15" loading="lazy" decoding="async"
                class="w-[15px] h-[15px] object-contain shrink-0" :alt="m.homeName"
                @error="$event.target.style.display='none'"
              />
              <span class="text-[12px] font-medium text-slate-200 truncate group-hover:text-white transition-colors">{{ m.homeName }}</span>
            </span>
            <span class="text-[10px] font-bold tabular-nums text-slate-500 shrink-0">{{ m.homeScore ?? '-' }}</span>
          </div>
          <div class="flex items-center justify-between gap-1.5">
            <span class="flex items-center gap-1.5 min-w-0">
              <img
                v-if="m.awayId"
                :src="`https://images.fotmob.com/image_resources/logo/teamlogo/${m.awayId}_xsmall.png`"
                width="15" height="15" loading="lazy" decoding="async"
                class="w-[15px] h-[15px] object-contain shrink-0" :alt="m.awayName"
                @error="$event.target.style.display='none'"
              />
              <span class="text-[12px] font-medium text-slate-200 truncate group-hover:text-white transition-colors">{{ m.awayName }}</span>
            </span>
            <span class="text-[10px] font-bold tabular-nums text-slate-500 shrink-0">{{ m.awayScore ?? '-' }}</span>
          </div>
        </button>
        <div v-if="i < matches.length - 1" class="w-px shrink-0 bg-white/8 my-2.5"></div>
      </template>
    </div>

    <MatchSummaryModal :match="selectedMatch" @close="selectedMatch = null" />
  </div>
</template>

<style scoped>
.no-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
.no-scrollbar::-webkit-scrollbar { display: none; }
/* scroll-behavior smooth para el scroll nativo (rueda/flechas) — el arrastre
   con mouse/touch actualiza scrollLeft directo cuadro a cuadro (ya es 1:1 con
   el puntero, "smooth" ahí significaría lag, no lo queremos en el drag). */
.no-scrollbar { scroll-behavior: smooth; }

/* Rompe el max-width/padding de <main> para ocupar el 100% del viewport.
   --fb-shift (seteada en App.vue) corrige el corrimiento constante que
   introduce el gutter derecho de la sidebar de amigos (padding asimétrico
   en <main>) — sin esa corrección el truco -50vw asume que <main> queda
   centrado simétrico en el viewport y el ticker se corta de un lado. */
.full-bleed {
  width: 100vw;
  position: relative;
  left: 50%;
  margin-left: calc(-50vw + var(--fb-shift, 0px));
}
</style>
