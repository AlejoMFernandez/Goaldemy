<script setup>
import GoaldemyLogo from './GoaldemyLogo.vue'
</script>

<template>
  <section class="min-h-[40vh] flex flex-col items-center justify-center gap-6">
    <!-- Animated Logo -->
    <div class="animate-pulse">
      <GoaldemyLogo variant="icon" size="lg" />
    </div>
    
    <!-- Loading text with dots animation -->
    <div class="flex items-center gap-3 text-slate-200">
      <span class="relative flex h-3 w-3">
        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        <span class="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
      </span>
      <span class="text-sm font-medium">Cargando</span>
      <span class="flex gap-1">
        <span class="w-1 h-1 rounded-full bg-slate-400 animate-bounce" style="animation-delay: 0ms"></span>
        <span class="w-1 h-1 rounded-full bg-slate-400 animate-bounce" style="animation-delay: 150ms"></span>
        <span class="w-1 h-1 rounded-full bg-slate-400 animate-bounce" style="animation-delay: 300ms"></span>
      </span>
    </div>
  </section>
</template>
