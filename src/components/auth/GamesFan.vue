<script>
// Abanico de portadas de juegos para el panel visual del login/register (desktop).
// Cada carta rota alrededor de un mismo pivote inferior (transform-origin: bottom
// center) → efecto "mazo de cartas" sin necesidad de calcular posiciones a mano.
const GAMES = [
  { src: '/games/guess-player.svg', label: 'Adiviná el Jugador' },
  { src: '/games/football-grid.svg', label: 'La Grilla' },
  { src: '/games/higher-or-lower.svg', label: 'Mayor o Menor' },
  { src: '/games/connections.svg', label: 'Conexiones' },
  { src: '/games/football-wordle.svg', label: 'Football Wordle' },
  { src: '/games/shirt-number.svg', label: 'Número de Camiseta' },
  { src: '/games/nationality.svg', label: 'Nacionalidad' },
]
const CENTER = (GAMES.length - 1) / 2
const ANGLE_STEP = 13 // grados entre cada carta
const X_STEP = 40 // separación horizontal entre cada carta (px), además de la rotación

export default {
  name: 'GamesFan',
  data() {
    return {
      cards: GAMES.map((g, i) => ({
        ...g,
        angle: (i - CENTER) * ANGLE_STEP,
        x: (i - CENTER) * X_STEP,
        delay: 90 + Math.abs(i - CENTER) * 70, // el centro entra primero, los extremos después
        z: 10 - Math.round(Math.abs(i - CENTER)),
      })),
      mounted: false,
    }
  },
  mounted() {
    // rAF para asegurar que el estado inicial (opacity:0) se pinte antes de
    // activar la clase "is-in" — si no, la transición puede "saltarse".
    requestAnimationFrame(() => requestAnimationFrame(() => { this.mounted = true }))
  }
}
</script>

<template>
  <div class="fan" aria-hidden="true">
    <div
      v-for="(card, i) in cards"
      :key="card.src"
      class="fan-card"
      :class="{ 'is-in': mounted }"
      :style="{ '--fan-angle': card.angle + 'deg', '--fan-x': card.x + 'px', transitionDelay: card.delay + 'ms', zIndex: card.z }"
    >
      <img :src="card.src" :alt="card.label" width="84" height="84" loading="lazy" />
    </div>
  </div>
</template>

<style scoped>
.fan {
  position: relative;
  width: 100%;
  height: 108px;
}
.fan-card {
  position: absolute;
  bottom: 0;
  left: 50%;
  width: 84px;
  height: 84px;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow: 0 14px 28px -12px rgba(0, 0, 0, 0.65);
  background: #0f172a;
  transform-origin: bottom center;
  transform: translateX(-50%) translateX(0) rotate(0deg) scale(0.4);
  opacity: 0;
  transition: transform 0.65s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.5s ease;
}
.fan-card img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}
.fan-card.is-in {
  transform: translateX(-50%) translateX(var(--fan-x)) rotate(var(--fan-angle)) scale(1);
  opacity: 1;
}
.fan-card.is-in:hover {
  transform: translateX(-50%) translateX(var(--fan-x)) rotate(var(--fan-angle)) translateY(-16px) scale(1.12);
  z-index: 20 !important;
  border-color: rgba(52, 211, 153, 0.5);
}
</style>
