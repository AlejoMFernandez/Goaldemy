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

// Orden de rareza para elegir el "brillo" del sobre cerrado: si la tanda trae
// una legendaria, el sobre ya lo insinúa (como el destello de un cofre de
// Clash Royale antes de abrirlo) aunque el contenido sea 100% determinístico.
const RARITY_RANK = { common: 0, rare: 1, epic: 2, legendary: 3 }

export default {
  name: 'CosmeticUnlockOverlay',
  components: { CosmeticIcon, RarityGem },
  setup() {
    // Con 1 sola recompensa: un sobre → lo abrís → pantalla de detalle grande.
    // Con varias: una GRILLA de sobres individuales (estilo caja de Overwatch /
    // cofres Hextech de LoL) — cada uno se abre por separado, a su propio ritmo.
    const items = ref([])        // tanda actual en pantalla
    const phase = ref(0)         // fases de la animación de entrada (solo detalle de 1)
    const busy = ref(false)      // equipando
    const equipped = ref({})     // code → true (ya equipado en esta escena)
    const revealed = ref({})     // code → true (ya se abrió esa carta, modo grilla)
    const unboxed = ref(false)   // (modo 1 sola) false = sobre cerrado, true = ya reveló
    const cracking = ref(false)  // animación de apertura en curso (entre el tap y la revelación)
    let phaseTimers = []

    function clearTimers() {
      phaseTimers.forEach(clearTimeout)
      phaseTimers = []
    }

    const active = computed(() => items.value.length > 0)
    const total = computed(() => items.value.length)
    const current = computed(() => items.value[0] || null) // solo se usa en el modo "1 sola"
    const theme = computed(() => RARITY_THEME[current.value?.rarity] || RARITY_THEME.epic)
    // Rareza más alta de la tanda: define el brillo del sobre cerrado (el "teaser").
    const batchRarity = computed(() => {
      let best = 'common'
      for (const it of items.value) {
        if ((RARITY_RANK[it.rarity] || 0) > (RARITY_RANK[best] || 0)) best = it.rarity
      }
      return best
    })
    const batchTheme = computed(() => RARITY_THEME[batchRarity.value] || RARITY_THEME.common)
    const typeLabel = computed(() => TYPE_LABEL[current.value?.type] || 'Cosmético')
    const isEquipped = computed(() => !!(current.value && equipped.value[current.value.code]))

    // Modo grilla (2+ recompensas)
    const revealedCount = computed(() => items.value.filter(it => revealed.value[it.code]).length)
    const allRevealed = computed(() => total.value > 0 && revealedCount.value === total.value)
    function themeFor(item) { return RARITY_THEME[item?.rarity] || RARITY_THEME.common }
    function typeLabelFor(item) { return TYPE_LABEL[item?.type] || 'Cosmético' }

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
      equipped.value = {}
      revealed.value = {}
      phase.value = 0
      unboxed.value = false
      cracking.value = false
      setCosmeticActive(true)   // la subida de nivel espera hasta que cerremos esto
      soundManager.play('notify') // ding sutil: "tenés algo esperando"
    }

    // Modo "1 sola": el usuario toca el sobre cerrado → apertura (suspenso corto) →
    // pantalla de detalle grande con la secuencia de reveal + confeti de siempre.
    function openPack() {
      if (cracking.value || unboxed.value) return
      cracking.value = true
      soundManager.play('combo') // riser corto de tensión mientras "cruje" el sobre
      phaseTimers.push(setTimeout(() => {
        unboxed.value = true
        cracking.value = false
        nextTick(() => {
          phaseTimers.push(setTimeout(() => { phase.value = 1 }, 50))
          phaseTimers.push(setTimeout(() => { phase.value = 2 }, 450))
          phaseTimers.push(setTimeout(() => { phase.value = 3 }, 850))
          phaseTimers.push(setTimeout(() => { phase.value = 4 }, 1150))
          soundManager.play('achievement')
          triggerConfetti({ particleCount: 80, colors: theme.value.confetti })
        })
      }, 550))
    }

    // Modo grilla: cada carta se abre de forma independiente al tocarla.
    function revealCard(item, event) {
      if (!item || revealed.value[item.code]) return
      revealed.value = { ...revealed.value, [item.code]: true }
      soundManager.play('starReveal')
      const rect = event?.currentTarget?.getBoundingClientRect?.()
      const origin = rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null
      triggerConfetti({ particleCount: 34, colors: themeFor(item).confetti, origin })
    }

    async function equipItem(item) {
      if (!item || busy.value || equipped.value[item.code]) return
      busy.value = true
      try {
        const res = await equipCosmetic(item.code)
        if (res && res.ok !== false) {
          equipped.value = { ...equipped.value, [item.code]: true }
          soundManager.play('claim')
        }
      } catch { /* noop */ }
      busy.value = false
    }

    function close() {
      clearTimers()
      items.value = []
      equipped.value = {}
      revealed.value = {}
      phase.value = 0
      unboxed.value = false
      cracking.value = false
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
      items, phase, busy, active, current, total, theme, typeLabel, isEquipped,
      unboxed, cracking, batchTheme, equipped, revealed, revealedCount, allRevealed,
      equipItem, close, openPack, revealCard, themeFor, typeLabelFor,
      frameStyle, bannerStyle, iconBgStyle,
    }
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="overlay-fade">
      <div v-if="active" class="fixed inset-0 z-[60] grid place-items-center p-4 overflow-y-auto"
           @click.self="(total === 1 ? unboxed : allRevealed) && close()">
        <div class="absolute inset-0 bg-black/85 backdrop-blur-md"></div>

        <!-- ═══ MODO "1 SOLA": sobre → detalle grande (sin cambios de comportamiento) ═══ -->
        <template v-if="total === 1">
          <!-- SOBRE CERRADO -->
          <div v-if="!unboxed" class="relative flex flex-col items-center text-center">
            <p class="mb-5 text-xs font-bold uppercase tracking-wider" :class="batchTheme.text">Tenés una recompensa</p>
            <button
              type="button"
              @click="openPack"
              :disabled="cracking"
              class="pack-box relative w-40 h-48 grid place-items-center rounded-3xl border-2 transition-transform active:scale-95"
              :class="[batchTheme.ringBorder, cracking ? 'pack-cracking' : 'pack-idle']"
              :style="`box-shadow: 0 0 42px ${batchTheme.glow}, inset 0 0 30px ${batchTheme.glow}`"
            >
              <div class="pack-sheen absolute inset-0 rounded-3xl overflow-hidden"></div>
              <svg class="w-16 h-16 relative" :class="batchTheme.text" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v18M4 7.5l8 4.5 8-4.5" />
              </svg>
            </button>
            <p class="mt-5 text-sm font-semibold text-white" :style="cracking ? '' : 'animation: pulse-soft 1.6s ease-in-out infinite'">
              {{ cracking ? 'Abriendo…' : 'Tocá para abrir' }}
            </p>
          </div>

          <!-- DETALLE REVELADO -->
          <div v-else class="relative flex flex-col items-center text-center max-w-md w-full">
            <div class="mb-4 transition-all duration-500" :class="phase >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'">
              <span class="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-extrabold uppercase tracking-wider backdrop-blur"
                    :class="[theme.ringBorder, theme.text]"
                    :style="`box-shadow: 0 0 18px ${theme.glow}`">
                <RarityGem :rarity="current.rarity" :size="15" />
                {{ theme.label }}
              </span>
            </div>

            <div class="relative mb-6 transition-all duration-500" :class="phase >= 1 ? 'opacity-100' : 'opacity-0'"
                 style="animation: scale-spring 0.5s var(--ease-bounce, cubic-bezier(0.34,1.56,0.64,1)) both">
              <div v-if="current.type === 'icon'" class="w-36 h-36 grid place-items-center"
                   :style="phase >= 2 ? `filter: drop-shadow(0 0 26px ${theme.glow}); animation: glow-pulse 2s ease-in-out infinite` : `filter: drop-shadow(0 0 16px ${theme.glow})`">
                <CosmeticIcon :iconKey="current.styleKey" :rarity="current.rarity" :size="140" />
              </div>
              <div v-else class="w-32 h-32 rounded-3xl grid place-items-center border-2" :class="theme.ringBorder"
                   :style="phase >= 2 ? `animation: glow-pulse 2s ease-in-out infinite; box-shadow: 0 0 40px ${theme.glow}` : `box-shadow: 0 0 24px ${theme.glow}`">
                <div v-if="current.type === 'frame'" :class="['rounded-full', frameStyle(current.styleKey).wrap, frameStyle(current.styleKey).pad]">
                  <div class="w-20 h-20 rounded-full bg-gradient-to-br from-slate-700 to-slate-900"></div>
                </div>
                <div v-else-if="current.type === 'banner'" :class="['w-24 h-16 rounded-xl border border-white/15', bannerStyle(current.styleKey)]"></div>
                <div v-else class="px-3"><div class="font-display font-bold text-xl" :class="theme.text">{{ current.name }}</div></div>
              </div>
            </div>

            <div class="mb-2 transition-all duration-500" :class="phase >= 2 ? 'opacity-100' : 'opacity-0'">
              <div class="font-display text-xs font-bold uppercase mb-3 tracking-wider" :class="theme.text">{{ typeLabel }} desbloqueado</div>
              <h2 class="font-display text-3xl font-bold text-white mb-2">{{ current.name }}</h2>
            </div>

            <div v-if="current.reason" class="mb-5 -mt-1 max-w-xs transition-all duration-400" :class="phase >= 3 ? 'opacity-100' : 'opacity-0'">
              <p class="text-sm text-slate-300"><span class="text-slate-500">Lo conseguiste por:</span> <span class="font-semibold text-white">{{ current.reason }}</span></p>
            </div>

            <div class="flex items-center gap-3 transition-all duration-400" :class="phase >= 4 ? 'opacity-100' : 'opacity-0'">
              <button @click="equipItem(current)" :disabled="busy || isEquipped"
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

              <button @click="close"
                      class="rounded-2xl px-8 py-3.5 font-display font-bold text-base text-slate-900 bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 active:scale-95 shadow-lg shadow-amber-500/25 transition-all duration-200"
                      style="animation: claim-pulse 2s ease-in-out infinite">
                Continuar
              </button>
            </div>
          </div>
        </template>

        <!-- ═══ MODO GRILLA (2+): un sobre por recompensa, se abren de a uno ═══ -->
        <div v-else class="relative flex flex-col items-center text-center max-w-2xl w-full py-6">
          <p class="mb-1 text-xs font-bold uppercase tracking-wider text-slate-300">
            {{ revealedCount }} de {{ total }} abiertas
          </p>
          <p class="mb-6 text-sm text-slate-400">Tocá cada sobre para ver qué te tocó</p>

          <div class="grid gap-4 justify-center w-full" style="grid-template-columns: repeat(auto-fit, minmax(120px, 140px));">
            <div v-for="item in items" :key="item.code" class="pack-flip" :class="{ 'is-flipped': revealed[item.code] }">
              <div class="pack-flip-inner relative w-full aspect-[3/4]">

                <!-- Cara cerrada -->
                <button
                  type="button"
                  @click="revealCard(item, $event)"
                  class="pack-face pack-face-front absolute inset-0 rounded-2xl border-2 grid place-items-center pack-idle"
                  :class="themeFor(item).ringBorder"
                  :style="`box-shadow: 0 0 26px ${themeFor(item).glow}, inset 0 0 20px ${themeFor(item).glow}`"
                >
                  <div class="pack-sheen absolute inset-0 rounded-2xl overflow-hidden"></div>
                  <svg class="w-9 h-9 relative" :class="themeFor(item).text" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v18M4 7.5l8 4.5 8-4.5" />
                  </svg>
                </button>

                <!-- Cara revelada -->
                <div class="pack-face pack-face-back absolute inset-0 rounded-2xl border-2 flex flex-col items-center justify-center gap-1.5 p-2 bg-slate-900/90"
                     :class="themeFor(item).ringBorder"
                     :style="revealed[item.code] ? `box-shadow: 0 0 24px ${themeFor(item).glow}` : ''">
                  <RarityGem :rarity="item.rarity" :size="11" />
                  <div v-if="item.type === 'icon'" class="w-12 h-12 grid place-items-center">
                    <CosmeticIcon :iconKey="item.styleKey" :rarity="item.rarity" :size="44" />
                  </div>
                  <div v-else-if="item.type === 'frame'" :class="['rounded-full', frameStyle(item.styleKey).wrap, frameStyle(item.styleKey).pad]">
                    <div class="w-9 h-9 rounded-full bg-gradient-to-br from-slate-700 to-slate-900"></div>
                  </div>
                  <div v-else-if="item.type === 'banner'" :class="['w-14 h-9 rounded-lg border border-white/15', bannerStyle(item.styleKey)]"></div>
                  <div v-else class="font-display font-bold text-sm" :class="themeFor(item).text">{{ item.name }}</div>
                  <p class="text-[10px] font-semibold text-white leading-tight text-center line-clamp-2">{{ item.name }}</p>
                  <button
                    v-if="revealed[item.code]"
                    @click="equipItem(item)"
                    :disabled="busy || !!equipped[item.code]"
                    class="mt-0.5 rounded-full px-2.5 py-1 text-[10px] font-bold border transition"
                    :class="equipped[item.code]
                      ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300'
                      : 'border-white/15 bg-white/5 text-white hover:bg-white/10'">
                    {{ equipped[item.code] ? 'Equipado ✓' : 'Equipar' }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <button
            @click="close"
            :disabled="!allRevealed"
            class="mt-8 rounded-2xl px-8 py-3.5 font-display font-bold text-base transition-all duration-200"
            :class="allRevealed
              ? 'text-slate-900 bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 active:scale-95 shadow-lg shadow-amber-500/25'
              : 'text-slate-500 bg-white/5 border border-white/10 cursor-not-allowed'"
            :style="allRevealed ? 'animation: claim-pulse 2s ease-in-out infinite' : ''"
          >
            {{ allRevealed ? 'Continuar' : `Abrí las ${total - revealedCount} que faltan` }}
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.overlay-fade-enter-active { transition: opacity 0.3s ease; }
.overlay-fade-leave-active { transition: opacity 0.25s ease; }
.overlay-fade-enter-from, .overlay-fade-leave-to { opacity: 0; }

/* Sobre cerrado: bg sutil + respiración lenta para invitar al tap */
.pack-box, .pack-face-front { background: linear-gradient(160deg, rgba(255,255,255,0.06), rgba(0,0,0,0.25)); cursor: pointer; }
.pack-idle { animation: pack-breathe 2.2s ease-in-out infinite, pack-wiggle 4.5s ease-in-out infinite; }
.pack-cracking { animation: pack-shake 0.5s ease-in-out; cursor: default; }
@keyframes pack-breathe {
  0%, 100% { filter: brightness(1); }
  50% { filter: brightness(1.18); }
}
@keyframes pack-wiggle {
  0%, 92%, 100% { transform: rotate(0deg); }
  94% { transform: rotate(-2deg); }
  97% { transform: rotate(2deg); }
}
@keyframes pack-shake {
  0% { transform: scale(1) rotate(0deg); }
  20% { transform: scale(1.03) rotate(-3deg); }
  40% { transform: scale(1.05) rotate(3deg); }
  60% { transform: scale(1.08) rotate(-4deg); }
  80% { transform: scale(1.15) rotate(2deg); }
  100% { transform: scale(1.5) rotate(0deg); opacity: 0; }
}
.pack-sheen { background: linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.25) 48%, transparent 66%); background-size: 220% 220%; animation: pack-sheen-sweep 2.8s ease-in-out infinite; }
@keyframes pack-sheen-sweep {
  0% { background-position: 120% 0%; }
  55%, 100% { background-position: -20% 0%; }
}
@keyframes pulse-soft {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

/* Grilla de sobres (2+ recompensas): cada carta se "da vuelta" al tocarla. */
.pack-flip { perspective: 1200px; }
.pack-flip-inner {
  transform-style: preserve-3d;
  transition: transform 0.55s var(--ease-bounce, cubic-bezier(0.34, 1.56, 0.64, 1));
}
.pack-flip.is-flipped .pack-flip-inner { transform: rotateY(180deg); }
.pack-face { backface-visibility: hidden; -webkit-backface-visibility: hidden; }
.pack-face-back { transform: rotateY(180deg); }

@media (prefers-reduced-motion: reduce) {
  .pack-idle, .pack-cracking, .pack-sheen { animation: none; }
  .pack-flip-inner { transition: none; }
}
</style>
