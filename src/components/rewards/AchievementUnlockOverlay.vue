<script>
import { ref, watch, nextTick } from 'vue'
import { notificationsState, shiftAchievementQueue } from '@/stores/notifications'
import { soundManager } from '@/services/sounds'
import { celebrateAchievement } from '@/services/confetti'

export default {
  name: 'AchievementUnlockOverlay',
  setup() {
    const current = ref(null)
    const phase = ref(0)
    const claimed = ref(false)
    const particles = ref([])
    let phaseTimers = []

    function clearTimers() {
      phaseTimers.forEach(clearTimeout)
      phaseTimers = []
    }

    function showNext() {
      clearTimers()
      const item = shiftAchievementQueue()
      if (!item) { current.value = null; phase.value = 0; return }

      current.value = item
      claimed.value = false
      phase.value = 0

      nextTick(() => {
        phaseTimers.push(setTimeout(() => { phase.value = 1 }, 50))
        phaseTimers.push(setTimeout(() => { phase.value = 2 }, 400))
        phaseTimers.push(setTimeout(() => { phase.value = 3 }, 800))
        phaseTimers.push(setTimeout(() => { phase.value = 4 }, 1200))
        soundManager.play('achievement')
        celebrateAchievement()
      })
    }

    function claim() {
      if (claimed.value) return
      claimed.value = true
      soundManager.play('claim')
      spawnParticles()
      phaseTimers.push(setTimeout(() => {
        current.value = null
        phase.value = 0
        phaseTimers.push(setTimeout(showNext, 400))
      }, 1200))
    }

    function spawnParticles() {
      const arr = []
      for (let i = 0; i < 12; i++) {
        arr.push({
          id: i,
          x: (Math.random() - 0.5) * 120,
          y: -(Math.random() * 80 + 30),
          delay: Math.random() * 0.2,
        })
      }
      particles.value = arr
    }

    function rarityLabel(pct) {
      if (pct == null) return null
      if (pct < 10) return { text: 'Ultra raro', cls: 'text-fuchsia-400 border-fuchsia-500/40 bg-fuchsia-500/10' }
      if (pct < 30) return { text: 'Raro', cls: 'text-amber-400 border-amber-500/40 bg-amber-500/10' }
      return { text: 'Común', cls: 'text-slate-400 border-slate-500/40 bg-slate-500/10' }
    }

    watch(() => notificationsState.achievementQueue.length, (len) => {
      if (len > 0 && !current.value) showNext()
    })

    return { current, phase, claimed, particles, claim, rarityLabel }
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="overlay-fade">
      <div v-if="current" class="fixed inset-0 z-[60] grid place-items-center p-4" @click.self="claim">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/85 backdrop-blur-md"></div>

        <!-- Content -->
        <div class="relative flex flex-col items-center text-center max-w-md w-full">

          <!-- Glow ring + Icon -->
          <div
            class="relative mb-6 transition-all duration-500"
            :class="phase >= 1 ? 'opacity-100' : 'opacity-0'"
            :style="phase >= 1 ? 'animation: scale-spring 0.6s var(--ease-bounce) both' : ''"
          >
            <div class="w-28 h-28 rounded-full bg-emerald-500/15 border-2 border-emerald-400/40 grid place-items-center"
              :style="phase >= 2 ? 'animation: glow-pulse 2s ease-in-out infinite' : ''">
              <img v-if="current.iconUrl" :src="current.iconUrl" class="w-16 h-16 object-contain" :alt="current.title" />
              <svg v-else class="w-14 h-14 text-emerald-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M5 3h14l-1.5 5H20a1 1 0 011 1v1a5 5 0 01-3.5 4.77V16a1 1 0 01-1 1h-1.1l.6 3H8l.6-3H7.5a1 1 0 01-1-1v-1.23A5 5 0 013 10V9a1 1 0 011-1h2.5L5 3z"/>
              </svg>
            </div>
          </div>

          <!-- Title text -->
          <div
            class="mb-2 transition-all duration-500"
            :class="phase >= 2 ? 'opacity-100' : 'opacity-0'"
          >
            <div
              class="font-display text-xs font-bold uppercase text-emerald-400 mb-3"
              :style="phase >= 2 ? 'animation: tracking-reveal 0.6s var(--ease-out-expo) both' : ''"
            >
              Logro Desbloqueado
            </div>
            <h2 class="font-display text-3xl font-extrabold text-white mb-2">{{ current.title }}</h2>
            <p v-if="current.description" class="text-slate-300 text-sm mb-2">{{ current.description }}</p>
          </div>

          <!-- Rarity badge -->
          <div
            v-if="rarityLabel(current.unlockPercent)"
            class="mb-6 transition-all duration-400"
            :class="phase >= 3 ? 'opacity-100' : 'opacity-0'"
          >
            <span
              class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold"
              :class="rarityLabel(current.unlockPercent).cls"
            >
              {{ rarityLabel(current.unlockPercent).text }}
              <span v-if="current.unlockPercent" class="text-slate-500">· {{ current.unlockPercent }}%</span>
            </span>
          </div>

          <!-- Claim button -->
          <div
            class="relative transition-all duration-400"
            :class="phase >= 4 ? 'opacity-100' : 'opacity-0'"
          >
            <!-- Particles -->
            <div
              v-for="p in particles"
              :key="p.id"
              class="absolute left-1/2 top-1/2 w-2 h-2 rounded-full bg-emerald-400 pointer-events-none"
              :style="{
                transform: `translate(${p.x}px, ${p.y}px)`,
                animationDelay: `${p.delay}s`,
                animation: 'particle-burst 0.8s var(--ease-out-expo) forwards',
                opacity: claimed ? 1 : 0,
              }"
            ></div>

            <button
              @click="claim"
              :disabled="claimed"
              class="relative rounded-2xl px-8 py-4 font-display font-bold text-lg text-white transition-all duration-200"
              :class="claimed
                ? 'bg-emerald-700/50 scale-95'
                : 'bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110 active:scale-95 shadow-lg shadow-emerald-500/25'"
              :style="!claimed ? 'animation: claim-pulse 2s ease-in-out infinite' : ''"
            >
              <span v-if="!claimed">
                Reclamar +{{ current.points || 0 }} XP
              </span>
              <span v-else class="flex items-center gap-2">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                </svg>
                ¡Reclamado!
              </span>
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
