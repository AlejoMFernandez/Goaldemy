<script setup>
import { onMounted, reactive, computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { fetchGames, gameRouteForSlug, getGameTypeLabel, getGameTypeColor } from '../services/games'
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
    <!-- HERO compacto: título + subtítulo + reinicio, en una sola barra fina -->
    <div class="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 px-4 py-3.5 md:px-5 md:py-4 mb-3">
      <div class="pointer-events-none absolute -top-16 -right-10 w-64 h-64 rounded-full opacity-25 blur-3xl" style="background: radial-gradient(circle, rgba(16,185,129,0.35), transparent 70%);"></div>

      <div class="relative flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div class="min-w-0">
          <span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 ring-1 ring-emerald-400/25 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300 mb-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Modo Puntos · 1 partida por día
          </span>
          <h1 class="font-display text-xl md:text-2xl font-extrabold text-white leading-tight">
            Elegí tu <span class="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">desafío</span>
          </h1>
        </div>
        <DailyResetCountdown class="shrink-0"/>
      </div>
    </div>

    <!-- Cards informativas: lo importante de un vistazo -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
      <!-- Jugados hoy -->
      <div class="rounded-2xl border border-white/10 bg-slate-900/50 px-3.5 py-2.5">
        <div class="text-[10px] uppercase tracking-wider text-slate-500">Jugados hoy</div>
        <div class="mt-0.5 font-display text-2xl font-extrabold text-white tabular-nums leading-none">
          {{ playedCount }}<span class="text-slate-600 text-base font-bold">/{{ state.loading ? '—' : state.games.length }}</span>
        </div>
      </div>
      <!-- Ganados -->
      <div class="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] px-3.5 py-2.5">
        <div class="text-[10px] uppercase tracking-wider text-emerald-400/80">Ganados hoy</div>
        <div class="mt-0.5 flex items-center gap-1.5 leading-none">
          <span class="text-emerald-400 text-lg font-extrabold">✓</span>
          <span class="font-display text-2xl font-extrabold text-white tabular-nums">{{ totals.win }}</span>
        </div>
      </div>
      <!-- Perdidos -->
      <div class="rounded-2xl border border-red-500/20 bg-red-500/[0.06] px-3.5 py-2.5">
        <div class="text-[10px] uppercase tracking-wider text-red-400/80">Perdidos hoy</div>
        <div class="mt-0.5 flex items-center gap-1.5 leading-none">
          <span class="text-red-400 text-lg font-extrabold">✕</span>
          <span class="font-display text-2xl font-extrabold text-white tabular-nums">{{ totals.loss }}</span>
        </div>
      </div>
      <!-- Racha (abre el calendario) -->
      <button
        @click="streakOpen = !streakOpen"
        class="text-left rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] px-3.5 py-2.5 hover:border-amber-400/40 transition"
      >
        <div class="text-[10px] uppercase tracking-wider text-amber-400/80 flex items-center justify-between gap-1">
          Racha diaria
          <svg class="w-3.5 h-3.5 text-amber-400/70 transition-transform duration-300" :class="streakOpen ? 'rotate-180' : ''" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.24 4.5a.75.75 0 01-1.08 0l-4.24-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd"/></svg>
        </div>
        <div class="mt-0.5 flex items-center gap-1.5 leading-none">
          <svg class="w-4 h-4 text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.5)]" viewBox="0 0 24 24" fill="currentColor"><path d="M12 23c-3.6 0-8-3.1-8-8.5C4 9 8 4 11.5 1c.2-.1.4-.1.5 0 .2.1.2.3.1.5C11 4 14 6 14 6s1-1.5 1.5-4c0-.2.2-.3.4-.3s.3.1.4.3C18 5 20 9 20 14.5 20 19.9 15.6 23 12 23z"/></svg>
          <span class="font-display text-2xl font-extrabold text-white tabular-nums">{{ state.dailyStreak.current }}</span>
        </div>
      </button>
    </div>

    <!-- Calendario de racha: se despliega desde la card de Racha -->
    <div class="streak-panel" :class="{ open: streakOpen }">
      <DailyStreakCalendar
        class="mb-4"
        :currentStreak="state.dailyStreak.current"
        :bestStreak="state.dailyStreak.best"
        :playedToday="playedCount > 0"
      />
    </div>

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

          <!-- Unlocked game — dirección "Limpia": sin barra de degradé, tinte por
               tipo de juego, imagen protagonista y nombre al frente (CTA en hover) -->
          <RouterLink
            v-else
            :to="toChallenge(g.slug)"
            class="game-card group relative flex flex-col rounded-2xl overflow-hidden border border-white/10 bg-gradient-to-b from-slate-800/70 to-slate-900 transition-all duration-300 hover:-translate-y-1 active:scale-[0.98]"
            :style="{ '--c': getGameTypeColor(g.slug) }"
            :class="[
              state.availability[g.slug]?.result === 'win'
                ? 'border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                : state.availability[g.slug]?.result === 'loss'
                ? 'border-red-500/40 shadow-[0_0_20px_rgba(239,68,68,0.15)]'
                : ''
            ]"
          >
            <div class="relative flex items-center justify-center h-36 bg-slate-800/40 overflow-hidden">
              <!-- Tinte por tipo de juego (más presente en hover) -->
              <div class="card-tint pointer-events-none absolute inset-0"></div>

              <!-- Chip tipo de juego -->
              <span v-if="getGameTypeLabel(g.slug)" class="absolute top-2 left-2 z-20 rounded-md bg-slate-950/70 backdrop-blur px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-200 ring-1 ring-white/10">
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
                class="relative w-[104px] h-[104px] object-contain transition-transform duration-300 group-hover:scale-110 drop-shadow-[0_6px_16px_rgba(0,0,0,0.4)]"
                :class="state.availability[g.slug]?.available === false ? 'opacity-30' : 'opacity-95'"
              />
              <div v-if="(state.streaks[g.slug] || 0) > 0" class="absolute top-2 right-2 z-20 flex items-center gap-1 rounded-full bg-slate-900/90 ring-1 ring-amber-400/30 shadow-[0_0_12px_rgba(251,191,36,0.25)] px-2 py-0.5">
                <svg class="w-3 h-3 text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.5)]" viewBox="0 0 24 24" fill="currentColor"><path d="M12 23c-3.6 0-8-3.1-8-8.5C4 9 8 4 11.5 1c.2-.1.4-.1.5 0 .2.1.2.3.1.5C11 4 14 6 14 6s1-1.5 1.5-4c0-.2.2-.3.4-.3s.3.1.4.3C18 5 20 9 20 14.5 20 19.9 15.6 23 12 23z"/></svg>
                <span class="text-amber-300 font-bold text-[11px] leading-none tabular-nums">{{ state.streaks[g.slug] }}</span>
              </div>
            </div>
            <div class="px-3 py-2.5 border-t border-white/5 flex items-center gap-2">
              <span class="min-w-0 flex-1 font-display font-bold text-white text-[13px] leading-tight truncate">{{ g.name }}</span>
              <span class="card-cta shrink-0 text-[11px] font-extrabold whitespace-nowrap">
                {{ state.availability[g.slug]?.available === false ? 'Ver →' : 'Jugar →' }}
              </span>
            </div>
          </RouterLink>
        </template>
      </div>

      <!-- Panel de ayudas: qué tenés y en qué juegos aplican (secundario, bajo los juegos) -->
      <AyudasPanel class="mt-6" />
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
.streak-panel.open {
  max-height: 520px;
  opacity: 1;
}

.backdrop-grayscale {
  -webkit-backdrop-filter: saturate(0) brightness(0.75);
  backdrop-filter: saturate(0) brightness(0.75);
}

/* Dirección "Limpia": tinte de acento por tipo de juego detrás de la imagen */
.card-tint {
  background: radial-gradient(78% 78% at 50% 42%, color-mix(in srgb, var(--c, #34d399) 24%, transparent), transparent 72%);
  opacity: .68;
  transition: opacity .3s ease;
}
.game-card:hover .card-tint { opacity: 1; }
.game-card:hover { border-color: color-mix(in srgb, var(--c, #34d399) 42%, transparent); box-shadow: 0 14px 34px rgba(0,0,0,.42); }

/* CTA "Jugar →" aparece en hover (en móvil no hay hover: manda el nombre) */
.card-cta {
  color: var(--c, #34d399);
  opacity: 0;
  transform: translateX(-5px);
  transition: opacity .2s ease, transform .2s ease;
}
.game-card:hover .card-cta { opacity: 1; transform: none; }
@media (hover: none) {
  .card-cta { opacity: .9; transform: none; }
}
</style>
