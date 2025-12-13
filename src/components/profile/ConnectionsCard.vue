<script setup>
defineProps({
  followerCount: { type: Number, default: 0 },
  followingCount: { type: Number, default: 0 },
  groupCount: { type: Number, default: 0 },
  connections: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
})
</script>

<template>
  <div class="card p-6">
    <div class="flex items-center justify-between mb-3">
      <p class="text-xs uppercase tracking-wide text-slate-400">Conexiones</p>
      <span class="text-[10px] text-slate-400">{{ connections.length }}</span>
    </div>
    <div v-if="loading" class="text-slate-400 text-sm">Cargando…</div>
    <div v-else-if="!connections.length" class="text-slate-400 text-sm">Sin conexiones</div>
    <div v-else class="grid grid-cols-6 gap-3">
      <router-link
        v-for="c in connections"
        :key="c.id"
        :to="`/u/${c.id}`"
        class="group relative flex flex-col items-center"
      >
        <!-- Avatar -->
        <div class="w-10 h-10 rounded-full overflow-hidden bg-slate-700 grid place-items-center text-xs text-slate-200 ring-2 ring-white/20 group-hover:ring-[oklch(0.62_0.21_270)] group-hover:scale-105 transition-all duration-200">
          <img v-if="c.avatar_url" :src="c.avatar_url" class="w-full h-full object-cover" alt="avatar" />
          <span v-else>{{ ((c.display_name || c.email || '?').trim()[0] || '?').toUpperCase() }}</span>
        </div>
        <!-- Tooltip on hover -->
        <div class="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-10 whitespace-nowrap">
          <div class="bg-slate-800/95 backdrop-blur-sm border border-white/20 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 shadow-xl">
            {{ c.display_name || c.email || c.id }}
          </div>
        </div>
      </router-link>
    </div>
  </div>
</template>

