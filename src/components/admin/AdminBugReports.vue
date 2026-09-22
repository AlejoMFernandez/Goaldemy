<script setup>
import { ref, computed, onMounted } from 'vue'
import { getBugReports, setBugReportStatus, deleteBugReport, getBugReportImageUrl } from '../../services/feedback'
import { getPublicProfilesByIds } from '../../services/user-profiles'

const emit = defineEmits(['updated'])

const reports = ref([])
const profiles = ref({})
const imageUrls = ref({})
const loading = ref(true)
const filter = ref('all')      // all | open | done
const busy = ref(null)
const reportToDelete = ref(null)
const deleting = ref(false)
const lightboxUrl = ref('')

const origin = typeof window !== 'undefined' ? window.location.origin : ''

const STATUS = {
  open:        { label: 'Abierto',     cls: 'bg-amber-500/15 text-amber-300 border-amber-400/30',   option: 'bg-amber-950 text-amber-300',   card: 'border-amber-500/30 bg-amber-500/10 text-amber-300' },
  in_progress: { label: 'En progreso', cls: 'bg-sky-500/15 text-sky-300 border-sky-400/30',          option: 'bg-sky-950 text-sky-300',       card: 'border-sky-500/30 bg-sky-500/10 text-sky-300' },
  done:        { label: 'Resuelto',    cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30', option: 'bg-emerald-950 text-emerald-300', card: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' },
  wontfix:     { label: 'No se hará',  cls: 'bg-slate-500/15 text-slate-300 border-slate-400/30',    option: 'bg-slate-800 text-slate-300',   card: 'border-slate-500/30 bg-slate-500/10 text-slate-300' },
}
const STATUS_KEYS = ['open', 'in_progress', 'done', 'wontfix']

const openCount = computed(() => reports.value.filter(r => r.status === 'open' || r.status === 'in_progress').length)
const statusCounts = computed(() => {
  const counts = { open: 0, in_progress: 0, done: 0, wontfix: 0 }
  for (const r of reports.value) counts[r.status] = (counts[r.status] || 0) + 1
  return counts
})
const filtered = computed(() => {
  if (filter.value === 'open') return reports.value.filter(r => r.status === 'open' || r.status === 'in_progress')
  if (filter.value === 'done') return reports.value.filter(r => r.status === 'done' || r.status === 'wontfix')
  return reports.value
})

function nameFor(id) { const p = profiles.value[id]; return p ? (p.display_name || p.email || 'Usuario') : (id ? 'Usuario' : 'Anónimo') }
function avatarFor(id) { return profiles.value[id]?.avatar_url || '' }
function initialFor(id) { return nameFor(id).trim().charAt(0).toUpperCase() || '?' }
function fmtDate(ts) { try { return new Date(ts).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) } catch { return '' } }
function statusOf(r) { return STATUS[r.status] || STATUS.open }
function ticketRef(r) { return '#' + (r.id || '').replace(/-/g, '').slice(0, 6).toUpperCase() }

async function load() {
  loading.value = true
  const { data, error } = await getBugReports()
  reports.value = error ? [] : data
  const ids = [...new Set(reports.value.map(r => r.user_id).filter(Boolean))]
  if (ids.length) {
    try { const { data: ps } = await getPublicProfilesByIds(ids); const m = {}; for (const p of ps || []) m[p.id] = p; profiles.value = m } catch {}
  }
  loading.value = false

  const withImages = reports.value.filter(r => r.image_path)
  if (withImages.length) {
    const entries = await Promise.all(withImages.map(async r => [r.id, await getBugReportImageUrl(r.image_path)]))
    const m = { ...imageUrls.value }
    for (const [id, url] of entries) if (url) m[id] = url
    imageUrls.value = m
  }
}

async function changeStatus(r, status) {
  if (busy.value) return
  busy.value = r.id
  const res = await setBugReportStatus(r.id, status)
  if (res.ok) { r.status = status; emit('updated') }
  busy.value = null
}

function confirmDelete(r) { reportToDelete.value = r }

async function handleDelete() {
  if (!reportToDelete.value || deleting.value) return
  deleting.value = true
  const r = reportToDelete.value
  const res = await deleteBugReport(r.id, r.image_path)
  deleting.value = false
  if (res.ok) {
    reports.value = reports.value.filter(x => x.id !== r.id)
    reportToDelete.value = null
    emit('updated')
  }
}

onMounted(load)
</script>

<template>
  <div>
  <!-- Mini resumen por estado -->
  <div class="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
    <div class="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
      <p class="text-2xl font-extrabold text-white leading-none">{{ reports.length }}</p>
      <p class="text-[11px] text-slate-400 mt-1">Total</p>
    </div>
    <div v-for="s in STATUS_KEYS" :key="s" class="rounded-xl border px-3 py-2.5" :class="STATUS[s].card">
      <p class="text-2xl font-extrabold leading-none">{{ statusCounts[s] }}</p>
      <p class="text-[11px] mt-1 opacity-80">{{ STATUS[s].label }}</p>
    </div>
  </div>

  <div class="bg-gradient-to-br from-slate-800/80 to-slate-900/50 backdrop-blur border border-white/10 rounded-2xl p-5 sm:p-6 shadow-xl">
    <div class="flex items-center justify-between gap-3 mb-5">
      <div>
        <h2 class="text-xl font-bold text-white">Tickets</h2>
        <p class="text-sm text-slate-400">{{ openCount }} sin resolver · {{ reports.length }} en total</p>
      </div>
      <div class="flex items-center gap-2">
        <div class="flex rounded-lg border border-white/10 bg-slate-900/50 p-0.5">
          <button v-for="f in [{k:'all',l:'Todos'},{k:'open',l:'Abiertos'},{k:'done',l:'Cerrados'}]" :key="f.k"
                  @click="filter = f.k"
                  class="px-3 py-1.5 rounded-md text-xs font-semibold transition"
                  :class="filter === f.k ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'">{{ f.l }}</button>
        </div>
        <button @click="load" class="h-8 w-8 grid place-items-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 transition" title="Recargar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
        </button>
      </div>
    </div>

    <div v-if="loading" class="space-y-2">
      <div v-for="i in 3" :key="i" class="h-20 rounded-xl bg-white/5 animate-pulse"></div>
    </div>

    <div v-else-if="!filtered.length" class="flex flex-col items-center justify-center text-center py-12 text-slate-400">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="h-10 w-10 mb-3 text-slate-600">
        <path d="M8 2l1.5 2.5M16 2l-1.5 2.5"/><rect x="7" y="6" width="10" height="12" rx="5"/><path d="M12 10v6M4 10h3M17 10h3M4 15h3M17 15h3M5 20l2.5-2M19 20l-2.5-2"/>
      </svg>
      <p>No hay tickets {{ filter === 'open' ? 'abiertos' : filter === 'done' ? 'cerrados' : '' }}.</p>
    </div>

    <ul v-else class="space-y-2">
      <li v-for="r in filtered" :key="r.id" class="relative rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] transition-colors p-4 pb-10">
        <div class="flex items-start gap-4">
          <!-- Ícono del usuario + nombre, en cápsula -->
          <div class="shrink-0 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 pl-1 pr-3 py-1 max-w-[180px]">
            <img
              v-if="avatarFor(r.user_id)"
              :src="avatarFor(r.user_id)"
              :alt="nameFor(r.user_id)"
              class="h-6 w-6 rounded-full object-cover shrink-0"
            />
            <div v-else class="h-6 w-6 rounded-full bg-slate-600 grid place-items-center text-[10px] font-bold text-white shrink-0">
              {{ initialFor(r.user_id) }}
            </div>
            <span class="text-xs font-semibold text-slate-200 truncate">{{ nameFor(r.user_id) }}</span>
          </div>

          <!-- Título + fecha -->
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="text-[11px] font-mono text-slate-500">{{ ticketRef(r) }}</span>
            </div>
            <p class="text-slate-100 text-sm font-medium whitespace-pre-line break-words mt-0.5">{{ r.message }}</p>
            <p class="text-[11px] text-slate-500 mt-1">{{ fmtDate(r.created_at) }}</p>

            <button
              v-if="imageUrls[r.id]"
              @click="lightboxUrl = imageUrls[r.id]"
              class="mt-2 block"
              title="Ver captura completa"
            >
              <img :src="imageUrls[r.id]" alt="Captura adjunta" class="h-16 rounded-lg border border-white/10 object-cover hover:border-blue-400/50 transition" />
            </button>
            <span v-else-if="r.image_path" class="mt-2 inline-flex items-center gap-1 text-[11px] text-slate-500">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
              captura adjunta
            </span>

            <div v-if="r.contact || r.url" class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
              <span v-if="r.contact" class="text-slate-400">✉ {{ r.contact }}</span>
              <a v-if="r.url" :href="r.url" target="_blank" rel="noopener" class="text-sky-400 hover:underline truncate max-w-[220px]">{{ r.url.replace(origin, '') || r.url }}</a>
            </div>
          </div>

          <!-- Estado (desplegable) -->
          <div class="shrink-0 relative">
            <select
              :value="r.status"
              @change="changeStatus(r, $event.target.value)"
              :disabled="busy === r.id"
              class="appearance-none pl-2.5 pr-7 py-1.5 rounded-full border text-[11px] font-bold cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400/40 disabled:opacity-40"
              :class="statusOf(r).cls"
            >
              <option v-for="s in STATUS_KEYS" :key="s" :value="s" :class="STATUS[s].option">
                {{ STATUS[s].label }}
              </option>
            </select>
            <svg viewBox="0 0 20 20" fill="currentColor" class="h-3 w-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-70">
              <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
            </svg>
          </div>
        </div>

        <!-- Borrar: esquina inferior derecha -->
        <button @click="confirmDelete(r)" class="absolute bottom-2.5 right-2.5 h-7 w-7 grid place-items-center rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition" title="Eliminar ticket">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6h16z"/></svg>
        </button>
      </li>
    </ul>

    <!-- Lightbox de captura -->
    <div v-if="lightboxUrl" class="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-50 px-4 py-8" @click.self="lightboxUrl = ''">
      <img :src="lightboxUrl" alt="Captura" class="max-w-full max-h-full rounded-xl border border-white/10 shadow-2xl" />
      <button @click="lightboxUrl = ''" class="absolute top-4 right-4 h-9 w-9 grid place-items-center rounded-lg bg-slate-900/80 border border-white/15 text-white hover:bg-slate-800 transition">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5"><path d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>

    <!-- Confirmación de borrado -->
    <div
      v-if="reportToDelete"
      class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 px-4"
      @click.self="reportToDelete = null"
    >
      <div class="bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 rounded-2xl p-8 max-w-md w-full shadow-2xl">
        <h3 class="text-2xl font-bold text-white mb-4">⚠️ Eliminar ticket</h3>
        <p class="text-slate-300 mb-6">
          ¿Seguro que querés eliminar el ticket <strong class="text-white">{{ ticketRef(reportToDelete) }}</strong>?
          Esta acción no se puede deshacer.
        </p>
        <div class="flex gap-4">
          <button @click="reportToDelete = null" class="flex-1 bg-slate-700 hover:bg-slate-600 text-white px-4 py-3 rounded-lg font-semibold transition-colors">
            Cancelar
          </button>
          <button @click="handleDelete" :disabled="deleting" class="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-lg font-semibold transition-colors disabled:opacity-60">
            {{ deleting ? 'Eliminando…' : 'Eliminar' }}
          </button>
        </div>
      </div>
    </div>
  </div>
  </div>
</template>
