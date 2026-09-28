<script>
import { ref, computed, watch, nextTick } from 'vue'
import { notificationsState, shiftCosmeticQueue, setCosmeticActive } from '@/stores/notifications'
import { soundManager } from '@/services/sounds'
import { equipCosmetic } from '@/services/cosmetics'
import RarityGem from './RarityGem.vue'
import PrizeCard from './PrizeCard.vue'
import RarityReveal from './RarityReveal.vue'
import { prizeFromCosmetic } from '@/services/prize-card'
import { RARITY_WAIT, RARITY_SOUND, RARITY_COLOR } from '@/services/prize-reveal'
import { sparks, center, fxOnTop } from '@/services/game-fx'

const TYPE_LABEL = { frame: 'Borde', title: 'Título', icon: 'Ícono', banner: 'Banner' }

const RARITY_THEME = {
  common:    { glow: 'rgba(148,163,184,0.40)', text: 'text-slate-300',   ringBorder: 'border-slate-400/40',   confetti: ['#cbd5e1', '#94a3b8', '#e2e8f0'],              label: 'Común' },
  rare:      { glow: 'rgba(56,189,248,0.45)',  text: 'text-sky-300',     ringBorder: 'border-sky-400/40',     confetti: ['#38bdf8', '#0ea5e9', '#7dd3fc', '#e0f2fe'],   label: 'Raro' },
  epic:      { glow: 'rgba(232,121,249,0.50)', text: 'text-fuchsia-300', ringBorder: 'border-fuchsia-400/45', confetti: ['#e879f9', '#d946ef', '#f0abfc', '#fae8ff'],   label: 'Épico' },
  legendary: { glow: 'rgba(251,191,36,0.55)',  text: 'text-amber-300',   ringBorder: 'border-amber-400/50',   confetti: ['#fbbf24', '#f59e0b', '#fde047', '#fff7ed'],   label: 'Legendario' },
}

// Orden de rareza para elegir el "brillo" del sobre cerrado: si la tanda trae
// una legendaria, el sobre ya lo insinúa (como el destello de un cofre de
// Clash Royale antes de abrirlo) aunque el contenido sea 100% determinístico.
const RARITY_RANK = { common: 0, rare: 1, epic: 2, legendary: 3 }

export default {
  name: 'CosmeticUnlockOverlay',
  components: { RarityGem, PrizeCard, RarityReveal },
  setup() {
    // Con 1 sola recompensa: un sobre → lo abrís → pantalla de detalle grande.
    // Con varias: una GRILLA de sobres individuales (estilo caja de Overwatch /
    // cofres Hextech de LoL) — cada uno se abre por separado, a su propio ritmo.
    const items = ref([])        // tanda actual en pantalla
    const phase = ref(0)         // fases de la animación de entrada (solo detalle de 1)
    const busy = ref(false)      // equipando
    const equipped = ref({})     // code → true (ya equipado en esta escena)
    const revealed = ref({})     // code → true (ya se abrió esa carta, modo grilla)
    const unboxed = ref(false)   // (modo 1 sola) false = sobre cerrado, true = ya reveló
    const cracking = ref(false)  // animación de apertura en curso (entre el tap y la revelación)
    let phaseTimers = []

    function clearTimers() {
      phaseTimers.forEach(clearTimeout)
      phaseTimers = []
    }

    const active = computed(() => items.value.length > 0)
    const total = computed(() => items.value.length)
    const current = computed(() => items.value[0] || null) // solo se usa en el modo "1 sola"
    const theme = computed(() => RARITY_THEME[current.value?.rarity] || RARITY_THEME.epic)
    // Rareza más alta de la tanda: define el brillo del sobre cerrado (el "teaser").
    const batchRarity = computed(() => {
      let best = 'common'
      for (const it of items.value) {
        if ((RARITY_RANK[it.rarity] || 0) > (RARITY_RANK[best] || 0)) best = it.rarity
      }
      return best
    })
    const batchTheme = computed(() => RARITY_THEME[batchRarity.value] || RARITY_THEME.common)
    const typeLabel = computed(() => TYPE_LABEL[current.value?.type] || 'Cosmético')
    const isEquipped = computed(() => !!(current.value && equipped.value[current.value.code]))

    // Modo grilla (2+ recompensas)
    const revealedCount = computed(() => items.value.filter(it => revealed.value[it.code]).length)
    const allRevealed = computed(() => total.value > 0 && revealedCount.value === total.value)
    function themeFor(item) { return RARITY_THEME[item?.rarity] || RARITY_THEME.common }

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
    const cardRef = ref(null)
    const spotlight = ref(false)

    function showBatch() {
      clearTimers()
      if (!canShow() || active.value) return
      // Drenar TODA la cola de cosméticos en una sola tanda.
      const drained = []
      let it
      while ((it = shiftCosmeticQueue())) drained.push(it)
      if (!drained.length) return

      items.value = drained
      equipped.value = {}
      revealed.value = {}
      phase.value = 0
      unboxed.value = false
      cracking.value = false
      setCosmeticActive(true)
      fxOnTop(true)
      soundManager.play('notify') // ding sutil: "tenés algo esperando"
    }

    // Modo "1 sola": el usuario toca el sobre cerrado → apertura (suspenso corto) →
    // pantalla de detalle grande con la secuencia de reveal + confeti de siempre.
    // Escalera de rareza (moodboard 02): cuanto más rara, más suspenso.
    // Común ~0,6 s · Rara ~1 s · Épica ~1,6 s · Legendaria ~2,6 s con apagón y reflector.
    function openPack() {
      if (cracking.value || unboxed.value) return
      cracking.value = true
      const r = current.value?.rarity || 'common'
      const wait = 300 + (RARITY_WAIT[r] || 250)
      soundManager.play('combo') // riser corto de tensión mientras "cruje" el sobre
      if (r === 'legendary') spotlight.value = true
      phaseTimers.push(setTimeout(() => {
        unboxed.value = true
        cracking.value = false
        nextTick(() => {
          const k = r === 'legendary' ? 1.6 : r === 'epic' ? 1.25 : r === 'rare' ? 1 : 0.7
          phaseTimers.push(setTimeout(() => { phase.value = 1 }, 50))
          phaseTimers.push(setTimeout(() => { phase.value = 2 }, 400 * k))
          phaseTimers.push(setTimeout(() => { phase.value = 3 }, 800 * k))
          phaseTimers.push(setTimeout(() => { phase.value = 4 }, 1100 * k))
          soundManager.play(RARITY_SOUND[r] || 'cardFlip')
          phaseTimers.push(setTimeout(() => {
            const el = cardRef.value?.$el
            if (el) { const c = center(el); sparks(c.x, c.y, r === 'legendary' ? 60 : r === 'epic' ? 34 : 16, [RARITY_COLOR[r], '#ffffff'], Math.max(120, c.w)) }
          }, 120))
        })
      }, wait))
    }

    // Modo grilla: cada carta se abre de forma independiente al tocarla.
    function revealCard(item, event) {
      if (!item || revealed.value[item.code]) return
      revealed.value = { ...revealed.value, [item.code]: true }
      const r = item.rarity || 'common'
      soundManager.play(RARITY_SOUND[r] || 'cardFlip')
      const el = event?.currentTarget
      if (el) { const c = center(el); sparks(c.x, c.y, r === 'legendary' ? 36 : r === 'epic' ? 20 : 10, [RARITY_COLOR[r], '#ffffff'], Math.max(60, c.w * 0.8)) }
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
      revealed.value = {}
      phase.value = 0
      unboxed.value = false
      cracking.value = false
      spotlight.value = false
      fxOnTop(false)
      if (notificationsState.cosmeticQueue.length > 0) {
        // Quedan más cosméticos: seguimos "activos" y mostramos otra tanda.
        phaseTimers.push(setTimeout(showBatch, 400))
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
      items, phase, busy, active, current, total, theme, typeLabel, isEquipped,
      unboxed, cracking, batchTheme, equipped, revealed, revealedCount, allRevealed,
      equipItem, close, openPack, revealCard, themeFor, prizeOf, cardRef, spotlight,
      idx, shownItem, shownRevealed, onRevealed, nextCard, TYPE_LABEL,
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
