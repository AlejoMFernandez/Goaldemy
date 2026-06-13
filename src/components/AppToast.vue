<script setup>
import { computed } from 'vue'
import { notificationsState, removeNotification } from '../stores/notifications'

const items = computed(() => notificationsState.items)

const iconFor = (type) => {
  if (type === 'error') return { emoji: '⚠️', border: 'border-red-500/40', bg: 'bg-red-500/10', text: 'text-red-200' }
  if (type === 'success') return { emoji: '✅', border: 'border-emerald-500/40', bg: 'bg-emerald-500/10', text: 'text-emerald-200' }
  return { emoji: 'ℹ️', border: 'border-cyan-500/40', bg: 'bg-cyan-500/10', text: 'text-cyan-200' }
}

const labelFor = (type) => {
  if (type === 'error') return 'Error'
  if (type === 'success') return 'Listo'
  return 'Info'
}
</script>

<template>
  <div class="fixed bottom-3 right-5 z-50 w-80 max-w-[90vw]">
    <div class="flex flex-col gap-2">
      <transition-group name="toast" tag="div">
        <div
          v-for="n in items"
          :key="n.id"
          class="rounded-2xl backdrop-blur-xl p-3 shadow-2xl flex items-start gap-3 border bg-slate-900/80"
          :class="iconFor(n.type).border"
        >
          <div class="shrink-0 w-9 h-9 rounded-xl grid place-items-center text-lg"
            :class="iconFor(n.type).bg"
          >
            {{ iconFor(n.type).emoji }}
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-xs font-semibold" :class="iconFor(n.type).text">{{ labelFor(n.type) }}</p>
            <p class="text-[13px] text-slate-200 whitespace-normal break-words leading-snug mt-0.5">{{ n.title }}</p>
          </div>
          <button @click="removeNotification(n.id)" class="shrink-0 text-slate-500 hover:text-slate-200 transition text-sm mt-0.5">✕</button>
        </div>
      </transition-group>
    </div>
  </div>
</template>

<style scoped>
.toast-enter-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.toast-leave-active {
  transition: all 0.2s ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateY(12px) scale(0.95);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(20px) scale(0.95);
}
</style>
