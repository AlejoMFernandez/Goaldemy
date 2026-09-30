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
 *
 * Todavía no está conectado a ningún juego — lo consume cada juego cuando
 * migre su propio input/autocomplete a este componente.
 */
import { ref, computed, onMounted } from 'vue'
import { getAllPlayers } from '../../services/players'

const props = defineProps({
  showTeam: { type: Boolean, default: false },
  placeholder: { type: String, default: 'Escribí el nombre del jugador...' },
  maxSuggestions: { type: Number, default: 4 },
})
const emit = defineEmits(['pick'])

const query = ref('')
const open = ref(false)
const shaking = ref(false)
const allPlayers = ref([])

onMounted(() => {
  allPlayers.value = getAllPlayers()
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

defineExpose({ shake })
</script>

<template>
  <div class="relative w-full">
    <input
      v-model="query"
      type="text"
      :placeholder="placeholder"
      class="w-full rounded-xl border bg-white/5 px-3 py-2.5 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 transition-colors duration-150"
      :class="shaking ? 'ps-shake border-red-500 ring-2 ring-red-500/40' : 'border-white/15 focus:ring-amber-300/30'"
      @focus="open = true"
      @input="open = true"
      @blur="onBlur"
      @keydown.enter.prevent="onEnter"
    />
    <div
      v-if="open && suggestions.length"
      class="absolute z-30 mt-1 w-full rounded-xl border border-white/10 bg-slate-900/95 backdrop-blur shadow-2xl max-h-64 overflow-auto"
    >
      <ul>
        <li
          v-for="p in suggestions"
          :key="p.id"
          class="px-3 py-2 cursor-pointer text-slate-200 flex items-center gap-2 hover:bg-white/10 transition-colors"
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
