<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { notificationsState, shiftLevelUpQueue, setLevelUpActive } from '@/stores/notifications'
import { getTierForLevel, tierAccentText } from '@/services/tiers'
import { getLevelRewards, getUpcomingRewards } from '@/services/level-rewards'
import { soundManager } from '@/services/sounds'
import { celebrateLevelUp, confettiGold } from '@/services/confetti'
import PassCosmetic from './PassCosmetic.vue'

const current = ref(null)
const stage = ref('level')   // 'rank' (acto 1, solo si cambia de rango) | 'level' (acto 2)
const rp = ref(0)            // fase de la animación de rango
const lp = ref(0)            // fase de la animación de nivel
let timers = []

function clearTimers() { timers.forEach(clearTimeout); timers = [] }

const oldTier = computed(() => current.value ? getTierForLevel(current.value.oldLevel) : null)
const newTier = computed(() => current.value ? getTierForLevel(current.value.newLevel) : null)
const tierChanged = computed(() => oldTier.value && newTier.value && oldTier.value.key !== newTier.value.key)
const isMilestone = computed(() => !!current.value?.milestone)

const levelRewards = computed(() => current.value ? getLevelRewards(current.value.newLevel) : [])
const unlockItems = computed(() => levelRewards.value.filter(r => r.kind !== 'xp'))
const upcoming = computed(() => current.value ? getUpcomingRewards(current.value.newLevel, 4) : [])

const newTierColor = computed(() => tierAccentText(newTier.value?.color))

const COSMETIC_KINDS = new Set(['frame', 'icon', 'banner', 'title'])
function isCos(kind) { return COSMETIC_KINDS.has(kind) }
function cosObj(r) { return { type: r.kind, style_key: r.styleKey, rarity: r.rarity, name: r.name } }
function typeLabelOf(r) {
  if (r.kind === 'game') return 'Juego'
  if (r.kind === 'tier') return 'Rango'
  return r.typeLabel || ''
}

function runRank() {
  stage.value = 'rank'; rp.value = 0
  nextTick(() => {
    timers.push(setTimeout(() => { rp.value = 1 }, 100))
    timers.push(setTimeout(() => { rp.value = 2 }, 700))
    timers.push(setTimeout(() => { rp.value = 3; confettiGold() }, 1300))
    soundManager.play('levelUp')
  })
}

function runLevel() {
  stage.value = 'level'; lp.value = 0
  nextTick(() => {
    timers.push(setTimeout(() => { lp.value = 1 }, 100))
    timers.push(setTimeout(() => { lp.value = 2; celebrateLevelUp() }, 700))
    timers.push(setTimeout(() => { lp.value = 3 }, 1300))
    if (!tierChanged.value) soundManager.play('levelUp')
  })
}

function goToLevel() { clearTimers(); runLevel() }

function showNext() {
  clearTimers()
  if (notificationsState.suppressOverlays) return
  if (notificationsState.achievementQueue.length > 0) {
    timers.push(setTimeout(showNext, 800))
    return
  }
  const item = shiftLevelUpQueue()
  if (!item) { current.value = null; setLevelUpActive(false); return }
  current.value = item
  setLevelUpActive(true)   // la escena de cosmético espera a que esto termine
  if (tierChanged.value) runRank()
  else runLevel()
}

function dismiss() {
  clearTimers()
  current.value = null
  rp.value = 0; lp.value = 0
  // Si no quedan más subidas de nivel, liberar la cola para la escena de cosmético.
  if (notificationsState.levelUpQueue.length === 0) setLevelUpActive(false)
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
</script>

<template>
  <Teleport to="body">
    <Transition name="overlay-fade">
      <div v-if="current" class="fixed inset-0 z-[60] grid place-items-center p-4" @click.self="stage === 'rank' ? null : dismiss()">
        <div class="absolute inset-0 bg-black/85 backdrop-blur-md"></div>

        <!-- ═══════════ ACTO 1 · ASCENSO DE RANGO ═══════════ -->
        <div v-if="stage === 'rank'" class="relative flex flex-col items-center text-center max-w-md w-full">
          <div class="font-display text-xs font-bold uppercase tracking-[0.2em] text-fuchsia-300 mb-8 transition-opacity duration-500"
            :class="rp >= 1 ? 'opacity-100' : 'opacity-0'"
            :style="rp >= 1 ? 'animation: tracking-reveal 0.6s var(--ease-out-expo) both' : ''">
            ¡Ascendiste de rango!
          </div>

          <div class="flex items-center justify-center gap-5">
            <!-- Escudo viejo: se agita y se va -->
            <div class="flex flex-col items-center transition-all duration-500"
              :class="[rp >= 1 ? 'opacity-40' : 'opacity-0', rp >= 2 && rp < 3 ? 'shake' : '']">
              <img v-if="oldTier?.image" :src="oldTier.image" class="w-16 h-16 object-contain grayscale" :alt="oldTier.label" />
              <span class="text-xs text-slate-500 mt-1">{{ oldTier?.label }}</span>
            </div>

            <svg class="w-7 h-7 text-fuchsia-400/70 shrink-0 transition-opacity duration-300" :class="rp >= 2 ? 'opacity-100' : 'opacity-0'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>

            <!-- Escudo nuevo: cae encima, reluciente -->
            <div class="relative flex flex-col items-center"
              :style="rp >= 3 ? 'animation: scale-spring 0.6s var(--ease-bounce) both' : 'opacity:0'">
              <div v-if="rp >= 3" class="pointer-events-none absolute -inset-4 rounded-full bg-fuchsia-400/30 blur-2xl" style="animation: evolution-flash 0.7s ease both"></div>
              <img v-if="newTier?.image" :src="newTier.image" class="relative w-28 h-28 object-contain drop-shadow-[0_0_22px_rgba(232,121,249,0.55)]" :alt="newTier.label" />
              <span class="relative text-xl font-display font-extrabold mt-2" :class="newTierColor">{{ newTier?.label }}</span>
            </div>
          </div>

          <p class="text-sm text-slate-300 mt-8 max-w-xs transition-opacity duration-500" :class="rp >= 3 ? 'opacity-100' : 'opacity-0'">
            Subiste al rango <span class="font-bold" :class="newTierColor">{{ newTier?.label }}</span>. ¡Felicitaciones, crack!
          </p>

          <button
            v-if="rp >= 3"
            @click="goToLevel"
            class="mt-7 rounded-2xl px-8 py-3 font-display font-bold text-white hover:brightness-110 active:scale-95 transition-all shadow-lg border border-fuchsia-400/30 bg-fuchsia-500/15 backdrop-blur"
            style="animation: scale-spring 0.4s var(--ease-bounce) both"
          >
            Continuar
          </button>
        </div>

        <!-- ═══════════ ACTO 2 · NIVEL + DESBLOQUEOS ═══════════ -->
        <div v-else class="relative flex flex-col items-center text-center max-w-md w-full">
          <!-- Level morph -->
          <div class="mb-4 transition-all duration-500" :class="lp >= 1 ? 'opacity-100' : 'opacity-0'">
            <div class="font-display text-xs font-bold uppercase tracking-wider mb-4"
              :class="isMilestone ? 'text-fuchsia-400' : 'text-yellow-400'"
              :style="lp >= 1 ? 'animation: tracking-reveal 0.6s var(--ease-out-expo) both' : ''">
              {{ isMilestone ? '¡Hito Alcanzado!' : '¡Subiste de Nivel!' }}
            </div>
            <div class="flex items-center justify-center gap-4">
              <span class="text-5xl font-display font-extrabold text-slate-500 line-through decoration-2">{{ current.oldLevel }}</span>
              <svg class="w-8 h-8 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              <span class="text-7xl font-display font-extrabold text-yellow-400"
                :style="lp >= 1 ? 'animation: level-morph 0.6s var(--ease-bounce) both' : ''">{{ current.newLevel }}</span>
            </div>
          </div>

          <!-- XP bonus badge -->
          <div class="mb-5 transition-all duration-500" :class="lp >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'">
            <div class="inline-flex items-center gap-2 rounded-full px-4 py-1.5 font-display font-bold text-sm"
              :class="isMilestone
                ? 'bg-gradient-to-r from-fuchsia-500/20 to-amber-500/20 border border-fuchsia-500/30 text-fuchsia-300'
                : 'bg-emerald-500/15 border border-emerald-500/25 text-emerald-400'">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
              <span>+{{ current.xpBonus }} XP</span>
            </div>
          </div>

          <!-- Desbloqueaste (cosméticos/juegos RENDERIZADOS) -->
          <div v-if="lp >= 2 && unlockItems.length" class="mb-4 w-full">
            <p class="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold mb-2">Desbloqueaste</p>
            <div class="grid gap-2" :class="unlockItems.length === 1 ? 'grid-cols-1' : 'grid-cols-2'">
              <div
                v-for="(r, ri) in unlockItems"
                :key="'u' + ri"
                class="flex flex-col items-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-3"
                :style="`animation: slide-up 0.35s ease ${0.08 * ri}s both`"
              >
                <div class="h-12 grid place-items-center">
                  <PassCosmetic v-if="isCos(r.kind)" :cos="cosObj(r)" :size="46" />
                  <img v-else-if="r.kind === 'game'" :src="`/games/${r.slug}.svg`" class="w-11 h-11 object-contain" alt="" />
                  <img v-else-if="r.kind === 'tier'" :src="r.image" class="w-12 h-12 object-contain drop-shadow-[0_0_10px_rgba(251,191,36,0.4)]" alt="" />
                  <span v-else class="text-2xl">🎁</span>
                </div>
                <div class="text-[9px] uppercase tracking-wider text-emerald-400/80 font-semibold">{{ typeLabelOf(r) }}</div>
                <div class="text-xs font-bold text-white leading-tight">{{ r.name || r.label }}</div>
              </div>
            </div>
          </div>

          <!-- Lo que viene (visual, motiva a seguir) -->
          <div v-if="lp >= 2 && upcoming.length" class="mb-5 w-full">
            <p class="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Lo que viene — seguí jugando</p>
            <div class="flex flex-wrap items-start justify-center gap-3">
              <div
                v-for="(r, ri) in upcoming"
                :key="'up' + ri"
                class="flex flex-col items-center gap-1 w-16"
                :style="`animation: slide-up 0.35s ease ${0.25 + 0.08 * ri}s both`"
              >
                <div class="relative">
                  <div class="opacity-70">
                    <PassCosmetic v-if="isCos(r.kind)" :cos="cosObj(r)" :size="40" />
                    <img v-else-if="r.kind === 'game'" :src="`/games/${r.slug}.svg`" class="w-10 h-10 object-contain" alt="" />
                    <img v-else-if="r.kind === 'tier'" :src="r.image" class="w-10 h-10 object-contain" alt="" />
                    <span v-else class="text-xl">🎁</span>
                  </div>
                  <div class="absolute -bottom-1 -right-1 grid place-items-center w-4 h-4 rounded-full bg-slate-800 ring-1 ring-white/10">
                    <svg class="w-2.5 h-2.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75M6.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"/></svg>
                  </div>
                </div>
                <div class="text-[9px] font-bold text-slate-500">Niv {{ r.level }}</div>
              </div>
            </div>
          </div>

          <!-- Dismiss -->
          <div class="transition-all duration-400" :class="lp >= 3 ? 'opacity-100' : 'opacity-0'">
            <button
              @click="dismiss"
              class="rounded-2xl px-8 py-3 font-display font-bold text-white hover:brightness-110 active:scale-95 transition-all shadow-lg border border-white/20 bg-white/10 backdrop-blur"
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

@keyframes slide-up {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
