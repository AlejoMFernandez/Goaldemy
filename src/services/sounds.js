/**
 * SISTEMA DE SONIDOS
 * 
 * Maneja todos los efectos de sonido de la aplicación usando Web Audio API.
 * 
 * POR QUÉ WEB AUDIO API:
 * - Latencia ultra-baja (más rápido que <audio> tags)
 * - Control preciso de frecuencia, volumen y duración
 * - Genera tonos sin archivos externos (más liviano)
 * - Soporta múltiples sonidos simultáneos sin conflictos
 * 
 * SONIDOS DISPONIBLES:
 * - win: Victoria (C5 + E5, tono ascendente alegre)
 * - lose: Derrota (tono descendente triste)
 * - levelUp: Subida de nivel (secuencia de 3 tonos ascendentes)
 * - achievement: Logro desbloqueado (campana/chime)
 * - click: Click genérico (feedback táctil)
 * - correct: Respuesta correcta (tono positivo corto)
 * 
 * IMPLEMENTACIÓN:
 * - Usa Oscillator nodes para generar tonos puros
 * - GainNode para controlar volumen con fade-out
 * - Se guarda preferencia de usuario en localStorage
 * 
 * CONTROL DE USUARIO:
 * - this.enabled: true/false para activar/desactivar
 * - this.volume: 0.0-1.0 para controlar volumen global
 * - Preferencia persiste en localStorage ('goaldemy_sound_enabled')
 * 
 * EJEMPLO DE USO:
 *   import { soundManager } from './sounds'
 *   soundManager.play('win')
 *   soundManager.setEnabled(false) // silenciar
 */

/**
 * Gestor singleton de efectos de sonido
 */
class SoundManager {
  constructor() {
    this.enabled = true
    this.volume = 0.3
    this.sounds = {}
    
    // Load sound effects (using online sources or data URLs)
    this.soundUrls = {
      win: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjWL0PLLfS8GK3vG8OCQQQoVXrXp7Kn=',
      lose: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjWL0PLLfS8GK3vG8OCQQQoVXrXp7Kn=',
      levelUp: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjWL0PLLfS8GK3vG8OCQQQoVXrXp7Kn=',
      achievement: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjWL0PLLfS8GK3vG8OCQQQoVXrXp7Kn=',
      click: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjWL0PLLfS8GK3vG8OCQQQoVXrXp7Kn=',
      correct: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjWL0PLLfS8GK3vG8OCQQQoVXrXp7Kn='
    }
    
    // Try to load from localStorage
    const stored = localStorage.getItem('goaldemy_sound_enabled')
    if (stored !== null) {
      this.enabled = stored === 'true'
    }
  }

  /**
   * Play a sound effect
   * @param {'win'|'lose'|'levelUp'|'achievement'|'click'|'correct'} soundName 
   */
  play(soundName) {
    if (!this.enabled) return
    
    try {
      // Create oscillator for simple beep sounds (more reliable than loading files)
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      // Configure sound based on type
      switch(soundName) {
        case 'win':
          oscillator.frequency.value = 523.25 // C5
          gainNode.gain.setValueAtTime(this.volume, audioContext.currentTime)
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)
          oscillator.start(audioContext.currentTime)
          oscillator.stop(audioContext.currentTime + 0.3)
          // Second note
          setTimeout(() => {
            const osc2 = audioContext.createOscillator()
            const gain2 = audioContext.createGain()
            osc2.connect(gain2)
            gain2.connect(audioContext.destination)
            osc2.frequency.value = 659.25 // E5
            gain2.gain.setValueAtTime(this.volume, audioContext.currentTime)
            gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)
            osc2.start(audioContext.currentTime)
            osc2.stop(audioContext.currentTime + 0.3)
          }, 150)
          break
          
        case 'lose':
          oscillator.frequency.value = 196 // G3
          gainNode.gain.setValueAtTime(this.volume * 0.7, audioContext.currentTime)
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)
          oscillator.start(audioContext.currentTime)
          oscillator.stop(audioContext.currentTime + 0.5)
          break
          
        case 'levelUp':
          // Ascending arpeggio
          const notes = [261.63, 329.63, 392, 523.25] // C4, E4, G4, C5
          notes.forEach((freq, i) => {
            setTimeout(() => {
              const osc = audioContext.createOscillator()
              const gain = audioContext.createGain()
              osc.connect(gain)
              gain.connect(audioContext.destination)
              osc.frequency.value = freq
              gain.gain.setValueAtTime(this.volume * 0.8, audioContext.currentTime)
              gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2)
              osc.start(audioContext.currentTime)
              osc.stop(audioContext.currentTime + 0.2)
            }, i * 100)
          })
          break
          
        case 'achievement':
          oscillator.frequency.value = 783.99 // G5
          oscillator.type = 'triangle'
          gainNode.gain.setValueAtTime(this.volume * 0.6, audioContext.currentTime)
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4)
          oscillator.start(audioContext.currentTime)
          oscillator.stop(audioContext.currentTime + 0.4)
          break
          
        case 'correct':
          oscillator.frequency.value = 880 // A5
          oscillator.type = 'sine'
          gainNode.gain.setValueAtTime(this.volume * 0.5, audioContext.currentTime)
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15)
          oscillator.start(audioContext.currentTime)
          oscillator.stop(audioContext.currentTime + 0.15)
          break
          
        case 'click':
          oscillator.frequency.value = 1000
          oscillator.type = 'square'
          gainNode.gain.setValueAtTime(this.volume * 0.3, audioContext.currentTime)
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05)
          oscillator.start(audioContext.currentTime)
          oscillator.stop(audioContext.currentTime + 0.05)
          break
      }
    } catch (e) {
      console.warn('[Sound] Error playing:', e)
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

// Singleton instance
export const soundManager = new SoundManager()

// Convenience exports
export const playWinSound = () => soundManager.play('win')
export const playLoseSound = () => soundManager.play('lose')
export const playLevelUpSound = () => soundManager.play('levelUp')
export const playAchievementSound = () => soundManager.play('achievement')
export const playCorrectSound = () => soundManager.play('correct')
export const playClickSound = () => soundManager.play('click')
export const toggleSound = () => soundManager.toggle()
