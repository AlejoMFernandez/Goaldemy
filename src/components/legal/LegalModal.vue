<script>
import TermsContent from './TermsContent.vue'
import PrivacyContent from './PrivacyContent.vue'

export default {
  name: 'LegalModal',
  components: { TermsContent, PrivacyContent },
  props: {
    open: { type: Boolean, default: false },
    type: { type: String, default: 'terms' } // 'terms' | 'privacy'
  },
  emits: ['close'],
  watch: {
    // Mismo patrón de lock de scroll que GamePreviewModal.vue
    open: {
      immediate: true,
      handler(isOpen) {
        if (typeof document === 'undefined') return
        document.body.style.overflow = isOpen ? 'hidden' : ''
      }
    }
  },
  unmounted() {
    if (typeof document !== 'undefined') document.body.style.overflow = ''
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="fixed inset-0 z-50 overflow-y-auto">
        <!-- Backdrop -->
        <div class="fixed inset-0 bg-black/80 backdrop-blur-sm" @click="$emit('close')"></div>

        <!-- Centering wrapper -->
        <div class="relative min-h-full flex items-center justify-center p-4" @click.self="$emit('close')">
          <!-- Modal: el header (close button) queda fijo, solo el body interno scrollea -->
          <div class="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border border-white/20 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 shadow-2xl">
            <!-- Close button -->
            <button @click="$emit('close')" class="absolute top-4 right-4 text-slate-400 hover:text-white transition z-10">
              <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div class="overflow-y-auto p-6 md:p-8">
              <TermsContent v-if="type === 'terms'" />
              <PrivacyContent v-else />
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
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
