<script>
// GameShell: contenedor compartido para que un juego ocupe TODO el alto visible
// (100dvh - navbar) y quede centrado, sin obligar al usuario a scrollear. Expone
// un sub-header fino (volver + título + stat) para no comer espacio del juego.
//
// Requiere que la ruta tenga meta.immersive = true → App.vue le saca el padding
// vertical al <main> para esa ruta. Sin eso, el shell igual funciona pero arranca
// más abajo por el padding.
export default {
  name: 'GameShell',
  props: {
    title: { type: String, default: '' },
    backPath: { type: String, default: '/play/points' },
    // Etiqueta contextual bajo el título (opcional)
    subtitle: { type: String, default: '' },
  },
  data() {
    return { availH: null, _onResize: null }
  },
  computed: {
    shellStyle() {
      return this.availH ? { height: this.availH + 'px' } : { minHeight: 'calc(100dvh - 4.6rem)' }
    },
  },
  methods: {
    // Medimos la ALTURA DEL NAVBAR (estable) en vez de la posición del shell.
    // La posición del shell (rect.top) es poco confiable al montar: si la página
    // está scrolleada o en medio de la transición de ruta, top sale negativo y el
    // alto quedaba ENORME. La altura del navbar no depende del scroll ni de la
    // transición, así que es inmune a ese timing.
    measure() {
      if (typeof window === 'undefined') return
      const nav = document.querySelector('nav')
      const navH = nav ? Math.round(nav.getBoundingClientRect().height) : 74
      this.availH = Math.max(320, Math.round(window.innerHeight - navH))
    },
    scheduleMeasure() {
      this.$nextTick(() => {
        // Doble rAF: medir después de que el navegador pintó el layout.
        requestAnimationFrame(() => requestAnimationFrame(() => this.measure()))
      })
    },
  },
  mounted() {
    this.scheduleMeasure()
    // Re-medir tras la transición de ruta y cuando termina de cargar todo.
    setTimeout(() => this.measure(), 220)
    setTimeout(() => this.measure(), 550)
    this._onResize = () => this.measure()
    window.addEventListener('resize', this._onResize)
    window.addEventListener('orientationchange', this._onResize)
  },
  beforeUnmount() {
    if (this._onResize) {
      window.removeEventListener('resize', this._onResize)
      window.removeEventListener('orientationchange', this._onResize)
    }
  },
}
</script>

<template>
  <div class="game-shell" :style="shellStyle">
    <!-- Sub-header integrado -->
    <div class="gs-header">
      <router-link :to="backPath" class="gs-back" aria-label="Volver">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        <span class="hidden sm:inline">Volver</span>
      </router-link>

      <div class="gs-title-wrap">
        <h1 class="gs-title">{{ title }}</h1>
        <span v-if="subtitle" class="gs-subtitle">{{ subtitle }}</span>
      </div>

      <div class="gs-stat">
        <slot name="stat" />
      </div>
    </div>

    <!-- Cuerpo centrado -->
    <div class="gs-body">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.game-shell {
  display: flex;
  flex-direction: column;
  width: 100%;
}
.gs-header {
  flex: none;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.25rem 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.gs-back {
  justify-self: start;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border-radius: 9999px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  padding: 0.35rem 0.7rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: rgb(226, 232, 240);
  transition: background-color 0.2s ease, border-color 0.2s ease;
}
.gs-back:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(52, 211, 153, 0.4);
}
.gs-title-wrap {
  justify-self: center;
  text-align: center;
  min-width: 0;
}
.gs-title {
  font-family: var(--font-display, inherit);
  font-weight: 800;
  color: #fff;
  line-height: 1.05;
  font-size: clamp(1.05rem, 3.5vw, 1.6rem);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.gs-subtitle {
  display: block;
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgb(148, 163, 184);
  margin-top: 1px;
}
.gs-stat {
  justify-self: end;
}
.gs-body {
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  place-items: center;
  padding: 0.75rem 0;
  overflow: auto;
}
</style>
