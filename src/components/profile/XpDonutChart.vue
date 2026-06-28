<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  items: { type: Array, required: true },        // [{ id, name, cover_url, xp }]
  streaksByGame: { type: Object, default: () => ({}) },
  dailyBestByName: { type: Object, default: () => ({}) },
  loading: { type: Boolean, default: false },
})

const showAll = ref(false)
const sorted = computed(() => [...(props.items || [])].filter(g => (g.xp || 0) > 0).sort((a, b) => (b.xp || 0) - (a.xp || 0)))
const maxXp = computed(() => Math.max(1, ...sorted.value.map(g => g.xp || 0)))
const topItems = computed(() => sorted.value.slice(0, 5))
const totalXp = computed(() => sorted.value.reduce((s, g) => s + (g.xp || 0), 0))
const nf = new Intl.NumberFormat('es-AR')
function pct(xp) { return Math.max(4, Math.round(((xp || 0) / maxXp.value) * 100)) }
</script>

<template>
  <div class="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/50 backdrop-blur p-5 sm:p-6 w-full shadow-xl">
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2.5">
        <span class="w-1 h-5 rounded-full bg-gradient-to-b from-emerald-400 to-cyan-500"></span>
        <h3 class="font-display font-bold text-white leading-tight">XP por juego</h3>
      </div>
      <span v-if="!loading && sorted.length" class="text-[11px] text-slate-400 tabular-nums">{{ nf.format(totalXp) }} XP</span>
    </div>

    <div v-if="loading" class="text-center py-10 text-slate-400 animate-pulse">Cargando estadísticas...</div>
    <div v-else-if="!sorted.length" class="text-center py-10 rounded-xl bg-slate-800/30 border border-white/5">
      <div class="text-3xl mb-2">📊</div>
      <p class="text-slate-400">Aún no hay XP para graficar</p>
    </div>

    <template v-else>
      <div class="space-y-3">
        <div v-for="g in topItems" :key="g.id" class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-lg overflow-hidden bg-slate-800/60 border border-white/10 grid place-items-center shrink-0">
            <img v-if="g.cover_url" :src="g.cover_url" :alt="g.name" class="w-full h-full object-cover" />
            <span v-else class="text-sm">⚽</span>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-2 mb-1">
              <span class="truncate text-sm text-slate-200">{{ g.name }}</span>
              <span class="text-sm text-white font-semibold tabular-nums shrink-0">{{ nf.format(g.xp) }} XP</span>
            </div>
            <div class="h-2 rounded-full bg-black/40 overflow-hidden ring-1 ring-white/5">
              <div class="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all duration-700" :style="{ width: pct(g.xp) + '%' }"></div>
            </div>
          </div>
        </div>
      </div>

      <button v-if="sorted.length > 5" @click="showAll = true"
        class="mt-4 w-full rounded-xl border border-white/10 bg-slate-800/40 text-slate-300 hover:bg-slate-700/40 hover:text-white py-2 text-sm font-semibold transition">
        Ver todos los juegos ({{ sorted.length }}) →
      </button>
    </template>

    <!-- Popup: todos los juegos -->
    <Teleport to="body">
      <Transition name="xp-modal">
        <div v-if="showAll" class="fixed inset-0 z-[60] overflow-y-auto">
          <div class="fixed inset-0 bg-black/80 backdrop-blur-sm" @click="showAll = false"></div>
          <div class="relative min-h-full flex items-start sm:items-center justify-center p-3 sm:p-4" @click.self="showAll = false">
            <div class="relative w-full max-w-lg rounded-2xl border border-white/15 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 shadow-2xl my-4">
              <div class="flex items-center justify-between px-5 py-4 border-b border-white/10">
                <h3 class="font-display font-extrabold text-white text-lg">XP por juego</h3>
                <button @click="showAll = false" class="text-slate-400 hover:text-white transition">
                  <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div class="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
                <div v-for="g in sorted" :key="g.id" class="flex items-center gap-3">
                  <div class="w-9 h-9 rounded-lg overflow-hidden bg-slate-800/60 border border-white/10 grid place-items-center shrink-0">
                    <img v-if="g.cover_url" :src="g.cover_url" :alt="g.name" class="w-full h-full object-cover" />
                    <span v-else class="text-sm">⚽</span>
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-2 mb-1">
                      <span class="truncate text-sm text-slate-200">{{ g.name }}</span>
                      <span class="text-sm text-white font-semibold tabular-nums shrink-0">{{ nf.format(g.xp) }} XP</span>
                    </div>
                    <div class="h-2 rounded-full bg-black/40 overflow-hidden ring-1 ring-white/5">
                      <div class="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400" :style="{ width: pct(g.xp) + '%' }"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.xp-modal-enter-active, .xp-modal-leave-active { transition: opacity 0.2s ease; }
.xp-modal-enter-from, .xp-modal-leave-to { opacity: 0; }
</style>
