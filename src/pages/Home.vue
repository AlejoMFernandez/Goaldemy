<script setup>
import { onMounted, reactive, computed } from 'vue'
import { RouterLink } from 'vue-router'
import { supabase } from '../services/supabase'
import { fetchGames, gameRouteForSlug } from '../services/games'
import AppH1 from '../components/AppH1.vue'

const state = reactive({ 
  isAuthenticated: false,
  loading: true,
  featuredGames: []
})

async function load() {
  state.loading = true
  
  // Check auth
  const { data: { user } } = await supabase.auth.getUser()
  state.isAuthenticated = !!user
  
  // Load last 4 games
  const allGames = await fetchGames()
  state.featuredGames = (allGames || [])
    .filter(g => !!g?.slug && gameRouteForSlug(g.slug) !== '/games')
    .slice(-4) // Últimos 4 juegos cargados
  
  state.loading = false
}

onMounted(load)

function getGameRoute(slug) {
  return `${gameRouteForSlug(slug)}?mode=challenge`
}
</script>

<template>
  <section class="relative min-h-screen overflow-hidden">
    <!-- Aurora background -->
    <div aria-hidden="true" class="aurora-root">
      <div class="accent"></div>
    </div>
    
    <!-- Hero section -->
    <div class="relative z-10 max-w-4xl mx-auto px-6 pt-12 md:pt-20 pb-16 md:pb-24">
      <div class="space-y-6 text-center">
        <AppH1>Bienvenido a Goaldemy</AppH1>
        <p class="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
          Juega minijuegos de fútbol, gana XP, desbloquea logros y sube en el ranking. 
          Personaliza tu perfil y compite con la comunidad.
        </p>
        <div class="flex flex-wrap gap-4 pt-6 justify-center">
          <!-- Botones si NO está autenticado -->
          <template v-if="!state.isAuthenticated">
            <RouterLink to="/login" class="rounded-xl bg-[oklch(0.62_0.21_270)] px-6 py-3 font-semibold text-white transition hover:bg-[oklch(0.55_0.21_270)] hover:scale-105 shadow-lg hover:shadow-[oklch(0.62_0.21_270)]/50">
              Iniciar sesión
            </RouterLink>
            <RouterLink to="/register" class="rounded-xl border border-white/10 px-6 py-3 font-semibold text-slate-200 transition hover:border-white/20 hover:text-white hover:bg-white/5 backdrop-blur">
              Crear cuenta
            </RouterLink>
          </template>
          
          <!-- Botones si SÍ está autenticado -->
          <template v-else>
            <RouterLink to="/play/points" class="rounded-xl bg-[oklch(0.62_0.21_270)] px-6 py-3 font-semibold text-white transition hover:bg-[oklch(0.55_0.21_270)] hover:scale-105 shadow-lg hover:shadow-[oklch(0.62_0.21_270)]/50">
              Ver juegos
            </RouterLink>
            <RouterLink to="/leaderboards" class="rounded-xl border border-white/10 px-6 py-3 font-semibold text-slate-200 transition hover:border-white/20 hover:text-white hover:bg-white/5 backdrop-blur">
              Top global
            </RouterLink>
            <RouterLink to="/profile" class="rounded-xl border border-white/10 px-6 py-3 font-semibold text-slate-200 transition hover:border-white/20 hover:text-white hover:bg-white/5 backdrop-blur">
              Mi perfil
            </RouterLink>
          </template>
        </div>
      </div>
    </div>

    <!-- Featured Games Section -->
    <div class="relative z-10 max-w-6xl mx-auto px-6 mb-20">
      <div class="flex items-center justify-between mb-8">
        <div>
          <h2 class="text-3xl font-bold text-white mb-2">🎮 Jugá Ahora</h2>
          <p class="text-slate-400">Desafíos diarios disponibles</p>
        </div>
        <RouterLink 
          to="/play/points" 
          class="group flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2 font-semibold text-slate-200 transition hover:border-emerald-400/40 hover:text-white hover:bg-emerald-500/10"
        >
          Ver todos
          <svg class="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </RouterLink>
      </div>

      <!-- Games Grid -->
      <div v-if="!state.loading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div 
          v-for="game in state.featuredGames" 
          :key="game.slug"
          class="relative group overflow-hidden rounded-2xl border bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 backdrop-blur-sm transition-all hover:scale-105"
          :class="state.isAuthenticated ? 'border-white/20 hover:border-emerald-400/40 hover:shadow-xl hover:shadow-emerald-500/20' : 'border-red-500/30'"
        >
          <!-- Locked Overlay -->
          <div v-if="!state.isAuthenticated" class="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-sm">
            <svg class="w-12 h-12 text-red-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <p class="text-sm font-semibold text-red-400 mb-1">Bloqueado</p>
            <p class="text-xs text-slate-400 text-center px-4">Iniciá sesión para jugar</p>
            <RouterLink 
              to="/login" 
              class="mt-4 rounded-lg bg-red-500/20 border border-red-400/30 px-4 py-2 text-xs font-semibold text-red-400 transition hover:bg-red-500/30"
            >
              Iniciar sesión
            </RouterLink>
          </div>

          <!-- Game Card Content -->
          <RouterLink 
            :to="state.isAuthenticated ? getGameRoute(game.slug) : '#'"
            :class="state.isAuthenticated ? '' : 'pointer-events-none'"
          >
            <!-- Game Icon -->
            <div class="relative h-32 bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 flex items-center justify-center overflow-hidden">
              <div class="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-cyan-500/5 group-hover:scale-110 transition-transform duration-500"></div>
              <img 
                v-if="game.icon" 
                :src="game.icon" 
                :alt="game.name"
                class="relative z-10 w-16 h-16 object-contain group-hover:scale-110 transition-transform"
              >
              <svg v-else class="relative z-10 w-16 h-16 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>

            <!-- Game Info -->
            <div class="p-4">
              <h3 class="text-lg font-bold text-white mb-2 line-clamp-1">{{ game.name }}</h3>
              <p class="text-xs text-slate-400 line-clamp-2 mb-3">{{ game.description || 'Desafío diario disponible' }}</p>
              
              <div v-if="state.isAuthenticated" class="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white transition group-hover:shadow-lg group-hover:shadow-emerald-500/50">
                <span>Jugar</span>
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                </svg>
              </div>
            </div>
          </RouterLink>
        </div>
      </div>

      <!-- Loading State -->
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div v-for="i in 4" :key="i" class="rounded-2xl border border-white/10 bg-slate-900/50 backdrop-blur-sm p-4 animate-pulse">
          <div class="h-32 bg-slate-700/50 rounded-lg mb-4"></div>
          <div class="h-4 bg-slate-700/50 rounded mb-2"></div>
          <div class="h-3 bg-slate-700/30 rounded"></div>
        </div>
      </div>
    </div>

    <!-- Info Sections -->
    <div class="relative z-10 max-w-6xl mx-auto px-6 space-y-16 pb-20">
      <!-- Section 1: Play & Compete -->
      <div class="grid md:grid-cols-2 gap-8 items-center">
        <div class="order-2 md:order-1">
          <div class="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/60 backdrop-blur-sm p-8">
            <div class="inline-flex rounded-xl bg-emerald-500/10 p-3 ring-1 ring-emerald-400/20 mb-4">
              <svg class="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 class="text-2xl font-bold text-white mb-4">Jugá y Competí</h3>
            <p class="text-slate-300 leading-relaxed mb-4">
              Accedé a 8 minijuegos únicos de fútbol donde pondrás a prueba tu conocimiento. 
              Desde adivinar jugadores por sus características, ordenar estadísticas, hasta desafíos de nacionalidad y posición.
            </p>
            <p class="text-slate-300 leading-relaxed mb-6">
              Cada juego tiene un <span class="text-emerald-400 font-semibold">desafío diario</span> donde competís contra el tiempo 
              y buscás el puntaje perfecto. ¡Ganás XP por cada victoria!
            </p>
            <RouterLink 
              to="/play/points" 
              class="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-6 py-3 font-semibold text-white transition hover:shadow-lg hover:shadow-emerald-500/50 hover:scale-105"
            >
              Ver todos los juegos
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </RouterLink>
          </div>
        </div>
        <div class="order-1 md:order-2 flex items-center justify-center">
          <!-- IMAGEN NECESARIA:
               - Aspecto ratio: 1:1 (cuadrada) o 4:3 (horizontal)
               - Tamaño recomendado: 600x600px o 800x600px
               - Contenido: Screenshot o mockup de los juegos en acción
               - Estilo: Gaming, moderno, con colores vibrantes (emerald/cyan)
               - Formato: PNG con transparencia o JPG de alta calidad
          -->
          <div class="w-full aspect-square max-w-md rounded-2xl border border-emerald-400/20 bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 flex items-center justify-center">
            <div class="text-center p-8">
              <svg class="w-32 h-32 mx-auto text-emerald-400/50 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p class="text-slate-400 text-sm">Colocá aquí imagen de juegos</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Section 2: Progress & Achievements -->
      <div class="grid md:grid-cols-2 gap-8 items-center">
        <div class="flex items-center justify-center">
          <!-- IMAGEN NECESARIA:
               - Aspecto ratio: 1:1 (cuadrada) o 4:3 (horizontal)
               - Tamaño recomendado: 600x600px o 800x600px
               - Contenido: Mockup de perfil con logros, nivel, badges
               - Estilo: Mostrar sistema de progresión (XP bar, achievements grid)
               - Colores: Indigo/Purple theme
               - Formato: PNG con transparencia o JPG
          -->
          <div class="w-full aspect-square max-w-md rounded-2xl border border-indigo-400/20 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 flex items-center justify-center">
            <div class="text-center p-8">
              <svg class="w-32 h-32 mx-auto text-indigo-400/50 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
              <p class="text-slate-400 text-sm">Colocá aquí imagen de progresión</p>
            </div>
          </div>
        </div>
        <div>
          <div class="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/60 backdrop-blur-sm p-8">
            <div class="inline-flex rounded-xl bg-indigo-500/10 p-3 ring-1 ring-indigo-400/20 mb-4">
              <svg class="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 class="text-2xl font-bold text-white mb-4">Progresá y Desbloqueá</h3>
            <p class="text-slate-300 leading-relaxed mb-4">
              Cada victoria te da <span class="text-indigo-400 font-semibold">XP</span> para subir de nivel. 
              A medida que avanzás, desbloqueás <span class="text-purple-400 font-semibold">+40 logros únicos</span> 
              organizados en 9 categorías diferentes.
            </p>
            <p class="text-slate-300 leading-relaxed mb-4">
              Desde logros de inicio como "Primera Victoria", hasta épicos como "Racha de 100 días" o "Experto en nacionalidades". 
              Cada logro tiene su dificultad y recompensa.
            </p>
            <p class="text-slate-300 leading-relaxed mb-6">
              Además, podés ganar <span class="text-amber-400 font-semibold">badges especiales</span> por ser 
              TOP 1, TOP 2 o TOP 3 del ranking global mensual. ¡Tu esfuerzo tiene recompensa!
            </p>
            <RouterLink 
              to="/leaderboards" 
              class="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-6 py-3 font-semibold text-white transition hover:shadow-lg hover:shadow-indigo-500/50 hover:scale-105"
            >
              Ver ranking global
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </RouterLink>
          </div>
        </div>
      </div>

      <!-- Section 3: Community -->
      <div class="grid md:grid-cols-2 gap-8 items-center">
        <div class="order-2 md:order-1">
          <div class="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/60 backdrop-blur-sm p-8">
            <div class="inline-flex rounded-xl bg-cyan-500/10 p-3 ring-1 ring-cyan-400/20 mb-4">
              <svg class="w-8 h-8 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 class="text-2xl font-bold text-white mb-4">Conectá con la Comunidad</h3>
            <p class="text-slate-300 leading-relaxed mb-4">
              Goaldemy no es solo juegos, es una <span class="text-cyan-400 font-semibold">comunidad de fanáticos del fútbol</span>. 
              Conectá con otros jugadores, armá tu red de contactos y seguí su progreso.
            </p>
            <p class="text-slate-300 leading-relaxed mb-4">
              Usá el <span class="text-cyan-400 font-semibold">chat global</span> para debatir sobre fútbol, 
              o enviá <span class="text-cyan-400 font-semibold">mensajes directos</span> para conversar 1 a 1 con tus amigos.
            </p>
            <p class="text-slate-300 leading-relaxed mb-6">
              Además, recibís <span class="text-cyan-400 font-semibold">notificaciones en tiempo real</span> cuando 
              alguien te sigue, te envía un mensaje, o cuando desbloqueás un nuevo logro.
            </p>
            <div class="flex flex-wrap gap-3">
              <RouterLink 
                to="/global-chat" 
                class="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-3 font-semibold text-white transition hover:shadow-lg hover:shadow-cyan-500/50 hover:scale-105"
              >
                Chat global
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </RouterLink>
              <RouterLink 
                to="/register" 
                class="inline-flex items-center gap-2 rounded-xl border border-cyan-400/30 px-6 py-3 font-semibold text-cyan-400 transition hover:bg-cyan-500/10 hover:border-cyan-400/50"
              >
                Crear cuenta
              </RouterLink>
            </div>
          </div>
        </div>
        <div class="order-1 md:order-2 flex items-center justify-center">
          <!-- IMAGEN NECESARIA:
               - Aspecto ratio: 1:1 (cuadrada) o 4:3 (horizontal)
               - Tamaño recomendado: 600x600px o 800x600px
               - Contenido: Mockup de chat, perfiles conectados, notificaciones
               - Estilo: Social, conexiones, mensajes, comunidad
               - Colores: Cyan/Blue theme
               - Formato: PNG con transparencia o JPG
          -->
          <div class="w-full aspect-square max-w-md rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 flex items-center justify-center">
            <div class="text-center p-8">
              <svg class="w-32 h-32 mx-auto text-cyan-400/50 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
              </svg>
              <p class="text-slate-400 text-sm">Colocá aquí imagen de comunidad</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Features grid (mantiene las cards originales al final) -->
    <div class="relative z-10 max-w-6xl mx-auto px-6 pb-20">
      <h2 class="text-2xl font-bold text-white text-center mb-8">Características Principales</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
        <!-- Feature 1: Games -->
        <div class="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/60 backdrop-blur-sm p-8 transition-all hover:border-emerald-400/30 hover:shadow-xl hover:shadow-emerald-500/10 hover:-translate-y-1">
          <div class="mb-4 inline-flex rounded-xl bg-emerald-500/10 p-3 ring-1 ring-emerald-400/20">
            <svg class="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 class="text-xl font-bold text-white mb-3">Minijuegos épicos</h3>
          <p class="text-slate-400 leading-relaxed">
            8 modos diferentes para poner a prueba tu conocimiento futbolístico. Desde adivinar jugadores hasta ordenar estadísticas.
          </p>
        </div>

        <!-- Feature 2: Progression -->
        <div class="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/60 backdrop-blur-sm p-8 transition-all hover:border-indigo-400/30 hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1">
          <div class="mb-4 inline-flex rounded-xl bg-indigo-500/10 p-3 ring-1 ring-indigo-400/20">
            <svg class="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 class="text-xl font-bold text-white mb-3">Sistema de progresión</h3>
          <p class="text-slate-400 leading-relaxed">
            Gana XP, sube de nivel, desbloquea logros épicos y compite por badges especiales como TOP 1, 2 y 3 del ranking global.
          </p>
        </div>

        <!-- Feature 3: Community -->
        <div class="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/60 backdrop-blur-sm p-8 transition-all hover:border-cyan-400/30 hover:shadow-xl hover:shadow-cyan-500/10 hover:-translate-y-1">
          <div class="mb-4 inline-flex rounded-xl bg-cyan-500/10 p-3 ring-1 ring-cyan-400/20">
            <svg class="w-8 h-8 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h3 class="text-xl font-bold text-white mb-3">Comunidad activa</h3>
          <p class="text-slate-400 leading-relaxed">
            Conectá con otros jugadores, armá tu red de contactos, y chateá en tiempo real sobre tus partidos y estadísticas.
          </p>
        </div>
      </div>
    </div>
  </section>
</template>