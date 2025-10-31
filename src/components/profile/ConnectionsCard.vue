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
        <li v-for="c in connections" :key="c.id" class="rounded-lg border border-white/10 p-2 hover:border-white/20 transition overflow-hidden">
          <div class="flex items-center justify-between gap-2">
            <router-link :to="`/u/${c.id}`" class="flex items-center gap-2 min-w-0 flex-1">
              <img v-if="c.avatar_url" :src="c.avatar_url" class="w-7 h-7 rounded-full object-cover" alt="avatar" />
              <div v-else class="w-7 h-7 rounded-full bg-slate-700 grid place-items-center text-[11px] text-slate-200">
                {{ ((c.display_name || c.email || '?').trim()[0] || '?').toUpperCase() }}
              </div>
              <div class="min-w-0 max-w-full">
                <div class="text-slate-100 text-sm truncate">{{ c.display_name || c.email || c.id }}</div>
              </div>
            </router-link>
            <router-link :to="`/messages/${c.id}`" class="shrink-0 rounded-full h-8 w-8 grid place-items-center bg-white/5 border border-white/10 text-slate-200 hover:bg-white/10" :aria-label="`Enviar mensaje a ${c.display_name || c.email || c.id}`">
              <!-- message icon -->
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-4 w-4">
                <path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/>
              </svg>
            </router-link>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>
