<script setup>
import { computed, ref } from 'vue'
import { getTierForLevel, getNextTier } from '../../services/tiers'
import { computeLevelProgress } from '../../services/xp'
import { frameStyle, iconBgStyle, rarity } from '../../services/cosmetics'
import CosmeticIcon from '../rewards/CosmeticIcon.vue'
import LevelProgressionModal from './LevelProgressionModal.vue'
import countryNames from '../../codeCOUNTRYS.json'

const props = defineProps({
  avatarInitial: { type: String, default: '?' },
  avatarUrl: { type: String, default: '' },
  displayName: { type: String, default: '' },
  titleText: { type: String, default: '' },
  titleRarity: { type: String, default: 'common' },
  titlePremium: { type: Boolean, default: false },
  nationalityCode: { type: String, default: '' },
  frameStyleKey: { type: String, default: 'none' },
  iconGlyph: { type: String, default: '' },
  iconBgKey: { type: String, default: 'emerald' },
  framePremium: { type: Boolean, default: false },
  levelInfo: { type: Object, default: null },
  progressPercent: { type: Number, default: 0 },
  xpNow: { type: Number, default: 0 },
  achievementsCount: { type: Number, default: 0 },
  topRank: { type: Number, default: null },
  bio: { type: String, default: '' },
  canEdit: { type: Boolean, default: false },
})

const level = computed(() => Number(props.levelInfo?.level) || 1)
const currentTier = computed(() => getTierForLevel(level.value))
const nextTier = computed(() => getNextTier(level.value))
const levelsToNextTier = computed(() => nextTier.value ? Math.max(0, (nextTier.value.minLevel || 0) - level.value) : 0)
// Progreso DENTRO del rango (de escudo actual a escudo siguiente) — para la barra estilo Trailhead.
const tierProgress = computed(() => {
  const t = currentTier.value, n = nextTier.value
  if (!t || !n) return 100
  const span = (n.minLevel || 0) - (t.minLevel || 0)
  if (span <= 0) return 100
  return Math.min(100, Math.max(0, Math.round(((level.value - (t.minLevel || 0)) / span) * 100)))
})
// Progreso al próximo NIVEL (XP), como el dropdown del navbar.
const levelProgress = computed(() => computeLevelProgress(props.levelInfo))
const countryName = computed(() => {
  const code = (props.nationalityCode || '').toString().toLowerCase()
  return code ? (countryNames[code] || '') : ''
})

const ACCENT = {
  emerald: 'text-emerald-400', amber: 'text-amber-400', orange: 'text-orange-400',
  red: 'text-red-400', sky: 'text-sky-400', violet: 'text-violet-400',
}
const accentText = computed(() => ACCENT[currentTier.value?.color] || 'text-emerald-400')

// Popup con la progresión completa de rangos/niveles + insignias.
const showProgression = ref(false)
</script>

<template>
  <div class="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-800/60 backdrop-blur shadow-2xl px-5 pb-5">
    <!-- Avatar (solapa el banner) -->
    <div class="flex flex-col items-center -mt-8">
      <div :class="[frameStyle(frameStyleKey).wrap, frameStyle(frameStyleKey).pad, 'rounded-2xl', framePremium ? 'anim-pan' : '']">
        <div class="size-24 overflow-hidden grid place-items-center text-white font-extrabold text-3xl"
             :class="[iconBgStyle(iconBgKey), frameStyleKey && frameStyleKey !== 'none' ? 'rounded-[14px]' : 'rounded-2xl ring-4 ring-slate-900']">
          <CosmeticIcon v-if="iconGlyph" :iconKey="iconGlyph" :size="64" />
          <img v-else-if="avatarUrl" :src="avatarUrl" alt="" class="w-full h-full object-cover" />
          <span v-else>{{ avatarInitial }}</span>
        </div>
      </div>
      <h2 class="mt-3 text-xl font-bold text-white text-center leading-tight flex items-center gap-2">
        {{ displayName }}
        <img v-if="nationalityCode" :src="`https://flagcdn.com/w20/${nationalityCode}.png`" width="20" height="14" class="rounded ring-1 ring-white/10" :alt="countryName" />
      </h2>
      <p v-if="titleText" class="text-sm font-bold mt-0.5" :class="titlePremium ? 'title-premium-anim' : rarity(titleRarity).text">{{ titleText }}</p>
    </div>

    <!-- NIVEL grande + mini-dashboard (XP / Logros / Ranking) -->
    <div class="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div class="flex items-center gap-4">
        <div class="text-center shrink-0">
          <div class="font-display font-extrabold text-[2.6rem] leading-none" :class="accentText">{{ level }}</div>
          <div class="text-[10px] uppercase tracking-wider text-slate-500 mt-1">Nivel</div>
        </div>
        <div class="flex-1 grid grid-cols-2 gap-2">
          <div class="rounded-lg bg-white/[0.04] py-2 text-center">
            <div class="text-base font-bold text-white tabular-nums leading-none">{{ xpNow.toLocaleString() }}</div>
            <div class="text-[9px] uppercase tracking-wider text-slate-500 mt-1">XP total</div>
          </div>
          <div class="rounded-lg bg-white/[0.04] py-2 text-center">
            <div class="text-base font-bold text-white leading-none">{{ achievementsCount }}</div>
            <div class="text-[9px] uppercase tracking-wider text-slate-500 mt-1">Logros</div>
          </div>
        </div>
      </div>
      <!-- Progreso al próximo nivel (XP) -->
      <div v-if="level < 50" class="mt-3">
        <div class="flex items-center justify-between text-[10px] text-slate-400 mb-1">
          <span>Progreso al nivel {{ level + 1 }}</span>
          <span class="text-slate-300 font-medium tabular-nums">{{ levelProgress.earned }}/{{ levelProgress.range }} XP</span>
        </div>
        <div class="h-2 rounded-full bg-black/40 overflow-hidden ring-1 ring-white/5">
          <div class="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400 transition-all duration-700" :style="{ width: progressPercent + '%' }"></div>
        </div>
      </div>
      <router-link v-if="topRank" to="/leaderboards" class="mt-3 flex items-center justify-between rounded-lg bg-amber-500/[0.08] border border-amber-500/25 px-3 py-2 hover:bg-amber-500/[0.14] transition">
        <span class="inline-flex items-center gap-1.5 text-xs text-slate-300">
          <svg class="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 24 24"><path d="M5 3h14l-1.5 5H20a1 1 0 011 1v1a5 5 0 01-3.5 4.77V16a1 1 0 01-1 1h-1.1l.6 3H8l.6-3H7.5a1 1 0 01-1-1v-1.23A5 5 0 013 10V9a1 1 0 011-1h2.5L5 3z"/></svg>
          Ranking global
        </span>
        <span class="font-display font-extrabold text-amber-300">#{{ topRank }}</span>
      </router-link>
    </div>

    <!-- Rango: escudo actual ——barra—— escudo siguiente (Trailhead). Clickeable → popup de rangos. -->
    <button type="button" @click="showProgression = true"
      class="mt-3 w-full text-left rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20 transition p-4 group">
      <div class="flex items-center gap-2.5">
        <div class="flex flex-col items-center shrink-0 w-[58px]">
          <img v-if="currentTier?.image" :src="currentTier.image" :alt="currentTier.label" class="w-14 h-14 object-contain drop-shadow-lg" />
          <span class="text-[10px] font-bold mt-1 text-center leading-tight" :class="accentText">{{ currentTier?.label }}</span>
        </div>
        <div class="flex-1 self-start pt-4">
          <div class="h-3 rounded-full bg-black/40 overflow-hidden ring-1 ring-white/5">
            <div class="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400 transition-all duration-700" :style="{ width: (level >= 50 ? 100 : tierProgress) + '%' }"></div>
          </div>
          <p class="mt-2 text-[10px] text-center text-slate-400 leading-snug">
            <template v-if="level >= 50">¡Rango máximo! 👑</template>
            <template v-else>Faltan <span class="font-bold text-white">{{ levelsToNextTier }}</span> {{ levelsToNextTier === 1 ? 'nivel' : 'niveles' }}</template>
          </p>
        </div>
        <div v-if="nextTier" class="flex flex-col items-center shrink-0 w-[58px]">
          <img v-if="nextTier?.image" :src="nextTier.image" :alt="nextTier.label" class="w-14 h-14 object-contain opacity-45 grayscale" />
          <span class="text-[10px] font-semibold mt-1 text-center leading-tight text-slate-400">{{ nextTier.label }}</span>
        </div>
      </div>
      <div class="mt-2.5 pt-2.5 border-t border-white/5 flex items-center justify-center gap-1.5 text-[10px] font-semibold text-slate-500 group-hover:text-emerald-300 transition">
        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>
        Ver todos los rangos
      </div>
    </button>

    <!-- Bio -->
    <p v-if="bio" class="mt-3 text-sm text-slate-300 leading-relaxed whitespace-pre-line">{{ bio }}</p>

    <router-link v-if="canEdit" to="/profile-edit" class="mt-3 block w-full text-center rounded-xl border border-white/15 hover:bg-white/5 text-slate-200 py-2 text-sm font-semibold transition">
      Editar perfil
    </router-link>

    <Teleport to="body">
      <LevelProgressionModal v-if="showProgression" :current-level="level" @close="showProgression = false" />
    </Teleport>
  </div>
</template>
