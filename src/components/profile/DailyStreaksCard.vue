<script>
export default {
  name: 'DailyStreaksCard',
  props: {
    items: { type: Array, default: () => [] }, // [{ slug, name, current, best }]
    loading: { type: Boolean, default: false },
  }
}
</script>

<template>
  <div class="rounded-lg border border-white/10 p-4 w-full">
    <p class="text-xs uppercase tracking-wide text-slate-400">Racha diaria por juego</p>
    <div v-if="loading" class="mt-2 space-y-2">
      <div v-for="i in 4" :key="i" class="h-6 rounded bg-white/10 animate-pulse"></div>
    </div>
    <div v-else>
      <p v-if="!items.length" class="mt-2 text-sm text-slate-400">Sin datos todavía</p>
      <ul v-else class="mt-2 divide-y divide-white/10">
        <li v-for="g in items" :key="g.slug" class="py-2 grid grid-cols-3 gap-2 items-center text-sm">
          <span class="text-slate-200 truncate">{{ g.name }}</span>
          <span class="text-emerald-300 text-center">Actual: ×{{ g.current || 0 }}</span>
          <span class="text-sky-300 text-right">Mejor: ×{{ g.best || 0 }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>
