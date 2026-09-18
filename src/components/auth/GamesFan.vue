<script>
import { friendlyNameForSlug } from '../../services/games'

// Abanico de portadas de juegos para el panel visual del login/register.
// Cada carta rota alrededor de un mismo pivote inferior (transform-origin: bottom
// center) → efecto "mazo de cartas" sin necesidad de calcular posiciones a mano.
const SLUGS = ['who-is', 'football-grid', 'value-order', 'connections', 'football-wordle', 'shirt-number', 'nationality']
const CENTER = (SLUGS.length - 1) / 2
const ANGLE_STEP = 12 // grados entre cada carta
const X_STEP = 40 // separación horizontal entre cada carta (px), además de la rotación
const GAMES = SLUGS.map((slug, i) => ({
  src: `/games/${slug}.svg`,
  label: friendlyNameForSlug(slug),
  // Las cards de las puntas del abanico quedan muy cerca del borde de la
  // pantalla: si el nombre se centrara sobre ellas como en las del medio,
  // se saldría del viewport. Para esas se ancla hacia el lado con más aire
  // (izquierda pega su borde izquierdo a la card y crece hacia la derecha,
  // y viceversa).
  align: i < CENTER - 1 ? 'left' : i > CENTER + 1 ? 'right' : 'center',
}))
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
      // Un solo estado maneja tanto el hover (desktop) como el tap (mobile,
      // donde no hay :hover real) — así el z-index y el resto de la lógica
      // no se pisan entre sí ni dependen de que el CSS :hover "gane" sobre
      // el z-index inline, que siempre tiene prioridad.
      hoverIndex: null,
      tapIndex: null,
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
    isOpen(i) {
      return this.hoverIndex === i || this.tapIndex === i
    },
    toggle(i) {
      this.tapIndex = this.tapIndex === i ? null : i
    },
    onDocClick(e) {
      if (!this.$el.contains(e.target)) this.tapIndex = null
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
      :class="{ 'is-in': mounted, entered: entered, 'is-active': isOpen(i) }"
      :style="{ '--fan-angle': card.angle + 'deg', '--fan-x': card.x + 'px', transitionDelay: mounted ? '0ms' : card.delay + 'ms', zIndex: isOpen(i) ? 40 : card.z }"
      @click="toggle(i)"
      @mouseenter="hoverIndex = i"
      @mouseleave="hoverIndex = null"
    >
      <img :src="card.src" :alt="card.label" width="84" height="84" loading="lazy" />
      <span class="fan-name" :class="'fan-name--' + card.align" :style="{ '--fan-name-angle': (-card.angle) + 'deg' }">{{ card.label }}</span>
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
.fan-card.is-in.is-active {
  transform: translateX(-50%) translateX(var(--fan-x)) rotate(var(--fan-angle)) translateY(-14px) scale(1.1);
}

/* Nombre del juego: solo el nombre, nada de descripción — un cartelito
   chico arriba de la card. Contrarrota respecto de la card (inclinada por
   el abanico) para que el texto se lea siempre derecho. */
.fan-name {
  position: absolute;
  bottom: calc(100% + 8px);
  padding: 5px 10px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(11, 18, 32, 0.98);
  box-shadow: 0 10px 20px -6px rgba(0, 0, 0, 0.7);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease, transform 0.15s ease;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 700;
  color: #fff;
}
.fan-name--center {
  left: 50%;
  transform: translateX(-50%) rotate(var(--fan-name-angle)) translateY(4px);
  transform-origin: bottom center;
}
.fan-name--left {
  left: 0;
  transform: translateX(0) rotate(var(--fan-name-angle)) translateY(4px);
  transform-origin: bottom left;
}
.fan-name--right {
  right: 0;
  left: auto;
  transform: translateX(0) rotate(var(--fan-name-angle)) translateY(4px);
  transform-origin: bottom right;
}
.fan-card.is-in.is-active .fan-name--center {
  opacity: 1;
  transform: translateX(-50%) rotate(var(--fan-name-angle)) translateY(0);
}
.fan-card.is-in.is-active .fan-name--left {
  opacity: 1;
  transform: translateX(0) rotate(var(--fan-name-angle)) translateY(0);
}
.fan-card.is-in.is-active .fan-name--right {
  opacity: 1;
  transform: translateX(0) rotate(var(--fan-name-angle)) translateY(0);
}
</style>
