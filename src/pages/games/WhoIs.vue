<script>
import AppH1 from '../../components/AppH1.vue'
import { initState, loadPlayers, nextRound, submitGuess, blurForLives, posLabel, countryFlag, teamLogo } from '../../services/guess-player-typing'
import { initScoring } from '../../services/scoring'

export default {
  name: 'WhoIs',
  components: { AppH1 },
  data() {
    return { ...initState(), ...initScoring() }
  },
  mounted() {
    loadPlayers(this)
    nextRound(this)
  },
  methods: {
    nextRound() { nextRound(this) },
    async submit() {
      const ok = await submitGuess(this, this.$refs.confettiHost)
      if (ok || this.lives === 0) {
        setTimeout(() => this.nextRound(), 1000)
      }
    },
    blurPx() { return blurForLives(this.lives) },
    posBadge() { return this.current ? posLabel(this.current) : '' },
    flagSrc() { return this.current ? countryFlag(this.current, 40) : '' },
    teamLogo() { return this.current ? teamLogo(this.current) : '' },
  }
}
</script>

<template>
  <section class="grid place-items-center">
    <div class="space-y-3 w-full max-w-4xl">
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <AppH1 class="text-2xl md:text-4xl mb-1 sm:mb-0">¿Quién es?</AppH1>
        <div class="flex items-center gap-2 self-stretch sm:self-auto">
          <router-link to="/games" class="rounded-full border border-white/15 px-2 py-1 text-xs sm:text-sm text-slate-200 hover:bg-white/5">← Volver</router-link>
          <div class="rounded-xl bg-slate-900/60 border border-white/15 px-2.5 py-1.5 flex items-center gap-2">
            <span class="text-slate-300 text-[10px] uppercase tracking-wider">Puntaje</span>
            <span class="text-white font-extrabold text-base sm:text-lg leading-none whitespace-nowrap">{{ score }}/{{ attempts * 10 }}</span>
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
