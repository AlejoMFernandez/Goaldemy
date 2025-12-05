<script setup>
import { RouterLink } from 'vue-router'
import GoaldemyLogo from '../components/GoaldemyLogo.vue'
</script>

<template>
  <section class="relative min-h-screen overflow-hidden">
    <!-- Aurora background -->
    <div aria-hidden="true" class="aurora-root">
      <div class="accent"></div>
    </div>

    <div class="relative z-10 max-w-6xl mx-auto px-6">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-2xl md:text-3xl font-bold text-white mb-3">
          Nuestro Objetivo
        </h1>
        <div class="h-1 w-20 rounded-full bg-gradient-to-r from-cyan-400 to-indigo-400"></div>
      </div>

      <!-- Main Content -->
      <div class="space-y-8">
        <!-- Mission Statement -->
        <div class="rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 backdrop-blur-sm p-8 text-center">
          <p class="text-slate-200 text-lg md:text-xl leading-relaxed font-semibold">
            Mejorar tu conocimiento del fútbol con juegos cortos y medibles.
          </p>
        </div>

        <!-- What Guides Us -->
        <div class="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/60 backdrop-blur-sm p-8">
          <h3 class="text-xl font-bold text-white mb-6">Lo que nos guía</h3>
          <ul class="space-y-4">
            <li class="flex gap-3 items-start">
              <span class="text-slate-500 flex-shrink-0 mt-1">•</span>
              <div>
                <p class="text-white font-semibold mb-1">Aprendizaje basado en el juego</p>
                <p class="text-slate-300 text-sm">Sesiones cortas con feedback inmediato.</p>
              </div>
            </li>
            <li class="flex gap-3 items-start">
              <span class="text-slate-500 flex-shrink-0 mt-1">•</span>
              <div>
                <p class="text-white font-semibold mb-1">Progresión visible</p>
                <p class="text-slate-300 text-sm">XP, niveles, rachas y logros.</p>
              </div>
            </li>
            <li class="flex gap-3 items-start">
              <span class="text-slate-500 flex-shrink-0 mt-1">•</span>
              <div>
                <p class="text-white font-semibold mb-1">Desafíos variados</p>
                <p class="text-slate-300 text-sm">Reconocimiento visual, contexto de jugador, clubes y más.</p>
              </div>
            </li>
            <li class="flex gap-4 items-start">
              <div class="flex-shrink-0 w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center ring-1 ring-purple-400/20">
                <span class="text-lg">🤝</span>
              </div>
            </li>
            <li class="flex gap-3 items-start">
              <span class="text-slate-500 flex-shrink-0 mt-1">•</span>
              <div>
                <p class="text-white font-semibold mb-1">Competencia sana</p>
                <p class="text-slate-300 text-sm">Tablas públicas y desafíos con amigos.</p>
              </div>
            </li>
          </ul>
        </div>

        <!-- How We Measure -->
        <div class="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/60 backdrop-blur-sm p-8">
          <h3 class="text-xl font-bold text-white mb-6">¿Cómo medimos?</h3>
          <div class="grid gap-4 md:grid-cols-2">
            <div class="flex gap-3 items-start">
              <span class="text-emerald-400 flex-shrink-0 font-bold text-lg">✓</span>
              <div>
                <p class="text-white font-semibold text-sm">Aciertos</p>
                <p class="text-slate-400 text-xs mt-0.5">Por día y por juego.</p>
              </div>
            </div>
            <div class="flex gap-3 items-start">
              <span class="text-red-400 flex-shrink-0 font-bold text-lg">✕</span>
              <div>
                <p class="text-white font-semibold text-sm">Errores</p>
                <p class="text-slate-400 text-xs mt-0.5">Para aprender de cada intento.</p>
              </div>
            </div>
            <div class="flex gap-3 items-start">
              <span class="text-indigo-400 flex-shrink-0 font-bold text-lg">↑</span>
              <div>
                <p class="text-white font-semibold text-sm">XP</p>
                <p class="text-slate-400 text-xs mt-0.5">Por partida y nivel.</p>
              </div>
            </div>
            <div class="flex gap-3 items-start">
              <span class="text-cyan-400 flex-shrink-0 font-bold text-lg">🔥</span>
              <div>
                <p class="text-white font-semibold text-sm">Rachas</p>
                <p class="text-slate-400 text-xs mt-0.5">Días consecutivos jugando.</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Contact CTA -->
        <div class="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/60 backdrop-blur-sm p-8 text-center">
          <h3 class="text-xl font-bold text-white mb-3">
            ¿Tenés ideas?
          </h3>
          <p class="text-slate-300 mb-6">
            Queremos escuchar tus ideas para mejorar.
          </p>
          <a 
            href="mailto:fernandezmalejo@gmail.com" 
            class="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-3 font-semibold text-white transition hover:shadow-lg hover:shadow-cyan-500/50 hover:scale-105"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5">
              <path d="M1.5 6.75A2.25 2.25 0 0 1 3.75 4.5h16.5A2.25 2.25 0 0 1 22.5 6.75v10.5A2.25 2.25 0 0 1 20.25 19.5H3.75A2.25 2.25 0 0 1 1.5 17.25V6.75Zm2.784-.75 7.063 5.297a.75.75 0 0 0 .906 0l7.063-5.297H4.284Z"/>
            </svg>
            Contactanos
          </a>
        </div>
      </div>
    </div>
  </section>
</template>
