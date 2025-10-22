<template>
  <section class="container mx-auto px-4 py-4 md:py-8">
    <div class="mb-6">
      <h1 class="text-2xl md:text-4xl font-bold text-white flex items-center gap-3">
        <span>¿Quién soy?</span>
        <span class="text-2xl md:text-3xl" aria-hidden>👋</span>
      </h1>
      <div class="h-1 mt-3 w-24 rounded-full" style="background: linear-gradient(90deg, #22d3ee, #6366f1);"></div>
    </div>

    <div class="grid gap-6 md:grid-cols-3">
      <!-- Perfil -->
      <aside class="card p-5 md:p-6 flex flex-col items-center text-center self-start">
        <img
          src="/me.jpeg"
          alt="Foto del creador de Goaldemy"
          class="w-40 h-40 md:w-44 md:h-44 rounded-full object-cover ring-2 ring-white/15 mb-3"
          loading="lazy"
        />
        <h2 class="text-white font-bold text-lg tracking-tight">Alejo Fernández</h2>
        <span class="mt-1 inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-semibold text-sky-200 border border-white/10 bg-white/5">
          Creador de Goaldemy
        </span>
        <p class="mt-4 text-slate-200 text-sm leading-relaxed">
          Soy el creador de Goaldemy. Me encanta combinar fútbol, diseño de producto y desarrollo para crear experiencias que motiven a aprender jugando.
        </p>
        <div class="mt-5 flex items-center gap-3">
          <a
            class="inline-flex items-center justify-center w-10 h-10 rounded-full hover:scale-105 transition"
            href="mailto:fernandezmalejo@gmail.com"
            aria-label="Contactar por email"
            title="Email"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6 text-slate-200">
              <path d="M1.5 6.75A2.25 2.25 0 0 1 3.75 4.5h16.5A2.25 2.25 0 0 1 22.5 6.75v10.5A2.25 2.25 0 0 1 20.25 19.5H3.75A2.25 2.25 0 0 1 1.5 17.25V6.75Zm2.784-.75 7.063 5.297a.75.75 0 0 0 .906 0l7.063-5.297H4.284Z"/>
            </svg>
          </a>
          <a
            class="inline-flex items-center justify-center w-10 h-10 rounded-full hover:scale-105 transition"
            href="https://www.linkedin.com/"
            target="_blank" rel="noopener noreferrer"
            aria-label="LinkedIn"
            title="LinkedIn"
          >
            <img src="/social/linkedinmain.png" alt="LinkedIn" class="w-6 h-6" />
          </a>
          <a
            class="inline-flex items-center justify-center w-10 h-10 rounded-full hover:scale-105 transition"
            href="https://github.com/"
            target="_blank" rel="noopener noreferrer"
            aria-label="GitHub"
            title="GitHub"
          >
            <img src="/social/githubmain.png" alt="GitHub" class="w-6 h-6" />
          </a>
          <a
            class="inline-flex items-center justify-center w-10 h-10 rounded-full hover:scale-105 transition"
            href="https://www.instagram.com/"
            target="_blank" rel="noopener noreferrer"
            aria-label="Instagram"
            title="Instagram"
          >
            <img src="/social/igmain.png" alt="Instagram" class="w-6 h-6" />
          </a>
        </div>
      </aside>

      <!-- Bio -->
      <article class="md:col-span-2">
        <div class="prose prose-invert max-w-3xl">
          <p>
            Creo profundamente en el aprendizaje basado en el juego. Goaldemy nace de esa idea: usar el fútbol como
            motor para entrenar memoria, atención al detalle y conocimiento del deporte, de una forma amena y
            progresiva.
          </p>

          <h3>Lo que me mueve</h3>
          <ul>
            <li>⚽️ Fútbol como lenguaje común para aprender jugando.</li>
            <li>🎨 UX clara y estética: feedback inmediato, transiciones suaves, accesibilidad.</li>
            <li>💻 Código simple y mantenible: preferir lo legible y consistente.</li>
            <li>🤝 Comunidad primero: escuchar feedback y mejorar continuamente.</li>
          </ul>

          <h3>Hoy en Goaldemy</h3>
          <ul>
            <li>🧩 Construyendo micro‑juegos nuevos y pulidos.</li>
            <li>🧠 Ajustando scoring, rachas y logros para progresión justa.</li>
            <li>📱 Puliendo detalles en mobile: scroll, densidad y performance.</li>
          </ul>

          <div class="grid gap-4 md:grid-cols-3 mt-4">
            <div class="card p-4">
              <div class="text-lg font-semibold">Producto</div>
              <p class="text-slate-300 text-sm mt-1">Definir reglas claras, flujos y métricas de éxito.</p>
            </div>
            <div class="card p-4">
              <div class="text-lg font-semibold">Diseño</div>
              <p class="text-slate-300 text-sm mt-1">Simplicidad visual, contraste y micro‑interacciones.</p>
            </div>
            <div class="card p-4">
              <div class="text-lg font-semibold">Código</div>
              <p class="text-slate-300 text-sm mt-1">Vue + Vite, componentes limpios y servicios claros.</p>
            </div>
          </div>

          <p class="mt-4 mb-0">
            ¿Querés proponer ideas o colaborar? Escribime cuando quieras:
            <a href="mailto:fernandezmalejo@gmail.com" class="text-sky-300 hover:text-sky-200">fernandezmalejo@gmail.com</a>.
          </p>
        </div>
      </article>
    </div>
  </section>
</template>
