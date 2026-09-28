<script>
import { computed, ref, onMounted } from 'vue'
import DailyStreakCalendar from '../components/rewards/DailyStreakCalendar.vue'
import RewardCard from '../components/rewards/RewardCard.vue'
import MonthlyPass from '../components/rewards/MonthlyPass.vue'
import PowerupIcon from '../components/rewards/PowerupIcon.vue'
import DailyEnvelope from '../components/rewards/DailyEnvelope.vue'
import { notificationsState, claimReward, claimAllRewards, clearClaimedRewards, pushClaimNotification } from '../stores/notifications'
import { soundManager } from '../services/sounds'
import { supabase } from '../services/supabase'
import { flyReward, hasRewardAnchor } from '../services/reward-flight'
import { getDailyChallenges, claimDailyChallenge, getDailyReward, claimDailyReward, getProgressiveChallenges, claimProgressive, powerupLabel } from '../services/rewards'

const POWERUP_ICONS = { fifty_fifty: '✂️', shield: '🛡️', extra_time: '⏱️', reveal_hint: '💡' }

export default {
  name: 'RewardCenter',
  components: { DailyStreakCalendar, RewardCard, MonthlyPass, PowerupIcon, DailyEnvelope },
  setup() {
    const activeTab = ref('pase')

    const currentStreak = ref(0)
    const bestStreak = ref(0)
    const playedToday = ref(false)

    const challenges = ref([])
    const progressive = ref([])
    const dailyReward = ref({ available: false })
    // Día 7 del calendario (domingo) → sobre dorado
    const isSunday = new Date().getDay() === 0
    const loadingDaily = ref(true)
    const claiming = ref(null)

    const rewards = computed(() => notificationsState.pendingRewards)
    const unclaimed = computed(() => rewards.value.filter(r => !r.claimed).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)))
    const claimed = computed(() => rewards.value.filter(r => r.claimed).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)))
    const unclaimedCount = computed(() => unclaimed.value.length)

    // Retos diarios: ocultar los ya reclamados; si no queda ninguno por hacer, mostrar estado "completado por hoy".
    const visibleChallenges = computed(() => challenges.value.filter(c => !c.claimed))
    const allChallengesDone = computed(() => challenges.value.length > 0 && visibleChallenges.value.length === 0)

    // Contadores por pestaña (para los badges de las tabs)
    const dailyClaimable = computed(() =>
      (dailyReward.value.available ? 1 : 0) + visibleChallenges.value.filter(c => c.progress >= c.target).length
    )
    const progClaimable = computed(() => progressive.value.filter(c => c.claimable).length)

    const TABS = computed(() => [
      { key: 'pase', label: 'Pase', count: 0 },
      { key: 'diario', label: 'Diario', count: dailyClaimable.value },
      { key: 'progresos', label: 'Progresos', count: progClaimable.value },
      { key: 'bandeja', label: 'Bandeja', count: unclaimedCount.value },
    ])

    function powerupIcon(t) { return POWERUP_ICONS[t] || '🎁' }

    // Recompensa que viaja (moodboard 02): del botón a tu avatar. Toast solo si no hay destino.
    function rewardXp(r) { return r?.data?.xpBonus || r?.data?.points || 0 }
    function handleClaim(id, el) {
      const r = notificationsState.pendingRewards.find(x => x.id === id)
      const fly = !!el && hasRewardAnchor('xp')
      claimReward(id, { quiet: fly })
      soundManager.play('claim')
      if (fly) flyReward(el, { kind: 'xp', amount: rewardXp(r) })
    }
    function handleClaimAll(ev) {
      const pending = notificationsState.pendingRewards.filter(r => !r.claimed)
      const fly = hasRewardAnchor('xp')
      // Cascada: cada tarjeta despega con 150 ms de diferencia
      if (fly) pending.forEach((r, i) => {
        const el = document.querySelector(`[data-reward-id="${r.id}"]`) || ev?.currentTarget
        flyReward(el, { kind: 'xp', amount: rewardXp(r), delay: i * 150 })
      })
      claimAllRewards({ quiet: fly })
      soundManager.play('claim')
    }
    // Recompensa diaria / desafíos: vuela si hay destino, si no, toast
    function sendReward(el, { kind, amount, powerup, toast }) {
      if (el && hasRewardAnchor(kind)) flyReward(el, { kind, amount, powerup })
      else pushClaimNotification(toast)
    }
    function handleClearClaimed() { clearClaimedRewards() }
    function scrollToEnvelope() { document.getElementById('sobre-del-dia')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }

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

    async function handleClaimDailyReward(ev) {
      const el = ev?.currentTarget
      if (!dailyReward.value.available || claiming.value === 'daily') return
      claiming.value = 'daily'
      try {
        const res = await claimDailyReward()
        if (res.ok) {
          dailyReward.value = { ...dailyReward.value, available: false, claimed: true }
          soundManager.play('claim')
          if (res.reward_kind === 'powerup') {
            sendReward(el, { kind: 'powerup', powerup: res.reward_powerup, toast: { type: 'powerup', title: `${powerupLabel(res.reward_powerup)} ×${res.amount}`, emoji: powerupIcon(res.reward_powerup) } })
          } else {
            sendReward(el, { kind: 'xp', amount: res.amount, toast: { type: 'xp', title: 'Recompensa diaria', xp: res.amount, emoji: '⭐' } })
          }
        }
      } finally {
        claiming.value = null
      }
    }

    async function handleClaimChallenge(c, ev) {
      const el = ev?.currentTarget
      if (c.claimed || c.progress < c.target || claiming.value === c.code) return
      claiming.value = c.code
      try {
        const res = await claimDailyChallenge(c.code)
        if (res.ok) {
          const idx = challenges.value.findIndex(x => x.code === c.code)
          if (idx !== -1) challenges.value[idx] = { ...challenges.value[idx], claimed: true }
          soundManager.play('claim')
          if (res.reward_powerup) {
            sendReward(el, { kind: 'powerup', powerup: res.reward_powerup, toast: { type: 'powerup', title: `${res.title}`, emoji: powerupIcon(res.reward_powerup) } })
          } else {
            sendReward(el, { kind: 'xp', amount: res.reward_xp, toast: { type: 'xp', title: res.title, xp: res.reward_xp, emoji: '🎯' } })
          }
        }
      } finally {
        claiming.value = null
      }
    }

    async function handleClaimProgressive(c, ev) {
      const el = ev?.currentTarget
      const key = 'prog_' + c.code
      if (!c.claimable || claiming.value === key) return
      claiming.value = key
      try {
        const res = await claimProgressive(c.code)
        if (res.ok) {
          soundManager.play('claim')
          if (res.powerup) sendReward(el, { kind: 'powerup', powerup: res.powerup, toast: { type: 'powerup', title: res.title, emoji: powerupIcon(res.powerup) } })
          else sendReward(el, { kind: 'xp', amount: res.xp, toast: { type: 'xp', title: res.title, xp: res.xp, emoji: '🏆' } })
          await loadDaily()
        }
      } finally {
        claiming.value = null
      }
    }

    onMounted(() => { loadStreak(); loadDaily() })

    return { isSunday, scrollToEnvelope,
      activeTab, TABS,
      rewards, unclaimed, claimed, unclaimedCount,
      currentStreak, bestStreak, playedToday,
      challenges, visibleChallenges, allChallengesDone, progressive, dailyReward, loadingDaily, claiming,
      dailyClaimable, progClaimable,
      handleClaim, handleClaimAll, handleClearClaimed,
      handleClaimDailyReward, handleClaimChallenge, handleClaimProgressive,
      powerupLabel, powerupIcon,
    }
  }
}
</script>

<template>
  <section class="max-w-2xl mx-auto space-y-4">
    <!-- Header sutil (estilo app/juego) -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <span class="grid place-items-center w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg>
        </span>
        <h1 class="font-display font-bold text-white text-xl">Recompensas</h1>
      </div>
      <router-link to="/play/points" class="rounded-full border border-white/15 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/5 transition">
        ← Juegos
      </router-link>
    </div>

    <!-- Pestañas segmentadas (sticky bajo el navbar) -->
    <div class="sticky top-16 z-20 py-1 -mx-1 px-1">
      <div class="grid grid-cols-4 gap-1 rounded-2xl border border-white/10 bg-slate-900/80 backdrop-blur p-1">
        <button
          v-for="t in TABS"
          :key="t.key"
          @click="activeTab = t.key"
          class="relative rounded-xl px-2 py-2 text-sm font-bold transition-all"
          :class="activeTab === t.key ? 'bg-gradient-to-r from-amber-500/20 to-amber-600/20 text-white ring-1 ring-amber-300/30' : 'text-slate-400 hover:text-slate-200'"
        >
          {{ t.label }}
          <span
            v-if="t.count > 0"
            class="absolute -top-1 -right-1 grid place-items-center min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-slate-900 text-[10px] font-bold leading-none ring-2 ring-slate-900"
          >{{ t.count > 9 ? '9+' : t.count }}</span>
        </button>
      </div>
    </div>

    <!-- ═════════ TAB: PASE ═════════ -->
    <div v-show="activeTab === 'pase'">
      <MonthlyPass />
    </div>

    <!-- ═════════ TAB: DIARIO ═════════ -->
    <div v-show="activeTab === 'diario'" class="space-y-5">
      <DailyStreakCalendar
        :currentStreak="currentStreak"
        :bestStreak="bestStreak"
        :playedToday="playedToday"
        :todayOpened="!dailyReward.available && !loadingDaily"
        @open-today="scrollToEnvelope"
      />

      <!-- Sobre del día (Moodboard 02): se abre arrastrando; al abrirse se reclama y la recompensa vuela -->
      <div class="relative overflow-hidden rounded-2xl border p-5 transition-all"
           :class="dailyReward.available ? 'border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-slate-900/40 to-amber-600/5' : 'border-white/10 bg-white/[0.03]'">
        <div class="text-center text-[10px] uppercase tracking-wider text-amber-300/80 font-semibold mb-2">Recompensa diaria</div>
        <DailyEnvelope id="sobre-del-dia" :streak-day="currentStreak" :reward="dailyReward" :busy="claiming === 'daily'" :gold="isSunday" @open="handleClaimDailyReward" />
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
              ? 'border-amber-500/30 bg-amber-500/[0.06]'
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
                    <span v-if="c.reward_powerup" class="inline-flex items-center gap-1 text-amber-300"><PowerupIcon :type="c.reward_powerup" :size="16" /> ×{{ c.reward_powerup_qty }}</span>
                  </div>
                </div>
                <div class="text-[11px] text-slate-400 mt-0.5 truncate">{{ c.description }}</div>
                <!-- Progress -->
                <div class="mt-2 flex items-center gap-2">
                  <div class="flex-1 h-1.5 rounded-full bg-black/30 overflow-hidden">
                    <div
                      class="h-full rounded-full bg-gradient-to-r from-amber-300 to-amber-500 transition-all duration-500"
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
              @click="handleClaimChallenge(c, $event)"
              :disabled="claiming === c.code"
              class="mt-3 w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 active:scale-[0.98] text-slate-900 py-2 text-sm font-bold transition-all shadow-lg shadow-amber-500/25 disabled:opacity-60"
            >
              Reclamar recompensa
            </button>
          </div>
        </div>

        <!-- Todos los retos del día completados (estilo AFK Journey) -->
        <div v-else-if="allChallengesDone" class="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/[0.07] to-amber-600/[0.04] p-8 text-center">
          <div class="text-4xl mb-3">🎉</div>
          <p class="font-display font-bold text-white">¡Completaste todos los retos de hoy!</p>
          <p class="text-sm text-slate-400 mt-1">Volvé mañana para nuevos desafíos.</p>
          <div class="mt-3 inline-flex items-center gap-1.5 text-xs text-amber-300 font-semibold">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Se reinician a medianoche
          </div>
        </div>
      </div>
    </div>

    <!-- ═════════ TAB: PROGRESOS ═════════ -->
    <div v-show="activeTab === 'progresos'" class="space-y-3">
      <div class="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 flex items-start gap-2.5">
        <span class="text-lg leading-none mt-0.5">🏆</span>
        <p class="text-xs text-slate-400 leading-relaxed">
          Retos que <span class="text-amber-300 font-semibold">nunca terminan</span>: cada vez que completás uno, sube de nivel y su recompensa se hace <span class="text-amber-300 font-semibold">más grande</span>. Reclamá para llevártela y arrancar el próximo.
        </p>
      </div>

      <div v-if="loadingDaily" class="space-y-2">
        <div v-for="i in 3" :key="i" class="h-24 rounded-2xl bg-white/5 animate-pulse"></div>
      </div>

      <div v-else-if="progressive.length" class="space-y-2.5">
        <div
          v-for="c in progressive"
          :key="c.code"
          class="relative rounded-2xl border p-4 transition-all"
          :class="c.claimable ? 'border-amber-500/40 bg-amber-500/[0.07]' : 'border-white/10 bg-white/[0.03]'"
        >
          <div class="flex items-stretch gap-3">
            <div class="w-11 h-11 rounded-xl grid place-items-center text-xl bg-white/5 border border-white/10 shrink-0 self-start">
              {{ c.icon }}
            </div>

            <div class="flex-1 min-w-0">
              <div class="font-semibold text-white text-sm flex items-center gap-2">
                {{ c.title }}
                <span class="shrink-0 rounded-full bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">Nivel {{ c.tier }}</span>
              </div>
              <div class="text-[11px] text-slate-400 mt-0.5 truncate">{{ c.description }}</div>
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

            <!-- Recompensa PROTAGONISTA (el porqué) -->
            <div class="shrink-0 w-[92px] rounded-xl border p-2 flex flex-col items-center justify-center text-center"
              :class="c.claimable ? 'border-amber-400/40 bg-amber-500/10' : 'border-white/10 bg-black/20'">
              <div class="text-[8px] uppercase tracking-wider text-slate-400 font-semibold mb-0.5">Recompensa</div>
              <div v-if="c.reward_powerup && c.reward_powerup_qty > 0" class="flex flex-col items-center">
                <PowerupIcon :type="c.reward_powerup" :size="40" />
                <div class="text-[10px] font-bold text-amber-300 mt-0.5">×{{ c.reward_powerup_qty }}</div>
              </div>
              <div v-if="c.reward_xp > 0" class="mt-0.5">
                <span class="font-display font-bold text-base leading-none text-emerald-300">+{{ c.reward_xp }}</span>
                <span class="text-[9px] text-slate-400 uppercase tracking-wider ml-0.5">XP</span>
              </div>
            </div>
          </div>

          <button
            v-if="c.claimable"
            @click="handleClaimProgressive(c, $event)"
            :disabled="claiming === 'prog_' + c.code"
            class="mt-3 w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-110 active:scale-[0.98] text-black py-2 text-sm font-bold transition-all shadow-lg shadow-amber-500/20 disabled:opacity-60"
          >
            Reclamar y subir al Nivel {{ c.tier + 1 }}
          </button>
          <div v-else class="mt-3 text-center text-[11px] text-slate-500">
            Te faltan <span class="text-amber-300 font-bold tabular-nums">{{ Math.max(0, c.target - c.progress) }}</span> para el próximo premio
          </div>
        </div>
      </div>

      <div v-else class="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-slate-400">
        Todavía no tenés retos progresivos activos.
      </div>
    </div>

    <!-- ═════════ TAB: BANDEJA (pendientes + historial) ═════════ -->
    <div v-show="activeTab === 'bandeja'" class="space-y-5">
      <div v-if="unclaimed.length > 0" class="space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="font-display font-bold text-white text-lg">
            Pendientes
            <span class="ml-2 inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold">
              {{ unclaimedCount }}
            </span>
          </h2>
          <button
            v-if="unclaimedCount > 1"
            @click="handleClaimAll($event)"
            class="rounded-lg px-4 py-2 text-sm font-bold text-slate-900 bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-amber-500/25"
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

      <!-- Historial -->
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

      <!-- Vacío -->
      <div v-if="unclaimed.length === 0 && claimed.length === 0" class="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
        <div class="text-4xl mb-3">📭</div>
        <p class="font-display font-bold text-white">Bandeja vacía</p>
        <p class="text-sm text-slate-400 mt-1">Acá van a aparecer los premios de logros y subidas de nivel.</p>
      </div>
    </div>
  </section>
</template>
