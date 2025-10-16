<script setup>
import { computed } from 'vue'
import { notificationsState, removeNotification } from '../stores/notifications'

const items = computed(() => notificationsState.items)
</script>

<template>
  <div class="fixed bottom-4 right-4 z-50 space-y-3 w-80 max-w-[90vw]">
    <transition-group name="toast" tag="div">
      <div v-for="n in items" :key="n.id" class="rounded-lg bg-slate-800/95 backdrop-blur border border-slate-700 p-3 shadow-lg flex items-start gap-3">
        <div class="shrink-0">
          <template v-if="n.type === 'achievement'">
            <img v-if="n.iconUrl" :src="n.iconUrl" alt="icon" class="w-10 h-10 rounded" />
            <div v-else class="w-10 h-10 rounded bg-slate-700 flex items-center justify-center text-slate-300">
              <span class="text-xl">🏆</span>
            </div>
          </template>
          <template v-else-if="n.type === 'level'">
            <div class="w-10 h-10 rounded bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300">
              <span class="text-xl">⬆️</span>
            </div>
          </template>
          <template v-else>
            <div class="w-10 h-10 rounded bg-slate-700 flex items-center justify-center text-slate-300">
              <span class="text-xl">ℹ️</span>
            </div>
          </template>
        </div>
        <div class="min-w-0 flex-1">
          <template v-if="n.type === 'achievement'">
            <p class="text-sm font-semibold text-slate-100">¡Logro desbloqueado!</p>
            <p class="text-xs text-slate-200 whitespace-normal break-words leading-snug">{{ n.title }}</p>
          </template>
          <template v-else-if="n.type === 'level'">
            <p class="text-sm font-semibold text-slate-100">¡Subiste de nivel!</p>
            <p class="text-xs text-slate-200 whitespace-normal break-words leading-snug">{{ n.title }}</p>
          </template>
          <template v-else>
            <p class="text-sm font-semibold text-slate-100">Notificación</p>
            <p class="text-xs text-slate-200 whitespace-normal break-words leading-snug">{{ n.title }}</p>
          </template>
        </div>
        <button @click="removeNotification(n.id)" class="text-slate-400 hover:text-slate-200">✕</button>
      </div>
    </transition-group>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.18s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.98);
}
</style>
