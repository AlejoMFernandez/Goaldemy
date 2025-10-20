// Small UI effects helpers reusable across components

// Spawn a floating XP badge like "+10 XP" with a subtle fade-out
// options: { position?: 'bottom-center' | 'top-right' }
export function spawnXpBadge(hostEl, text = '+10 XP', options = {}) {
  if (!hostEl) return
  const el = document.createElement('div')
  el.className = 'xp-float'
  el.textContent = text
  const pos = options.position || 'bottom-center'
  if (pos === 'top-right') {
    el.className = 'xp-float tr'
    // push further to the right and a bit lower for better composition
    el.style.right = '16px'
    el.style.top = '24px'
  } else {
    // center horizontally near bottom (default)
    el.style.left = '50%'
    el.style.bottom = '24px'
    el.style.transform = 'translateX(-50%)'
  }
  hostEl.appendChild(el)
  setTimeout(() => el.remove(), 1200)
}
