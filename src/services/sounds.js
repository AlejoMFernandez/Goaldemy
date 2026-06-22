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
}

class SoundManager {
  constructor() {
    this.enabled = true
    this.volume = 0.3
    this._ctx = null
    this._buffers = {}
    this._loading = {}

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

    switch (name) {
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
export const toggleSound = () => soundManager.toggle()
