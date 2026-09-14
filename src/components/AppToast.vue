<script setup>
import { computed } from 'vue'
import { notificationsState, removeNotification } from '../stores/notifications'

const items = computed(() => notificationsState.items)

const STYLES = {
  error: { ring: 'ring-red-400/30', bg: 'bg-red-500/10', text: 'text-red-300', border: 'border-red-500/20' },
  success: { ring: 'ring-emerald-400/30', bg: 'bg-emerald-500/10', text: 'text-emerald-300', border: 'border-emerald-500/20' },
  info: { ring: 'ring-cyan-400/30', bg: 'bg-cyan-500/10', text: 'text-cyan-300', border: 'border-cyan-500/20' },
}
const styleFor = (type) => STYLES[type] || STYLES.info

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
          class="rounded-2xl backdrop-blur-xl p-3 shadow-2xl flex items-start gap-3 border bg-slate-900/85"
          :class="styleFor(n.type).border"
        >
          <div class="shrink-0 w-8 h-8 rounded-full ring-1 grid place-items-center"
            :class="[styleFor(n.type).bg, styleFor(n.type).ring]"
          >
            <svg v-if="n.type === 'error'" class="w-4 h-4" :class="styleFor(n.type).text" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            <svg v-else-if="n.type === 'success'" class="w-4 h-4" :class="styleFor(n.type).text" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0Z" />
            </svg>
            <svg v-else class="w-4 h-4" :class="styleFor(n.type).text" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0Zm-9-3.75h.008v.008H12V8.25Z" />
            </svg>
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-xs font-semibold" :class="styleFor(n.type).text">{{ labelFor(n.type) }}</p>
            <p class="text-[13px] text-slate-200 whitespace-normal break-words leading-snug mt-0.5">{{ n.title }}</p>
          </div>
          <button @click="removeNotification(n.id)" class="shrink-0 text-slate-500 hover:text-slate-300 transition mt-0.5" aria-label="Cerrar">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </transition-group>
    </div>
  </div>
</template>

<style scoped>
.toast-enter-active {
  transition: opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1), transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}
.toast-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.toast-move {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.toast-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(12px);
}
</style>
