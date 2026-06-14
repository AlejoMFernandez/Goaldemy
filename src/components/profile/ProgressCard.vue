<script setup>
import { computed, ref } from 'vue'
import { getTierForLevel, getNextTier } from '../../services/tiers'
import LevelProgressionModal from './LevelProgressionModal.vue'

const props = defineProps({
  levelInfo: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  xpNow: { type: Number, default: 0 },
  progressPercent: { type: Number, default: 0 },
  achievementsCount: { type: Number, default: 0 },
  topRank: { type: Number, default: null },
})

const showProgression = ref(false)

const level = computed(() => Number(props.levelInfo?.level) || 1)
const currentTier = computed(() => getTierForLevel(level.value))
const nextTier = computed(() => getNextTier(level.value))

const tierProgress = computed(() => {
  const t = currentTier.value
  if (!t) return 0
  const min = t.minLevel || 1
  const max = t.maxLevel || min
  const range = max - min + 1
  if (range <= 1) return 100
  return Math.round(((level.value - min) / (range - 1)) * 100)
})

const tierColorMap = {
  emerald: { border: 'border-emerald-500/50', bg: 'from-emerald-500/20 to-cyan-500/20', text: 'text-emerald-200', bar: 'from-emerald-400 to-cyan-400', glow: 'shadow-emerald-500/20' },
  amber: { border: 'border-amber-500/50', bg: 'from-amber-500/20 to-yellow-500/20', text: 'text-amber-200', bar: 'from-amber-400 to-yellow-400', glow: 'shadow-amber-500/20' },
  orange: { border: 'border-orange-500/50', bg: 'from-orange-500/20 to-amber-500/20', text: 'text-orange-200', bar: 'from-orange-400 to-amber-400', glow: 'shadow-orange-500/20' },
  red: { border: 'border-red-500/50', bg: 'from-red-500/20 to-orange-500/20', text: 'text-red-200', bar: 'from-red-400 to-orange-400', glow: 'shadow-red-500/20' },
  sky: { border: 'border-sky-500/50', bg: 'from-sky-500/20 to-blue-500/20', text: 'text-sky-200', bar: 'from-sky-400 to-blue-400', glow: 'shadow-sky-500/20' },
  blue: { border: 'border-blue-500/50', bg: 'from-blue-500/20 to-indigo-500/20', text: 'text-blue-200', bar: 'from-blue-400 to-indigo-400', glow: 'shadow-blue-500/20' },
  violet: { border: 'border-violet-500/50', bg: 'from-violet-500/20 to-purple-500/20', text: 'text-violet-200', bar: 'from-violet-400 to-purple-400', glow: 'shadow-violet-500/20' },
  fuchsia: { border: 'border-fuchsia-500/50', bg: 'from-fuchsia-500/20 to-pink-500/20', text: 'text-fuchsia-200', bar: 'from-fuchsia-400 to-pink-400', glow: 'shadow-fuchsia-500/20' },
  rose: { border: 'border-rose-500/50', bg: 'from-rose-500/20 to-pink-500/20', text: 'text-rose-200', bar: 'from-rose-400 to-pink-400', glow: 'shadow-rose-500/20' },
  yellow: { border: 'border-yellow-500/50', bg: 'from-yellow-500/20 to-amber-500/20', text: 'text-yellow-200', bar: 'from-yellow-400 to-amber-400', glow: 'shadow-yellow-500/20' },
}

const colors = computed(() => tierColorMap[currentTier.value?.color] || tierColorMap.emerald)
</script>

<template>
  <div class="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/50 backdrop-blur p-6 shadow-xl relative">
    <!-- Info button -->
    <button
      @click="showProgression = true"
      class="absolute top-3 right-3 h-8 w-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 grid place-items-center transition-colors"
      title="Ver todos los niveles"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4 text-slate-300">
        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clip-rule="evenodd" />
      </svg>
    </button>

    <div v-if="loading" class="text-center py-8 text-slate-400">
      <div class="animate-pulse">Cargando progreso...</div>
    </div>
    <div v-else>
      <!-- Tier badge + Level -->
      <div class="flex items-center gap-4 mb-5">
        <div class="shrink-0 relative">
          <img
            v-if="currentTier?.image"
            :src="currentTier.image"
            :alt="currentTier.label"
            class="w-16 h-16 object-contain drop-shadow-lg"
          />
          <div v-else class="w-16 h-16 rounded-full bg-slate-700/50 grid place-items-center text-3xl">
            {{ currentTier?.emoji || '🎯' }}
          </div>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span
              v-if="levelInfo"
              :class="[
                'inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-bold border shadow-lg',
                colors.border, 'bg-gradient-to-r', colors.bg, colors.text
              ]"
            >
              Nivel {{ levelInfo.level }}
            </span>
            <!-- TOP badge -->
            <span v-if="topRank === 1" class="inline-flex items-center rounded-lg px-3 py-1.5 text-sm border border-amber-400/50 bg-gradient-to-r from-amber-500/30 to-yellow-500/30 text-amber-100 font-bold shadow-lg shadow-amber-500/20">
              🥇 TOP 1
            </span>
            <span v-else-if="topRank === 2" class="inline-flex items-center rounded-lg px-3 py-1.5 text-sm border border-slate-400/50 bg-gradient-to-r from-slate-500/30 to-slate-400/30 text-slate-100 font-bold shadow-lg">
              🥈 TOP 2
            </span>
            <span v-else-if="topRank === 3" class="inline-flex items-center rounded-lg px-3 py-1.5 text-sm border border-orange-400/50 bg-gradient-to-r from-orange-600/30 to-amber-600/30 text-orange-100 font-bold shadow-lg">
              🥉 TOP 3
            </span>
          </div>
          <p class="mt-1 text-sm font-semibold" :class="colors.text">
            {{ currentTier?.emoji }} {{ currentTier?.label || 'Rango' }}
          </p>
        </div>
      </div>

      <!-- Tier progress bar -->
      <div v-if="currentTier && nextTier" class="rounded-xl border border-white/10 bg-slate-800/30 p-4 mb-4">
        <div class="flex items-center justify-between text-[10px] uppercase tracking-wider text-slate-400 mb-2">
          <span>{{ currentTier.emoji }} {{ currentTier.label }}</span>
          <span>{{ nextTier.emoji }} {{ nextTier.label }}</span>
        </div>
        <div class="h-2.5 w-full rounded-full bg-slate-900/50 overflow-hidden shadow-inner border border-white/5">
          <div
            class="h-full rounded-full bg-gradient-to-r transition-all duration-700 shadow-lg"
            :class="[colors.bar, colors.glow]"
            :style="{ width: tierProgress + '%' }"
          ></div>
        </div>
        <p class="mt-1.5 text-[11px] text-slate-400 text-center">
          Nivel {{ level }} de {{ currentTier.maxLevel || level }} en este rango
        </p>
      </div>
      <div v-else-if="currentTier && !nextTier" class="rounded-xl border border-white/10 bg-slate-800/30 p-4 mb-4 text-center">
        <p class="text-sm font-bold" :class="colors.text">{{ currentTier.emoji }} Rango máximo alcanzado</p>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-2 gap-3 mb-5">
        <div class="rounded-xl border border-white/10 bg-gradient-to-br from-slate-800/60 to-slate-700/40 p-4 hover:border-emerald-500/30 transition-all">
          <p class="text-[10px] uppercase tracking-wider text-slate-400 mb-1">XP Total</p>
          <p class="text-white text-2xl font-bold">{{ xpNow.toLocaleString() }}</p>
        </div>
        <div class="rounded-xl border border-white/10 bg-gradient-to-br from-slate-800/60 to-slate-700/40 p-4 hover:border-emerald-500/30 transition-all">
          <p class="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Logros</p>
          <p class="text-white text-2xl font-bold">{{ achievementsCount }}</p>
        </div>
      </div>

      <!-- XP progress to next level -->
      <div class="rounded-xl border border-white/10 bg-slate-800/30 p-4">
        <div class="flex items-center justify-between text-[10px] uppercase tracking-wider text-slate-400 mb-2">
          <span>Progreso al próximo nivel</span>
          <span class="text-slate-300 normal-case tracking-normal">{{ progressPercent }}%</span>
        </div>
        <div class="h-3 w-full rounded-full bg-slate-900/50 overflow-hidden shadow-inner border border-white/5">
          <div class="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400 transition-all duration-700 shadow-lg" :style="{ width: progressPercent + '%' }"></div>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <LevelProgressionModal
        v-if="showProgression"
        :current-level="level"
        @close="showProgression = false"
      />
    </Teleport>
  </div>
</template>
