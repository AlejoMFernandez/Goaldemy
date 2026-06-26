<script setup>
import { computed } from 'vue'
import { getTierForLevel, getNextTier } from '../../services/tiers'
import { frameStyle, iconBgStyle, rarity } from '../../services/cosmetics'
import CosmeticIcon from '../rewards/CosmeticIcon.vue'
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
const countryName = computed(() => {
  const code = (props.nationalityCode || '').toString().toLowerCase()
  return code ? (countryNames[code] || '') : ''
})

const ACCENT = {
  emerald: 'text-emerald-400', amber: 'text-amber-400', orange: 'text-orange-400',
  red: 'text-red-400', sky: 'text-sky-400', violet: 'text-violet-400',
}
const accentText = computed(() => ACCENT[currentTier.value?.color] || 'text-emerald-400')
</script>

<template>
  <div class="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-800/60 backdrop-blur shadow-2xl px-5 pb-5">
    <!-- Avatar (solapa el banner de arriba) -->
    <div class="flex flex-col items-center -mt-12">
      <div class="relative">
        <div :class="[frameStyle(frameStyleKey).wrap, frameStyle(frameStyleKey).pad, 'rounded-2xl', framePremium ? 'anim-pan' : '']">
          <div class="size-24 overflow-hidden grid place-items-center text-white font-extrabold text-3xl"
               :class="[iconBgStyle(iconBgKey), frameStyleKey && frameStyleKey !== 'none' ? 'rounded-[14px]' : 'rounded-2xl ring-4 ring-slate-900']">
            <CosmeticIcon v-if="iconGlyph" :iconKey="iconGlyph" :size="64" />
            <img v-else-if="avatarUrl" :src="avatarUrl" alt="" class="w-full h-full object-cover" />
            <span v-else>{{ avatarInitial }}</span>
          </div>
        </div>
        <div class="absolute -bottom-1 -right-1 rounded-full px-2 py-0.5 text-[11px] font-extrabold bg-slate-900 border-2 shadow-lg" :class="accentText" style="border-color: currentColor">{{ level }}</div>
      </div>

      <!-- Nombre + título + bandera -->
      <h2 class="mt-3 text-xl font-bold text-white text-center leading-tight flex items-center gap-2">
        {{ displayName }}
        <img v-if="nationalityCode" :src="`https://flagcdn.com/w20/${nationalityCode}.png`" width="20" height="14" class="rounded ring-1 ring-white/10" :alt="countryName" />
      </h2>
      <p v-if="titleText" class="text-sm font-bold mt-0.5" :class="titlePremium ? 'title-premium-anim' : rarity(titleRarity).text">{{ titleText }}</p>
    </div>

    <!-- Bloque RANGO (estilo Trailhead: emblema + progreso + cuánto falta) -->
    <div class="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div class="flex items-center gap-3">
        <img v-if="currentTier?.image" :src="currentTier.image" :alt="currentTier.label" class="w-11 h-11 object-contain shrink-0" />
        <div class="min-w-0">
          <div class="font-display font-bold text-white leading-tight" :class="accentText">{{ currentTier?.label }}</div>
          <div class="text-xs text-slate-400">Nivel {{ level }}</div>
        </div>
        <img v-if="nextTier?.image" :src="nextTier.image" :alt="nextTier.label" class="w-8 h-8 object-contain ml-auto opacity-50 shrink-0" />
      </div>
      <div class="mt-3 h-2.5 rounded-full bg-black/40 overflow-hidden ring-1 ring-white/5">
        <div class="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400 transition-all duration-700" :style="{ width: (level >= 50 ? 100 : progressPercent) + '%' }"></div>
      </div>
      <p class="mt-2 text-[11px] text-slate-400 leading-snug">
        <template v-if="level >= 50">¡Rango máximo alcanzado! 👑</template>
        <template v-else-if="nextTier">Te faltan <span class="font-bold text-white">{{ levelsToNextTier }}</span> {{ levelsToNextTier === 1 ? 'nivel' : 'niveles' }} para el rango <span class="font-bold" :class="accentText">{{ nextTier.label }}</span></template>
      </p>
    </div>

    <!-- Bloque RANKING -->
    <router-link v-if="topRank" to="/leaderboards" class="mt-3 flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] hover:bg-amber-500/[0.12] transition p-3.5">
      <svg class="w-8 h-8 text-amber-400 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M5 3h14l-1.5 5H20a1 1 0 011 1v1a5 5 0 01-3.5 4.77V16a1 1 0 01-1 1h-1.1l.6 3H8l.6-3H7.5a1 1 0 01-1-1v-1.23A5 5 0 013 10V9a1 1 0 011-1h2.5L5 3z"/></svg>
      <div>
        <div class="font-display font-extrabold text-2xl text-amber-300 leading-none">#{{ topRank }}</div>
        <div class="text-[11px] text-slate-400 mt-0.5">Ranking global</div>
      </div>
      <svg class="w-4 h-4 text-slate-500 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
    </router-link>

    <!-- Mini stats -->
    <div class="mt-3 grid grid-cols-2 gap-2.5">
      <div class="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
        <div class="text-lg font-bold text-white tabular-nums">{{ xpNow.toLocaleString() }}</div>
        <div class="text-[10px] uppercase tracking-wider text-slate-500 mt-0.5">XP total</div>
      </div>
      <div class="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
        <div class="text-lg font-bold text-white">{{ achievementsCount }}</div>
        <div class="text-[10px] uppercase tracking-wider text-slate-500 mt-0.5">Logros</div>
      </div>
    </div>

    <!-- Bio -->
    <p v-if="bio" class="mt-3 text-sm text-slate-300 leading-relaxed whitespace-pre-line">{{ bio }}</p>

    <router-link v-if="canEdit" to="/profile-edit" class="mt-3 block w-full text-center rounded-xl border border-white/15 hover:bg-white/5 text-slate-200 py-2 text-sm font-semibold transition">
      Editar perfil
    </router-link>
  </div>
</template>
