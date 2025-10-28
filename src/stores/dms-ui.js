import { reactive } from 'vue'

export const dmsUiState = reactive({
  windows: [] // { peerId, collapsed }
})

export function openMiniChat(peerId) {
  const id = String(peerId)
  const exists = dmsUiState.windows.find(w => w.peerId === id)
  if (exists) { exists.collapsed = false; return }
  dmsUiState.windows.push({ peerId: id, collapsed: false })
}

export function closeMiniChat(peerId) {
  const id = String(peerId)
  const idx = dmsUiState.windows.findIndex(w => w.peerId === id)
  if (idx !== -1) dmsUiState.windows.splice(idx, 1)
}

export function toggleCollapseMiniChat(peerId) {
  const id = String(peerId)
  const w = dmsUiState.windows.find(w => w.peerId === id)
  if (w) w.collapsed = !w.collapsed
}
