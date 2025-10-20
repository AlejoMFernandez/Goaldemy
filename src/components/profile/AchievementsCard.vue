<script setup>
defineProps({
  achievements: { type: Array, required: true },
  loading: { type: Boolean, default: false },
})
</script>

<template>
  <div class="rounded-lg border border-white/10 p-4 w-full">
    <div class="flex items-center justify-between">
<<<<<<< HEAD
      <p class="text-xs uppercase tracking-wide text-slate-400">Achievements</p>
=======
      <p class="text-xs uppercase tracking-wide text-slate-400">Logros</p>
>>>>>>> d0aeee3 (Opciones en Registro, agregado de logros y fix de XP)
      <span class="text-[10px] text-slate-400">{{ achievements.length }}</span>
    </div>
    <div class="mt-2 space-y-2 text-sm text-slate-300">
      <div v-if="loading">Cargando…</div>
      <template v-else>
        <div v-if="!achievements.length" class="text-slate-500">Aún no hay logros</div>
        <ul v-else class="space-y-2">
          <li v-for="(a, idx) in achievements" :key="idx" class="flex items-start gap-2">
            <img v-if="a.achievements?.icon_url" :src="a.achievements.icon_url" class="w-6 h-6 rounded" alt="icon" />
            <div class="min-w-0">
              <p class="text-slate-200 leading-tight">{{ a.achievements?.name || 'Logro' }}</p>
              <p v-if="a.achievements?.description" class="text-[11px] text-slate-400">{{ a.achievements.description }}</p>
              <p class="text-[11px] text-slate-400">{{ new Date(a.earned_at).toLocaleString() }}</p>
            </div>
          </li>
        </ul>
      </template>
    </div>
  </div>
</template>
