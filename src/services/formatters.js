export function formatShortDate(dateStr) {
  try {
    const d = new Date(dateStr)
    return d.toLocaleString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

export function formatDayMonth(dateStr) {
  try {
    const d = new Date(dateStr)
    // e.g., 24 sept
    return d.toLocaleString([], { day: '2-digit', month: 'short' })
  } catch {
    return ''
  }
}

// Solo hora — para chats con separador de día (estilo WhatsApp), donde la
// fecha ya no va repetida en cada mensaje.
export function formatTimeOnly(dateStr) {
  try {
    const d = new Date(dateStr)
    return d.toLocaleString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

// Etiqueta de separador de día estilo WhatsApp: "Hoy" / "Ayer" / "24 sept".
export function formatDayLabel(dateStr) {
  try {
    const d = new Date(dateStr)
    const startOf = (x) => { const y = new Date(x); y.setHours(0, 0, 0, 0); return y.getTime() }
    const today = startOf(new Date())
    const day = startOf(d)
    if (day === today) return 'Hoy'
    if (day === today - 86400000) return 'Ayer'
    return formatDayMonth(dateStr)
  } catch {
    return ''
  }
}
