<script setup>
import GoaldemyLogo from '../GoaldemyLogo.vue'
</script>

<template>
  <section class="min-h-[40vh] flex flex-col items-center justify-center gap-6">
    <!-- Animated Logo -->
    <div class="animate-pulse">
      <GoaldemyLogo variant="icon" size="lg" />
    </div>
    
    <!-- Loading dots animation -->
    <div class="flex gap-1">
      <span class="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style="animation-delay: 0ms"></span>
      <span class="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style="animation-delay: 150ms"></span>
      <span class="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style="animation-delay: 300ms"></span>
    </div>
  </section>
</template>

