<script setup>
/**
 * Estados de carga/error de las páginas hub nuevas (Social, Colección, home).
 *  <HubState loading /> → skeleton de cards
 *  <HubState error @retry="load" /> → mensaje + botón "Reintentar"
 */
defineProps({
  loading: { type: Boolean, default: false },
  error: { type: [Boolean, String], default: false },
  rows: { type: Number, default: 3 },
  message: { type: String, default: 'No pudimos cargar esta sección.' },
})
defineEmits(['retry'])
</script>

<template>
  <div v-if="loading" class="space-y-3" aria-busy="true" aria-label="Cargando">
    <div v-for="i in rows" :key="i" class="hub-skel rounded-2xl border border-white/10 bg-white/[0.03] h-20"></div>
  </div>
  <div v-else-if="error" class="rounded-2xl border border-rose-400/20 bg-rose-500/[0.06] p-6 text-center" role="alert">
    <p class="text-slate-200 font-semibold">{{ typeof error === 'string' ? error : message }}</p>
    <p class="text-slate-400 text-xs mt-1">Revisá tu conexión y probá de nuevo.</p>
    <button type="button" class="mt-4 min-h-[44px] rounded-xl px-5 font-bold text-sm text-slate-900 bg-gradient-to-b from-amber-300 to-amber-500 active:scale-95 transition" @click="$emit('retry')">
      Reintentar
    </button>
  </div>
</template>

<style scoped>
.hub-skel { position: relative; overflow: hidden; }
.hub-skel::after {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.06), transparent);
  transform: translateX(-100%); animation: hub-shimmer 1.3s ease-in-out infinite;
}
@keyframes hub-shimmer { to { transform: translateX(100%); } }
@media (prefers-reduced-motion: reduce) { .hub-skel::after { animation: none; } }
</style>
