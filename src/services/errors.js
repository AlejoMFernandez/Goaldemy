import { pushErrorToast } from '../stores/notifications'

function extractMessage(e) {
  if (!e) return 'Ocurrió un error inesperado'
  if (typeof e === 'string') return e
  if (e.reason && typeof e.reason === 'string') return e.reason
  if (e.message) return e.message
  if (e.error && typeof e.error === 'string') return e.error
  try { return JSON.stringify(e).slice(0, 200) } catch { return 'Ocurrió un error' }
}

export function installGlobalErrorHandler() {
  try {
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (ev) => {
        const msg = extractMessage(ev?.error || ev?.message)
        pushErrorToast(msg)
      })
      window.addEventListener('unhandledrejection', (ev) => {
        const reason = ev?.reason
        const msg = extractMessage(reason)
        pushErrorToast(msg)
      })
    }
  } catch {
    // ignore
  }
}
