<script>
import AppH1 from '../../components/AppH1.vue';
import { initState, loadPlayers, nextRound, pickAnswer, optionClass } from '../../services/guess-player';
import { initScoring } from '../../services/scoring'

export default {
  name: 'GuessPlayer',
  components: { AppH1 },
  data() {
  return { ...initState(), ...initScoring() };
  },
  mounted() {
    loadPlayers(this);
    nextRound(this);
  },
  methods: {
    nextRound() { nextRound(this); },
    async pick(option) {
      const ok = await pickAnswer(this, option, this.$refs.confettiHost);
      setTimeout(() => this.nextRound(), 1000);
    },
    optionClass(opt) { return optionClass(this, opt); },
  }
}
</script>

<template>
  <section class="grid place-items-center h-full">
  <div class="space-y-3 w-full max-w-4xl">
      <div class="flex items-center justify-between">
        <AppH1>Adivina el jugador</AppH1>
        <div class="flex items-center gap-2">
          <router-link to="/games" class="rounded-full border border-white/15 px-3 py-1.5 text-slate-200 hover:bg-white/5">← Volver</router-link>
          <div class="rounded-xl bg-slate-900/60 border border-white/15 px-3 py-1.5 flex items-center gap-2">
            <span class="text-slate-300 text-[10px] uppercase tracking-wider">Puntaje</span>
            <span class="text-white font-extrabold text-lg leading-none whitespace-nowrap">{{ score }}/{{ attempts * 10 }}</span>
          </div>
        </div>
      </div>

      <div v-if="loading" class="text-slate-300">Cargando…</div>
      <div v-else class="relative card p-4">
        <div ref="confettiHost" class="pointer-events-none absolute inset-0 overflow-hidden"></div>
        <div class="pointer-events-none absolute left-1/2 -translate-x-1/2 -bottom-16 z-10" v-if="feedback">
          <div :class="['rounded-full px-3 py-1.5 border text-sm', feedback.startsWith('¡') ? 'border-green-500 bg-green-500/15 text-green-300' : 'border-red-500 bg-red-500/15 text-red-300']">
            {{ feedback }}
          </div>
        </div>
        <Transition name="round-fade" mode="out-in">
          <div :key="roundKey">
            <div class="flex flex-col items-center">
              <p class="text-slate-200 mb-2 text-center text-base">¿Quién es este jugador?</p>
              <img v-if="current" :src="current.image" :alt="current.name" class="mb-3 w-32 h-32 sm:w-36 sm:h-36 object-cover rounded-lg" />
              <div class="mt-1 text-xs text-slate-300" v-if="streak > 0">Racha: {{ streak }}</div>
              <div class="mt-1 text-xs text-slate-300" v-if="streak > 0">Racha: {{ streak }}</div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button v-for="opt in options" :key="opt.label" @click="pick(opt)" :class="optionClass(opt)" :disabled="answered"
                class="transition-transform duration-150 active:scale-[0.98]">
                {{ opt.label }}
              </button>
            </div>
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
