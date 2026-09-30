<script>
// ScoreBug: marcador tipo transmisión de TV para los juegos contrarreloj
// (Moodboard 01 + 05). Reemplaza a CircularTimer + StreakBadge dentro de la
// partida: reloj, aciertos, escudo, XP, fila de 10 pelotas y llama de racha.
//
// Expone elementos para que los efectos "viajen" hasta acá:
//   clockEl()  → el reloj (el +15 s vuela hasta él)
//   xpEl()     → el contador de XP (el +XP vuela hasta él)
//   ballEl(i)  → la pelota i de la fila (la pelota del acierto vuela hasta ella)
//   flameEl()  → la llama (humo cuando se pierde la racha)
// y métodos para cerrar el vuelo: popBall(), bumpXp(), flashPlus().
import { soundManager } from '@/services/sounds'

export default {
  name: 'ScoreBug',
  props: {
    timed: { type: Boolean, default: true },
    seconds: { type: Number, default: 0 },
    running: { type: Boolean, default: false },
    corrects: { type: Number, default: 0 },
    target: { type: Number, default: 10 },
    xp: { type: Number, default: 0 },
    streak: { type: Number, default: 0 },
    shield: { type: Boolean, default: false },
    finished: { type: String, default: '' }, // '' | 'sin' | 'basta'
    // Modo vidas (¿Quién es?, moodboard 09 sección 01): corazones en vez de
    // la fila de pelotas, sin fila de aciertos/objetivo ni llama de racha.
    livesMode: { type: Boolean, default: false },
    lives: { type: Number, default: 0 },
    maxLives: { type: Number, default: 3 },
    // Modo cadena (Mayor o menor, sección 02): eslabones en vez de pelotas.
    // Usa target/corrects existentes como largo objetivo/actual de la cadena.
    chainMode: { type: Boolean, default: false },
    // Modo tarjetas (Conexiones, sección 03): tarjetas de error en vez de
    // pelotas. Las primeras maxMistakes-1 se apagan; la última se pone roja
    // y termina el partido.
    cardsMode: { type: Boolean, default: false },
    mistakes: { type: Number, default: 0 },
    maxMistakes: { type: Number, default: 3 },
  },
  data() {
    return { shownBalls: 0, plus: false, entered: !this.timed, xpBump: 0 }
  },
  computed: {
    clockText() {
      if (!this.timed) return '—'
      const s = Math.max(0, this.seconds)
      return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
    },
    red() { return this.timed && this.running && this.seconds <= 5 && this.seconds > 0 && !this.finished },
    tier() {
      const s = this.streak
      return s >= 10 ? 3 : s >= 5 ? 2 : s >= 3 ? 1 : 0
    },
    tierLabel() { return ['', 'En racha', 'En llamas', 'Imparable'][this.tier] },
  },
  watch: {
    running(v) { if (v) this.entered = true },
    corrects(n) { if (n < this.shownBalls) this.shownBalls = n },
    seconds(s, old) {
      // Últimos 5 segundos: latido + viñeta roja que crece
      if (!this.timed || !this.running || this.finished) return
      if (s < old && s <= 5 && s > 0) {
        soundManager.play('heartbeat')
        const v = this.$refs.vig
        if (v) {
          v.style.setProperty('--i', (0.22 + (5 - s) * 0.1).toFixed(2))
          v.classList.remove('beat'); void v.offsetWidth; v.classList.add('beat')
        }
        const c = this.$refs.clock
        if (c) { c.classList.remove('sbug-pop'); void c.offsetWidth; c.classList.add('sbug-pop') }
      }
    },
  },
  methods: {
    clockEl() { return this.$refs.clock || this.$el },
    xpEl() { return this.$refs.xp || this.$el },
    flameEl() { return this.$refs.flame || this.$el },
    ballEl(i) { return this.$el?.querySelector?.(`[data-ball="${i}"]`) || this.$el },
    popBall(i) { this.shownBalls = Math.max(this.shownBalls, Math.min(this.target, i + 1)) },
    syncBalls() { this.shownBalls = Math.min(this.target, this.corrects) },
    bumpXp() { this.xpBump++ },
    flashPlus() { this.plus = true; setTimeout(() => { this.plus = false }, 650) },
    // Tarjeta i (1-based): '' = intacta, 'gone' = ya usada (apagada), 'used' = la última (roja).
    cardClass(i) {
      if (i > this.mistakes) return ''
      if (i === this.maxMistakes && this.mistakes >= this.maxMistakes) return 'used'
      return 'gone'
    },
    // Rompe la cadena eslabón por eslabón (40ms de diferencia) — llamar ANTES
    // de resetear `corrects` a 0 en el juego, así se ve la caída.
    breakChain() {
      const els = this.$el?.querySelectorAll?.('.sbug-chain i') || []
      for (let j = 0; j < this.corrects; j++) {
        setTimeout(() => els[j]?.classList.add('broken'), j * 40)
      }
    },
  },
}
</script>

<template>
  <div class="sbug-wrap" :class="{ 'is-in': entered }">
    <div class="sbug">
      <span class="sbug-f">F</span>
      <span v-if="timed" ref="clock" class="sbug-clock" :class="{ 'is-red': red || finished === 'sin', 'is-plus': plus, 'is-gold': finished === 'basta' }">{{ clockText }}</span>
      <span v-if="livesMode" class="sbug-lives" :aria-label="`${lives} de ${maxLives} vidas`">
        <svg v-for="i in maxLives" :key="i" :class="{ off: i > lives }" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.8 1.1 5.3 2.8 1.5-1.7 3.2-2.8 5.3-2.8 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z"/></svg>
      </span>
      <span v-if="!livesMode" class="sbug-count">{{ corrects }}/{{ target }}</span>
      <span v-if="shield" class="sbug-shield" title="Escudo activo">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 2.8v5c0 4.5-3 7.6-7 9.2-4-1.6-7-4.7-7-9.2v-5z"/><path d="M8.7 12.2l2.3 2.3 4.3-4.6"/></svg>
      </span>
      <span ref="xp" :key="'xp' + xpBump" class="sbug-xp" :class="{ 'sbug-pop': xpBump > 0 }">XP <b>{{ xp }}</b></span>
    </div>
    <div v-if="!livesMode" class="sbug-side">
      <div v-if="chainMode" class="sbug-chain" :aria-label="`${corrects} de ${target} en la cadena`">
        <i v-for="i in target" :key="i" :class="{ on: i <= corrects }"></i>
      </div>
      <div v-else-if="cardsMode" class="sbug-cards" :aria-label="`${mistakes} de ${maxMistakes} errores`">
        <i v-for="i in maxMistakes" :key="i" :class="cardClass(i)"></i>
      </div>
      <div v-else class="sbug-balls" :aria-label="`${corrects} de ${target} aciertos`">
        <i v-for="i in target" :key="i" :data-ball="i - 1" :class="{ on: i <= shownBalls }"></i>
      </div>
      <div v-if="!chainMode && !cardsMode" ref="flame" class="sbug-flame" :data-t="tier" :title="`Racha ×${streak}`">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67z"/></svg>
        <span class="tabular-nums">×{{ streak }}</span>
        <span v-if="tierLabel" class="sbug-flame-lb">{{ tierLabel }}</span>
      </div>
    </div>
    <Teleport to="body"><div ref="vig" class="sbug-vig" aria-hidden="true"></div></Teleport>
  </div>
</template>
