<script setup>
import { computed, onMounted, onUnmounted, ref, nextTick } from 'vue'
import { TIERS } from '../../services/tiers'
import { MILESTONES, getLevelUpXpBonus } from '../../services/level-rewards'

const props = defineProps({
  currentLevel: { type: Number, default: 1 },
})
const emit = defineEmits(['close'])

const scrollContainer = ref(null)

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

const colorMap = {
  emerald: { card: 'from-emerald-900/40 to-emerald-950/60', border: 'border-emerald-500/25', accent: 'text-emerald-400', accentBg: 'bg-emerald-500/15', dot: 'bg-emerald-400', ring: 'ring-emerald-400/50', glow: 'shadow-emerald-500/20', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  amber: { card: 'from-amber-900/40 to-amber-950/60', border: 'border-amber-500/25', accent: 'text-amber-400', accentBg: 'bg-amber-500/15', dot: 'bg-amber-400', ring: 'ring-amber-400/50', glow: 'shadow-amber-500/20', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  orange: { card: 'from-orange-900/40 to-orange-950/60', border: 'border-orange-500/25', accent: 'text-orange-400', accentBg: 'bg-orange-500/15', dot: 'bg-orange-400', ring: 'ring-orange-400/50', glow: 'shadow-orange-500/20', badge: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  red: { card: 'from-red-900/40 to-red-950/60', border: 'border-red-500/25', accent: 'text-red-400', accentBg: 'bg-red-500/15', dot: 'bg-red-400', ring: 'ring-red-400/50', glow: 'shadow-red-500/20', badge: 'bg-red-500/20 text-red-300 border-red-500/30' },
  sky: { card: 'from-sky-900/40 to-sky-950/60', border: 'border-sky-500/25', accent: 'text-sky-400', accentBg: 'bg-sky-500/15', dot: 'bg-sky-400', ring: 'ring-sky-400/50', glow: 'shadow-sky-500/20', badge: 'bg-sky-500/20 text-sky-300 border-sky-500/30' },
  violet: { card: 'from-violet-900/40 to-violet-950/60', border: 'border-violet-500/25', accent: 'text-violet-400', accentBg: 'bg-violet-500/15', dot: 'bg-violet-400', ring: 'ring-violet-400/50', glow: 'shadow-violet-500/20', badge: 'bg-violet-500/20 text-violet-300 border-violet-500/30' },
}

const sections = computed(() => {
  return TIERS.filter(t => t.maxLevel).map(tier => {
    const c = colorMap[tier.color] || colorMap.emerald
    const levels = []
    for (let lvl = tier.minLevel; lvl <= tier.maxLevel; lvl++) {
      const xp = XP_TABLE[lvl - 1] ?? 0
      const milestone = MILESTONES.find(m => m.level === lvl)
      levels.push({
        level: lvl,
        xp,
        bonus: getLevelUpXpBonus(lvl),
        milestone,
        reached: lvl <= props.currentLevel,
        current: lvl === props.currentLevel,
      })
    }
    const tierReached = props.currentLevel >= tier.minLevel
    return { tier, levels, colors: c, tierReached }
  })
})

function fmtXp(n) { return n >= 1000 ? (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + 'K' : String(n) }
</script>

<template>
  <Teleport to="body">
    <Transition name="prog-overlay">
      <div class="fixed inset-0 z-[90] flex items-start justify-center bg-black/80 backdrop-blur-lg px-4 pt-4 pb-4 overflow-y-auto">
        <div class="prog-card w-full max-w-lg rounded-2xl border border-white/15 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden shadow-2xl shadow-black/50 flex flex-col max-h-[90vh]">

          <!-- Header -->
          <div class="shrink-0 p-5 text-center border-b border-white/10 bg-gradient-to-br from-indigo-500/10 to-cyan-500/10 relative">
            <div class="mb-2 flex justify-center">
              <div class="w-14 h-14 rounded-full bg-indigo-500/15 border-2 border-indigo-400/40 grid place-items-center">
                <svg class="w-7 h-7 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                </svg>
              </div>
            </div>
            <h2 class="font-display text-xl font-extrabold text-white">Progresion de Niveles</h2>
            <p class="text-slate-400 text-xs mt-1">Todos los rangos, niveles y recompensas</p>
            <button @click="emit('close')" class="absolute top-3 right-3 h-8 w-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 grid place-items-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4 text-slate-300">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          </div>

          <!-- Scrollable content -->
          <div ref="scrollContainer" class="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
            <div v-for="(section, si) in sections" :key="section.tier.key">
              <!-- Tier card -->
              <div
                class="rounded-xl border overflow-hidden"
                :class="[section.colors.border, section.tierReached ? '' : 'opacity-50']"
              >
                <!-- Tier header -->
                <div
                  class="flex items-center gap-3 px-4 py-3 bg-gradient-to-r"
                  :class="section.colors.card"
                >
                  <img
                    :src="section.tier.image"
                    :alt="section.tier.label"
                    class="w-12 h-12 object-contain drop-shadow-lg"
                  />
                  <div class="flex-1 min-w-0">
                    <p class="font-display font-bold text-sm text-white">
                      {{ section.tier.label }}
                    </p>
                    <p class="text-[10px] text-slate-400">
                      Niveles {{ section.tier.minLevel }}–{{ section.tier.maxLevel }}
                    </p>
                  </div>
                  <div v-if="section.levels.some(l => l.milestone)" class="shrink-0">
                    <span
                      class="text-[10px] px-2 py-1 rounded-md border font-semibold"
                      :class="section.colors.badge"
                    >
                      +{{ section.levels.find(l => l.milestone)?.milestone?.xpBonus }} XP
                    </span>
                  </div>
                </div>

                <!-- Levels grid -->
                <div class="px-3 py-3 bg-slate-950/40">
                  <div class="grid grid-cols-5 gap-1.5">
                    <div
                      v-for="row in section.levels"
                      :key="row.level"
                      :data-current="row.current ? '' : undefined"
                      class="relative flex flex-col items-center rounded-lg p-2 transition-all"
                      :class="[
                        row.current
                          ? ['ring-2', section.colors.ring, section.colors.accentBg, 'shadow-lg', section.colors.glow]
                          : row.reached
                            ? 'bg-white/5'
                            : 'bg-slate-800/30',
                        row.milestone ? 'ring-1 ring-white/10' : '',
                      ]"
                    >
                      <div
                        class="text-sm font-bold leading-none"
                        :class="row.current ? section.colors.accent : row.reached ? 'text-white' : 'text-slate-600'"
                      >
                        {{ row.level }}
                      </div>
                      <div class="text-[8px] mt-0.5" :class="row.reached ? 'text-slate-400' : 'text-slate-600'">
                        {{ fmtXp(row.xp) }}
                      </div>
                      <!-- Milestone star (SVG instead of emoji) -->
                      <div v-if="row.milestone" class="absolute -top-1 -right-1">
                        <svg class="w-3.5 h-3.5" :class="section.colors.accent" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                        </svg>
                      </div>
                      <!-- Current indicator -->
                      <div v-if="row.current" class="mt-1">
                        <div class="w-1.5 h-1.5 rounded-full animate-pulse" :class="section.colors.dot"></div>
                      </div>
                      <!-- Reached check -->
                      <div v-else-if="row.reached" class="mt-1">
                        <svg class="w-3 h-3 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                        </svg>
                      </div>
                      <!-- Lock -->
                      <div v-else class="mt-1">
                        <svg class="w-3 h-3 text-slate-700" fill="currentColor" viewBox="0 0 20 20">
                          <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <!-- Milestone reward detail -->
                  <div
                    v-for="row in section.levels.filter(l => l.milestone)"
                    :key="'ms-' + row.level"
                    class="mt-3 rounded-lg border p-3 flex items-center gap-3"
                    :class="[section.colors.border, section.colors.accentBg]"
                  >
                    <img :src="section.tier.image" :alt="section.tier.label" class="w-9 h-9 object-contain drop-shadow" />
                    <div class="flex-1 min-w-0">
                      <p class="text-xs font-bold text-white">{{ row.milestone.title }}</p>
                      <p class="text-[10px] text-slate-400">{{ row.milestone.description }}</p>
                      <div v-if="row.milestone.rewards" class="mt-1.5 flex flex-wrap gap-2">
                        <span
                          v-for="(rw, ri) in row.milestone.rewards"
                          :key="ri"
                          class="inline-flex items-center gap-1 text-[10px] font-medium rounded-md px-1.5 py-0.5 border"
                          :class="section.colors.badge"
                        >
                          <svg v-if="rw.type === 'xp'" class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                          </svg>
                          <img v-else-if="rw.type === 'tier' && rw.image" :src="rw.image" class="w-3 h-3 object-contain" alt="" />
                          {{ rw.label }}
                        </span>
                      </div>
                    </div>
                    <div class="shrink-0 text-right">
                      <span class="text-xs font-bold" :class="section.colors.accent">+{{ row.milestone.xpBonus }} XP</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Connector arrow between tiers -->
              <div v-if="si < sections.length - 1" class="flex justify-center py-1">
                <svg class="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="shrink-0 p-4 border-t border-white/10">
            <button
              @click="emit('close')"
              class="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110 text-white py-3 font-bold transition text-center shadow-lg shadow-emerald-500/25"
            >
              Cerrar
            </button>
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
