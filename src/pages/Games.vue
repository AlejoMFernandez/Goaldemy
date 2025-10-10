<script>
import AppH1 from '../components/AppH1.vue';
import Game from '../components/Game.vue';
import { fetchGames } from '../services/games';

export default {
  name: 'Games',
  components: { AppH1, Game },
  data() {
    return {
      games: [],
      loading: true,
      error: null,
    };
  },
  async mounted() {
    try {
      this.loading = true;
      this.games = await fetchGames();
    } catch (err) {
      console.error('[Games.vue] Failed to load games:', err);
      this.error = 'No pudimos cargar los juegos por ahora. Intentalo más tarde.';
    } finally {
      this.loading = false;
    }
  },
  methods: {
    onPlay(game) {
      // TODO: route to a game page or open modal when available
      alert(`Próximamente: ${game.name}`);
    }
  }
}
</script>

<template>
  <section class="grid place-items-center h-full">
    <div class="space-y-4 w-full">
      <AppH1>¡Juegos!</AppH1>

      <div class="flex flex-wrap gap-3">
        <router-link class="rounded-lg border border-white/10 px-3 py-2 text-slate-200 hover:bg-white/5" to="/games/guess-player">Demo: Adivina el jugador</router-link>
        <router-link class="rounded-lg border border-white/10 px-3 py-2 text-slate-200 hover:bg-white/5" to="/games/nationality">Demo: Nacionalidad correcta</router-link>
      </div>

      <div v-if="loading" class="text-slate-300">Cargando juegos…</div>
      <div v-else-if="error" class="text-red-400">{{ error }}</div>

      <!-- mostramos los juegos en grilla -->
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 w-full">
        <Game v-for="game in games" :key="game.id" :game="game" @play="onPlay" />

        <div class="bg-slate-800 rounded-lg p-4 shadow-lg hover:shadow-xl transition-shadow">
          <h2 class="text-lg font-semibold mb-2 text-white">Próximamente</h2>
          <p class="text-sm text-slate-400">Más juegos se añadirán pronto. ¡Mantente atento!</p>
        </div>
      </div>
    </div>
  </section>
</template>