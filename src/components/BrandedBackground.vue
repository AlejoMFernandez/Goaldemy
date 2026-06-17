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
  width: 62vmax;
  height: 62vmax;
  border-radius: 50%;
  filter: blur(80px) saturate(130%);
  mix-blend-mode: screen;
  opacity: 0.30;
}

.aurora-root::before {
  left: -12%;
  top: -14%;
  z-index: -10000;
  background: radial-gradient(35% 35% at 50% 50%, rgba(16, 185, 129, 0.85), transparent 60%);
}

.aurora-root::after {
  right: -16%;
  bottom: -12%;
  z-index: -10000;
  background: radial-gradient(35% 35% at 50% 50%, rgba(34, 211, 238, 0.85), transparent 60%);
}

.aurora-root .accent {
  position: absolute;
  left: 30%;
  z-index: -10000;
  top: 55%;
  width: 50vmax;
  height: 50vmax;
  border-radius: 50%;
  filter: blur(80px) saturate(140%);
  mix-blend-mode: screen;
  background: radial-gradient(35% 35% at 50% 50%, rgba(45, 212, 191, 0.65), transparent 60%);
  opacity: 0.26;
}
</style>

