<script>
import { ref, computed, watch } from 'vue'
import { notificationsState, shiftCosmeticQueue, setCosmeticActive, isLevelCovered } from '@/stores/notifications'
import { soundManager } from '@/services/sounds'
import { equipCosmetic } from '@/services/cosmetics'
import RarityReveal from './RarityReveal.vue'
import CosmeticUnlockGroup from './CosmeticUnlockGroup.vue'
import { prizeFromCosmetic } from '@/services/prize-card'
import { fxOnTop } from '@/services/game-fx'

// Mayor rareza primero: la pantalla de grupo abre con la escena de la pieza más rara.
const RARITY_RANK = { common: 0, rare: 1, epic: 2, legendary: 3 }
const byRarity = (a, b) => (RARITY_RANK[b.rarity] || 0) - (RARITY_RANK[a.rarity] || 0)

export default {
  name: 'CosmeticUnlockOverlay',
  components: { RarityReveal, CosmeticUnlockGroup },
  setup() {
    const items = ref([])        // tanda actual en pantalla
    const busy = ref(false)      // equipando
    const equipped = ref({})     // code → true (ya equipado en esta escena)
    let timers = []
    function clearTimers() { timers.forEach(clearTimeout); timers = [] }

    const active = computed(() => items.value.length > 0)
    const total = computed(() => items.value.length)
    // 2 o más piezas juntas → UNA pantalla "Desbloqueaste N piezas" (carrusel + grilla).
    // 1 sola (también una legendaria sola) → su carta con su escena, como siempre.
    const grouped = ref(false)

    function canShow() {
      // Cola (moodboard 03): bienvenida PRO → logros → NIVEL/RANGO → COSMÉTICOS.
      // Los cosméticos exclusivos esperan a que termine la escena de nivel.
      return !notificationsState.suppressOverlays
        && !notificationsState.proWelcome
        && notificationsState.achievementQueue.length === 0
        && !notificationsState.achievementActive
        && !notificationsState.levelUpActive
        && notificationsState.levelUpQueue.length === 0
    }
    // Carta estándar (moodboard 08) para cada cosmético
    function prizeOf(item) { return prizeFromCosmetic(item) }

    // Un chequeo de desbloqueos en curso puede traer más piezas de la misma salida: se
    // espera a que termine (máx. 6 s) para mostrarlas TODAS en una sola pantalla.
    let waitSince = 0
    function showBatch() {
      clearTimers()
      if (!canShow() || active.value) return
      if (notificationsState.pendingChecks > 0) {
        if (!waitSince) waitSince = Date.now()
        if (Date.now() - waitSince < 6000) { timers.push(setTimeout(showBatch, 400)); return }
      }
      waitSince = 0
      // Drenar TODA la cola de cosméticos en una sola tanda.
      const drained = []
      let it
      // Los de nivel que mientras tanto ya salieron en la escena de subida no se repiten
      while ((it = shiftCosmeticQueue())) { if (!(it.level && isLevelCovered(it.level))) drained.push(it) }
      if (!drained.length) { setCosmeticActive(false); return }

      items.value = drained.slice().sort(byRarity)  // sort estable: el resto conserva su orden
      grouped.value = drained.length > 1
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
          // Equipar uno saca el ✓ de los demás del mismo tipo (solo hay un borde, un ícono…)
          const next = { ...equipped.value }
          for (const o of items.value) if (o.type === item.type) delete next[o.code]
          next[item.code] = true
          equipped.value = next
          soundManager.play('claim')
        }
      } catch { /* noop */ }
      busy.value = false
    }

    // ── 1 sola pieza (moodboard 02 · 03): su carta con la escena de su rareza ──
    const shownItem = computed(() => items.value[0] || null)
    const shownRevealed = ref(false)
    function onRevealed() { shownRevealed.value = true }

    function close() {
      shownRevealed.value = false
      clearTimers()
      items.value = []
      grouped.value = false
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
      // Con la pantalla de grupo abierta, lo que llega se suma al final (nunca otra pantalla)
      else if (len > 0 && grouped.value) {
        let it
        while ((it = shiftCosmeticQueue())) {
          if (it.level && isLevelCovered(it.level)) continue
          if (!items.value.some(o => o.code === it.code)) items.value = [...items.value, it]
        }
      }
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
    // Terminó la escena central de un logro → recién ahí las piezas (nunca encima del logro)
    watch(() => notificationsState.achievementActive, (a) => {
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
      items, busy, active, total, grouped, equipped, equipItem, close, prizeOf,
      shownItem, shownRevealed, onRevealed,
    }
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="cu-fade">
      <div v-if="active && grouped" class="cu is-group" role="dialog" aria-modal="true" :aria-label="`Desbloqueaste ${total} piezas`">
        <div class="cu-bg" aria-hidden="true"></div>
        <CosmeticUnlockGroup :items="items" :equipped="equipped" :busy="busy" @equip="equipItem" @close="close" />
      </div>
      <div v-else-if="active && shownItem" class="cu" role="dialog" aria-modal="true" aria-label="Desbloqueaste un cosmético">
        <div class="cu-bg" aria-hidden="true"></div>
        <div class="cu-stage">
          <p class="cu-kick">Desbloqueaste</p>
          <RarityReveal :key="shownItem.code" :prize="prizeOf(shownItem)" @revealed="onRevealed" />
          <p v-if="shownItem.reason" class="cu-why" :class="{ in: shownRevealed }">{{ shownItem.reason }}</p>
          <div class="cu-actions" :class="{ in: shownRevealed }">
            <button v-if="shownItem.type !== 'powerup'" type="button" class="cu-btn ghost" :disabled="busy || equipped[shownItem.code]" @click="equipItem(shownItem)">
              {{ equipped[shownItem.code] ? '✓ Equipado' : 'Equipar' }}
            </button>
            <button type="button" class="cu-btn" @click="close">Listo</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.cu { position: fixed; inset: 0; z-index: 62; display: grid; place-items: center; padding: 16px; overflow: hidden; }
.cu.is-group { display: block; padding: 0; }
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
