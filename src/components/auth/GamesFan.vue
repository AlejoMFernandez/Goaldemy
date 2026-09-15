<script>
import { friendlyNameForSlug, friendlyDescForSlug } from '../../services/games'

// Abanico de portadas de juegos para el panel visual del login/register.
// Cada carta rota alrededor de un mismo pivote inferior (transform-origin: bottom
// center) → efecto "mazo de cartas" sin necesidad de calcular posiciones a mano.
const SLUGS = ['who-is', 'football-grid', 'value-order', 'connections', 'football-wordle', 'shirt-number', 'nationality']
const GAMES = SLUGS.map(slug => ({
  slug,
  src: `/games/${slug}.svg`,
  label: friendlyNameForSlug(slug),
  desc: friendlyDescForSlug(slug),
}))
const CENTER = (GAMES.length - 1) / 2
const ANGLE_STEP = 12 // grados entre cada carta
const X_STEP = 40 // separación horizontal entre cada carta (px), además de la rotación
// Tiempo total de la animación de entrada (delay máximo + duración) — pasado
// ese punto se cambia a una transición corta para que el hover sea instantáneo.
const ENTER_DONE_MS = 90 + Math.ceil(CENTER) * 70 + 650

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
      entered: false,
      // En mobile no hay :hover real — el tap alterna cuál card muestra su
      // previsualización (nombre + de qué se trata).
      activeIndex: null,
    }
  },
  mounted() {
    // rAF para asegurar que el estado inicial (opacity:0) se pinte antes de
    // activar la clase "is-in" — si no, la transición puede "saltarse".
    requestAnimationFrame(() => requestAnimationFrame(() => { this.mounted = true }))
    // Después de que termina la animación de entrada, pasamos a una transición
    // corta: el hover debe sentirse instantáneo, no arrastrar el mismo timing
    // lento del despliegue inicial.
    setTimeout(() => { this.entered = true }, ENTER_DONE_MS)
    document.addEventListener('click', this.onDocClick)
  },
  unmounted() {
    document.removeEventListener('click', this.onDocClick)
  },
  methods: {
    toggle(i) {
      this.activeIndex = this.activeIndex === i ? null : i
    },
    onDocClick(e) {
      if (!this.$el.contains(e.target)) this.activeIndex = null
    }
  }
}
</script>

<template>
  <div class="fan">
    <button
      v-for="(card, i) in cards"
      :key="card.src"
      type="button"
      class="fan-card"
      :class="{ 'is-in': mounted, entered: entered, 'is-active': activeIndex === i }"
      :style="{ '--fan-angle': card.angle + 'deg', '--fan-x': card.x + 'px', transitionDelay: mounted ? '0ms' : card.delay + 'ms', zIndex: activeIndex === i ? 30 : card.z }"
      @click="toggle(i)"
    >
      <img :src="card.src" :alt="card.label" width="84" height="84" loading="lazy" />
      <span class="fan-tooltip" :style="{ '--fan-tooltip-angle': (-card.angle) + 'deg' }">
        <span class="fan-tooltip-name">{{ card.label }}</span>
        <span class="fan-tooltip-desc">{{ card.desc }}</span>
      </span>
    </button>
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
  padding: 0;
  border-radius: 14px;
  overflow: visible;
  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow: 0 12px 24px -10px rgba(0, 0, 0, 0.65);
  background: #0f172a;
  transform-origin: bottom center;
  transform: translateX(-50%) translateX(0) rotate(0deg) scale(0.4);
  opacity: 0;
  transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.45s ease;
  cursor: pointer;
  font: inherit;
  color: inherit;
  -webkit-tap-highlight-color: transparent;
}
.fan-card:focus-visible {
  outline: 2px solid rgba(16, 185, 129, 0.6);
  outline-offset: 2px;
}
.fan-card img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
  border-radius: 13px;
}
.fan-card.is-in {
  transform: translateX(-50%) translateX(var(--fan-x)) rotate(var(--fan-angle)) scale(1);
  opacity: 1;
}
/* Una vez terminó el despliegue inicial, el hover usa una transición corta
   (no la del entrance) para sentirse instantáneo. */
.fan-card.entered {
  transition: transform 0.12s ease-out;
}
.fan-card.is-in:hover,
.fan-card.is-in.is-active {
  transform: translateX(-50%) translateX(var(--fan-x)) rotate(var(--fan-angle)) translateY(-14px) scale(1.1);
  z-index: 20;
}

/* Previsualización flotante: nombre + de qué se trata el juego. Contrarrota
   respecto de la card (que está inclinada por el abanico) para que el texto
   se lea siempre derecho, sin importar en qué posición del abanico esté. */
.fan-tooltip {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 10px);
  transform: translateX(-50%) rotate(var(--fan-tooltip-angle)) translateY(4px);
  transform-origin: bottom center;
  width: 148px;
  max-width: 55vw;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(11, 18, 32, 0.97);
  box-shadow: 0 12px 24px -8px rgba(0, 0, 0, 0.7);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease, transform 0.15s ease;
  text-align: center;
}
.fan-card.is-in:hover .fan-tooltip,
.fan-card.is-in.is-active .fan-tooltip {
  opacity: 1;
  transform: translateX(-50%) rotate(var(--fan-tooltip-angle)) translateY(0);
}
.fan-tooltip-name {
  display: block;
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  line-height: 1.2;
}
.fan-tooltip-desc {
  display: block;
  margin-top: 2px;
  font-size: 10.5px;
  color: rgb(148 163 184); /* slate-400 */
  line-height: 1.3;
}
</style>
