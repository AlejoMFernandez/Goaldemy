<script>
import { ref, computed, watch, nextTick } from 'vue'
import { notificationsState, shiftCosmeticQueue, setCosmeticActive } from '@/stores/notifications'
import { soundManager } from '@/services/sounds'
import { triggerConfetti } from '@/services/confetti'
import { frameStyle, bannerStyle, iconBgStyle, equipCosmetic } from '@/services/cosmetics'
import CosmeticIcon from './CosmeticIcon.vue'
import RarityGem from './RarityGem.vue'

const TYPE_LABEL = { frame: 'Borde', title: 'Título', icon: 'Ícono', banner: 'Banner' }

const RARITY_THEME = {
  common:    { glow: 'rgba(148,163,184,0.40)', text: 'text-slate-300',   ringBorder: 'border-slate-400/40',   confetti: ['#cbd5e1', '#94a3b8', '#e2e8f0'],              label: 'Común' },
  rare:      { glow: 'rgba(56,189,248,0.45)',  text: 'text-sky-300',     ringBorder: 'border-sky-400/40',     confetti: ['#38bdf8', '#0ea5e9', '#7dd3fc', '#e0f2fe'],   label: 'Raro' },
  epic:      { glow: 'rgba(232,121,249,0.50)', text: 'text-fuchsia-300', ringBorder: 'border-fuchsia-400/45', confetti: ['#e879f9', '#d946ef', '#f0abfc', '#fae8ff'],   label: 'Épico' },
  legendary: { glow: 'rgba(251,191,36,0.55)',  text: 'text-amber-300',   ringBorder: 'border-amber-400/50',   confetti: ['#fbbf24', '#f59e0b', '#fde047', '#fff7ed'],   label: 'Legendario' },
}

export default {
  name: 'CosmeticUnlockOverlay',
  components: { CosmeticIcon, RarityGem },
  setup() {
    // Carrusel estilo Fortnite: se muestran TODOS los cosméticos desbloqueados
    // de una tanda y se navegan con flechas. Cada uno se puede Equipar directo.
    const items = ref([])        // tanda actual en pantalla
    const index = ref(0)         // tarjeta visible
    const phase = ref(0)         // fases de la animación de entrada
    const busy = ref(false)      // equipando
    const equipped = ref({})     // code → true (ya equipado en esta escena)
    let phaseTimers = []

    function clearTimers() {
      phaseTimers.forEach(clearTimeout)
      phaseTimers = []
    }

    const active = computed(() => items.value.length > 0)
    const current = computed(() => items.value[index.value] || null)
    const total = computed(() => items.value.length)
    const theme = computed(() => RARITY_THEME[current.value?.rarity] || RARITY_THEME.epic)
    const typeLabel = computed(() => TYPE_LABEL[current.value?.type] || 'Cosmético')
    const isEquipped = computed(() => !!(current.value && equipped.value[current.value.code]))

    function canShow() {
      // Prioridad: bienvenida PRO → logros → COSMÉTICOS → nivel/rango.
      // El level-up espera a que este carrusel termine (ver LevelUpOverlay).
      return !notificationsState.suppressOverlays
        && !notificationsState.proWelcome
        && notificationsState.achievementQueue.length === 0
    }

    function showBatch() {
      clearTimers()
      if (!canShow() || active.value) return
      // Drenar TODA la cola de cosméticos en una sola tanda.
      const drained = []
      let it
      while ((it = shiftCosmeticQueue())) drained.push(it)
      if (!drained.length) return

      items.value = drained
      index.value = 0
      equipped.value = {}
      phase.value = 0
      setCosmeticActive(true)   // la subida de nivel espera hasta que cerremos esto

      nextTick(() => {
        phaseTimers.push(setTimeout(() => { phase.value = 1 }, 50))
        phaseTimers.push(setTimeout(() => { phase.value = 2 }, 450))
        phaseTimers.push(setTimeout(() => { phase.value = 3 }, 850))
        phaseTimers.push(setTimeout(() => { phase.value = 4 }, 1150))
        soundManager.play('achievement')
        triggerConfetti({ particleCount: 80, colors: theme.value.confetti })
      })
    }

    function go(delta) {
      const n = index.value + delta
      if (n < 0 || n >= total.value) return
      index.value = n
      soundManager.play('claim')   // sonido sutil al cambiar; el confeti se reserva a apertura/equipar
    }

    async function equipCurrent() {
      const c = current.value
      if (!c || busy.value || equipped.value[c.code]) return
      busy.value = true
      try {
        const res = await equipCosmetic(c.code)
        if (res && res.ok !== false) {
          equipped.value = { ...equipped.value, [c.code]: true }
          soundManager.play('claim')
          triggerConfetti({ particleCount: 45, colors: theme.value.confetti })
        }
      } catch { /* noop */ }
      busy.value = false
    }

    function primary() {
      // "Continuar": avanza; en el último cierra la escena.
      if (index.value < total.value - 1) { go(1); return }
      close()
    }

    function close() {
      clearTimers()
      items.value = []
      index.value = 0
      equipped.value = {}
      phase.value = 0
      if (notificationsState.cosmeticQueue.length > 0) {
        // Quedan más cosméticos: seguimos "activos" y mostramos otra tanda.
        phaseTimers.push(setTimeout(showBatch, 400))
      } else {
        // No queda nada: liberamos el gate → recién ahora aparece la subida de nivel.
        setCosmeticActive(false)
      }
    }

    watch(() => notificationsState.cosmeticQueue.length, (len) => {
      if (len > 0 && !active.value && canShow()) showBatch()
    })
    watch(() => notificationsState.suppressOverlays, (suppressed) => {
      if (!suppressed && notificationsState.cosmeticQueue.length > 0 && !active.value) {
        setTimeout(() => { if (canShow()) showBatch() }, 700)
      }
    })
    watch(() => notificationsState.proWelcome, (pw) => {
      if (!pw && notificationsState.cosmeticQueue.length > 0 && !active.value) {
        setTimeout(() => { if (canShow()) showBatch() }, 500)
      }
    })

    return {
      items, index, phase, busy, active, current, total, theme, typeLabel, isEquipped,
      go, equipCurrent, primary, close,
      frameStyle, bannerStyle, iconBgStyle,
    }
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="overlay-fade">
      <div v-if="active" class="fixed inset-0 z-[60] grid place-items-center p-4" @click.self="close">
        <div class="absolute inset-0 bg-black/85 backdrop-blur-md"></div>

        <div class="relative flex flex-col items-center text-center max-w-md w-full">
          <!-- Contador de la tanda -->
          <div v-if="total > 1" class="mb-3 transition-all duration-500" :class="phase >= 1 ? 'opacity-100' : 'opacity-0'">
            <span class="text-xs font-bold text-slate-300 bg-white/5 border border-white/10 rounded-full px-3 py-1">
              {{ index + 1 }} de {{ total }} desbloqueados
            </span>
          </div>

          <!-- Etiqueta de rareza -->
          <div class="mb-4 transition-all duration-500" :class="phase >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'">
            <span class="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-extrabold uppercase tracking-wider backdrop-blur"
                  :class="[theme.ringBorder, theme.text]"
                  :style="`box-shadow: 0 0 18px ${theme.glow}`">
              <RarityGem :rarity="current.rarity" :size="15" />
              {{ theme.label }}
            </span>
          </div>

          <!-- Preview con flechas a los costados -->
          <div class="relative mb-6 flex items-center gap-4">
            <!-- Flecha izquierda -->
            <button v-if="total > 1" @click="go(-1)" :disabled="index === 0"
                    class="shrink-0 grid place-items-center w-11 h-11 rounded-full border border-white/15 bg-white/5 text-white transition hover:bg-white/10 disabled:opacity-25 disabled:cursor-not-allowed"
                    :class="phase >= 2 ? 'opacity-100' : 'opacity-0'">
              <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>

            <!-- Tarjeta del cosmético (se re-anima al cambiar de índice) -->
            <div :key="index"
                 class="relative transition-all duration-500"
                 :class="phase >= 1 ? 'opacity-100' : 'opacity-0'"
                 style="animation: scale-spring 0.5s var(--ease-bounce, cubic-bezier(0.34,1.56,0.64,1)) both">
              <!-- ICON -->
              <div v-if="current.type === 'icon'" class="w-36 h-36 grid place-items-center"
                   :style="phase >= 2 ? `filter: drop-shadow(0 0 26px ${theme.glow}); animation: glow-pulse 2s ease-in-out infinite` : `filter: drop-shadow(0 0 16px ${theme.glow})`">
                <CosmeticIcon :iconKey="current.styleKey" :rarity="current.rarity" :size="140" />
              </div>
              <!-- Resto: contenedor con borde + glow por rareza -->
              <div v-else class="w-32 h-32 rounded-3xl grid place-items-center border-2" :class="theme.ringBorder"
                   :style="phase >= 2 ? `animation: glow-pulse 2s ease-in-out infinite; box-shadow: 0 0 40px ${theme.glow}` : `box-shadow: 0 0 24px ${theme.glow}`">
                <!-- FRAME: el borde SOLO, alrededor de un disco liso -->
                <div v-if="current.type === 'frame'" :class="['rounded-full', frameStyle(current.styleKey).wrap, frameStyle(current.styleKey).pad]">
                  <div class="w-20 h-20 rounded-full bg-gradient-to-br from-slate-700 to-slate-900"></div>
                </div>
                <div v-else-if="current.type === 'banner'" :class="['w-24 h-16 rounded-xl border border-white/15', bannerStyle(current.styleKey)]"></div>
                <div v-else class="px-3"><div class="font-display font-extrabold text-xl" :class="theme.text">{{ current.name }}</div></div>
              </div>
            </div>

            <!-- Flecha derecha -->
            <button v-if="total > 1" @click="go(1)" :disabled="index === total - 1"
                    class="shrink-0 grid place-items-center w-11 h-11 rounded-full border border-white/15 bg-white/5 text-white transition hover:bg-white/10 disabled:opacity-25 disabled:cursor-not-allowed"
                    :class="phase >= 2 ? 'opacity-100' : 'opacity-0'">
              <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>

          <!-- Texto -->
          <div class="mb-2 transition-all duration-500" :class="phase >= 2 ? 'opacity-100' : 'opacity-0'">
            <div class="font-display text-xs font-bold uppercase mb-3 tracking-wider" :class="theme.text">{{ typeLabel }} desbloqueado</div>
            <h2 class="font-display text-3xl font-extrabold text-white mb-2">{{ current.name }}</h2>
          </div>

          <!-- Cómo lo conseguiste -->
          <div v-if="current.reason" class="mb-5 -mt-1 max-w-xs transition-all duration-400" :class="phase >= 3 ? 'opacity-100' : 'opacity-0'">
            <p class="text-sm text-slate-300"><span class="text-slate-500">Lo conseguiste por:</span> <span class="font-semibold text-white">{{ current.reason }}</span></p>
          </div>

          <!-- Puntos (dots) -->
          <div v-if="total > 1" class="mb-4 flex items-center justify-center gap-1.5 transition-all duration-400" :class="phase >= 4 ? 'opacity-100' : 'opacity-0'">
            <button v-for="(it, i) in items" :key="it.code" @click="index = i"
                    class="h-2 rounded-full transition-all"
                    :class="i === index ? 'w-5 bg-white' : 'w-2 bg-white/30 hover:bg-white/50'"></button>
          </div>

          <!-- Botones: Equipar + Continuar -->
          <div class="flex items-center gap-3 transition-all duration-400" :class="phase >= 4 ? 'opacity-100' : 'opacity-0'">
            <button @click="equipCurrent" :disabled="busy || isEquipped"
                    class="rounded-2xl px-6 py-3.5 font-display font-bold text-base transition-all duration-200 border"
                    :class="isEquipped
                      ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300'
                      : 'border-white/15 bg-white/5 text-white hover:bg-white/10 active:scale-95'">
              <span v-if="isEquipped" class="flex items-center gap-2">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
                Equipado
              </span>
              <span v-else>{{ busy ? 'Equipando…' : 'Equipar' }}</span>
            </button>

            <button @click="primary"
                    class="rounded-2xl px-8 py-3.5 font-display font-bold text-base text-white bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110 active:scale-95 shadow-lg shadow-emerald-500/25 transition-all duration-200"
                    style="animation: claim-pulse 2s ease-in-out infinite">
              {{ index < total - 1 ? 'Siguiente' : (total > 1 ? 'Listo' : 'Continuar') }}
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
