<script>
import { ref, watch, nextTick } from 'vue'
import { notificationsState, shiftAchievementQueue } from '@/stores/notifications'
import { soundManager } from '@/services/sounds'
import { celebrateAchievement } from '@/services/confetti'
import { achievementIcon } from '@/services/achievement-icons'
import CosmeticIcon from './CosmeticIcon.vue'

export default {
  name: 'AchievementUnlockOverlay',
  components: { CosmeticIcon },
  setup() {
    const current = ref(null)
    const phase = ref(0)
    const claimed = ref(false)
    const particles = ref([])
    const flying = ref(false)
    const flightStyle = ref(null)
    const iconWrapRef = ref(null)
    let phaseTimers = []

    function clearTimers() {
      phaseTimers.forEach(clearTimeout)
      phaseTimers = []
    }

    function showNext() {
      clearTimers()
      if (notificationsState.suppressOverlays) return
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
      phaseTimers.push(setTimeout(flyToAvatar, 1000))
    }

    function flyToAvatar() {
      const iconEl = iconWrapRef.value
      if (!iconEl) { closeAndAdvance(); return }

      const startRect = iconEl.getBoundingClientRect()
      const anchor = document.querySelector('[data-avatar-anchor]')
      const anchorRect = anchor ? anchor.getBoundingClientRect() : null
      const hasAnchor = !!(anchorRect && anchorRect.width > 0)
      const targetRect = hasAnchor
        ? anchorRect
        : { top: 14, left: window.innerWidth - 54, width: 40, height: 40 }

      const scale = targetRect.width / startRect.width
      const deltaX = (targetRect.left + targetRect.width / 2) - (startRect.left + startRect.width / 2)
      const deltaY = (targetRect.top + targetRect.height / 2) - (startRect.top + startRect.height / 2)

      flying.value = true
      flightStyle.value = {
        position: 'fixed',
        top: `${startRect.top}px`,
        left: `${startRect.left}px`,
        width: `${startRect.width}px`,
        height: `${startRect.height}px`,
        margin: 0,
        zIndex: 70,
        transformOrigin: 'center center',
        transform: 'translate(0, 0) scale(1)',
        transition: 'none',
        opacity: 1,
      }

      nextTick(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            flightStyle.value = {
              ...flightStyle.value,
              transform: `translate(${deltaX}px, ${deltaY}px) scale(${scale})`,
              transition: 'transform 0.55s cubic-bezier(0.16,1,0.3,1), opacity 0.5s ease-in',
              opacity: hasAnchor ? 0.15 : 0,
            }
          })
        })
      })

      phaseTimers.push(setTimeout(() => {
        if (hasAnchor && anchor) {
          anchor.style.animation = 'avatar-receive 0.5s var(--ease-bounce)'
          setTimeout(() => { anchor.style.animation = '' }, 550)
        }
        closeAndAdvance()
      }, 600))
    }

    function closeAndAdvance() {
      current.value = null
      phase.value = 0
      flying.value = false
      flightStyle.value = null
      phaseTimers.push(setTimeout(showNext, 200))
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

    watch(() => notificationsState.suppressOverlays, (suppressed) => {
      if (!suppressed && notificationsState.achievementQueue.length > 0 && !current.value) {
        setTimeout(showNext, 600)
      }
    })

    function iconOf(item) { return achievementIcon(item?.code) }

    return { current, phase, claimed, particles, flying, flightStyle, iconWrapRef, claim, rarityLabel, iconOf }
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="overlay-fade">
      <div v-if="current" class="fixed inset-0 z-[60] grid place-items-center p-4" @click.self="claim">
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-black/85 backdrop-blur-md transition-opacity duration-400"
          :class="{ 'opacity-0': flying }"
        ></div>

        <!-- Content -->
        <div class="relative flex flex-col items-center text-center max-w-md w-full">

          <!-- Glow ring + Icon -->
          <div
            ref="iconWrapRef"
            class="relative mb-6"
            :class="!flying ? ['transition-all duration-500', phase >= 1 ? 'opacity-100' : 'opacity-0'] : ''"
            :style="flying ? flightStyle : (phase >= 1 ? 'animation: scale-spring 0.6s var(--ease-bounce) both' : '')"
          >
            <div class="w-28 h-28 rounded-full grid place-items-center"
              :style="phase >= 2 && !flying ? 'animation: glow-pulse 2s ease-in-out infinite' : ''">
              <CosmeticIcon framed :icon-key="iconOf(current).icon" :rarity="iconOf(current).rarity" :size="112" />
            </div>
          </div>

          <!-- Title text -->
          <div
            class="mb-2 transition-all"
            :class="[(phase >= 2 && !flying) ? 'opacity-100' : 'opacity-0', flying ? 'duration-200' : 'duration-500']"
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
            class="mb-6 transition-all"
            :class="[(phase >= 3 && !flying) ? 'opacity-100' : 'opacity-0', flying ? 'duration-200' : 'duration-400']"
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
            class="relative transition-all"
            :class="[(phase >= 4 && !flying) ? 'opacity-100' : 'opacity-0', flying ? 'duration-200 pointer-events-none' : 'duration-400']"
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
