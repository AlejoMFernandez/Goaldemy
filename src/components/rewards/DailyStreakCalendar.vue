<script>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { soundManager } from '@/services/sounds'
import { getAuthUser } from '@/services/auth'

export default {
  name: 'DailyStreakCalendar',
  props: {
    currentStreak: { type: Number, default: 0 },
    bestStreak: { type: Number, default: 0 },
    playedToday: { type: Boolean, default: false },
  },
  emits: ['claim'],
  setup(props, { emit }) {
    const claimedToday = ref(false)
    const chestOpening = ref(-1)
    const timeLeft = ref('')
    let timer = null

    const dayLabels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

    const xpRewards = [10, 15, 20, 25, 30, 35, 50]

    const days = computed(() => {
      const today = new Date().getDay()
      const mondayOffset = today === 0 ? 6 : today - 1
      const streakInWeek = Math.min(props.currentStreak, 7)

      return dayLabels.map((label, i) => {
        const isPast = i < mondayOffset
        const isToday = i === mondayOffset
        const isFuture = i > mondayOffset
        const played = isPast && i >= (mondayOffset - streakInWeek)
        const canClaim = isToday && props.playedToday && !claimedToday.value
        const claimed = isToday && claimedToday.value
        const isSpecial = i === 6

        return { label, isPast, isToday, isFuture, played, canClaim, claimed, isSpecial, xp: xpRewards[i] }
      })
    })

    const streakEmoji = computed(() => {
      if (props.currentStreak >= 30) return '👑'
      if (props.currentStreak >= 14) return '💎'
      if (props.currentStreak >= 7) return '⭐'
      if (props.currentStreak >= 3) return '🔥'
      return '✨'
    })

    function claimToday(dayIndex) {
      if (claimedToday.value) return
      chestOpening.value = dayIndex
      soundManager.play('claim')
      setTimeout(() => {
        claimedToday.value = true
        chestOpening.value = -1
        emit('claim', xpRewards[dayIndex])
      }, 600)
    }

    function updateCountdown() {
      const now = new Date()
      const midnight = new Date()
      midnight.setHours(24, 0, 0, 0)
      const diff = midnight - now
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      timeLeft.value = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
    }

    // Scopeado por usuario (sin scope, una cuenta veía el "reclamado hoy" de otra).
    function streakKey() {
      const { id } = getAuthUser() || {}
      return id ? `gl:streak_claimed:${id}:${new Date().toDateString()}` : null
    }

    onMounted(() => {
      try {
        const key = streakKey()
        if (key && localStorage.getItem(key)) claimedToday.value = true
      } catch {}
      updateCountdown()
      timer = setInterval(updateCountdown, 1000)
    })

    onUnmounted(() => { if (timer) clearInterval(timer) })

    function persistClaim() {
      try { const key = streakKey(); if (key) localStorage.setItem(key, '1') } catch {}
    }

    return { days, streakEmoji, claimedToday, chestOpening, timeLeft, claimToday, persistClaim }
  }
}
</script>

<template>
  <div class="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 via-slate-800/80 to-slate-900/80 overflow-hidden">
    <!-- Header -->
    <div class="p-4 border-b border-white/10 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <span class="text-2xl">{{ streakEmoji }}</span>
        <div>
          <h3 class="font-display font-bold text-white text-sm">Racha diaria</h3>
          <p class="text-xs text-slate-400">
            <span class="text-emerald-400 font-semibold">{{ currentStreak }}</span> días consecutivos
          </p>
        </div>
      </div>
      <div class="flex items-center gap-1.5 text-xs text-slate-400">
        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span class="font-mono tabular-nums text-emerald-400 font-semibold">{{ timeLeft }}</span>
      </div>
    </div>

    <!-- 7-day row -->
    <div class="p-4">
      <div class="grid grid-cols-7 gap-1.5">
        <div
          v-for="(day, i) in days"
          :key="i"
          class="flex flex-col items-center gap-1.5"
        >
          <!-- Day label -->
          <span class="text-[10px] uppercase tracking-wider font-semibold" :class="day.isToday ? 'text-emerald-400' : 'text-slate-500'">
            {{ day.label }}
          </span>

          <!-- Chest -->
          <button
            :disabled="!day.canClaim"
            @click="() => { if (day.canClaim) { claimToday(i); persistClaim() } }"
            class="relative w-10 h-10 sm:w-12 sm:h-12 rounded-xl grid place-items-center transition-all duration-200"
            :class="[
              day.played || day.claimed
                ? 'bg-emerald-500/15 border border-emerald-500/30'
                : day.canClaim
                  ? 'bg-emerald-500/20 border-2 border-emerald-400/60 hover:scale-105 cursor-pointer'
                  : day.isFuture
                    ? 'bg-white/3 border border-white/8'
                    : 'bg-white/5 border border-white/10',
              day.canClaim ? 'chest-pulse' : '',
              chestOpening === i ? 'scale-110' : '',
            ]"
          >
            <!-- Played / claimed -->
            <template v-if="day.played || day.claimed">
              <svg class="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
              </svg>
            </template>

            <!-- Claimable -->
            <template v-else-if="day.canClaim">
              <svg class="w-6 h-6 text-emerald-300" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z"/>
              </svg>
            </template>

            <!-- Future / not played -->
            <template v-else>
              <svg class="w-5 h-5" :class="day.isFuture ? 'text-slate-600' : 'text-slate-500'" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </template>

            <!-- Special day 7 indicator -->
            <div v-if="day.isSpecial" class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-yellow-500 grid place-items-center">
              <svg class="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
            </div>
          </button>

          <!-- XP reward -->
          <span class="text-[9px] font-semibold tabular-nums" :class="day.played || day.claimed ? 'text-emerald-400' : day.canClaim ? 'text-emerald-300' : 'text-slate-600'">
            +{{ day.xp }}
          </span>
        </div>
      </div>
    </div>

    <!-- Best streak -->
    <div v-if="bestStreak > 0" class="px-4 pb-3 flex items-center justify-between text-xs">
      <span class="text-slate-500">Mejor racha</span>
      <span class="text-amber-400 font-semibold">{{ bestStreak }} días 🏆</span>
    </div>
  </div>
</template>

<style scoped>
.chest-pulse {
  animation: claim-pulse 2s ease-in-out infinite;
}
</style>
