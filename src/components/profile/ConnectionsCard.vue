<script setup>
defineProps({
  followerCount: { type: Number, default: 0 },
  followingCount: { type: Number, default: 0 },
  groupCount: { type: Number, default: 0 },
})
</script>

<template>
  <div class="card p-6">
    <p class="text-xs uppercase tracking-wide text-slate-400">Conexiones</p>
    <div class="mt-2 grid grid-cols-3 gap-2 text-center">
      <div class="rounded-lg border border-white/10 p-3">
        <p class="text-[10px] uppercase tracking-wider text-slate-400">Followers</p>
        <p class="text-white text-lg font-semibold">{{ followerCount }}</p>
      </div>
      <div class="rounded-lg border border-white/10 p-3">
        <p class="text-[10px] uppercase tracking-wider text-slate-400">Following</p>
        <p class="text-white text-lg font-semibold">{{ followingCount }}</p>
      </div>
      <div class="rounded-lg border border-white/10 p-3">
        <p class="text-[10px] uppercase tracking-wider text-slate-400">Groups</p>
        <p class="text-white text-lg font-semibold">{{ groupCount }}</p>
      </div>
    </div>
  </div>
</template>
