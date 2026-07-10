<script>
import { RouterLink } from 'vue-router';
import GoaldemyLogo from './GoaldemyLogo.vue'

export default {
  name: 'AppFooter',
  components: { RouterLink, GoaldemyLogo }
}
</script>

<template>
  <footer class="relative border-t border-white/10 bg-gradient-to-t from-slate-900/90 to-slate-900/40 backdrop-blur">
    <div class="container mx-auto px-6 pt-10 pb-24">
      <!-- Main footer content -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
        
        <!-- Brand Column -->
        <div class="space-y-4">
          <GoaldemyLogo variant="full" size="md" />
          <p class="text-slate-400 text-sm leading-relaxed max-w-xs">
            La plataforma de aprendizaje gamificado de fútbol que transforma tu pasión en progreso.
          </p>
          <div class="flex items-center gap-3">
            <a href="https://www.instagram.com/goaldemyapp/" target="_blank" rel="noopener" aria-label="Instagram de Goaldemy" class="group inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition hover:border-pink-400/40 hover:text-pink-400 hover:bg-pink-500/5">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"></path>
              </svg>
            </a>
          </div>
        </div>

        <!-- Quick Links -->
        <div>
          <h3 class="text-white font-semibold mb-4">Enlaces rápidos</h3>
          <ul class="space-y-2 text-sm">
            <li><RouterLink to="/play/points" class="text-slate-400 hover:text-emerald-400 transition">Jugar por Puntos</RouterLink></li>
            <li><RouterLink to="/reto" class="text-slate-400 hover:text-emerald-400 transition">Reto del día</RouterLink></li>
            <li><RouterLink to="/leaderboards" class="text-slate-400 hover:text-emerald-400 transition">Ranking</RouterLink></li>
            <li><RouterLink to="/profile" class="text-slate-400 hover:text-emerald-400 transition">Mi Perfil</RouterLink></li>
          </ul>
        </div>

        <!-- About -->
        <div>
          <h3 class="text-white font-semibold mb-4">Acerca de</h3>
          <ul class="space-y-2 text-sm">
            <li><RouterLink to="/about/goaldemy" class="text-slate-400 hover:text-cyan-400 transition">¿Qué es Goaldemy?</RouterLink></li>
            <li><RouterLink to="/about/objetivo" class="text-slate-400 hover:text-cyan-400 transition">Nuestro Objetivo</RouterLink></li>
            <li><RouterLink to="/about/me" class="text-slate-400 hover:text-cyan-400 transition">¿Quién soy?</RouterLink></li>
            <li><a href="mailto:fernandezmalejo@gmail.com" class="text-slate-400 hover:text-cyan-400 transition">Contacto</a></li>
          </ul>
        </div>
      </div>

      <!-- Bottom bar -->
      <div class="border-t border-white/10 pt-6 flex flex-col gap-2 md:flex-row md:items-center md:justify-between text-sm text-slate-400">
        <p>© 2026 <span class="text-cyan-400 font-semibold">GOALDEMY</span>. Todos los derechos reservados.</p>
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
  </footer>
</template>

