<script setup>
import { ref, watch } from 'vue'
import { getMatchDetails } from '../../services/fotmob'

const props = defineProps({
  // Objeto "liviano" ya disponible en el ticker/grilla (id, homeId, homeName,
  // awayId, awayName, homeScore, awayScore, isLive, finished, pageUrl, ...).
  // null = modal cerrado.
  match: { type: Object, default: null },
})
const emit = defineEmits(['close'])

const loading = ref(false)
const details = ref(null)   // resultado de getMatchDetails (goles, tarjetas, stats, cancha, árbitro)
const failed = ref(false)

watch(() => props.match, async (m) => {
  details.value = null
  failed.value = false
  if (!m) return
  if (!m.pageUrl) { failed.value = true; return }
  loading.value = true
  try {
    const d = await getMatchDetails(m.pageUrl)
    if (props.match !== m) return // el usuario ya cambió de partido
    details.value = d
    if (!d) failed.value = true
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
}, { immediate: true })

function close() { emit('close') }
</script>

<template>
  <Teleport to="body">
    <Transition name="match-modal">
      <div v-if="match" class="fixed inset-0 z-[70] overflow-y-auto">
        <div class="fixed inset-0 bg-black/80 backdrop-blur-sm" @click="close"></div>
        <div class="relative min-h-full flex items-start sm:items-center justify-center p-3 sm:p-4" @click.self="close">
          <div class="relative w-full max-w-md rounded-2xl border border-white/15 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 shadow-2xl my-4">
            <div class="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div class="flex items-center gap-2 min-w-0">
                <img v-if="match.leagueLogo" :src="match.leagueLogo" width="16" height="16" class="w-4 h-4 object-contain shrink-0" alt="" @error="$event.target.style.display='none'" />
                <h3 class="font-display font-bold text-white text-sm truncate">{{ match.leagueName || 'Partido' }}</h3>
              </div>
              <button @click="close" class="text-slate-400 hover:text-white transition shrink-0">
                <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <!-- Marcador -->
            <div class="px-5 py-5 flex items-center justify-between gap-2">
              <div class="flex-1 min-w-0 flex flex-col items-center gap-2 text-center">
                <img v-if="match.homeId" :src="`https://images.fotmob.com/image_resources/logo/teamlogo/${match.homeId}.png`" width="40" height="40" class="w-10 h-10 object-contain" :alt="match.homeName" @error="$event.target.style.display='none'" />
                <span class="text-xs font-semibold text-slate-200 truncate max-w-full">{{ match.homeName }}</span>
              </div>
              <div class="shrink-0 text-center px-2">
                <span v-if="match.isLive" class="inline-block mb-1 text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded animate-pulse">VIVO</span>
                <div class="font-display text-2xl font-extrabold text-white tabular-nums whitespace-nowrap">
                  {{ match.homeScore ?? '-' }} : {{ match.awayScore ?? '-' }}
                </div>
                <span v-if="!match.isLive" class="text-[10px] text-slate-500 font-semibold">{{ match.statusText }}</span>
              </div>
              <div class="flex-1 min-w-0 flex flex-col items-center gap-2 text-center">
                <img v-if="match.awayId" :src="`https://images.fotmob.com/image_resources/logo/teamlogo/${match.awayId}.png`" width="40" height="40" class="w-10 h-10 object-contain" :alt="match.awayName" @error="$event.target.style.display='none'" />
                <span class="text-xs font-semibold text-slate-200 truncate max-w-full">{{ match.awayName }}</span>
              </div>
            </div>

            <!-- Loading -->
            <div v-if="loading" class="px-5 pb-5 space-y-2">
              <div class="h-4 rounded bg-white/5 animate-pulse"></div>
              <div class="h-4 rounded bg-white/5 animate-pulse w-2/3 mx-auto"></div>
              <div class="h-4 rounded bg-white/5 animate-pulse w-1/2 mx-auto"></div>
            </div>

            <!-- Sin más detalles disponibles -->
            <div v-else-if="failed" class="px-5 pb-6 text-center text-sm text-slate-400">
              No hay más detalles disponibles para este partido todavía.
            </div>

            <!-- Detalle real -->
            <div v-else-if="details" class="px-5 pb-5 space-y-4 max-h-[50vh] overflow-y-auto">
              <!-- Goles -->
              <div v-if="details.goals.length">
                <div class="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">Goles</div>
                <div class="space-y-1.5">
                  <div v-for="(g, i) in details.goals" :key="i" class="flex items-center gap-2 text-xs" :class="g.isHome ? '' : 'flex-row-reverse text-right'">
                    <span class="shrink-0">⚽</span>
                    <span class="text-slate-200 font-medium truncate">{{ g.player }}<span v-if="g.isPenalty" class="text-slate-500"> (pen)</span></span>
                    <span class="text-slate-500 tabular-nums shrink-0">{{ g.minute }}'</span>
                  </div>
                </div>
              </div>

              <!-- Tarjetas -->
              <div v-if="details.cards.length">
                <div class="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">Tarjetas</div>
                <div class="space-y-1.5">
                  <div v-for="(c, i) in details.cards" :key="i" class="flex items-center gap-2 text-xs" :class="c.isHome ? '' : 'flex-row-reverse text-right'">
                    <span class="shrink-0">{{ c.color === 'red' ? '🟥' : '🟨' }}</span>
                    <span class="text-slate-200 font-medium truncate">{{ c.player }}</span>
                    <span class="text-slate-500 tabular-nums shrink-0">{{ c.minute }}'</span>
                  </div>
                </div>
              </div>

              <!-- Stats -->
              <div v-if="details.stats.length">
                <div class="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">Estadísticas</div>
                <div class="space-y-2.5">
                  <div v-for="(s, i) in details.stats" :key="i">
                    <div class="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                      <span class="tabular-nums">{{ s.home }}</span>
                      <span>{{ s.title }}</span>
                      <span class="tabular-nums">{{ s.away }}</span>
                    </div>
                    <div class="h-1.5 rounded-full bg-black/30 overflow-hidden flex">
                      <div class="h-full bg-violet-400" :style="{ width: (parseFloat(s.home) || 0) + (parseFloat(s.away) || 0) > 0 ? (parseFloat(s.home) / ((parseFloat(s.home) || 0) + (parseFloat(s.away) || 0)) * 100) + '%' : '50%' }"></div>
                      <div class="h-full bg-white/10 flex-1"></div>
                    </div>
                  </div>
                </div>
              </div>

              <div v-if="!details.goals.length && !details.cards.length && !details.stats.length" class="text-center text-sm text-slate-400 py-2">
                El partido todavía no tiene eventos para mostrar.
              </div>

              <!-- Cancha/árbitro -->
              <div v-if="details.venue || details.referee" class="pt-3 border-t border-white/10 flex flex-col gap-1 text-[11px] text-slate-500">
                <span v-if="details.venue">📍 {{ details.venue }}</span>
                <span v-if="details.referee">🧑‍⚖️ {{ details.referee }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.match-modal-enter-active, .match-modal-leave-active { transition: opacity 0.2s ease; }
.match-modal-enter-from, .match-modal-leave-to { opacity: 0; }
</style>
