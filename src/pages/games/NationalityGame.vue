<script>
import AppH1 from '../../components/AppH1.vue';
import { getAllPlayers } from '../../services/players';
import { countryCodeFromName, flagUrl } from '../../services/countries';

export default {
  name: 'NationalityGame',
  components: { AppH1 },
  data() {
    return {
      allPlayers: [],
      current: null,
      options: [],
      answered: false,
      selected: null,
      feedback: null,
      score: 0,
      attempts: 0,
      streak: 0,
      roundKey: 0,
      loading: true,
    };
  },
  mounted() {
    this.allPlayers = getAllPlayers();
    this.loading = false;
    this.nextRound();
  },
  methods: {
    nextRound() {
      if (!this.allPlayers.length) return;
      const idx = Math.floor(Math.random() * this.allPlayers.length);
      this.current = this.allPlayers[idx];
      const countries = Array.from(new Set(this.allPlayers.map(p => p.cname)));
      const distractors = countries.filter(c => c !== this.current.cname);
      const picked = [];
      while (picked.length < 3 && distractors.length > 0) {
        const j = Math.floor(Math.random() * distractors.length);
        picked.push(distractors.splice(j, 1)[0]);
      }
      const opts = [this.current.cname, ...picked].map(c => ({ label: c, value: c, code: countryCodeFromName(c) }));
      for (let i = opts.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [opts[i], opts[j]] = [opts[j], opts[i]];
      }
      this.options = opts;
      this.answered = false;
      this.selected = null;
      this.feedback = null;
      this.roundKey += 1;
    },
    pick(option) {
      if (this.answered) return;
      this.answered = true;
      this.selected = option.value;
      const correct = option.value === this.current.cname;
      if (correct) {
        this.streak += 1;
        this.score += this.streak; // multiplicador por racha
        this.triggerConfetti();
      } else {
        this.streak = 0;
      }
      this.attempts += 1;
      this.feedback = correct ? '¡Correcto!' : `Incorrecto: era ${this.current.cname}`;
      setTimeout(() => this.nextRound(), 1000);
    },
    optionClass(opt) {
      const base = 'rounded-lg border px-3 py-2 text-slate-200 transition flex items-center gap-3';
      if (!this.answered) return base + ' border-white/10 hover:border-white/25 hover:bg-white/5';
      const isCorrect = opt.value === this.current.cname;
      const isSelected = opt.value === this.selected;
      if (isCorrect) return base + ' border-green-500 bg-green-500/10 text-green-300';
      if (isSelected) return base + ' border-red-500 bg-red-500/10 text-red-300';
      return base + ' border-white/10 opacity-70';
    },
    flag(opt) {
      return flagUrl(opt.code, 40);
    },
    triggerConfetti() {
      const host = this.$refs.confettiHost;
      if (!host) return;
      const count = 24;
      for (let i = 0; i < count; i++) {
        const piece = document.createElement('span');
        piece.className = 'confetti-piece';
        piece.style.left = Math.random() * 100 + '%';
        piece.style.background = `hsl(${Math.floor(Math.random()*360)}, 80%, 60%)`;
        piece.style.animationDelay = (Math.random() * 0.2) + 's';
        host.appendChild(piece);
        setTimeout(() => piece.remove(), 1200);
      }
    }
  }
}
</script>

<template>
    <section class="grid place-items-center h-full">
    <div class="space-y-3 w-full max-w-4xl">
        <div class="flex items-center justify-between">
          <AppH1>Nacionalidad correcta</AppH1>
          <div class="flex items-center gap-2">
            <router-link to="/games" class="rounded-full border border-white/15 px-3 py-1.5 text-slate-200 hover:bg-white/5">← Volver</router-link>
            <div class="rounded-xl bg-slate-900/60 border border-white/15 px-3 py-1.5 flex items-center gap-2">
              <span class="text-slate-300 text-[10px] uppercase tracking-wider">Puntaje</span>
              <span class="text-white font-extrabold text-lg leading-none whitespace-nowrap">{{ score }}/{{ attempts }}</span>
              <span class="ml-2 inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 px-2 py-0.5 text-xs">⚡ Racha x{{ Math.max(streak, 0) }}</span>
            </div>
          </div>
        </div>

      <div v-if="loading" class="text-slate-300">Cargando…</div>
        <div v-else class="relative card p-4">
          <div ref="confettiHost" class="pointer-events-none absolute inset-0 overflow-hidden"></div>
          <div class="pointer-events-none absolute left-1/2 -translate-x-1/2 -bottom-10 z-10" v-if="feedback">
            <div :class="['rounded-full px-3 py-1.5 border text-sm', feedback.startsWith('¡') ? 'border-green-500 bg-green-500/15 text-green-300' : 'border-red-500 bg-red-500/15 text-red-300']">
              {{ feedback }}
            </div>
          </div>
          <Transition name="round-fade" mode="out-in">
            <div :key="roundKey">
              <div class="flex flex-col items-center">
                <p class="text-slate-200 mb-2 text-center text-base">¿De qué país es <strong class="text-white">{{ current?.name }}</strong>?</p>
                <img v-if="current" :src="current.image" :alt="current.name" class="mb-3 w-32 h-32 sm:w-36 sm:h-36 object-cover rounded-lg" />
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button v-for="opt in options" :key="opt.label" @click="pick(opt)" :class="optionClass(opt)" :disabled="answered"
                  class="transition-transform duration-150 active:scale-[0.98]">
                  <img v-if="opt.code" :src="flag(opt)" :alt="opt.label" width="40" height="28" class="rounded ring-1 ring-white/10 object-cover" style="aspect-ratio: 20/14;" />
                  <span class="truncate">{{ opt.label }}</span>
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

  /* confetti */
  .confetti-piece {
    position: absolute;
    top: 0;
    width: 8px;
    height: 12px;
    border-radius: 2px;
    opacity: 0.9;
    animation: confetti-fall 1s ease-in forwards;
  }
  @keyframes confetti-fall {
    0% { transform: translateY(-10px) rotate(0deg); }
    100% { transform: translateY(220px) rotate(420deg); }
  }
  </style>
