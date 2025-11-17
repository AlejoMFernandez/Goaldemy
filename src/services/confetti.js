/**
 * Simple confetti celebration effect
 * Creates colorful confetti particles that fall from top
 */

export function triggerConfetti(options = {}) {
  console.log('🎉 Confetti triggered!', options)
  const {
    duration = 4000,
    particleCount = 80,
    colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4']
  } = options

  const container = document.createElement('div')
  container.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
    z-index: 9999;
    overflow: hidden;
  `
  document.body.appendChild(container)
  console.log('✅ Confetti container added to body', container)

  for (let i = 0; i < particleCount; i++) {
    setTimeout(() => {
      createConfettiParticle(container, colors)
    }, Math.random() * 500)
  }

  setTimeout(() => {
    container.remove()
  }, duration)
}

function createConfettiParticle(container, colors) {
  const particle = document.createElement('div')
  const color = colors[Math.floor(Math.random() * colors.length)]
  const startX = Math.random() * window.innerWidth
  const size = Math.random() * 12 + 6
  const rotation = Math.random() * 360
  const driftX = (Math.random() - 0.5) * 300
  const fallDuration = Math.random() * 2500 + 2500

  particle.style.cssText = `
    position: absolute;
    left: ${startX}px;
    top: -20px;
    width: ${size}px;
    height: ${size}px;
    background: ${color};
    border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
    transform: rotate(${rotation}deg);
    opacity: 0.9;
    animation: confettiFall ${fallDuration}ms linear forwards;
  `

  const style = document.createElement('style')
  const animName = `confettiFall-${Math.random().toString(36).substr(2, 9)}`
  style.textContent = `
    @keyframes ${animName} {
      0% { transform: translateY(0) translateX(0) rotate(${rotation}deg); opacity: 1; }
      100% { transform: translateY(${window.innerHeight + 50}px) translateX(${driftX}px) rotate(${rotation + 720}deg); opacity: 0; }
    }
  `
  particle.style.animation = `${animName} ${fallDuration}ms linear forwards`
  document.head.appendChild(style)

  container.appendChild(particle)

  setTimeout(() => {
    particle.remove()
    style.remove()
  }, fallDuration)
}

/**
 * Celebration for level up
 */
export function celebrateLevelUp(level) {
  triggerConfetti({
    duration: 5000,
    particleCount: 120,
    colors: ['#fbbf24', '#f59e0b', '#fcd34d', '#fff7ed', '#fde047', '#facc15']
  })
}

/**
 * Celebration for achievement unlock
 */
export function celebrateAchievement() {
  triggerConfetti({
    duration: 3000,
    particleCount: 60,
    colors: ['#10b981', '#34d399', '#6ee7b7', '#d1fae5']
  })
}

/**
 * Celebration for daily win
 */
export function celebrateWin() {
  triggerConfetti({
    duration: 2500,
    particleCount: 40,
    colors: ['#3b82f6', '#60a5fa', '#93c5fd', '#dbeafe']
  })
}
