<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { getAllPlayers } from '../../services/players'
import { awardXpBatch } from '../../services/game-xp'
import AppH1 from '../../components/common/AppH1.vue'
import CircularTimer from '../../components/game/CircularTimer.vue'

// ── Formation 4-3-3 with % positions on the field ──────────────────────────
const FORMATION = [
  { id: 0,  label: 'GK',  x: 50, y: 87 },
  { id: 1,  label: 'LD',  x: 13, y: 69 },
  { id: 2,  label: 'DFC', x: 37, y: 72 },
  { id: 3,  label: 'DFC', x: 63, y: 72 },
  { id: 4,  label: 'LI',  x: 87, y: 69 },
  { id: 5,  label: 'MC',  x: 18, y: 52 },
  { id: 6,  label: 'MC',  x: 50, y: 50 },
  { id: 7,  label: 'MC',  x: 82, y: 52 },
  { id: 8,  label: 'EI',  x: 24, y: 28 },
  { id: 9,  label: 'DC',  x: 50, y: 22 },
  { id: 10, label: 'ED',  x: 76, y: 28 },
]

// ── Reactive state ─────────────────────────────────────────────────────────
const allPlayers = ref([])
const slots = ref(FORMATION.map(f => ({ ...f, filled: null })))
const activeSlot = ref(null)
const inputValue = ref('')
const constraint = ref(null)
const xpEarned = ref(0)
const finished = ref(false)
const loading = ref(true)
const TOTAL_TIME = 180
const timeLeft = ref(TOTAL_TIME)
const timeOver = ref(false)
let timerHandle = null

// ── Computed ───────────────────────────────────────────────────────────────
const validPlayers = computed(() => {
  if (!constraint.value || !allPlayers.value.length) return []
  const c = constraint.value
  if (c.type === 'team') return allPlayers.value.filter(p => p.teamId === c.id)
  if (c.type === 'league') return allPlayers.value.filter(p => p.leagueId === c.id)
  return allPlayers.value.filter(p => (p.ccode || '').toLowerCase() === c.code.toLowerCase())
})

const usedIds = computed(() =>
  slots.value.filter(s => s.filled).map(s => s.filled.id)
)

const suggestions = computed(() => {
  const raw = inputValue.value.trim()
  if (raw.length < 2) return []
  const q = raw.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
  return validPlayers.value
    .filter(p => !usedIds.value.includes(p.id))
    .filter(p => {
      const n = p.name.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
      return n.includes(q)
    })
    .slice(0, 8)
})

const filledCount = computed(() => slots.value.filter(s => s.filled).length)

// ── Constraint generator ───────────────────────────────────────────────────
const LEAGUE_INFO = {
  47: { name: 'Premier League', logo: 'https://images.fotmob.com/image_resources/logo/leaguelogo/47.png' },
  87: { name: 'La Liga', logo: 'https://images.fotmob.com/image_resources/logo/leaguelogo/87.png' },
  55: { name: 'Serie A', logo: 'https://images.fotmob.com/image_resources/logo/leaguelogo/55.png' },
  54: { name: 'Bundesliga', logo: 'https://images.fotmob.com/image_resources/logo/leaguelogo/54.png' },
  53: { name: 'Ligue 1', logo: 'https://images.fotmob.com/image_resources/logo/leaguelogo/53.png' },
}

function generateConstraint() {
  const players = allPlayers.value
  if (!players.length) return

  const roll = Math.random()

  if (roll < 0.4) {
    const byTeam = {}
    players.forEach(p => {
      if (!byTeam[p.teamId]) byTeam[p.teamId] = { id: p.teamId, name: p.teamName, logo: p.teamLogo, count: 0 }
      byTeam[p.teamId].count++
    })
    const eligible = Object.values(byTeam).filter(t => t.count >= 11)
    if (eligible.length) {
      const t = eligible[Math.floor(Math.random() * eligible.length)]
      constraint.value = { type: 'team', id: t.id, label: t.name, logo: t.logo }
      return
    }
  }

  if (roll < 0.7) {
    const byNat = {}
    players.forEach(p => {
      const code = (p.ccode || '').toLowerCase()
      if (!code) return
      if (!byNat[code]) byNat[code] = { code, name: p.cname, count: 0 }
      byNat[code].count++
    })
    const eligible = Object.values(byNat).filter(n => n.count >= 11)
    if (eligible.length) {
      const n = eligible[Math.floor(Math.random() * eligible.length)]
      constraint.value = { type: 'nationality', code: n.code, label: n.name, flag: `https://flagcdn.com/w80/${n.code}.png` }
      return
    }
  }

  const byLeague = {}
  players.forEach(p => {
    const lid = p.leagueId
    if (!lid || !LEAGUE_INFO[lid]) return
    if (!byLeague[lid]) byLeague[lid] = { id: lid, ...LEAGUE_INFO[lid], count: 0 }
    byLeague[lid].count++
  })
  const eligible = Object.values(byLeague).filter(l => l.count >= 11)
  if (eligible.length) {
    const l = eligible[Math.floor(Math.random() * eligible.length)]
    constraint.value = { type: 'league', id: l.id, label: l.name, logo: l.logo }
    return
  }

  const byNat = {}
  players.forEach(p => {
    const code = (p.ccode || '').toLowerCase()
    if (!code) return
    if (!byNat[code]) byNat[code] = { code, name: p.cname, count: 0 }
    byNat[code].count++
  })
  const natEligible = Object.values(byNat).filter(n => n.count >= 11)
  if (natEligible.length) {
    const n = natEligible[Math.floor(Math.random() * natEligible.length)]
    constraint.value = { type: 'nationality', code: n.code, label: n.name, flag: `https://flagcdn.com/w80/${n.code}.png` }
  }
}

// ── Interactions ───────────────────────────────────────────────────────────
function selectSlot(id) {
  if (timeOver.value || finished.value) return
  if (slots.value[id]?.filled) return
  activeSlot.value = activeSlot.value === id ? null : id
  inputValue.value = ''
}

function pickPlayer(player) {
  if (timeOver.value || finished.value) return
  const idx = activeSlot.value
  if (idx === null || slots.value[idx]?.filled) return
  slots.value[idx].filled = player
  xpEarned.value += 10
  activeSlot.value = null
  inputValue.value = ''
  if (slots.value.every(s => s.filled)) {
    finished.value = true
    clearInterval(timerHandle)
    awardXpBatch({ gameCode: 'once-ideal', totalXp: xpEarned.value, corrects: 11 }).catch(() => {})
  }
}

function startTimer() {
  clearInterval(timerHandle)
  timeLeft.value = TOTAL_TIME
  timeOver.value = false
  timerHandle = setInterval(() => {
    if (timeLeft.value > 0) timeLeft.value--
    if (timeLeft.value <= 0) {
      timeOver.value = true
      clearInterval(timerHandle)
    }
  }, 1000)
}

function resetGame() {
  slots.value = FORMATION.map(f => ({ ...f, filled: null }))
  activeSlot.value = null
  inputValue.value = ''
  xpEarned.value = 0
  finished.value = false
  timeOver.value = false
  generateConstraint()
  startTimer()
}

function changeConstraint() {
  if (filledCount.value > 0 && !confirm('¿Querés cambiar el desafío? Perderás tu progreso actual.')) return
  resetGame()
}

onMounted(() => {
  allPlayers.value = getAllPlayers()
  generateConstraint()
  loading.value = false
  startTimer()
})

onUnmounted(() => clearInterval(timerHandle))
</script>

<template>
  <section class="min-h-[calc(100dvh-4rem)] px-4 py-6 max-w-2xl mx-auto">
    <!-- Header -->
    <div class="flex items-center justify-between mb-5">
      <AppH1 class="text-2xl md:text-3xl shrink-0">Once Ideal</AppH1>
      <router-link to="/play/free" class="rounded-full border border-white/15 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/5 transition">
        ← Volver
      </router-link>
    </div>

    <!-- Constraint card -->
    <div v-if="constraint && !loading" class="mb-4 rounded-2xl border border-white/10 bg-slate-800/50 backdrop-blur px-5 py-4 flex items-center gap-4">
      <img v-if="constraint.logo" :src="constraint.logo" class="w-12 h-12 object-contain flex-shrink-0" />
      <img v-else-if="constraint.flag" :src="constraint.flag" class="h-9 rounded shadow flex-shrink-0" />
      <div class="flex-1 min-w-0">
        <p class="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">
          {{ constraint.type === 'team' ? '⚽ Equipo' : constraint.type === 'league' ? '🏟️ Liga' : '🏴 Selección' }}
        </p>
        <p class="text-lg font-bold text-white truncate">{{ constraint.label }}</p>
        <p class="text-xs text-slate-400">{{ validPlayers.length }} jugadores disponibles</p>
      </div>
      <div class="flex flex-col items-center gap-1 flex-shrink-0">
        <CircularTimer :seconds="Math.max(0, timeLeft)" :total="TOTAL_TIME" />
        <div class="text-2xl font-bold text-cyan-400">{{ filledCount }}<span class="text-slate-500 text-base">/11</span></div>
      </div>
    </div>

    <!-- Field -->
    <div class="relative w-full aspect-[3/4] max-w-sm mx-auto rounded-2xl overflow-hidden shadow-2xl mb-4"
         style="background: linear-gradient(180deg, #064e3b 0%, #065f46 40%, #064e3b 100%);
                background-image: repeating-linear-gradient(0deg, transparent, transparent 58px, rgba(255,255,255,0.03) 58px, rgba(255,255,255,0.03) 59px);">
      <!-- Field lines -->
      <div class="absolute inset-0 m-5 border border-white/10 rounded pointer-events-none"></div>
      <div class="absolute top-1/2 left-5 right-5 border-t border-white/10 pointer-events-none"></div>
      <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full border border-white/10 pointer-events-none"></div>
      <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white/20 pointer-events-none"></div>
      <!-- Penalty boxes -->
      <div class="absolute bottom-5 left-1/2 -translate-x-1/2 w-[55%] h-[18%] border border-white/10 pointer-events-none"></div>
      <div class="absolute top-5 left-1/2 -translate-x-1/2 w-[55%] h-[18%] border border-white/10 pointer-events-none"></div>

      <!-- Position slots -->
      <button
        v-for="slot in slots"
        :key="slot.id"
        @click="selectSlot(slot.id)"
        class="absolute transition-all duration-150 focus:outline-none"
        :style="{ left: slot.x + '%', top: slot.y + '%', transform: 'translate(-50%,-50%)' }"
      >
        <!-- Filled slot -->
        <div v-if="slot.filled" class="flex flex-col items-center gap-0.5">
          <div class="w-10 h-10 rounded-full overflow-hidden ring-2 ring-cyan-400/70 shadow-lg shadow-black/60">
            <img :src="slot.filled.image" class="w-full h-full object-cover object-top bg-slate-800"
                 @error="e => e.target.src = '/placeholder-player.png'" />
          </div>
          <div class="bg-slate-950/85 backdrop-blur px-1.5 py-0.5 rounded text-[9px] font-bold text-white max-w-[64px] truncate shadow">
            {{ slot.filled.name.split(' ').pop() }}
          </div>
        </div>

        <!-- Empty slot -->
        <div v-else class="flex items-center justify-center rounded-lg border font-bold text-[11px] tracking-wide select-none transition-all"
             :class="activeSlot === slot.id
               ? 'w-14 h-9 bg-cyan-500/30 border-cyan-400 text-cyan-200 scale-110 shadow-lg shadow-cyan-500/30'
               : 'w-12 h-8 bg-slate-900/55 border-white/20 text-slate-300 hover:border-white/50 hover:bg-slate-800/60 hover:scale-105'">
          {{ slot.label }}
        </div>
      </button>
    </div>

    <!-- Time over -->
    <div v-if="timeOver && !finished" class="mb-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5 text-center">
      <div class="text-3xl mb-2">⏱️</div>
      <h3 class="text-lg font-bold text-amber-300 mb-1">¡Se acabó el tiempo!</h3>
      <p class="text-slate-300 text-sm mb-1">Llenaste <span class="font-bold text-white">{{ filledCount }}/11</span> posiciones</p>
      <p v-if="xpEarned > 0" class="text-slate-400 text-sm mb-4">+<span class="text-cyan-400 font-bold">{{ xpEarned }} XP</span> ganados</p>
      <button @click="resetGame" class="rounded-xl bg-[oklch(0.62_0.21_270)] hover:brightness-110 px-5 py-2.5 font-semibold text-white transition">
        Intentar de nuevo
      </button>
    </div>

    <!-- Input panel (when a slot is active) -->
    <div v-if="!finished && !timeOver" class="rounded-2xl border border-white/10 bg-slate-800/50 backdrop-blur p-4 min-h-[90px]">
      <template v-if="activeSlot !== null">
        <p class="text-xs text-slate-400 uppercase tracking-wider mb-2">
          Escribí un jugador para
          <span class="text-cyan-400 font-bold">{{ slots[activeSlot]?.label }}</span>
          <span class="text-slate-500 ml-1">({{ constraint?.label }})</span>
        </p>
        <div class="relative">
          <input
            v-model="inputValue"
            type="text"
            placeholder="Nombre del jugador..."
            autofocus
            class="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
          />
          <!-- Autocomplete suggestions -->
          <div v-if="suggestions.length > 0"
               class="absolute z-20 mt-1 w-full rounded-xl border border-white/10 bg-slate-900/97 backdrop-blur-md shadow-2xl overflow-hidden">
            <button
              v-for="p in suggestions"
              :key="p.id"
              @click.prevent="pickPlayer(p)"
              class="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/10 transition-colors text-left"
            >
              <img :src="p.image" class="w-8 h-8 rounded-full object-cover bg-slate-700 flex-shrink-0"
                   @error="e => e.target.style.opacity='0'" />
              <div class="flex-1 min-w-0">
                <div class="text-sm text-white font-semibold truncate">{{ p.name }}</div>
                <div class="text-xs text-slate-400 truncate">{{ p.teamName }}</div>
              </div>
              <img v-if="p.ccode" :src="`https://flagcdn.com/w20/${p.ccode.toLowerCase()}.png`"
                   class="w-5 h-3.5 rounded-sm flex-shrink-0 object-cover" />
            </button>
          </div>
          <!-- No matches -->
          <div v-else-if="inputValue.length >= 2"
               class="absolute z-20 mt-1 w-full rounded-xl border border-white/10 bg-slate-900/97 backdrop-blur px-4 py-3 text-sm text-slate-400">
            Sin resultados — el jugador debe ser del {{ constraint?.type === 'team' ? 'equipo' : 'país' }} elegido
          </div>
        </div>
      </template>
      <template v-else>
        <div class="flex items-center justify-center h-full py-2 text-slate-400 text-sm gap-2">
          <span class="text-lg">👆</span>
          Tocá una posición para elegir jugador
        </div>
      </template>
    </div>

    <!-- Finished -->
    <div v-if="finished" class="mt-4 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 p-6 text-center">
      <div class="text-5xl mb-3">🏆</div>
      <h2 class="text-2xl font-bold text-emerald-400 mb-1">¡Once Ideal Completo!</h2>
      <p class="text-slate-300 mb-2">
        Armaste el once de
        <span class="font-bold text-white">{{ constraint?.label }}</span>
      </p>
      <p class="text-slate-400 text-sm mb-5">
        +<span class="text-cyan-400 font-bold">{{ xpEarned }} XP</span> ganados
      </p>
      <div class="flex gap-3 justify-center flex-wrap">
        <button @click="resetGame"
                class="rounded-xl bg-[oklch(0.62_0.21_270)] hover:brightness-110 px-5 py-2.5 font-semibold text-white transition">
          Nuevo desafío
        </button>
        <router-link to="/play/free"
                     class="rounded-xl border border-white/20 hover:bg-white/5 px-5 py-2.5 font-semibold text-white transition">
          Volver a juegos
        </router-link>
      </div>
    </div>

    <!-- Change constraint button -->
    <div v-if="!finished" class="mt-3 text-center">
      <button @click="changeConstraint"
              class="text-xs text-slate-500 hover:text-slate-300 transition underline underline-offset-2">
        Cambiar desafío
      </button>
    </div>
  </section>
</template>
