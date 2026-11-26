<script>
import { ref, computed, watch } from 'vue'
import { notificationsState, shiftCosmeticQueue, setCosmeticActive, isLevelCovered } from '@/stores/notifications'
import { soundManager } from '@/services/sounds'
import { equipCosmetic } from '@/services/cosmetics'
import RarityReveal from './RarityReveal.vue'
import { prizeFromCosmetic } from '@/services/prize-card'
import { fxOnTop } from '@/services/game-fx'

export default {
  name: 'CosmeticUnlockOverlay',
  components: { RarityReveal },
  setup() {
    const items = ref([])        // tanda actual en pantalla
    const busy = ref(false)      // equipando
    const equipped = ref({})     // code → true (ya equipado en esta escena)
    let timers = []
    function clearTimers() { timers.forEach(clearTimeout); timers = [] }

    const active = computed(() => items.value.length > 0)
    const total = computed(() => items.value.length)

    function canShow() {
      // Cola (moodboard 03): bienvenida PRO → logros → NIVEL/RANGO → COSMÉTICOS.
      // Los cosméticos exclusivos esperan a que termine la escena de nivel.
      return !notificationsState.suppressOverlays
        && !notificationsState.proWelcome
        && notificationsState.achievementQueue.length === 0
        && !notificationsState.levelUpActive
        && notificationsState.levelUpQueue.length === 0
    }
    // Carta estándar (moodboard 08) para cada cosmético
    function prizeOf(item) { return prizeFromCosmetic(item) }

    function showBatch() {
      clearTimers()
      if (!canShow() || active.value) return
      // Drenar TODA la cola de cosméticos en una sola tanda.
      const drained = []
      let it
      // Los de nivel que mientras tanto ya salieron en la escena de subida no se repiten
      while ((it = shiftCosmeticQueue())) { if (!(it.level && isLevelCovered(it.level))) drained.push(it) }
      if (!drained.length) { setCosmeticActive(false); return }

      items.value = drained
      equipped.value = {}
      setCosmeticActive(true)
      fxOnTop(true)
      soundManager.play('notify') // ding sutil: "tenés algo esperando"
    }

    async function equipItem(item) {
      if (!item || busy.value || equipped.value[item.code]) return
      busy.value = true
      try {
        const res = await equipCosmetic(item.code)
        if (res && res.ok !== false) {
          equipped.value = { ...equipped.value, [item.code]: true }
          soundManager.play('claim')
        }
      } catch { /* noop */ }
      busy.value = false
    }

    // ── Escena por carta (moodboard 02 · 03): se revelan de a una, cada rareza con su escena ──
    const idx = ref(0)
    const shownItem = computed(() => items.value[idx.value] || null)
    const shownRevealed = ref(false)
    function onRevealed() { shownRevealed.value = true }
    function nextCard() {
      if (idx.value < items.value.length - 1) { idx.value++; shownRevealed.value = false }
      else close()
    }

    function close() {
      idx.value = 0; shownRevealed.value = false
      clearTimers()
      items.value = []
      equipped.value = {}
      fxOnTop(false)
      if (notificationsState.cosmeticQueue.length > 0) {
        // Quedan más cosméticos: seguimos "activos" y mostramos otra tanda.
        timers.push(setTimeout(showBatch, 400))
      } else {
        // No queda nada: liberamos el gate → recién ahora aparece la subida de nivel.
        setCosmeticActive(false)
      }
    }

    watch(() => notificationsState.cosmeticQueue.length, (len) => {
      if (len > 0 && !active.value && canShow()) showBatch()
    })
    watch(() => notificationsState.suppressOverlays, (suppressed) => {
      if (!suppressed && notificationsState.cosmeticQueue.length > 0 && !active.value) {
        setTimeout(() => { if (canShow()) showBatch() }, 700)
      }
    })
    // La escena de nivel terminó → ahora sí, los cosméticos exclusivos
    watch(() => notificationsState.levelUpActive, (a) => {
      if (!a && notificationsState.cosmeticQueue.length > 0 && !active.value) {
        setTimeout(() => { if (canShow()) showBatch() }, 500)
      }
    })
    watch(() => notificationsState.proWelcome, (pw) => {
      if (!pw && notificationsState.cosmeticQueue.length > 0 && !active.value) {
        setTimeout(() => { if (canShow()) showBatch() }, 500)
      }
    })

    return {
      items, busy, active, total, equipped, equipItem, close, prizeOf,
      idx, shownItem, shownRevealed, onRevealed, nextCard,
    }
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="cu-fade">
      <div v-if="active && shownItem" class="cu" role="dialog" aria-modal="true" aria-label="Desbloqueaste un cosmético">
        <div class="cu-bg" aria-hidden="true"></div>
        <div class="cu-stage">
          <p class="cu-kick">Desbloqueaste<template v-if="total > 1"> · {{ idx + 1 }}/{{ total }}</template></p>
          <RarityReveal :key="shownItem.code + '-' + idx" :prize="prizeOf(shownItem)" @revealed="onRevealed" />
          <p v-if="shownItem.reason" class="cu-why" :class="{ in: shownRevealed }">{{ shownItem.reason }}</p>
          <div class="cu-actions" :class="{ in: shownRevealed }">
            <button v-if="shownItem.type !== 'powerup'" type="button" class="cu-btn ghost" :disabled="busy || equipped[shownItem.code]" @click="equipItem(shownItem)">
              {{ equipped[shownItem.code] ? '✓ Equipado' : 'Equipar' }}
            </button>
            <button type="button" class="cu-btn" @click="nextCard">{{ idx < total - 1 ? 'Siguiente' : 'Listo' }}</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.cu { position: fixed; inset: 0; z-index: 62; display: grid; place-items: center; padding: 16px; overflow: hidden; }
.cu-bg { position: absolute; inset: 0; background: radial-gradient(90% 80% at 50% 45%, rgba(20, 28, 68, .92) 0%, rgba(4, 6, 16, .97) 70%); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); }
.cu-stage { position: relative; width: min(100%, 560px); display: grid; justify-items: center; gap: 14px; }
.cu-kick { position: relative; z-index: 8; margin: 0; font-family: var(--font-bug); font-weight: 800; text-transform: uppercase; letter-spacing: .2em; font-size: 14px; color: #fcd34d; }
.cu-why { position: relative; z-index: 8; margin: 0; font-size: 14px; color: #c5cbe8; text-align: center; opacity: 0; transition: opacity .4s; }
.cu-actions { position: relative; z-index: 8; display: flex; gap: 10px; opacity: 0; transform: translateY(10px); transition: opacity .35s, transform .35s; pointer-events: none; }
.cu-why.in, .cu-actions.in { opacity: 1; transform: none; pointer-events: auto; }
.cu-btn { font-family: var(--font-bug); font-weight: 800; text-transform: uppercase; letter-spacing: .1em; font-size: 17px; padding: 12px 30px; border-radius: 14px; border: 0; cursor: pointer; color: #141005; background: linear-gradient(180deg, #fde68a, #f59e0b); box-shadow: 0 10px 26px rgba(245, 158, 11, .35); }
.cu-btn.ghost { color: #fff; background: rgba(255, 255, 255, .08); border: 1px solid rgba(255, 255, 255, .18); box-shadow: none; }
.cu-btn:disabled { opacity: .7; cursor: default; }
.cu-btn:active { transform: scale(.96); }
.cu-fade-enter-active { transition: opacity .3s ease; }
.cu-fade-leave-active { transition: opacity .25s ease; }
.cu-fade-enter-from, .cu-fade-leave-to { opacity: 0; }
</style>
