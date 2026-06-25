<script setup>
import { computed, ref } from 'vue'
import { getTierForLevel, getNextTier } from '../../services/tiers'
import countryNames from '../../codeCOUNTRYS.json'
import LevelProgressionModal from './LevelProgressionModal.vue'
import { frameStyle, bannerStyle, iconBgStyle, rarity } from '../../services/cosmetics'
import CosmeticIcon from '../rewards/CosmeticIcon.vue'

const props = defineProps({
  avatarInitial: { type: String, default: '?' },
  avatarUrl: { type: String, default: '' },
  displayName: { type: String, default: '' },
  email: { type: String, default: '' },
  career: { type: String, default: '' },
  bio: { type: String, default: '' },
  nationalityCode: { type: String, default: '' },
  favoriteTeam: { type: String, default: '' },
  favoritePlayer: { type: String, default: '' },
  favoriteTeamLogo: { type: String, default: '' },
  favoritePlayerImage: { type: String, default: '' },
  socials: { type: Array, default: () => [] },
  canEdit: { type: Boolean, default: false },
  levelInfo: { type: Object, default: null },
  progressPercent: { type: Number, default: 0 },
  xpNow: { type: Number, default: 0 },
  achievementsCount: { type: Number, default: 0 },
  topRank: { type: Number, default: null },
  frameStyleKey: { type: String, default: 'none' },
  titleText: { type: String, default: '' },
  titleRarity: { type: String, default: 'common' },
  iconGlyph: { type: String, default: '' },
  bannerKey: { type: String, default: 'default' },
  iconBgKey: { type: String, default: 'emerald' },
  framePremium: { type: Boolean, default: false },
  titlePremium: { type: Boolean, default: false },
  bannerPremium: { type: Boolean, default: false },
})

const showProgression = ref(false)
const frame = computed(() => frameStyle(props.frameStyleKey))
const titleColor = computed(() => rarity(props.titleRarity).text)

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

const countryName = computed(() => {
  const code = (props.nationalityCode || '').toString().toLowerCase()
  return code ? (countryNames[code] || '') : ''
})

function socialIconSrc(type) {
  const t = (type || '').toLowerCase()
  if (t === 'linkedin') return '/social/linkedinmain.png'
  if (t === 'github') return '/social/githubmain.png'
  if (t === 'twitter' || t === 'x') return '/social/xmain.png'
  if (t === 'instagram') return '/social/igmain.png'
  return ''
}

const bannerGradient = computed(() => {
  const map = {
    emerald: 'from-emerald-800/90 via-emerald-900/70 to-teal-950',
    amber: 'from-amber-800/90 via-amber-900/70 to-yellow-950',
    orange: 'from-orange-800/90 via-orange-900/70 to-amber-950',
    red: 'from-red-800/90 via-red-900/70 to-rose-950',
    sky: 'from-sky-800/90 via-sky-900/70 to-blue-950',
    violet: 'from-violet-800/90 via-violet-900/70 to-purple-950',
  }
  return map[currentTier.value?.color] || map.emerald
})

const bannerClass = computed(() =>
  (props.bannerKey && props.bannerKey !== 'default')
    ? bannerStyle(props.bannerKey)
    : ('bg-gradient-to-br ' + bannerGradient.value)
)

const accent = computed(() => {
  const map = {
    emerald: { text: 'text-emerald-400', bar: 'from-emerald-400 to-cyan-400', glow: 'shadow-emerald-500/30', badge: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' },
    amber: { text: 'text-amber-400', bar: 'from-amber-400 to-yellow-400', glow: 'shadow-amber-500/30', badge: 'bg-amber-500/20 border-amber-500/30 text-amber-300' },
    orange: { text: 'text-orange-400', bar: 'from-orange-400 to-amber-400', glow: 'shadow-orange-500/30', badge: 'bg-orange-500/20 border-orange-500/30 text-orange-300' },
    red: { text: 'text-red-400', bar: 'from-red-400 to-orange-400', glow: 'shadow-red-500/30', badge: 'bg-red-500/20 border-red-500/30 text-red-300' },
    sky: { text: 'text-sky-400', bar: 'from-sky-400 to-blue-400', glow: 'shadow-sky-500/30', badge: 'bg-sky-500/20 border-sky-500/30 text-sky-300' },
    violet: { text: 'text-violet-400', bar: 'from-violet-400 to-purple-400', glow: 'shadow-violet-500/30', badge: 'bg-violet-500/20 border-violet-500/30 text-violet-300' },
  }
  return map[currentTier.value?.color] || map.emerald
})
</script>

<template>
  <div class="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/50 backdrop-blur overflow-hidden shadow-2xl">

    <!-- Banner -->
    <div class="relative h-28 sm:h-32" :class="[bannerClass, bannerPremium ? 'anim-pan' : '']">
      <div class="absolute inset-0 overflow-hidden">
        <div class="absolute top-3 right-6 w-24 h-24 rounded-full border-2 border-white/10 opacity-40"></div>
        <div class="absolute -bottom-4 right-20 w-16 h-16 rounded-full border border-white/8 opacity-30"></div>
        <div class="absolute top-6 left-[40%] w-10 h-10 rounded-full border border-white/5 opacity-20"></div>
      </div>
      <div class="absolute top-3 right-3 flex gap-2 z-10">
        <button
          @click="showProgression = true"
          class="h-8 w-8 rounded-lg bg-black/20 hover:bg-black/40 border border-white/15 grid place-items-center transition-colors"
          title="Ver progresion de niveles"
        >
          <svg class="h-4 w-4 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
        </button>
        <router-link
          v-if="canEdit"
          to="/profile-edit"
          class="h-8 w-8 rounded-lg bg-black/20 hover:bg-black/40 border border-white/15 grid place-items-center transition-colors"
          title="Editar perfil"
        >
          <svg class="h-4 w-4 text-white/80" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z"/>
          </svg>
        </router-link>
      </div>
    </div>

    <!-- Avatar + Identity (overlapping banner) -->
    <div class="px-5 sm:px-6 -mt-11 relative z-10">
      <div class="flex items-end gap-4">
        <div class="relative shrink-0">
          <div :class="[frame.wrap, frame.pad, 'rounded-2xl', framePremium ? 'anim-pan' : '']">
            <div
              class="size-[88px] sm:size-24 overflow-hidden shadow-xl text-white font-extrabold text-2xl sm:text-3xl grid place-items-center"
              :class="[iconBgStyle(iconBgKey), frameStyleKey && frameStyleKey !== 'none' ? 'rounded-[14px]' : 'rounded-2xl ring-4 ring-slate-900']"
            >
              <CosmeticIcon v-if="iconGlyph" :iconKey="iconGlyph" :size="60" />
              <img v-else-if="avatarUrl" :src="avatarUrl" alt="" class="w-full h-full object-cover" />
              <span v-else>{{ avatarInitial }}</span>
            </div>
          </div>
          <div
            class="absolute -bottom-1 -right-1 rounded-full px-2 py-0.5 text-[11px] font-extrabold bg-slate-900 border-2 shadow-lg"
            :class="accent.text"
            style="border-color: currentColor"
          >{{ level }}</div>
        </div>
        <div class="flex-1 min-w-0 pb-1">
          <div class="flex items-center gap-2 flex-wrap">
            <h2 class="text-xl sm:text-2xl font-bold text-white truncate">{{ displayName }}</h2>
            <img
              v-if="nationalityCode"
              :src="`https://flagcdn.com/w20/${nationalityCode}.png`"
              width="22" height="11"
              class="rounded ring-1 ring-white/10"
              :alt="countryName"
            />
            <span
              v-if="topRank && topRank <= 3"
              class="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold border"
              :class="{
                'border-amber-400/50 bg-amber-500/20 text-amber-300': topRank === 1,
                'border-slate-400/50 bg-slate-500/20 text-slate-300': topRank === 2,
                'border-orange-400/50 bg-orange-500/20 text-orange-300': topRank === 3,
              }"
            >TOP {{ topRank }}</span>
          </div>
          <p v-if="titleText" class="text-sm font-bold mt-0.5" :class="titlePremium ? 'title-premium-anim' : titleColor">{{ titleText }}</p>
          <div class="flex items-center gap-2 mt-0.5">
            <img v-if="currentTier?.image" :src="currentTier.image" :alt="currentTier.label" class="w-5 h-5 object-contain" />
            <span class="text-sm font-semibold" :class="accent.text">{{ currentTier?.label }}</span>
            <span class="text-slate-600 text-xs">|</span>
            <span class="text-sm text-slate-400">Nivel {{ level }}</span>
          </div>
          <div v-if="socials.length" class="mt-1.5 flex items-center gap-2.5">
            <a v-for="s in socials" :key="s.type" :href="s.url" target="_blank" rel="noopener" class="inline-flex">
              <img :src="socialIconSrc(s.type)" :alt="s.type" class="h-4 w-4 object-contain opacity-60 hover:opacity-100 transition-opacity" />
            </a>
          </div>
        </div>
      </div>
    </div>

    <!-- Stats strip -->
    <div class="px-5 sm:px-6 mt-5 grid grid-cols-3 gap-3">
      <div class="rounded-xl border border-white/10 bg-gradient-to-br from-slate-800/60 to-slate-700/40 p-3 text-center hover:border-white/20 transition-colors">
        <p class="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">XP Total</p>
        <p class="text-white text-xl font-bold tabular-nums">{{ xpNow.toLocaleString() }}</p>
      </div>
      <div class="rounded-xl border border-white/10 bg-gradient-to-br from-slate-800/60 to-slate-700/40 p-3 text-center hover:border-white/20 transition-colors">
        <p class="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">Nivel</p>
        <p class="text-white text-xl font-bold">{{ level }}</p>
      </div>
      <div class="rounded-xl border border-white/10 bg-gradient-to-br from-slate-800/60 to-slate-700/40 p-3 text-center hover:border-white/20 transition-colors">
        <p class="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">Logros</p>
        <p class="text-white text-xl font-bold">{{ achievementsCount }}</p>
      </div>
    </div>

    <!-- Progress bars -->
    <div class="px-5 sm:px-6 mt-4 space-y-3">
      <!-- Level progress -->
      <div v-if="level < 50">
        <div class="flex items-center justify-between text-[10px] uppercase tracking-wider text-slate-400 mb-1.5">
          <span>Progreso al nivel {{ level + 1 }}</span>
          <span class="text-slate-300 normal-case tracking-normal font-medium">{{ progressPercent }}%</span>
        </div>
        <div class="h-2.5 w-full rounded-full bg-slate-900/50 overflow-hidden shadow-inner border border-white/5">
          <div
            class="h-full rounded-full bg-gradient-to-r transition-all duration-700 shadow-lg"
            :class="[accent.bar, accent.glow]"
            :style="{ width: progressPercent + '%' }"
          ></div>
        </div>
      </div>
      <!-- Tier progress -->
      <div v-if="currentTier && nextTier">
        <div class="flex items-center justify-between text-[10px] text-slate-500 mb-1">
          <span class="flex items-center gap-1">
            <img :src="currentTier.image" class="w-3.5 h-3.5" :alt="currentTier.label" />
            {{ currentTier.label }}
          </span>
          <span class="flex items-center gap-1">
            {{ nextTier.label }}
            <img :src="nextTier.image" class="w-3.5 h-3.5" :alt="nextTier.label" />
          </span>
        </div>
        <div class="h-1.5 w-full rounded-full bg-slate-900/50 overflow-hidden border border-white/5">
          <div
            class="h-full rounded-full bg-gradient-to-r from-white/20 to-white/35 transition-all duration-700"
            :style="{ width: tierProgress + '%' }"
          ></div>
        </div>
        <p class="mt-1 text-[10px] text-slate-600 text-center">Nivel {{ level }} de {{ currentTier.maxLevel }} en este rango</p>
      </div>
      <div v-else-if="currentTier && !nextTier" class="text-center">
        <p class="text-sm font-bold" :class="accent.text">Rango maximo alcanzado</p>
      </div>
    </div>

    <!-- Bio + Favorites -->
    <div class="px-5 sm:px-6 mt-4 pb-5 space-y-3">
      <p v-if="bio" class="text-sm text-slate-300 leading-relaxed whitespace-pre-line">{{ bio }}</p>

      <div v-if="favoritePlayer || favoriteTeam" class="flex flex-wrap gap-2.5">
        <div v-if="favoritePlayer" class="flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
          <div class="h-8 w-8 rounded-lg overflow-hidden bg-slate-800/50 grid place-items-center shrink-0">
            <img v-if="favoritePlayerImage" :src="favoritePlayerImage" alt="" class="h-full w-full object-cover" />
            <svg v-else class="w-4 h-4 text-slate-600" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/>
            </svg>
          </div>
          <div class="min-w-0">
            <p class="text-[9px] uppercase tracking-wider text-slate-500">Jugador</p>
            <p class="text-sm text-slate-200 truncate">{{ favoritePlayer }}</p>
          </div>
        </div>
        <div v-if="favoriteTeam" class="flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
          <div class="h-8 w-8 rounded-lg overflow-hidden bg-slate-800/50 grid place-items-center shrink-0">
            <img v-if="favoriteTeamLogo" :src="favoriteTeamLogo" alt="" class="h-full w-full object-contain p-0.5" />
            <svg v-else class="w-4 h-4 text-slate-600" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 2L3 7v6c0 3.5 3 6 7 9 4-3 7-5.5 7-9V7l-7-5z" clip-rule="evenodd"/>
            </svg>
          </div>
          <div class="min-w-0">
            <p class="text-[9px] uppercase tracking-wider text-slate-500">Equipo</p>
            <p class="text-sm text-slate-200 truncate">{{ favoriteTeam }}</p>
          </div>
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
