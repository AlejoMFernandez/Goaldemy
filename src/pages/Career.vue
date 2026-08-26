<script setup>
/**
 * MODO CARRERA — página pública /carrera (sin login, como el Reto del día)
 *
 * Simulador de decisiones estilo Copero: creás un jugador, tomás ~12 decisiones
 * a lo largo de su carrera (con ofertas de transferencia y convocatorias reales
 * de por medio) y termina en una tarjeta de resultado compartible. El invitado
 * ve la recompensa "ganada" pero solo puede reclamarla creando una cuenta —
 * mismo muro de aversión a la pérdida que el Reto del día.
 */
import { reactive, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import {
  CAREER_SEASONS, getPositions, CAREER_NATIONS,
  startCareer, getSeasonCard, resolveSeason, isCareerOver, finalizeCareer,
  buildCareerShareText, setPendingCareerClaim,
} from '../services/career'
import { flagUrl } from '../services/countries'
import { shareOrCopy } from '../services/share'
import { getAuthUser } from '../services/auth'

const state = reactive({
  phase: 'intro', // intro | playing | result
  form: { name: '', position: 'FW', nationality: 'ar' },
  career: null,
  card: null,
  choosing: false,
  summary: null,
  shareMsg: '',
})

const positions = getPositions()
const nations = CAREER_NATIONS
const progressPct = computed(() => state.career ? Math.round((state.career.season / CAREER_SEASONS) * 100) : 0)

onMounted(() => {
  try { state.form.name = getAuthUser()?.display_name || '' } catch {}
})

function start() {
  state.career = startCareer(state.form)
  state.card = getSeasonCard(state.career)
  state.phase = 'playing'
}

function choose(key) {
  if (state.choosing) return
  state.choosing = true
  setTimeout(() => {
    state.career = resolveSeason(state.career, state.card, key)
    if (isCareerOver(state.career)) {
      state.summary = finalizeCareer(state.career)
      setPendingCareerClaim(state.summary.grade.key)
      state.phase = 'result'
    } else {
      state.card = getSeasonCard(state.career)
    }
    state.choosing = false
  }, 550)
}

async function share() {
  const text = buildCareerShareText(state.summary, getAuthUser()?.referral_code || '')
  const r = await shareOrCopy(text)
  if (r === 'copied') { state.shareMsg = '¡Copiado! Pegalo donde quieras'; setTimeout(() => state.shareMsg = '', 2400) }
  else if (r === 'shared') { state.shareMsg = '¡Gracias por compartir! 🙌'; setTimeout(() => state.shareMsg = '', 2400) }
}

function playAgain() {
  state.phase = 'intro'
  state.career = null
  state.card = null
  state.summary = null
}
</script>

<template>
  <section class="mx-auto max-w-lg px-1">

    <!-- INTRO: crear jugador -->
    <div v-if="state.phase === 'intro'" class="py-6">
      <div class="text-center mb-6">
        <div class="inline-flex items-center gap-2 rounded-full border border-violet-300/30 bg-violet-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-violet-300 mb-5">
          <span class="relative flex h-2 w-2">
            <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-300 opacity-75"></span>
            <span class="relative inline-flex h-2 w-2 rounded-full bg-violet-300"></span>
          </span>
          Modo Carrera
        </div>
        <h1 class="font-display text-4xl md:text-5xl font-bold text-white leading-tight mb-3">Viví tu carrera</h1>
        <p class="text-slate-300 text-base">{{ CAREER_SEASONS }} temporadas · decisiones que definen todo · sin cuenta</p>
      </div>

      <div class="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-5 space-y-4 shadow-2xl">
        <div>
          <label class="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1.5 block">Tu nombre de jugador</label>
          <input v-model="state.form.name" type="text" maxlength="24" placeholder="Ej: Diego Maldini"
                 class="w-full rounded-xl border border-white/10 bg-black/30 px-3.5 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-400/40" />
        </div>
        <div>
          <label class="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1.5 block">Posición</label>
          <div class="grid grid-cols-4 gap-2">
            <button v-for="p in positions" :key="p.value" @click="state.form.position = p.value"
              :class="['rounded-xl border py-2.5 text-xs font-bold transition', state.form.position === p.value ? 'border-violet-400/50 bg-violet-500/20 text-violet-200' : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]']">
              {{ p.label }}
            </button>
          </div>
        </div>
        <div>
          <label class="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1.5 block">Selección</label>
          <div class="flex flex-wrap gap-2">
            <button v-for="n in nations" :key="n.code" @click="state.form.nationality = n.code"
              :class="['flex items-center gap-1.5 rounded-full border pl-1.5 pr-3 py-1 text-xs font-semibold transition', state.form.nationality === n.code ? 'border-violet-400/50 bg-violet-500/20 text-violet-200' : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]']">
              <img :src="flagUrl(n.code)" :alt="n.name" class="w-4 h-3 rounded-sm object-cover" />
              {{ n.name }}
            </button>
          </div>
        </div>
        <button @click="start" class="w-full rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-600 hover:brightness-110 text-white py-4 text-lg font-bold transition shadow-lg shadow-violet-500/25 active:scale-[0.98]">
          Arrancar mi carrera
        </button>
      </div>
      <p class="text-slate-500 text-xs mt-6 text-center">¿Ya tenés cuenta? <RouterLink to="/login" class="text-violet-300 hover:underline">Iniciá sesión</RouterLink></p>
    </div>

    <!-- PLAYING: una decisión por temporada -->
    <div v-else-if="state.phase === 'playing' && state.card" class="py-4">
      <div class="flex items-center justify-between mb-3">
        <span class="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Temporada {{ state.career.season + 1 }} · {{ state.career.age }} años</span>
        <span class="font-display text-sm font-bold text-white">{{ state.career.season }}<span class="text-slate-500">/{{ CAREER_SEASONS }}</span></span>
      </div>
      <div class="h-1.5 rounded-full bg-black/30 overflow-hidden mb-5">
        <div class="h-full rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-500 transition-all duration-300" :style="{ width: progressPct + '%' }"></div>
      </div>

      <!-- Estado actual -->
      <div class="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 mb-4">
        <img v-if="state.career.club.logo" :src="state.career.club.logo" class="w-10 h-10 object-contain shrink-0" alt="" />
        <div class="min-w-0 flex-1">
          <p class="text-sm font-bold text-white truncate">{{ state.career.club.name }}</p>
          <p class="text-[11px] text-slate-400">{{ state.career.name }} · Rating {{ state.career.rating }}</p>
        </div>
        <div class="flex gap-3 text-center shrink-0">
          <div><div class="font-display text-sm font-bold text-emerald-400">{{ state.career.totals.goals }}</div><div class="text-[9px] text-slate-500">GOLES</div></div>
          <div><div class="font-display text-sm font-bold text-sky-400">{{ state.career.totals.assists }}</div><div class="text-[9px] text-slate-500">ASIST.</div></div>
          <div><div class="font-display text-sm font-bold text-amber-400">{{ state.career.trophies.length }}</div><div class="text-[9px] text-slate-500">TÍTULOS</div></div>
        </div>
      </div>

      <!-- Evento especial: transferencia -->
      <div v-if="state.card.type === 'transfer'" class="rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-500/10 to-slate-900 p-5 text-center mb-4">
        <img v-if="state.card.target.logo" :src="state.card.target.logo" class="w-16 h-16 object-contain mx-auto mb-3" alt="" />
        <p class="text-amber-300 text-xs uppercase tracking-wider font-bold mb-1">Oferta de transferencia</p>
        <p class="text-white text-lg font-bold mb-1">{{ state.card.target.name }} te quiere</p>
        <p class="text-slate-400 text-sm">¿Dejás {{ state.career.club.name }} por esta oportunidad?</p>
      </div>
      <!-- Evento especial: selección -->
      <div v-else-if="state.card.type === 'call_up'" class="rounded-2xl border border-sky-400/30 bg-gradient-to-br from-sky-500/10 to-slate-900 p-5 text-center mb-4">
        <img :src="flagUrl(state.career.nationality)" class="w-14 h-10 object-cover rounded mx-auto mb-3" alt="" />
        <p class="text-sky-300 text-xs uppercase tracking-wider font-bold mb-1">Convocatoria</p>
        <p class="text-white text-lg font-bold">¡Te llamaron a la Selección!</p>
      </div>
      <!-- Decisión normal -->
      <div v-else class="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-5 text-center mb-4 shadow-xl">
        <p class="text-white text-base leading-snug">{{ state.card.decision.prompt }}</p>
      </div>

      <!-- Opciones -->
      <div class="grid grid-cols-1 gap-2.5">
        <template v-if="state.card.type === 'transfer'">
          <button @click="choose('accept')" :disabled="state.choosing" class="rounded-xl border border-emerald-400/30 bg-emerald-500/10 hover:bg-emerald-500/20 py-3.5 px-4 text-left text-white font-semibold transition">Aceptar y fichar</button>
          <button @click="choose('stay')" :disabled="state.choosing" class="rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.07] py-3.5 px-4 text-left text-white font-semibold transition">Quedarme por lealtad</button>
        </template>
        <template v-else-if="state.card.type === 'call_up'">
          <button @click="choose('ok')" :disabled="state.choosing" class="rounded-xl border border-sky-400/30 bg-sky-500/10 hover:bg-sky-500/20 py-3.5 px-4 text-left text-white font-semibold transition">¡Vamos, a jugar!</button>
        </template>
        <template v-else>
          <button @click="choose('a')" :disabled="state.choosing" class="rounded-xl border border-white/10 bg-white/[0.04] hover:border-violet-400/40 hover:bg-white/[0.07] py-3.5 px-4 text-left text-white font-semibold transition active:scale-[0.98]">{{ state.card.decision.a.label }}</button>
          <button @click="choose('b')" :disabled="state.choosing" class="rounded-xl border border-white/10 bg-white/[0.04] hover:border-violet-400/40 hover:bg-white/[0.07] py-3.5 px-4 text-left text-white font-semibold transition active:scale-[0.98]">{{ state.card.decision.b.label }}</button>
        </template>
      </div>
    </div>

    <!-- RESULT -->
    <div v-else-if="state.phase === 'result'" class="py-6">
      <div class="rounded-2xl border border-white/15 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden shadow-2xl">
        <div class="px-5 py-5 text-center border-b bg-gradient-to-r from-violet-500/15 to-fuchsia-500/10 border-violet-500/25">
          <p class="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Modo Carrera · retiro a los {{ state.summary.ageRetired }} años</p>
          <h2 class="font-display text-2xl font-bold text-violet-300 mb-1">{{ state.summary.grade.label }}</h2>
          <p class="text-white font-display text-xl font-bold">{{ state.summary.name }}</p>
        </div>

        <div class="p-5 space-y-4">
          <div class="grid grid-cols-3 gap-2.5">
            <div class="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
              <div class="font-display text-xl font-bold text-emerald-400">{{ state.summary.totals.goals }}</div>
              <div class="text-[9px] uppercase tracking-wider text-slate-400 mt-0.5">Goles</div>
            </div>
            <div class="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
              <div class="font-display text-xl font-bold text-sky-400">{{ state.summary.totals.assists }}</div>
              <div class="text-[9px] uppercase tracking-wider text-slate-400 mt-0.5">Asistencias</div>
            </div>
            <div class="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
              <div class="font-display text-xl font-bold text-amber-400">{{ state.summary.trophies.length }}</div>
              <div class="text-[9px] uppercase tracking-wider text-slate-400 mt-0.5">Títulos</div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2.5">
            <div class="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
              <div class="text-[10px] uppercase tracking-wider text-slate-400 mb-0.5">Pico de rating</div>
              <div class="font-display text-lg font-bold text-white">{{ state.summary.peakRating }}</div>
            </div>
            <div class="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
              <div class="text-[10px] uppercase tracking-wider text-slate-400 mb-0.5">Valor pico</div>
              <div class="font-display text-lg font-bold text-white">€{{ state.summary.peakValueM }}M</div>
            </div>
          </div>

          <div class="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p class="text-[10px] uppercase tracking-wider text-slate-400 mb-1.5">Clubes</p>
            <p class="text-sm text-white">{{ state.summary.clubs.join(' → ') }}</p>
          </div>

          <!-- Muro de reclamo (invitado) -->
          <div v-if="!getAuthUser()?.id" class="rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-500/10 to-slate-900/40 p-5 text-center">
            <h3 class="font-display text-lg font-bold text-white mb-1">Guardá esta carrera</h3>
            <p class="text-slate-300 text-sm mb-4">
              Creá tu cuenta gratis y reclamá <strong class="text-emerald-400">+{{ state.summary.grade.xp }} XP</strong> y
              <strong class="text-amber-400">{{ state.summary.grade.fichas }} Fichas</strong>.
            </p>
            <RouterLink to="/register" class="block w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 text-slate-900 py-3 text-sm font-bold transition shadow-lg shadow-amber-500/25 mb-2">
              Crear cuenta gratis y reclamar
            </RouterLink>
            <RouterLink to="/login" class="block text-slate-400 hover:text-white text-xs">Ya tengo cuenta</RouterLink>
          </div>

          <button @click="share"
            :class="['w-full rounded-xl py-2.5 text-sm font-bold transition flex items-center justify-center gap-2', state.shareMsg ? 'bg-emerald-500/15 border border-emerald-400/40 text-emerald-300' : 'border border-white/15 text-slate-300 hover:bg-white/5']">
            {{ state.shareMsg || 'Compartir mi carrera' }}
          </button>
          <button @click="playAgain" class="w-full rounded-xl py-2.5 text-sm font-bold border border-violet-400/30 bg-violet-500/10 hover:bg-violet-500/20 text-violet-300 transition">
            Jugar otra carrera
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
