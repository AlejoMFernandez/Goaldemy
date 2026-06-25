<script>
import { computed, ref, onMounted } from 'vue'
import AppH1 from '../components/common/AppH1.vue'
import DailyStreakCalendar from '../components/rewards/DailyStreakCalendar.vue'
import RewardCard from '../components/rewards/RewardCard.vue'
import MonthlyPass from '../components/rewards/MonthlyPass.vue'
import { notificationsState, claimReward, claimAllRewards, clearClaimedRewards, pushClaimNotification } from '../stores/notifications'
import { soundManager } from '../services/sounds'
import { supabase } from '../services/supabase'
import { getDailyChallenges, claimDailyChallenge, getDailyReward, claimDailyReward, getProgressiveChallenges, claimProgressive, powerupLabel } from '../services/rewards'

const POWERUP_ICONS = { fifty_fifty: '✂️', shield: '🛡️', extra_time: '⏱️', reveal_hint: '💡' }

export default {
  name: 'RewardCenter',
  components: { AppH1, DailyStreakCalendar, RewardCard, MonthlyPass },
  setup() {
    const currentStreak = ref(0)
    const bestStreak = ref(0)
    const playedToday = ref(false)

    const challenges = ref([])
    const progressive = ref([])
    const dailyReward = ref({ available: false })
    const loadingDaily = ref(true)
    const claiming = ref(null)

    const rewards = computed(() => notificationsState.pendingRewards)
    const unclaimed = computed(() => rewards.value.filter(r => !r.claimed).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)))
    const claimed = computed(() => rewards.value.filter(r => r.claimed).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)))
    const unclaimedCount = computed(() => unclaimed.value.length)

    // Retos diarios: ocultar los ya reclamados; si no queda ninguno por hacer, mostrar estado "completado por hoy".
    const visibleChallenges = computed(() => challenges.value.filter(c => !c.claimed))
    const allChallengesDone = computed(() => challenges.value.length > 0 && visibleChallenges.value.length === 0)

    function powerupIcon(t) { return POWERUP_ICONS[t] || '🎁' }

    function handleClaim(id) { claimReward(id); soundManager.play('claim') }
    function handleClaimAll() { claimAllRewards(); soundManager.play('claim') }
    function handleClearClaimed() { clearClaimedRewards() }

    async function loadStreak() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data } = await supabase
          .from('user_profiles')
          .select('daily_streak, best_daily_streak, last_activity_date')
          .eq('id', user.id)
          .single()
        if (data) {
          currentStreak.value = data.daily_streak || 0
          bestStreak.value = data.best_daily_streak || 0
          const today = new Date().toISOString().split('T')[0]
          playedToday.value = data.last_activity_date === today
        }
      } catch {}
    }

    async function loadDaily() {
      loadingDaily.value = true
      try {
        const [ch, dr, pg] = await Promise.all([getDailyChallenges(), getDailyReward(), getProgressiveChallenges()])
        challenges.value = ch
        dailyReward.value = dr
        progressive.value = pg
      } finally {
        loadingDaily.value = false
      }
    }

    async function handleClaimDailyReward() {
      if (!dailyReward.value.available || claiming.value === 'daily') return
      claiming.value = 'daily'
      try {
        const res = await claimDailyReward()
        if (res.ok) {
          dailyReward.value = { ...dailyReward.value, available: false, claimed: true }
          soundManager.play('claim')
          if (res.reward_kind === 'powerup') {
            pushClaimNotification({ type: 'powerup', title: `${powerupLabel(res.reward_powerup)} ×${res.amount}`, emoji: powerupIcon(res.reward_powerup) })
          } else {
            pushClaimNotification({ type: 'xp', title: 'Recompensa diaria', xp: res.amount, emoji: '⭐' })
          }
        }
      } finally {
        claiming.value = null
      }
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
          if (res.reward_powerup) {
            pushClaimNotification({ type: 'powerup', title: `${res.title}`, emoji: powerupIcon(res.reward_powerup) })
          } else {
            pushClaimNotification({ type: 'xp', title: res.title, xp: res.reward_xp, emoji: '🎯' })
          }
        }
      } finally {
        claiming.value = null
      }
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
      } finally {
        claiming.value = null
      }
    }

    onMounted(() => { loadStreak(); loadDaily() })

    return {
      rewards, unclaimed, claimed, unclaimedCount,
      currentStreak, bestStreak, playedToday,
      challenges, visibleChallenges, allChallengesDone, progressive, dailyReward, loadingDaily, claiming,
      handleClaim, handleClaimAll, handleClearClaimed,
      handleClaimDailyReward, handleClaimChallenge, handleClaimProgressive,
      powerupLabel, powerupIcon,
    }
  }
}
</script>

<template>
  <section class="max-w-2xl mx-auto space-y-6">
    <div class="flex items-center justify-between">
      <AppH1 class="text-2xl md:text-3xl">Recompensas</AppH1>
      <router-link to="/play/points" class="rounded-full border border-white/15 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/5 transition">
        ← Juegos
      </router-link>
    </div>

    <!-- Daily Streak Calendar -->
    <DailyStreakCalendar
      :currentStreak="currentStreak"
      :bestStreak="bestStreak"
      :playedToday="playedToday"
    />

    <!-- Pase mensual (battle-pass) -->
    <MonthlyPass />

    <!-- Recompensa diaria -->
    <div
      class="relative overflow-hidden rounded-2xl border p-5 transition-all"
      :class="dailyReward.available
        ? 'border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-slate-900/40 to-cyan-500/5'
        : 'border-white/10 bg-white/[0.03]'"
    >
      <div class="flex items-center gap-4">
        <div
          class="w-14 h-14 rounded-2xl grid place-items-center text-2xl border shrink-0"
          :class="dailyReward.available ? 'bg-emerald-500/15 border-emerald-400/30' : 'bg-white/5 border-white/10 opacity-60'"
        >
          {{ dailyReward.reward_kind === 'powerup' ? powerupIcon(dailyReward.reward_powerup) : '⭐' }}
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-[10px] uppercase tracking-wider text-emerald-400/80 font-semibold">Recompensa diaria</div>
          <div class="font-display font-bold text-white text-lg leading-tight">
            <template v-if="dailyReward.reward_kind === 'powerup'">{{ powerupLabel(dailyReward.reward_powerup) }} ×{{ dailyReward.amount }}</template>
            <template v-else>+{{ dailyReward.amount || 100 }} XP</template>
          </div>
          <div class="text-xs text-slate-400 mt-0.5">
            {{ dailyReward.reward_kind === 'powerup' ? '¡Fin de semana! Llevate una ayuda' : 'Reclamala todos los días' }}
          </div>
        </div>
        <button
          v-if="dailyReward.available"
          @click="handleClaimDailyReward"
          :disabled="claiming === 'daily'"
          class="shrink-0 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110 active:scale-95 text-white px-5 py-2.5 text-sm font-bold transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-60"
          style="animation: claim-pulse 2s ease-in-out infinite"
        >
          Reclamar
        </button>
        <div v-else class="shrink-0 flex items-center gap-1.5 text-emerald-400 text-sm font-semibold">
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
          Reclamada
        </div>
      </div>
    </div>

    <!-- Retos diarios -->
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="font-display font-bold text-white text-lg flex items-center gap-2">
          <span>🎯</span> Retos diarios
        </h2>
        <span class="text-[11px] text-slate-500">Se reinician cada día</span>
      </div>

      <div v-if="loadingDaily" class="space-y-2">
        <div v-for="i in 3" :key="i" class="h-20 rounded-2xl bg-white/5 animate-pulse"></div>
      </div>

      <div v-else-if="visibleChallenges.length" class="space-y-2">
        <div
          v-for="c in visibleChallenges"
          :key="c.code"
          class="relative rounded-2xl border p-4 transition-all"
          :class="c.progress >= c.target
            ? 'border-emerald-500/30 bg-emerald-500/[0.06]'
            : 'border-white/10 bg-white/[0.03]'"
        >
          <div class="flex items-center gap-3">
            <div class="w-11 h-11 rounded-xl grid place-items-center text-xl bg-white/5 border border-white/10 shrink-0">
              {{ c.icon }}
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between gap-2">
                <div class="font-semibold text-white text-sm truncate">{{ c.title }}</div>
                <div class="shrink-0 flex items-center gap-1.5 text-xs font-bold">
                  <span v-if="c.reward_xp > 0" class="text-emerald-400">+{{ c.reward_xp }} XP</span>
                  <span v-if="c.reward_powerup" class="text-amber-300">{{ powerupIcon(c.reward_powerup) }} ×{{ c.reward_powerup_qty }}</span>
                </div>
              </div>
              <div class="text-[11px] text-slate-400 mt-0.5 truncate">{{ c.description }}</div>
              <!-- Progress -->
              <div class="mt-2 flex items-center gap-2">
                <div class="flex-1 h-1.5 rounded-full bg-black/30 overflow-hidden">
                  <div
                    class="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all duration-500"
                    :style="{ width: Math.min(100, (c.progress / c.target) * 100) + '%' }"
                  ></div>
                </div>
                <span class="text-[10px] tabular-nums text-slate-400 font-semibold">{{ Math.min(c.progress, c.target) }}/{{ c.target }}</span>
              </div>
            </div>
          </div>

          <!-- Claim (los reclamados desaparecen de la lista) -->
          <button
            v-if="c.progress >= c.target"
            @click="handleClaimChallenge(c)"
            :disabled="claiming === c.code"
            class="mt-3 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110 active:scale-[0.98] text-white py-2 text-sm font-bold transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-60"
          >
            Reclamar recompensa
          </button>
        </div>
      </div>

      <!-- Todos los retos del día completados (estilo AFK Journey) -->
      <div v-else-if="allChallengesDone" class="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.07] to-cyan-500/[0.04] p-8 text-center">
        <div class="text-4xl mb-3">🎉</div>
        <p class="font-display font-bold text-white">¡Completaste todos los retos de hoy!</p>
        <p class="text-sm text-slate-400 mt-1">Volvé mañana para nuevos desafíos.</p>
        <div class="mt-3 inline-flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          Se reinician a medianoche
        </div>
      </div>
    </div>

    <!-- Retos progresivos -->
    <div v-if="progressive.length" class="space-y-3">
      <h2 class="font-display font-bold text-white text-lg flex items-center gap-2">
        <span>🏆</span> Retos progresivos
      </h2>
      <div class="space-y-2">
        <div
          v-for="c in progressive"
          :key="c.code"
          class="relative rounded-2xl border p-4 transition-all"
          :class="c.claimable ? 'border-amber-500/30 bg-amber-500/[0.06]' : 'border-white/10 bg-white/[0.03]'"
        >
          <div class="flex items-center gap-3">
            <div class="w-11 h-11 rounded-xl grid place-items-center text-xl bg-white/5 border border-white/10 shrink-0">
              {{ c.icon }}
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between gap-2">
                <div class="font-semibold text-white text-sm truncate flex items-center gap-2">
                  {{ c.title }}
                  <span class="shrink-0 rounded-full bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">Nivel {{ c.tier }}</span>
                </div>
                <div class="shrink-0 flex items-center gap-1.5 text-xs font-bold">
                  <span v-if="c.reward_xp > 0" class="text-emerald-400">+{{ c.reward_xp }} XP</span>
                  <span v-if="c.reward_powerup && c.reward_powerup_qty > 0" class="text-amber-300">{{ powerupIcon(c.reward_powerup) }} ×{{ c.reward_powerup_qty }}</span>
                </div>
              </div>
              <div class="mt-2 flex items-center gap-2">
                <div class="flex-1 h-1.5 rounded-full bg-black/30 overflow-hidden">
                  <div
                    class="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-400 transition-all duration-500"
                    :style="{ width: Math.min(100, (c.progress / c.target) * 100) + '%' }"
                  ></div>
                </div>
                <span class="text-[10px] tabular-nums text-slate-400 font-semibold">{{ Math.min(c.progress, c.target) }}/{{ c.target }}</span>
              </div>
            </div>
          </div>
          <button
            v-if="c.claimable"
            @click="handleClaimProgressive(c)"
            :disabled="claiming === 'prog_' + c.code"
            class="mt-3 w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-110 active:scale-[0.98] text-black py-2 text-sm font-bold transition-all shadow-lg shadow-amber-500/20 disabled:opacity-60"
          >
            Reclamar y subir de nivel
          </button>
        </div>
      </div>
    </div>

    <!-- Pending Rewards (logros / niveles) -->
    <div v-if="unclaimed.length > 0" class="space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="font-display font-bold text-white text-lg">
          Pendientes
          <span class="ml-2 inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold">
            {{ unclaimedCount }}
          </span>
        </h2>
        <button
          v-if="unclaimedCount > 1"
          @click="handleClaimAll"
          class="rounded-lg px-4 py-2 text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-emerald-500/20"
          style="animation: claim-pulse 2s ease-in-out infinite"
        >
          Reclamar todo
        </button>
      </div>
      <div class="space-y-2">
        <RewardCard
          v-for="r in unclaimed"
          :key="r.id"
          :reward="r"
          @claim="handleClaim"
        />
      </div>
    </div>

    <!-- Claimed history -->
    <div v-if="claimed.length > 0" class="space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-semibold text-slate-400 uppercase tracking-wider">Reclamados</h2>
        <button @click="handleClearClaimed" class="text-xs text-slate-500 hover:text-slate-300 transition">
          Limpiar
        </button>
      </div>
      <div class="space-y-2">
        <RewardCard v-for="r in claimed" :key="r.id" :reward="r" />
      </div>
    </div>
  </section>
</template>
