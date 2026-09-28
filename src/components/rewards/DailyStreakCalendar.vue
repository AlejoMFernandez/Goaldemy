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
    // El sobre del día (DailyEnvelope) es la recompensa real: el calendario solo lo refleja
    todayOpened: { type: Boolean, default: false },
  },
  emits: ['claim', 'open-today'],
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
        const canClaim = isToday && !props.todayOpened
        const claimed = isToday && props.todayOpened
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

    return { days, streakEmoji, claimedToday, chestOpening, timeLeft, claimToday, persistClaim, emit }
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
            <span class="text-amber-300 font-semibold">{{ currentStreak }}</span> días consecutivos
          </p>
        </div>
      </div>
      <div class="flex items-center gap-1.5 text-xs text-slate-400">
        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span class="font-mono tabular-nums text-amber-300 font-semibold">{{ timeLeft }}</span>
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
          <span class="text-[10px] uppercase tracking-wider font-semibold" :class="day.isToday ? 'text-amber-300' : 'text-slate-500'">
            {{ day.label }}
          </span>

          <!-- Chest -->
          <button
            :disabled="!day.canClaim"
            @click="() => { if (day.canClaim) emit('open-today') }"
            class="relative w-10 h-10 sm:w-12 sm:h-12 rounded-xl grid place-items-center transition-all duration-200"
            :class="[
              day.played || day.claimed
                ? 'bg-emerald-500/15 border border-emerald-500/30'
                : day.canClaim
                  ? 'bg-amber-500/20 border-2 border-amber-300/60 hover:scale-105 cursor-pointer'
                  : day.isFuture
                    ? 'bg-white/3 border border-white/8'
                    : 'bg-white/5 border border-white/10',
              day.canClaim ? 'chest-pulse' : '',
              chestOpening === i ? 'scale-110' : '',
            ]"
          >
            <!-- Sobres: abierto (jugado / reclamado), cerrado que brilla (hoy), cerrado apagado (futuro) -->
            <svg class="w-7 h-7 sm:w-8 sm:h-8" viewBox="0 0 32 26" aria-hidden="true"
                 :class="day.played || day.claimed ? 'env-open' : day.canClaim ? 'env-today' : 'env-off'"
                 :data-gold="day.isSpecial ? '' : undefined">
              <template v-if="day.played || day.claimed">
                <path d="M2 10 L16 1 L30 10" class="env-flap-open" />
                <rect x="2" y="10" width="28" height="15" rx="2.5" class="env-body" />
                <path d="M11 17.5 l3.2 3.2 L21 14" class="env-check" />
              </template>
              <template v-else>
                <rect x="2" y="5" width="28" height="19" rx="2.5" class="env-body" />
                <path d="M2.5 6 L16 15.5 L29.5 6" class="env-flap" />
                <circle cx="16" cy="15" r="2.6" class="env-seal" />
              </template>
            </svg>

            <!-- Special day 7 indicator -->
            <div v-if="day.isSpecial" class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-yellow-500 grid place-items-center">
              <svg class="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
            </div>
          </button>

          <!-- XP reward -->
          <span class="text-[9px] font-semibold tabular-nums" :class="day.played || day.claimed ? 'text-emerald-400' : day.canClaim ? 'text-amber-300' : 'text-slate-600'">
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
.env-body { fill: #1e2a5e; stroke: #38bdf8; stroke-opacity: .55; stroke-width: 1.5; }
.env-flap { fill: none; stroke: #38bdf8; stroke-opacity: .55; stroke-width: 1.5; stroke-linejoin: round; }
.env-flap-open { fill: #141d45; stroke: #34d399; stroke-opacity: .6; stroke-width: 1.5; stroke-linejoin: round; }
.env-open .env-body { stroke: #34d399; fill: rgba(16, 185, 129, .18); }
.env-check { fill: none; stroke: #34d399; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
.env-seal { fill: #f59e0b; }
.env-off { opacity: .45; }
.env-off .env-seal { fill: #64748b; }
.env-today { filter: drop-shadow(0 0 6px rgba(252, 211, 77, .7)); }
.env-today .env-body { stroke: #fcd34d; stroke-opacity: .9; }
[data-gold] .env-body { fill: #7c4a0a; stroke: #fcd34d; }
[data-gold] .env-flap { stroke: #fcd34d; }
.chest-pulse {
  animation: claim-pulse 2s ease-in-out infinite;
}
</style>
