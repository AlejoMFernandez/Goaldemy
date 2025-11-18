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
          ¿Qué es GOALDEMY?
        </h1>
        <div class="h-1 w-20 rounded-full bg-gradient-to-r from-cyan-400 to-indigo-400"></div>
      </div>

      <!-- Main Content -->
      <div class="space-y-8">
        <!-- Intro Card -->
        <div class="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/60 backdrop-blur-sm p-8">
          <p class="text-slate-300 leading-relaxed">
            Una plataforma de juegos cortos para poner a prueba tu conocimiento del fútbol. Jugás, sumás XP, y mejorás tu ranking.
          </p>
        </div>

        <!-- How it Works -->
        <div class="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/60 backdrop-blur-sm p-8">
          <h3 class="text-xl font-bold text-white mb-6">¿Cómo funciona?</h3>
          <ul class="space-y-4">
            <li class="flex gap-3 items-start">
              <span class="text-slate-500 flex-shrink-0 mt-1">•</span>
              <div>
                <p class="text-white font-semibold mb-1">Desafíos diarios</p>
                <p class="text-slate-300 text-sm">Intentos limitados para poner a prueba tu memoria.</p>
              </div>
            </li>
            <li class="flex gap-3 items-start">
              <span class="text-slate-500 flex-shrink-0 mt-1">•</span>
              <div>
                <p class="text-white font-semibold mb-1">Modo libre</p>
                <p class="text-slate-300 text-sm">Practicá sin presión y mejorá de a poco.</p>
              </div>
            </li>
            <li class="flex gap-3 items-start">
              <span class="text-slate-500 flex-shrink-0 mt-1">•</span>
              <div>
                <p class="text-white font-semibold mb-1">Sistema de progresión</p>
                <p class="text-slate-300 text-sm">XP, niveles, rachas y logros.</p>
              </div>
            </li>
            <li class="flex gap-4 items-start">
              <div class="flex-shrink-0 w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center ring-1 ring-purple-400/20">
                <span class="text-lg">🏆</span>
              </div>
              <div>
                <p class="text-white font-semibold mb-1">Tablas de posiciones</p>
                <p class="text-slate-300 text-sm">Para competir con amigos y la comunidad.</p>
              </div>
            </li>
          </ul>
        </div>

        <!-- Objective -->
        <div class="rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 backdrop-blur-sm p-8">
          <h3 class="text-2xl font-bold text-white mb-4 flex items-center gap-2">
            <span class="text-indigo-400">🎯</span>
            Nuestro objetivo
          </h3>
          <p class="text-slate-300 text-lg leading-relaxed">
            Que aprendas y te diviertas. Queremos que cada partida sea corta, clara y con feedback inmediato, para que
            siempre sepas en qué estás mejorando: reconocimiento de jugadores, clubes, nacionalidades, posiciones, valores y más.
          </p>
        </div>

        <!-- What to Find -->
        <div class="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/60 backdrop-blur-sm p-8">
          <h3 class="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <span class="text-cyan-400">✨</span>
            Qué vas a encontrar
          </h3>
          <ul class="space-y-3">
            <li class="flex gap-3 text-slate-300">
              <span class="text-emerald-400 flex-shrink-0">🧩</span>
              <span>Juegos de reconocimiento visual (¿Quién es?, Nacionalidad, Posición, Camiseta, etc.).</span>
            </li>
            <li class="flex gap-3 text-slate-300">
              <span class="text-cyan-400 flex-shrink-0">📊</span>
              <span>Ordenamiento por edad, altura o valor de mercado, para entrenar contexto y estimación.</span>
            </li>
            <li class="flex gap-3 text-slate-300">
              <span class="text-indigo-400 flex-shrink-0">🔥</span>
              <span>Progresión diaria con registro de aciertos, errores y neutrales.</span>
            </li>
          </ul>
        </div>

        <!-- Feature Cards -->
        <div class="grid gap-6 md:grid-cols-3">
          <div class="rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 backdrop-blur-sm p-6 hover:border-emerald-400/30 transition">
            <div class="inline-flex rounded-lg bg-emerald-500/10 p-2 ring-1 ring-emerald-400/20 mb-4">
              <svg class="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div class="text-lg font-bold text-white mb-2">Desafíos diarios</div>
            <p class="text-slate-300 text-sm">Probá tu nivel cada día y sumá XP con límites claros.</p>
          </div>
          <div class="rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 backdrop-blur-sm p-6 hover:border-cyan-400/30 transition">
            <div class="inline-flex rounded-lg bg-cyan-500/10 p-2 ring-1 ring-cyan-400/20 mb-4">
              <svg class="w-6 h-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div class="text-lg font-bold text-white mb-2">Modo libre</div>
            <p class="text-slate-300 text-sm">Entrená sin presión, ideal para afinar el ojo.</p>
          </div>
          <div class="rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 backdrop-blur-sm p-6 hover:border-indigo-400/30 transition">
            <div class="inline-flex rounded-lg bg-indigo-500/10 p-2 ring-1 ring-indigo-400/20 mb-4">
              <svg class="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div class="text-lg font-bold text-white mb-2">Progresión</div>
            <p class="text-slate-300 text-sm">Niveles, rachas y logros para que avances con propósito.</p>
          </div>
        </div>

        <!-- CTA -->
        <div class="rounded-2xl border border-cyan-400/30 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 backdrop-blur-sm p-8 text-center">
          <p class="text-slate-300 text-lg mb-6">
            ¿Listo para jugar? Probá los desafíos diarios, entrená sin límites o mirá cómo vas en el ranking.
          </p>
          <div class="flex flex-wrap gap-4 justify-center">
            <RouterLink to="/play/points" class="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-6 py-3 font-semibold text-white transition hover:shadow-lg hover:shadow-emerald-500/50 hover:scale-105">
              PlayPoints
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </RouterLink>
            <RouterLink to="/play/free" class="inline-flex items-center gap-2 rounded-xl border border-cyan-400/30 px-6 py-3 font-semibold text-cyan-400 transition hover:bg-cyan-500/10 hover:border-cyan-400/50">
              PlayFree
            </RouterLink>
            <RouterLink to="/leaderboards" class="inline-flex items-center gap-2 rounded-xl border border-indigo-400/30 px-6 py-3 font-semibold text-indigo-400 transition hover:bg-indigo-500/10 hover:border-indigo-400/50">
              Leaderboards
            </RouterLink>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
