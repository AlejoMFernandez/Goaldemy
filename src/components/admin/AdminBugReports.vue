<script setup>
import { ref, computed, onMounted } from 'vue'
import { getBugReports, setBugReportStatus } from '../../services/feedback'
import { getPublicProfilesByIds } from '../../services/user-profiles'

const reports = ref([])
const profiles = ref({})
const loading = ref(true)
const filter = ref('all')      // all | open | done
const busy = ref(null)

const STATUS = {
  open:        { label: 'Abierto',     cls: 'bg-amber-500/15 text-amber-300 border-amber-400/30' },
  in_progress: { label: 'En progreso', cls: 'bg-sky-500/15 text-sky-300 border-sky-400/30' },
  done:        { label: 'Resuelto',    cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30' },
  wontfix:     { label: 'No se hará',  cls: 'bg-slate-500/15 text-slate-300 border-slate-400/30' },
}

const openCount = computed(() => reports.value.filter(r => r.status === 'open' || r.status === 'in_progress').length)
const filtered = computed(() => {
  if (filter.value === 'open') return reports.value.filter(r => r.status === 'open' || r.status === 'in_progress')
  if (filter.value === 'done') return reports.value.filter(r => r.status === 'done' || r.status === 'wontfix')
  return reports.value
})

function nameFor(id) { const p = profiles.value[id]; return p ? (p.display_name || p.email || 'Usuario') : (id ? 'Usuario' : 'Anónimo') }
function fmtDate(ts) { try { return new Date(ts).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) } catch { return '' } }
function statusOf(r) { return STATUS[r.status] || STATUS.open }

async function load() {
  loading.value = true
  const { data, error } = await getBugReports()
  reports.value = error ? [] : data
  const ids = [...new Set(reports.value.map(r => r.user_id).filter(Boolean))]
  if (ids.length) {
    try { const { data: ps } = await getPublicProfilesByIds(ids); const m = {}; for (const p of ps || []) m[p.id] = p; profiles.value = m } catch {}
  }
  loading.value = false
}

async function changeStatus(r, status) {
  if (busy.value) return
  busy.value = r.id
  const res = await setBugReportStatus(r.id, status)
  if (res.ok) r.status = status
  busy.value = null
}

onMounted(load)
</script>

<template>
  <div class="bg-gradient-to-br from-slate-800/80 to-slate-900/50 backdrop-blur border border-white/10 rounded-2xl p-5 sm:p-6 shadow-xl">
    <div class="flex items-center justify-between gap-3 mb-5">
      <div>
        <h2 class="text-xl font-bold text-white">Reportes de bug</h2>
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

    <div v-else-if="!filtered.length" class="text-center py-12 text-slate-400">
      <div class="text-3xl mb-2">🐞</div>
      <p>No hay reportes {{ filter === 'open' ? 'abiertos' : filter === 'done' ? 'cerrados' : '' }}.</p>
    </div>

    <ul v-else class="space-y-2.5">
      <li v-for="r in filtered" :key="r.id" class="rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <p class="text-slate-100 text-sm whitespace-pre-line break-words">{{ r.message }}</p>
            <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
              <span class="text-slate-400 font-medium">{{ nameFor(r.user_id) }}</span>
              <span>{{ fmtDate(r.created_at) }}</span>
              <span v-if="r.contact" class="text-slate-400">✉ {{ r.contact }}</span>
              <a v-if="r.url" :href="r.url" target="_blank" rel="noopener" class="text-sky-400 hover:underline truncate max-w-[220px]">{{ r.url.replace(location.origin, '') || r.url }}</a>
            </div>
          </div>
          <span class="shrink-0 px-2 py-0.5 rounded-full border text-[10px] font-bold" :class="statusOf(r).cls">{{ statusOf(r).label }}</span>
        </div>
        <div class="mt-3 flex flex-wrap gap-1.5">
          <button v-for="s in ['open','in_progress','done','wontfix']" :key="s"
                  @click="changeStatus(r, s)" :disabled="busy === r.id || r.status === s"
                  class="px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition disabled:opacity-40"
                  :class="r.status === s ? 'border-white/20 bg-white/10 text-white' : 'border-white/10 text-slate-400 hover:text-white hover:bg-white/5'">
            {{ STATUS[s].label }}
          </button>
        </div>
      </li>
    </ul>
  </div>
</template>
