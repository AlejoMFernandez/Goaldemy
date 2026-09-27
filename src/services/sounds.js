const SOUND_FILES = {
  win: '/sounds/game-win.mp3',
  lose: '/sounds/game-lose.mp3',
  levelUp: '/sounds/level-up.mp3',
  achievement: '/sounds/achievement-unlock.mp3',
  correct: '/sounds/correct.mp3',
  incorrect: '/sounds/incorrect.mp3',
  tick: '/sounds/tick.mp3',
  click: '/sounds/click.mp3',
  combo: '/sounds/combo.mp3',
  claim: '/sounds/reward-claim.mp3',
  starReveal: '/sounds/star-reveal.mp3',
  timeUp: '/sounds/time-up.mp3',
  notify: '/sounds/notify.mp3',
  // Momentos de partido (moodboards 01/05). Si el mp3 no existe todavía,
  // se usa la versión sintetizada de _oscillatorFallback.
  whistle: '/sounds/whistle.mp3',            // pitazo corto (¡A jugar! / ¡Basta!)
  whistleFinal: '/sounds/whistle-final.mp3', // corto-corto-largo (sin tiempo)
  kickBeat: '/sounds/kick-beat.mp3',         // golpe grave del 3·2·1
  heartbeat: '/sounds/heartbeat.mp3',        // latido de los últimos 5 s
  swoosh: '/sounds/swoosh.mp3',              // cortina / telón
  slash: '/sounds/slash.mp3',                // 50/50
  shieldUp: '/sounds/shield-up.mp3',
  shieldBreak: '/sounds/shield-break.mp3',
  timeAdd: '/sounds/time-add.mp3',           // +15 s
  hint: '/sounds/hint.mp3',
  stamp: '/sounds/stamp.mp3',                // golpe del título final
  // Recompensas y nivel (moodboards 02/03/08)
  pum: '/sounds/pum.mp3',                    // ¡PUM! de nivel (golpe + brillo)
  pumSmall: '/sounds/pum-small.mp3',         // nivel intermedio cuando subís varios
  goal: '/sounds/goal.mp3',                  // ¡GOL! que abre el ascenso de rango
  forge: '/sounds/forge.mp3',                // el escudo nuevo se forja
  cardFlip: '/sounds/card-flip.mp3',         // carta que se da vuelta (común)
  cardRare: '/sounds/card-rare.mp3',
  cardEpic: '/sounds/card-epic.mp3',
  cardLegendary: '/sounds/card-legendary.mp3',
  coin: '/sounds/coin.mp3',                  // recompensa que llega a su contador
}

class SoundManager {
  constructor() {
    this.enabled = true
    this.volume = 0.3
    this._ctx = null
    this._buffers = {}
    this._loading = {}
    this._missing = new Set() // archivos que dieron 404: no se vuelven a pedir

    const stored = localStorage.getItem('goaldemy_sound_enabled')
    if (stored !== null) this.enabled = stored === 'true'
  }

  _getCtx() {
    if (!this._ctx) {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)()
    }
    if (this._ctx.state === 'suspended') this._ctx.resume()
    return this._ctx
  }

  async _loadFile(name) {
    if (this._buffers[name]) return this._buffers[name]
    if (this._loading[name]) return this._loading[name]
    if (this._missing.has(name)) return null

    const url = SOUND_FILES[name]
    if (!url) return null

    this._loading[name] = fetch(url)
      .then(r => {
        if (!r.ok) throw new Error(r.status)
        return r.arrayBuffer()
      })
      .then(buf => this._getCtx().decodeAudioData(buf))
      .then(decoded => {
        this._buffers[name] = decoded
        delete this._loading[name]
        return decoded
      })
      .catch(() => {
        delete this._loading[name]
        this._missing.add(name)
        return null
      })

    return this._loading[name]
  }

  _playBuffer(buffer, vol = 1) {
    const ctx = this._getCtx()
    const source = ctx.createBufferSource()
    const gain = ctx.createGain()
    source.buffer = buffer
    source.connect(gain)
    gain.connect(ctx.destination)
    gain.gain.value = this.volume * vol
    source.start(0)
  }

  _oscillatorFallback(name) {
    const ctx = this._getCtx()

    const makeOsc = (freq, type = 'sine', vol = 1, dur = 0.15, delay = 0) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      // Filtro lowpass para suavizar los armónicos ásperos (square/sawtooth)
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = Math.max(1200, freq * 4)
      osc.connect(filter)
      filter.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = freq
      osc.type = type
      const t = ctx.currentTime + delay
      const peak = this.volume * vol
      // Envolvente: ataque suave (evita clicks) + release exponencial
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
      osc.start(t)
      osc.stop(t + dur + 0.03)
    }

    // Pitazo: triangular ~2750 Hz con vibrato rápido (la "bolita" del silbato)
    const whistle = (dur = 0.4, delay = 0, vol = 0.9) => {
      const t = ctx.currentTime + delay
      const osc = ctx.createOscillator()
      const lfo = ctx.createOscillator()
      const lfoGain = ctx.createGain()
      const bp = ctx.createBiquadFilter()
      const gain = ctx.createGain()
      osc.type = 'triangle'; osc.frequency.value = 2750
      lfo.frequency.value = 32; lfoGain.gain.value = 160
      lfo.connect(lfoGain); lfoGain.connect(osc.frequency)
      bp.type = 'bandpass'; bp.frequency.value = 2750; bp.Q.value = 3
      osc.connect(bp); bp.connect(gain); gain.connect(ctx.destination)
      const peak = this.volume * vol
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + 0.015)
      gain.gain.setValueAtTime(Math.max(0.0002, peak), t + Math.max(0.02, dur - 0.07))
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
      osc.start(t); lfo.start(t); osc.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05)
    }
    // Golpe grave con caída de frecuencia (bombo / sello)
    const thump = (f0 = 150, f1 = 45, vol = 1, dur = 0.28, delay = 0) => {
      const t = ctx.currentTime + delay
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.setValueAtTime(f0, t)
      osc.frequency.exponentialRampToValueAtTime(f1, t + dur)
      osc.connect(gain); gain.connect(ctx.destination)
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, this.volume * vol), t + 0.006)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
      osc.start(t); osc.stop(t + dur + 0.05)
    }
    // Ruido filtrado (telón, tajo)
    const noise = (freq = 2000, q = 1, vol = 0.6, dur = 0.25, delay = 0) => {
      const t = ctx.currentTime + delay
      const len = Math.ceil(ctx.sampleRate * (dur + 0.05))
      const buf = ctx.createBuffer(1, len, ctx.sampleRate)
      const d = buf.getChannelData(0)
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
      const src = ctx.createBufferSource()
      const bp = ctx.createBiquadFilter()
      const gain = ctx.createGain()
      src.buffer = buf
      bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = q
      src.connect(bp); bp.connect(gain); gain.connect(ctx.destination)
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, this.volume * vol), t + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
      src.start(t); src.stop(t + dur + 0.05)
    }

    switch (name) {
      case 'whistle':
        whistle(0.5)
        break
      case 'whistleFinal':
        whistle(0.16); whistle(0.16, 0.3); whistle(0.8, 0.6)
        break
      case 'kickBeat':
        thump(160, 50, 1.4, 0.28)
        break
      case 'heartbeat':
        thump(70, 40, 1.1, 0.16); thump(70, 40, 0.8, 0.16, 0.18)
        makeOsc(1400, 'square', 0.25, 0.05)
        break
      case 'swoosh':
        noise(1400, 0.8, 0.5, 0.35)
        break
      case 'slash':
        noise(3500, 2, 0.6, 0.14)
        break
      case 'shieldUp':
        makeOsc(523.25, 'sine', 0.6, 0.4)
        makeOsc(783.99, 'sine', 0.5, 0.5, 0.1)
        break
      case 'shieldBreak':
        noise(4000, 0.8, 0.7, 0.2)
        makeOsc(659.25, 'triangle', 0.5, 0.3, 0.05)
        break
      case 'timeAdd':
        makeOsc(987.77, 'sine', 0.5, 0.15)
        makeOsc(1318.51, 'sine', 0.5, 0.2, 0.08)
        break
      case 'hint':
        makeOsc(1174.66, 'triangle', 0.45, 0.15)
        makeOsc(1567.98, 'triangle', 0.35, 0.2, 0.08)
        break
      case 'stamp':
        thump(130, 40, 1.6, 0.3)
        break
      case 'win':
        makeOsc(523.25, 'sine', 0.8, 0.25)
        makeOsc(659.25, 'sine', 0.8, 0.25, 0.12)
        makeOsc(783.99, 'sine', 0.9, 0.35, 0.24)
        break
      case 'lose':
        makeOsc(392, 'sine', 0.5, 0.3)
        makeOsc(311.13, 'sine', 0.4, 0.4, 0.15)
        break
      case 'levelUp':
        ;[261.63, 329.63, 392, 523.25, 659.25].forEach((f, i) =>
          makeOsc(f, 'sine', 0.7, 0.2, i * 0.08)
        )
        break
      case 'achievement':
        makeOsc(783.99, 'triangle', 0.5, 0.15)
        makeOsc(987.77, 'triangle', 0.5, 0.2, 0.1)
        makeOsc(1174.66, 'triangle', 0.6, 0.3, 0.2)
        break
      case 'correct':
        makeOsc(880, 'sine', 0.4, 0.12)
        break
      case 'incorrect':
        makeOsc(311.13, 'sawtooth', 0.2, 0.2)
        break
      case 'tick':
        makeOsc(1200, 'sine', 0.12, 0.04)
        break
      case 'click':
        makeOsc(1000, 'square', 0.2, 0.04)
        break
      case 'combo':
        makeOsc(880, 'sine', 0.4, 0.1)
        makeOsc(1108.73, 'sine', 0.5, 0.15, 0.06)
        break
      case 'claim':
        makeOsc(523.25, 'sine', 0.5, 0.1)
        makeOsc(659.25, 'sine', 0.5, 0.1, 0.05)
        makeOsc(783.99, 'sine', 0.6, 0.2, 0.1)
        break
      case 'starReveal':
        makeOsc(659.25, 'triangle', 0.5, 0.2)
        makeOsc(783.99, 'triangle', 0.6, 0.3, 0.1)
        break
      case 'timeUp':
        makeOsc(3200, 'sine', 0.5, 0.18)
        makeOsc(3200, 'sine', 0.6, 0.25, 0.22)
        break
      case 'pum':
        thump(120, 38, 1.8, 0.45)
        noise(900, 0.6, 0.5, 0.35)
        ;[523.25, 659.25, 783.99, 1046.5].forEach((f, i) => makeOsc(f, 'triangle', 0.45, 0.5, 0.05 + i * 0.03))
        break
      case 'pumSmall':
        thump(160, 60, 1, 0.2)
        makeOsc(880, 'triangle', 0.35, 0.18)
        break
      case 'goal':
        // "Tribuna": ruido ancho que crece + golpe
        noise(700, 0.4, 0.7, 1.6)
        noise(1800, 0.5, 0.35, 1.4, 0.1)
        thump(110, 40, 1.6, 0.4)
        break
      case 'forge':
        noise(5000, 3, 0.35, 0.5)
        ;[392, 523.25, 783.99, 1046.5, 1567.98].forEach((f, i) => makeOsc(f, 'sine', 0.4, 0.6, 0.15 + i * 0.07))
        break
      case 'cardFlip':
        noise(2600, 1.2, 0.35, 0.08)
        makeOsc(784, 'triangle', 0.35, 0.18, 0.05)
        break
      case 'cardRare':
        noise(2600, 1.2, 0.35, 0.08)
        makeOsc(988, 'triangle', 0.4, 0.22, 0.05)
        makeOsc(1318.5, 'triangle', 0.35, 0.25, 0.12)
        break
      case 'cardEpic':
        noise(2600, 1.2, 0.4, 0.08)
        ;[440, 554.37, 659.25, 880].forEach((f, i) => makeOsc(f, 'sine', 0.4, 0.7, 0.05 + i * 0.03))
        break
      case 'cardLegendary':
        thump(100, 40, 1.4, 0.35)
        ;[523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => makeOsc(f, 'sine', 0.45, 0.9, 0.08 + i * 0.05))
        break
      case 'coin':
        makeOsc(1318.5, 'square', 0.18, 0.06)
        makeOsc(1760, 'square', 0.2, 0.12, 0.05)
        break
      // ── Escenas de rareza / logros (moodboard 02) ──
      case 'riser':      // tensión corta (rara/épica)
      case 'riserLong': { // tensión larga (legendaria)
        const long = name === 'riserLong'
        const t = ctx.currentTime, dur = long ? 1.4 : 0.8
        const osc = ctx.createOscillator(), gain = ctx.createGain(), lp = ctx.createBiquadFilter()
        osc.type = 'sawtooth'; lp.type = 'lowpass'; lp.frequency.value = 1800
        osc.frequency.setValueAtTime(long ? 200 : 300, t)
        osc.frequency.exponentialRampToValueAtTime(long ? 1300 : 1100, t + dur)
        osc.connect(lp); lp.connect(gain); gain.connect(ctx.destination)
        gain.gain.setValueAtTime(0.0001, t)
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, this.volume * (long ? 0.22 : 0.14)), t + dur * 0.8)
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
        osc.start(t); osc.stop(t + dur + 0.05)
        break
      }
      case 'tear':       // papel que se rompe (sobre)
        noise(2400 + Math.random() * 1500, 2, 0.25, 0.05)
        break
      case 'tearDone':
        noise(2600, 0.7, 0.6, 0.2)
        thump(200, 60, 0.9, 0.2, 0.05)
        break
      case 'blip':       // tic del porcentaje que baja
        makeOsc(900 + Math.random() * 300, 'square', 0.12, 0.05)
        break
      case 'medalStamp': // la medalla golpea como un sello
        thump(150, 45, 1.5, 0.35)
        noise(3000, 0.8, 0.45, 0.12)
        break
      case 'notify':
        // Ding suave de dos notas (mensaje nuevo / solicitud de amistad)
        makeOsc(659.25, 'sine', 0.5, 0.12)
        makeOsc(987.77, 'sine', 0.55, 0.20, 0.08)
        break
    }
  }

  async play(name) {
    if (!this.enabled) return
    try {
      const buffer = await this._loadFile(name)
      if (buffer) {
        this._playBuffer(buffer)
      } else {
        this._oscillatorFallback(name)
      }
    } catch {
      try { this._oscillatorFallback(name) } catch {}
    }
  }

  toggle() {
    this.enabled = !this.enabled
    localStorage.setItem('goaldemy_sound_enabled', this.enabled)
    return this.enabled
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol))
  }
}

export const soundManager = new SoundManager()

export const playWinSound = () => soundManager.play('win')
export const playLoseSound = () => soundManager.play('lose')
export const playLevelUpSound = () => soundManager.play('levelUp')
export const playAchievementSound = () => soundManager.play('achievement')
export const playCorrectSound = () => soundManager.play('correct')
export const playIncorrectSound = () => soundManager.play('incorrect')
export const playTickSound = () => soundManager.play('tick')
export const playClickSound = () => soundManager.play('click')
export const playComboSound = () => soundManager.play('combo')
export const playClaimSound = () => soundManager.play('claim')
export const playStarRevealSound = () => soundManager.play('starReveal')
export const playTimeUpSound = () => soundManager.play('timeUp')
export const playNotifySound = () => soundManager.play('notify')
export const toggleSound = () => soundManager.toggle()
