<script setup>
/**
 * Popup de acceso rápido a OBJETIVOS (estilo LoL), abierto desde la sidebar.
 * Pestañas: Diarios · Progresos · Pase de batalla. Reusa los servicios de /rewards.
 */
import { ref, computed, watch } from 'vue'
import PowerupIcon from './PowerupIcon.vue'
import MonthlyPass from './MonthlyPass.vue'
import { soundManager } from '../../services/sounds'
import { pushClaimNotification } from '../../stores/notifications'
import {
  getDailyChallenges, claimDailyChallenge, getDailyReward, claimDailyReward,
  getProgressiveChallenges, claimProgressive, powerupLabel,
} from '../../services/rewards'

const props = defineProps({ open: { type: Boolean, default: false } })
const emit = defineEmits(['close'])

const POWERUP_ICONS = { fifty_fifty: '✂️', shield: '🛡️', extra_time: '⏱️', reveal_hint: '💡' }
function powerupIcon(t) { return POWERUP_ICONS[t] || '🎁' }

const activeTab = ref('diario')
const challenges = ref([])
const progressive = ref([])
const dailyReward = ref({ available: false })
const loading = ref(true)
const claiming = ref(null)
const loaded = ref(false)

const visibleChallenges = computed(() => challenges.value.filter(c => !c.claimed))
const allChallengesDone = computed(() => challenges.value.length > 0 && visibleChallenges.value.length === 0)
const dailyClaimable = computed(() => (dailyReward.value.available ? 1 : 0) + visibleChallenges.value.filter(c => c.progress >= c.target).length)
const progClaimable = computed(() => progressive.value.filter(c => c.claimable).length)

const TABS = computed(() => [
  { key: 'diario', label: 'Diarios', count: dailyClaimable.value },
  { key: 'progresos', label: 'Progresos', count: progClaimable.value },
  { key: 'pase', label: 'Pase', count: 0 },
])

async function loadDaily() {
  loading.value = true
  try {
    const [ch, dr, pg] = await Promise.all([getDailyChallenges(), getDailyReward(), getProgressiveChallenges()])
    challenges.value = ch; dailyReward.value = dr; progressive.value = pg
    loaded.value = true
  } finally { loading.value = false }
}

async function handleClaimDailyReward() {
  if (!dailyReward.value.available || claiming.value === 'daily') return
  claiming.value = 'daily'
  try {
    const res = await claimDailyReward()
    if (res.ok) {
      dailyReward.value = { ...dailyReward.value, available: false, claimed: true }
      soundManager.play('claim')
      if (res.reward_kind === 'powerup') pushClaimNotification({ type: 'powerup', title: `${powerupLabel(res.reward_powerup)} ×${res.amount}`, emoji: powerupIcon(res.reward_powerup) })
      else pushClaimNotification({ type: 'xp', title: 'Recompensa diaria', xp: res.amount, emoji: '⭐' })
    }
  } finally { claiming.value = null }
}

async function handleClaimChallenge(c) {
  if (c.claimed || c.progress < c.target || claiming.value === c.code) return
  claiming.value = c.code
  try {
    const res = await claimDailyChallenge(c.code)
    if (res.ok) {
      const idx = challenges.value.findIndex(x => x.code === c.code)
      if (idx !== -1) challenges.value[idx] = { ...challenges.value[idx], claimed: true }
      soundManager.play('claim')
      if (res.reward_powerup) pushClaimNotification({ type: 'powerup', title: res.title, emoji: powerupIcon(res.reward_powerup) })
      else pushClaimNotification({ type: 'xp', title: res.title, xp: res.reward_xp, emoji: '🎯' })
    }
  } finally { claiming.value = null }
}

async function handleClaimProgressive(c) {
  const key = 'prog_' + c.code
  if (!c.claimable || claiming.value === key) return
  claiming.value = key
  try {
    const res = await claimProgressive(c.code)
    if (res.ok) {
      soundManager.play('claim')
      if (res.powerup) pushClaimNotification({ type: 'powerup', title: res.title, emoji: powerupIcon(res.powerup) })
      else pushClaimNotification({ type: 'xp', title: res.title, xp: res.xp, emoji: '🏆' })
      await loadDaily()
    }
  } finally { claiming.value = null }
}

// Cargar la primera vez que se abre.
watch(() => props.open, (o) => { if (o && !loaded.value) loadDaily() })
</script>

<template>
  <Teleport to="body">
    <Transition name="ch-fade">
      <div v-if="open" class="fixed inset-0 z-[70] grid place-items-center p-4" @click.self="emit('close')">
        <div class="absolute inset-0 bg-black/75 backdrop-blur-sm"></div>
        <div class="relative w-full max-w-lg max-h-[86vh] flex flex-col rounded-2xl border border-white/15 bg-gradient-to-b from-slate-900 to-slate-950 shadow-2xl overflow-hidden">
          <!-- Header -->
          <div class="shrink-0 flex items-center gap-2.5 px-5 py-4 border-b border-white/10 bg-white/[0.03]">
            <span class="grid place-items-center h-9 w-9 rounded-xl bg-amber-500/15 border border-amber-400/25 text-amber-300">
              <svg viewBox="0 0 24 24" fill="currentColor" class="h-5 w-5"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            </span>
            <div class="flex-1">
              <h3 class="font-display font-extrabold text-white leading-tight">Objetivos</h3>
              <p class="text-[11px] text-slate-400">Reclamá tus recompensas del día</p>
            </div>
            <router-link to="/rewards" @click="emit('close')" class="text-xs font-semibold text-slate-300 hover:text-white rounded-lg px-2.5 py-1.5 hover:bg-white/5 transition">Ver todo →</router-link>
            <button @click="emit('close')" class="h-8 w-8 grid place-items-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5"><path d="M6 18 18 6M6 6l12 12"/></svg>
            </button>
          </div>

          <!-- Tabs -->
          <div class="shrink-0 px-4 pt-3">
            <div class="grid grid-cols-3 gap-1 rounded-xl border border-white/10 bg-slate-900/70 p-1">
              <button v-for="t in TABS" :key="t.key" @click="activeTab = t.key"
                      class="relative rounded-lg px-2 py-2 text-sm font-bold transition"
                      :class="activeTab === t.key ? 'bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-white ring-1 ring-emerald-400/30' : 'text-slate-400 hover:text-slate-200'">
                {{ t.label }}
                <span v-if="t.count > 0" class="absolute -top-1 -right-1 grid place-items-center min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold leading-none ring-2 ring-slate-900">{{ t.count > 9 ? '9+' : t.count }}</span>
              </button>
            </div>
          </div>

          <!-- Body -->
          <div class="flex-1 overflow-y-auto p-4 rail-scroll">
            <!-- ══ DIARIOS ══ -->
            <div v-show="activeTab === 'diario'" class="space-y-3">
              <div v-if="loading" class="space-y-2"><div v-for="i in 3" :key="i" class="h-16 rounded-xl bg-white/5 animate-pulse"></div></div>
              <template v-else>
                <!-- Recompensa diaria -->
                <div class="rounded-xl border p-3.5 flex items-center gap-3" :class="dailyReward.available ? 'border-emerald-500/30 bg-emerald-500/[0.08]' : 'border-white/10 bg-white/[0.03]'">
                  <div class="w-11 h-11 rounded-xl grid place-items-center text-xl border shrink-0" :class="dailyReward.available ? 'bg-emerald-500/15 border-emerald-400/30' : 'bg-white/5 border-white/10 opacity-60'">
                    <PowerupIcon v-if="dailyReward.reward_kind === 'powerup'" :type="dailyReward.reward_powerup" :size="34" />
                    <span v-else>⭐</span>
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="text-[10px] uppercase tracking-wider text-emerald-400/80 font-semibold">Recompensa diaria</div>
                    <div class="font-bold text-white text-sm leading-tight">
                      <template v-if="dailyReward.reward_kind === 'powerup'">{{ powerupLabel(dailyReward.reward_powerup) }} ×{{ dailyReward.amount }}</template>
                      <template v-else>+{{ dailyReward.amount || 100 }} XP</template>
                    </div>
                  </div>
                  <button v-if="dailyReward.available" @click="handleClaimDailyReward" :disabled="claiming === 'daily'" class="shrink-0 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110 active:scale-95 text-white px-4 py-2 text-xs font-bold transition disabled:opacity-60">Reclamar</button>
                  <span v-else class="shrink-0 text-emerald-400 text-xs font-semibold">Reclamada</span>
                </div>

                <!-- Retos diarios -->
                <div v-for="c in visibleChallenges" :key="c.code" class="rounded-xl border p-3 transition" :class="c.progress >= c.target ? 'border-emerald-500/30 bg-emerald-500/[0.06]' : 'border-white/10 bg-white/[0.03]'">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-lg grid place-items-center text-lg bg-white/5 border border-white/10 shrink-0">{{ c.icon }}</div>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center justify-between gap-2">
                        <div class="font-semibold text-white text-sm truncate">{{ c.title }}</div>
                        <div class="shrink-0 flex items-center gap-1.5 text-xs font-bold">
                          <span v-if="c.reward_xp > 0" class="text-emerald-400">+{{ c.reward_xp }}</span>
                          <span v-if="c.reward_powerup" class="inline-flex items-center gap-1 text-amber-300"><PowerupIcon :type="c.reward_powerup" :size="14" />×{{ c.reward_powerup_qty }}</span>
                        </div>
                      </div>
                      <div class="mt-1.5 flex items-center gap-2">
                        <div class="flex-1 h-1.5 rounded-full bg-black/30 overflow-hidden"><div class="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all duration-500" :style="{ width: Math.min(100, (c.progress / c.target) * 100) + '%' }"></div></div>
                        <span class="text-[10px] tabular-nums text-slate-400 font-semibold">{{ Math.min(c.progress, c.target) }}/{{ c.target }}</span>
                      </div>
                    </div>
                  </div>
                  <button v-if="c.progress >= c.target" @click="handleClaimChallenge(c)" :disabled="claiming === c.code" class="mt-2.5 w-full rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110 active:scale-[0.98] text-white py-1.5 text-xs font-bold transition disabled:opacity-60">Reclamar</button>
                </div>

                <div v-if="allChallengesDone" class="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-6 text-center">
                  <div class="text-3xl mb-2">🎉</div>
                  <p class="font-bold text-white text-sm">¡Completaste los retos de hoy!</p>
                  <p class="text-xs text-slate-400 mt-1">Volvé mañana para nuevos desafíos.</p>
                </div>
              </template>
            </div>

            <!-- ══ PROGRESOS ══ -->
            <div v-show="activeTab === 'progresos'" class="space-y-2.5">
              <div v-if="loading" class="space-y-2"><div v-for="i in 3" :key="i" class="h-20 rounded-xl bg-white/5 animate-pulse"></div></div>
              <template v-else>
                <div v-for="c in progressive" :key="c.code" class="rounded-xl border p-3 transition" :class="c.claimable ? 'border-amber-500/40 bg-amber-500/[0.07]' : 'border-white/10 bg-white/[0.03]'">
                  <div class="flex items-stretch gap-3">
                    <div class="w-10 h-10 rounded-lg grid place-items-center text-lg bg-white/5 border border-white/10 shrink-0 self-start">{{ c.icon }}</div>
                    <div class="flex-1 min-w-0">
                      <div class="font-semibold text-white text-sm flex items-center gap-2">{{ c.title }}<span class="shrink-0 rounded-full bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">Nivel {{ c.tier }}</span></div>
                      <div class="mt-1.5 flex items-center gap-2">
                        <div class="flex-1 h-1.5 rounded-full bg-black/30 overflow-hidden"><div class="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-400 transition-all duration-500" :style="{ width: Math.min(100, (c.progress / c.target) * 100) + '%' }"></div></div>
                        <span class="text-[10px] tabular-nums text-slate-400 font-semibold">{{ Math.min(c.progress, c.target) }}/{{ c.target }}</span>
                      </div>
                    </div>
                    <div class="shrink-0 w-[76px] rounded-lg border p-1.5 flex flex-col items-center justify-center text-center" :class="c.claimable ? 'border-amber-400/40 bg-amber-500/10' : 'border-white/10 bg-black/20'">
                      <div v-if="c.reward_powerup && c.reward_powerup_qty > 0" class="flex flex-col items-center"><PowerupIcon :type="c.reward_powerup" :size="30" /><div class="text-[10px] font-bold text-amber-300">×{{ c.reward_powerup_qty }}</div></div>
                      <div v-if="c.reward_xp > 0"><span class="font-display font-extrabold text-sm text-emerald-300">+{{ c.reward_xp }}</span><span class="text-[8px] text-slate-400 uppercase ml-0.5">XP</span></div>
                    </div>
                  </div>
                  <button v-if="c.claimable" @click="handleClaimProgressive(c)" :disabled="claiming === 'prog_' + c.code" class="mt-2.5 w-full rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-110 active:scale-[0.98] text-black py-1.5 text-xs font-bold transition disabled:opacity-60">Reclamar y subir</button>
                </div>
                <div v-if="!progressive.length" class="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center text-sm text-slate-400">Todavía no tenés retos progresivos activos.</div>
              </template>
            </div>

            <!-- ══ PASE ══ -->
            <div v-show="activeTab === 'pase'">
              <MonthlyPass />
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.ch-fade-enter-active, .ch-fade-leave-active { transition: opacity .2s ease; }
.ch-fade-enter-from, .ch-fade-leave-to { opacity: 0; }
.rail-scroll::-webkit-scrollbar { width: 6px; }
.rail-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,.12); border-radius: 9999px; }
.rail-scroll::-webkit-scrollbar-track { background: transparent; }
</style>
