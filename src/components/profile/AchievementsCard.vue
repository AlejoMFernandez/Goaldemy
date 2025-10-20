<script setup>
defineProps({
  achievements: { type: Array, required: true },
  loading: { type: Boolean, default: false },
})
</script>

<template>
  <div class="rounded-lg border border-white/10 p-4 w-full">
    <div class="flex items-center justify-between">
      <p class="text-xs uppercase tracking-wide text-slate-400">Logros</p>
      <span class="text-[10px] text-slate-400">{{ achievements.length }}</span>
    </div>
    <div class="mt-3 text-sm text-slate-300">
      <div v-if="loading">Cargando…</div>
      <template v-else>
        <div v-if="!achievements.length" class="text-slate-500">Aún no hay logros</div>
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div
            v-for="(a, idx) in achievements"
            :key="idx"
            class="relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-slate-900/70 to-slate-800/40 p-3 hover:border-white/20 transition">
            <div class="flex items-start gap-3">
              <img v-if="a.achievements?.icon_url" :src="a.achievements.icon_url" class="w-10 h-10 rounded" alt="icon" />
              <div v-else class="w-10 h-10 rounded bg-slate-700 flex items-center justify-center text-slate-300">🏆</div>
              <div class="min-w-0 flex-1">
                <p class="text-slate-100 font-semibold leading-tight truncate">{{ a.achievements?.name || 'Logro' }}</p>
                <p v-if="a.achievements?.description" class="text-[11px] text-slate-400 line-clamp-2">{{ a.achievements.description }}</p>
              </div>
            </div>
            <div class="mt-2 flex items-center justify-between text-[11px]">
              <span class="text-emerald-300 font-semibold">+{{ a.achievements?.points ?? 0 }} XP</span>
              <span class="text-slate-400">{{ new Date(a.earned_at).toLocaleDateString() }}</span>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
  
</template>
