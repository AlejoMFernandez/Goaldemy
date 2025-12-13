<script setup>
import { computed } from 'vue'
import { notificationsState, removeNotification } from '../stores/notifications'

const items = computed(() => notificationsState.items)
</script>

<template>
  <div class="fixed bottom-3 right-5 z-50 w-80 max-w-[90vw]">
    <div class="flex flex-col gap-3">
    <transition-group name="toast" tag="div">
      <div
        v-for="n in items"
        :key="n.id"
        class="rounded-lg backdrop-blur p-3 shadow-lg flex items-start gap-3 mb-2"
        :class="[
          n.type === 'error' ? 'bg-red-900/30 border border-red-600/40' :
          n.type === 'success' ? 'bg-emerald-900/20 border border-emerald-600/40' :
          n.type === 'level' ? 'bg-indigo-900/20 border border-indigo-600/40' :
          n.type === 'achievement' ? 'bg-slate-800/95 border border-slate-700' :
          'bg-slate-800/95 border border-slate-700'
        ]"
      >
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
          <template v-else-if="n.type === 'error'">
            <div class="w-10 h-10 rounded bg-red-700/40 border border-red-500/40 flex items-center justify-center text-red-200">
              <span class="text-xl">⚠️</span>
            </div>
          </template>
          <template v-else-if="n.type === 'success'">
            <div class="w-10 h-10 rounded bg-emerald-700/40 border border-emerald-500/40 flex items-center justify-center text-emerald-200">
              <span class="text-xl">✅</span>
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
            <p v-if="n.points" class="text-[11px] text-emerald-300 mt-0.5">+{{ n.points }} XP</p>
          </template>
          <template v-else-if="n.type === 'level'">
            <p class="text-sm font-semibold text-slate-100">¡Subiste de nivel!</p>
            <p class="text-xs text-slate-200 whitespace-normal break-words leading-snug">{{ n.title }}</p>
          </template>
          <template v-else-if="n.type === 'error'">
            <p class="text-sm font-semibold text-red-200">Ocurrió un error</p>
            <p class="text-xs text-red-100/90 whitespace-normal break-words leading-snug">{{ n.title }}</p>
          </template>
          <template v-else-if="n.type === 'success'">
            <p class="text-sm font-semibold text-emerald-200">Listo</p>
            <p class="text-xs text-emerald-100/90 whitespace-normal break-words leading-snug">{{ n.title }}</p>
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

