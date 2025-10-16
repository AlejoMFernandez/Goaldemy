<script setup>
defineProps({
  avatarInitial: { type: String, required: true },
  displayName: { type: String, required: true },
  email: { type: String, required: false, default: '' },
  career: { type: String, required: false, default: '' },
  bio: { type: String, required: false, default: '' },
})
</script>

<template>
  <div class="card p-6 flex flex-col gap-4">
    <div class="flex items-center gap-4">
      <div class="relative grid place-items-center size-16 rounded-2xl bg-gradient-to-br from-[oklch(0.70_0.21_270)] to-[oklch(0.55_0.21_270)] text-white font-extrabold text-xl shadow-lg">
        <span>{{ avatarInitial }}</span>
      </div>
      <div class="min-w-0">
        <p class="text-sm uppercase tracking-wide text-slate-400">Usuario</p>
        <p class="truncate text-lg font-semibold text-white">{{ displayName }}</p>
        <p class="text-slate-300 text-sm">{{ email || '—' }}</p>
      </div>
    </div>
    <div>
      <p class="text-xs uppercase tracking-wide text-slate-400">Carrera</p>
      <p class="mt-1 text-slate-100">{{ career || 'No establecida' }}</p>
    </div>
    <div>
      <p class="text-xs uppercase tracking-wide text-slate-400">Biografía</p>
      <p class="mt-1 whitespace-pre-line text-slate-300 text-sm">{{ bio || 'No establecida' }}</p>
    </div>
  </div>
</template>
