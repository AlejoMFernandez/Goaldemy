<script>
import AppH1 from '../../components/AppH1.vue'
import { initState, loadPlayers, nextRound, submitGuess, blurForLives, posLabel, countryFlag, teamLogo } from '../../services/guess-player-typing'
import { initScoring } from '../../services/scoring'
import { getUserLevel } from '../../services/xp'
import { isChallengeAvailable, startChallengeSession, completeChallengeSession } from '../../services/game-modes'

export default {
  name: 'WhoIs',
  components: { AppH1 },
  data() {
    return { 
  ...initState(), 
  ...initScoring(20),
      mode: 'normal',
      overlayOpen: false,
      sessionId: null,
      availability: { available: true, reason: null },
      showSummary: false,
      lifetimeMaxStreak: 0,
  // XP progress summary
  levelBefore: null,
  levelAfter: null,
  xpBeforeTotal: 0,
  xpAfterTotal: 0,
  beforePercent: 0,
  afterPercent: 0,
  progressShown: 0,
  xpToNextAfter: null,
    }
  },
  mounted() {
    const mode = (this.$route.query.mode || '').toString().toLowerCase()
    if (mode === 'free') this.mode = 'free'
    else if (mode === 'challenge') this.mode = 'challenge'
    else this.mode = 'normal'

    if (this.mode === 'free') this.allowXp = false

    loadPlayers(this)
    nextRound(this)

    if (this.mode === 'challenge') {
      this.overlayOpen = true
      this.checkAvailability()
    }
  },
  methods: {
    nextRound() { nextRound(this) },
    backPath() { return this.mode === 'free' ? '/play/free' : '/play/points' },
    async submit() {
      const ok = await submitGuess(this, this.$refs.confettiHost)
      if (this.mode === 'challenge' && (ok || this.lives === 0)) {
        try {
          const result = ok ? 'win' : 'loss'
          await completeChallengeSession(this.sessionId, this.score, this.xpEarned, { result, maxStreak: this.maxStreak })
        } catch (e) { console.error('[WhoIs complete]', e) }
        // fetch xp/level after
        try {
          const { data } = await getUserLevel(null)
          const info = Array.isArray(data) ? data[0] : data
          this.levelAfter = info?.level ?? null
          this.xpAfterTotal = info?.xp_total ?? 0
          const next = info?.next_level_xp || 0
          const toNext = info?.xp_to_next ?? 0
          const completed = next ? (next - toNext) : next
          this.afterPercent = next ? Math.max(0, Math.min(100, Math.round((completed / next) * 100))) : 100
          this.xpToNextAfter = toNext ?? null
        } catch {}
        this.progressShown = this.beforePercent
        this.showSummary = true
        requestAnimationFrame(() => setTimeout(() => { this.progressShown = this.afterPercent }, 40))
        // fetch lifetime for summary
        try { const mod = await import('../../services/game-modes'); const v = await mod.fetchLifetimeMaxStreak('who-is'); this.lifetimeMaxStreak = Math.max(v || 0, this.maxStreak || 0) } catch(_) {}
        return
      }
      if (ok || this.lives === 0) {
        setTimeout(() => this.nextRound(), 1000)
      }
    },
    blurPx() { return blurForLives(this.lives) },
    posBadge() { return this.current ? posLabel(this.current) : '' },
    flagSrc() { return this.current ? countryFlag(this.current, 40) : '' },
    teamLogo() { return this.current ? teamLogo(this.current) : '' },
    async checkAvailability() { this.availability = await isChallengeAvailable('who-is') },
    async startChallenge() {
      if (!this.availability.available) return
      try {
        // capture level/xp before
        try {
          const { data } = await getUserLevel(null)
          const info = Array.isArray(data) ? data[0] : data
          this.levelBefore = info?.level ?? null
          this.xpBeforeTotal = info?.xp_total ?? 0
          const next = info?.next_level_xp || 0
          const toNext = info?.xp_to_next ?? 0
          const completed = next ? (next - toNext) : next
          this.beforePercent = next ? Math.max(0, Math.min(100, Math.round((completed / next) * 100))) : 100
        } catch {}
        this.sessionId = await startChallengeSession('who-is', null)
        this.overlayOpen = false
      } catch (e) {
        console.error('[WhoIs challenge start]', e)
      }
    }
  }
}
</script>

<template>
  <section class="grid place-items-center">
    <div class="space-y-3 w-full max-w-4xl">
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <AppH1 class="text-2xl md:text-4xl mb-1 sm:mb-0">¿Quién es?</AppH1>
        <div class="flex items-center gap-2 self-stretch sm:self-auto">
          <router-link :to="backPath()" class="rounded-full border border-white/15 px-2 py-1 text-xs sm:text-sm text-slate-200 hover:bg-white/5">← Volver</router-link>
          <div class="rounded-xl bg-slate-900/60 border border-white/15 px-2.5 py-1.5 flex items-center gap-2">
            <span class="text-slate-300 text-[10px] uppercase tracking-wider">Puntaje</span>
            <span class="text-white font-extrabold text-base sm:text-lg leading-none whitespace-nowrap">{{ score }}/{{ attempts * (pointsPerCorrect || 10) }}</span>
          </div>
          <div v-if="streak > 0" class="rounded-full border border-green-500/60 bg-green-500/10 text-green-300 text-[11px] sm:text-xs px-2 py-0.5 sm:px-2.5 sm:py-1 font-semibold">
            ×{{ streak }}
          </div>
        </div>
      </div>

      <div v-if="loading" class="text-slate-300">Cargando…</div>
      <div v-else class="relative card p-4">
        <div ref="confettiHost" class="pointer-events-none absolute inset-0 overflow-hidden"></div>
        <Transition name="round-fade" mode="out-in">
          <div :key="roundKey">
            <div class="flex flex-col items-center gap-2">
              <p class="text-slate-200 text-center text-base">¿Quién es este jugador?</p>
              <div class="flex items-center gap-2 text-xs">
                <span class="rounded-full border border-white/15 bg-white/5 text-slate-200 px-2 py-0.5">{{ posBadge() }}</span>
                <img v-if="flagSrc()" :src="flagSrc()" alt="flag" width="28" height="20" class="rounded ring-1 ring-white/10" style="aspect-ratio: 20/14;" />
                <img v-if="teamLogo()" :src="teamLogo()" alt="team" width="22" height="22" class="rounded-sm ring-1 ring-white/10 object-cover" />
              </div>
              <img v-if="current" :src="current.image" :alt="current.name" :style="{ filter: `blur(${blurPx()}px)` }" class="mb-3 w-32 h-32 sm:w-36 sm:h-36 object-cover rounded-lg" />
            </div>

            <form class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-2" @submit.prevent="submit">
              <input v-model="guess" :disabled="answered" type="text" placeholder="Escribe al menos 3 letras" class="flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-white/20" />
              <button type="submit" :disabled="answered || (guess?.length || 0) < 3" class="rounded-lg border border-white/15 bg-white/10 text-slate-100 px-3 py-2 disabled:opacity-50">Adivinar</button>
            </form>

            <div class="mt-2 text-xs text-slate-300 flex items-center gap-2">
              <span class="uppercase tracking-wide">Vidas:</span>
              <div class="flex gap-1">
                <span :class="['h-2.5 w-2.5 rounded-full', lives >= 1 ? 'bg-red-400' : 'bg-white/15']"></span>
                <span :class="['h-2.5 w-2.5 rounded-full', lives >= 2 ? 'bg-red-400' : 'bg-white/15']"></span>
                <span :class="['h-2.5 w-2.5 rounded-full', lives >= 3 ? 'bg-red-400' : 'bg-white/15']"></span>
              </div>
            </div>

            <div v-if="answered && lives === 0" class="mt-2 text-slate-300 text-sm">Era <strong class="text-white">{{ current?.name }}</strong></div>
          </div>
        </Transition>
        <!-- Challenge overlay (no timer for typing game) -->
        <div v-if="overlayOpen" class="absolute inset-0 z-20 grid place-items-center bg-slate-900/80 backdrop-blur rounded-xl">
          <div class="w-full max-w-md rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/95 to-slate-900/80 p-5 shadow-2xl">
            <h3 class="text-white text-xl font-semibold">Desafío diario</h3>
            <p class="text-slate-300 text-sm mt-1">Acierto único: tenés una sola oportunidad hoy.</p>
            <ul class="mt-3 text-xs text-slate-400 space-y-1 list-disc list-inside">
              <li>Escribe el nombre del jugador</li>
              <li>3 vidas para pedir pistas con menos blur</li>
              <li>Ganar hoy suma a tu racha diaria</li>
            </ul>
            <div class="mt-4 flex items-center justify-end gap-2">
              <span class="text-xs text-slate-400" v-if="!availability.available">{{ availability.reason }}</span>
              <button @click="startChallenge" :disabled="!availability.available" class="rounded-full bg-[oklch(0.62_0.21_270)] hover:brightness-110 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed">¡Jugar!</button>
            </div>
          </div>
        </div>
        <!-- End-of-game summary with XP progress -->
        <div v-if="showSummary" class="absolute inset-0 z-30 grid place-items-center bg-slate-900/80 backdrop-blur rounded-xl">
          <div class="w-full max-w-md rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/95 to-slate-900/80 p-5 shadow-2xl text-center">
            <h3 class="text-white text-xl font-semibold mb-1">Resultado del desafío</h3>
            <p class="text-slate-300 text-sm mb-3">Así quedaste hoy.</p>
            <div class="grid grid-cols-3 gap-2 mb-4">
              <div class="rounded-lg bg-white/5 border border-white/10 p-2">
                <div class="text-[10px] uppercase tracking-wider text-slate-400">Puntaje</div>
                <div class="text-white font-bold text-lg">{{ score }}</div>
              </div>
              <div class="rounded-lg bg-white/5 border border-white/10 p-2">
                <div class="text-[10px] uppercase tracking-wider text-slate-400">Racha hoy</div>
                <div class="text-emerald-300 font-bold text-lg">×{{ maxStreak || 0 }}</div>
              </div>
              <div class="rounded-lg bg-white/5 border border-white/10 p-2">
                <div class="text-[10px] uppercase tracking-wider text-slate-400">Histórica</div>
                <div class="text-indigo-300 font-bold text-lg">×{{ lifetimeMaxStreak || 0 }}</div>
              </div>
            </div>
            <div class="text-left">
              <div class="flex items-center justify-between text-xs text-slate-400">
                <span>Progreso de XP</span>
                <span class="tabular-nums">{{ xpBeforeTotal }} → <span class="text-white font-semibold">{{ xpAfterTotal }}</span> <span class="text-emerald-300">(+{{ Math.max(0, (xpAfterTotal - xpBeforeTotal) || 0) }})</span></span>
              </div>
              <div class="mt-1 h-2 rounded-full bg-white/10 overflow-hidden">
                <div class="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400 transition-all duration-700" :style="{ width: (progressShown||0) + '%' }"></div>
              </div>
              <div class="mt-1 text-xs text-slate-400">Nivel {{ levelBefore ?? '—' }} → <span :class="(levelAfter||0)>(levelBefore||0)?'text-yellow-300 font-semibold':'text-slate-300'">{{ levelAfter ?? '—' }}</span>
                <span v-if="(xpToNextAfter ?? null) !== null" class="ml-2">Te faltan <span class="text-white font-medium">{{ xpToNextAfter }}</span> XP para el próximo nivel.</span>
              </div>
            </div>
            <div class="mt-4 flex justify-center">
              <router-link to="/play/points" class="rounded-full bg-[oklch(0.62_0.21_270)] hover:brightness-110 text-white px-4 py-2">Volver a los juegos</router-link>
            </div>
          </div>
        </div>
        <div v-if="timeOver && mode==='challenge'" class="mt-3 text-center text-amber-300 text-sm">Tiempo agotado. ¡Buen intento!</div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.round-fade-enter-active, .round-fade-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}
.round-fade-enter-from, .round-fade-leave-to {
  opacity: 0;
  transform: translateY(6px) scale(0.99);
}

/* reserved for game local styles */
</style>
