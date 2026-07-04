<script setup>
import { computed, onMounted, onUnmounted, ref, nextTick } from 'vue'
import { TIERS, TIER_UNLOCKS, getTierForLevel, tierAccentText } from '../../services/tiers'
import { frameStyle, bannerStyle, iconThemeBg } from '../../services/cosmetics'
import { MILESTONES } from '../../services/level-rewards'
import CosmeticIcon from '../rewards/CosmeticIcon.vue'

const props = defineProps({
  currentLevel: { type: Number, default: 1 },
})
const emit = defineEmits(['close'])

const scrollContainer = ref(null)

// XP acumulada para llegar a cada nivel (para "Se alcanza a los X XP").
const XP_TABLE = [
  0, 100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700,
  3300, 4000, 4800, 5700, 6700, 7800, 9000, 10300, 11700, 13200,
  14850, 16650, 18600, 20700, 22950, 25350, 27900, 30600, 33450, 36450,
  39600, 42900, 46350, 49950, 53700, 57600, 61650, 65850, 70200, 74700,
  79400, 84300, 89400, 94700, 100200, 105900, 111800, 117900, 124200, 130700,
]

onMounted(() => {
  document.body.style.overflow = 'hidden'
  nextTick(() => {
    const el = scrollContainer.value?.querySelector('[data-current]')
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  })
})
onUnmounted(() => { document.body.style.overflow = '' })

function onKeyDown(e) { if (e.key === 'Escape') emit('close') }
onMounted(() => document.addEventListener('keydown', onKeyDown))
onUnmounted(() => document.removeEventListener('keydown', onKeyDown))

// Color de tint del card por rango (borde + fondo suave), coherente con el escudo.
const TIER_TINT = {
  bronze:   { card: 'from-amber-900/30 to-amber-950/50',   border: 'border-amber-600/30' },
  silver:   { card: 'from-slate-700/30 to-slate-900/50',   border: 'border-slate-400/30' },
  gold:     { card: 'from-yellow-900/30 to-amber-950/50',  border: 'border-yellow-500/30' },
  emerald:  { card: 'from-emerald-900/30 to-emerald-950/50', border: 'border-emerald-500/30' },
  cyan:     { card: 'from-cyan-900/30 to-cyan-950/50',     border: 'border-cyan-500/30' },
  champion: { card: 'from-teal-900/30 to-slate-950/60',    border: 'border-amber-400/35' },
}
function tint(c) { return TIER_TINT[c] || TIER_TINT.emerald }

const sections = computed(() => TIERS.map(tier => {
  const unlocks = TIER_UNLOCKS[tier.key] || {}
  const milestone = MILESTONES.find(m => m.level === tier.minLevel)
  return {
    tier,
    unlocks,
    accent: tierAccentText(tier.color),
    tint: tint(tier.color),
    reachXp: XP_TABLE[tier.minLevel - 1] ?? 0,
    milestone,
    reached: props.currentLevel >= tier.minLevel,
    current: getTierForLevel(props.currentLevel)?.key === tier.key,
  }
}))

function fmtXp(n) { return n >= 1000 ? (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + 'K' : String(n) }
</script>

<template>
  <Teleport to="body">
    <Transition name="prog-overlay">
      <div class="fixed inset-0 z-[90] flex items-start justify-center bg-black/80 backdrop-blur-lg px-4 pt-4 pb-4 overflow-y-auto">
        <div class="prog-card w-full max-w-lg rounded-2xl border border-white/15 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden shadow-2xl shadow-black/50 flex flex-col max-h-[90vh]">

          <!-- Header -->
          <div class="shrink-0 p-5 text-center border-b border-white/10 bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 relative">
            <h2 class="font-display text-xl font-extrabold text-white">Rangos y recompensas</h2>
            <p class="text-slate-400 text-xs mt-1">Lo que desbloqueás al llegar a cada rango</p>
            <button @click="emit('close')" class="absolute top-3 right-3 h-8 w-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 grid place-items-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4 text-slate-300"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>
            </button>
          </div>

          <!-- Scrollable content -->
          <div ref="scrollContainer" class="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth">
            <div
              v-for="(s, si) in sections"
              :key="s.tier.key"
              :data-current="s.current ? '' : undefined"
              class="rounded-xl border overflow-hidden bg-gradient-to-br"
              :class="[s.tint.border, s.tint.card, s.reached ? '' : 'opacity-60']"
            >
              <!-- Cabecera del rango -->
              <div class="flex items-center gap-3 px-4 py-3">
                <img :src="s.tier.image" :alt="s.tier.label" class="w-14 h-14 object-contain drop-shadow-lg shrink-0" :class="s.reached ? '' : 'grayscale'" />
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <p class="font-display font-extrabold text-base" :class="s.accent">{{ s.tier.label }}</p>
                    <span v-if="s.current" class="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-white/10 border border-white/15 text-white">Actual</span>
                  </div>
                  <p class="text-[11px] text-slate-400">
                    Niveles {{ s.tier.minLevel }}<template v-if="s.tier.maxLevel !== s.tier.minLevel">–{{ s.tier.maxLevel }}</template>
                    <span class="text-slate-600"> · </span>{{ fmtXp(s.reachXp) }} XP
                  </p>
                </div>
                <span v-if="s.reached" class="shrink-0 grid place-items-center size-6 rounded-full bg-emerald-500/20 border border-emerald-400/40">
                  <svg class="w-3.5 h-3.5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>
                </span>
                <span v-else class="shrink-0 grid place-items-center size-6 rounded-full bg-slate-800/60 border border-white/10">
                  <svg class="w-3 h-3 text-slate-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd" /></svg>
                </span>
              </div>

              <!-- Desbloqueables -->
              <div class="px-4 pb-3">
                <div class="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">Desbloqueás</div>
                <div class="grid grid-cols-4 gap-2">
                  <!-- Escudo -->
                  <div class="flex flex-col items-center gap-1 rounded-lg bg-black/25 border border-white/5 py-2">
                    <img :src="s.tier.image" :alt="s.tier.label" class="w-9 h-9 object-contain" />
                    <span class="text-[9px] text-slate-400">Escudo</span>
                  </div>
                  <!-- Ícono -->
                  <div class="flex flex-col items-center gap-1 rounded-lg bg-black/25 border border-white/5 py-2">
                    <div class="size-9 rounded-lg overflow-hidden grid place-items-center" :class="iconThemeBg(s.unlocks.icon)">
                      <CosmeticIcon :iconKey="s.unlocks.icon" :size="30" />
                    </div>
                    <span class="text-[9px] text-slate-400">Ícono</span>
                  </div>
                  <!-- Borde -->
                  <div class="flex flex-col items-center gap-1 rounded-lg bg-black/25 border border-white/5 py-2">
                    <div class="size-9 rounded-lg" :class="[frameStyle(s.unlocks.frame).wrap, frameStyle(s.unlocks.frame).pad]">
                      <div class="w-full h-full rounded-md bg-gradient-to-br from-slate-600 to-slate-800"></div>
                    </div>
                    <span class="text-[9px] text-slate-400">Borde</span>
                  </div>
                  <!-- Banner -->
                  <div class="flex flex-col items-center gap-1 rounded-lg bg-black/25 border border-white/5 py-2">
                    <div class="w-9 h-9 rounded-lg border border-white/10" :class="bannerStyle(s.unlocks.banner)"></div>
                    <span class="text-[9px] text-slate-400">Banner</span>
                  </div>
                </div>

                <!-- Bonus de hito (si el rango arranca en un milestone) -->
                <div v-if="s.milestone" class="mt-2 flex items-center justify-center gap-1.5 text-[11px] font-semibold" :class="s.accent">
                  <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                  +{{ s.milestone.xpBonus }} XP de bono al ascender
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="shrink-0 p-4 border-t border-white/10">
            <button @click="emit('close')" class="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110 text-white py-3 font-bold transition text-center shadow-lg shadow-emerald-500/25">Cerrar</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.prog-overlay-enter-active { transition: opacity 0.3s ease; }
.prog-overlay-leave-active { transition: opacity 0.2s ease; }
.prog-overlay-enter-from, .prog-overlay-leave-to { opacity: 0; }
.prog-card { animation: prog-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); }
@keyframes prog-pop {
  from { opacity: 0; transform: scale(0.92) translateY(12px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
</style>
