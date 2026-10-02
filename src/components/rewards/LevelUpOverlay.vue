<script setup>
/**
 * SUBIR DE NIVEL / SUBIR DE RANGO (Moodboard 03 + cartas del 08)
 *
 * Acto RANGO (solo si cambió el rango): ¡GOL! que abre la ceremonia → la FORJA
 * (services/rank-forge.js: se calienta, se desarma, cae el filo, cae el emblema, caen las
 * estrellas, ¡PUM! con el nombre) → "Al llegar ganás" (cartas del rango, boca abajo, se dan
 * vuelta de a una) → próximo rango a la vista. Tocar adelanta la forja.
 *
 * Acto NIVEL: la barra se llena y desborda una vez por cada nivel (con
 * contador ×2, ×3 si subiste varios), cada desborde es un ¡PUM! (corto en los
 * intermedios, grande en el último) con la etiqueta "1 → 3".
 * Después "Desbloqueaste": las recompensas REALES en cartas y, aparte, el XP
 * y las ayudas como fichas simples (no son cartas, para no confundir).
 * "Lo que viene" quedó oculto (pedido de Alejo: escena centrada en el nivel).
 *
 * Cola: resumen → logros → ESTO → cosméticos exclusivos (CosmeticUnlockOverlay
 * espera a que esta escena termine). Tocar el fondo adelanta la animación.
 */
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import { notificationsState, shiftLevelUpQueue, setLevelUpActive } from '@/stores/notifications'
import { getTierForLevel, getNextTier } from '@/services/tiers'
import { prizesForLevelRange, upcomingPrizes, tierPrizes } from '@/services/prize-card'
import { revealPrizes } from '@/services/prize-reveal'
import { soundManager } from '@/services/sounds'
import { sparks, center, fxOnTop, reducedMotion } from '@/services/game-fx'
import { createForge, FORGE_SOUNDS } from '@/services/rank-forge'
import PrizeCard from './PrizeCard.vue'
import PowerupIcon from './PowerupIcon.vue'
import RarityReveal from './RarityReveal.vue'

const current = ref(null)
const stage = ref('level')      // 'rank' | 'level'
const rp = ref(0)               // fase del acto rango
const lp = ref(0)               // fase del acto nivel
const shownLevel = ref(0)       // número que se ve en el ¡PUM!
const pumKey = ref(0)           // re-dispara la animación del número
const bigPum = ref(false)
const flashKey = ref(0)
const rankFaceDown = ref([])    // por carta del rango
const unlockIndex = ref(0)      // qué carta de "Desbloqueaste" se está mostrando (una por vez)
const canAdvance = ref(false)   // la carta actual ya se sostuvo lo mínimo → dejar pasar a la próxima
const unlocksDone = ref(false)  // ya se vieron todas las cartas de "Desbloqueaste"
const rankCardEls = []
const numEl = ref(null)
const forgeRoot = ref(null)
const forgeCanvas = ref(null)
const stageEl = ref(null)
let timers = []
let cancelReveal = null
let forge = null

function T(fn, ms) { timers.push(setTimeout(fn, reducedMotion ? Math.min(ms, 60) : ms)) }
function clearTimers() { timers.forEach(clearTimeout); timers = []; cancelReveal?.(); cancelReveal = null }
function destroyForge() { const f = forge; forge = null; f?.destroy() }
onBeforeUnmount(() => { clearTimers(); destroyForge() })

const oldTier = computed(() => current.value ? getTierForLevel(current.value.oldLevel) : null)
const newTier = computed(() => current.value ? getTierForLevel(current.value.newLevel) : null)
const tierChanged = computed(() => !!(oldTier.value && newTier.value && oldTier.value.key !== newTier.value.key))
const nextTier = computed(() => current.value ? getNextTier(current.value.newLevel) : null)
const levelsUp = computed(() => current.value ? Math.max(1, current.value.newLevel - current.value.oldLevel) : 1)

// Cartas ganadas en el acto nivel (sin las del rango si ya se mostraron en su acto)
const prizes = computed(() => {
  if (!current.value) return []
  const all = prizesForLevelRange(current.value.oldLevel, current.value.newLevel)
  return tierChanged.value ? all.filter(p => p.kind !== 'tier' && !p.fromTier) : all
})
const rankCards = computed(() => tierChanged.value ? tierPrizes(newTier.value) : [])
// Cartas = solo recompensas reales (cosméticos, rango, juegos). XP y ayudas van como fichas.
const cardPrizes = computed(() => prizes.value.filter(p => p.kind !== 'xp' && p.kind !== 'powerup'))
const xpTotal = computed(() => prizes.value.filter(p => p.kind === 'xp').reduce((a, p) => a + (Number(p.amount) || 0), 0))
const helpPrizes = computed(() => prizes.value.filter(p => p.kind === 'powerup'))
const hasUnlocks = computed(() => cardPrizes.value.length > 0 || xpTotal.value > 0 || helpPrizes.value.length > 0)
const xpShown = ref(0)
const combo = ref(0)

const vw = ref(typeof window !== 'undefined' ? window.innerWidth : 1024)
function onResize() { vw.value = window.innerWidth }
const cardSize = computed(() => vw.value < 420 ? 104 : vw.value < 640 ? 120 : 140)
const upSize = computed(() => vw.value < 420 ? 84 : 96)

function flash() { flashKey.value++ }

// ─── Acto RANGO ─────────────────────────────────────────────
function runRank() {
  stage.value = 'rank'; rp.value = 0
  destroyForge()
  rankFaceDown.value = rankCards.value.map(() => true)
  soundManager.preload(FORGE_SOUNDS)
  nextTick(() => {
    T(() => { rp.value = 1; flash(); soundManager.playBig('goal') }, 150)        // ¡GOL!
    T(startForge, 1300)                                                          // la forja
  })
}

function startForge() {
  rp.value = 2
  nextTick(() => {
    destroyForge()
    if (!forgeRoot.value || !forgeCanvas.value) { rp.value = 5; T(showRankCards, 300); return }
    const f = createForge({ root: forgeRoot.value, canvas: forgeCanvas.value, reduced: reducedMotion })
    forge = f
    f.play(oldTier.value.key, newTier.value.key).then(() => {
      if (forge !== f) return
      rp.value = 5                                                               // nombre estampado
      T(showRankCards, 500)
    })
  })
}

function showRankCards() {                                                       // "Al llegar ganás"
  rp.value = 6
  nextTick(() => {
    cancelReveal = revealPrizes(rankCards.value, i => { rankFaceDown.value[i] = false }, i => rankCardEls[i], {
      startDelay: 400,
      onDone: () => { rp.value = 7 },
    })
  })
}

// ─── Acto NIVEL ─────────────────────────────────────────────
function pum(level, big) {
  shownLevel.value = level
  bigPum.value = big
  pumKey.value++
  soundManager.playBig(big ? 'pum' : 'pumSmall')
  if (big) {
    flash()
    nextTick(() => {
      const el = numEl.value
      if (el) { const c = center(el); sparks(c.x, c.y, 34, ['#fcd34d', '#fff', '#fde68a'], 160) }
      stageEl.value?.animate?.([
        { transform: 'translate(0,0)' }, { transform: 'translate(-6px,3px)' }, { transform: 'translate(5px,-3px)' },
        { transform: 'translate(-3px,2px)' }, { transform: 'translate(0,0)' },
      ], { duration: 360, easing: 'ease-out' })
    })
  }
}

function countXp(to) {
  if (reducedMotion) { xpShown.value = to; return }
  const t0 = performance.now()
  const step = (t) => { const k = Math.min(1, (t - t0) / 700); xpShown.value = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step) }
  requestAnimationFrame(step)
}

function runLevel() {
  stage.value = 'level'; lp.value = 0
  const from = current.value.oldLevel
  const to = current.value.newLevel
  shownLevel.value = from
  combo.value = 0; xpShown.value = 0
  unlockIndex.value = 0; canAdvance.value = false; unlocksDone.value = false
  nextTick(() => {
    T(() => { lp.value = 1 }, 80)
    // Un ¡PUM! por nivel, cada uno más rápido (sin barra: solo cambia el número)
    let t = 350
    let k = 0
    for (let l = from + 1; l <= to; l++) {
      const lv = l, idx = ++k, last = l === to
      const dur = Math.max(320, 800 - (idx - 1) * 220)
      T(() => {
        if (to - from > 1) combo.value = idx
        // El último nivel ya dispara sus propias chispas grandes dentro de pum()
        // (caso `big`) — acá solo sumamos chispas chicas para los intermedios.
        if (!last) {
          const el = numEl.value
          if (el) { const c = center(el); sparks(c.x, c.y, 14, ['#fcd34d', '#fff', '#fde68a'], 55) }
        }
        pum(lv, last)
        if (last) lp.value = 2
      }, t + dur)
      t += dur + (last ? 60 : 380)
    }
    T(() => {
      lp.value = 3
      if (xpTotal.value) countXp(xpTotal.value)
      if (!cardPrizes.value.length) { unlocksDone.value = true; T(() => { lp.value = 4 }, 500) }
    }, t + 800)
  })
}

// Una carta de "Desbloqueaste" ya se sostuvo lo mínimo (RarityReveal
// @ready-to-advance) → un toque sobre ella pasa a la siguiente.
function advanceUnlock() {
  if (!canAdvance.value) return
  canAdvance.value = false
  unlockIndex.value++
  if (unlockIndex.value >= cardPrizes.value.length) { unlocksDone.value = true; T(() => { lp.value = 4 }, 500) }
}

// Tocar el fondo (o "Ver todo"): adelanta todo (sin saltearse lo que se gana)
function skip() {
  if (stage.value === 'rank') {
    if (rp.value >= 7) return goToLevel()
    // Durante la forja, tocar la adelanta (deja el escudo ya forjado) y sigue el flujo normal.
    if (rp.value >= 2 && rp.value < 5 && forge?.skip()) return
    if (rp.value < 2) {                                                          // ¡GOL!: saltar directo a la forja ya hecha
      clearTimers(); startForge()
      nextTick(() => nextTick(() => forge?.skip()))
      return
    }
    clearTimers()
    rp.value = 7
    rankFaceDown.value = rankCards.value.map(() => false)
    return
  }
  if (lp.value >= 4) return dismiss()
  clearTimers()
  shownLevel.value = current.value.newLevel
  xpShown.value = xpTotal.value
  if (current.value.newLevel - current.value.oldLevel > 1) combo.value = current.value.newLevel - current.value.oldLevel
  unlockIndex.value = cardPrizes.value.length
  unlocksDone.value = true
  lp.value = 4
}

function goToLevel() { clearTimers(); destroyForge(); runLevel() }

function showNext() {
  clearTimers()
  if (notificationsState.suppressOverlays) return
  if (notificationsState.proWelcome) return
  // Los logros van antes que el nivel (cola: resumen → logros → nivel → cosméticos).
  // Nunca se pisan: si hay un logro en pantalla o esperando, el nivel espera a que termine.
  if (notificationsState.achievementActive || notificationsState.achievementQueue.length > 0) {
    if (!current.value) setLevelUpActive(false)
    return
  }
  const item = shiftLevelUpQueue()
  if (!item) { current.value = null; setLevelUpActive(false); fxOnTop(false); return }
  // Varias subidas encoladas seguidas → una sola escena de oldLevel al máximo
  let merged = { ...item }
  while (notificationsState.levelUpQueue.length && notificationsState.levelUpQueue[0].oldLevel <= merged.newLevel) {
    const n = shiftLevelUpQueue()
    merged = { ...merged, newLevel: Math.max(merged.newLevel, n.newLevel), xpBonus: (merged.xpBonus || 0) + (n.xpBonus || 0) }
  }
  if (!current.value) fxOnTop(true)
  current.value = merged
  setLevelUpActive(true)
  window.addEventListener('resize', onResize)
  if (tierChanged.value) runRank()
  else runLevel()
}

function dismiss() {
  clearTimers()
  destroyForge()
  current.value = null
  rp.value = 0; lp.value = 0
  window.removeEventListener('resize', onResize)
  fxOnTop(false)
  if (notificationsState.levelUpQueue.length === 0) setLevelUpActive(false)
  T(showNext, 400)
}

watch(() => notificationsState.levelUpQueue.length, (len) => {
  if (len > 0 && !current.value) showNext()
})
watch(() => notificationsState.suppressOverlays, (suppressed) => {
  if (!suppressed && notificationsState.levelUpQueue.length > 0 && !current.value) setTimeout(showNext, 600)
})
watch(() => notificationsState.proWelcome, (pw) => {
  if (!pw && notificationsState.levelUpQueue.length > 0 && !current.value) setTimeout(showNext, 400)
})
// Cuando termina la escena del logro (o se vacía la cola), sigue el nivel
watch(() => notificationsState.achievementActive, (active) => {
  if (!active && notificationsState.levelUpQueue.length > 0 && !current.value) setTimeout(showNext, 500)
})
watch(() => notificationsState.achievementQueue.length, (len) => {
  if (len === 0 && !notificationsState.achievementActive && notificationsState.levelUpQueue.length > 0 && !current.value) setTimeout(showNext, 500)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="lvo-fade">
      <div v-if="current" class="lvo" @click.self="skip">
        <div class="lvo-bg" @click="skip"></div>
        <div :key="'f' + flashKey" class="lvo-flash" :class="{ on: flashKey > 0 }" aria-hidden="true"></div>

        <!-- ═══════════ ACTO 1 · ASCENSO DE RANGO ═══════════ -->
        <div v-if="stage === 'rank'" ref="stageEl" class="lvo-stage" @click.self="skip">
          <div v-if="rp === 1" class="lvo-gol" aria-live="polite">
            <span class="g">¡G</span><span class="o">OOO</span><span class="g">L!</span>
          </div>

          <template v-if="rp >= 2">
            <p class="lvo-kick" :class="{ in: rp >= 2 }">¡Ascendiste de rango!</p>
            <div ref="forgeRoot" class="lvo-forge">
              <div class="forge">
                <div id="rays" class="rays" aria-hidden="true"></div>
                <div id="wrap" class="wrap"><svg id="sv" viewBox="0 0 120 140" role="img" :aria-label="'Escudo ' + newTier?.label"></svg></div>
                <div class="name" aria-live="polite">
                  <div id="nk" class="k">Nuevo rango</div>
                  <div id="nn" class="n"></div>
                  <div id="nl" class="l"></div>
                </div>
              </div>
              <div class="fx" aria-hidden="true"><div id="flash" class="flash"></div><canvas ref="forgeCanvas"></canvas></div>
            </div>

            <div v-if="rp >= 6" class="lvo-block">
              <p class="lvo-h">Al llegar ganás</p>
              <div class="lvo-cards">
                <PrizeCard
                  v-for="(p, i) in rankCards" :key="'rk' + i"
                  :ref="el => { rankCardEls[i] = el?.$el || el }"
                  :prize="p" :size="cardSize" :face-down="rankFaceDown[i]" :state="rankFaceDown[i] ? '' : 'new'"
                  class="lvo-deal" :style="{ animationDelay: (i * 0.12) + 's' }"
                />
              </div>
            </div>

            <div v-if="rp >= 7" class="lvo-next">
              <template v-if="nextTier">
                <img :src="nextTier.image" alt="" />
                <span>Próximo rango: <b>{{ nextTier.label }}</b> en el nivel {{ nextTier.minLevel }}</span>
              </template>
              <span v-else>Llegaste al rango máximo. ¡GOAT!</span>
            </div>
            <button v-if="rp >= 7" type="button" class="lvo-btn" @click="goToLevel">Seguir</button>
          </template>
        </div>

        <!-- ═══════════ ACTO 2 · ¡PUM! DE NIVEL ═══════════ -->
        <div v-else ref="stageEl" class="lvo-stage" @click.self="skip">
          <p class="lvo-kick" :class="{ in: lp >= 1 }">{{ levelsUp > 1 ? `¡Subiste ${levelsUp} niveles!` : '¡Subiste de nivel!' }}</p>
          <div ref="numEl" class="lvo-num" :class="{ big: bigPum }">
            <span class="nv">Nivel</span>
            <span :key="pumKey" class="n" :class="bigPum ? 'pum' : 'pum-s'">{{ shownLevel }}</span>
            <span v-if="bigPum" class="shock" aria-hidden="true"></span>
            <span v-if="combo > 1 && lp < 3" :key="'c' + combo" class="lvo-combo">×{{ combo }}</span>
          </div>
          <span v-if="levelsUp > 1 && lp >= 2" class="lvo-range">{{ current.oldLevel }} → {{ current.newLevel }}</span>

          <div v-if="lp >= 3 && cardPrizes.length && !unlocksDone" class="lvo-block">
            <p class="lvo-h">Desbloqueaste</p>
            <div class="lvo-unlock-one" :class="{ can: canAdvance }" @click="advanceUnlock">
              <RarityReveal
                :key="'unlock' + unlockIndex"
                :prize="cardPrizes[unlockIndex]"
                @ready-to-advance="canAdvance = true"
              />
            </div>
            <div v-if="cardPrizes.length > 1" class="lvo-dots">
              <i v-for="(p, i) in cardPrizes" :key="'d' + i" :class="{ on: i <= unlockIndex }"></i>
            </div>
            <p class="lvo-skip-hint">{{ canAdvance ? 'Tocá la carta para seguir' : '' }}</p>
            <button type="button" class="lvo-all" @click="skip">Ver todo</button>
          </div>

          <div v-if="lp >= 3 && (unlocksDone || !cardPrizes.length) && hasUnlocks" class="lvo-block">
            <p v-if="cardPrizes.length" class="lvo-h">Desbloqueaste</p>
            <!-- XP y ayudas: fichas simples, no cartas -->
            <div v-if="xpTotal || helpPrizes.length" class="lvo-chips">
              <span v-if="xpTotal" class="lvo-chip xp"><b>+{{ xpShown }}</b> XP</span>
              <span v-for="(h, i) in helpPrizes" :key="'h' + i" class="lvo-chip help" :style="{ animationDelay: (0.15 + i * 0.1) + 's' }">
                <PowerupIcon :type="h.powerup" :size="20" />{{ h.name }}
              </span>
            </div>
          </div>

          <button v-if="lp >= 4" type="button" class="lvo-btn" @click="dismiss">Continuar</button>
          <p v-if="lp < 4" class="lvo-skip">Tocá para adelantar</p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.lvo { position: fixed; inset: 0; z-index: 60; overflow-y: auto; display: grid; place-items: center; padding: 24px 16px; }
.lvo-bg { position: fixed; inset: 0; background: radial-gradient(80% 60% at 50% 35%, rgba(18, 26, 70, .82), rgba(2, 4, 12, .97) 70%); -webkit-backdrop-filter: blur(10px) saturate(.6) brightness(.6); backdrop-filter: blur(10px) saturate(.6) brightness(.6); }
.lvo-flash { position: fixed; inset: 0; pointer-events: none; background: radial-gradient(50% 50% at 50% 40%, rgba(255, 244, 200, .9), rgba(255, 244, 200, 0) 70%); opacity: 0; }
.lvo-flash.on { animation: lvo-flash .55s ease-out; }
@keyframes lvo-flash { 0% { opacity: .95; } 100% { opacity: 0; } }
/* Escenario de alto fijo, centrado en la pantalla: el contenido crece hacia abajo sin que salte todo */
.lvo-stage { position: relative; width: min(100%, 760px); min-height: min(660px, calc(100vh - 48px)); display: flex; flex-direction: column; justify-content: flex-start; align-items: center; text-align: center; gap: 12px; padding-top: clamp(8px, 3vh, 80px); }

.lvo-kick { margin: 0; font-family: var(--font-bug); font-weight: 800; text-transform: uppercase; letter-spacing: .18em; font-size: 14px; color: #fcd34d; opacity: 0; transform: translateY(6px); transition: opacity .4s, transform .4s; }
.lvo-kick.in { opacity: 1; transform: none; }

/* ¡PUM! */
.lvo-num { position: relative; display: grid; justify-items: center; gap: 10px; }
.lvo-num .nv { font-family: var(--font-bug); font-weight: 800; text-transform: uppercase; letter-spacing: .32em; font-size: 20px; line-height: 1; color: #cbd5e1; padding-left: .32em; }
.lvo-num .n { font-family: var(--font-shout); font-weight: 800; font-style: italic; font-size: clamp(80px, min(30vw, 24vh), 210px); line-height: .9; color: #fff; font-variant-numeric: tabular-nums; }
.lvo-num.big .n { color: #fde68a; text-shadow: 0 6px 0 #b45309, 0 0 44px rgba(252, 211, 77, .6); }
.n.pum-s { animation: lvo-pums .38s cubic-bezier(.34, 1.56, .64, 1); }
.n.pum { animation: lvo-pum .6s cubic-bezier(.16, 1, .3, 1); }
@keyframes lvo-pums { 0% { transform: scale(1.35); opacity: .4; } 100% { transform: none; opacity: 1; } }
@keyframes lvo-pum { 0% { transform: scale(3); opacity: 0; filter: blur(12px); } 45% { transform: scale(.92); opacity: 1; filter: none; } 100% { transform: none; } }
.lvo-num .shock { position: absolute; left: 50%; top: 58%; width: 120px; height: 120px; margin: -60px 0 0 -60px; border-radius: 50%; border: 4px solid #fcd34d; opacity: 0; animation: lvo-shock .7s ease-out; pointer-events: none; }
@keyframes lvo-shock { 0% { opacity: .9; transform: scale(.3); } 100% { opacity: 0; transform: scale(3.6); } }
.lvo-combo { position: absolute; right: -8px; top: 4px; font-family: var(--font-shout); font-weight: 800; font-style: italic; font-size: 34px; line-height: 1; color: #fde68a; text-shadow: 0 3px 0 #b45309, 0 0 18px rgba(252, 211, 77, .7); transform: rotate(-8deg); animation: lvo-combo .45s cubic-bezier(.34, 1.56, .64, 1) both; }
@keyframes lvo-combo { from { transform: rotate(-8deg) scale(2.4); opacity: 0; } to { transform: rotate(-8deg); opacity: 1; } }
.lvo-chips { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; }
.lvo-chip { display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: 999px; font-family: var(--font-bug); font-weight: 800; text-transform: uppercase; letter-spacing: .06em; font-size: 16px; animation: lvo-in .4s ease both; }
.lvo-chip.xp { background: rgba(252, 211, 77, .12); border: 1.5px solid rgba(252, 211, 77, .5); color: #fde68a; }
.lvo-chip.xp b { font-size: 26px; line-height: 1; color: #fcd34d; font-variant-numeric: tabular-nums; }
.lvo-chip.help { background: rgba(56, 189, 248, .1); border: 1.5px solid rgba(56, 189, 248, .45); color: #bae6fd; }
.lvo-range { font-family: var(--font-bug); font-weight: 800; font-size: 18px; padding: 3px 12px; border-radius: 999px; background: rgba(252, 211, 77, .12); border: 1px solid rgba(252, 211, 77, .4); color: #fde68a; animation: lvo-in .4s ease both; }

/* bloques de cartas */
.lvo-block { width: 100%; display: grid; gap: 12px; justify-items: center; animation: lvo-in .45s ease both; }
.lvo-h { margin: 0; font-family: var(--font-bug); font-weight: 800; text-transform: uppercase; letter-spacing: .14em; font-size: 13px; color: #94a3b8; }
.lvo-cards { display: flex; flex-wrap: wrap; justify-content: center; gap: 18px 14px; padding-bottom: 8px; }
.lvo-deal { animation: lvo-deal .45s cubic-bezier(.16, 1, .3, 1) both; }
@keyframes lvo-deal { from { opacity: 0; transform: translateY(50px) scale(.7); } to { opacity: 1; transform: none; } }
/* "Desbloqueaste" una carta a la vez (RarityReveal) */
.lvo-unlock-one { width: 100%; cursor: default; }
.lvo-unlock-one.can { cursor: pointer; }
.lvo-unlock-one :deep(.rr) { height: 330px; }
.lvo-dots { display: flex; gap: 6px; justify-content: center; }
.lvo-dots i { width: 7px; height: 7px; border-radius: 50%; background: rgba(255, 255, 255, .18); transition: background .25s, transform .25s; }
.lvo-dots i.on { background: #fcd34d; transform: scale(1.15); }
.lvo-skip-hint { margin: -4px 0 0; min-height: 16px; font-size: 12px; color: #94a3b8; animation: lvo-in .3s ease both; }
.lvo-all { font-family: var(--font-bug); font-weight: 700; font-size: 12px; letter-spacing: .06em; text-transform: uppercase; color: #8b93b8; background: none; border: 1px solid rgba(255, 255, 255, .12); border-radius: 999px; padding: 7px 16px; cursor: pointer; }
.lvo-all:hover { color: #fff; border-color: rgba(255, 255, 255, .25); }
@keyframes lvo-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
.lvo-rail { display: flex; gap: 10px; overflow-x: auto; max-width: 100%; padding: 6px 4px 12px; scrollbar-width: thin; }
.lvo-up { display: grid; justify-items: center; gap: 8px; flex: none; animation: lvo-in .4s ease both; }
.lvo-up .lv { font-family: var(--font-bug); font-weight: 800; font-size: 13px; letter-spacing: .06em; text-transform: uppercase; color: #94a3b8; }
.lvo-up .more { font-size: 11px; color: #64748b; margin-top: -6px; }
.lvo-up.nx .lv { color: #fcd34d; }
.lvo-up.nx :deep(.pcard) { animation: lvo-float 2s ease-in-out infinite; }
@keyframes lvo-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }

.lvo-btn { margin-top: 6px; font-family: var(--font-bug); font-weight: 800; text-transform: uppercase; letter-spacing: .1em; font-size: 18px; padding: 12px 38px; border-radius: 14px; border: 0; cursor: pointer; color: #141005; background: linear-gradient(180deg, #fde68a, #f59e0b); box-shadow: 0 10px 26px rgba(245, 158, 11, .35); animation: lvo-in .4s ease both; }
.lvo-btn:active { transform: scale(.96); }
.lvo-skip { margin: 4px 0 0; font-size: 12px; color: #64748b; }

/* ¡GOL! */
.lvo-gol { font-family: var(--font-shout); font-weight: 800; font-style: italic; text-transform: uppercase; font-size: clamp(76px, 20vw, 170px); line-height: 1; color: #fff; text-shadow: 0 6px 0 #b45309, 0 0 50px rgba(252, 211, 77, .6); animation: lvo-gol 1.15s cubic-bezier(.16, 1, .3, 1) both; white-space: nowrap; }
.lvo-gol .o { color: #fde68a; animation: lvo-stretch 1.1s ease-out both; }
@keyframes lvo-gol { 0% { transform: scale(2.6) rotate(-4deg); opacity: 0; filter: blur(10px); } 30% { transform: scale(1) rotate(-4deg); opacity: 1; filter: none; } 80% { transform: scale(1.05) rotate(-4deg); opacity: 1; } 100% { transform: scale(1.6) rotate(-4deg); opacity: 0; } }
@keyframes lvo-stretch { 0% { letter-spacing: -.08em; } 60% { letter-spacing: .06em; } 100% { letter-spacing: .03em; } }

/* FORJA (moodboard ascenso-forja). El SVG se arma por partes en rank-forge.js */
.lvo-forge { position: relative; width: min(100%, 360px); }
.forge { position: relative; height: clamp(330px, 48vh, 390px); }
.forge .rays { position: absolute; left: 50%; top: 38%; width: 170%; aspect-ratio: 1; translate: -50% -50%; border-radius: 50%; background: repeating-conic-gradient(from 0deg, var(--glow, #fcd34d) 0 7deg, transparent 7deg 20deg); -webkit-mask: radial-gradient(closest-side, #000 15%, transparent 72%); mask: radial-gradient(closest-side, #000 15%, transparent 72%); opacity: 0; pointer-events: none; animation: lvo-spin 18s linear infinite; }
.forge .rays.holo { background: repeating-conic-gradient(from 0deg, #f0abfc 0 6deg, transparent 6deg 12deg, #a5f3fc 12deg 18deg, transparent 18deg 24deg, #fde68a 24deg 30deg, transparent 30deg 36deg); }
@keyframes lvo-spin { to { rotate: 360deg; } }
.forge .wrap { position: absolute; left: 50%; top: 38%; width: min(52%, 180px); translate: -50% -50%; }
.forge #sv { width: 100%; overflow: visible; display: block; filter: drop-shadow(0 14px 26px rgba(0, 0, 0, .55)); }
.forge .name { position: absolute; left: 0; right: 0; bottom: 0; text-align: center; pointer-events: none; }
.forge .name .k { font: 600 13px var(--font-sans); color: #93a0bf; opacity: 0; }
.forge .name .n { font: 800 clamp(44px, 12vw, 64px)/.95 var(--font-shout); letter-spacing: .02em; color: #fff; opacity: 0; text-shadow: 0 0 30px var(--glow, #fcd34d), 0 4px 0 rgba(0, 0, 0, .35); }
.forge .name .l { font: 600 17px var(--font-shout); color: var(--glow, #fcd34d); opacity: 0; letter-spacing: .04em; }
.lvo-forge .fx { position: fixed; inset: 0; pointer-events: none; z-index: 3; }
.lvo-forge .fx canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
.lvo-forge .flash { position: absolute; inset: 0; background: #fff; opacity: 0; mix-blend-mode: screen; }
.lvo-next { display: flex; align-items: center; gap: 10px; font-size: 14px; color: #cbd5e1; animation: lvo-in .4s ease both; }
.lvo-next img { width: 40px; height: 40px; object-fit: contain; filter: grayscale(.4) brightness(.8); }
.lvo-next b { color: #fcd34d; }

.lvo-fade-enter-active { transition: opacity .3s ease; }
.lvo-fade-leave-active { transition: opacity .25s ease; }
.lvo-fade-enter-from, .lvo-fade-leave-to { opacity: 0; }

@media (prefers-reduced-motion: reduce) {
  .lvo *, .lvo-flash.on { animation-duration: .01ms !important; animation-iteration-count: 1 !important; }
}
</style>
