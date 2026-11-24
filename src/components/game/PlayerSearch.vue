<script setup>
/**
 * BUSCADOR DE JUGADORES (componente común)
 *
 * Input + hasta 4 sugerencias (cara, nombre resaltado, club opcional) sobre
 * TODOS los jugadores del roster (incluido fame 3) — a diferencia del pool de
 * targets/opciones de los juegos, acá cualquier jugador es una sugerencia
 * válida para escribir.
 *
 * Uso: <PlayerSearch @pick="onPick" :show-team="true" ref="search" />
 *      this.$refs.search.shake()  // feedback de error (borde rojo + temblor)
 *      this.$refs.search.focus()  // abrir teclado (ej. al tocar una celda)
 *
 * drop-up: las sugerencias se abren ARRIBA del input (para hojas pegadas abajo,
 * donde el teclado del celu las tapaba). Con window.visualViewport se limita el
 * alto de la lista al espacio visible y se sube el input sobre el teclado.
 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { getAllPlayers } from '../../services/players'

const props = defineProps({
  showTeam: { type: Boolean, default: false },
  placeholder: { type: String, default: 'Escribí el nombre del jugador...' },
  maxSuggestions: { type: Number, default: 4 },
  dropUp: { type: Boolean, default: false },
})
const emit = defineEmits(['pick'])

const query = ref('')
const open = ref(false)
const shaking = ref(false)
const allPlayers = ref([])
const inputEl = ref(null)
const listMax = ref(256)

// Espacio visible arriba/abajo del input según el viewport VISUAL (descuenta el
// teclado en iOS/Android) y, si el teclado tapa el input, lo sube a la vista.
function fitToViewport() {
  const el = inputEl.value
  if (!el || typeof window === 'undefined') return
  const vv = window.visualViewport
  const top = vv ? vv.offsetTop : 0
  const height = vv ? vv.height : window.innerHeight
  const r = el.getBoundingClientRect()
  const overflow = r.bottom - (top + height) + 12
  if (document.activeElement === el && overflow > 0) window.scrollBy({ top: overflow, behavior: 'smooth' })
  const rr = el.getBoundingClientRect()
  const avail = props.dropUp ? (rr.top - top - 8) : (top + height - rr.bottom - 8)
  listMax.value = Math.max(120, Math.min(256, Math.floor(avail)))
}

onMounted(() => {
  allPlayers.value = getAllPlayers()
  window.visualViewport?.addEventListener('resize', fitToViewport)
  window.visualViewport?.addEventListener('scroll', fitToViewport)
})
onBeforeUnmount(() => {
  window.visualViewport?.removeEventListener('resize', fitToViewport)
  window.visualViewport?.removeEventListener('scroll', fitToViewport)
})

function normalize(s) {
  return (s || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
}

// rank 0 = algún token del nombre empieza con la búsqueda (mejor coincidencia)
// rank 1 = la búsqueda aparece en cualquier otra parte del nombre
// null   = no coincide
function matchRank(normName, normQuery) {
  const idx = normName.indexOf(normQuery)
  if (idx === -1) return null
  const startsFullName = idx === 0
  const startsAnyToken = normName.slice(0, idx).endsWith(' ') || startsFullName
  return startsAnyToken ? 0 : 1
}

const suggestions = computed(() => {
  const raw = query.value.trim()
  if (raw.length < 2) return []
  const nq = normalize(raw)
  const scored = []
  for (const p of allPlayers.value) {
    const rank = matchRank(normalize(p.name), nq)
    if (rank === null) continue
    scored.push({ p, rank })
  }
  scored.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank
    return (b.p.transferValue ?? 0) - (a.p.transferValue ?? 0)
  })
  return scored.slice(0, props.maxSuggestions).map((s) => s.p)
})

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

// Resalta, sobre el nombre ORIGINAL, el tramo que matchea la búsqueda
// normalizada (sin tildes). NFD sólo separa acento+letra, así que el índice
// del string normalizado cae en la misma posición que en el original.
function highlight(name) {
  const raw = query.value.trim()
  if (!raw) return escapeHtml(name)
  const nq = normalize(raw)
  const nName = normalize(name)
  const idx = nName.indexOf(nq)
  if (idx === -1) return escapeHtml(name)
  const before = escapeHtml(name.slice(0, idx))
  const match = escapeHtml(name.slice(idx, idx + nq.length))
  const after = escapeHtml(name.slice(idx + nq.length))
  return `${before}<mark class="ps-highlight">${match}</mark>${after}`
}

function choose(player) {
  if (!player) return
  emit('pick', player)
  query.value = ''
  open.value = false
}

function onEnter() {
  if (suggestions.value.length) choose(suggestions.value[0])
}

function onBlur() {
  // delay para no cerrar antes de que el click/mousedown de una sugerencia registre
  setTimeout(() => { open.value = false }, 150)
}

function shake() {
  shaking.value = true
  setTimeout(() => { shaking.value = false }, 450)
}

function focus() {
  inputEl.value?.focus({ preventScroll: true })
  // el teclado tarda en abrir: reajustar cuando ya cambió el viewport
  setTimeout(fitToViewport, 50)
  setTimeout(fitToViewport, 350)
}

function onFocus() {
  open.value = true
  setTimeout(fitToViewport, 300)
}

defineExpose({ shake, focus })
</script>

<template>
  <div class="relative w-full">
    <input
      ref="inputEl"
      v-model="query"
      type="text"
      autocomplete="off"
      autocorrect="off"
      autocapitalize="none"
      spellcheck="false"
      enterkeyhint="search"
      :placeholder="placeholder"
      class="w-full rounded-xl border bg-white/5 px-3 py-2.5 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 transition-colors duration-150"
      :class="shaking ? 'ps-shake border-red-500 ring-2 ring-red-500/40' : 'border-white/15 focus:ring-amber-300/30'"
      @focus="onFocus"
      @input="open = true"
      @blur="onBlur"
      @keydown.enter.prevent="onEnter"
    />
    <div
      v-if="open && suggestions.length"
      class="absolute z-30 w-full rounded-xl border border-white/10 bg-slate-900/95 backdrop-blur shadow-2xl overflow-auto overscroll-contain"
      :class="dropUp ? 'bottom-full mb-1' : 'mt-1'"
      :style="{ maxHeight: listMax + 'px' }"
    >
      <ul>
        <li
          v-for="p in suggestions"
          :key="p.id"
          class="px-3 py-2 min-h-[44px] cursor-pointer text-slate-200 flex items-center gap-2 hover:bg-white/10 transition-colors"
          @mousedown.prevent="choose(p)"
        >
          <img
            :src="p.image"
            :alt="p.name"
            class="h-7 w-7 rounded-full object-cover flex-shrink-0 bg-slate-700"
            @error="(e) => (e.target.style.opacity = '0')"
          />
          <span class="truncate" v-html="highlight(p.name)"></span>
          <span v-if="showTeam && p.teamName" class="text-slate-500 text-xs ml-auto flex-shrink-0 truncate max-w-[35%]">
            {{ p.teamName }}
          </span>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.ps-highlight {
  background: transparent;
  color: rgb(252, 211, 77); /* amber-300 */
  font-weight: 700;
}

.ps-shake {
  animation: ps-shake-anim 400ms ease-in-out;
}
@keyframes ps-shake-anim {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-6px); }
  40% { transform: translateX(6px); }
  60% { transform: translateX(-4px); }
  80% { transform: translateX(4px); }
}
</style>
