<script>
import AppH1 from '../components/AppH1.vue'
import Game from '../components/Game.vue'

export default {
  name: 'Games',
  components: { AppH1, Game },
  data() {
    return {
      // Curated, visibles (tamaño compacto como antes)
      featured: [
        {
          id: 'name-correct',
          slug: 'name-correct',
          name: 'Nombre correcto',
          description: 'Elegí el nombre correcto del jugador mostrado',
          route: '/games/guess-player',
          cover_url: null,
          image: null,
        },
        {
          id: 'nationality',
          slug: 'nationality',
          name: 'Nacionalidad correcta',
          description: 'Selecciona la nacionalidad correcta del jugador',
          route: '/games/nationality',
          cover_url: '/games/gamenationality.png',
          image: null,
        },
        {
          id: 'player-position',
          slug: 'player-position',
          name: 'Posición correcta',
          description: 'Elegí la posición correcta del jugador mostrado',
          route: '/games/player-position',
          cover_url: null,
          image: null,
        },
        {
          id: 'who-is',
          slug: 'who-is',
          name: '¿Quién es?',
          description: 'Escribe el nombre a partir de la foto borrosa y pistas',
          route: '/games/who-is',
          cover_url: null,
          image: null,
        },
      ],
    }
  },
  methods: {
    onPlay(game) {
      if (game?.route) return this.$router.push(game.route)
      const slug = game?.slug || ''
      if (slug === 'who-is') return this.$router.push('/games/who-is')
      if (slug === 'nationality') return this.$router.push('/games/nationality')
      if (slug === 'player-position') return this.$router.push('/games/player-position')
      alert(`Próximamente: ${game?.name || 'Juego'}`)
    }
  }
}
</script>

<template>
  <section class="grid place-items-center">
    <div class="space-y-4 w-full">
      <AppH1>¡Juegos!</AppH1>

      <!-- Grilla compacta: como antes (1,2,3,4 cols) -->
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 w-full">
        <Game v-for="game in featured" :key="game.id" :game="game" @play="onPlay" />

        <!-- Próximamente al final -->
        <div class="bg-slate-800 rounded-lg p-4 shadow-lg hover:shadow-xl transition-shadow flex flex-col justify-center">
          <h2 class="text-xl font-semibold mb-2 text-white">Próximamente</h2>
          <p class="text-sm text-slate-300">Más juegos se añadirán pronto. ¡Mantente atent@!</p>
        </div>
      </div>
    </div>
  </section>
</template>