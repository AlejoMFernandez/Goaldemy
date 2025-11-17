<script>
export default {
  name: 'GamePreviewModal',
  props: {
    open: { type: Boolean, default: false },
    gameName: { type: String, required: true },
    gameDescription: { type: String, default: '' },
    videoUrl: { type: String, default: '' },
    mechanic: { type: String, default: '' }, // Ej: "30 segundos para hacer 10 aciertos"
    tips: { type: Array, default: () => [] }
  },
  emits: ['close', 'start']
}
</script>

<template>
  <Transition name="modal">
    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="$emit('close')">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>
      
      <!-- Modal -->
      <div class="relative w-full max-w-2xl rounded-2xl border border-white/20 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 shadow-2xl">
        <!-- Close button -->
        <button @click="$emit('close')" class="absolute top-4 right-4 text-slate-400 hover:text-white transition">
          <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <!-- Header -->
        <div class="mb-6">
          <h2 class="text-3xl font-bold text-white mb-2">{{ gameName }}</h2>
          <p v-if="gameDescription" class="text-slate-300">{{ gameDescription }}</p>
        </div>

        <!-- Video preview -->
        <div v-if="videoUrl" class="mb-6 rounded-xl overflow-hidden bg-black aspect-video">
          <video 
            :src="videoUrl" 
            controls 
            class="w-full h-full object-contain"
            preload="metadata"
          />
        </div>

        <!-- Mechanic -->
        <div v-if="mechanic" class="mb-6 rounded-xl bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/30 p-4">
          <div class="flex items-start gap-3">
            <div class="shrink-0 w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <svg class="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <div class="text-xs uppercase tracking-wider text-emerald-400 font-semibold mb-1">Objetivo</div>
              <div class="text-white font-medium">{{ mechanic }}</div>
            </div>
          </div>
        </div>

        <!-- Tips -->
        <div v-if="tips.length > 0" class="mb-6">
          <div class="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-3">Consejos</div>
          <ul class="space-y-2">
            <li v-for="(tip, i) in tips" :key="i" class="flex items-start gap-2 text-slate-300 text-sm">
              <span class="shrink-0 text-cyan-400">•</span>
              <span>{{ tip }}</span>
            </li>
          </ul>
        </div>

        <!-- Actions -->
        <div class="flex gap-3">
          <button 
            @click="$emit('close')" 
            class="flex-1 rounded-xl border border-white/20 hover:bg-white/5 text-white py-3 font-semibold transition"
          >
            Cancelar
          </button>
          <button 
            @click="$emit('start')" 
            class="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110 text-white py-3 font-bold transition shadow-lg shadow-emerald-500/25"
          >
            ¡Jugar ahora!
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-active .relative,
.modal-leave-active .relative {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .relative,
.modal-leave-to .relative {
  transform: scale(0.95);
  opacity: 0;
}
</style>
