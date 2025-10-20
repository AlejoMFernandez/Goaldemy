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
      console.debug('[Games.vue] mounted -> fetching games…');
      const timer = setTimeout(() => {
        if (this.loading) {
          console.warn('[Games.vue] fetchGames timeout reached');
          this.error = 'Tiempo de espera al cargar juegos. Revisa conexión o permisos (RLS).';
          this.loading = false;
        }
      }, 8000);

      this.games = await fetchGames();
      console.debug('[Games.vue] games loaded:', this.games);
      clearTimeout(timer);
    } catch (err) {
      console.error('[Games.vue] Failed to load games:', err);
      this.error = 'No pudimos cargar los juegos por ahora. Intentalo más tarde.';
    } finally {
      this.loading = false;
    }
  },
  methods: {
    onPlay(game) {
      // Known demo routes by slug
      const slug = game.slug || ''
      if (slug === 'guess-player') return this.$router.push('/games/guess-player')
      if (slug === 'nationality') return this.$router.push('/games/nationality')
      if (slug === 'player-position') return this.$router.push('/games/player-position')
      // Fallback
      alert(`Próximamente: ${game.name}`)
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
        <router-link class="rounded-lg border border-white/10 px-3 py-2 text-slate-200 hover:bg-white/5" to="/games/player-position">Demo: Posición del jugador</router-link>
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