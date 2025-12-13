<script setup>
import { computed } from 'vue'
import countryNames from '../../codeCOUNTRYS.json'

const props = defineProps({
  avatarInitial: { type: String, required: true },
  avatarUrl: { type: String, required: false, default: '' },
  displayName: { type: String, required: true },
  email: { type: String, required: false, default: '' },
  career: { type: String, required: false, default: '' },
  bio: { type: String, required: false, default: '' },
  nationalityCode: { type: String, required: false, default: '' },
  favoriteTeam: { type: String, required: false, default: '' },
  favoritePlayer: { type: String, required: false, default: '' },
  favoriteTeamLogo: { type: String, required: false, default: '' },
  favoritePlayerImage: { type: String, required: false, default: '' },
  socials: { type: Array, required: false, default: () => [] },
  canEdit: { type: Boolean, required: false, default: false },
})

const countryName = computed(() => {
  const code = (props.nationalityCode || '').toString().toLowerCase()
  if (!code) return ''
  return countryNames[code] || ''
})

// Choose the 'main' icon variant from /public/social for each network
function socialIconSrc(type) {
  const t = (type || '').toLowerCase()
  switch (t) {
    case 'linkedin':
      return '/social/linkedinmain.png'
    case 'github':
      return '/social/githubmain.png'
    case 'twitter':
    case 'x':
      return '/social/xmain.png'
    case 'instagram':
      return '/social/igmain.png'
    default:
      return ''
  }
}
</script>

<template>
  <div class="card p-6 flex flex-col gap-4 relative">
    <!-- Pencil edit button -->
    <router-link v-if="canEdit" to="/profile-edit" class="absolute top-3 right-3 h-8 w-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 grid place-items-center" title="Editar perfil">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-4 w-4 text-slate-200">
        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z"/>
      </svg>
    </router-link>
    <!-- Header with bigger avatar and identity -->
    <div class="flex items-center gap-4">
      <div class="relative size-20 sm:size-24 rounded-2xl overflow-hidden shadow-lg bg-gradient-to-br from-[oklch(0.70_0.21_270)] to-[oklch(0.55_0.21_270)] text-white font-extrabold text-2xl grid place-items-center">
        <img v-if="avatarUrl" :src="avatarUrl" alt="avatar" class="w-full h-full object-cover" />
        <span v-else>{{ avatarInitial }}</span>
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <p class="truncate text-xl sm:text-2xl font-semibold text-white">{{ displayName }}</p>
          <img v-if="nationalityCode" :src="`https://flagcdn.com/w20/${nationalityCode}.png`" :alt="nationalityCode" width="25" height="12" class="rounded ring-1 ring-white/10" />
        </div>
        <p class="text-slate-300 text-sm sm:text-base">{{ email || '—' }}</p>
        <!-- Socials below email (icons only, no background/border) -->
        <div v-if="(socials || []).length" class="mt-2 flex items-center gap-3 sm:gap-4">
          <a v-for="s in socials" :key="s.type" :href="s.url" target="_blank" rel="noopener" :title="s.type" class="inline-flex items-center">
            <img :src="socialIconSrc(s.type)" :alt="s.type" class="h-5 w-5 sm:h-6 sm:w-6 object-contain"/>
          </a>
        </div>
      </div>
    </div>

    <!-- Bio -->
    <div>
      <p class="text-xs uppercase tracking-wide text-slate-400">Biografía</p>
      <p class="mt-1 whitespace-pre-line text-slate-300 text-sm">{{ bio || 'No establecida' }}</p>
    </div>

    <!-- Nested sub-cards for favorites like achievements style -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div class="rounded-lg border border-white/10 bg-white/5 p-3 flex items-center gap-3">
        <div class="h-12 w-12 rounded-lg overflow-hidden grid place-items-center">
          <img v-if="favoritePlayerImage" :src="favoritePlayerImage" alt="player" class="h-full w-full object-cover"/>
          <span v-else class="text-slate-400 text-xl">👤</span>
        </div>
        <div class="min-w-0">
          <p class="text-[10px] uppercase tracking-wider text-slate-400">Jugador favorito</p>
          <p class="text-slate-100 truncate">{{ favoritePlayer || '—' }}</p>
        </div>
      </div>
      <div class="rounded-lg border border-white/10 bg-white/5 p-3 flex items-center gap-3">
        <div class="h-12 w-12 rounded-lg overflow-hidden grid place-items-center">
          <img v-if="favoriteTeamLogo" :src="favoriteTeamLogo" alt="team" class="h-full w-full object-contain"/>
          <span v-else class="text-slate-400 text-xl">🛡️</span>
        </div>
        <div class="min-w-0">
          <p class="text-[10px] uppercase tracking-wider text-slate-400">Equipo favorito</p>
          <p class="text-slate-100 truncate">{{ favoriteTeam || '—' }}</p>
        </div>
      </div>
    </div>

    
  </div>
</template>

