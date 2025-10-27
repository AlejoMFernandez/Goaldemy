<script>
import AppH1 from '../../components/AppH1.vue'
import { initState, loadPlayers, nextRound, submitGuess, blurForLives, posLabel, countryFlag, teamLogo } from '../../services/guess-player-typing'
import { initScoring, GAME_SCORING } from '../../services/scoring'
import { getUserLevel } from '../../services/xp'
import { isChallengeAvailable, startChallengeSession, completeChallengeSession } from '../../services/game-modes'
import { gameSummaryBlurb } from '../../services/games'

export default {
  name: 'WhoIs',
  components: { AppH1 },
  data() {
    return { 
  ...initState(), 
  ...initScoring(GAME_SCORING['who-is']?.pointsPerCorrect || 50),
      mode: 'normal',
      reviewMode: false,
      overlayOpen: false,
      sessionId: null,
      availability: { available: true, reason: null },
      showSummary: false,
      lifetimeMaxStreak: 0,
  // UI extras
  suggestOpen: false,
      selectedIndex: -1,
      revealImage: false,
      justPicked: false,
  lastResultOk: false,
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
  computed: {
    // Suggestions after 3+ chars, up to 12
    suggestions() {
      const q = (this.guess || '').toString().trim()
      if (!q || q.length < 3) return []
      const nq = q.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
      const arr = this.allPlayers || []
      const out = []
      const seen = new Set()
      for (const p of arr) {
        const n = (p?.name || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
        if (n.includes(nq)) {
          const key = n
          if (!seen.has(key)) { seen.add(key); out.push(p) }
        }
        if (out.length >= 12) break
      }
      return out
    }
  },
  watch: {},
  mounted() {
    const mode = (this.$route.query.mode || '').toString().toLowerCase()
    if (mode === 'free') this.mode = 'free'
    else if (mode === 'challenge') this.mode = 'challenge'
    else if (mode === 'review') { this.mode = 'challenge'; this.reviewMode = true }
    else this.mode = 'normal'

    if (this.mode === 'free') this.allowXp = false

    loadPlayers(this)
    nextRound(this)

    if (this.reviewMode) {
      import('../../services/game-modes').then(async (mod) => {
        const last = await mod.fetchTodayLastSession('who-is')
        if (last) {
          const m = last.metadata || {}
          this.showSummary = true
          this.levelBefore = null
          this.xpBeforeTotal = 0
          this.levelAfter = null
          this.xpAfterTotal = 0
          this.progressShown = 0
          this.maxStreak = Number(m.maxStreak || 0)
          // Lifetime best streak in review
          try { this.lifetimeMaxStreak = Math.max(await mod.fetchLifetimeMaxStreak('who-is') || 0, this.maxStreak || 0) } catch {}
          // Show the exact player that was played today
          try {
            if (!this.allPlayers || !this.allPlayers.length) { loadPlayers(this) }
            const p = (this.allPlayers || []).find(pl => pl.id === m.playerId)
            if (p) { this.current = p; this.revealImage = true; this.answered = true }
          } catch {}
        }
      }).catch(()=>{})
    } else if (this.mode === 'challenge') {
      this.overlayOpen = true
      this.checkAvailability()
    }
  },
  methods: {
    nextRound() {
      // Ensure the new round starts blurred again
      this.revealImage = false
      nextRound(this)
    },
    blurb() { return gameSummaryBlurb('who-is') },
    backPath() { return this.mode === 'free' ? '/play/free' : '/play/points' },
    chooseSuggestion(p) {
      if (!p) return
      this.guess = p.name || ''
      this.suggestOpen = false
      this.selectedIndex = -1
      this.justPicked = true
    },
    moveSelection(dir) {
      const n = this.suggestions.length
      if (!n) return
      if (this.selectedIndex < 0) this.selectedIndex = 0
      else this.selectedIndex = (this.selectedIndex + dir + n) % n
      this.suggestOpen = true
    },
    async onEnterKey() {
      if (this.suggestOpen && this.selectedIndex >= 0 && this.suggestions[this.selectedIndex]) {
        this.chooseSuggestion(this.suggestions[this.selectedIndex])
        return
      }
      await this.submit()
    },
    async submit() {
  const ok = await submitGuess(this, this.$refs.confettiHost)
  this.lastResultOk = !!ok
      if (!ok) {
        // clear input and reopen suggestions for a fresh try
        this.guess = ''
        this.suggestOpen = true
        this.selectedIndex = -1
        this.justPicked = false
      }
      if (ok) this.revealImage = true
      if (this.mode === 'challenge' && (ok || this.lives === 0)) {
        try {
          const result = ok ? 'win' : 'loss'
          await completeChallengeSession(this.sessionId, this.score, this.xpEarned, { result, maxStreak: this.maxStreak, playerId: this.current?.id })
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
        // Delay summary so el acierto no se tapa enseguida
        const delayMs = GAME_SCORING['who-is']?.summaryDelayMs ?? 3000
        setTimeout(() => {
          this.progressShown = this.beforePercent
          this.showSummary = true
          requestAnimationFrame(() => setTimeout(() => { this.progressShown = this.afterPercent }, 40))
        }, delayMs)
        // Save a snapshot so review can show the same progress
        try {
          await completeChallengeSession(this.sessionId, this.score, this.xpEarned, {
            xpView: {
              levelBefore: this.levelBefore, xpBeforeTotal: this.xpBeforeTotal,
              levelAfter: this.levelAfter, xpAfterTotal: this.xpAfterTotal,
              beforePercent: this.beforePercent, afterPercent: this.afterPercent,
              xpToNextAfter: this.xpToNextAfter, xpEarned: this.xpEarned
            }
          })
        } catch {}
        // fetch lifetime for summary
        try { const mod = await import('../../services/game-modes'); const v = await mod.fetchLifetimeMaxStreak('who-is'); this.lifetimeMaxStreak = Math.max(v || 0, this.maxStreak || 0) } catch(_) {}
        // Daily achievements after completing challenge
        try { const mod = await import('../../services/game-modes'); await mod.checkAndUnlockDailyWins('who-is') } catch {}
        return
      }
      if (ok || this.lives === 0) {
        // reveal image briefly, then reset and go to next round (blur must be back)
        this.revealImage = true
        setTimeout(() => {
          this.nextRound()
        }, 1000)
      }
    },
    blurPx() { return this.revealImage ? 0 : blurForLives(this.lives) },
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
        <!-- Lives top-left with animated loss -->
        <div class="absolute top-2 left-2 z-10 select-none">
          <div class="relative inline-block rounded-full px-2.5 py-1.5 bg-white/5 ring-1 ring-white/10">
            <!-- Base placeholders -->
            <div class="flex items-center gap-1.5">
              <span v-for="i in 3" :key="'base-'+i" class="h-3 w-3 sm:h-3.5 sm:w-3.5 rounded-full inline-block bg-white/20"></span>
            </div>
            <!-- Active lives overlay with leave animation -->
            <TransitionGroup name="life" tag="div" class="absolute inset-0 flex items-center gap-1.5 px-2.5 py-1.5">
              <span v-for="i in lives" :key="'live-'+i" class="h-3 w-3 sm:h-3.5 sm:w-3.5 rounded-full inline-block bg-red-400"></span>
            </TransitionGroup>
          </div>
        </div>
        <Transition name="round-fade" mode="out-in">
          <div :key="roundKey">
            <div class="flex flex-col items-center gap-2">
              <p class="text-slate-200 text-center text-base">¿Quién es este jugador?</p>
              <div class="flex items-center gap-3 text-sm">
                <span class="rounded-full border border-white/15 bg-white/5 text-slate-200 px-3 py-1 text-sm">{{ posBadge() }}</span>
                <img v-if="flagSrc()" :src="flagSrc()" alt="flag" width="36" height="26" class="object-cover" style="aspect-ratio: 20/14;" />
                <img v-if="teamLogo()" :src="teamLogo()" alt="team" width="32" height="32" class="object-cover" />
              </div>
              <img v-if="current" :src="current.image" :alt="current.name" :style="{ filter: `blur(${blurPx()}px)` }" class="mb-2 w-32 h-32 sm:w-36 sm:h-36 object-cover rounded-lg blur-img" />
              <div v-if="answered && lastResultOk" class="text-emerald-300 text-sm">¡Correcto! El jugador era: <span class="text-white font-medium">{{ current?.name }}</span></div>
            </div>

            <form class="relative flex flex-col items-center gap-2 mt-3" @submit.prevent="submit">
              <div class="relative w-full max-w-md">
                <input v-model="guess" @focus="suggestOpen=true" @input="suggestOpen = (guess?.length||0) >= 3; selectedIndex=-1" 
                       @keydown.down.prevent="moveSelection(1)" @keydown.up.prevent="moveSelection(-1)" @keydown.enter.prevent="onEnterKey"
                       :disabled="answered" type="text" placeholder="Escribe al menos 3 letras"
                       class="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-white/20" />
                <!-- suggestions -->
                <div v-if="suggestOpen && !answered && (suggestions.length>0)" class="absolute z-20 mt-1 w-full rounded-xl border border-white/10 bg-slate-900/90 backdrop-blur shadow-lg max-h-64 overflow-auto">
                  <ul>
                    <li v-for="(p,idx) in suggestions" :key="p.id" @click.prevent="chooseSuggestion(p)"
                        :class="['px-3 py-2 cursor-pointer text-slate-200 flex items-center gap-2', idx===selectedIndex ? 'bg-white/10' : 'hover:bg-white/5']">
                      <img :src="p.image" :alt="p.name" class="h-6 w-6 object-cover rounded" />
                      <span class="truncate">{{ p.name }}</span>
                    </li>
                  </ul>
                </div>
              </div>
              <button type="button" @click="submit" :disabled="answered || (guess?.length || 0) < 3" class="rounded-full bg-[oklch(0.62_0.21_270)] hover:brightness-110 border border-white/10 text-white px-4 py-2 disabled:opacity-50">Adivinar</button>
            </form>

            <!-- Removed old lives row; now shown as hearts on top-left -->

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
            <p class="text-slate-300 text-sm mb-1">Así quedaste hoy.</p>
            <p class="text-slate-400 text-xs mb-3">{{ blurb() }}</p>
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
            <div class="mt-4 flex justify-center gap-2">
              <button @click="showSummary=false" class="rounded-full border border-white/20 hover:bg-white/5 text-white px-4 py-2">Cerrar</button>
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
/* Smooth blur change on reveal/hints */
.blur-img { transition: filter 220ms ease; }

/* Lives loss animation using TransitionGroup */
.life-leave-active { transition: transform 220ms ease, opacity 220ms ease; }
.life-leave-to { transform: scale(0); opacity: 0; }
.life-enter-active { transition: transform 160ms ease, opacity 160ms ease; }
.life-enter-from { transform: scale(0.8); opacity: 0.6; }
</style>
