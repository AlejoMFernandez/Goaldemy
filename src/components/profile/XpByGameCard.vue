<script setup>
defineProps({
  items: { type: Array, required: true },
  loading: { type: Boolean, default: false },
})
</script>

<template>
  <div class="rounded-lg border border-white/10 p-4 w-full">
    <p class="text-xs uppercase tracking-wide text-slate-400">XP por juego</p>
    <div class="mt-2 text-sm text-slate-300 space-y-2">
      <div v-if="loading">Cargando…</div>
      <template v-else>
        <div v-if="!items.length" class="text-slate-500">Aún no hay XP registrada por juego</div>
        <ul v-else class="space-y-2">
          <li v-for="g in items" :key="g.id" class="flex items-center gap-2">
            <img v-if="g.cover_url" :src="g.cover_url" class="w-6 h-6 rounded object-cover" alt="cover" />
            <span class="text-slate-200 truncate">{{ g.name }}</span>
            <span class="ml-auto text-slate-100 font-medium">{{ g.xp }} XP</span>
          </li>
        </ul>
      </template>
    </div>
  </div>
</template>
