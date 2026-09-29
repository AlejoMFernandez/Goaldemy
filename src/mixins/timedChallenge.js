/**
 * MIXIN · Partida contrarreloj (Moodboards 01 + 05)
 *
 * Comparte entre los 4 juegos contrarreloj (Adiviná, Nacionalidad, Posición,
 * Camiseta) todo lo que NO es lógica propia del juego:
 *   · Pitazo inicial (KickoffOverlay) → el reloj arranca recién cuando termina.
 *   · Reloj del ScoreBug, últimos 5 s y sacudida en 2 y 1.
 *   · Final "SIN TIEMPO" y "¡BASTA!" (el juego termina al llegar a 10 y los
 *     segundos sobrantes se convierten en XP, ver services/time-bonus.js).
 *   · Feedback por respuesta: pelota a la fila de 10, XP al marcador, borde rojo
 *     al errar, carteles de racha, humo al perderla.
 *   · Ayudas que se ven actuar (50/50, escudo, +15 s, pista).
 *
 * Contrato con el componente que lo usa (Options API):
 *   data:    timeLeft, chosenSeconds, timer, timeOver, corrects, attempts, streak,
 *            xpEarned, allowXp, difficultyConfig, mode, answered, options,
 *            shieldActive, eliminatedOptions, hintVisible, current
 *   methods: nextRound(), finishChallenge(result), isCorrectOption(opt)
 *   refs:    card (tarjeta del jugador), bug (ScoreBug)
 *   template: botones de opción con data-opt="String(opt.value)"
 */
import { soundManager } from '../services/sounds'
import { computeTimeBonus } from '../services/time-bonus'
import * as fx from '../services/game-fx'

export const TIMED_TARGET = 10
export const NEXT_DELAY_OK = 600
export const NEXT_DELAY_BAD = 1100

const STREAK_MILESTONES = {
  3: { text: '¡En racha!', color: '#fdba74' },
  5: { text: '¡En llamas!', color: '#fcd34d' },
  10: { text: '¡Imparable!', color: '#7dd3fc' },
}

export default {
  data() {
    return {
      kickoff: false,
      clockRunning: false,
      clockTotal: 0,
      endOverlay: null, // props de TimedEndOverlay mientras se muestra
      frozen: false,
      timeBonusInfo: null,
      // Datos para los logros (achievement-rules.js): se guardan en la sesión
      powerupsUsed: 0,
      shieldSaves: 0,
      timedResult: null,
    }
  },
  computed: {
    // Resumen (moodboard 07): de dónde salió el XP y cuántos errores hubo
    xpBreakdown() {
      const bonus = this.timeBonusInfo?.xp || 0
      const rows = []
      const base = Math.max(0, (this.xpEarned || 0) - bonus)
      if (base > 0) rows.push({ kind: 'ball', label: `${this.corrects || 0} aciertos`, xp: base })
      if (bonus > 0) rows.push({ kind: 'clock', label: `¡Basta! ${this.timeBonusInfo.secondsLeft} s`, xp: bonus })
      return rows
    },
    summaryErrors() {
      return Math.max(0, (this.attempts || 0) - (this.corrects || 0))
    },
  },
  beforeUnmount() {
    clearInterval(this.timer)
    clearTimeout(this._advanceT)
  },
  methods: {
    // ─── Reloj ───────────────────────────────────────────────
    beginClock(seconds) {
      clearInterval(this.timer)
      this.timeLeft = seconds
      this.chosenSeconds = seconds
      this.clockTotal = seconds
      this.timeOver = false
      this.frozen = false
      this.endOverlay = null
      this.timeBonusInfo = null
      this.powerupsUsed = 0
      this.shieldSaves = 0
      this.timedResult = null
      this.clockRunning = false
      this.kickoff = true
    },
    onKickoffDone() {
      this.kickoff = false
      this.clockRunning = true
      clearInterval(this.timer)
      this.timer = setInterval(() => this.clockTick(), 1000)
    },
    clockTick() {
      if (this.timeOver) return
      if (this.timeLeft > 0) this.timeLeft -= 1
      if (this.timeLeft > 0 && this.timeLeft <= 2) fx.jolt(this.$refs.card)
      if (this.timeLeft <= 0) this.endByTime()
    },
    addTime(seconds) {
      this.timeLeft = Math.min(this.timeLeft + seconds, 999)
      this.clockTotal += seconds
    },

    // ─── Finales ─────────────────────────────────────────────
    stopClock() {
      this.timeOver = true
      this.clockRunning = false
      clearInterval(this.timer)
      clearTimeout(this._advanceT)
      this.frozen = true
    },
    /**
     * Congela lo que los logros necesitan saber del reloj, EN EL INSTANTE del final
     * (finishChallenge es async y arma su patch recién después de varios await; para
     * entonces endOverlay/timeLeft ya pueden haber cambiado).
     */
    recordTimedResult(basta) {
      const left = Math.max(0, Math.floor(this.timeLeft) || 0)
      this.timedResult = {
        basta,
        secondsLeft: left,
        secondsUsed: Math.max(0, (this.clockTotal || 0) - left),
        powerups: this.powerupsUsed || 0,
        shieldSaves: this.shieldSaves || 0,
      }
    },
    /** Metadata de sesión para logros: `...this.timedStats()` en el patch de completeChallengeSession. */
    timedStats() {
      return this.timedResult ? { ...this.timedResult, difficulty: this.selectedDifficulty || null } : {}
    },
    endByTime() {
      if (this.timeOver) return
      this.stopClock()
      this.recordTimedResult(false)
      const win = (this.corrects || 0) >= TIMED_TARGET
      this.endOverlay = { kind: 'sin', corrects: this.corrects || 0, target: TIMED_TARGET }
      this.finishChallenge(win ? 'win' : 'loss')
    },
    endByBasta() {
      if (this.timeOver) return
      this.stopClock()
      this.recordTimedResult(true)
      const bonus = computeTimeBonus({
        secondsUsed: this.clockTotal - this.timeLeft,
        secondsLeft: this.timeLeft,
        corrects: this.corrects,
        attempts: this.attempts,
        xpPerCorrect: this.difficultyConfig?.xpPerCorrect || 10,
      })
      if (!this.allowXp) { bonus.extra = 0; bonus.xp = 0 }
      this.timeBonusInfo = bonus
      if (bonus.xp > 0) this.xpEarned += bonus.xp
      this.endOverlay = { kind: 'basta', corrects: this.corrects, target: TIMED_TARGET, secondsLeft: this.timeLeft, bonus }
      this.finishChallenge('win')
    },
    onEndOverlayDone() {
      this.endOverlay = null
    },

    // ─── Rondas ──────────────────────────────────────────────
    optEl(value) {
      if (!this.$el?.querySelector) return null
      const v = window.CSS?.escape ? CSS.escape(String(value)) : String(value).replace(/"/g, '\\"')
      return this.$el.querySelector(`[data-opt="${v}"]`)
    },
    advanceRound(delay) {
      clearTimeout(this._advanceT)
      this._advanceT = setTimeout(() => {
        if (this.timeOver && this.mode === 'challenge') return
        this.nextRound()
        this.eliminatedOptions = []
        this.hintVisible = false
      }, delay)
    },
    /**
     * Feedback después de responder (sin escudo de por medio).
     * xpGained: XP que sumó esta respuesta (0 si fue error o modo libre).
     * prevStreak: racha ANTES de responder (para el humo al perderla).
     */
    afterAnswer(ok, { optValue, xpGained = 0, prevStreak = 0 } = {}) {
      const timed = this.mode === 'challenge'
      const bug = this.$refs.bug
      const card = this.$refs.card
      if (ok) {
        if (bug && card) {
          const idx = Math.min(this.corrects, TIMED_TARGET) - 1
          if (idx >= 0) {
            fx.flyTo({ from: card, to: bug.ballEl(idx), html: fx.BALL_SVG, className: 'gfx-ball', duration: 450 })
              .then(() => { bug.popBall(idx); const c = fx.center(bug.ballEl(idx)); fx.sparks(c.x, c.y, 6, ['#fff', '#a7f3d0'], 24) })
          }
          const opt = this.optEl(optValue)
          if (xpGained > 0 && opt) {
            fx.flyTo({ from: opt, to: bug.xpEl(), html: `+${xpGained} XP`, className: 'gfx-xp', duration: 520 })
              .then(() => bug.bumpXp())
          }
        }
        const m = STREAK_MILESTONES[this.streak]
        if (m && card) {
          fx.burstText(card, `${m.text} ×${this.streak}`, m.color)
          soundManager.play('combo')
          if (bug) { const c = fx.center(bug.flameEl()); fx.sparks(c.x, c.y, 16, [m.color, '#fff'], 50) }
        }
        if (timed && (this.corrects || 0) >= TIMED_TARGET) {
          clearInterval(this.timer) // el reloj se clava acá: los segundos que quedan son el bonus
          setTimeout(() => this.endByBasta(), 450)
          return
        }
        this.advanceRound(NEXT_DELAY_OK)
      } else {
        fx.flashEdge()
        if (prevStreak >= 3 && bug) fx.smoke(bug.flameEl())
        this.advanceRound(NEXT_DELAY_BAD)
      }
    },
    /** El escudo frenó un error: la respuesta no cuenta y la racha se mantiene. */
    afterShieldSave() {
      this.shieldSaves += 1
      const card = this.$refs.card
      fx.shatter(card)
      fx.burstText(card, '¡Salvado!', '#7dd3fc')
      soundManager.play('shieldBreak')
      this.advanceRound(NEXT_DELAY_BAD)
    },

    // ─── Ayudas ──────────────────────────────────────────────
    async runPowerup(type, btnEl) {
      const card = this.$refs.card
      const bug = this.$refs.bug
      if (type === 'fifty_fifty') {
        if (this.options.length <= 2) return
        const wrong = this.options.filter(o => !this.isCorrectOption(o)).slice(0, 2).map(o => o.value)
        this.powerupsUsed += 1
        soundManager.play('slash')
        await Promise.all(wrong.map((v, i) => fx.slashOut(this.optEl(v), i * 170)))
        this.eliminatedOptions = wrong
      } else if (type === 'shield') {
        this.powerupsUsed += 1
        this.shieldActive = true
        soundManager.play('shieldUp')
        if (btnEl && card) fx.flyTo({ from: btnEl, to: card, html: '🛡', className: 'gfx-emoji', duration: 420 })
      } else if (type === 'extra_time') {
        if (this.timeOver) return
        this.powerupsUsed += 1
        const clock = bug?.clockEl?.()
        if (btnEl && clock) await fx.flyTo({ from: btnEl, to: clock, html: '+15', className: 'gfx-time', duration: 520 })
        if (this.timeOver) return
        this.addTime(15)
        bug?.flashPlus?.()
        soundManager.play('timeAdd')
      } else if (type === 'reveal_hint') {
        this.powerupsUsed += 1
        this.hintVisible = true
        soundManager.play('hint')
        if (card) { const c = fx.center(card); fx.sparks(c.x + c.w * 0.35, c.y - c.h * 0.42, 12, ['#fcd34d', '#fff'], 40) }
      }
    },
  },
}
