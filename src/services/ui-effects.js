/**
 * EFECTOS DE UI
 * 
 * Pequeños efectos visuales reutilizables para mejorar la experiencia del usuario.
 * 
 * EFECTOS DISPONIBLES:
 * - spawnXpBadge(): Badge flotante que muestra "+X XP" y desaparece con fade-out
 * 
 * POSICIONAMIENTO:
 * - 'bottom-center': Centrado horizontalmente cerca del fondo (default)
 * - 'top-right': Esquina superior derecha (para UI de juegos)
 * 
 * IMPLEMENTACIÓN:
 * - Crea un elemento DOM temporal con clase 'xp-float'
 * - Se anima con CSS (definido en style.css)
 * - Se auto-elimina después de 1.2 segundos
 * 
 * EJEMPLO DE USO:
 *   spawnXpBadge(this.$el, '+10 XP', { position: 'top-right' })
 */

/**
 * Genera un badge flotante de XP con animación de fade-out
 * @param {HTMLElement} hostEl - Elemento contenedor donde se creará el badge
 * @param {string} text - Texto a mostrar (ej: '+10 XP', '+50 XP')
 * @param {Object} options - Opciones de configuración
 * @param {'bottom-center'|'top-right'} options.position - Posición del badge
 */
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
