<script setup>
/**
 * ADMIN — DASHBOARD
 * KPIs que sirven para gestionar Goaldemy: ingresos (MRR), suscriptores
 * PRO, conversión, actividad (DAU / partidas), altas por día, mix por
 * plan y proveedor, top juegos y top XP. Una sola llamada al RPC
 * get_admin_dashboard (ver supabase/mejoras11-admin-dashboard.sql).
 */
import { ref, computed, onMounted } from 'vue'
import { getAdminDashboard } from '../../services/admin.js'

const loading = ref(true)
const err = ref('')
const d = ref({})

const MONTHS_ES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']

const ars = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0)
const num = (n) => new Intl.NumberFormat('es-AR').format(n || 0)

const conversion = computed(() => {
  const t = d.value.total_users || 0
  if (!t) return 0
  return ((d.value.pro_active || 0) / t) * 100
})

const signups = computed(() => d.value.signups_daily || [])
const maxSignup = computed(() => Math.max(1, ...signups.value.map(s => s.c || 0)))
function dayLabel(dateStr) {
  const dt = new Date(dateStr + 'T00:00:00')
  return `${dt.getDate()} ${MONTHS_ES[dt.getMonth()]}`
}

const planColors = { pro: 'from-emerald-400 to-cyan-500', legend: 'from-amber-400 to-yellow-600' }
function planColor(slug) { return planColors[slug] || 'from-slate-400 to-slate-600' }

async function load() {
  loading.value = true; err.value = ''
  try {
    d.value = await getAdminDashboard()
  } catch (e) {
    err.value = e.message || 'Error cargando el dashboard'
  } finally {
    loading.value = false
  }
}
onMounted(load)
defineExpose({ load })
</script>

<template>
  <div>
    <div v-if="loading" class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <div v-for="i in 4" :key="i" class="h-28 rounded-2xl bg-slate-800/60 border border-white/10 animate-pulse"></div>
    </div>

    <div v-else-if="err" class="mb-8 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
      {{ err }}
    </div>

    <template v-else>
      <!-- KPIs principales -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <!-- MRR -->
        <div class="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-slate-900/40 p-5 shadow-xl">
          <div class="flex items-center gap-2 mb-2">
            <div class="bg-emerald-500/20 p-2 rounded-lg">
              <svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"/></svg>
            </div>
            <h3 class="text-slate-400 text-xs uppercase tracking-wide">MRR (ingreso mensual)</h3>
          </div>
          <p class="text-3xl font-extrabold text-white">{{ ars(d.mrr_ars) }}</p>
          <p class="text-xs text-slate-500 mt-1">recurrente de subs activas</p>
        </div>

        <!-- PRO activos -->
        <div class="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-slate-900/40 p-5 shadow-xl">
          <div class="flex items-center gap-2 mb-2">
            <div class="bg-amber-500/20 p-2 rounded-lg">
              <svg class="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
            </div>
            <h3 class="text-slate-400 text-xs uppercase tracking-wide">Suscriptores PRO</h3>
          </div>
          <p class="text-3xl font-extrabold text-white">{{ num(d.pro_active) }}</p>
          <p class="text-xs text-slate-500 mt-1">
            <span v-if="d.subs_past_due" class="text-red-400">{{ d.subs_past_due }} en mora</span>
            <span v-else>al día</span>
          </p>
        </div>

        <!-- Conversión -->
        <div class="rounded-2xl border border-white/10 bg-slate-800/80 p-5 shadow-xl">
          <div class="flex items-center gap-2 mb-2">
            <div class="bg-cyan-500/20 p-2 rounded-lg">
              <svg class="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
            </div>
            <h3 class="text-slate-400 text-xs uppercase tracking-wide">Conversión a PRO</h3>
          </div>
          <p class="text-3xl font-extrabold text-white">{{ conversion.toFixed(1) }}%</p>
          <p class="text-xs text-slate-500 mt-1">{{ num(d.pro_active) }} de {{ num(d.total_users) }} usuarios</p>
        </div>

        <!-- DAU -->
        <div class="rounded-2xl border border-white/10 bg-slate-800/80 p-5 shadow-xl">
          <div class="flex items-center gap-2 mb-2">
            <div class="bg-green-500/20 p-2 rounded-lg">
              <svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            </div>
            <h3 class="text-slate-400 text-xs uppercase tracking-wide">Activos hoy (DAU)</h3>
          </div>
          <p class="text-3xl font-extrabold text-white">{{ num(d.dau) }}</p>
          <p class="text-xs text-slate-500 mt-1">{{ num(d.active_7d) }} activos en 7d</p>
        </div>
      </div>

      <!-- KPIs secundarios -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div class="rounded-xl border border-white/10 bg-slate-800/50 p-4">
          <h3 class="text-slate-400 text-xs uppercase tracking-wide mb-1">Partidas hoy</h3>
          <p class="text-2xl font-bold text-white">{{ num(d.games_today) }}</p>
        </div>
        <div class="rounded-xl border border-white/10 bg-slate-800/50 p-4">
          <h3 class="text-slate-400 text-xs uppercase tracking-wide mb-1">Partidas 7d</h3>
          <p class="text-2xl font-bold text-white">{{ num(d.games_7d) }}</p>
        </div>
        <div class="rounded-xl border border-white/10 bg-slate-800/50 p-4">
          <h3 class="text-slate-400 text-xs uppercase tracking-wide mb-1">Nuevos 24h</h3>
          <p class="text-2xl font-bold text-white">{{ num(d.new_users_24h) }}</p>
        </div>
        <div class="rounded-xl border border-white/10 bg-slate-800/50 p-4">
          <h3 class="text-slate-400 text-xs uppercase tracking-wide mb-1">Bajas 30d</h3>
          <p class="text-2xl font-bold text-white">{{ num(d.subs_cancelled_30d) }}</p>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        <!-- Altas por día -->
        <div class="lg:col-span-2 rounded-2xl border border-white/10 bg-slate-800/50 p-5">
          <h3 class="text-sm font-semibold text-white mb-4">Altas de usuarios · últimos 14 días</h3>
          <div class="flex items-end gap-1.5 h-32">
            <div v-for="s in signups" :key="s.d" class="flex-1 flex flex-col items-center justify-end group relative">
              <div
                class="w-full rounded-t bg-gradient-to-t from-emerald-600 to-cyan-400 transition-all min-h-[2px]"
                :style="{ height: ((s.c / maxSignup) * 100) + '%' }"
              ></div>
              <div class="absolute -top-6 opacity-0 group-hover:opacity-100 transition text-[10px] bg-slate-900 border border-white/10 rounded px-1.5 py-0.5 text-white whitespace-nowrap">
                {{ s.c }} · {{ dayLabel(s.d) }}
              </div>
            </div>
          </div>
          <div class="flex justify-between text-[10px] text-slate-500 mt-2">
            <span>{{ signups.length ? dayLabel(signups[0].d) : '' }}</span>
            <span>hoy</span>
          </div>
        </div>

        <!-- Mix de suscripciones -->
        <div class="rounded-2xl border border-white/10 bg-slate-800/50 p-5">
          <h3 class="text-sm font-semibold text-white mb-4">Suscripciones activas</h3>
          <div v-if="(d.by_plan || []).length" class="space-y-3">
            <div v-for="p in d.by_plan" :key="p.plan_slug">
              <div class="flex justify-between text-xs mb-1">
                <span class="text-slate-300 capitalize font-semibold">{{ p.plan_slug }}</span>
                <span class="text-slate-400">{{ p.c }}</span>
              </div>
              <div class="h-2 rounded-full bg-slate-700 overflow-hidden">
                <div class="h-full rounded-full bg-gradient-to-r" :class="planColor(p.plan_slug)" :style="{ width: ((p.c / (d.pro_active || 1)) * 100) + '%' }"></div>
              </div>
            </div>
          </div>
          <p v-else class="text-sm text-slate-500">Sin suscripciones activas todavía.</p>

          <div v-if="(d.by_provider || []).length" class="mt-5 pt-4 border-t border-white/5">
            <h4 class="text-[10px] uppercase tracking-wide text-slate-500 mb-2">Por proveedor</h4>
            <div class="flex flex-wrap gap-2">
              <span v-for="pv in d.by_provider" :key="pv.provider" class="text-xs bg-white/5 border border-white/10 rounded-lg px-2.5 py-1 text-slate-300">
                {{ pv.provider }}: <strong class="text-white">{{ pv.c }}</strong>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <!-- Top juegos -->
        <div class="rounded-2xl border border-white/10 bg-slate-800/50 p-5">
          <h3 class="text-sm font-semibold text-white mb-4">Juegos más jugados · 7 días</h3>
          <div v-if="(d.top_games || []).length" class="space-y-2">
            <div v-for="(g, i) in d.top_games" :key="g.name" class="flex items-center gap-3">
              <span class="text-xs text-slate-500 w-4">{{ i + 1 }}</span>
              <span class="text-sm text-slate-200 flex-1 truncate">{{ g.name }}</span>
              <span class="text-sm font-bold text-white">{{ num(g.c) }}</span>
            </div>
          </div>
          <p v-else class="text-sm text-slate-500">Sin partidas en los últimos 7 días.</p>
        </div>

        <!-- Top XP -->
        <div class="rounded-2xl border border-white/10 bg-slate-800/50 p-5">
          <h3 class="text-sm font-semibold text-white mb-4">Top jugadores por XP</h3>
          <div v-if="(d.top_xp || []).length" class="space-y-2">
            <div v-for="(u, i) in d.top_xp" :key="i" class="flex items-center gap-3">
              <span class="text-xs w-4" :class="i === 0 ? 'text-amber-400' : 'text-slate-500'">{{ i + 1 }}</span>
              <span class="text-sm text-slate-200 flex-1 truncate">{{ u.display_name || 'Usuario' }}</span>
              <span class="text-sm font-bold text-white">{{ num(u.xp) }} XP</span>
            </div>
          </div>
          <p v-else class="text-sm text-slate-500">Sin datos de XP.</p>
        </div>
      </div>
    </template>
  </div>
</template>
