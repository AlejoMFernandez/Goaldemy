export function spawnXpBadge(hostEl, text = '+10 XP', options = {}) {
  if (!hostEl) return
  const el = document.createElement('div')
  el.className = 'xp-float'
  el.textContent = text
  const pos = options.position || 'bottom-center'

  if (pos === 'at-element' && options.targetEl) {
    el.className = 'xp-float tr'
    const rect = options.targetEl.getBoundingClientRect()
    const hostRect = hostEl.getBoundingClientRect()
    el.style.left = `${rect.left - hostRect.left + rect.width / 2 - 30}px`
    el.style.top = `${rect.top - hostRect.top - 10}px`
  } else if (pos === 'top-right') {
    el.className = 'xp-float tr'
    el.style.right = '16px'
    el.style.top = '24px'
  } else {
    el.style.left = '50%'
    el.style.bottom = '24px'
    el.style.transform = 'translateX(-50%)'
  }

  hostEl.appendChild(el)
  setTimeout(() => el.remove(), 1200)
}
