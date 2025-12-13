<script setup>
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
          ¿Quién soy?
        </h1>
        <div class="h-1 w-20 rounded-full bg-gradient-to-r from-cyan-400 to-indigo-400"></div>
      </div>

      <!-- Main Content -->
      <div class="grid gap-8 lg:grid-cols-3">
        <!-- Profile Card -->
        <aside class="lg:col-span-1">
          <div class="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/60 backdrop-blur-sm p-8 text-center sticky top-24">
            <img
              src="/me.jpeg"
              alt="Foto del creador de GOALDEMY"
              class="w-40 h-40 mx-auto rounded-full object-cover ring-4 ring-white/10 mb-4 shadow-2xl"
              loading="lazy"
            />
            <h2 class="text-white font-bold text-xl tracking-tight mb-2">Alejo Fernández</h2>
            <span class="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold text-cyan-300 border border-cyan-400/30 bg-cyan-500/10">
              Creador de GOALDEMY
            </span>
            <p class="mt-6 text-slate-300 text-sm leading-relaxed">
              Desarrollador y fanático del fútbol. Creo productos que combinan aprendizaje, diseño y comunidad.
            </p>
            
            <!-- Social Links -->
            <div class="mt-6 flex items-center justify-center gap-3">
              <a
                class="inline-flex items-center justify-center w-10 h-10 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition"
                href="mailto:fernandezmalejo@gmail.com"
                aria-label="Contactar por email"
                title="Email"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-slate-200">
                  <path d="M1.5 6.75A2.25 2.25 0 0 1 3.75 4.5h16.5A2.25 2.25 0 0 1 22.5 6.75v10.5A2.25 2.25 0 0 1 20.25 19.5H3.75A2.25 2.25 0 0 1 1.5 17.25V6.75Zm2.784-.75 7.063 5.297a.75.75 0 0 0 .906 0l7.063-5.297H4.284Z"/>
                </svg>
              </a>
              <a
                class="inline-flex items-center justify-center w-10 h-10 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition"
                href="https://www.linkedin.com/"
                target="_blank" rel="noopener noreferrer"
                aria-label="LinkedIn"
                title="LinkedIn"
              >
                <img src="/social/linkedinmain.png" alt="LinkedIn" class="w-5 h-5" />
              </a>
              <a
                class="inline-flex items-center justify-center w-10 h-10 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition"
                href="https://github.com/"
                target="_blank" rel="noopener noreferrer"
                aria-label="GitHub"
                title="GitHub"
              >
                <img src="/social/githubmain.png" alt="GitHub" class="w-5 h-5" />
              </a>
              <a
                class="inline-flex items-center justify-center w-10 h-10 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition"
                href="https://www.instagram.com/"
                target="_blank" rel="noopener noreferrer"
                aria-label="Instagram"
                title="Instagram"
              >
                <img src="/social/igmain.png" alt="Instagram" class="w-5 h-5" />
              </a>
            </div>
          </div>
        </aside>

        <!-- Bio Content -->
        <article class="lg:col-span-2 space-y-8">
          <div class="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/60 backdrop-blur-sm p-8">
            <p class="text-slate-300 leading-relaxed mb-6">
              <strong>GOALDEMY</strong> nació como un proyecto personal para aprender mientras jugaba. La idea era simple: usar el fútbol 
              como excusa para entrenar memoria, estimación y reconocimiento visual.
            </p>

            <h3 class="text-xl font-bold text-white mb-2">En qué me enfoco</h3>
            <ul class="space-y-1 mb-6">
              <li class="flex gap-3 text-slate-300">
                <span class="text-slate-500 flex-shrink-0">•</span>
                <span>Juegos cortos con feedback claro.</span>
              </li>
              <li class="flex gap-3 text-slate-300">
                <span class="text-slate-500 flex-shrink-0">•</span>
                <span>Progresión visible: XP, rachas y logros.</span>
              </li>
              <li class="flex gap-3 text-slate-300">
                <span class="text-slate-500 flex-shrink-0">•</span>
                <span>Código limpio y mantenible.</span>
              </li>
              <li class="flex gap-3 text-slate-300">
                <span class="text-slate-500 flex-shrink-0">•</span>
                <span>Escuchar a la comunidad y mejorar.</span>
              </li>
            </ul>

            <h3 class="text-xl font-bold text-white mb-2">Qué estoy haciendo</h3>
            <ul class="space-y-1">
              <li class="flex gap-3 text-slate-300">
                <span class="text-slate-500 flex-shrink-0">•</span>
                <span>Agregando nuevos juegos y puliendo los existentes.</span>
              </li>
              <li class="flex gap-3 text-slate-300">
                <span class="text-slate-500 flex-shrink-0">•</span>
                <span>Mejorando el sistema de scoring y recompensas.</span>
              </li>
              <li class="flex gap-3 text-slate-300">
                <span class="text-slate-500 flex-shrink-0">•</span>
                <span>Optimizando la experiencia mobile.</span>
              </li>
            </ul>
          </div>

          <!-- Skills Cards -->
          <div class="grid gap-4 md:grid-cols-3">
            <div class="rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 backdrop-blur-sm p-6 hover:border-emerald-400/30 transition">
              <div class="inline-flex rounded-lg bg-emerald-500/10 p-2 ring-1 ring-emerald-400/20 mb-3">
                <svg class="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div class="text-lg font-bold text-white mb-2">Producto</div>
              <p class="text-slate-300 text-sm">Definir reglas claras, flujos y métricas de éxito.</p>
            </div>
            <div class="rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 backdrop-blur-sm p-6 hover:border-indigo-400/30 transition">
              <div class="inline-flex rounded-lg bg-indigo-500/10 p-2 ring-1 ring-indigo-400/20 mb-3">
                <svg class="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
              </div>
              <div class="text-lg font-bold text-white mb-2">Diseño</div>
              <p class="text-slate-300 text-sm">Simplicidad visual, contraste y micro‑interacciones.</p>
            </div>
            <div class="rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 backdrop-blur-sm p-6 hover:border-cyan-400/30 transition">
              <div class="inline-flex rounded-lg bg-cyan-500/10 p-2 ring-1 ring-cyan-400/20 mb-3">
                <svg class="w-6 h-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              </div>
              <div class="text-lg font-bold text-white mb-2">Desarrollo</div>
              <p class="text-slate-300 text-sm">Vue 3, Tailwind, Supabase y código mantenible.</p>
            </div>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>


