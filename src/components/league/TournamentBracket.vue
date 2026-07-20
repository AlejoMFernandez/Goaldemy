<script>
/**
 * TOURNAMENT BRACKET
 *
 * Renderiza la fase de eliminación de cualquier torneo a partir del array de
 * partidos que devuelve fotmob.getAllMatches() (cada match trae `round`
 * = roundName, home/away + status).
 *
 * Es agnóstico del torneo: detecta las rondas de eliminación por su nombre y
 * las ordena (16avos → octavos → cuartos → semis → final). Los partidos de
 * fase de grupos (round numérico o "Group X") se ignoran.
 *
 * Uso:
 *   <TournamentBracket :matches="leagueData.allMatches" />
 * Exponé `hasKnockout` vía v-if del padre chequeando el mismo array, o
 * simplemente montalo: si no hay eliminación, no renderiza nada.
 */

// Detecta la ronda de eliminación y devuelve { key, label, order } o null (grupo)
function classifyRound(roundName) {
  const raw = (roundName ?? '').toString().trim()
  if (!raw) return null
  const n = raw.toLowerCase()

  // Fase de grupos: número puro, "matchday N", o "group X"
  if (/^\d+$/.test(raw)) return null
  if (/\bgroup\b|\bgrupo\b|matchday|jornada|fecha/.test(n)) return null

  if (/third|3rd|tercer|bronze|bronce/.test(n)) return { key: 'third', label: 'Tercer puesto', order: 89 }
  if (n === 'final' || /\bfinal\b/.test(n) && !/semi|quarter|1\/|round of/.test(n)) return { key: 'final', label: 'Final', order: 90 }
  if (/semi/.test(n)) return { key: 'sf', label: 'Semifinales', order: 5 }
  if (/quarter|cuarto/.test(n)) return { key: 'qf', label: 'Cuartos de final', order: 4 }
  if (/round of 16|\bof 16\b|octavos|1\/8/.test(n)) return { key: 'r16', label: 'Octavos de final', order: 3 }
  if (/round of 32|\bof 32\b|16avos|1\/16/.test(n)) return { key: 'r32', label: '16avos de final', order: 2 }
  if (/round of 64|\bof 64\b|1\/32/.test(n)) return { key: 'r64', label: '32avos de final', order: 1 }
  if (/play.?off|repechaje|preliminar|qualif/.test(n)) return { key: 'po', label: raw, order: 0 }

  // Otra ronda con nombre no numérico: la tratamos como eliminación con su nombre
  return { key: `x-${n}`, label: raw, order: 50 }
}

function parseScore(scoreStr) {
  if (!scoreStr) return null
  const m = scoreStr.toString().match(/(\d+)\s*[-–]\s*(\d+)/)
  if (!m) return null
  return [parseInt(m[1], 10), parseInt(m[2], 10)]
}

export default {
  name: 'TournamentBracket',
  props: {
    matches: { type: Array, default: () => [] },
  },
  computed: {
    // Rondas de eliminación ordenadas, con el 3er puesto separado
    rounds() {
      const buckets = new Map()
      for (const m of this.matches || []) {
        const cls = classifyRound(m.round)
        if (!cls || cls.key === 'third') continue
        if (!buckets.has(cls.key)) buckets.set(cls.key, { ...cls, matches: [] })
        buckets.get(cls.key).matches.push(m)
      }
      const arr = [...buckets.values()]
      arr.sort((a, b) => a.order - b.order)
      for (const r of arr) r.matches.sort((a, b) => new Date(a.time) - new Date(b.time))
      return arr
    },
    thirdPlace() {
      for (const m of this.matches || []) {
        const cls = classifyRound(m.round)
        if (cls?.key === 'third') return m
      }
      return null
    },
    hasKnockout() {
      return this.rounds.some(r => r.matches.length > 0)
    },
  },
  methods: {
    logo(id) { return `https://images.fotmob.com/image_resources/logo/teamlogo/${id}.png` },
    onImgError(e) { e.target.style.visibility = 'hidden' },
    scoreOf(m) { return m?.status?.score || '' },
    // 'home' | 'away' | null
    winnerSide(m) {
      if (!m?.status?.finished) return null
      const s = parseScore(m.status.score)
      if (!s) return null
      if (s[0] > s[1]) return 'home'
      if (s[1] > s[0]) return 'away'
      return null // empate en 90' (definido por penales, no siempre parseable)
    },
    sideScore(m, side) {
      const s = parseScore(this.scoreOf(m))
      if (!s) return ''
      return side === 'home' ? s[0] : s[1]
    },
    matchTime(m) {
      if (!m?.time) return ''
      try { return new Date(m.time).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }) }
      catch { return '' }
    },
    isLive(m) { return !!(m?.status?.started && !m?.status?.finished) },
  },
}
</script>

<template>
  <div v-if="hasKnockout" class="tb-wrap">
    <div class="tb-scroll overflow-x-auto pb-2">
      <div class="tb-grid flex gap-4 min-w-max">
        <div v-for="round in rounds" :key="round.key" class="tb-col flex flex-col" :style="{ minWidth: '230px' }">
          <!-- Round header -->
          <div class="mb-3 flex items-center gap-2">
            <span class="h-4 w-1 rounded-full bg-gradient-to-b from-emerald-400 to-cyan-400"></span>
            <span class="text-[11px] font-bold uppercase tracking-wider text-slate-300">{{ round.label }}</span>
            <span class="ml-auto text-[10px] text-slate-600">{{ round.matches.length }}</span>
          </div>

          <!-- Matches, distributed to read as a bracket -->
          <div class="flex flex-1 flex-col justify-around gap-3">
            <div
              v-for="m in round.matches"
              :key="m.id"
              class="tb-match relative rounded-xl border border-white/10 bg-slate-900/70 p-2.5 shadow-lg transition hover:border-emerald-400/30"
            >
              <!-- home -->
              <div class="flex items-center gap-2" :class="winnerSide(m) === 'away' ? 'opacity-45' : ''">
                <img :src="logo(m.homeTeamId)" :alt="m.homeTeam" class="h-5 w-5 flex-none object-contain" @error="onImgError" />
                <span class="min-w-0 flex-1 truncate text-sm" :class="winnerSide(m) === 'home' ? 'font-bold text-white' : 'font-medium text-slate-200'">{{ m.homeTeam }}</span>
                <span class="tabular-nums text-sm font-bold" :class="winnerSide(m) === 'home' ? 'text-emerald-300' : 'text-slate-400'">{{ sideScore(m, 'home') }}</span>
              </div>
              <div class="my-1.5 h-px bg-white/5"></div>
              <!-- away -->
              <div class="flex items-center gap-2" :class="winnerSide(m) === 'home' ? 'opacity-45' : ''">
                <img :src="logo(m.awayTeamId)" :alt="m.awayTeam" class="h-5 w-5 flex-none object-contain" @error="onImgError" />
                <span class="min-w-0 flex-1 truncate text-sm" :class="winnerSide(m) === 'away' ? 'font-bold text-white' : 'font-medium text-slate-200'">{{ m.awayTeam }}</span>
                <span class="tabular-nums text-sm font-bold" :class="winnerSide(m) === 'away' ? 'text-emerald-300' : 'text-slate-400'">{{ sideScore(m, 'away') }}</span>
              </div>

              <!-- footer: estado / fecha -->
              <div class="mt-1.5 flex items-center justify-center">
                <span v-if="isLive(m)" class="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-300 animate-pulse">En vivo</span>
                <span v-else-if="!m.status.finished" class="text-[10px] font-medium text-slate-500">{{ matchTime(m) || 'A definir' }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 3er puesto (aparte) -->
    <div v-if="thirdPlace" class="mt-4 flex items-center gap-3 rounded-xl border border-amber-400/20 bg-amber-500/[0.05] px-3 py-2.5">
      <span class="text-[10px] font-bold uppercase tracking-wider text-amber-300/80">Tercer puesto</span>
      <div class="flex flex-1 items-center justify-center gap-2 text-sm">
        <span class="font-medium text-slate-200">{{ thirdPlace.homeTeam }}</span>
        <span class="tabular-nums font-bold text-white">{{ scoreOf(thirdPlace) || 'vs' }}</span>
        <span class="font-medium text-slate-200">{{ thirdPlace.awayTeam }}</span>
      </div>
    </div>
  </div>
</template>
