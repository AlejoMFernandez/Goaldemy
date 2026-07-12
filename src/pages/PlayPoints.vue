<script setup>
import { onMounted, reactive, computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { fetchGames, gameRouteForSlug, getGameTypeLabel } from '../services/games'
import { isChallengeAvailable, fetchDailyWinStreak } from '../services/game-modes'
import { getGameUnlockLevel, isGameUnlocked } from '../services/level-rewards'
import { getUserLevel } from '../services/xp'
import { POWERUP_GAME_SLUGS } from '../services/powerups'
import DailyStreakCalendar from '../components/rewards/DailyStreakCalendar.vue'
import DailyResetCountdown from '../components/DailyResetCountdown.vue'
import AyudasPanel from '../components/game/AyudasPanel.vue'
import { supabase } from '../services/supabase'

const AYUDA_SLUGS = new Set(POWERUP_GAME_SLUGS)
const streakOpen = ref(false)

const state = reactive({
  games: [],
  availability: {},
  streaks: {},
  loading: true,
  dailyStreak: { current: 0, best: 0 },
  userLevel: 1,
})

async function load() {
  state.loading = true
  try {
    const all = await fetchGames()
    const list = (all || []).filter(g => !!g?.slug && gameRouteForSlug(g.slug) !== '/games')
    state.games = list
    const entriesAv = await Promise.all(list.map(async g => [g.slug, await isChallengeAvailable(g.slug)]))
    state.availability = Object.fromEntries(entriesAv)
    const entriesSt = await Promise.all(list.map(async g => [g.slug, await fetchDailyWinStreak(g.slug)]))
    state.streaks = Object.fromEntries(entriesSt)

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const [profileRes, levelRes] = await Promise.all([
        supabase.from('user_profiles').select('daily_streak, best_daily_streak').eq('id', user.id).single(),
        getUserLevel(null),
      ])
      if (profileRes.data) {
        state.dailyStreak.current = profileRes.data.daily_streak || 0
        state.dailyStreak.best = profileRes.data.best_daily_streak || 0
      }
      const lvlInfo = Array.isArray(levelRes.data) ? levelRes.data[0] : levelRes.data
      state.userLevel = Number(lvlInfo?.level) || 1
    }
  } catch (e) {
    console.error('PlayPoints load error:', e)
  } finally {
    state.loading = false
  }
}

onMounted(load)

function toChallenge(slug) {
  const av = state.availability[slug]
  if (av && av.available === false) return `${gameRouteForSlug(slug)}?mode=review`
  return `${gameRouteForSlug(slug)}?mode=challenge`
}

const totals = computed(() => {
  const vals = Object.values(state.availability || {})
  let win = 0, loss = 0
  for (const av of vals) {
    if (!av || av.available !== false) continue
    if (av.result === 'win') win++
    else if (av.result === 'loss') loss++
  }
  return { win, loss }
})

const playedCount = computed(() => Object.values(state.availability).filter(a => a?.available === false).length)
</script>

<template>
  <section class="mx-auto max-w-5xl">
    <!-- HERO inmersivo -->
    <div class="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-5 md:p-6 mb-4">
      <div class="pointer-events-none absolute -top-16 -right-10 w-72 h-72 rounded-full opacity-30 blur-3xl" style="background: radial-gradient(circle, rgba(16,185,129,0.35), transparent 70%);"></div>
      <div class="pointer-events-none absolute -bottom-24 -left-12 w-72 h-72 rounded-full opacity-20 blur-3xl" style="background: radial-gradient(circle, rgba(34,211,238,0.30), transparent 70%);"></div>

      <div class="relative flex items-start justify-between gap-4">
        <div class="min-w-0">
          <span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 ring-1 ring-emerald-400/25 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-300 mb-3">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Modo Puntos · 1 partida por día
          </span>
          <h1 class="font-display text-3xl md:text-4xl font-extrabold text-white leading-tight mb-1.5">
            Elegí tu <span class="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">desafío</span>
          </h1>
          <p class="text-slate-300 text-sm md:text-base max-w-md">Cada juego, una vez al día. Ganás XP, sumás a tu racha y competís en el ranking.</p>
          <DailyResetCountdown class="mt-4"/>
        </div>

        <div class="shrink-0 hidden sm:flex sm:flex-col sm:gap-2 sm:items-end">
          <div class="rounded-2xl bg-slate-900/60 border border-white/15 px-3 py-2">
            <div class="text-[10px] uppercase tracking-wider text-slate-400 text-center mb-1.5">Hoy</div>
            <div class="flex items-end gap-3">
              <div class="flex flex-col items-center gap-1" title="Ganados hoy">
                <div class="h-9 w-9 rounded-full grid place-items-center shadow-xl ring-2 ring-emerald-400/50 bg-emerald-500/20">
                  <div class="text-emerald-400 text-2xl font-extrabold leading-none">✓</div>
                </div>
                <div class="text-sm tabular-nums text-slate-100 font-semibold">{{ totals.win }}</div>
              </div>
              <div class="flex flex-col items-center gap-1" title="Perdidos hoy">
                <div class="h-9 w-9 rounded-full grid place-items-center shadow-xl ring-2 ring-red-400/50 bg-red-500/20">
                  <div class="text-red-400 text-2xl font-extrabold leading-none">✕</div>
                </div>
                <div class="text-sm tabular-nums text-slate-100 font-semibold">{{ totals.loss }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Racha diaria: botón compacto que se expande (hover en desktop / tap) -->
    <div class="streak-wrap group mb-4">
      <button
        @click="streakOpen = !streakOpen"
        class="w-full sm:w-auto inline-flex items-center gap-2 rounded-xl bg-slate-900/60 border border-white/12 px-3 py-2 hover:border-amber-400/30 transition"
      >
        <svg class="w-4 h-4 text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.5)]" viewBox="0 0 24 24" fill="currentColor"><path d="M12 23c-3.6 0-8-3.1-8-8.5C4 9 8 4 11.5 1c.2-.1.4-.1.5 0 .2.1.2.3.1.5C11 4 14 6 14 6s1-1.5 1.5-4c0-.2.2-.3.4-.3s.3.1.4.3C18 5 20 9 20 14.5 20 19.9 15.6 23 12 23z"/></svg>
        <span class="text-sm font-semibold text-white">Racha diaria</span>
        <span class="text-sm font-extrabold text-amber-300 tabular-nums">{{ state.dailyStreak.current }}</span>
        <svg class="w-4 h-4 text-slate-400 ml-auto sm:ml-1 transition-transform duration-300" :class="streakOpen ? 'rotate-180' : ''" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.24 4.5a.75.75 0 01-1.08 0l-4.24-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd"/></svg>
      </button>
      <div class="streak-panel" :class="{ open: streakOpen }">
        <DailyStreakCalendar
          :currentStreak="state.dailyStreak.current"
          :bestStreak="state.dailyStreak.best"
          :playedToday="playedCount > 0"
        />
      </div>
    </div>

    <!-- Panel de ayudas: qué tenés y en qué juegos aplican -->
    <AyudasPanel class="mb-5" />

    <div class="flex items-center gap-2 mb-3">
      <h2 class="font-display text-lg font-bold text-white">Todos los juegos</h2>
      <span v-if="!state.loading" class="rounded-full bg-white/5 ring-1 ring-white/10 px-2 py-0.5 text-xs font-semibold text-slate-300 tabular-nums">{{ state.games.length }}</span>
    </div>

    <div v-if="state.loading" class="flex flex-col items-center justify-center py-20 gap-4">
      <div class="h-10 w-10 rounded-full border-4 border-emerald-400/30 border-t-emerald-400 animate-spin"></div>
      <span class="text-slate-400 text-sm">Cargando juegos…</span>
    </div>
    <div v-else>
      <!-- Game cards -->
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 stagger-grid">
        <template v-for="g in state.games" :key="g.slug">
          <!-- Locked game -->
          <div
            v-if="!isGameUnlocked(g.slug, state.userLevel)"
            class="relative flex flex-col rounded-2xl overflow-hidden border border-white/5 bg-gradient-to-b from-slate-800/40 to-slate-900/60 opacity-60 cursor-not-allowed select-none"
          >
            <div class="relative flex items-center justify-center h-36 bg-slate-800/40">
              <img
                v-if="g.cover_url"
                :src="g.cover_url"
                :alt="g.name"
                class="w-24 h-24 object-contain opacity-20 grayscale"
              />
              <div class="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/40">
                <svg class="w-10 h-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                <span class="text-[10px] text-slate-400 font-semibold text-center px-2 leading-tight">
                  Nivel {{ getGameUnlockLevel(g.slug) }}
                </span>
              </div>
            </div>
            <div class="bg-slate-900/90 px-3 py-3 border-t border-white/5 text-center">
              <div class="font-display font-bold text-slate-500 text-xs tracking-widest uppercase">BLOQUEADO</div>
              <div class="text-slate-500 text-xs mt-0.5 truncate">{{ g.name }}</div>
            </div>
          </div>

          <!-- Unlocked game -->
          <RouterLink
            v-else
            :to="toChallenge(g.slug)"
            class="group relative flex flex-col rounded-2xl overflow-hidden border border-white/10 bg-gradient-to-b from-slate-800/80 to-slate-900 transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] active:scale-[0.98]"
            :class="[
              state.availability[g.slug]?.result === 'win'
                ? 'border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                : state.availability[g.slug]?.result === 'loss'
                ? 'border-red-500/40 shadow-[0_0_20px_rgba(239,68,68,0.15)]'
                : 'hover:border-emerald-400/30 hover:shadow-[0_10px_34px_rgba(16,185,129,0.18)]'
            ]"
          >
            <!-- Brand accent line -->
            <div class="absolute top-0 inset-x-0 h-0.5 z-20 bg-gradient-to-r from-emerald-400/70 via-cyan-400/70 to-transparent opacity-50 group-hover:opacity-100 transition-opacity duration-300"></div>

            <div class="relative flex items-center justify-center h-36 bg-slate-800/60 overflow-hidden">
              <!-- Hover brand glow -->
              <div class="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style="background: radial-gradient(60% 60% at 50% 42%, rgba(16,185,129,0.20), transparent 70%);"></div>

              <!-- Chip tipo de juego -->
              <span v-if="getGameTypeLabel(g.slug)" class="absolute top-2 left-2 z-20 rounded-md bg-slate-950/70 backdrop-blur px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-300 ring-1 ring-white/10">
                {{ getGameTypeLabel(g.slug) }}
              </span>

              <!-- Indicador: este juego admite ayudas -->
              <span
                v-if="AYUDA_SLUGS.has(g.slug)"
                class="absolute bottom-2 left-2 z-20 inline-flex items-center gap-0.5 rounded-md bg-amber-500/15 ring-1 ring-amber-400/30 px-1.5 py-0.5 text-amber-300"
                title="Podés usar ayudas en este juego"
              >
                <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                <span class="text-[9px] font-bold uppercase tracking-wide">Ayudas</span>
              </span>

              <div
                v-if="state.availability[g.slug]?.available === false"
                class="absolute inset-0 flex items-center justify-center bg-black/50 z-10"
              >
                <div
                  v-if="state.availability[g.slug]?.result === 'win'"
                  class="w-14 h-14 rounded-2xl flex items-center justify-center ring-1 ring-emerald-400/40 bg-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                >
                  <span class="text-emerald-400 text-3xl font-extrabold leading-none">✓</span>
                </div>
                <div
                  v-else
                  class="w-14 h-14 rounded-2xl flex items-center justify-center ring-1 ring-red-400/40 bg-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.3)]"
                >
                  <span class="text-red-400 text-3xl font-extrabold leading-none">✕</span>
                </div>
              </div>
              <img
                v-if="g.cover_url"
                :src="g.cover_url"
                :alt="g.name"
                class="relative w-24 h-24 object-contain transition-transform duration-300 group-hover:scale-110"
                :class="state.availability[g.slug]?.available === false ? 'opacity-30' : 'opacity-90'"
              />
              <div v-if="(state.streaks[g.slug] || 0) > 0" class="absolute top-2.5 right-2.5 z-20 flex items-center gap-1 rounded-full bg-slate-900/90 ring-1 ring-amber-400/30 shadow-[0_0_12px_rgba(251,191,36,0.25)] px-2 py-0.5">
                <svg class="w-3 h-3 text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.5)]" viewBox="0 0 24 24" fill="currentColor"><path d="M12 23c-3.6 0-8-3.1-8-8.5C4 9 8 4 11.5 1c.2-.1.4-.1.5 0 .2.1.2.3.1.5C11 4 14 6 14 6s1-1.5 1.5-4c0-.2.2-.3.4-.3s.3.1.4.3C18 5 20 9 20 14.5 20 19.9 15.6 23 12 23z"/></svg>
                <span class="text-amber-300 font-bold text-[11px] leading-none tabular-nums">{{ state.streaks[g.slug] }}</span>
              </div>
            </div>
            <div class="bg-slate-900/90 px-3 py-3 border-t border-white/5 text-center">
              <div class="font-display font-bold text-white text-xs tracking-widest uppercase group-hover:text-emerald-300 transition-colors">
                {{ state.availability[g.slug]?.available === false ? 'VER RESULTADO' : 'JUGAR' }}
              </div>
              <div class="text-slate-400 text-xs mt-0.5 truncate">{{ g.name }}</div>
            </div>
          </RouterLink>
        </template>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* Racha diaria: se expande al pasar el mouse por el botón o al fijarla con click */
.streak-panel {
  max-height: 0;
  overflow: hidden;
  opacity: 0;
  transition: max-height 0.35s ease, opacity 0.25s ease, margin-top 0.25s ease;
}
.streak-wrap button:hover ~ .streak-panel,
.streak-panel.open {
  max-height: 520px;
  opacity: 1;
  margin-top: 8px;
}

.backdrop-grayscale {
  -webkit-backdrop-filter: saturate(0) brightness(0.75);
  backdrop-filter: saturate(0) brightness(0.75);
}
</style>
