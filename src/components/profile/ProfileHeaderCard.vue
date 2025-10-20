<script setup>
defineProps({
  avatarInitial: { type: String, required: true },
  avatarUrl: { type: String, required: false, default: '' },
  displayName: { type: String, required: true },
  email: { type: String, required: false, default: '' },
  career: { type: String, required: false, default: '' },
  bio: { type: String, required: false, default: '' },
  nationalityCode: { type: String, required: false, default: '' },
  favoriteTeam: { type: String, required: false, default: '' },
  favoritePlayer: { type: String, required: false, default: '' },
})
</script>

<template>
  <div class="card p-6 flex flex-col gap-4">
    <div class="flex items-center gap-4">
      <div class="relative size-16 rounded-2xl overflow-hidden shadow-lg bg-gradient-to-br from-[oklch(0.70_0.21_270)] to-[oklch(0.55_0.21_270)] text-white font-extrabold text-xl grid place-items-center">
        <img v-if="avatarUrl" :src="avatarUrl" alt="avatar" class="w-full h-full object-cover" />
        <span v-else>{{ avatarInitial }}</span>
      </div>
      <div class="min-w-0">
        <p class="text-sm uppercase tracking-wide text-slate-400">Usuario</p>
        <p class="truncate text-lg font-semibold text-white">{{ displayName }}</p>
        <p class="text-slate-300 text-sm">{{ email || '—' }}</p>
      </div>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
      <div>
        <p class="text-xs uppercase tracking-wide text-slate-400">Nacionalidad</p>
        <div class="mt-1 flex items-center gap-2 text-slate-100">
          <img v-if="nationalityCode" :src="`https://flagcdn.com/w40/${nationalityCode}.png`" :alt="nationalityCode" width="40" height="16" class="rounded ring-1 ring-white/10" />
          <span v-else>—</span>
        </div>
      </div>
      <div>
        <p class="text-xs uppercase tracking-wide text-slate-400">Equipo favorito</p>
        <p class="mt-1 text-slate-100">{{ favoriteTeam || '—' }}</p>
      </div>
      <div>
        <p class="text-xs uppercase tracking-wide text-slate-400">Jugador favorito</p>
        <p class="mt-1 text-slate-100">{{ favoritePlayer || '—' }}</p>
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
