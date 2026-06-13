<script>
import { ref, computed, watch, nextTick } from 'vue'
import { notificationsState, shiftLevelUpQueue } from '@/stores/notifications'
import { getTierForLevel } from '@/services/tiers'
import { soundManager } from '@/services/sounds'
import { celebrateLevelUp, confettiGold } from '@/services/confetti'

export default {
  name: 'LevelUpOverlay',
  setup() {
    const current = ref(null)
    const phase = ref(0)
    let timers = []

    function clearTimers() {
      timers.forEach(clearTimeout)
      timers = []
    }

    const oldTier = computed(() => current.value ? getTierForLevel(current.value.oldLevel) : null)
    const newTier = computed(() => current.value ? getTierForLevel(current.value.newLevel) : null)
    const tierChanged = computed(() => {
      if (!oldTier.value || !newTier.value) return false
      return oldTier.value.key !== newTier.value.key
    })

    function showNext() {
      clearTimers()
      if (notificationsState.suppressOverlays) return
      if (notificationsState.achievementQueue.length > 0) {
        timers.push(setTimeout(showNext, 800))
        return
      }
      const item = shiftLevelUpQueue()
      if (!item) { current.value = null; phase.value = 0; return }

      current.value = item
      phase.value = 0

      nextTick(() => {
        timers.push(setTimeout(() => { phase.value = 1 }, 50))
        timers.push(setTimeout(() => { phase.value = 2 }, 500))
        timers.push(setTimeout(() => { phase.value = 3 }, 1000))
        if (tierChanged.value) {
          timers.push(setTimeout(() => { phase.value = 4 }, 1600))
          confettiGold()
        } else {
          celebrateLevelUp()
        }
        soundManager.play('levelUp')
      })
    }

    function dismiss() {
      clearTimers()
      current.value = null
      phase.value = 0
      timers.push(setTimeout(showNext, 400))
    }

    watch(() => notificationsState.levelUpQueue.length, (len) => {
      if (len > 0 && !current.value) showNext()
    })

    watch(() => notificationsState.suppressOverlays, (suppressed) => {
      if (!suppressed && notificationsState.levelUpQueue.length > 0 && !current.value) {
        setTimeout(showNext, 600)
      }
    })

    return { current, phase, oldTier, newTier, tierChanged, dismiss }
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="overlay-fade">
      <div v-if="current" class="fixed inset-0 z-[60] grid place-items-center p-4" @click.self="dismiss">
        <div class="absolute inset-0 bg-black/85 backdrop-blur-md"></div>

        <div class="relative flex flex-col items-center text-center max-w-md w-full">

          <!-- Level number morph -->
          <div
            class="mb-4 transition-all duration-500"
            :class="phase >= 1 ? 'opacity-100' : 'opacity-0'"
          >
            <div class="font-display text-xs font-bold uppercase text-yellow-400 mb-4"
              :style="phase >= 1 ? 'animation: tracking-reveal 0.6s var(--ease-out-expo) both' : ''">
              ¡Subiste de Nivel!
            </div>
            <div class="flex items-center justify-center gap-4">
              <span class="text-5xl font-display font-extrabold text-slate-500 line-through decoration-2">{{ current.oldLevel }}</span>
              <svg class="w-8 h-8 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              <span
                class="text-7xl font-display font-extrabold text-yellow-400"
                :style="phase >= 1 ? 'animation: level-morph 0.6s var(--ease-bounce) both' : ''"
              >{{ current.newLevel }}</span>
            </div>
          </div>

          <!-- Tier badge (always shows current tier) -->
          <div
            class="mb-6 transition-all duration-500"
            :class="phase >= 2 ? 'opacity-100' : 'opacity-0'"
          >
            <!-- Tier evolution -->
            <template v-if="tierChanged && phase >= 3">
              <div class="mb-3 font-display text-xs font-bold uppercase text-fuchsia-400"
                style="animation: tracking-reveal 0.5s var(--ease-out-expo) both">
                ¡Evolución de Rango!
              </div>

              <div class="flex items-center justify-center gap-4">
                <div class="flex flex-col items-center opacity-50">
                  <img v-if="oldTier?.image" :src="oldTier.image" class="w-16 h-16 object-contain mb-1" :alt="oldTier.label" />
                  <span class="text-xs text-slate-500">{{ oldTier?.label }}</span>
                </div>

                <!-- Flash -->
                <div
                  v-if="phase >= 4"
                  class="w-8 h-8 rounded-full bg-yellow-400/60"
                  style="animation: evolution-flash 0.5s ease both"
                ></div>

                <div
                  class="flex flex-col items-center"
                  :style="phase >= 4 ? 'animation: scale-spring 0.6s var(--ease-bounce) both' : ''"
                >
                  <img v-if="newTier?.image" :src="newTier.image" class="w-24 h-24 object-contain mb-1" :alt="newTier.label" />
                  <span class="text-sm font-bold" :class="{
                    'text-emerald-400': newTier?.color === 'emerald',
                    'text-amber-400': newTier?.color === 'amber',
                    'text-orange-400': newTier?.color === 'orange',
                    'text-red-400': newTier?.color === 'red',
                    'text-sky-400': newTier?.color === 'sky',
                    'text-blue-400': newTier?.color === 'blue',
                    'text-violet-400': newTier?.color === 'violet',
                    'text-fuchsia-400': newTier?.color === 'fuchsia',
                    'text-rose-400': newTier?.color === 'rose',
                    'text-yellow-400': newTier?.color === 'yellow',
                  }">
                    {{ newTier?.emoji }} {{ newTier?.label }}
                  </span>
                </div>
              </div>
            </template>

            <!-- Same tier, just show badge -->
            <template v-else-if="newTier">
              <div class="flex flex-col items-center"
                :style="phase >= 2 ? 'animation: scale-spring 0.5s var(--ease-bounce) both' : ''">
                <img v-if="newTier.image" :src="newTier.image" class="w-20 h-20 object-contain mb-2" :alt="newTier.label" />
                <span class="text-sm font-semibold text-slate-300">{{ newTier.emoji }} {{ newTier.label }}</span>
              </div>
            </template>
          </div>

          <!-- Continue button -->
          <div
            class="transition-all duration-400"
            :class="phase >= 3 ? 'opacity-100' : 'opacity-0'"
          >
            <button
              @click="dismiss"
              class="rounded-2xl px-8 py-3 font-display font-bold text-white bg-gradient-to-r from-yellow-500 to-amber-500 hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-yellow-500/25"
            >
              Continuar
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.overlay-fade-enter-active { transition: opacity 0.3s ease; }
.overlay-fade-leave-active { transition: opacity 0.25s ease; }
.overlay-fade-enter-from, .overlay-fade-leave-to { opacity: 0; }
</style>
