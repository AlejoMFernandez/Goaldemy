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
    <div class="flex items-center justify-between">
      <p class="text-xs uppercase tracking-wide text-slate-400">Conexiones</p>
      <span class="text-[10px] text-slate-400">{{ connections.length }}</span>
    </div>
    <div class="mt-2">
      <div v-if="loading" class="text-slate-400 text-sm">Cargando…</div>
      <div v-else-if="!connections.length" class="text-slate-400 text-sm">Sin conexiones</div>
      <ul v-else class="grid gap-1.5">
        <li v-for="c in connections" :key="c.id" class="rounded-lg border border-white/10 p-2 hover:border-white/20 transition">
          <router-link :to="`/u/${c.id}`" class="flex items-center gap-2">
            <img v-if="c.avatar_url" :src="c.avatar_url" class="w-8 h-8 rounded-full object-cover" alt="avatar" />
            <div v-else class="w-8 h-8 rounded-full bg-slate-700 grid place-items-center text-xs text-slate-200">
              {{ ((c.display_name || c.email || '?').trim()[0] || '?').toUpperCase() }}
            </div>
            <div class="min-w-0">
              <div class="text-slate-100 text-sm truncate">{{ c.display_name || c.email || c.id }}</div>
            </div>
          </router-link>
        </li>
      </ul>
    </div>
  </div>
</template>
