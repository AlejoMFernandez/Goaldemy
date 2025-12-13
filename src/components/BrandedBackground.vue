<script setup>
// Branded pattern background - identidad visual distintiva de GOALDEMY
</script>

<template>
  <div class="fixed inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
    <!-- Aurora effects -->
    <div class="aurora-root">
      <div class="accent"></div>
    </div>
  </div>
</template>

<style scoped>
.aurora-root {
  position: absolute;
  inset: 0;
  z-index: -10000;
  overflow: hidden;
  pointer-events: none;
}

.aurora-root::before,
.aurora-root::after {
  content: '';
  z-index: -10000;
  position: absolute;
  width: 65vmax;
  height: 65vmax;
  border-radius: 50%;
  filter: blur(70px) saturate(130%);
  mix-blend-mode: screen;
  opacity: 0.01;
}

.aurora-root::before {
  left: -10%;
  top: -10%;
  z-index: -10000;
  background: radial-gradient(35% 35% at 50% 50%, rgba(56, 189, 248, 0.85), transparent 60%);
}

.aurora-root::after {
  right: -15%;
  bottom: -10%;
  z-index: -10000;
  background: radial-gradient(35% 35% at 50% 50%, rgba(99, 102, 241, 0.85), transparent 60%);
}

.aurora-root .accent {
  position: absolute;
  left: 25%;
  z-index: -10000;
  top: 60%;
  width: 55vmax;
  height: 55vmax;
  border-radius: 50%;
  filter: blur(70px) saturate(140%);
  mix-blend-mode: screen;
  background: radial-gradient(35% 35% at 50% 50%, rgba(34, 211, 238, 0.70), transparent 60%);
  opacity: 0.50;
}
</style>

