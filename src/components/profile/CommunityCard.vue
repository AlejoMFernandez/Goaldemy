<script setup>
defineProps({
  forumsCount: { type: Number, default: 0 },
  messagesCount: { type: Number, default: 0 },
  discussionsStartedCount: { type: Number, default: 0 },
})
</script>

<template>
  <div class="card p-6">
    <p class="text-xs uppercase tracking-wide text-slate-400">Comunidad</p>
    <div class="mt-2 grid grid-cols-3 gap-2 text-center">
      <div class="rounded-lg border border-white/10 p-3">
        <p class="text-[10px] uppercase tracking-wider text-slate-400">Foros</p>
        <p class="text-white text-lg font-semibold">{{ forumsCount }}</p>
      </div>
      <div class="rounded-lg border border-white/10 p-3">
        <p class="text-[10px] uppercase tracking-wider text-slate-400">Mensajes</p>
        <p class="text-white text-lg font-semibold">{{ messagesCount }}</p>
      </div>
      <div class="rounded-lg border border-white/10 p-3">
        <p class="text-[10px] uppercase tracking-wider text-slate-400">Discusiones</p>
        <p class="text-white text-lg font-semibold">{{ discussionsStartedCount }}</p>
      </div>
    </div>
  </div>
</template>
