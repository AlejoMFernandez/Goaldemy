<script>
import { computed } from 'vue'
import { notificationsState } from '@/stores/notifications'

export default {
  name: 'ClaimNotificationStack',
  setup() {
    const visible = computed(() => notificationsState.claimNotifications.slice(-6))
    return { visible }
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed bottom-4 right-4 z-[70] flex flex-col-reverse gap-2 pointer-events-none">
      <TransitionGroup name="claim-toast">
        <div
          v-for="notif in visible"
          :key="notif.id"
          class="pointer-events-auto rounded-xl border border-white/15 bg-slate-900/95 backdrop-blur-md px-4 py-3 flex items-center gap-3 shadow-xl shadow-black/40 min-w-[220px] max-w-[320px]"
        >
          <span class="text-2xl shrink-0">{{ notif.emoji }}</span>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-white truncate">{{ notif.title }}</p>
            <p v-if="notif.xp > 0" class="text-xs text-emerald-400 font-bold">+{{ notif.xp }} XP reclamado</p>
            <p v-else class="text-xs text-slate-400">Reclamado</p>
          </div>
          <svg class="w-5 h-5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.claim-toast-enter-active {
  transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.claim-toast-leave-active {
  transition: all 0.25s ease-in;
}
.claim-toast-enter-from {
  opacity: 0;
  transform: translateX(100px) scale(0.9);
}
.claim-toast-leave-to {
  opacity: 0;
  transform: translateX(60px) scale(0.95);
}
.claim-toast-move {
  transition: transform 0.3s ease;
}
</style>
