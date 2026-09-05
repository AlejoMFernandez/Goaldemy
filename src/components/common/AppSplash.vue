<script setup>
import FulvoLogo from '../FulvoLogo.vue'
</script>

<template>
  <div class="app-splash" role="status" aria-label="Fulvo">
    <div class="app-splash__glow" aria-hidden="true"></div>
    <div class="app-splash__icon">
      <FulvoLogo variant="icon" size="xl" />
    </div>
    <div class="app-splash__wordmark">
      <FulvoLogo variant="wordmark" size="md" />
    </div>
  </div>
</template>

<style scoped>
.app-splash {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: radial-gradient(120% 120% at 50% 30%, var(--mb-900, #0b1024) 0%, var(--mb-950, #070a1a) 70%);
  overflow: hidden;
}

.app-splash__glow {
  position: absolute;
  width: 60vmax;
  height: 60vmax;
  border-radius: 50%;
  background: radial-gradient(40% 40% at 50% 50%, color-mix(in oklab, var(--hub-500, #818cf8) 55%, transparent), transparent 65%);
  filter: blur(60px);
  opacity: 0.5;
  animation: splash-glow-pulse 2.6s ease-in-out infinite;
}

.app-splash__icon {
  position: relative;
  animation: splash-icon-in 0.8s var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1)) both;
  filter: drop-shadow(0 0 24px color-mix(in oklab, var(--play-400, #fcd34d) 45%, transparent));
}

.app-splash__wordmark {
  position: relative;
  margin-top: -2px;
  opacity: 0;
  animation: splash-wordmark-in 0.7s var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1)) 1.1s both;
}

@keyframes splash-icon-in {
  from { opacity: 0; transform: scale(0.82); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes splash-glow-pulse {
  0%, 100% { opacity: 0.35; transform: scale(1); }
  50% { opacity: 0.55; transform: scale(1.08); }
}

@keyframes splash-wordmark-in {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .app-splash__icon,
  .app-splash__wordmark,
  .app-splash__glow {
    animation: none;
  }
  .app-splash__icon,
  .app-splash__wordmark {
    opacity: 1;
    transform: none;
  }
}
</style>
