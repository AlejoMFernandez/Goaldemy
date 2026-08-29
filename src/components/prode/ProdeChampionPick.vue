<script setup>
import { ref, computed, onMounted } from 'vue'
import { PRODE_REWARDS, deriveTeams, firstKickoff, submitChampionPick, getMyChampionPick } from '@/services/prode'

const props = defineProps({
  competition: { type: String, required: true },
  matches: { type: Array, default: () => [] },
})

const myPick = ref(null)
const saving = ref(false)

const teams = computed(() => deriveTeams(props.matches).sort((a, b) => a.name.localeCompare(b.name)))
const lockAt = computed(() => firstKickoff(props.matches))
const locked = computed(() => !lockAt.value || new Date(lockAt.value) <= new Date())

onMounted(async () => {
  myPick.value = await getMyChampionPick(props.competition)
})

function fmtDate(iso) {
  return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

async function choose(team) {
  if (locked.value || saving.value) return
  saving.value = true
  try {
    const res = await submitChampionPick({
      competition: props.competition, teamId: team.id, teamName: team.name, lockedAt: lockAt.value,
    })
    if (res?.ok) myPick.value = { team_id: team.id, team_name: team.name, locked_at: lockAt.value, result: null }
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="mb-6 overflow-hidden rounded-2xl border border-amber-400/25 bg-gradient-to-br from-amber-500/10 via-slate-900 to-slate-900 p-5">
    <div class="mb-3 text-center">
      <span class="text-2xl">🏆</span>
      <h3 class="mt-1 font-display text-lg font-bold uppercase tracking-wide text-white">¿Quién sale campeón?</h3>
    </div>

    <div class="mb-4 flex flex-wrap items-center justify-center gap-2 text-xs">
      <span class="text-slate-300">Si acertás, ganás:</span>
      <span class="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 font-bold text-emerald-300">⭐ +{{ PRODE_REWARDS.champion.xp }} XP</span>
      <span class="rounded-full border border-amber-400/30 bg-amber-500/10 px-2.5 py-1 font-bold text-amber-300">🪙 +{{ PRODE_REWARDS.champion.fichas }} Fichas</span>
      <span class="rounded-full border border-yellow-300/40 bg-yellow-400/10 px-2.5 py-1 font-bold text-yellow-300">⚽ +{{ PRODE_REWARDS.champion.balones }} Balón de Oro</span>
      <span class="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 font-semibold text-slate-300">+ logro exclusivo "Profeta"</span>
    </div>

    <!-- Ya elegido -->
    <div v-if="myPick" class="rounded-xl border border-white/10 bg-black/20 p-4 text-center">
      <p class="text-xs uppercase tracking-wider text-slate-400 mb-1">
        {{ myPick.result ? (myPick.result === 'win' ? '¡Acertaste!' : 'Tu pronóstico') : 'Tu pick, sellado' }}
      </p>
      <p class="font-display text-xl font-bold text-white">{{ myPick.team_name }}</p>
      <p v-if="myPick.result === 'win'" class="mt-1 text-sm font-semibold text-emerald-300">🎉 ¡Ganaste la recompensa completa!</p>
    </div>

    <!-- Elegir -->
    <template v-else>
      <p v-if="locked" class="text-center text-sm text-slate-400">
        El pronóstico de campeón ya se bloqueó para este torneo.
      </p>
      <template v-else>
        <p class="mb-3 text-center text-xs text-slate-400">
          Se bloquea el {{ fmtDate(lockAt) }} — elegí ahora, a ciegas.
        </p>
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <button
            v-for="team in teams" :key="team.id" @click="choose(team)" :disabled="saving"
            class="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-amber-400/40 hover:bg-amber-500/10 disabled:opacity-40"
          >
            {{ team.name }}
          </button>
        </div>
      </template>
    </template>
  </div>
</template>
