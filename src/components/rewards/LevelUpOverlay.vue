<script setup>
/**
 * SUBIR DE NIVEL / SUBIR DE RANGO (Moodboard 03 + cartas del 08)
 *
 * Acto RANGO (solo si cambió el rango): ¡GOL! que abre la ceremonia → el escudo
 * viejo tiembla y estalla → FORJA: el escudo nuevo (kit v2, RankCrest) se arma pieza
 * por pieza (aro, campo, medallón con emblema, cinta) y cada una se encastra con un
 * golpe metálico → "Al llegar ganás" (cartas del rango, boca abajo, se dan vuelta de
 * a una) → próximo rango a la vista. Con reduced-motion el escudo aparece entero.
 *
 * Acto NIVEL (diseño V4 aprobado: V4SubidaNivel): el escudo hexagonal con el
 * número (un ¡PUM! por nivel, ×2, ×3 si subiste varios), el escudo del rango
 * abajo, tu rango y el próximo, la barra completa y "Desbloqueaste": la
 * recompensa más rara como carta grande con su ícono REAL (level-rewards →
 * prize-card), dos cartas al costado y el XP y las ayudas como fichas chicas.
 * COBRAR cierra la escena (las recompensas de nivel ya quedaron en tu cuenta).
 *
 * Cola: resumen → logros → ESTO → cosméticos exclusivos (CosmeticUnlockOverlay
 * espera a que esta escena termine). Tocar el fondo adelanta la animación.
 */
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import { notificationsState, shiftLevelUpQueue, setLevelUpActive } from '@/stores/notifications'
import { TIERS, getTierForLevel, getNextTier, rankKitPrizes, tierGlow } from '@/services/tiers'
import { prizesForLevelRange, PRIZE_TYPE_LABEL, RARITY_ORDER } from '@/services/prize-card'
import { revealPrizes } from '@/services/prize-reveal'
import { soundManager } from '@/services/sounds'
import { sparks, center, fxOnTop, reducedMotion } from '@/services/game-fx'
import PrizeCard from './PrizeCard.vue'
import PowerupIcon from './PowerupIcon.vue'
import CosmeticIcon from './CosmeticIcon.vue'
import { success as hapticSuccess, tap as hapticTap } from '@/services/haptics'
import RankCrest from '@/components/ranks/RankCrest.vue'

const current = ref(null)
const stage = ref('level')      // 'rank' | 'level'
const rp = ref(0)               // fase del acto rango
const lp = ref(0)               // fase del acto nivel
const shownLevel = ref(0)       // número que se ve en el ¡PUM!
const pumKey = ref(0)           // re-dispara la animación del número
const bigPum = ref(false)
const flashKey = ref(0)
const rankFaceDown = ref([])    // por carta del rango
const rankCardEls = []
const numEl = ref(null)
const badgeEl = ref(null)
const stageEl = ref(null)
let timers = []
let cancelReveal = null

function T(fn, ms) { timers.push(setTimeout(fn, reducedMotion ? Math.min(ms, 60) : ms)) }
function clearTimers() { timers.forEach(clearTimeout); timers = []; cancelReveal?.(); cancelReveal = null }
onBeforeUnmount(clearTimers)

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
// Kit del rango con el copy acordado ("Ícono de rango Ícono"); tierPrizes() queda para compat.
const rankCards = computed(() => tierChanged.value ? rankKitPrizes(newTier.value) : [])
// Cartas = solo recompensas reales (cosméticos, rango, juegos). XP y ayudas van como fichas.
const cardPrizes = computed(() => prizes.value.filter(p => p.kind !== 'xp' && p.kind !== 'powerup'))
const xpTotal = computed(() => prizes.value.filter(p => p.kind === 'xp').reduce((a, p) => a + (Number(p.amount) || 0), 0))
const helpPrizes = computed(() => prizes.value.filter(p => p.kind === 'powerup'))
const hasUnlocks = computed(() => cardPrizes.value.length > 0 || xpTotal.value > 0 || helpPrizes.value.length > 0)
const xpShown = ref(0)

// ── V4: carta grande (la más rara), dos al costado y el resto en fichas ──
const RARITY_LABEL = { common: 'Común', rare: 'Raro', epic: 'Épico', legendary: 'Legendario' }
const RARITY_THEME = {
  common: { c: '#34d399', soft: 'rgba(52,211,153,0.28)', ring: 'rgba(52,211,153,0.6)', dark: '#064e3b', spin: 'conic-gradient(from 0deg,#34d399,#a7f3d0,#047857,#6ee7b7,#34d399)', bg: 'linear-gradient(180deg,#064e3b,#052e24 70%,#03140f)' },
  rare: { c: '#60a5fa', soft: 'rgba(96,165,250,0.28)', ring: 'rgba(96,165,250,0.65)', dark: '#1e3a8a', spin: 'conic-gradient(from 0deg,#3b82f6,#bfdbfe,#1e3a8a,#93c5fd,#3b82f6)', bg: 'linear-gradient(180deg,#1e3a8a,#111c44 70%,#0a1028)' },
  epic: { c: '#a855f7', soft: 'rgba(192,132,252,0.28)', ring: 'rgba(192,132,252,0.65)', dark: '#3b0764', spin: 'conic-gradient(from 0deg,#a855f7,#f0abfc,#6d28d9,#c084fc,#a855f7)', bg: 'linear-gradient(180deg,#3b0764,#1e1036 70%,#12091f)' },
  legendary: { c: '#fbbf24', soft: 'rgba(251,191,36,0.28)', ring: 'rgba(251,191,36,0.7)', dark: '#78350f', spin: 'conic-gradient(from 0deg,#f59e0b,#fef3c7,#b45309,#fcd34d,#f59e0b)', bg: 'linear-gradient(180deg,#78350f,#3a1d08 70%,#1c0f05)' },
}
const theme = (p) => RARITY_THEME[p?.rarity] || RARITY_THEME.common
// Más rara primero; a igual rareza, el ícono manda (es la carta que mejor luce en grande)
const KIND_ORDER = { icon: 0, frame: 1, banner: 2, game: 3, tier: 4, title: 5 }
const sortedCards = computed(() => [...cardPrizes.value].sort((a, b) => (RARITY_ORDER[b.rarity] || 0) - (RARITY_ORDER[a.rarity] || 0) || (KIND_ORDER[a.kind] ?? 9) - (KIND_ORDER[b.kind] ?? 9)))
const heroPrize = computed(() => sortedCards.value[0] || null)
const sidePrizes = computed(() => sortedCards.value.slice(1, 3))
const morePrizes = computed(() => sortedCards.value.slice(3))
const typeLabel = (p) => (PRIZE_TYPE_LABEL[p?.kind] || 'Premio').toUpperCase()
const tierIndex = computed(() => newTier.value ? TIERS.findIndex(t => t.key === newTier.value.key) + 1 : 0)
const tierLine = computed(() => {
  if (!newTier.value) return ''
  const parts = [newTier.value.label, `${tierIndex.value} de ${TIERS.length}`]
  if (nextTier.value) parts.push(`${nextTier.value.label} en el Nv ${nextTier.value.minLevel}`)
  return parts.join(' · ')
})
function collect() { hapticTap(); dismiss() }
const combo = ref(0)

const vw = ref(typeof window !== 'undefined' ? window.innerWidth : 1024)
function onResize() { vw.value = window.innerWidth }
const cardSize = computed(() => vw.value < 420 ? 104 : vw.value < 640 ? 120 : 140)
const upSize = computed(() => vw.value < 420 ? 84 : 96)

function flash() { flashKey.value++ }

// ─── Acto RANGO ─────────────────────────────────────────────
function runRank() {
  stage.value = 'rank'; rp.value = 0
  rankFaceDown.value = rankCards.value.map(() => true)
  nextTick(() => {
    T(() => { rp.value = 1; flash(); soundManager.playBig('goal') }, 150)        // ¡GOL!
    T(() => { rp.value = 2 }, 1300)                                              // escudo viejo
    T(() => { rp.value = 3 }, 1750)                                              // tiembla
    T(() => {                                                                    // estalla → arranca la FORJA
      rp.value = 4; flash()
      if (reducedMotion) soundManager.playBig('forge')
    }, 2400)
    // La Forja dura ~1,6 s (RankCrest emite hit por pieza y forged al final)
    T(() => { rp.value = 5 }, reducedMotion ? 2500 : 4050)                      // nombre del rango
    T(() => {                                                                    // "Al llegar ganás"
      rp.value = 6
      nextTick(() => {
        cancelReveal = revealPrizes(rankCards.value, i => { rankFaceDown.value[i] = false }, i => rankCardEls[i], {
          startDelay: 400,
          onDone: () => { rp.value = 7 },
        })
      })
    }, reducedMotion ? 2600 : 4450)
  })
}

// Cada pieza del escudo nuevo que se encastra: golpe metálico + chispas del color del rango.
// El medallón central es el golpe fuerte (suena la forja); el resto, golpes cortos.
function onForgeHit(part) {
  const el = badgeEl.value
  const glow = tierGlow(newTier.value)
  if (part === 'roundel') {
    soundManager.playBig('forge'); flash()
    if (el) { const c = center(el); sparks(c.x, c.y, 40, [glow, '#fff', '#fcd34d'], 150) }
    el?.animate?.([
      { transform: 'translate(0,0)' }, { transform: 'translate(-4px,3px)' }, { transform: 'translate(3px,-2px)' }, { transform: 'translate(0,0)' },
    ], { duration: 260, easing: 'ease-out' })
  } else {
    soundManager.play('stamp')
    if (el) { const c = center(el); sparks(c.x, c.y, 12, [glow, '#fff'], 70) }
  }
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
      hapticSuccess()
      if (xpTotal.value) countXp(xpTotal.value)
      T(() => { lp.value = 4 }, cardPrizes.value.length ? 1500 : 700)
    }, t + 500)
  })
}

// Tocar el fondo (o "Ver todo"): adelanta todo (sin saltearse lo que se gana)
function skip() {
  if (stage.value === 'rank') {
    if (rp.value >= 7) return goToLevel()
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
  lp.value = 4
}

function goToLevel() { clearTimers(); runLevel() }

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
            <p class="lvo-kick" :class="{ in: rp >= 5 }">¡Ascendiste de rango!</p>
            <div ref="badgeEl" class="lvo-badge" :style="{ '--rk-glow': tierGlow(newTier) }">
              <RankCrest v-if="rp < 4 && oldTier" :tier="oldTier" :size="180" class="old" :class="{ shake: rp === 3 }" />
              <template v-else-if="rp >= 4 && newTier">
                <span class="ring" aria-hidden="true"></span>
                <RankCrest :tier="newTier" :size="180" class="new" forge @hit="onForgeHit" />
              </template>
            </div>
            <h2 class="lvo-tier" :class="{ in: rp >= 5 }">{{ newTier?.label }}</h2>

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
                <RankCrest :tier="nextTier" :size="36" :ribbon="false" locked />
                <span>Próximo rango: <b>{{ nextTier.label }}</b> en el nivel {{ nextTier.minLevel }}</span>
              </template>
              <span v-else>Llegaste al rango máximo. ¡Sos el GOAT!</span>
            </div>
            <button v-if="rp >= 7" type="button" class="lvo-btn" @click="goToLevel">Seguir</button>
          </template>
        </div>

        <!-- ═══════════ ACTO 2 · SUBIDA DE NIVEL (V4) ═══════════ -->
        <div v-else ref="stageEl" class="lv4" role="dialog" aria-modal="true" :aria-label="`Subiste al nivel ${current.newLevel}`" @click.self="skip">
          <div class="lv4-rays" aria-hidden="true"><div></div></div>

          <div class="lv4-head" @click="skip">
            <p class="lv4-kick" :class="{ in: lp >= 1 }">{{ levelsUp > 1 ? `¡SUBISTE ${levelsUp} NIVELES!` : '¡SUBISTE DE NIVEL!' }}</p>
            <div ref="numEl" class="lv4-badge" :class="{ big: bigPum }">
              <span class="glow" aria-hidden="true"></span>
              <span class="rim" aria-hidden="true"></span>
              <span class="face">
                <span class="hl" aria-hidden="true"></span>
                <span class="shine" aria-hidden="true"></span>
                <span class="nv">NIVEL</span>
                <span :key="pumKey" class="n" :class="bigPum ? 'pum' : 'pum-s'">{{ shownLevel }}</span>
              </span>
              <img v-if="newTier?.image" :src="newTier.image" :alt="`Rango ${newTier.label}`" class="crest" />
              <span v-if="combo > 1 && lp < 3" :key="'c' + combo" class="lvo-combo">×{{ combo }}</span>
            </div>
            <span class="lv4-tier" :class="{ in: lp >= 2 }">{{ tierLine }}</span>
            <div class="lv4-bar" :class="{ in: lp >= 2 }">
              <span class="a">{{ current.oldLevel }}</span>
              <span class="track"><i></i><b>{{ levelsUp > 1 ? `${current.oldLevel} → ${current.newLevel}` : `Nivel ${current.oldLevel} completo` }}</b></span>
              <span class="ok" aria-hidden="true"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>
            </div>
          </div>

          <section v-if="lp >= 3 && hasUnlocks" class="lv4-un" aria-label="Recompensas desbloqueadas">
            <div class="lv4-h"><span></span><b>DESBLOQUEASTE</b><span></span></div>

            <div v-if="heroPrize" class="lv4-cards" :class="{ solo: !sidePrizes.length }">
              <!-- Carta grande: la recompensa más rara, con su ícono real -->
              <div class="hero" :style="{ boxShadow: `0 0 28px ${theme(heroPrize).ring}, 0 12px 28px rgba(0,0,0,.5)` }">
                <span class="spin" :style="{ background: theme(heroPrize).spin }" aria-hidden="true"></span>
                <div class="in" :style="{ background: `radial-gradient(80% 55% at 50% 38%, ${theme(heroPrize).soft}, transparent 70%), ${theme(heroPrize).bg}` }">
                  <span class="shine" aria-hidden="true"></span>
                  <span class="new">NUEVO</span>
                  <span class="art" :class="{ bare: heroPrize.kind !== 'icon' && heroPrize.kind !== 'title' }" :style="{ borderColor: theme(heroPrize).c, boxShadow: `0 0 22px ${theme(heroPrize).ring}, 0 8px 16px rgba(0,0,0,.5)` }">
                    <CosmeticIcon v-if="heroPrize.kind === 'icon'" :icon-key="heroPrize.styleKey || heroPrize.iconKey || ''" :rarity="heroPrize.rarity" :size="112" />
                    <span v-else-if="heroPrize.kind === 'title'" class="ttl">{{ heroPrize.name }}</span>
                    <PrizeCard v-else :prize="heroPrize" :size="94" />
                  </span>
                  <span class="k">{{ typeLabel(heroPrize) }}</span>
                  <span class="nm">{{ heroPrize.name }}</span>
                  <span class="rr" :style="{ background: theme(heroPrize).c }">{{ (RARITY_LABEL[heroPrize.rarity] || 'Común').toUpperCase() }}</span>
                </div>
              </div>
              <div v-if="sidePrizes.length" class="side">
                <div v-for="(p, i) in sidePrizes" :key="'s' + i" class="sc" :style="{ animationDelay: (0.3 + i * 0.15) + 's', background: `linear-gradient(170deg, ${theme(p).soft} 0%, rgba(15,23,42,0.92) 75%)`, borderColor: theme(p).ring }">
                  <span class="tp"><b :style="{ color: theme(p).c }">{{ typeLabel(p) }}</b><i :style="{ background: theme(p).soft }">{{ RARITY_LABEL[p.rarity] || 'Común' }}</i></span>
                  <span v-if="p.kind === 'title'" class="ttl" :style="{ borderColor: theme(p).c, background: `linear-gradient(180deg, ${theme(p).dark}, #0b1220)` }">{{ p.name }}</span>
                  <template v-else>
                    <span class="vis">
                      <CosmeticIcon v-if="p.kind === 'icon'" :icon-key="p.styleKey || p.iconKey || ''" :rarity="p.rarity" :size="50" />
                      <PrizeCard v-else :prize="p" :size="50" />
                    </span>
                    <span class="nm">{{ p.name }}</span>
                  </template>
                </div>
              </div>
            </div>

            <div v-if="morePrizes.length" class="lv4-more">
              <PrizeCard v-for="(p, i) in morePrizes" :key="'m' + i" :prize="p" :size="56" />
            </div>

            <div v-if="xpTotal || helpPrizes.length" class="lv4-chips" :style="{ '--n': (xpTotal ? 1 : 0) + helpPrizes.length }">
              <div v-if="xpTotal" class="chip" style="border-color: rgba(34,211,238,0.35)">
                <span class="ci" style="background: linear-gradient(135deg,#34d399,#22d3ee,#818cf8)"><b>XP</b></span>
                <span class="cv"><b style="color:#a5f3fc">+{{ xpShown.toLocaleString('es-AR') }}</b><small>XP</small></span>
              </div>
              <div v-for="(h, i) in helpPrizes" :key="'h' + i" class="chip" style="border-color: rgba(167,139,250,0.35)" :style="{ animationDelay: (0.2 + i * 0.1) + 's' }">
                <span class="ci" style="background: linear-gradient(160deg,#a78bfa,#6d28d9); color:#fff"><PowerupIcon :type="h.powerup" :size="20" /></span>
                <span class="cv"><b style="color:#ddd6fe">{{ h.name.replace(/ ×\d+$/, '') }}</b><small>ayuda ×{{ h.count || 1 }}</small></span>
              </div>
            </div>
          </section>

          <div class="lv4-go">
            <button v-if="lp >= 4" type="button" class="go" @click="collect">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1c1206" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="8" width="18" height="13" rx="2" /><path d="M3 12h18M12 8v13M12 8c-2-4-6-4-6-1.5S9 8 12 8zM12 8c2-4 6-4 6-1.5S15 8 12 8z" /></svg>{{ hasUnlocks ? 'COBRAR' : 'SEGUIR' }}
            </button>
            <button v-else type="button" class="skip" @click="skip">Tocá para adelantar</button>
          </div>
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

/* escudo */
.lvo-badge { position: relative; width: clamp(130px, 32vw, 180px); aspect-ratio: 120 / 140; display: grid; place-items: center; }
.lvo-badge :deep(svg) { width: 100%; height: auto; }
.lvo-badge .old { filter: grayscale(.5) brightness(.8); animation: lvo-in .4s ease both; }
.lvo-badge .old.shake { animation: lvo-shake .6s ease-in-out infinite; filter: brightness(1.4) saturate(1.3); }
@keyframes lvo-shake { 10%, 90% { transform: translate(-1px, 1px); } 20%, 80% { transform: translate(3px, -2px) rotate(2deg); } 30%, 50%, 70% { transform: translate(-5px, 3px) rotate(-3deg); } 40%, 60% { transform: translate(5px, -3px) rotate(3deg); } }
/* El escudo nuevo se arma por piezas (RankCrest forge); acá solo el resplandor del rango al final */
.lvo-badge .new { animation: lvo-forge-glow .5s ease-out 1.6s both; }
@keyframes lvo-forge-glow { from { filter: none; } to { filter: drop-shadow(0 0 26px color-mix(in srgb, var(--rk-glow, #fcd34d) 60%, transparent)); } }
.lvo-badge .ring { position: absolute; inset: 10%; border-radius: 50%; border: 4px solid var(--rk-glow, #fcd34d); animation: lvo-shock .8s ease-out 1.18s both; }
.lvo-tier { margin: 0; font-family: var(--font-shout); font-weight: 800; font-style: italic; text-transform: uppercase; font-size: clamp(40px, 9vw, 64px); line-height: .95; color: #fff; opacity: 0; transform: scale(.8); transition: opacity .4s, transform .5s cubic-bezier(.34, 1.56, .64, 1); }
.lvo-tier.in { opacity: 1; transform: none; }
.lvo-next { display: flex; align-items: center; gap: 10px; font-size: 14px; color: #cbd5e1; animation: lvo-in .4s ease both; }
.lvo-next :deep(svg) { flex: none; }
.lvo-next b { color: #fcd34d; }

.lvo-fade-enter-active { transition: opacity .3s ease; }
.lvo-fade-leave-active { transition: opacity .25s ease; }
.lvo-fade-enter-from, .lvo-fade-leave-to { opacity: 0; }


/* ═══ Acto nivel V4 ═══ */
.lv4 { position: fixed; inset: 0; z-index: 1; display: flex; flex-direction: column; align-items: center; overflow-x: hidden; overflow-y: auto; color: #f1f5f9;
  background: radial-gradient(80% 42% at 50% 24%, rgba(99, 102, 241, .45), transparent 72%), #0b1220; padding: env(safe-area-inset-top, 0px) 0 0; }
.lv4-rays { position: absolute; left: 50%; top: 210px; width: 760px; height: 760px; margin: -380px 0 0 -380px; pointer-events: none; }
.lv4-rays div { width: 100%; height: 100%; border-radius: 50%; background: repeating-conic-gradient(from 0deg, rgba(199, 210, 254, .10) 0deg 7deg, transparent 7deg 20deg); -webkit-mask-image: radial-gradient(circle, #000 18%, transparent 62%); mask-image: radial-gradient(circle, #000 18%, transparent 62%); animation: lv4-rays 28s linear infinite; }
@keyframes lv4-rays { to { transform: rotate(360deg); } }
.lv4-head { position: relative; width: 100%; max-width: 430px; display: flex; flex-direction: column; align-items: center; padding-top: 34px; }
.lv4-kick { margin: 0; font-family: var(--font-shout); font-weight: 800; font-style: italic; font-size: 26px; letter-spacing: 1.5px; color: #fde68a; text-shadow: 0 2px 0 rgba(120, 53, 15, .8); opacity: 0; transform: translateY(6px); transition: opacity .4s, transform .4s; }
.lv4-kick.in { opacity: 1; transform: none; }
.lv4-badge { position: relative; margin-top: 14px; width: 176px; height: 196px; animation: lv4-pop .6s cubic-bezier(.2, .9, .3, 1.2) .1s both; }
@keyframes lv4-pop { 0% { transform: scale(.4); opacity: 0; } 65% { transform: scale(1.08); opacity: 1; } 100% { transform: scale(1); } }
.lv4-badge .glow { position: absolute; inset: -26px; border-radius: 50%; background: radial-gradient(circle, rgba(165, 180, 252, .65), transparent 65%); animation: lv4-glow 2.4s ease-in-out infinite; }
@keyframes lv4-glow { 0%, 100% { opacity: .55; } 50% { opacity: 1; } }
.lv4-badge .rim, .lv4-badge .face { position: absolute; clip-path: polygon(50% 0, 100% 22%, 100% 74%, 50% 100%, 0 74%, 0 22%); }
.lv4-badge .rim { inset: 0; background: linear-gradient(180deg, #eef2ff, #c7d2fe 40%, #818cf8); }
.lv4-badge .face { inset: 7px; background: radial-gradient(90% 70% at 50% 25%, #a5b4fc 0%, #818cf8 30%, #4f46e5 70%, #312e81 100%); overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.lv4-badge .hl { position: absolute; left: 0; right: 0; top: 0; height: 46%; background: linear-gradient(180deg, rgba(255, 255, 255, .28), rgba(255, 255, 255, 0)); }
.lv4-badge .shine, .lv4-cards .shine { position: absolute; top: -10%; bottom: -10%; left: 0; width: 38%; background: linear-gradient(90deg, transparent, rgba(255, 255, 255, .5), transparent); animation: lv4-shine 3.4s ease-in-out 1s infinite; transform: translateX(-140%) skewX(-18deg); z-index: 2; }
@keyframes lv4-shine { 0%, 35% { transform: translateX(-140%) skewX(-18deg); } 75%, 100% { transform: translateX(260%) skewX(-18deg); } }
.lv4-badge .nv { position: relative; font-family: var(--font-bug); font-weight: 800; font-size: 22px; letter-spacing: 4px; color: #e0e7ff; margin-top: 6px; }
.lv4-badge .n { position: relative; font-family: var(--font-shout); font-weight: 800; font-style: italic; font-size: 104px; line-height: .82; color: #fff; text-shadow: 0 4px 0 #312e81, 0 0 24px rgba(199, 210, 254, .6); font-variant-numeric: tabular-nums; }
.lv4-badge .crest { position: absolute; left: 50%; bottom: -16px; margin-left: -19px; width: 38px; height: 44px; object-fit: contain; filter: drop-shadow(0 4px 6px rgba(0, 0, 0, .5)); }
.lv4-badge .lvo-combo { right: -18px; top: 18px; }
.lv4-tier { margin-top: 24px; padding: 0 16px; text-align: center; font-size: 13px; font-weight: 600; color: #a5b4fc; opacity: 0; transition: opacity .4s; }
.lv4-tier.in, .lv4-bar.in { opacity: 1; }
.lv4-bar { margin-top: 12px; width: 300px; max-width: calc(100% - 32px); display: flex; align-items: center; gap: 8px; opacity: 0; transition: opacity .4s .1s; }
.lv4-bar .a { font-family: var(--font-bug); font-weight: 800; font-size: 15px; color: #94a3b8; }
.lv4-bar .track { position: relative; flex: 1; height: 16px; border-radius: 999px; background: rgba(255, 255, 255, .08); border: 1px solid rgba(199, 210, 254, .4); overflow: hidden; display: block; }
.lv4-bar .track i { display: block; width: 100%; height: 100%; background: linear-gradient(90deg, #34d399, #22d3ee, #818cf8); transform-origin: left; animation: lv4-fill .9s cubic-bezier(.3, .7, .2, 1) both; }
@keyframes lv4-fill { from { transform: scaleX(0); } }
.lv4-bar .track b { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-family: var(--font-bug); font-weight: 800; font-size: 12px; text-shadow: 0 1px 2px #000; white-space: nowrap; }
.lv4-bar .ok { width: 22px; height: 22px; border-radius: 50%; background: #22c55e; display: grid; place-items: center; flex: none; }

.lv4-un { position: relative; width: calc(100% - 32px); max-width: 398px; margin-top: 20px; display: flex; flex-direction: column; gap: 10px; animation: lv4-in .4s ease both; }
@keyframes lv4-in { from { opacity: 0; transform: translateY(14px) scale(.96); } to { opacity: 1; transform: none; } }
.lv4-h { display: flex; align-items: center; gap: 10px; }
.lv4-h span { flex: 1; height: 1px; background: linear-gradient(90deg, transparent, rgba(199, 210, 254, .4)); }
.lv4-h span:last-child { background: linear-gradient(90deg, rgba(199, 210, 254, .4), transparent); }
.lv4-h b { font-family: var(--font-bug); font-weight: 800; font-size: 15px; letter-spacing: 2px; color: #c7d2fe; }
.lv4-cards { display: grid; grid-template-columns: 186px minmax(0, 1fr); gap: 10px; }
.lv4-cards.solo { grid-template-columns: 200px; justify-content: center; }
.hero { position: relative; height: 226px; border-radius: 20px; padding: 2px; overflow: hidden; animation: lv4-hero .7s cubic-bezier(.2, .9, .3, 1.2) .15s both; }
@keyframes lv4-hero { 0% { opacity: 0; transform: translateY(22px) scale(.8) rotate(-4deg); } 70% { opacity: 1; transform: translateY(-3px) scale(1.04) rotate(1deg); } 100% { opacity: 1; transform: none; } }
.hero .spin { position: absolute; left: 50%; top: 50%; width: 340px; height: 340px; margin: -170px 0 0 -170px; display: block; animation: lv4-rays 6s linear infinite; }
.hero .in { position: relative; height: 100%; box-sizing: border-box; border-radius: 18px; overflow: hidden; display: flex; flex-direction: column; align-items: center; padding-top: 10px; }
.hero .new { position: absolute; left: 10px; top: 10px; z-index: 3; padding: 2px 7px; border-radius: 6px; background: #fbbf24; color: #1c1206; font-family: var(--font-bug); font-weight: 800; font-size: 12px; letter-spacing: 1px; }
.hero .art { position: relative; margin-top: 14px; width: 120px; height: 120px; box-sizing: border-box; border-radius: 22px; border: 3px solid; overflow: hidden; display: grid; place-items: center; background: rgba(0, 0, 0, .25); animation: lv4-float 3s ease-in-out 1.3s infinite; }
@keyframes lv4-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
.hero .art > :not(.ttl) { max-width: 100%; max-height: 100%; }
.hero .art.bare { border: 0; background: none; box-shadow: none !important; overflow: visible; }
.hero .art .ttl { padding: 8px; text-align: center; font-family: var(--font-shout); font-weight: 800; font-style: italic; font-size: 22px; line-height: 1; text-transform: uppercase; }
.hero .k { position: relative; margin-top: 10px; font-size: 10px; font-weight: 800; letter-spacing: 1.6px; color: #e9d5ff; }
.hero .nm { position: relative; max-width: 92%; font-family: var(--font-shout); font-weight: 800; font-style: italic; font-size: 26px; line-height: .95; text-transform: uppercase; color: #fff; text-shadow: 0 2px 0 rgba(0, 0, 0, .4); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hero .rr { position: relative; margin-top: 4px; padding: 1px 9px; border-radius: 6px; font-family: var(--font-bug); font-weight: 800; font-size: 13px; letter-spacing: 1.2px; color: #fff; }
.side { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.sc { position: relative; flex: 1; min-height: 0; box-sizing: border-box; border-radius: 16px; padding: 8px; border: 1.5px solid; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px; animation: lv4-in .4s cubic-bezier(.2, .9, .3, 1.15) both; min-width: 0; }
.sc .tp { display: flex; align-items: center; gap: 5px; }
.sc .tp b { font-size: 10px; font-weight: 800; letter-spacing: 1.4px; }
.sc .tp i { font-style: normal; padding: 0 6px; border-radius: 5px; font-size: 10px; font-weight: 800; color: #fff; }
.sc .vis { width: 50px; height: 50px; flex: none; border-radius: 12px; overflow: hidden; display: grid; place-items: center; }
.sc .vis > * { max-width: 100%; max-height: 100%; }
.sc .nm { max-width: 100%; font-family: var(--font-bug); font-weight: 800; font-size: 17px; line-height: 1; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sc .ttl { max-width: 100%; padding: 6px 12px; box-sizing: border-box; border-radius: 10px; border: 1.5px solid; box-shadow: inset 0 1px 0 rgba(255, 255, 255, .25); font-family: var(--font-shout); font-weight: 800; font-style: italic; font-size: 20px; line-height: 1; letter-spacing: .5px; color: #fff; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lv4-more { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }
.lv4-chips { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.chip { height: 50px; box-sizing: border-box; border-radius: 14px; padding: 0 8px; background: rgba(255, 255, 255, .05); border: 1px solid; display: flex; align-items: center; gap: 8px; min-width: 0; animation: lv4-in .4s cubic-bezier(.2, .9, .3, 1.15) .5s both; }
.chip .ci { width: 32px; height: 32px; flex-shrink: 0; border-radius: 10px; box-shadow: inset 0 1px 0 rgba(255, 255, 255, .4); display: grid; place-items: center; }
.chip .ci b { font-family: var(--font-shout); font-weight: 800; font-style: italic; font-size: 15px; line-height: 1; color: #0b1220; }
.chip .cv { display: flex; flex-direction: column; min-width: 0; }
.chip .cv b { font-family: var(--font-bug); font-weight: 800; font-size: 19px; line-height: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.chip .cv small { font-size: 10px; font-weight: 700; color: #94a3b8; white-space: nowrap; }
.lv4-go { position: sticky; bottom: 0; margin-top: auto; width: calc(100% - 32px); max-width: 398px; padding: 16px 0 calc(20px + env(safe-area-inset-bottom, 0px)); display: flex; flex-direction: column; align-items: center; }
.lv4-go .go { width: 100%; min-height: 62px; border: 0; border-radius: 16px; background: linear-gradient(180deg, #fcd34d 0%, #f59e0b 100%); border-bottom: 4px solid #b45309; color: #1c1206; display: flex; align-items: center; justify-content: center; gap: 10px; font-family: var(--font-shout); font-weight: 800; font-style: italic; font-size: 30px; letter-spacing: 1.5px; cursor: pointer; animation: lv4-in .35s ease both, lv4-pulse 2s ease-in-out 1s infinite; }
.lv4-go .go:active { transform: translateY(2px); border-bottom-width: 2px; }
@keyframes lv4-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(251, 191, 36, .5); } 50% { box-shadow: 0 0 0 10px rgba(251, 191, 36, 0); } }
.lv4-go .skip { min-height: 44px; padding: 0 16px; border: 0; background: none; color: #64748b; font-size: 13px; cursor: pointer; }
@media (prefers-reduced-motion: reduce) {
  .lvo *, .lvo-flash.on { animation-duration: .01ms !important; animation-iteration-count: 1 !important; }
  .lv4-rays div, .hero .spin, .lv4-badge .shine, .lv4-cards .shine { display: none; }
}
</style>
