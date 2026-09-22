<script>
import { RouterLink } from 'vue-router';
import FulvoLogo from './FulvoLogo.vue'

export default {
  name: 'AppFooter',
  components: { RouterLink, FulvoLogo }
}
</script>

<template>
  <footer class="relative border-t border-white/10 bg-gradient-to-t from-slate-900/90 to-slate-900/40 backdrop-blur">
    <div class="container mx-auto px-6 pt-10 pb-24">
      <!-- Main footer content -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
        
        <!-- Brand Column -->
        <div class="space-y-4">
          <FulvoLogo variant="full" size="md" />
          <p class="text-slate-400 text-sm leading-relaxed max-w-xs">
            La plataforma de aprendizaje gamificado de fútbol que transforma tu pasión en progreso.
          </p>
          <div class="flex items-center gap-3">
            <a href="https://www.instagram.com/fulvoapp/" target="_blank" rel="noopener" aria-label="Instagram de Fulvo" class="group inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition hover:border-pink-400/40 hover:text-pink-400 hover:bg-pink-500/5">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"></path>
              </svg>
            </a>
            <a href="https://www.tiktok.com/@fulvoapp" target="_blank" rel="noopener" aria-label="TikTok de Fulvo" class="group inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition hover:border-white/40 hover:text-white hover:bg-white/5">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M16.6 5.82s.51.5 0 0A4.278 4.278 0 0 1 15.54 3h-3.09v12.4a2.592 2.592 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.24-1.48z"></path>
              </svg>
            </a>
            <a href="https://www.youtube.com/@jugafulvo" target="_blank" rel="noopener" aria-label="YouTube de Fulvo" class="group inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition hover:border-red-400/40 hover:text-red-400 hover:bg-red-500/5">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"></path>
              </svg>
            </a>
          </div>
        </div>

        <!-- Quick Links -->
        <div>
          <h3 class="text-white font-semibold mb-4">Enlaces rápidos</h3>
          <ul class="space-y-2 text-sm">
            <li><RouterLink to="/play/points" class="text-slate-400 hover:text-emerald-400 transition">Jugar por Puntos</RouterLink></li>
            <li><RouterLink to="/games/guess-player?mode=challenge" class="text-slate-400 hover:text-emerald-400 transition">Jugá gratis</RouterLink></li>
            <li><RouterLink to="/carrera" class="text-slate-400 hover:text-emerald-400 transition">Modo Carrera</RouterLink></li>
            <li><RouterLink to="/leaderboards" class="text-slate-400 hover:text-emerald-400 transition">Ranking</RouterLink></li>
            <li><RouterLink to="/profile" class="text-slate-400 hover:text-emerald-400 transition">Mi Perfil</RouterLink></li>
          </ul>
        </div>

        <!-- About -->
        <div>
          <h3 class="text-white font-semibold mb-4">Acerca de</h3>
          <ul class="space-y-2 text-sm">
            <li><RouterLink to="/about/fulvo" class="text-slate-400 hover:text-cyan-400 transition">¿Qué es Fulvo?</RouterLink></li>
            <li><RouterLink to="/about/objetivo" class="text-slate-400 hover:text-cyan-400 transition">Nuestro Objetivo</RouterLink></li>
            <li><RouterLink to="/about/me" class="text-slate-400 hover:text-cyan-400 transition">¿Quién soy?</RouterLink></li>
            <li><a href="mailto:fernandezmalejo@gmail.com" class="text-slate-400 hover:text-cyan-400 transition">Contacto</a></li>
          </ul>
        </div>
      </div>

      <!-- Bottom bar -->
      <div class="border-t border-white/10 pt-6 flex flex-col gap-2 md:flex-row md:items-center md:justify-between text-sm text-slate-400">
        <p>© 2026 <span class="text-cyan-400 font-semibold">FULVO</span>. Todos los derechos reservados.</p>
        <div class="flex items-center gap-4">
          <RouterLink to="/privacidad" class="text-slate-400 hover:text-cyan-400 transition">Privacidad</RouterLink>
          <RouterLink to="/terminos" class="text-slate-400 hover:text-cyan-400 transition">Términos</RouterLink>
          <p class="text-slate-400">
            Desarrollado por
            <a
              href="https://alejomfernandez.com.ar"
              target="_blank"
              rel="noopener"
              class="font-semibold text-cyan-400 underline underline-offset-2 hover:text-cyan-300 transition"
            >Alejo Martin Fernandez</a>
          </p>
        </div>
      </div>
    </div>
  </footer>
</template>

