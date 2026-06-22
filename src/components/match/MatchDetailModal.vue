<script setup>
import { ref, watch } from 'vue'
import { getMatchDetails } from '../../services/fotmob'

const props = defineProps({
  match: { type: Object, default: null },
  open: { type: Boolean, default: false },
})
const emit = defineEmits(['close'])

const loading = ref(false)
const detail = ref(null)

watch(() => [props.open, props.match], async ([isOpen, m]) => {
  if (!isOpen || !m) { detail.value = null; return }
  if (!m.pageUrl) return
  loading.value = true
  try {
    detail.value = await getMatchDetails(m.pageUrl)
  } catch { /* ignore */ }
  loading.value = false
}, { immediate: true })

function teamLogo(id) {
  return `https://images.fotmob.com/image_resources/logo/teamlogo/${id}_xsmall.png`
}

function scoreFromMatch(m, side) {
  if (!m) return '-'
  if (side === 'home') {
    if (m.home?.score != null) return m.home.score
  } else {
    if (m.away?.score != null) return m.away.score
  }
  const parts = m.status?.scoreStr?.split(/\s*-\s*/)
  if (parts?.length === 2) return side === 'home' ? parts[0] : parts[1]
  return '-'
}

const statNames = {
  'Ball possession': 'Posesión', 'Expected goals (xG)': 'Goles esperados (xG)',
  'Total shots': 'Tiros totales', 'Shots on target': 'Tiros al arco',
  'Touches in opposition box': 'Toques en área rival', 'Big chances': 'Ocasiones claras',
  'Big chances missed': 'Ocasiones falladas', 'Accurate passes': 'Pases precisos',
  'Yellow cards': 'Amarillas', 'Red cards': 'Rojas', 'Corners': 'Córners',
  'Fouls committed': 'Faltas', 'Offsides': 'Fuera de juego',
}

function translateStat(title) {
  return statNames[title] || title
}

function statPercent(home, away) {
  const h = parseFloat(home) || 0
  const a = parseFloat(away) || 0
  return h + a === 0 ? 50 : (h / (h + a)) * 100
}
</script>

<template>
  <Teleport to="body">
  <Transition name="modal">
    <div v-if="open && match" class="fixed inset-0 z-[60] flex items-center justify-center p-4" @click.self="emit('close')">
      <div class="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>
      <div class="relative w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-2xl border border-white/15 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 shadow-2xl">
        <!-- Close -->
        <button @click="emit('close')" class="sticky top-3 float-right mr-3 z-10 rounded-full bg-slate-800/80 border border-white/10 p-1.5 text-slate-400 hover:text-white transition">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>

        <div class="pb-6">
          <!-- Scoreboard header — always visible from match prop -->
          <div class="px-6 pt-6 pb-4 text-center border-b border-white/10">
            <div class="flex items-center justify-center gap-5">
              <div class="flex flex-col items-center gap-2 flex-1 min-w-0">
                <img :src="teamLogo(detail?.homeTeam?.id || match.home?.id)" class="w-12 h-12 object-contain" :alt="match.home?.name" />
                <span class="text-sm font-semibold text-white text-center leading-tight">{{ detail?.homeTeam?.name || match.home?.name }}</span>
              </div>
              <div class="flex-shrink-0 px-4">
                <div class="text-4xl font-black text-white tabular-nums tracking-tight">
                  {{ detail?.homeTeam?.score ?? scoreFromMatch(match, 'home') }}
                  <span class="text-slate-500 mx-1">-</span>
                  {{ detail?.awayTeam?.score ?? scoreFromMatch(match, 'away') }}
                </div>
                <div v-if="match.status?.started && !match.status?.finished" class="mt-1 inline-flex items-center gap-1 text-[10px] font-bold tracking-widest text-emerald-400 uppercase">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  EN VIVO
                </div>
                <div v-else-if="match.status?.finished" class="mt-1 text-[10px] font-semibold tracking-widest text-slate-500 uppercase">Final</div>
                <div v-else-if="match.status?.utcTime" class="mt-1 text-[10px] font-semibold tracking-widest text-amber-400/80 uppercase">
                  {{ new Date(match.status.utcTime).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' }) }}
                </div>
              </div>
              <div class="flex flex-col items-center gap-2 flex-1 min-w-0">
                <img :src="teamLogo(detail?.awayTeam?.id || match.away?.id)" class="w-12 h-12 object-contain" :alt="match.away?.name" />
                <span class="text-sm font-semibold text-white text-center leading-tight">{{ detail?.awayTeam?.name || match.away?.name }}</span>
              </div>
            </div>
            <div v-if="detail?.venue || detail?.referee" class="mt-3 flex items-center justify-center gap-4 text-[11px] text-slate-500">
              <span v-if="detail.venue" class="flex items-center gap-1">
                <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                {{ detail.venue }}
              </span>
              <span v-if="detail.referee" class="flex items-center gap-1">
                <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                {{ detail.referee }}
              </span>
            </div>
          </div>

          <!-- Loading events -->
          <div v-if="loading" class="p-8 text-center">
            <div class="inline-block w-6 h-6 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin"></div>
            <p class="mt-2 text-xs text-slate-500">Cargando detalles...</p>
          </div>

          <!-- Match not started -->
          <div v-else-if="!match.status?.started && !detail" class="p-8 text-center">
            <svg class="w-10 h-10 mx-auto text-slate-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <p class="text-slate-400 text-sm">El partido aún no comenzó</p>
            <p v-if="match.status?.utcTime" class="text-slate-500 text-xs mt-1">
              {{ new Date(match.status.utcTime).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Argentina/Buenos_Aires' }) }}
            </p>
          </div>

          <!-- Detail sections -->
          <template v-else-if="detail">
            <!-- Goals -->
            <div v-if="detail.goals.length" class="px-6 py-4 border-b border-white/5">
              <h4 class="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-3 flex items-center gap-2">
                <svg class="w-3.5 h-3.5 text-emerald-400" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>
                Goles
              </h4>
              <div class="space-y-2">
                <div v-for="(g, i) in detail.goals" :key="'g'+i" class="flex items-center gap-2 text-sm" :class="g.isHome ? '' : 'flex-row-reverse text-right'">
                  <div class="flex-1 min-w-0">
                    <span class="text-white font-medium">{{ g.player }}</span>
                    <span v-if="g.assist" class="text-slate-500 text-xs ml-1">({{ g.assist }})</span>
                    <span v-if="g.isPenalty" class="text-amber-400 text-xs ml-1">(P)</span>
                    <span v-if="g.type === 'og'" class="text-red-400 text-xs ml-1">(AG)</span>
                  </div>
                  <span class="flex-shrink-0 text-xs font-mono text-slate-400 tabular-nums bg-white/5 rounded px-1.5 py-0.5">{{ g.minute }}'</span>
                </div>
              </div>
            </div>

            <!-- Cards -->
            <div v-if="detail.cards.length" class="px-6 py-4 border-b border-white/5">
              <h4 class="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-3 flex items-center gap-2">
                <span class="inline-block w-2.5 h-3.5 rounded-[1px] bg-yellow-400"></span>
                Tarjetas
              </h4>
              <div class="space-y-2">
                <div v-for="(c, i) in detail.cards" :key="'c'+i" class="flex items-center gap-2 text-sm" :class="c.isHome ? '' : 'flex-row-reverse text-right'">
                  <div class="flex-1 min-w-0">
                    <span class="inline-block w-2.5 h-3.5 rounded-[1px] mr-1.5 align-middle" :class="c.color === 'yellow' ? 'bg-yellow-400' : 'bg-red-500'"></span>
                    <span class="text-slate-200">{{ c.player }}</span>
                  </div>
                  <span class="flex-shrink-0 text-xs font-mono text-slate-400 tabular-nums bg-white/5 rounded px-1.5 py-0.5">{{ c.minute }}'</span>
                </div>
              </div>
            </div>

            <!-- Stats -->
            <div v-if="detail.stats.length" class="px-6 py-4">
              <h4 class="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-3 flex items-center gap-2">
                <svg class="w-3.5 h-3.5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
                Estadísticas
              </h4>
              <div class="space-y-3">
                <div v-for="(s, i) in detail.stats" :key="'s'+i">
                  <div class="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span class="font-semibold text-white tabular-nums">{{ s.home }}</span>
                    <span class="text-slate-500 text-[10px] uppercase tracking-wider">{{ translateStat(s.title) }}</span>
                    <span class="font-semibold text-white tabular-nums">{{ s.away }}</span>
                  </div>
                  <div class="flex gap-0.5 h-1.5 rounded-full overflow-hidden bg-white/5">
                    <div class="h-full rounded-full bg-emerald-400/60 transition-all duration-500" :style="{ width: statPercent(s.home, s.away) + '%' }"></div>
                    <div class="h-full rounded-full bg-cyan-400/60 transition-all duration-500" :style="{ width: (100 - statPercent(s.home, s.away)) + '%' }"></div>
                  </div>
                </div>
              </div>
            </div>

            <!-- No events available -->
            <div v-if="!detail.goals.length && !detail.cards.length && !detail.stats.length" class="p-8 text-center">
              <p class="text-slate-500 text-sm">No hay eventos registrados todavía</p>
            </div>
          </template>

          <!-- Failed to load details -->
          <div v-else-if="!loading && match.status?.started" class="p-6 text-center">
            <p class="text-slate-500 text-xs">No se pudieron cargar los detalles del partido</p>
          </div>
        </div>
      </div>
    </div>
  </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active, .modal-leave-active { transition: opacity 0.2s ease; }
.modal-enter-active .relative, .modal-leave-active .relative { transition: transform 0.2s ease, opacity 0.2s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from .relative, .modal-leave-to .relative { transform: scale(0.95) translateY(8px); opacity: 0; }
</style>
