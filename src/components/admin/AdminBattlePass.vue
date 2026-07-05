<script setup>
/**
 * ADMIN — PASE DE BATALLA
 * Gestión visual del pase mes a mes: elegir temporada, ver los 30
 * niveles con su umbral de puntos, y asignar el cosmético Gratis /
 * Premium de cada nivel desde el catálogo. Incluye alerta cuando el
 * próximo mes todavía no tiene recompensas cargadas, y un editor del
 * catálogo de cosméticos.
 */
import { ref, computed, onMounted } from 'vue'
import {
  listSeasons, upsertSeason, deleteSeason,
  listTiers, listSeasonRewards, setReward, clearReward,
  listCosmetics, upsertCosmetic, deleteCosmetic,
  monthKey, TEMPLATE_MONTH,
} from '../../services/admin-pass.js'
import { pushSuccessToast, pushErrorToast } from '../../stores/notifications'
import { FRAME_STYLES, BANNER_STYLES } from '../../services/cosmetics'
import PassCosmetic from '../rewards/PassCosmetic.vue'

const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const ACCENTS = [
  { key: 'amber',   grad: 'from-amber-400 to-yellow-600',  dot: 'bg-amber-400' },
  { key: 'cyan',    grad: 'from-cyan-400 to-teal-500',     dot: 'bg-cyan-400' },
  { key: 'emerald', grad: 'from-emerald-400 to-cyan-500',  dot: 'bg-emerald-400' },
  { key: 'violet',  grad: 'from-violet-400 to-fuchsia-600',dot: 'bg-violet-400' },
  { key: 'rose',    grad: 'from-rose-400 to-pink-600',     dot: 'bg-rose-400' },
]
const RARITIES = ['common', 'rare', 'epic', 'legendary']
const TYPES = ['frame', 'banner', 'icon', 'title']

const loading = ref(true)
const view = ref('rewards')          // 'rewards' | 'catalog'
const seasons = ref([])
const tiers = ref([])
const cosmetics = ref([])
const selectedMonth = ref(monthKey())
const rewards = ref([])              // recompensas del mes seleccionado
const nextMonthMissing = ref(null)   // { month } si el próximo mes no tiene recompensas

// ─── Helpers de formato ─────────────────────────────────────
function monthLabel(m) {
  if (m === TEMPLATE_MONTH) return 'Plantilla por defecto'
  const [y, mm] = m.split('-')
  return `${MONTHS_ES[parseInt(mm, 10) - 1]} ${y}`
}
function accentGrad(key) {
  return (ACCENTS.find(a => a.key === key) || ACCENTS[0]).grad
}
const selectedSeason = computed(() => seasons.value.find(s => s.month === selectedMonth.value) || null)

// Recompensa asignada a un nivel/track (o null).
function rewardAt(tier, track) {
  return rewards.value.find(r => r.tier === tier && r.track === track) || null
}

// ─── Carga ──────────────────────────────────────────────────
async function loadAll() {
  loading.value = true
  try {
    const [s, t, c] = await Promise.all([listSeasons(), listTiers(), listCosmetics()])
    seasons.value = s
    tiers.value = t
    cosmetics.value = c
    if (!seasons.value.some(x => x.month === selectedMonth.value)) {
      selectedMonth.value = seasons.value[0]?.month || TEMPLATE_MONTH
    }
    await loadRewards()
    await checkNextMonth()
  } catch (e) {
    pushErrorToast(e.message || 'Error cargando el pase')
  } finally {
    loading.value = false
  }
}

async function loadRewards() {
  rewards.value = await listSeasonRewards(selectedMonth.value)
}

async function onSelectMonth(m) {
  selectedMonth.value = m
  await loadRewards()
}

// Alerta: ¿el mes que viene tiene recompensas cargadas?
async function checkNextMonth() {
  const now = new Date()
  const next = monthKey(new Date(now.getFullYear(), now.getMonth() + 1, 1))
  const r = await listSeasonRewards(next)
  nextMonthMissing.value = r.length === 0 ? { month: next } : null
}

// ─── Editor de temporada ────────────────────────────────────
const seasonForm = ref({ month: '', name: '', theme: '', accent: 'amber' })
const showSeasonModal = ref(false)

function openNewSeason() {
  const now = new Date()
  const next = monthKey(new Date(now.getFullYear(), now.getMonth() + 1, 1))
  seasonForm.value = { month: next, name: `Pase de ${monthLabel(next)}`, theme: '', accent: 'amber' }
  showSeasonModal.value = true
}
function openEditSeason() {
  if (!selectedSeason.value) return
  seasonForm.value = { ...selectedSeason.value, theme: selectedSeason.value.theme || '' }
  showSeasonModal.value = true
}
async function saveSeason() {
  const f = seasonForm.value
  if (!/^\d{4}-\d{2}-01$/.test(f.month)) return pushErrorToast('El mes debe tener formato AAAA-MM-01')
  if (!f.name.trim()) return pushErrorToast('Poné un nombre a la temporada')
  try {
    await upsertSeason(f)
    pushSuccessToast('Temporada guardada')
    showSeasonModal.value = false
    selectedMonth.value = f.month
    await loadAll()
  } catch (e) { pushErrorToast(e.message || 'No se pudo guardar') }
}
async function removeSeason() {
  if (!selectedSeason.value || selectedMonth.value === TEMPLATE_MONTH) return
  if (!confirm(`¿Borrar "${selectedSeason.value.name}" y todas sus recompensas?`)) return
  try {
    await deleteSeason(selectedMonth.value)
    pushSuccessToast('Temporada eliminada')
    await loadAll()
  } catch (e) { pushErrorToast(e.message || 'No se pudo eliminar') }
}

// ─── Picker de cosmético para un nivel/track ────────────────
const picker = ref(null)   // { tier, track } o null
const pickerSearch = ref('')
const pickerType = ref('all')

const pickerList = computed(() => {
  const q = pickerSearch.value.trim().toLowerCase()
  return cosmetics.value.filter(c =>
    (pickerType.value === 'all' || c.type === pickerType.value) &&
    (!q || c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q))
  )
})

function openPicker(tier, track) {
  if (selectedMonth.value === TEMPLATE_MONTH) { /* también editable */ }
  picker.value = { tier, track }
  pickerSearch.value = ''
  pickerType.value = 'all'
}
async function assignCosmetic(code) {
  const { tier, track } = picker.value
  try {
    await setReward({ month: selectedMonth.value, tier, track, cosmetic_code: code })
    picker.value = null
    await loadRewards()
    pushSuccessToast('Recompensa asignada')
  } catch (e) { pushErrorToast(e.message || 'No se pudo asignar') }
}
async function removeReward(tier, track) {
  try {
    await clearReward({ month: selectedMonth.value, tier, track })
    await loadRewards()
  } catch (e) { pushErrorToast(e.message || 'No se pudo quitar') }
}

// ─── Editor de catálogo de cosméticos ───────────────────────
const cosmeticForm = ref(null)   // objeto en edición o null
const isNewCosmetic = ref(false)

const styleKeyOptions = computed(() => {
  const t = cosmeticForm.value?.type
  if (t === 'frame') return Object.keys(FRAME_STYLES)
  if (t === 'banner') return Object.keys(BANNER_STYLES)
  return []   // icon: clave del registro de íconos (texto libre); title: sin estilo
})

function openNewCosmetic() {
  isNewCosmetic.value = true
  cosmeticForm.value = { code: '', type: 'frame', name: '', rarity: 'common', style_key: 'gold', unlock_level: 999, premium_only: false, sort_order: 0, active: true }
}
function openEditCosmetic(c) {
  isNewCosmetic.value = false
  cosmeticForm.value = { ...c }
}
async function saveCosmetic() {
  const f = cosmeticForm.value
  if (!f.code.trim()) return pushErrorToast('Falta el código (ej: frame_pass_oct)')
  if (!f.name.trim()) return pushErrorToast('Falta el nombre')
  try {
    await upsertCosmetic(f)
    pushSuccessToast('Cosmético guardado')
    cosmeticForm.value = null
    cosmetics.value = await listCosmetics()
  } catch (e) { pushErrorToast(e.message || 'No se pudo guardar (¿código duplicado?)') }
}
async function removeCosmetic(code) {
  if (!confirm(`¿Borrar el cosmético "${code}"? Se quitará de todos los pases que lo usen.`)) return
  try {
    await deleteCosmetic(code)
    cosmetics.value = await listCosmetics()
    if (selectedMonth.value) await loadRewards()
    pushSuccessToast('Cosmético eliminado')
  } catch (e) { pushErrorToast(e.message || 'No se pudo eliminar') }
}

onMounted(loadAll)
</script>

<template>
  <div>
    <!-- Sub-tabs -->
    <div class="flex items-center justify-between mb-6 flex-wrap gap-3">
      <div class="flex gap-2 bg-slate-800/60 border border-white/10 rounded-xl p-1">
        <button
          @click="view = 'rewards'"
          :class="['px-4 py-2 rounded-lg text-sm font-semibold transition', view === 'rewards' ? 'bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-900' : 'text-slate-400 hover:text-white']"
        >Recompensas del pase</button>
        <button
          @click="view = 'catalog'"
          :class="['px-4 py-2 rounded-lg text-sm font-semibold transition', view === 'catalog' ? 'bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-900' : 'text-slate-400 hover:text-white']"
        >Catálogo de cosméticos</button>
      </div>
    </div>

    <div v-if="loading" class="flex justify-center py-20">
      <div class="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
    </div>

    <!-- ══════════ VISTA: RECOMPENSAS ══════════ -->
    <div v-else-if="view === 'rewards'">
      <!-- Alerta próximo mes sin armar -->
      <div v-if="nextMonthMissing" class="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 flex items-center gap-3">
        <svg class="w-6 h-6 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.84-2.75L13.74 4a2 2 0 00-3.5 0L3.16 16.25A2 2 0 005 19z"/></svg>
        <div class="flex-1">
          <p class="text-sm font-semibold text-red-300">El pase de {{ monthLabel(nextMonthMissing.month) }} todavía no tiene recompensas cargadas.</p>
          <p class="text-xs text-red-400/80">Se usará la plantilla por defecto hasta que lo armes. Creá la temporada y asigná sus cosméticos.</p>
        </div>
        <button @click="openNewSeason" class="text-xs font-bold bg-red-500/20 hover:bg-red-500/30 text-red-200 px-3 py-2 rounded-lg transition whitespace-nowrap">Armar ahora</button>
      </div>

      <!-- Cabecera de temporada -->
      <div class="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-800/80 to-slate-900/50 p-5 mb-6 shadow-xl">
        <div class="flex flex-wrap items-center gap-4">
          <div class="w-14 h-14 rounded-2xl grid place-items-center bg-gradient-to-br shadow-lg" :class="accentGrad(selectedSeason?.accent || 'amber')">
            <svg class="w-7 h-7 text-slate-900" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
          </div>
          <div class="flex-1 min-w-[180px]">
            <div class="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Temporada seleccionada</div>
            <div class="text-xl font-extrabold text-white">{{ selectedSeason?.name || '—' }}</div>
            <div class="text-xs text-slate-400">{{ monthLabel(selectedMonth) }}<span v-if="selectedSeason?.theme"> · tema: {{ selectedSeason.theme }}</span></div>
          </div>

          <!-- Selector de mes -->
          <select
            :value="selectedMonth"
            @change="onSelectMonth($event.target.value)"
            class="rounded-xl border border-white/15 bg-slate-900/70 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-400/60"
          >
            <option v-for="s in seasons" :key="s.month" :value="s.month">{{ monthLabel(s.month) }} — {{ s.name }}</option>
          </select>

          <div class="flex gap-2">
            <button @click="openEditSeason" class="text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/10 text-white px-3 py-2.5 rounded-xl transition">Editar</button>
            <button @click="openNewSeason" class="text-xs font-bold bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-900 px-3 py-2.5 rounded-xl transition hover:brightness-110">+ Nueva temporada</button>
            <button v-if="selectedMonth !== TEMPLATE_MONTH" @click="removeSeason" class="text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-300 px-3 py-2.5 rounded-xl transition">Borrar</button>
          </div>
        </div>
      </div>

      <!-- Grilla de niveles -->
      <div class="rounded-2xl border border-white/10 bg-slate-800/40 overflow-hidden">
        <div class="grid grid-cols-[110px_1fr_1fr] gap-px bg-white/5 text-[11px] uppercase tracking-wide text-slate-400 font-semibold">
          <div class="bg-slate-900/60 px-4 py-3">Nivel</div>
          <div class="bg-slate-900/60 px-4 py-3">🟢 Track Gratis</div>
          <div class="bg-slate-900/60 px-4 py-3">🟡 Track Premium</div>
        </div>
        <div class="max-h-[520px] overflow-y-auto">
          <div
            v-for="t in tiers" :key="t.tier"
            class="grid grid-cols-[110px_1fr_1fr] gap-px bg-white/5 border-t border-white/5"
          >
            <!-- Nivel + puntos -->
            <div class="bg-slate-900/40 px-4 py-3 flex flex-col justify-center">
              <div class="text-white font-bold text-sm">Nivel {{ t.tier }}</div>
              <div class="text-[11px] text-slate-500">{{ t.points_required }} pts</div>
            </div>

            <!-- Celda por track -->
            <template v-for="track in ['free', 'premium']" :key="track">
              <div class="bg-slate-900/20 px-3 py-2.5">
                <div v-if="rewardAt(t.tier, track)" class="flex items-center gap-3 group">
                  <PassCosmetic :cos="rewardAt(t.tier, track).cosmetics" :size="38" />
                  <div class="min-w-0 flex-1">
                    <div class="text-sm text-white font-semibold truncate">{{ rewardAt(t.tier, track).cosmetics?.name }}</div>
                    <div class="text-[11px] text-slate-500 truncate">{{ rewardAt(t.tier, track).cosmetics?.type }} · {{ rewardAt(t.tier, track).cosmetics?.rarity }}</div>
                  </div>
                  <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button @click="openPicker(t.tier, track)" class="text-[11px] text-slate-300 hover:text-white bg-white/5 px-2 py-1 rounded">Cambiar</button>
                    <button @click="removeReward(t.tier, track)" class="text-[11px] text-red-300 hover:text-red-200 bg-red-500/10 px-2 py-1 rounded">Quitar</button>
                  </div>
                </div>
                <button
                  v-else
                  @click="openPicker(t.tier, track)"
                  class="w-full h-[46px] rounded-lg border border-dashed border-white/10 text-slate-500 hover:border-amber-400/40 hover:text-amber-300 text-xs transition"
                >+ Asignar cosmético</button>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- ══════════ VISTA: CATÁLOGO ══════════ -->
    <div v-else>
      <div class="flex items-center justify-between mb-4">
        <p class="text-sm text-slate-400">{{ cosmetics.length }} cosméticos en el catálogo</p>
        <button @click="openNewCosmetic" class="text-xs font-bold bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-900 px-4 py-2.5 rounded-xl transition hover:brightness-110">+ Nuevo cosmético</button>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div
          v-for="c in cosmetics" :key="c.code"
          class="rounded-xl border border-white/10 bg-slate-800/60 p-3 flex items-center gap-3"
          :class="c.active ? '' : 'opacity-50'"
        >
          <PassCosmetic :cos="c" :size="40" />
          <div class="min-w-0 flex-1">
            <div class="text-sm text-white font-semibold truncate">{{ c.name }}</div>
            <div class="text-[11px] text-slate-500 truncate">{{ c.code }}</div>
            <div class="text-[11px] text-slate-400">{{ c.type }} · {{ c.rarity }}<span v-if="c.premium_only"> · PRO</span></div>
          </div>
          <div class="flex flex-col gap-1">
            <button @click="openEditCosmetic(c)" class="text-[11px] text-slate-300 hover:text-white bg-white/5 px-2 py-1 rounded">Editar</button>
            <button @click="removeCosmetic(c.code)" class="text-[11px] text-red-300 hover:text-red-200 bg-red-500/10 px-2 py-1 rounded">Borrar</button>
          </div>
        </div>
      </div>
    </div>

    <!-- ══════════ MODAL: picker de cosmético ══════════ -->
    <Teleport to="body">
      <div v-if="picker" class="fixed inset-0 z-[70]">
        <div class="fixed inset-0 bg-black/80 backdrop-blur-sm" @click="picker = null"></div>
        <div class="relative min-h-full flex items-center justify-center p-4">
          <div class="relative w-full max-w-2xl rounded-2xl border border-white/15 bg-slate-900 p-5 shadow-2xl">
            <div class="flex items-center justify-between mb-4">
              <div>
                <div class="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Asignar a</div>
                <div class="text-white font-bold">Nivel {{ picker.tier }} · Track {{ picker.track === 'free' ? 'Gratis' : 'Premium' }}</div>
              </div>
              <button @click="picker = null" class="text-slate-400 hover:text-white"><svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>

            <div class="flex gap-2 mb-4">
              <input v-model="pickerSearch" placeholder="Buscar por nombre o código…" class="flex-1 rounded-xl border border-white/15 bg-slate-800/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-amber-400/60" />
              <select v-model="pickerType" class="rounded-xl border border-white/15 bg-slate-800/60 px-3 py-2 text-sm text-white outline-none">
                <option value="all">Todos</option>
                <option v-for="t in TYPES" :key="t" :value="t">{{ t }}</option>
              </select>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[50vh] overflow-y-auto">
              <button
                v-for="c in pickerList" :key="c.code"
                @click="assignCosmetic(c.code)"
                class="rounded-xl border border-white/10 bg-slate-800/60 hover:border-amber-400/50 hover:bg-slate-800 p-3 flex items-center gap-2 text-left transition"
              >
                <PassCosmetic :cos="c" :size="34" />
                <div class="min-w-0">
                  <div class="text-xs text-white font-semibold truncate">{{ c.name }}</div>
                  <div class="text-[10px] text-slate-500 truncate">{{ c.rarity }}</div>
                </div>
              </button>
            </div>
            <p v-if="!pickerList.length" class="text-center text-sm text-slate-500 py-6">No hay cosméticos que coincidan.</p>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ══════════ MODAL: editor de temporada ══════════ -->
    <Teleport to="body">
      <div v-if="showSeasonModal" class="fixed inset-0 z-[70]">
        <div class="fixed inset-0 bg-black/80 backdrop-blur-sm" @click="showSeasonModal = false"></div>
        <div class="relative min-h-full flex items-center justify-center p-4">
          <div class="relative w-full max-w-md rounded-2xl border border-white/15 bg-slate-900 p-6 shadow-2xl">
            <h3 class="text-lg font-bold text-white mb-4">Temporada</h3>
            <div class="space-y-3">
              <div>
                <label class="block text-xs text-slate-400 mb-1">Mes (primer día)</label>
                <input v-model="seasonForm.month" placeholder="2026-10-01" class="w-full rounded-xl border border-white/15 bg-slate-800/60 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-400/60" />
              </div>
              <div>
                <label class="block text-xs text-slate-400 mb-1">Nombre</label>
                <input v-model="seasonForm.name" placeholder="Pase de Octubre" class="w-full rounded-xl border border-white/15 bg-slate-800/60 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-400/60" />
              </div>
              <div>
                <label class="block text-xs text-slate-400 mb-1">Tema (opcional)</label>
                <input v-model="seasonForm.theme" placeholder="mundial, winter, night…" class="w-full rounded-xl border border-white/15 bg-slate-800/60 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-400/60" />
              </div>
              <div>
                <label class="block text-xs text-slate-400 mb-2">Color de acento</label>
                <div class="flex gap-2">
                  <button
                    v-for="a in ACCENTS" :key="a.key"
                    @click="seasonForm.accent = a.key"
                    :class="['w-9 h-9 rounded-lg bg-gradient-to-br transition', a.grad, seasonForm.accent === a.key ? 'ring-2 ring-white scale-110' : 'opacity-70 hover:opacity-100']"
                  ></button>
                </div>
              </div>
            </div>
            <div class="flex gap-3 mt-6">
              <button @click="showSeasonModal = false" class="flex-1 rounded-xl border border-white/15 hover:bg-white/5 text-white py-2.5 text-sm font-semibold transition">Cancelar</button>
              <button @click="saveSeason" class="flex-1 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-900 py-2.5 text-sm font-bold transition hover:brightness-110">Guardar</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ══════════ MODAL: editor de cosmético ══════════ -->
    <Teleport to="body">
      <div v-if="cosmeticForm" class="fixed inset-0 z-[70]">
        <div class="fixed inset-0 bg-black/80 backdrop-blur-sm" @click="cosmeticForm = null"></div>
        <div class="relative min-h-full flex items-center justify-center p-4">
          <div class="relative w-full max-w-md rounded-2xl border border-white/15 bg-slate-900 p-6 shadow-2xl">
            <h3 class="text-lg font-bold text-white mb-4">{{ isNewCosmetic ? 'Nuevo cosmético' : 'Editar cosmético' }}</h3>
            <div class="space-y-3">
              <div class="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-800/40 p-3">
                <PassCosmetic :cos="cosmeticForm" :size="44" />
                <span class="text-xs text-slate-400">Vista previa</span>
              </div>
              <div>
                <label class="block text-xs text-slate-400 mb-1">Código {{ isNewCosmetic ? '(único, ej: frame_pass_oct)' : '' }}</label>
                <input v-model="cosmeticForm.code" :disabled="!isNewCosmetic" placeholder="frame_pass_oct" class="w-full rounded-xl border border-white/15 bg-slate-800/60 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-400/60 disabled:opacity-50" />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs text-slate-400 mb-1">Tipo</label>
                  <select v-model="cosmeticForm.type" class="w-full rounded-xl border border-white/15 bg-slate-800/60 px-3 py-2.5 text-sm text-white outline-none">
                    <option v-for="t in TYPES" :key="t" :value="t">{{ t }}</option>
                  </select>
                </div>
                <div>
                  <label class="block text-xs text-slate-400 mb-1">Rareza</label>
                  <select v-model="cosmeticForm.rarity" class="w-full rounded-xl border border-white/15 bg-slate-800/60 px-3 py-2.5 text-sm text-white outline-none">
                    <option v-for="r in RARITIES" :key="r" :value="r">{{ r }}</option>
                  </select>
                </div>
              </div>
              <div>
                <label class="block text-xs text-slate-400 mb-1">{{ cosmeticForm.type === 'title' ? 'Texto del título' : 'Nombre' }}</label>
                <input v-model="cosmeticForm.name" class="w-full rounded-xl border border-white/15 bg-slate-800/60 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-400/60" />
              </div>
              <div v-if="cosmeticForm.type !== 'title'">
                <label class="block text-xs text-slate-400 mb-1">Estilo (style_key)</label>
                <select v-if="styleKeyOptions.length" v-model="cosmeticForm.style_key" class="w-full rounded-xl border border-white/15 bg-slate-800/60 px-3 py-2.5 text-sm text-white outline-none">
                  <option v-for="k in styleKeyOptions" :key="k" :value="k">{{ k }}</option>
                </select>
                <input v-else v-model="cosmeticForm.style_key" placeholder="clave del ícono" class="w-full rounded-xl border border-white/15 bg-slate-800/60 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-400/60" />
              </div>
              <div class="flex items-center gap-4">
                <label class="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input type="checkbox" v-model="cosmeticForm.premium_only" class="accent-amber-500 w-4 h-4" /> Solo PRO
                </label>
                <label class="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input type="checkbox" v-model="cosmeticForm.active" class="accent-emerald-500 w-4 h-4" /> Activo
                </label>
              </div>
            </div>
            <div class="flex gap-3 mt-6">
              <button @click="cosmeticForm = null" class="flex-1 rounded-xl border border-white/15 hover:bg-white/5 text-white py-2.5 text-sm font-semibold transition">Cancelar</button>
              <button @click="saveCosmetic" class="flex-1 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-900 py-2.5 text-sm font-bold transition hover:brightness-110">Guardar</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
