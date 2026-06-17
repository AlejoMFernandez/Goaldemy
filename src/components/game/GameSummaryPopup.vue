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
    const animatedXp = ref(0)
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

    const difficultyLabel = computed(() => {
      if (props.difficulty === 'easy') return 'Fácil'
      if (props.difficulty === 'hard') return 'Difícil'
      return 'Normal'
    })

    const difficultyColor = computed(() => {
      if (props.difficulty === 'easy') return 'text-green-400 bg-green-500/15 border-green-500/25'
      if (props.difficulty === 'hard') return 'text-red-400 bg-red-500/15 border-red-500/25'
      return 'text-yellow-400 bg-yellow-500/15 border-yellow-500/25'
    })

    const xpGained = computed(() => Math.max(0, (props.xpAfterTotal - props.xpBeforeTotal) || 0))
    const didLevelUp = computed(() => (props.levelAfter || 0) > (props.levelBefore || 0))

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
      animatedXp.value = 0
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
        for (let i = 0; i < starCount.value; i++) {
          timers.push(setTimeout(() => {
            starsRevealed.value = i + 1
            soundManager.play('starReveal')
          }, 400 + i * 300))
        }
      }, 700))

      timers.push(setTimeout(() => {
        phase.value = 3
        animateCount(xpGained.value, v => { animatedXp.value = v }, 800)
        animateCount(props.maxStreak, v => { animatedStreak.value = v })
      }, 1800))

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
      }, 2800))

      timers.push(setTimeout(() => {
        phase.value = 5
        showActions.value = true
      }, 4200))
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
      phase, won, animatedCorrects, animatedStreak, animatedXp,
      starsRevealed, starCount, accuracy, xpBarWidth,
      showActions, difficultyLabel, difficultyColor, xpGained,
      didLevelUp, sessionAchievements,
    }
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="summary-overlay">
      <div v-if="show" class="fixed inset-0 z-[55] overflow-y-auto bg-black/80 backdrop-blur-lg">
        <div class="min-h-full flex items-center justify-center p-4">
        <div class="summary-card w-full max-w-md rounded-2xl border border-white/15 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden shadow-2xl shadow-black/50">

          <!-- Phase 1: Result banner -->
          <div
            :class="[
              'px-5 py-4 flex items-center gap-4 border-b transition-all duration-500',
              phase >= 1 ? 'opacity-100' : 'opacity-0 translate-y-4',
              won
                ? 'bg-gradient-to-r from-emerald-500/15 to-cyan-500/10 border-emerald-500/25'
                : 'bg-gradient-to-r from-red-500/15 to-orange-500/10 border-red-500/25'
            ]"
          >
            <div
              :class="[
                'w-14 h-14 rounded-2xl grid place-items-center border shrink-0',
                won ? 'bg-emerald-500/15 border-emerald-400/30' : 'bg-red-500/15 border-red-400/30'
              ]"
              :style="phase >= 1 ? 'animation: scale-spring 0.5s var(--ease-bounce) both' : ''"
            >
              <svg v-if="won" class="w-7 h-7 text-emerald-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M5 3h14l-1.5 5H20a1 1 0 011 1v1a5 5 0 01-3.5 4.77V16a1 1 0 01-1 1h-1.1l.6 3H8l.6-3H7.5a1 1 0 01-1-1v-1.23A5 5 0 013 10V9a1 1 0 011-1h2.5L5 3z"/>
              </svg>
              <svg v-else class="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
            </div>
            <div class="flex-1 min-w-0">
              <h2
                :class="['font-display text-2xl font-extrabold leading-tight', won ? 'text-emerald-400' : 'text-red-400']"
                :style="phase >= 1 ? 'animation: tracking-reveal 0.4s var(--ease-out-expo) 0.1s both' : ''"
              >
                {{ won ? '¡VICTORIA!' : '¡DERROTA!' }}
              </h2>
              <p class="text-slate-400 text-xs mt-0.5">
                {{ won ? 'Excelente trabajo, seguí así' : 'No te rindas, volvé a intentarlo' }}
              </p>
            </div>
            <span :class="['shrink-0 rounded-lg border px-2 py-1 text-[10px] font-bold uppercase tracking-wider', difficultyColor]">
              {{ difficultyLabel }}
            </span>
          </div>

          <div class="p-5 space-y-4">

            <!-- Phase 2: Stars + Corrects -->
            <div
              class="flex flex-col items-center gap-2 transition-all duration-500"
              :class="phase >= 2 ? 'opacity-100' : 'opacity-0'"
            >
              <div class="flex justify-center gap-1.5">
                <template v-for="i in 3" :key="i">
                  <svg
                    class="w-9 h-9 transition-all duration-300"
                    :class="i <= starsRevealed ? 'text-yellow-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.4)]' : 'text-slate-700'"
                    :style="i <= starsRevealed ? 'animation: star-fill 0.35s var(--ease-bounce) both' : ''"
                    fill="currentColor" viewBox="0 0 24 24"
                  >
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                </template>
              </div>
              <div class="text-center">
                <span class="font-display text-3xl font-extrabold text-white">{{ animatedCorrects }}</span>
                <span class="text-slate-500 text-lg font-semibold">/{{ winThreshold }}</span>
                <span class="text-slate-400 text-sm ml-1.5">aciertos</span>
              </div>
            </div>

            <!-- Phase 3: XP + Racha + Precisión -->
            <div
              class="grid grid-cols-3 gap-2 transition-all duration-500"
              :class="phase >= 3 ? 'opacity-100' : 'opacity-0 translate-y-4'"
            >
              <div
                class="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-center"
                :style="phase >= 3 ? 'animation: stat-slide-in 0.5s var(--ease-spring) both' : ''"
              >
                <div class="text-[10px] uppercase tracking-wider text-emerald-400/70 mb-1">XP ganada</div>
                <div class="font-display text-xl font-bold text-emerald-400">+{{ animatedXp }}</div>
              </div>

              <div
                class="rounded-xl bg-white/5 border border-white/10 p-3 text-center"
                :style="phase >= 3 ? 'animation: stat-slide-in 0.5s var(--ease-spring) 0.1s both' : ''"
              >
                <div class="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Racha</div>
                <div class="font-display text-xl font-bold text-white">{{ animatedStreak }}</div>
                <div v-if="maxStreak > 0 && maxStreak >= lifetimeMaxStreak" class="text-[9px] text-yellow-400 font-semibold mt-0.5">RECORD</div>
              </div>

              <div
                class="rounded-xl bg-white/5 border border-white/10 p-3 text-center"
                :style="phase >= 3 ? 'animation: stat-slide-in 0.5s var(--ease-spring) 0.2s both' : ''"
              >
                <div class="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Precisión</div>
                <div class="relative w-10 h-10 mx-auto">
                  <svg class="w-10 h-10 -rotate-90" viewBox="0 0 48 48">
                    <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="4" />
                    <circle
                      cx="24" cy="24" r="20" fill="none"
                      :stroke="accuracy >= 80 ? '#34d399' : accuracy >= 50 ? '#fbbf24' : '#f87171'"
                      stroke-width="4" stroke-linecap="round"
                      :stroke-dasharray="125.66"
                      :stroke-dashoffset="phase >= 3 ? 125.66 - (125.66 * accuracy / 100) : 125.66"
                      style="transition: stroke-dashoffset 0.8s var(--ease-out-expo)"
                    />
                  </svg>
                  <div class="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-white">{{ accuracy }}%</div>
                </div>
              </div>
            </div>

            <!-- Phase 4: Level progress bar -->
            <div
              class="rounded-xl border border-white/10 bg-white/[0.03] p-3.5 transition-all duration-500"
              :class="phase >= 4 ? 'opacity-100' : 'opacity-0 translate-y-4'"
            >
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                  <span class="text-xs text-slate-400">Nivel</span>
                  <span class="font-display text-sm font-bold text-white">{{ levelBefore ?? '—' }}</span>
                  <template v-if="didLevelUp">
                    <svg class="w-3.5 h-3.5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    <span class="font-display text-sm font-bold text-yellow-400">{{ levelAfter }}</span>
                  </template>
                </div>
                <div class="flex items-center gap-2">
                  <span v-if="xpEarned > 0" class="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/20 rounded-full px-1.5 py-0.5">+{{ xpEarned }} XP</span>
                  <span v-if="xpToNextAfter != null" class="text-[10px] text-slate-500">
                    {{ xpToNextAfter }} XP para nivel {{ (levelAfter || levelBefore || 0) + (didLevelUp ? 0 : 1) }}
                  </span>
                </div>
              </div>
              <div class="h-2 rounded-full bg-black/30 overflow-hidden">
                <div
                  class="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400"
                  :style="{ width: xpBarWidth + '%', transition: 'width 1.2s var(--ease-out-expo)' }"
                ></div>
              </div>
              <div v-if="didLevelUp" class="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-yellow-400 font-semibold">
                <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                </svg>
                <span>¡Subiste de nivel!</span>
              </div>
            </div>

            <!-- Achievements earned this session -->
            <div
              v-if="sessionAchievements.length > 0"
              class="transition-all duration-500"
              :class="phase >= 4 ? 'opacity-100' : 'opacity-0 translate-y-4'"
            >
              <div class="text-[10px] uppercase tracking-wider text-yellow-400 font-semibold mb-2">Logros desbloqueados</div>
              <div class="space-y-1.5">
                <div
                  v-for="(ach, idx) in sessionAchievements"
                  :key="ach.id"
                  class="flex items-center gap-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 px-3 py-2.5"
                  :style="phase >= 4 ? `animation: stat-slide-in 0.5s var(--ease-spring) ${0.3 + idx * 0.15}s both` : ''"
                >
                  <div class="shrink-0 w-8 h-8 rounded-lg bg-yellow-500/20 border border-yellow-500/30 grid place-items-center">
                    <img v-if="ach.iconUrl" :src="ach.iconUrl" class="w-5 h-5 rounded" alt="" />
                    <svg v-else class="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M5 3h14l-1.5 5H20a1 1 0 011 1v1a5 5 0 01-3.5 4.77V16a1 1 0 01-1 1h-1.1l.6 3H8l.6-3H7.5a1 1 0 01-1-1v-1.23A5 5 0 013 10V9a1 1 0 011-1h2.5L5 3z"/>
                    </svg>
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-semibold text-white truncate">{{ ach.title }}</div>
                    <div v-if="ach.description" class="text-[10px] text-slate-400 truncate">{{ ach.description }}</div>
                  </div>
                  <div v-if="ach.points" class="shrink-0 text-xs font-bold text-yellow-400">+{{ ach.points }}</div>
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
                class="flex-1 rounded-xl border border-white/15 hover:bg-white/5 text-slate-300 py-2.5 text-sm font-semibold transition"
              >
                Cerrar
              </button>
              <router-link
                :to="backPath"
                class="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110 text-white py-2.5 text-sm font-bold transition text-center shadow-lg shadow-emerald-500/20"
              >
                Volver a juegos
              </router-link>
            </div>
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
