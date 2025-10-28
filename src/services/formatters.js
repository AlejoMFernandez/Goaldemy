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
