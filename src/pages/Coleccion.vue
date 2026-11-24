<script setup>
/**
 * COLECCIÓN — 2ª pestaña de la tab bar. Reusa CosmeticsCollection (la misma
 * vitrina de íconos/bordes/banners/títulos que vive en Editar perfil), así
 * equipar algo es un toque desde la navegación principal y no queda escondido
 * dentro de un formulario. La pestaña "Detalles" lleva a Editar perfil.
 */
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { shellState } from '../components/shell/shell-state'
import { asyncHub } from '../components/shell/async-hub'

const CosmeticsCollection = asyncHub(() => import('../components/profile/CosmeticsCollection.vue'))
const name = computed(() => shellState.user?.display_name || shellState.user?.email || '')
const initial = computed(() => ((name.value || '?').trim()[0] || '?').toUpperCase())
</script>

<template>
  <section class="max-w-4xl mx-auto -mt-4 lg:mt-0">
    <div class="flex items-end justify-between gap-3 mb-4">
      <div>
        <h1 class="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">Colección</h1>
        <p class="text-slate-400 text-sm mt-0.5">Equipá íconos, bordes, banners y títulos.</p>
      </div>
      <RouterLink to="/tienda" class="shrink-0 inline-flex items-center gap-1.5 min-h-[40px] rounded-xl border border-amber-400/35 bg-amber-500/10 px-3 text-xs font-bold text-amber-200 active:scale-95 transition">
        Conseguir más
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4"><path d="M9 6l6 6-6 6"/></svg>
      </RouterLink>
    </div>
    <CosmeticsCollection class="block" :avatar-url="shellState.user?.avatar_url || ''" :name="name" :initial="initial">
      <template #datos>
        <div class="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
          <p class="text-slate-300 text-sm">Nombre, equipo y jugador favorito se editan en tu perfil.</p>
          <RouterLink to="/profile-edit" class="mt-4 inline-flex min-h-[44px] items-center rounded-xl px-5 font-bold text-sm text-slate-900 bg-gradient-to-b from-amber-300 to-amber-500">Editar perfil</RouterLink>
        </div>
      </template>
    </CosmeticsCollection>
  </section>
</template>
