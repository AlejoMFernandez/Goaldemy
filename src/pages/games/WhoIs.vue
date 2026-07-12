<script>
import GameShell from '../../components/game/GameShell.vue'
import { initState, loadPlayers, nextRound, submitGuess, blurForLives, posLabel, countryFlag, teamLogo } from '../../services/guess-player-typing'
import { initScoring, GAME_SCORING } from '../../services/scoring'
import { getUserLevel, captureLevelSnapshot } from '../../services/xp'
import { awardXpBatch } from '../../services/game-xp'
import { createDailyRng } from '../../services/seeded-random'
import { isChallengeAvailable, startChallengeSession, completeChallengeSession } from '../../services/game-modes'
import { gameSummaryBlurb } from '../../services/games'
import { celebrateCorrect, celebrateGameWin, announceGameLoss, celebrateGameLevelUp } from '../../services/game-celebrations'
import { getGameMetadata } from '../../services/games'
import GamePreviewModal from '../../components/game/GamePreviewModal.vue'
import GameSummaryPopup from '../../components/game/GameSummaryPopup.vue'
import StreakBadge from '../../components/game/StreakBadge.vue'

export default {
  name: 'WhoIs',
  components: { GameShell, GamePreviewModal, GameSummaryPopup, StreakBadge },
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
      timeOver: false,
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
      // difficulty
      selectedDifficulty: 'normal',
      difficultyConfig: null,
      // explicit win tracking (avoids lives-timing edge cases)
      gameWon: false,
    }
  },
  computed: {
    gameMetadata() {
      return getGameMetadata('who-is')
    },
    maxLives() { return this.difficultyConfig?.lives ?? 3 },
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
  async mounted() {
    const mode = (this.$route.query.mode || '').toString().toLowerCase()
    if (mode === 'free') this.mode = 'free'
    else if (mode === 'challenge') this.mode = 'challenge'
    else if (mode === 'review') { this.mode = 'challenge'; this.reviewMode = true }
    else this.mode = 'normal'

    if (this.mode === 'free') this.allowXp = false

    await loadPlayers(this)
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
            if (!this.allPlayers || !this.allPlayers.length) { await loadPlayers(this) }
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
      this.gameWon = false
      nextRound(this)
    },
    blurb() { return gameSummaryBlurb('who-is') },
    backPath() { return this.mode === 'free' ? '/play/free' : '/play/points' },
    async chooseSuggestion(p) {
      // Tocar una sugerencia la manda directo (estilo who-are-ya).
      if (!p) return
      this.guess = p.name || ''
      this.suggestOpen = false
      this.selectedIndex = -1
      await this.submit()
    },
    moveSelection(dir) {
      const n = this.suggestions.length
      if (!n) return
      if (this.selectedIndex < 0) this.selectedIndex = 0
      else this.selectedIndex = (this.selectedIndex + dir + n) % n
      this.suggestOpen = true
    },
    async onEnterKey() {
      // Con una sola coincidencia, Enter la manda directo.
      if (this.suggestions.length === 1) { await this.chooseSuggestion(this.suggestions[0]); return }
      if (this.suggestOpen && this.selectedIndex >= 0 && this.suggestions[this.selectedIndex]) {
        await this.chooseSuggestion(this.suggestions[this.selectedIndex])
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
      if (ok) this.gameWon = true
      if (this.mode === 'challenge' && (ok || this.lives === 0)) {
        // Trigger confetti and sound based on result
        const result = (this.lives > 0) ? 'win' : 'loss'
        
        // 🎉 Celebrate based on result
        if (result === 'win') {
          setTimeout(() => celebrateGameWin(), 100)
        } else {
          setTimeout(() => announceGameLoss(), 100)
        }
        if (this.allowXp && this.xpEarned > 0) {
          await awardXpBatch({ gameCode: 'who-is', totalXp: this.xpEarned, corrects: this.corrects }).catch(() => {})
        }
        try {
          await completeChallengeSession(this.sessionId, this.score, this.xpEarned, { result, maxStreak: this.maxStreak, playerId: this.current?.id })
        } catch (e) { console.error('[WhoIs complete]', e) }
        try {
          const snap = await captureLevelSnapshot()
          this.levelAfter = snap.level
          this.xpAfterTotal = snap.xpTotal
          this.afterPercent = snap.percent
          this.xpToNextAfter = snap.xpToNext
          if (snap.level && this.levelBefore && snap.level > this.levelBefore) {
            setTimeout(() => celebrateGameLevelUp(snap.level), 500)
          }
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
    async startChallenge({ difficulty, config }) {
      if (!this.availability.available) return
      
      // Guardar configuración de dificultad
      this.selectedDifficulty = difficulty
      this.difficultyConfig = config
      this.lives = config.lives
      
      try {
        // capture level/xp before
        try {
          const snap = await captureLevelSnapshot()
          this.levelBefore = snap.level
          this.xpBeforeTotal = snap.xpTotal
          this.beforePercent = snap.percent
        } catch {}
        this.rng = createDailyRng('who-is')
        this.difficultyConfig = config
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
  <GameShell title="¿Quién es?" :backPath="backPath()">
    <template #stat>
      <div class="inline-flex items-center gap-2 rounded-lg bg-slate-800/70 border border-white/12 px-2.5 py-1 shadow-lg shadow-black/20">
        <span class="text-slate-400 text-[10px] uppercase tracking-wider font-semibold">Puntaje</span>
        <span class="font-display text-white font-extrabold text-base leading-none whitespace-nowrap">{{ score }}/{{ attempts * (pointsPerCorrect || 10) }}</span>
        <StreakBadge :streak="streak" />
      </div>
    </template>
    <GamePreviewModal
      :open="overlayOpen && mode === 'challenge' && !reviewMode"
      gameName="¿Quién es?"
      gameDescription="Adiviná el jugador con 3 vidas"
      gameType="lives"
      :mechanic="gameMetadata.mechanic"
      :videoUrl="gameMetadata.videoUrl"
      :tips="gameMetadata.tips"
      @close="overlayOpen = false"
      @start="startChallenge"
    />
    <div class="w-full max-w-md mx-auto">

      <div v-if="loading" class="text-center text-slate-300 py-12">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400"></div>
        <p class="mt-3">Cargando...</p>
      </div>
      <div v-else>
        <!-- CARTA MISTERIOSA estilo who-are-ya -->
        <div class="relative rounded-2xl border border-white/10 bg-gradient-to-b from-slate-800/70 to-slate-900/85 px-4 pt-9 pb-4 overflow-hidden">
          <div ref="confettiHost" class="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl z-20"></div>
          <div class="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full opacity-20 blur-3xl" style="background: radial-gradient(circle, rgba(16,185,129,0.4), transparent 70%);"></div>

          <!-- Vidas (esquina) -->
          <div class="absolute top-2.5 left-3 z-10 flex items-center gap-1" title="Vidas">
            <svg v-for="i in maxLives" :key="'life-'+i" class="h-4 w-4 transition-colors duration-300" :class="i <= lives ? 'text-rose-500 drop-shadow-[0_0_4px_rgba(244,63,94,0.5)]' : 'text-white/15'" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
          </div>

          <Transition name="round-fade" mode="out-in">
            <div :key="roundKey" class="relative flex flex-col items-center gap-3">
              <!-- Foto blureada (se revela al responder) -->
              <div v-if="current" class="w-36 h-36 sm:w-44 sm:h-44 rounded-2xl overflow-hidden shadow-xl bg-slate-700/60 border border-white/10 no-peek" @contextmenu.prevent>
                <img :src="current.image" :alt="answered ? current.name : '?'"
                     :style="{ filter: 'blur(' + (answered ? 0 : blurPx()) + 'px)' }"
                     class="w-full h-full object-cover blur-img" draggable="false"
                     @dragstart.prevent @contextmenu.prevent @error="e => e.target.style.display='none'" />
              </div>

              <!-- Nombre al acertar / perder -->
              <div v-if="answered" class="text-center -mt-0.5">
                <p :class="lastResultOk ? 'text-emerald-400' : 'text-white'" class="font-display font-extrabold text-lg leading-tight">{{ current?.name }}</p>
                <p v-if="!lastResultOk && lives === 0" class="text-rose-400/80 text-xs mt-0.5">No lo adivinaste</p>
              </div>
              <p v-else class="text-slate-300 text-sm font-medium">¿Quién es este jugador?</p>

              <!-- Pistas: posición, país, equipo -->
              <div class="flex items-center justify-center gap-2 flex-wrap">
                <span v-if="posBadge()" class="wi-chip">{{ posBadge() }}</span>
                <span v-if="flagSrc()" class="wi-chip"><img :src="flagSrc()" alt="país" class="w-6 h-4 object-cover rounded-sm" /></span>
                <span v-if="teamLogo()" class="wi-chip"><img :src="teamLogo()" alt="equipo" class="w-5 h-5 object-contain" @error="e => e.target.style.display='none'" /></span>
              </div>
            </div>
          </Transition>
        </div>

        <!-- INPUT -->
        <div v-if="!answered" class="mt-3">
          <form class="relative w-full max-w-md mx-auto" @submit.prevent="submit">
            <div class="relative">
              <input v-model="guess" @focus="suggestOpen=true" @input="suggestOpen = (guess?.length||0) >= 3; selectedIndex=-1"
                     @keydown.down.prevent="moveSelection(1)" @keydown.up.prevent="moveSelection(-1)" @keydown.enter.prevent="onEnterKey"
                     type="text" placeholder="Escribí el nombre del jugador..."
                     class="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30" />
              <div v-if="suggestOpen && suggestions.length>0" class="absolute z-30 mt-1 w-full rounded-xl border border-white/10 bg-slate-900/95 backdrop-blur shadow-2xl max-h-56 overflow-auto">
                <ul>
                  <li v-for="(p,idx) in suggestions" :key="p.id" @click.prevent="chooseSuggestion(p)"
                      :class="['px-3 py-2 cursor-pointer text-slate-200 flex items-center gap-2', idx===selectedIndex ? 'bg-white/10' : 'hover:bg-white/5']">
                    <img :src="p.image" :alt="p.name" class="h-6 w-6 object-cover rounded flex-shrink-0" @error="e => e.target.style.display='none'" />
                    <span class="truncate">{{ p.name }}</span>
                    <span v-if="p.teamName" class="text-slate-500 text-xs ml-auto flex-shrink-0">{{ p.teamName }}</span>
                  </li>
                </ul>
              </div>
            </div>
            <div class="flex items-center justify-center mt-2">
              <button type="submit" :disabled="(guess?.length || 0) < 3" class="rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110 text-white px-6 py-2 text-sm font-bold disabled:opacity-40 transition shadow-lg shadow-emerald-500/20">Adivinar</button>
            </div>
          </form>
        </div>

        <!-- Summary Popup -->
        <GameSummaryPopup
          :show="showSummary"
          :corrects="gameWon ? 1 : 0"
          :score="score"
          :maxStreak="maxStreak"
          :lifetimeMaxStreak="lifetimeMaxStreak"
          :levelBefore="levelBefore"
          :levelAfter="levelAfter"
          :xpBeforeTotal="xpBeforeTotal"
          :xpAfterTotal="xpAfterTotal"
          :beforePercent="beforePercent"
          :afterPercent="afterPercent"
          :progressShown="progressShown"
          :xpToNextAfter="xpToNextAfter"
          :xpEarned="xpEarned"
          :difficulty="selectedDifficulty"
          :winThreshold="1"
          :backPath="backPath()"
          @close="showSummary = false"
        />
        
        <div v-if="timeOver && mode==='challenge'" class="mt-3 text-center text-amber-300 text-sm">Tiempo agotado. ¡Buen intento!</div>
      </div>
    </div>
  </GameShell>
</template>

<style scoped>
.round-fade-enter-active, .round-fade-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}
.round-fade-enter-from, .round-fade-leave-to {
  opacity: 0;
  transform: translateY(6px) scale(0.99);
}

/* Chips de pistas (posición / país / equipo) */
.wi-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 30px;
  padding: 4px 10px;
  border-radius: 9999px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.05);
  color: rgb(226, 232, 240);
  font-size: 12px;
  font-weight: 700;
}

/* reserved for game local styles */
/* Smooth blur change on reveal/hints */
.blur-img { transition: filter 220ms ease; }
.no-peek {
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  pointer-events: auto;
}
.no-peek img {
  -webkit-user-drag: none;
  user-select: none;
  -webkit-user-select: none;
  pointer-events: none;
}

/* Lives loss animation using TransitionGroup */
.life-leave-active { transition: transform 220ms ease, opacity 220ms ease; }
.life-leave-to { transform: scale(0); opacity: 0; }
.life-enter-active { transition: transform 160ms ease, opacity 160ms ease; }
.life-enter-from { transform: scale(0.8); opacity: 0.6; }
</style>


