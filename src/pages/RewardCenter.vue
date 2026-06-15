<script>
import { computed, ref, onMounted } from 'vue'
import AppH1 from '../components/common/AppH1.vue'
import DailyStreakCalendar from '../components/rewards/DailyStreakCalendar.vue'
import RewardCard from '../components/rewards/RewardCard.vue'
import { notificationsState, claimReward, claimAllRewards, clearClaimedRewards, getUnclaimedCount } from '../stores/notifications'
import { soundManager } from '../services/sounds'
import { supabase } from '../services/supabase'

export default {
  name: 'RewardCenter',
  components: { AppH1, DailyStreakCalendar, RewardCard },
  setup() {
    const currentStreak = ref(0)
    const bestStreak = ref(0)
    const playedToday = ref(false)

    const rewards = computed(() => notificationsState.pendingRewards)
    const unclaimed = computed(() => rewards.value.filter(r => !r.claimed).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)))
    const claimed = computed(() => rewards.value.filter(r => r.claimed).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)))
    const unclaimedCount = computed(() => unclaimed.value.length)

    function handleClaim(id) {
      claimReward(id)
      soundManager.play('claim')
    }

    function handleClaimAll() {
      claimAllRewards()
      soundManager.play('claim')
    }

    function handleClearClaimed() {
      clearClaimedRewards()
    }

    async function loadStreak() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data } = await supabase
          .from('user_profiles')
          .select('current_streak, best_streak, last_played_at')
          .eq('id', user.id)
          .single()
        if (data) {
          currentStreak.value = data.current_streak || 0
          bestStreak.value = data.best_streak || 0
          const today = new Date().toDateString()
          playedToday.value = data.last_played_at && new Date(data.last_played_at).toDateString() === today
        }
      } catch {}
    }

    onMounted(loadStreak)

    return {
      rewards, unclaimed, claimed, unclaimedCount,
      currentStreak, bestStreak, playedToday,
      handleClaim, handleClaimAll, handleClearClaimed,
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

    <!-- Pending Rewards -->
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

    <!-- Empty state -->
    <div v-else-if="claimed.length === 0" class="rounded-2xl border border-white/10 bg-white/3 p-8 text-center">
      <div class="text-4xl mb-3">🎁</div>
      <h3 class="font-display font-bold text-white text-lg mb-1">Sin recompensas pendientes</h3>
      <p class="text-sm text-slate-400 mb-4">Jugá desafíos para ganar XP, logros y subir de nivel</p>
      <router-link
        to="/play/points"
        class="inline-flex rounded-xl px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110 transition"
      >
        Ir a jugar
      </router-link>
    </div>

    <!-- Claimed history -->
    <div v-if="claimed.length > 0" class="space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-semibold text-slate-400 uppercase tracking-wider">Reclamados</h2>
        <button
          @click="handleClearClaimed"
          class="text-xs text-slate-500 hover:text-slate-300 transition"
        >
          Limpiar
        </button>
      </div>
      <div class="space-y-2">
        <RewardCard
          v-for="r in claimed"
          :key="r.id"
          :reward="r"
        />
      </div>
    </div>
  </section>
</template>
