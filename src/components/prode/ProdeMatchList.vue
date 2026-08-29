<script setup>
import { ref, computed, onMounted, reactive } from 'vue'
import { PRODE_REWARDS, submitPick, getMyPicks } from '@/services/prode'

const props = defineProps({
  competition: { type: String, required: true },
  matches: { type: Array, default: () => [] },
})

const myPicks = ref({})
const drafts = reactive({}) // match.id -> { home, away } mientras se edita, antes de guardar
const saving = ref(null)
const savedFlash = ref(null)

const upcoming = computed(() =>
  (props.matches || [])
    .filter(m => !m.status?.finished && new Date(m.time) > new Date())
    .sort((a, b) => new Date(a.time) - new Date(b.time))
)

onMounted(load)

async function load() {
  myPicks.value = await getMyPicks(props.competition)
}

function draftFor(match) {
  if (!drafts[match.id]) {
    const existing = myPicks.value[String(match.id)]
    drafts[match.id] = { home: existing?.home_pick ?? null, away: existing?.away_pick ?? null }
  }
  return drafts[match.id]
}

function isLocked(match) {
  return new Date(match.time) <= new Date()
}

function fmtDate(iso) {
  return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

async function save(match) {
  const d = draftFor(match)
  if (d.home == null || d.away == null) return
  saving.value = match.id
  try {
    const res = await submitPick({
      competition: props.competition, matchId: match.id,
      homeTeam: match.homeTeam, awayTeam: match.awayTeam,
      homePick: d.home, awayPick: d.away,
      kickoffAt: match.time, round: match.round,
    })
    if (res?.ok) {
      myPicks.value = { ...myPicks.value, [String(match.id)]: { match_id: String(match.id), home_pick: d.home, away_pick: d.away, kickoff_at: match.time } }
      savedFlash.value = match.id
      setTimeout(() => { if (savedFlash.value === match.id) savedFlash.value = null }, 1800)
    }
  } finally {
    saving.value = null
  }
}
</script>

<template>
  <div class="space-y-3">
    <div v-if="!upcoming.length" class="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">
      No hay partidos próximos para pronosticar todavía.
    </div>

    <div v-for="match in upcoming" :key="match.id" class="rounded-xl border border-white/10 bg-slate-900/60 p-4">
      <div class="flex items-center justify-between mb-3">
        <span class="text-sm font-semibold text-white">{{ match.homeTeam }} vs {{ match.awayTeam }}</span>
        <span class="text-xs text-slate-400">{{ fmtDate(match.time) }}</span>
      </div>

      <div class="flex items-center gap-3 mb-3">
        <input
          type="number" min="0" max="20"
          v-model.number="draftFor(match).home"
          :disabled="isLocked(match)"
          class="w-16 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-center text-white disabled:opacity-40"
        />
        <span class="text-slate-500">–</span>
        <input
          type="number" min="0" max="20"
          v-model.number="draftFor(match).away"
          :disabled="isLocked(match)"
          class="w-16 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-center text-white disabled:opacity-40"
        />
        <button
          v-if="!isLocked(match)"
          @click="save(match)"
          :disabled="saving === match.id || draftFor(match).home == null || draftFor(match).away == null"
          class="ml-auto rounded-lg bg-gradient-to-r from-blue-400 to-blue-500 px-4 py-1.5 text-sm font-bold text-slate-900 transition hover:brightness-110 disabled:opacity-40"
        >
          {{ savedFlash === match.id ? '¡Guardado!' : saving === match.id ? 'Guardando…' : 'Guardar' }}
        </button>
        <span v-else class="ml-auto text-xs font-semibold uppercase tracking-wider text-slate-500">Bloqueado</span>
      </div>

      <!-- Preview de recompensa: SIEMPRE visible, es lo que vende cargar el pronóstico -->
      <div class="flex flex-wrap gap-2 border-t border-white/5 pt-3 text-[11px]">
        <span class="inline-flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-500/10 px-2.5 py-1 font-semibold text-amber-300">
          🎯 Exacto: +{{ PRODE_REWARDS.exact.xp }} XP · 🪙+{{ PRODE_REWARDS.exact.fichas }} Fichas
        </span>
        <span class="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 font-semibold text-slate-300">
          ⚽ Ganador: +{{ PRODE_REWARDS.winner.xp }} XP · 🪙+{{ PRODE_REWARDS.winner.fichas }} Fichas
        </span>
      </div>
    </div>
  </div>
</template>
