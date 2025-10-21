<script>
export default {
  name: 'MaxStreaksCard',
  props: {
    items: { type: Array, default: () => [] }, // [{ id, name, streak }]
    loading: { type: Boolean, default: false },
  }
}
</script>

<template>
  <div class="rounded-lg border border-white/10 p-4">
    <p class="text-xs uppercase tracking-wide text-slate-400">Racha máxima por juego</p>
    <div v-if="loading" class="mt-2 space-y-2">
      <div v-for="i in 3" :key="i" class="h-6 rounded bg-white/10 animate-pulse"></div>
    </div>
    <div v-else>
      <p v-if="!items.length" class="mt-2 text-sm text-slate-400">Sin datos todavía</p>
      <ul v-else class="mt-2 divide-y divide-white/10">
        <li v-for="g in items" :key="g.id" class="py-2 flex items-center justify-between text-sm">
          <span class="text-slate-200 truncate pr-2">{{ g.name || 'Juego' }}</span>
          <span class="text-slate-400">×{{ g.streak }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>
