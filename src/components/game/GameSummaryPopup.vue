<script>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { soundManager } from '@/services/sounds'
import { setSuppressOverlays, notificationsState, shiftAchievementQueue } from '@/stores/notifications'

export default {
  name: 'GameSummaryPopup',
  props: {
    show: { type: Boolean, default: false },
    corrects: { type: Number, default: 0 },
    score: { type: Number, default: 0 },
    maxStreak: { type: Number, default: 0 },
    lifetimeMaxStreak: { type: Number, default: 0 },
    levelBefore: { type: Number, default: null },
    levelAfter: { type: Number, default: null },
    xpBeforeTotal: { type: Number, default: 0 },
    xpAfterTotal: { type: Number, default: 0 },
    beforePercent: { type: Number, default: 0 },
    afterPercent: { type: Number, default: 0 },
    progressShown: { type: Number, default: 0 },
    xpToNextAfter: { type: Number, default: null },
    winThreshold: { type: Number, default: 10 },
    backPath: { type: String, default: '/play/points' },
    xpEarned: { type: Number, default: 0 },
    difficulty: { type: String, default: 'normal' },
  },
  emits: ['close'],
  setup(props) {
    const phase = ref(0)
    const animatedCorrects = ref(0)
    const animatedStreak = ref(0)
    const starsRevealed = ref(0)
    const xpBarWidth = ref(0)
    const showActions = ref(false)
    const sessionAchievements = ref([])
    let timers = []
    let countFrame = null
    let achWatcher = null

    function drainAchievementQueue() {
      while (notificationsState.achievementQueue.length > 0) {
        const item = shiftAchievementQueue()
        if (item) sessionAchievements.value.push(item)
      }
    }

    const won = computed(() => props.corrects >= props.winThreshold)

    const starCount = computed(() => {
      const ratio = props.corrects / Math.max(props.winThreshold, 1)
      if (ratio >= 1) return 3
      if (ratio >= 0.8) return 2
      if (ratio >= 0.5) return 1
      return 0
    })

    const accuracy = computed(() => {
      if (props.winThreshold <= 0) return 0
      return Math.round((props.corrects / props.winThreshold) * 100)
    })

    const difficultyInfo = computed(() => {
      if (props.difficulty === 'easy') return { label: '×1', cls: 'text-green-400' }
      if (props.difficulty === 'hard') return { label: '×3', cls: 'text-red-400' }
      return { label: '×2', cls: 'text-yellow-400' }
    })

    const xpGained = computed(() => Math.max(0, (props.xpAfterTotal - props.xpBeforeTotal) || 0))

    function animateCount(target, setter, duration = 600) {
      const start = performance.now()
      function step(now) {
        const t = Math.min((now - start) / duration, 1)
        const ease = 1 - Math.pow(1 - t, 3)
        setter(Math.round(target * ease))
        if (t < 1) countFrame = requestAnimationFrame(step)
      }
      countFrame = requestAnimationFrame(step)
    }

    function runSequence() {
      clearAll()
      phase.value = 0
      animatedCorrects.value = 0
      animatedStreak.value = 0
      starsRevealed.value = 0
      xpBarWidth.value = props.beforePercent || 0
      showActions.value = false
      sessionAchievements.value = []
      drainAchievementQueue()
      if (achWatcher) achWatcher()
      achWatcher = watch(() => notificationsState.achievementQueue.length, drainAchievementQueue)

      timers.push(setTimeout(() => {
        phase.value = 1
        soundManager.play(won.value ? 'win' : 'lose')
      }, 100))

      timers.push(setTimeout(() => {
        phase.value = 2
        animateCount(props.corrects, v => { animatedCorrects.value = v })
      }, 800))

      timers.push(setTimeout(() => {
        animateCount(props.maxStreak, v => { animatedStreak.value = v })
      }, 1200))

      timers.push(setTimeout(() => {
        phase.value = 3
        for (let i = 0; i < starCount.value; i++) {
          timers.push(setTimeout(() => {
            starsRevealed.value = i + 1
            soundManager.play('starReveal')
          }, i * 350))
        }
      }, 2200))

      timers.push(setTimeout(() => {
        phase.value = 4
        const targetW = props.progressShown || props.afterPercent || 0
        const startW = props.beforePercent || 0
        const duration = 1200
        const tStart = performance.now()
        function step(now) {
          const t = Math.min((now - tStart) / duration, 1)
          const ease = 1 - Math.pow(1 - t, 3)
          xpBarWidth.value = startW + (targetW - startW) * ease
          if (t < 1) countFrame = requestAnimationFrame(step)
        }
        countFrame = requestAnimationFrame(step)
      }, 3200))

      timers.push(setTimeout(() => {
        phase.value = 5
        showActions.value = true
      }, 4600))
    }

    function clearAll() {
      timers.forEach(clearTimeout)
      timers = []
      if (countFrame) cancelAnimationFrame(countFrame)
    }

    watch(() => props.show, (val) => {
      if (val) runSequence()
      else {
        clearAll()
        if (achWatcher) { achWatcher(); achWatcher = null }
        setSuppressOverlays(false)
      }
    })

    onMounted(() => { if (props.show) runSequence() })
    onUnmounted(clearAll)

    return {
      phase, won, animatedCorrects, animatedStreak,
      starsRevealed, starCount, accuracy, xpBarWidth,
      showActions, difficultyInfo, xpGained, sessionAchievements,
    }
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="summary-overlay">
      <div v-if="show" class="fixed inset-0 z-[55] flex items-start justify-center bg-black/80 backdrop-blur-lg px-4 pt-6 pb-6 overflow-y-auto">
        <div class="summary-card w-full max-w-lg rounded-2xl border border-white/15 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden shadow-2xl shadow-black/50">

        <!-- Phase 1: Result header -->
        <div
          :class="[
            'p-6 text-center border-b transition-all duration-500',
            phase >= 1 ? 'opacity-100' : 'opacity-0 translate-y-4',
            won
              ? 'bg-gradient-to-br from-emerald-500/15 to-cyan-500/15 border-emerald-500/25'
              : 'bg-gradient-to-br from-red-500/15 to-orange-500/15 border-red-500/25'
          ]"
        >
          <div class="mb-3 flex justify-center">
            <div
              :class="[
                'w-16 h-16 rounded-full grid place-items-center border-2',
                won ? 'bg-emerald-500/15 border-emerald-400/40' : 'bg-red-500/15 border-red-400/40'
              ]"
              :style="phase >= 1 ? 'animation: scale-spring 0.6s var(--ease-bounce) both' : ''"
            >
              <svg v-if="won" class="w-9 h-9 text-emerald-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M5 3h14l-1.5 5H20a1 1 0 011 1v1a5 5 0 01-3.5 4.77V16a1 1 0 01-1 1h-1.1l.6 3H8l.6-3H7.5a1 1 0 01-1-1v-1.23A5 5 0 013 10V9a1 1 0 011-1h2.5L5 3z"/>
              </svg>
              <svg v-else class="w-9 h-9 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
            </div>
          </div>

          <h2
            :class="['font-display text-3xl font-extrabold mb-1', won ? 'text-emerald-400' : 'text-red-400']"
            :style="phase >= 1 ? 'animation: tracking-reveal 0.5s var(--ease-out-expo) 0.15s both' : ''"
          >
            {{ won ? '¡VICTORIA!' : '¡DERROTA!' }}
          </h2>
          <p class="text-slate-300 text-sm">
            {{ won ? 'Excelente trabajo, seguí así' : 'No te rindas, volvé a intentarlo' }}
          </p>
        </div>

        <div class="p-5 space-y-4">

          <!-- Phase 2: Stats cards -->
          <div class="grid grid-cols-3 gap-2.5">
            <div
              class="rounded-xl bg-white/5 border border-white/10 p-3 text-center transition-all duration-500"
              :class="phase >= 2 ? 'opacity-100' : 'opacity-0 translate-y-6'"
              :style="phase >= 2 ? 'animation: stat-slide-in 0.5s var(--ease-spring) both' : ''"
            >
              <div class="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Aciertos</div>
              <div class="font-display text-2xl font-bold text-white">
                {{ animatedCorrects }}<span class="text-slate-500 text-sm">/{{ winThreshold }}</span>
              </div>
            </div>

            <div
              class="rounded-xl bg-white/5 border border-white/10 p-3 text-center transition-all duration-500"
              :class="phase >= 2 ? 'opacity-100' : 'opacity-0 translate-y-6'"
              :style="phase >= 2 ? 'animation: stat-slide-in 0.5s var(--ease-spring) 0.15s both' : ''"
            >
              <div class="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Racha</div>
              <div class="font-display text-2xl font-bold text-emerald-300">×{{ animatedStreak }}</div>
              <div v-if="maxStreak > 0 && maxStreak >= lifetimeMaxStreak" class="text-[10px] text-yellow-400 font-semibold mt-0.5">¡Récord!</div>
            </div>

            <div
              class="rounded-xl bg-white/5 border border-white/10 p-3 text-center transition-all duration-500"
              :class="phase >= 2 ? 'opacity-100' : 'opacity-0 translate-y-6'"
              :style="phase >= 2 ? 'animation: stat-slide-in 0.5s var(--ease-spring) 0.3s both' : ''"
            >
              <div class="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Precisión</div>
              <div class="relative w-12 h-12 mx-auto">
                <svg class="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
                  <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="4" />
                  <circle
                    cx="24" cy="24" r="20" fill="none"
                    :stroke="accuracy >= 80 ? '#34d399' : accuracy >= 50 ? '#fbbf24' : '#f87171'"
                    stroke-width="4" stroke-linecap="round"
                    :stroke-dasharray="125.66"
                    :stroke-dashoffset="phase >= 2 ? 125.66 - (125.66 * accuracy / 100) : 125.66"
                    style="transition: stroke-dashoffset 1s var(--ease-out-expo)"
                  />
                </svg>
                <div class="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">{{ accuracy }}%</div>
              </div>
            </div>
          </div>

          <!-- Phase 3: Star rating -->
          <div
            class="flex flex-col items-center gap-1 py-2 transition-all duration-400"
            :class="phase >= 3 ? 'opacity-100' : 'opacity-0'"
          >
            <div class="flex justify-center gap-2">
              <template v-for="i in 3" :key="i">
                <div class="relative group">
                  <svg
                    class="w-10 h-10 transition-all duration-300 cursor-help"
                    :class="i <= starsRevealed ? 'text-yellow-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]' : 'text-slate-700'"
                    :style="i <= starsRevealed ? 'animation: star-fill 0.4s var(--ease-bounce) both' : ''"
                    fill="currentColor" viewBox="0 0 24 24"
                  >
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                  <span class="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 border border-white/10 px-2 py-0.5 text-[10px] text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    {{ i === 1 ? '50%+ aciertos' : i === 2 ? '80%+ aciertos' : '100% aciertos' }}
                  </span>
                </div>
              </template>
            </div>
            <p class="text-[10px] text-slate-500">{{ starCount }}/3 estrellas</p>
          </div>

          <!-- Phase 4: XP Progress -->
          <div
            class="rounded-xl bg-gradient-to-r from-emerald-500/8 to-cyan-500/8 border border-emerald-500/20 p-4 transition-all duration-500"
            :class="phase >= 4 ? 'opacity-100' : 'opacity-0 translate-y-4'"
          >
            <div class="flex items-center justify-between text-sm text-slate-300 mb-2">
              <span class="font-semibold">Progreso de XP</span>
              <div class="flex items-center gap-1.5">
                <span class="text-emerald-400 font-bold text-base">+{{ xpGained }}</span>
                <span :class="['font-bold', difficultyInfo.cls]">{{ difficultyInfo.label }}</span>
              </div>
            </div>
            <div class="h-3 rounded-full bg-black/30 overflow-hidden mb-2">
              <div
                class="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400 shadow-lg"
                :style="{ width: xpBarWidth + '%', transition: 'width 1.2s var(--ease-out-expo)' }"
              ></div>
            </div>
            <div class="flex items-center justify-between text-xs">
              <span class="text-slate-400">
                Nivel <span class="text-white font-semibold">{{ levelBefore ?? '—' }}</span>
                <template v-if="(levelAfter||0) > (levelBefore||0)">
                  → <span class="text-yellow-300 font-bold">{{ levelAfter }}</span>
                </template>
              </span>
              <span v-if="xpToNextAfter != null" class="text-slate-400">
                Faltan <span class="text-white font-semibold">{{ xpToNextAfter }} XP</span>
              </span>
            </div>
          </div>

          <!-- Achievements earned this session -->
          <div
            v-if="sessionAchievements.length > 0"
            class="transition-all duration-500"
            :class="phase >= 4 ? 'opacity-100' : 'opacity-0 translate-y-4'"
          >
            <div class="text-[10px] uppercase tracking-wider text-yellow-400 font-semibold mb-2">Logros desbloqueados</div>
            <div class="space-y-2">
              <div
                v-for="(ach, idx) in sessionAchievements"
                :key="ach.id"
                class="flex items-center gap-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 p-3"
                :style="phase >= 4 ? `animation: stat-slide-in 0.5s var(--ease-spring) ${0.3 + idx * 0.15}s both` : ''"
              >
                <div class="shrink-0 w-10 h-10 rounded-full bg-yellow-500/20 border border-yellow-500/30 grid place-items-center">
                  <img v-if="ach.iconUrl" :src="ach.iconUrl" class="w-6 h-6 rounded" alt="" />
                  <svg v-else class="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M5 3h14l-1.5 5H20a1 1 0 011 1v1a5 5 0 01-3.5 4.77V16a1 1 0 01-1 1h-1.1l.6 3H8l.6-3H7.5a1 1 0 01-1-1v-1.23A5 5 0 013 10V9a1 1 0 011-1h2.5L5 3z"/>
                  </svg>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-semibold text-white truncate">{{ ach.title }}</div>
                  <div v-if="ach.description" class="text-[10px] text-slate-400 truncate">{{ ach.description }}</div>
                </div>
                <div v-if="ach.points" class="shrink-0 text-xs font-bold text-yellow-400">+{{ ach.points }} XP</div>
              </div>
            </div>
          </div>

          <!-- Phase 5: Actions -->
          <div
            class="flex gap-3 pt-1 transition-all duration-400"
            :class="showActions ? 'opacity-100' : 'opacity-0 translate-y-4'"
          >
            <button
              @click="$emit('close')"
              class="flex-1 rounded-xl border border-white/20 hover:bg-white/5 text-white py-3 font-semibold transition"
            >
              Cerrar
            </button>
            <router-link
              :to="backPath"
              class="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110 text-white py-3 font-bold transition text-center shadow-lg shadow-emerald-500/25"
            >
              Volver a juegos
            </router-link>
          </div>
        </div>
      </div>
    </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.summary-overlay-enter-active { transition: opacity 0.3s ease; }
.summary-overlay-leave-active { transition: opacity 0.2s ease; }
.summary-overlay-enter-from, .summary-overlay-leave-to { opacity: 0; }
.summary-card {
  animation: summary-pop 0.4s var(--ease-bounce);
}
@keyframes summary-pop {
  from { opacity: 0; transform: scale(0.92) translateY(12px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
</style>
