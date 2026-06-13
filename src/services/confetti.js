let canvas = null
let ctx = null
let particles = []
let animFrame = null

const GRAVITY = 0.12
const WIND = 0.02
const DRAG = 0.98

function ensureCanvas() {
  if (canvas) return
  canvas = document.createElement('canvas')
  canvas.style.cssText = 'position:fixed;inset:0;z-index:9999;pointer-events:none;'
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  document.body.appendChild(canvas)
  ctx = canvas.getContext('2d')

  const onResize = () => {
    if (!canvas) return
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
  }
  window.addEventListener('resize', onResize)
  canvas._cleanup = () => window.removeEventListener('resize', onResize)
}

function removeCanvas() {
  if (!canvas) return
  canvas._cleanup?.()
  canvas.remove()
  canvas = null
  ctx = null
}

function createParticle(x, y, colors) {
  const color = colors[Math.floor(Math.random() * colors.length)]
  const angle = Math.random() * Math.PI * 2
  const speed = Math.random() * 6 + 2
  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed - 4,
    w: Math.random() * 10 + 4,
    h: Math.random() * 6 + 2,
    color,
    rotation: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.2,
    opacity: 1,
    life: 1,
    decay: 0.003 + Math.random() * 0.004,
  }
}

function tick() {
  if (!ctx || particles.length === 0) {
    cancelAnimationFrame(animFrame)
    animFrame = null
    removeCanvas()
    return
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]
    p.vy += GRAVITY
    p.vx += WIND
    p.vx *= DRAG
    p.vy *= DRAG
    p.x += p.vx
    p.y += p.vy
    p.rotation += p.rotSpeed
    p.life -= p.decay
    p.opacity = Math.max(0, p.life)

    if (p.life <= 0 || p.y > canvas.height + 20) {
      particles.splice(i, 1)
      continue
    }

    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(p.rotation)
    ctx.globalAlpha = p.opacity
    ctx.fillStyle = p.color
    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
    ctx.restore()
  }

  animFrame = requestAnimationFrame(tick)
}

function burst({ x, y, count = 80, colors, spread = 1 }) {
  ensureCanvas()
  for (let i = 0; i < count; i++) {
    const px = x + (Math.random() - 0.5) * 100 * spread
    const py = y + (Math.random() - 0.5) * 40
    particles.push(createParticle(px, py, colors))
  }
  if (!animFrame) animFrame = requestAnimationFrame(tick)
}

export function triggerConfetti(options = {}) {
  const {
    particleCount = 80,
    colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4'],
  } = options

  const w = window.innerWidth
  const h = window.innerHeight
  burst({ x: w * 0.3, y: h * 0.2, count: Math.floor(particleCount / 2), colors })
  burst({ x: w * 0.7, y: h * 0.2, count: Math.ceil(particleCount / 2), colors })
}

export function celebrateLevelUp() {
  triggerConfetti({
    particleCount: 120,
    colors: ['#fbbf24', '#f59e0b', '#fcd34d', '#fff7ed', '#fde047', '#facc15'],
  })
}

export function celebrateAchievement() {
  triggerConfetti({
    particleCount: 60,
    colors: ['#10b981', '#34d399', '#6ee7b7', '#d1fae5'],
  })
}

export function celebrateWin() {
  triggerConfetti({
    particleCount: 40,
    colors: ['#3b82f6', '#60a5fa', '#93c5fd', '#dbeafe'],
  })
}

export function confettiGold() {
  const w = window.innerWidth
  burst({ x: w / 2, y: window.innerHeight * 0.4, count: 100, colors: ['#fbbf24', '#f59e0b', '#fde047', '#facc15'], spread: 1.5 })
}
