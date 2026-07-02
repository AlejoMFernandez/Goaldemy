<script>
import { ref, computed, watch, nextTick } from 'vue'
import { notificationsState, shiftCosmeticQueue } from '@/stores/notifications'
import { soundManager } from '@/services/sounds'
import { triggerConfetti } from '@/services/confetti'
import { frameStyle, bannerStyle, iconBgStyle } from '@/services/cosmetics'
import CosmeticIcon from './CosmeticIcon.vue'

const TYPE_LABEL = { frame: 'Borde', title: 'Título', icon: 'Ícono', banner: 'Banner' }

const RARITY_THEME = {
  common:    { glow: 'rgba(148,163,184,0.40)', text: 'text-slate-300',   ringBorder: 'border-slate-400/40',   confetti: ['#cbd5e1', '#94a3b8', '#e2e8f0'],              label: 'Común' },
  rare:      { glow: 'rgba(56,189,248,0.45)',  text: 'text-sky-300',     ringBorder: 'border-sky-400/40',     confetti: ['#38bdf8', '#0ea5e9', '#7dd3fc', '#e0f2fe'],   label: 'Raro' },
  epic:      { glow: 'rgba(232,121,249,0.50)', text: 'text-fuchsia-300', ringBorder: 'border-fuchsia-400/45', confetti: ['#e879f9', '#d946ef', '#f0abfc', '#fae8ff'],   label: 'Épico' },
  legendary: { glow: 'rgba(251,191,36,0.55)',  text: 'text-amber-300',   ringBorder: 'border-amber-400/50',   confetti: ['#fbbf24', '#f59e0b', '#fde047', '#fff7ed'],   label: 'Legendario' },
}

export default {
  name: 'CosmeticUnlockOverlay',
  components: { CosmeticIcon },
  setup() {
    const current = ref(null)
    const phase = ref(0)
    const claimed = ref(false)
    let phaseTimers = []

    function clearTimers() {
      phaseTimers.forEach(clearTimeout)
      phaseTimers = []
    }

    const theme = computed(() => RARITY_THEME[current.value?.rarity] || RARITY_THEME.epic)
    const typeLabel = computed(() => TYPE_LABEL[current.value?.type] || 'Cosmético')

    function showNext() {
      clearTimers()
      if (notificationsState.suppressOverlays) return
      const item = shiftCosmeticQueue()
      if (!item) { current.value = null; phase.value = 0; return }

      current.value = item
      claimed.value = false
      phase.value = 0

      nextTick(() => {
        phaseTimers.push(setTimeout(() => { phase.value = 1 }, 50))
        phaseTimers.push(setTimeout(() => { phase.value = 2 }, 450))
        phaseTimers.push(setTimeout(() => { phase.value = 3 }, 850))
        phaseTimers.push(setTimeout(() => { phase.value = 4 }, 1250))
        soundManager.play('achievement')
        triggerConfetti({ particleCount: 70, colors: theme.value.confetti })
      })
    }

    function claim() {
      if (claimed.value) return
      claimed.value = true
      soundManager.play('claim')
      triggerConfetti({ particleCount: 50, colors: theme.value.confetti })
      phaseTimers.push(setTimeout(() => {
        current.value = null
        phase.value = 0
        phaseTimers.push(setTimeout(showNext, 400))
      }, 1100))
    }

    watch(() => notificationsState.cosmeticQueue.length, (len) => {
      // No pisar la escena de logro: esperá si hay logros en cola.
      if (len > 0 && !current.value && notificationsState.achievementQueue.length === 0) showNext()
    })

    watch(() => notificationsState.suppressOverlays, (suppressed) => {
      if (!suppressed && notificationsState.cosmeticQueue.length > 0 && !current.value) {
        setTimeout(showNext, 700)
      }
    })

    return { current, phase, claimed, theme, typeLabel, claim, frameStyle, bannerStyle, iconBgStyle }
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="overlay-fade">
      <div v-if="current" class="fixed inset-0 z-[60] grid place-items-center p-4" @click.self="claim">
        <div class="absolute inset-0 bg-black/85 backdrop-blur-md"></div>

        <div class="relative flex flex-col items-center text-center max-w-md w-full">
          <!-- Preview del cosmético con glow de rareza + respiración -->
          <div
            class="relative mb-6 transition-all duration-500"
            :class="phase >= 1 ? 'opacity-100' : 'opacity-0'"
            :style="phase >= 1 ? 'animation: scale-spring 0.6s var(--ease-bounce) both' : ''"
          >
            <div
              class="w-32 h-32 rounded-3xl grid place-items-center border-2"
              :class="theme.ringBorder"
              :style="phase >= 2 ? `animation: glow-pulse 2s ease-in-out infinite; box-shadow: 0 0 40px ${theme.glow}` : `box-shadow: 0 0 24px ${theme.glow}`"
            >
              <!-- FRAME: anillo de borde alrededor de un avatar de muestra -->
              <div v-if="current.type === 'frame'" :class="['rounded-full', frameStyle(current.styleKey).wrap, frameStyle(current.styleKey).pad]">
                <div class="w-20 h-20 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 grid place-items-center text-3xl">⚽</div>
              </div>
              <!-- BANNER: muestra del gradiente -->
              <div v-else-if="current.type === 'banner'" :class="['w-24 h-16 rounded-xl border border-white/15', bannerStyle(current.styleKey)]"></div>
              <!-- ICON: medallón detallado -->
              <div v-else-if="current.type === 'icon'">
                <CosmeticIcon :iconKey="current.styleKey" :rarity="current.rarity" framed :size="112" />
              </div>
              <!-- TITLE: el texto del título -->
              <div v-else class="px-3">
                <div class="font-display font-extrabold text-xl" :class="theme.text">{{ current.name }}</div>
              </div>
            </div>
          </div>

          <!-- Texto -->
          <div class="mb-2 transition-all duration-500" :class="phase >= 2 ? 'opacity-100' : 'opacity-0'">
            <div
              class="font-display text-xs font-bold uppercase mb-3 tracking-wider"
              :class="theme.text"
              :style="phase >= 2 ? 'animation: tracking-reveal 0.6s var(--ease-out-expo) both' : ''"
            >
              {{ typeLabel }} desbloqueado
            </div>
            <h2 class="font-display text-3xl font-extrabold text-white mb-2">{{ current.name }}</h2>
          </div>

          <!-- Badge de rareza -->
          <div class="mb-6 transition-all duration-400" :class="phase >= 3 ? 'opacity-100' : 'opacity-0'">
            <span class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold" :class="[theme.ringBorder, theme.text]">
              ✦ {{ theme.label }}
            </span>
          </div>

          <!-- Cómo lo conseguiste -->
          <div v-if="current.reason" class="mb-5 -mt-1 max-w-xs transition-all duration-400" :class="phase >= 3 ? 'opacity-100' : 'opacity-0'">
            <p class="text-sm text-slate-300"><span class="text-slate-500">Lo conseguiste por:</span> <span class="font-semibold text-white">{{ current.reason }}</span></p>
          </div>

          <!-- Botón reclamar -->
          <div class="relative transition-all duration-400" :class="phase >= 4 ? 'opacity-100' : 'opacity-0'">
            <button
              @click="claim"
              :disabled="claimed"
              class="relative rounded-2xl px-8 py-4 font-display font-bold text-lg text-white transition-all duration-200"
              :class="claimed ? 'bg-slate-700/50 scale-95' : 'bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110 active:scale-95 shadow-lg shadow-emerald-500/25'"
              :style="!claimed ? 'animation: claim-pulse 2s ease-in-out infinite' : ''"
            >
              <span v-if="!claimed">Reclamar</span>
              <span v-else class="flex items-center gap-2">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg>
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
