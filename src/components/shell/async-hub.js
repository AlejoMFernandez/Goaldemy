/**
 * defineAsyncComponent con skeleton mientras baja el chunk y error +
 * "Reintentar" si falla la descarga (red móvil). Reintentar recarga la ruta.
 */
import { defineAsyncComponent, h } from 'vue'
import HubState from './HubState.vue'

const HubSkeleton = { name: 'HubSkeleton', render: () => h(HubState, { loading: true, rows: 4 }) }
const ChunkError = { name: 'ChunkError', render: () => h(HubState, { error: 'No pudimos cargar esta sección.', onRetry: () => window.location.reload() }) }

export function asyncHub(loader) {
  return defineAsyncComponent({ loader, loadingComponent: HubSkeleton, delay: 0, errorComponent: ChunkError, timeout: 15000 })
}
