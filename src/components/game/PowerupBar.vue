<script setup>
// Barra de AYUDAS dentro de la partida (Moodboard 05).
// Botones grandes con nombre, color propio y contador. Al usar una ayuda
// emite `use(type, buttonEl)`: el juego recibe el botón para que el efecto
// salga de ahí (el +15 s vuela al reloj, el escudo vuela a la tarjeta…).
import { ref, onMounted } from 'vue'
import { getAvailablePowerups, usePowerup } from '../../services/powerups'
import PowerupIcon from '../rewards/PowerupIcon.vue'

const props = defineProps({
  disabledTypes: { type: Array, default: () => [] },
  activeTypes: { type: Array, default: () => [] }, // ej. ['shield'] mientras el escudo está puesto
  hide: { type: Boolean, default: false },
})

const emit = defineEmits(['use'])

const powerups = ref([])
const using = ref(null)
const btns = {}

// Colores por ayuda (mismo criterio que el índice de juegos / AyudasPanel)
const COLORS = {
  fifty_fifty: '#e879f9',
  shield: '#38bdf8',
  extra_time: '#fbbf24',
  reveal_hint: '#34d399',
}
const SHORT = { fifty_fifty: '50/50', shield: 'Escudo', extra_time: '+15 s', reveal_hint: 'Pista' }

async function load() {
  powerups.value = await getAvailablePowerups()
}

function isDisabled(pu) {
  return pu.count <= 0 || props.disabledTypes.includes(pu.key) || props.activeTypes.includes(pu.key) || using.value === pu.key
}

async function activate(pu) {
  if (using.value || isDisabled(pu)) return
  using.value = pu.key
  const ok = await usePowerup(pu.key)
  if (ok) {
    pu.count--
    emit('use', pu.key, btns[pu.key] || null)
  }
  setTimeout(() => { using.value = null }, 400)
}

onMounted(load)

defineExpose({ reload: load })
</script>

<template>
  <Transition name="dock-fade">
    <div v-if="!hide && powerups.length > 0" class="pubar" role="group" aria-label="Ayudas">
      <button
        v-for="pu in powerups"
        :key="pu.key"
        :ref="el => { if (el) btns[pu.key] = el }"
        type="button"
        class="pubar-btn"
        :class="{ 'is-active': activeTypes.includes(pu.key), 'is-using': using === pu.key }"
        :style="{ '--pc': COLORS[pu.key] || '#94a3b8' }"
        :disabled="isDisabled(pu)"
        :title="pu.description"
        :aria-label="`${pu.name}: ${pu.description}. Te quedan ${pu.count}`"
        @click="activate(pu)"
      >
        <PowerupIcon :type="pu.key" :size="24" />
        <span class="pubar-nm">{{ SHORT[pu.key] || pu.name }}</span>
        <span class="pubar-c tabular-nums">{{ pu.count }}</span>
      </button>
    </div>
  </Transition>
</template>

<style scoped>
.pubar { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-top: 14px; }
.pubar-btn {
  position: relative; display: flex; align-items: center; justify-content: center; gap: 8px;
  min-height: 50px; padding: 6px 8px; border-radius: 12px;
  border: 1.5px solid var(--pc);
  background: color-mix(in srgb, var(--pc) 14%, #0b1024);
  color: #fff; cursor: pointer;
  font-family: var(--font-bug); font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; font-size: 14px;
  transition: transform 0.12s, filter 0.2s, opacity 0.2s, box-shadow 0.2s;
}
.pubar-btn :deep(svg) { color: var(--pc); flex: none; }
.pubar-btn:hover:not(:disabled) { filter: brightness(1.2); }
.pubar-btn:active:not(:disabled) { transform: scale(0.95); }
.pubar-btn:focus-visible { outline: 2px solid var(--pc); outline-offset: 2px; }
.pubar-btn:disabled { opacity: 0.32; cursor: not-allowed; filter: grayscale(0.6); }
.pubar-btn.is-active { opacity: 1; filter: none; box-shadow: 0 0 0 3px color-mix(in srgb, var(--pc) 35%, transparent), 0 0 18px color-mix(in srgb, var(--pc) 55%, transparent); }
.pubar-btn.is-using { animation: pubar-used 0.45s ease; }
@keyframes pubar-used { 30% { transform: scale(0.88); } 60% { transform: scale(1.08); } }
.pubar-c {
  position: absolute; top: -7px; right: -5px; min-width: 20px; height: 20px; padding: 0 4px;
  border-radius: 999px; background: #0b1024; border: 1.5px solid var(--pc);
  display: grid; place-items: center; font-size: 12px; line-height: 1;
}
@media (max-width: 420px) {
  .pubar-nm { display: none; }
}
.dock-fade-enter-active, .dock-fade-leave-active { transition: opacity 0.3s ease; }
.dock-fade-enter-from, .dock-fade-leave-to { opacity: 0; }
</style>
