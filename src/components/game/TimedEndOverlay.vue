<script>
// TimedEndOverlay: final de los juegos contrarreloj (Moodboard 01).
//  · kind 'sin'   → SIN TIEMPO: triple pitazo, cortina roja, "te faltaron N".
//  · kind 'basta' → ¡BASTA!: llegaste al objetivo antes. Pitazo corto, cortina
//                   dorada y los segundos que sobraron se convierten en XP a la
//                   vista (ver services/time-bonus.js).
// El tablero ya quedó congelado en gris por el juego. Al terminar emite `done`
// y recién ahí se abre el resumen (GameSummaryPopup). Tocar lo adelanta.
import { soundManager } from '@/services/sounds'

const RM = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export default {
  name: 'TimedEndOverlay',
  emits: ['done'],
  props: {
    kind: { type: String, default: 'sin' },
    corrects: { type: Number, default: 0 },
    target: { type: Number, default: 10 },
    secondsLeft: { type: Number, default: 0 },
    bonus: { type: Object, default: null }, // { extra, xp }
  },
  data() {
    return { wipe: false, title: false, sub: false, shownSecs: this.secondsLeft, shownExtra: 0, shownXp: 0, canSkip: false }
  },
  computed: {
    basta() { return this.kind === 'basta' },
    missing() { return Math.max(0, this.target - this.corrects) },
  },
  mounted() {
    soundManager.play(this.basta ? 'whistle' : 'whistleFinal')
    const base = this.basta ? 250 : 650
    const list = [
      [base, () => { this.wipe = true; soundManager.play('swoosh') }],
      [base + 250, () => { this.title = true; this.canSkip = true; soundManager.play('stamp') }],
      [base + 650, () => { this.sub = true }],
    ]
    if (this.basta && this.bonus && this.bonus.extra > 0) {
      list.push([base + 1150, () => this.countBonus()])
      list.push([base + 1150 + Math.max(900, this.secondsLeft * 90) + 900, () => this.finish()])
    } else {
      list.push([base + 2100, () => this.finish()])
    }
    this._timers = list.map(([ms, fn]) => setTimeout(fn, RM ? Math.min(ms, 400) : ms))
  },
  beforeUnmount() {
    (this._timers || []).forEach(clearTimeout)
    clearInterval(this._iv)
  },
  methods: {
    countBonus() {
      const total = this.secondsLeft
      const extra = this.bonus.extra
      const per = this.bonus.xp / Math.max(1, extra)
      let s = total
      let last = 0
      this._iv = setInterval(() => {
        if (s <= 0) { clearInterval(this._iv); return }
        s--
        this.shownSecs = s
        const n = Math.round(((total - s) / total) * extra)
        if (n > last) { last = n; soundManager.play('timeAdd') } else soundManager.play('tick')
        this.shownExtra = n
        this.shownXp = Math.round(n * per)
      }, 90)
    },
    finish() {
      if (this._done) return
      this._done = true
      ;(this._timers || []).forEach(clearTimeout)
      clearInterval(this._iv)
      if (this.bonus) { this.shownExtra = this.bonus.extra; this.shownXp = this.bonus.xp; this.shownSecs = 0 }
      this.$emit('done')
    },
    skip() { if (this.canSkip) this.finish() },
  },
}
</script>

<template>
  <Teleport to="body">
    <div class="teo" :class="[basta ? 'teo-basta' : 'teo-sin']" role="status" aria-live="assertive" @click="skip">
      <div class="teo-wipe" :class="{ run: wipe }"><i></i><i></i><i></i></div>
      <div class="teo-box">
        <div class="teo-eyebrow" :class="{ on: title }">{{ basta ? `${target} de ${target} con ${secondsLeft} s de sobra` : 'Final del partido' }}</div>
        <div class="teo-title" :class="{ on: title }">{{ basta ? '¡Basta!' : 'Sin tiempo' }}</div>
        <div class="teo-sub" :class="{ on: sub }">
          <template v-if="basta && bonus && bonus.extra > 0">
            <span class="teo-bonus">⏱ <b class="tabular-nums">0:{{ String(shownSecs).padStart(2, '0') }}</b> = <b class="tabular-nums">{{ shownExtra }}</b> aciertos más → <b class="tabular-nums">+{{ shownXp }} XP</b></span>
          </template>
          <template v-else-if="basta">¡Objetivo cumplido!</template>
          <template v-else>{{ corrects }} de {{ target }} · te {{ missing === 1 ? 'faltó' : 'faltaron' }} <b>{{ missing }}</b></template>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.teo { position: fixed; inset: 0; z-index: 56; display: grid; place-items: center; background: rgba(4, 6, 18, 0.45); overflow: hidden; cursor: pointer; }
.teo-wipe { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
.teo-wipe i { position: absolute; top: -20%; height: 140%; width: 38%; left: 0; transform: translateX(-160%) skewX(-18deg); }
.teo-wipe i:nth-child(1) { background: var(--play-400, #fcd34d); }
.teo-wipe i:nth-child(2) { background: #fff; }
.teo-wipe i:nth-child(3) { background: var(--mb-800, #141a38); }
.teo-sin .teo-wipe i:nth-child(1) { background: var(--mb-danger, #ef4444); }
.teo-wipe.run i { animation: teo-wipe 0.75s cubic-bezier(.7, 0, .25, 1) both; }
.teo-wipe.run i:nth-child(2) { animation-delay: 0.07s; }
.teo-wipe.run i:nth-child(3) { animation-delay: 0.14s; }
@keyframes teo-wipe { from { transform: translateX(-160%) skewX(-18deg); } to { transform: translateX(360%) skewX(-18deg); } }
.teo-box { position: relative; display: grid; justify-items: center; gap: 10px; text-align: center; padding: 0 16px; }
.teo-eyebrow { font-family: var(--font-bug); font-weight: 800; text-transform: uppercase; letter-spacing: 0.2em; font-size: clamp(12px, 2.4vw, 16px); color: #fff; opacity: 0; transition: opacity 0.4s 0.2s; }
.teo-title {
  position: relative; font-family: var(--font-shout); text-transform: uppercase; line-height: 0.95;
  font-size: clamp(56px, 16vw, 150px); color: #fff; padding: 0 0.2em; clip-path: inset(0 100% 0 0);
}
.teo-title::before { content: ""; position: absolute; inset: 18% -0.1em 10%; background: var(--mb-danger, #ef4444); transform: skewX(-12deg); z-index: -1; }
.teo-basta .teo-title { color: #141005; }
.teo-basta .teo-title::before { background: var(--play-400, #fcd34d); }
.teo-title.on { animation: teo-reveal 0.45s cubic-bezier(.16, 1, .3, 1) forwards; }
@keyframes teo-reveal { to { clip-path: inset(0 0 0 0); } }
.teo-eyebrow.on, .teo-sub.on { opacity: 0.9; }
.teo-sub { font-family: var(--font-bug); font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; font-size: clamp(14px, 2.6vw, 20px); color: #dfe4ff; opacity: 0; transition: opacity 0.4s; }
.teo-sub b { color: var(--play-400, #fcd34d); }
.teo-bonus { display: inline-flex; gap: 8px; align-items: center; flex-wrap: wrap; justify-content: center; background: rgba(252, 211, 77, 0.12); border: 1px solid rgba(252, 211, 77, 0.4); border-radius: 999px; padding: 6px 16px; color: var(--play-400, #fcd34d); }
@media (prefers-reduced-motion: reduce) {
  .teo-wipe { display: none; }
  .teo-title { clip-path: none; }
}
</style>
