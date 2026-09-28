<script>
// KickoffOverlay: "pitazo inicial" de los juegos contrarreloj (Moodboard 01).
// El círculo central y la línea de mitad de cancha se dibujan, cae el 3·2·1
// con golpes graves, suena el pitazo con "¡A jugar!" y el telón se abre por
// la mitad de la cancha. Emite `done` cuando el juego ya se ve: recién ahí
// arranca el reloj, así la ceremonia no le come segundos al jugador.
// Tocar la pantalla lo saltea (para quien juega todos los días).
import { soundManager } from '@/services/sounds'

const RM = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export default {
  name: 'KickoffOverlay',
  emits: ['done'],
  data() {
    return { phase: 'idle', num: '', open: false, go: false }
  },
  mounted() {
    if (RM) {
      this.go = true
      soundManager.play('whistle')
      this.t([[600, () => this.finish()]])
      return
    }
    this.phase = 'draw'
    this.t([
      [450, () => this.beat('3')],
      [1050, () => this.beat('2')],
      [1650, () => this.beat('1')],
      [2250, () => { this.num = ''; this.go = true; soundManager.play('whistle') }],
      [2700, () => { this.open = true; soundManager.play('swoosh') }],
      [3150, () => this.finish()],
    ])
  },
  beforeUnmount() { (this._timers || []).forEach(clearTimeout) },
  methods: {
    t(list) { this._timers = list.map(([ms, fn]) => setTimeout(fn, ms)) },
    beat(n) {
      this.num = n
      soundManager.play('kickBeat')
      const c = this.$refs.circ
      if (c) { c.classList.remove('ko-beat'); void c.getBoundingClientRect(); c.classList.add('ko-beat') }
    },
    finish() {
      if (this._done) return
      this._done = true
      ;(this._timers || []).forEach(clearTimeout)
      this.$emit('done')
    },
    skip() {
      if (this._done) return
      soundManager.play('whistle')
      this.finish()
    },
  },
}
</script>

<template>
  <Teleport to="body">
    <div class="ko" :class="{ 'ko-open': open, 'ko-draw': phase === 'draw' }" role="status" aria-live="assertive" @click="skip">
      <div class="ko-half ko-t"></div>
      <div class="ko-half ko-b"></div>
      <div class="ko-line"></div>
      <svg ref="circ" class="ko-circ" viewBox="0 0 100 100" aria-hidden="true">
        <circle class="ko-ring" cx="50" cy="50" r="48" pathLength="302" />
        <circle cx="50" cy="50" r="1.6" fill="rgba(255,255,255,.75)" />
      </svg>
      <div :key="num" class="ko-num" :class="{ 'ko-slam': num }">{{ num }}</div>
      <div class="ko-go" :class="{ 'ko-go-in': go }">¡A jugar!</div>
      <span class="ko-skip">Tocá para saltear</span>
    </div>
  </Teleport>
</template>

<style scoped>
.ko { position: fixed; inset: 0; z-index: 58; cursor: pointer; overflow: hidden; }
.ko-half {
  position: absolute; left: 0; right: 0; height: 50%;
  background: rgba(6, 8, 22, 0.78);
  -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
  transition: transform 0.62s cubic-bezier(.75, 0, .2, 1);
}
.ko-t { top: 0; }
.ko-b { bottom: 0; }
.ko-open .ko-t { transform: translateY(-101%); }
.ko-open .ko-b { transform: translateY(101%); }
.ko-line {
  position: absolute; top: 50%; left: 50%; height: 2px; width: 100%;
  background: rgba(255, 255, 255, 0.5); transform: translate(-50%, -50%);
}
.ko-draw .ko-line { animation: ko-grow 0.55s cubic-bezier(.16, 1, .3, 1) both; }
@keyframes ko-grow { from { width: 0; } to { width: 100%; } }
.ko-circ { position: absolute; left: 50%; top: 50%; width: min(52vw, 320px); aspect-ratio: 1; transform: translate(-50%, -50%); }
.ko-ring { fill: none; stroke: rgba(255, 255, 255, 0.5); stroke-width: 0.9; stroke-dasharray: 302; stroke-dashoffset: 0; }
.ko-draw .ko-ring { animation: ko-circle 0.7s cubic-bezier(.16, 1, .3, 1) both; }
@keyframes ko-circle { from { stroke-dashoffset: 302; } to { stroke-dashoffset: 0; } }
.ko-circ.ko-beat { animation: ko-beat 0.45s ease; }
@keyframes ko-beat { 30% { transform: translate(-50%, -50%) scale(1.09); } }
.ko-open .ko-line, .ko-open .ko-circ, .ko-open .ko-go, .ko-open .ko-skip { opacity: 0; transition: opacity 0.25s; }
.ko-num {
  position: absolute; inset: 0; display: grid; place-items: center;
  font-family: var(--font-shout); font-weight: 800; font-style: italic; font-size: min(40vw, 16rem); line-height: 1; color: #fff;
  text-shadow: 0 0.05em 0 rgba(0, 0, 0, 0.4); pointer-events: none;
}
.ko-slam { animation: ko-slam 0.6s cubic-bezier(.2, 0, 0, 1) both; }
@keyframes ko-slam {
  0% { opacity: 0; transform: scale(2.4); filter: blur(12px); }
  18% { opacity: 1; transform: scale(0.93); filter: blur(0); }
  28% { transform: scale(1); }
  78% { opacity: 1; }
  100% { opacity: 0; transform: scale(0.82); }
}
.ko-go {
  position: absolute; inset: 0; display: grid; place-items: center; pointer-events: none;
  font-family: var(--font-shout); font-weight: 800; font-style: italic; font-size: min(18vw, 7rem); color: var(--play-400, #fcd34d);
  text-transform: uppercase; white-space: nowrap; opacity: 0;
}
.ko-go-in { animation: ko-go 0.5s cubic-bezier(.16, 1, .3, 1) both; }
@keyframes ko-go { from { opacity: 0; letter-spacing: 0.45em; transform: scale(0.9); } to { opacity: 1; letter-spacing: 0.02em; transform: scale(1); } }
.ko-skip {
  position: absolute; left: 0; right: 0; bottom: max(18px, env(safe-area-inset-bottom, 0px)); text-align: center;
  font-family: var(--font-bug); font-weight: 700; font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase;
  color: rgba(255, 255, 255, 0.4); pointer-events: none;
}
@media (prefers-reduced-motion: reduce) {
  .ko-half { transition: none; }
}
</style>
