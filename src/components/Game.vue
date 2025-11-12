<script>
import defaultImg from '../assets/goaldemy.png';

export default {
  name: 'Game',
  props: {
    game: {
      type: Object,
      required: true,
    }
  },
  emits: ['play'],
  computed: {
    cover() {
      return this.game.image || defaultImg;
    }
  },
  methods: {
    onPlay() {
      this.$emit('play', this.game);
    }
  }
}
</script>

<template>
  <article class="bg-slate-800 rounded-lg p-4 shadow-lg hover:shadow-xl transition-shadow h-full flex flex-col">
    <img :src="cover" :alt="game.name" class="w-full h-36 object-contain rounded-md mb-3 bg-slate-700" />
    <h3 class="text-lg font-semibold mb-2 text-white">{{ game.name }}</h3>
    <p class="text-sm text-slate-300 line-clamp-3 flex-1">{{ game.description }}</p>
    <button @click="onPlay" class="mt-4 w-full bg-[oklch(0.62_0.21_270)] text-white py-2 rounded-lg hover:bg-[oklch(0.55_0.21_270)] transition">
      Jugar
    </button>
  </article>
</template>

<style scoped>
/* Fallback if tailwind line-clamp not present */
.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  line-clamp: 3;
  overflow: hidden;
}
</style>
