<script>
import { ref, computed } from 'vue';
import { GAME_TYPES } from '@/services/game-celebrations';
import { DIFFICULTY_LEVELS, getDifficultyConfig } from '@/services/games';

export default {
  name: 'GamePreviewModal',
  props: {
    open: { type: Boolean, default: false },
    gameName: { type: String, required: true },
    gameDescription: { type: String, default: '' },
    videoUrl: { type: String, default: '' },
    mechanic: { type: String, default: '' },
    tips: { type: Array, default: () => [] },
    gameType: { type: String, default: GAME_TYPES.TIMED } // 'TIMED', 'ORDERING', 'LIVES'
  },
  emits: ['close', 'start'],
  setup(props, { emit }) {
    const selectedDifficulty = ref(DIFFICULTY_LEVELS.NORMAL);

    const difficultyOptions = computed(() => {
      return [
        { value: DIFFICULTY_LEVELS.EASY, ...getDifficultyConfig(props.gameType, DIFFICULTY_LEVELS.EASY) },
        { value: DIFFICULTY_LEVELS.NORMAL, ...getDifficultyConfig(props.gameType, DIFFICULTY_LEVELS.NORMAL) },
        { value: DIFFICULTY_LEVELS.HARD, ...getDifficultyConfig(props.gameType, DIFFICULTY_LEVELS.HARD) }
      ];
    });

    const currentConfig = computed(() => {
      return getDifficultyConfig(props.gameType, selectedDifficulty.value);
    });

    function startGame() {
      emit('start', { difficulty: selectedDifficulty.value, config: currentConfig.value });
    }

    return {
      selectedDifficulty,
      difficultyOptions,
      currentConfig,
      startGame,
      DIFFICULTY_LEVELS
    };
  }
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

        <!-- Difficulty Selector -->
        <div class="mb-6">
          <div class="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-3">Dificultad</div>
          <div class="grid grid-cols-3 gap-3">
            <button
              v-for="option in difficultyOptions"
              :key="option.value"
              @click="selectedDifficulty = option.value"
              class="relative rounded-xl border-2 transition-all duration-200 p-4 text-left group"
              :class="[
                option.value === 'easy' 
                  ? selectedDifficulty === option.value 
                    ? 'border-green-500 bg-green-500/20 shadow-lg shadow-green-500/20' 
                    : 'border-green-500/30 bg-green-500/5 hover:border-green-500/50 hover:bg-green-500/10'
                  : option.value === 'normal'
                  ? selectedDifficulty === option.value
                    ? 'border-yellow-500 bg-yellow-500/20 shadow-lg shadow-yellow-500/20'
                    : 'border-yellow-500/30 bg-yellow-500/5 hover:border-yellow-500/50 hover:bg-yellow-500/10'
                  : selectedDifficulty === option.value
                    ? 'border-red-500 bg-red-500/20 shadow-lg shadow-red-500/20'
                    : 'border-red-500/30 bg-red-500/5 hover:border-red-500/50 hover:bg-red-500/10'
              ]"
            >
              <!-- Selected indicator -->
              <div 
                v-if="selectedDifficulty === option.value"
                :class="[
                  'absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center shadow-lg',
                  option.value === 'easy' ? 'bg-green-500' : option.value === 'normal' ? 'bg-yellow-500' : 'bg-red-500'
                ]"
              >
                <svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <div 
                class="font-bold text-lg mb-1"
                :class="[
                  option.value === 'easy' ? 'text-green-400' : option.value === 'normal' ? 'text-yellow-400' : 'text-red-400'
                ]"
              >
                {{ option.label }}
              </div>
              <div class="text-slate-400 text-xs">{{ option.description }}</div>
              
              <!-- XP Badge -->
              <div class="mt-3 inline-flex items-center gap-1 rounded-full bg-yellow-500/20 px-2 py-1 text-xs font-semibold text-yellow-400">
                <span>⭐</span>
                <span>+{{ option.xpCompletion }} XP</span>
              </div>
            </button>
          </div>
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
            @click="startGame" 
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

