<script setup>
import { useRouter } from 'vue-router'
import AppButton from '../components/common/AppButton.vue'

const router = useRouter()
const goBack = () => {
  if (window.history.length > 1) router.back()
  else router.push('/')
}
</script>

<template>
  <section class="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
    <div class="w-24 h-24 rounded-2xl flex items-center justify-center ring-1 ring-red-400/40 bg-red-500/20 shadow-[0_0_24px_rgba(239,68,68,0.3)] rotate-[-8deg]">
      <svg viewBox="0 0 100 100" class="w-11 h-11" xmlns="http://www.w3.org/2000/svg">
        <rect x="28" y="14" width="44" height="66" rx="6" fill="#ef4444" stroke="#fca5a5" stroke-width="3" />
      </svg>
    </div>

    <p class="mt-8 font-display text-7xl md:text-9xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
      404
    </p>
    <h1 class="mt-2 font-display text-2xl md:text-3xl font-bold text-white">
      ¡Fuera de juego!
    </h1>
    <p class="mt-3 max-w-md text-slate-400">
      La página que buscás no existe.
    </p>

    <div class="mt-8 flex flex-col sm:flex-row items-center gap-3">
      <RouterLink to="/">
        <AppButton>Volver al inicio</AppButton>
      </RouterLink>
      <button
        type="button"
        @click="goBack"
        class="px-4 py-2.5 font-medium text-slate-400 hover:text-white transition"
      >
        Volver atrás
      </button>
    </div>
  </section>
</template>
