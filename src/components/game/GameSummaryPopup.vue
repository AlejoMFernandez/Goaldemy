<script>
/**
 * POPUP FINAL = EL RESUMEN (Moodboard 07 v2)
 *
 * Limpio y en orden, como una transmisión:
 *  1. ¡VICTORIA! / DERROTA solo (sin zócalo arriba) + juego · dificultad.
 *  2. Estrellas por PRECISIÓN (3 = sin errores, 2 = hasta 2, 1 = más) o, si
 *     perdiste, las pelotas que faltaron.
 *  3. El XP en grande y, debajo, de dónde salió (aciertos, ¡Basta!, PRO…).
 *  4. Barra de nivel + próximo premio (cuánto falta, contado en aciertos).
 *  5. Racha del juego con escena: se enciende una llama nueva o se apaga
 *     con humo y el número se tacha.
 *  6. Compartir / Continuar.
 * Los logros medios y difíciles NO se listan acá: aparecen con su escena al
 * cerrar (cola: resumen → logros → ¡PUM! → cosméticos). Los fáciles ya
 * salieron como cartel durante el partido.
 */
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { soundManager } from '@/services/sounds'
import { setSuppressOverlays } from '@/stores/notifications'
import { friendlyNameForSlug } from '@/services/games'
import { buildShareText, shareOrCopy } from '@/services/share'
import { getAuthUser } from '@/services/auth'
import { computeGuestRewards, getPendingGuestSummary } from '@/services/guest-play'
import { fetchDailyWinStreak } from '@/services/game-modes'
import { upcomingPrizes, nextRealPrize } from '@/services/prize-card'
import { sparks, center, smoke, reducedMotion } from '@/services/game-fx'
import PrizeCard from '@/components/rewards/PrizeCard.vue'

const FLAME_PATH = 'M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67z'

export default {
  name: 'GameSummaryPopup',
  components: { PrizeCard },
  props: {
    show: { type: Boolean, default: false },
    corrects: { type: Number, default: 0 },
    score: { type: Number, default: 0 },
    maxStreak: { type: Number, default: 0 },
    lifetimeMaxStreak: { type: Number, default: 0 },
    levelBefore: { type: Number, default: null },
    levelAfter: { type: Number, default: null },
    xpBeforeTotal: { type: Number, default: 0 },
    xpAfterTotal: { type: Number, default: 0 },
    beforePercent: { type: Number, default: 0 },
    afterPercent: { type: Number, default: 0 },
    progressShown: { type: Number, default: 0 },
    xpToNextAfter: { type: Number, default: null },
    winThreshold: { type: Number, default: 10 },
    backPath: { type: String, default: '/play/points' },
    xpEarned: { type: Number, default: 0 },
    difficulty: { type: String, default: 'normal' },
    gameName: { type: String, default: '' },
    // Invitado sin cuenta: reemplaza la barra de nivel por el teaser y las
    // acciones finales por el muro de registro (ver services/guest-play.js)
    guest: { type: Boolean, default: false },
    // Texto de resultado custom para compartir (ej: "Racha de 12 🔥")
    resultLine: { type: String, default: '' },
    // Nuevos (opcionales): errores de la partida → estrellas por precisión,
    // y el desglose del XP [{ kind: 'ball'|'clock'|'flag', label, xp }]
    errors: { type: Number, default: null },
    xpBreakdown: { type: Array, default: () => [] },
  },
  emits: ['close'],
  setup(props, { emit }) {
    const phase = ref(0)
    const animatedXp = ref(0)
    const starsRevealed = ref(0)
    const xpBarWidth = ref(0)
    const levelShown = ref(null)
    const levelPop = ref(false)
    const claimGate = ref(false)
    const guestPreview = computed(() => computeGuestRewards(props.corrects, props.winThreshold))
    const guestSummary = ref({ count: 0, games: [], xp: 0, fichas: 0 })
    const guestTotalXp = computed(() => Math.max(guestSummary.value.xp, guestPreview.value.xp))
    const guestShowsAccumulated = computed(() => guestSummary.value.xp > guestPreview.value.xp)
    const cardEl = ref(null)
    const starEls = []
    const flameNewEl = ref(null)
    const flamesEl = ref(null)
    let timers = []
    let countFrame = null

    const won = computed(() => props.corrects >= props.winThreshold)
    const slug = computed(() => {
      try { return ((window.location?.pathname || '').match(/\/games\/([a-z0-9-]+)/i) || [])[1] || '' } catch { return '' }
    })

    // Estrellas por PRECISIÓN (decisión moodboard 07). Sin dato de errores → criterio anterior.
    const starCount = computed(() => {
      if (!won.value) return 0
      if (props.errors != null) return props.errors === 0 ? 3 : props.errors <= 2 ? 2 : 1
      const ratio = props.corrects / Math.max(props.winThreshold, 1)
      return ratio >= 1 ? 3 : ratio >= 0.8 ? 2 : ratio >= 0.5 ? 1 : 0
    })
    const accuracy = computed(() => {
      if (props.errors != null) {
        const tries = (props.corrects || 0) + (props.errors || 0)
        return tries > 0 ? Math.round((props.corrects / tries) * 100) : 0
      }
      if (props.winThreshold <= 0) return 0
      return Math.round((props.corrects / props.winThreshold) * 100)
    })
    const precisionLine = computed(() => {
      if (!won.value || props.errors == null) return ''
      if (props.errors === 0) return 'sin errores'
      const next = starCount.value < 3 ? (starCount.value === 1 ? props.errors - 2 : props.errors) : 0
      return next > 0 ? `con ${next} ${next === 1 ? 'error' : 'errores'} menos eran ${'★'.repeat(starCount.value + 1)}` : ''
    })
    const missing = computed(() => Math.max(0, props.winThreshold - props.corrects))
    const ballsTotal = computed(() => Math.min(10, Math.max(1, props.winThreshold)))

    const difficultyLabel = computed(() => props.difficulty === 'easy' ? 'Fácil' : props.difficulty === 'hard' ? 'Difícil' : 'Normal')
    const displayName = computed(() => props.gameName || (slug.value ? friendlyNameForSlug(slug.value) : ''))
    const subLine = computed(() => [displayName.value, difficultyLabel.value, props.winThreshold ? `${Math.min(props.corrects, props.winThreshold)}/${props.winThreshold}` : ''].filter(Boolean).join(' · '))

    // XP real (con PRO) = delta del total; si no hay snapshot, el XP base del juego
    const xpGained = computed(() => Math.max(0, (props.xpAfterTotal - props.xpBeforeTotal) || 0))
    const baseXp = computed(() => Math.max(0, props.xpEarned || 0))
    const totalXp = computed(() => xpGained.value > 0 ? xpGained.value : baseXp.value)
    const bonusXp = computed(() => (xpGained.value > 0 && baseXp.value > 0) ? Math.max(0, xpGained.value - baseXp.value) : 0)
    const chips = computed(() => {
      const rows = (props.xpBreakdown || []).filter(r => r && r.xp > 0)
      const list = rows.length ? [...rows] : (baseXp.value > 0 ? [{ kind: 'ball', label: `${props.corrects} aciertos`, xp: baseXp.value }] : [])
      if (bonusXp.value > 0) list.push({ kind: 'pro', label: 'Bonus PRO', xp: bonusXp.value })
      return list
    })
    const didLevelUp = computed(() => (props.levelAfter || 0) > (props.levelBefore || 0))
    const barCombo = ref(0)
    const barEl = ref(null)

    // Próximo premio de nivel (moodboard 03/08)
    const nextPrize = computed(() => {
      const lvl = props.levelAfter || props.levelBefore
      return lvl ? nextRealPrize(lvl) : null
    })
    const perCorrect = computed(() => props.corrects > 0 ? Math.max(1, Math.round(baseXp.value / Math.max(1, props.corrects))) : 0)

    // ── Racha del juego ──
    const streakBefore = ref(null)
    const streakAfter = ref(null)
    const rkPhase = ref(0) // 0 oculto · 1 visible · 2 cambio (llama/humo) · 3 número nuevo
    const showStreak = computed(() => !props.guest && streakBefore.value != null && (won.value || streakBefore.value > 0))
    const flamesShown = computed(() => Math.min(5, Math.max(0, streakBefore.value || 0)))
    async function loadStreak() {
      let before = null
      try { const v = sessionStorage.getItem(`gl:streak_before:${slug.value}`); if (v != null && v !== '') before = Number(v) } catch {}
      let after = null
      try { after = slug.value ? await fetchDailyWinStreak(slug.value) : null } catch {}
      if (before == null && after != null) before = won.value ? Math.max(0, after - 1) : null
      if (after == null && before != null) after = won.value ? before + 1 : 0
      if (!won.value) after = 0
      streakBefore.value = before
      streakAfter.value = after
    }

    // ── Compartir ──
    const shared = ref(false)
    async function onShare() {
      const text = buildShareText({
        gameName: displayName.value,
        corrects: props.corrects,
        total: props.winThreshold,
        accuracy: accuracy.value,
        maxStreak: props.maxStreak,
        won: won.value,
        resultLine: props.resultLine || undefined,
        refCode: getAuthUser()?.referral_code || '',
      })
      const result = await shareOrCopy(text)
      if (result === 'copied') { shared.value = true; setTimeout(() => { shared.value = false }, 2200) }
    }

    function T(fn, ms) { timers.push(setTimeout(fn, reducedMotion ? Math.min(ms, 60) : ms)) }
    function animateTo(target, setter, duration = 700) {
      const start = performance.now()
      function step(now) {
        const t = Math.min((now - start) / duration, 1)
        setter(Math.round(target * (1 - Math.pow(1 - t, 3))))
        if (t < 1) countFrame = requestAnimationFrame(step)
      }
      countFrame = requestAnimationFrame(step)
    }
    function animateBar(from, to, duration, done) {
      const start = performance.now()
      function step(now) {
        const t = Math.min((now - start) / duration, 1)
        xpBarWidth.value = from + (to - from) * (1 - Math.pow(1 - t, 3))
        if (t < 1) countFrame = requestAnimationFrame(step)
        else if (done) done()
      }
      countFrame = requestAnimationFrame(step)
    }

    function runSequence() {
      clearAll()
      phase.value = 0; animatedXp.value = 0; starsRevealed.value = 0; rkPhase.value = 0
      xpBarWidth.value = props.beforePercent || 0
      levelShown.value = props.levelBefore
      levelPop.value = false
      barCombo.value = 0
      claimGate.value = false
      if (props.guest) guestSummary.value = getPendingGuestSummary()
      else loadStreak()

      T(() => { phase.value = 1; soundManager.play(won.value ? 'whistle' : 'lose'); if (won.value) soundManager.play('stamp') }, 150)
      let t = 750
      if (won.value) {
        for (let i = 0; i < 3; i++) {
          const idx = i
          T(() => {
            starsRevealed.value = idx + 1
            if (idx < starCount.value) {
              soundManager.play('starReveal')
              const el = starEls[idx]
              if (el) { const c = center(el); sparks(c.x, c.y, 10, ['#fcd34d', '#fff'], 46) }
            }
          }, t + i * 260)
        }
        t += 3 * 260
      }
      T(() => { phase.value = 2 }, t)                       // precisión / pelotas que faltaron
      t += 400
      T(() => { phase.value = 3; animateTo(totalXp.value, v => { animatedXp.value = v }, 800) }, t)   // XP
      t += 1000
      T(() => {                                               // barra de nivel
        phase.value = 4
        if (props.guest) return
        const from = props.beforePercent || 0
        if (didLevelUp.value) {
          // La barra que desborda (moodboard 03): una vuelta por nivel, cada una más rápida, con ×2, ×3
          const total = Math.max(1, (props.levelAfter || 0) - (props.levelBefore || 0))
          let i = 0
          const cycle = (start) => {
            const dur = Math.max(320, 700 - i * 200)
            animateBar(start, 100, dur, () => {
              i++
              levelShown.value = (props.levelBefore || 0) + i
              levelPop.value = false
              requestAnimationFrame(() => { levelPop.value = true })
              if (total > 1) barCombo.value = i
              soundManager.play(i === total ? 'levelUp' : 'pumSmall')
              const el = barEl.value
              if (el) { const rc = el.getBoundingClientRect(); sparks(rc.right - 4, rc.top + rc.height / 2, 14, ['#fcd34d', '#fff'], 50) }
              xpBarWidth.value = 0
              if (i < total) T(() => cycle(0), 220)
              else animateBar(0, props.progressShown || props.afterPercent || 0, 600)
            })
          }
          cycle(from)
        } else {
          animateBar(from, props.progressShown || props.afterPercent || 0, 1000)
        }
      }, t)
      t += 1300
      T(() => {                                               // racha del juego
        phase.value = 5
        if (!showStreak.value) return
        rkPhase.value = 1
        T(() => {
          rkPhase.value = 2
          if (won.value) {
            soundManager.play('hint')
            const el = flameNewEl.value
            if (el) { const c = center(el); sparks(c.x, c.y, 16, ['#fcd34d', '#fb923c', '#fff'], 44) }
          } else {
            soundManager.play('lose')
            if (flamesEl.value) { smoke(flamesEl.value); setTimeout(() => flamesEl.value && smoke(flamesEl.value), 350) }
          }
        }, 450)
        T(() => { rkPhase.value = 3 }, won.value ? 950 : 1600)
      }, t)
      T(() => { phase.value = 6 }, t + (showStreak.value ? 1400 : 200))   // botones
    }

    function clearAll() {
      timers.forEach(clearTimeout)
      timers = []
      if (countFrame) cancelAnimationFrame(countFrame)
    }

    // Al cerrar se liberan las escenas en cola (logros → ¡PUM! → cosméticos)
    watch(() => props.show, (val) => {
      if (val) runSequence()
      else { clearAll(); setSuppressOverlays(false) }
    })
    onMounted(() => { if (props.show) runSequence() })
    onUnmounted(clearAll)

    function onContinue() { emit('close'); setSuppressOverlays(false) }

    return { barCombo, barEl,
      phase, won, animatedXp, starsRevealed, starCount, accuracy, precisionLine, missing, ballsTotal, xpBarWidth,
      levelShown, levelPop, claimGate, guestPreview, guestSummary, guestTotalXp, guestShowsAccumulated,
      subLine, totalXp, chips, didLevelUp, nextPrize, perCorrect,
      streakBefore, streakAfter, rkPhase, showStreak, flamesShown, FLAME_PATH,
      shared, onShare, onContinue, cardEl, starEls, flameNewEl, flamesEl,
    }
  },
}
</script>

<template>
  <Teleport to="body">
    <Transition name="sm-fade">
      <div v-if="show" class="sm-wrap">
        <div ref="cardEl" class="sm" :class="won ? 'is-win' : 'is-loss'" role="dialog" aria-modal="true" :aria-label="won ? 'Victoria' : 'Derrota'">
          <!-- 1 · resultado -->
          <div class="sm-top">
            <h2 class="big" :class="{ in: phase >= 1 }">{{ won ? '¡Victoria!' : 'Derrota' }}</h2>
            <p class="sub" :class="{ in: phase >= 1 }">{{ subLine }}</p>

            <!-- 2 · estrellas por precisión / pelotas que faltaron -->
            <div v-if="won" class="stars" :aria-label="`${starCount} de 3 estrellas`">
              <svg v-for="i in 3" :key="i" :ref="el => { starEls[i - 1] = el }" viewBox="0 0 24 24"
                   :class="{ in: starsRevealed >= i && i <= starCount, off: starsRevealed >= i && i > starCount }">
                <path d="M12 2l3 6.9 7.5.7-5.7 5 1.7 7.4L12 18.3 5.5 22l1.7-7.4-5.7-5 7.5-.7z" fill="#fcd34d" stroke="#b45309" stroke-width="1.2" />
              </svg>
            </div>
            <div v-else class="short" :class="{ in: phase >= 2 }">
              <i v-for="i in ballsTotal" :key="i" :class="{ no: i > corrects }"></i>
            </div>
            <p class="prec" :class="{ in: phase >= 2 }">
              <template v-if="won && errors != null">Precisión <b>{{ accuracy }} %</b><template v-if="precisionLine"> · {{ precisionLine }}</template></template>
              <template v-else-if="!won && missing > 0">Te faltaron <b>{{ missing }}</b></template>
            </p>
          </div>

          <div class="sm-body">
            <!-- 3 · el XP en grande -->
            <div v-if="!guest" class="gain" :class="{ in: phase >= 3 }">
              <div class="xp"><span>+{{ animatedXp }}</span><small>XP</small></div>
              <div v-if="chips.length" class="chips">
                <span v-for="(c, i) in chips" :key="i" class="chip" :style="{ transitionDelay: (0.1 + i * 0.12) + 's' }">
                  <svg v-if="c.kind === 'clock'" viewBox="0 0 24 24" fill="none" stroke="#fcd34d" stroke-width="2.6" stroke-linecap="round"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l3 2M9 2h6" /></svg>
                  <svg v-else-if="c.kind === 'pro'" viewBox="0 0 20 20" fill="#fcd34d"><path d="M9.05 2.93c.3-.92 1.6-.92 1.9 0l1.07 3.29a1 1 0 00.95.69h3.46c.97 0 1.37 1.24.59 1.81l-2.8 2.03a1 1 0 00-.36 1.12l1.07 3.3c.3.92-.76 1.68-1.54 1.11l-2.8-2.03a1 1 0 00-1.18 0l-2.8 2.03c-.78.57-1.84-.2-1.54-1.11l1.07-3.3a1 1 0 00-.36-1.12L2.98 8.72c-.78-.57-.38-1.81.59-1.81h3.46a1 1 0 00.95-.69z" /></svg>
                  <svg v-else-if="c.kind === 'flag'" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></svg>
                  <svg v-else viewBox="-50 -50 100 100" aria-hidden="true"><defs><clipPath id="fulvo-ball-clip"><circle r="47"/></clipPath><radialGradient id="fulvo-ball-sh" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#fff"/><stop offset=".7" stop-color="#e2e8f0"/><stop offset="1" stop-color="#94a3b8"/></radialGradient></defs><circle r="47" fill="url(#fulvo-ball-sh)"/><g clip-path="url(#fulvo-ball-clip)"><g fill="#111827"><polygon points="0.0,-16.0 15.2,-4.9 9.4,12.9 -9.4,12.9 -15.2,-4.9"/><polygon points="0.0,-29.0 -16.2,-40.7 -10.0,-59.8 10.0,-59.8 16.2,-40.7"/><polygon points="27.6,-9.0 33.8,-28.0 53.7,-28.0 59.9,-9.0 43.7,2.8"/><polygon points="17.0,23.5 37.0,23.5 43.2,42.5 27.0,54.2 10.9,42.5"/><polygon points="-17.0,23.5 -10.9,42.5 -27.0,54.2 -43.2,42.5 -37.0,23.5"/><polygon points="-27.6,-9.0 -43.7,2.8 -59.9,-9.0 -53.7,-28.0 -33.8,-28.0"/></g><path d="M0.0 -16.0L0.0 -29.0M15.2 -4.9L27.6 -9.0M9.4 12.9L17.0 23.5M-9.4 12.9L-17.0 23.5M-15.2 -4.9L-27.6 -9.0M-16.2 -40.7L23.5 -32.4M16.2 -40.7L-23.5 -32.4M33.8 -28.0L38.0 12.4M43.7 2.8L23.5 -32.4M37.0 23.5L0.0 40.0M10.9 42.5L38.0 12.4M-10.9 42.5L-38.0 12.4M-37.0 23.5L0.0 40.0M-43.7 2.8L-23.5 -32.4M-33.8 -28.0L-38.0 12.4" stroke="#111827" stroke-width="2.6" fill="none" stroke-linecap="round"/></g><circle r="47" fill="none" stroke="#111827" stroke-width="2.5"/></svg>
                  {{ c.label }} <b>+{{ c.xp }}</b>
                </span>
              </div>
            </div>

            <!-- 4 · barra de nivel + próximo premio -->
            <template v-if="!guest && levelShown != null">
              <div class="lvl" :class="{ in: phase >= 4 }">
                <span class="nv" :class="{ pop: levelPop }">NV {{ levelShown }}</span>
                <div ref="barEl" class="bar">
                  <i class="cur" :style="{ width: xpBarWidth + '%' }"></i>
                  <span v-if="levelPop" class="up">¡Nivel {{ levelShown }}!</span>
                  <span v-if="barCombo > 1" :key="'bc' + barCombo" class="combo">×{{ barCombo }}</span>
                </div>
                <span class="nv nx">NV {{ (levelShown || 0) + 1 }}</span>
              </div>
              <div v-if="nextPrize && xpToNextAfter != null" class="next" :class="{ in: phase >= 4 }">
                <PrizeCard :prize="nextPrize.prize" :size="46" />
                <span>
                  <template v-if="nextPrize.level === (levelAfter || levelBefore) + 1">Te faltan <b>{{ xpToNextAfter }} XP</b> para <b>{{ nextPrize.prize.name }}</b><template v-if="perCorrect"> · ≈ {{ Math.ceil(xpToNextAfter / perCorrect) }} aciertos</template></template>
                  <template v-else>En el nivel <b>{{ nextPrize.level }}</b> te espera <b>{{ nextPrize.prize.name }}</b></template>
                </span>
              </div>
            </template>

            <!-- 5 · racha del juego -->
            <div v-if="showStreak" class="rk" :class="{ in: rkPhase >= 1, cut: !won && rkPhase >= 2 }">
              <span ref="flamesEl" class="fl" :class="{ out: !won && rkPhase >= 2 }">
                <svg v-for="i in flamesShown" :key="i" viewBox="0 0 24 24" :style="{ '--i': i }"><path :d="FLAME_PATH" fill="currentColor" /></svg>
                <svg v-if="won" ref="flameNewEl" viewBox="0 0 24 24" class="new" :class="{ lit: rkPhase >= 2 }"><path :d="FLAME_PATH" fill="currentColor" /></svg>
              </span>
              <span class="cnt">
                <span v-if="!(won && rkPhase >= 3)" class="old">×{{ streakBefore }}<svg viewBox="0 0 60 14" preserveAspectRatio="none" aria-hidden="true"><path d="M2 10 L58 4" /></svg></span>
                <span class="nw" :class="{ in: rkPhase >= 3 }">{{ won ? '×' + streakAfter : '0' }}</span>
              </span>
              <span class="lab"><b>{{ won ? 'Racha encendida' : 'Racha cortada' }}</b>{{ won ? 'ganaste otro día seguido' : 'mañana arrancás de nuevo' }}</span>
            </div>

            <!-- Invitado: lo que se lleva al registrarse -->
            <div v-if="guest" class="guest" :class="{ in: phase >= 3 }">
              <p class="note">Estás jugando <b>como invitado</b>: esta XP todavía no está guardada.</p>
              <div class="gxp">
                <div><small>XP a reclamar</small><b class="x">+{{ guestPreview.xp }}</b></div>
                <div><small>Fichas a reclamar</small><b class="f">+{{ guestPreview.fichas }}</b></div>
              </div>
              <p v-if="guestShowsAccumulated" class="note c">Ya llevás <b>{{ guestSummary.count }} juegos</b> probados: <b>{{ guestSummary.xp }} XP</b> y <b>{{ guestSummary.fichas }} Fichas</b> acumuladas.</p>
              <p v-if="guestTotalXp >= guestPreview.xpForLevel2" class="note y">⚡ Esa XP alcanza para pasar a Nivel 2 apenas te registrés.</p>
              <p v-if="guestPreview.perfect" class="note y">🏆 Un resultado perfecto como este desbloquea logros al crear tu cuenta.</p>
            </div>

            <!-- 6 · acciones -->
            <div class="cta" :class="{ in: phase >= 6 }">
              <button type="button" class="ghost" @click="onShare">{{ shared ? '¡Copiado!' : 'Compartir' }}</button>
              <router-link v-if="!guest" :to="backPath" class="main" @click="onContinue">Continuar</router-link>
              <button v-else-if="!claimGate" type="button" class="main claim" @click="claimGate = true">Reclamar mis recompensas</button>
            </div>
            <div v-if="guest && claimGate" class="gate">
              <h3>Tus recompensas te esperan</h3>
              <p>Creá tu cuenta gratis y guardá <b>+{{ guestTotalXp }} XP</b><span v-if="guestShowsAccumulated"> de {{ guestSummary.count }} juegos</span> para siempre.</p>
              <router-link to="/register" class="main">Crear cuenta gratis y reclamar</router-link>
              <router-link to="/login" class="link">Ya tengo cuenta</router-link>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.sm-wrap { position: fixed; inset: 0; z-index: 55; overflow-y: auto; display: grid; place-items: center; padding: 16px; background: rgba(3, 5, 14, .88); }
.sm { position: relative; width: min(100%, 460px); border-radius: 18px; overflow: hidden; background: #0b1024; border: 1px solid rgba(255, 255, 255, .12); box-shadow: 0 30px 80px rgba(0, 0, 0, .6); animation: sm-pop .45s cubic-bezier(.34, 1.3, .64, 1) both; }
@keyframes sm-pop { from { opacity: 0; transform: scale(.92) translateY(14px); } to { opacity: 1; transform: none; } }
.sm-top { position: relative; padding: 28px 16px 12px; display: grid; gap: 8px; justify-items: center; text-align: center; }
.sm-top::before { content: ""; position: absolute; inset: 0; background: radial-gradient(70% 100% at 50% 0%, rgba(252, 211, 77, .22), transparent 70%); pointer-events: none; }
.is-loss .sm-top::before { background: radial-gradient(70% 100% at 50% 0%, rgba(239, 68, 68, .16), transparent 70%); }
.sm-top > * { position: relative; }
.big { margin: 0; font-family: var(--font-shout); font-weight: 400; text-transform: uppercase; font-size: clamp(50px, 14vw, 76px); line-height: .9; opacity: 0; }
.big.in { animation: sm-slam .55s cubic-bezier(.16, 1, .3, 1) forwards; }
@keyframes sm-slam { 0% { opacity: 0; transform: scale(3); filter: blur(10px); } 100% { opacity: 1; transform: none; filter: none; } }
.is-win .big { color: #fff; text-shadow: 0 0 34px rgba(252, 211, 77, .5); }
.is-loss .big { color: #fecaca; }
.sub { margin: 0; font-size: 13px; color: #8b93b8; opacity: 0; transition: opacity .4s .3s; }
.sub.in { opacity: 1; }
.stars { display: flex; gap: 8px; align-items: flex-end; margin-top: 6px; }
.stars svg { width: 44px; height: auto; opacity: 0; transform: scale(2.4) rotate(-20deg); }
.stars svg:nth-child(2) { width: 58px; }
.stars svg.in { animation: sm-star .45s cubic-bezier(.34, 1.56, .64, 1) forwards; }
.stars svg.off { animation: sm-staroff .35s ease forwards; }
@keyframes sm-star { to { opacity: 1; transform: none; } }
@keyframes sm-staroff { to { opacity: .2; transform: none; filter: grayscale(1); } }
.short { display: flex; gap: 3px; justify-content: center; opacity: 0; transition: opacity .3s; margin-top: 4px; }
.short.in { opacity: 1; }
.short i { width: 16px; height: 16px; border-radius: 50%; display: block; background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='-50 -50 100 100' aria-hidden='true'%3E%3Cdefs%3E%3CclipPath id='fulvo-ball-clip'%3E%3Ccircle r='47'/%3E%3C/clipPath%3E%3CradialGradient id='fulvo-ball-sh' cx='35%25' cy='30%25' r='75%25'%3E%3Cstop offset='0' stop-color='#fff'/%3E%3Cstop offset='.7' stop-color='#e2e8f0'/%3E%3Cstop offset='1' stop-color='#94a3b8'/%3E%3C/radialGradient%3E%3C/defs%3E%3Ccircle r='47' fill='url(#fulvo-ball-sh)'/%3E%3Cg clip-path='url(#fulvo-ball-clip)'%3E%3Cg fill='#111827'%3E%3Cpolygon points='0.0,-16.0 15.2,-4.9 9.4,12.9 -9.4,12.9 -15.2,-4.9'/%3E%3Cpolygon points='0.0,-29.0 -16.2,-40.7 -10.0,-59.8 10.0,-59.8 16.2,-40.7'/%3E%3Cpolygon points='27.6,-9.0 33.8,-28.0 53.7,-28.0 59.9,-9.0 43.7,2.8'/%3E%3Cpolygon points='17.0,23.5 37.0,23.5 43.2,42.5 27.0,54.2 10.9,42.5'/%3E%3Cpolygon points='-17.0,23.5 -10.9,42.5 -27.0,54.2 -43.2,42.5 -37.0,23.5'/%3E%3Cpolygon points='-27.6,-9.0 -43.7,2.8 -59.9,-9.0 -53.7,-28.0 -33.8,-28.0'/%3E%3C/g%3E%3Cpath d='M0.0 -16.0L0.0 -29.0M15.2 -4.9L27.6 -9.0M9.4 12.9L17.0 23.5M-9.4 12.9L-17.0 23.5M-15.2 -4.9L-27.6 -9.0M-16.2 -40.7L23.5 -32.4M16.2 -40.7L-23.5 -32.4M33.8 -28.0L38.0 12.4M43.7 2.8L23.5 -32.4M37.0 23.5L0.0 40.0M10.9 42.5L38.0 12.4M-10.9 42.5L-38.0 12.4M-37.0 23.5L0.0 40.0M-43.7 2.8L-23.5 -32.4M-33.8 -28.0L-38.0 12.4' stroke='#111827' stroke-width='2.6' fill='none' stroke-linecap='round'/%3E%3C/g%3E%3Ccircle r='47' fill='none' stroke='#111827' stroke-width='2.5'/%3E%3C/svg%3E") center / 100% no-repeat; }
.short i.no { background: none; border: 1.5px dashed #f87171; }
.prec { margin: 0; min-height: 18px; font-size: 12.5px; color: #8b93b8; opacity: 0; transition: opacity .4s; }
.prec.in { opacity: 1; }
.prec b { color: #dfe4ff; }
.sm-body { padding: 4px 16px 16px; display: grid; gap: 14px; }
.gain { display: grid; justify-items: center; gap: 6px; opacity: 0; transition: opacity .3s; }
.gain.in { opacity: 1; }
.gain .xp { font-family: var(--font-bug); font-weight: 800; font-size: clamp(48px, 13vw, 64px); line-height: .95; color: #fcd34d; font-variant-numeric: tabular-nums; text-shadow: 0 0 26px rgba(252, 211, 77, .35); }
.gain .xp small { font-size: .42em; margin-left: 4px; color: #fde68a; }
.chips { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; }
.chip { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px 4px 5px; border-radius: 999px; background: rgba(255, 255, 255, .05); font-size: 12.5px; color: #c5cbe8; opacity: 0; transform: translateY(6px); transition: opacity .25s, transform .35s cubic-bezier(.16, 1, .3, 1); }
.gain.in .chip { opacity: 1; transform: none; }
.chip svg { width: 16px; height: 16px; }
.chip b { color: #fcd34d; font-weight: 700; }
.lvl { display: grid; grid-template-columns: auto 1fr auto; gap: 10px; align-items: center; opacity: 0; transition: opacity .3s; }
.lvl.in { opacity: 1; }
.lvl .nv { font-family: var(--font-bug); font-weight: 800; font-size: 15px; color: #c5cbe8; }
.lvl .nv.nx { color: #fcd34d; }
.lvl .nv.pop { color: #fde68a; animation: sm-nvpop .5s cubic-bezier(.34, 1.56, .64, 1); }
@keyframes sm-nvpop { 0% { transform: scale(1.8); } 100% { transform: none; } }
.lvl .bar { position: relative; height: 10px; border-radius: 8px; background: rgba(255, 255, 255, .08); }
.lvl .bar .cur { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 8px; background: linear-gradient(90deg, #f59e0b, #fcd34d); }
.lvl .bar .up { position: absolute; left: 50%; top: -8px; transform: translate(-50%, -100%); font-family: var(--font-bug); font-weight: 800; text-transform: uppercase; letter-spacing: .06em; font-size: 16px; color: #fcd34d; white-space: nowrap; text-shadow: 0 0 14px rgba(252, 211, 77, .8); animation: sm-up 2s ease forwards; }
@keyframes sm-up { 0% { opacity: 0; transform: translate(-50%, -60%) scale(.5); } 20% { opacity: 1; transform: translate(-50%, -100%) scale(1.12); } 80% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%, -130%); } }
.next { display: flex; align-items: center; gap: 10px; justify-content: center; font-size: 13px; color: #c5cbe8; opacity: 0; transition: opacity .4s .5s; }
.next.in { opacity: 1; }
.next b { color: #fcd34d; }
/* racha del juego */
.rk { display: flex; align-items: center; justify-content: center; gap: 14px; flex-wrap: wrap; padding: 12px; border-radius: 14px; background: #10163a; opacity: 0; transition: opacity .3s; }
.rk.in { opacity: 1; }
.rk .fl { display: flex; gap: 2px; align-items: flex-end; }
.rk .fl svg { width: 24px; height: 24px; color: #fbbf24; filter: drop-shadow(0 0 6px rgba(251, 191, 36, .5)); }
.rk .fl svg.new { transform: scale(0); }
.rk .fl svg.new.lit { animation: sm-ignite .7s cubic-bezier(.34, 1.56, .64, 1) forwards; }
@keyframes sm-ignite { 0% { transform: scale(0) translateY(6px); color: #fff; } 50% { transform: scale(1.5); color: #fff7ed; } 100% { transform: scale(1.2); color: #fcd34d; filter: drop-shadow(0 0 12px #fbbf24); } }
.rk .fl.out svg { animation: sm-flick .9s ease forwards; animation-delay: calc(var(--i) * .08s); }
@keyframes sm-flick { 0% { color: #fbbf24; } 20% { color: #fde68a; transform: scale(1.1); } 40% { color: #f97316; transform: scale(.9); } 60% { color: #fbbf24; transform: scale(1); } 100% { color: #334155; filter: none; transform: scale(.85) translateY(2px); } }
.rk .cnt { font-family: var(--font-bug); font-weight: 800; font-size: 30px; line-height: 1; color: #fff; font-variant-numeric: tabular-nums; display: flex; align-items: center; gap: 8px; }
.rk .cnt .old { position: relative; }
.rk .cnt .old svg { position: absolute; left: -10%; top: 40%; width: 120%; height: 14px; overflow: visible; }
.rk .cnt .old svg path { stroke: #ef4444; stroke-width: 4; fill: none; stroke-linecap: round; stroke-dasharray: 60; stroke-dashoffset: 60; }
.rk.cut .cnt .old { color: #64748b; transition: color .4s .3s; }
.rk.cut .cnt .old svg path { animation: sm-dash .45s ease forwards; }
@keyframes sm-dash { to { stroke-dashoffset: 0; } }
.rk .cnt .nw { color: #fcd34d; opacity: 0; transform: translateY(10px); transition: opacity .4s, transform .4s cubic-bezier(.34, 1.56, .64, 1); }
.rk .cnt .nw.in { opacity: 1; transform: none; }
.rk.cut .cnt .nw { color: #fca5a5; }
.rk .lab { font-size: 12px; color: #8b93b8; text-align: left; line-height: 1.3; }
.rk .lab b { display: block; font-family: var(--font-bug); font-weight: 800; text-transform: uppercase; letter-spacing: .06em; font-size: 14px; color: #fff; }
.rk.cut .lab b { color: #fca5a5; }
/* invitado */
.guest { display: grid; gap: 8px; opacity: 0; transition: opacity .4s; }
.guest.in { opacity: 1; }
.guest .note { margin: 0; text-align: center; font-size: 12.5px; color: #c5cbe8; padding: 10px; border-radius: 12px; background: rgba(252, 211, 77, .06); border: 1px solid rgba(252, 211, 77, .2); }
.guest .note b { color: #fcd34d; }
.guest .note.c { background: rgba(34, 211, 238, .06); border-color: rgba(34, 211, 238, .25); color: #a5f3fc; }
.guest .note.y { color: #fde68a; }
.guest .gxp { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.guest .gxp > div { display: grid; justify-items: center; padding: 10px; border-radius: 12px; background: rgba(255, 255, 255, .04); }
.guest .gxp small { font-size: 10px; text-transform: uppercase; letter-spacing: .1em; color: #8b93b8; }
.guest .gxp b { font-family: var(--font-bug); font-weight: 800; font-size: 26px; }
.guest .gxp .x { color: #4ade80; } .guest .gxp .f { color: #fcd34d; }
/* acciones */
.cta { display: flex; gap: 8px; opacity: 0; transform: translateY(8px); transition: opacity .35s, transform .35s; }
.cta.in { opacity: 1; transform: none; }
.cta .ghost, .cta .main { flex: 1; display: grid; place-items: center; border-radius: 12px; padding: 12px; font-family: var(--font-bug); font-weight: 800; text-transform: uppercase; letter-spacing: .08em; font-size: 16px; cursor: pointer; text-decoration: none; }
.cta .ghost { background: #141a38; color: #eef1ff; border: 1px solid rgba(255, 255, 255, .1); }
.cta .main { border: 0; color: #141005; background: linear-gradient(180deg, #fde68a, #f59e0b); box-shadow: 0 8px 22px rgba(245, 158, 11, .3); }
.cta .main.claim { animation: sm-claim 1.8s ease-in-out infinite; }
@keyframes sm-claim { 0%, 100% { box-shadow: 0 8px 24px rgba(245, 158, 11, .3); } 50% { box-shadow: 0 8px 34px rgba(245, 158, 11, .55); } }
.gate { display: grid; gap: 8px; text-align: center; padding: 14px; border-radius: 14px; border: 1px solid rgba(252, 211, 77, .3); background: rgba(252, 211, 77, .06); animation: sm-gate .35s cubic-bezier(.16, 1, .3, 1) both; }
@keyframes sm-gate { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
.gate h3 { margin: 0; font-family: var(--font-bug); font-weight: 800; text-transform: uppercase; font-size: 18px; color: #fff; }
.gate p { margin: 0; font-size: 12.5px; color: #c5cbe8; }
.gate p b { color: #4ade80; }
.gate .main { display: block; border-radius: 10px; padding: 11px; font-weight: 800; color: #141005; background: linear-gradient(180deg, #fde68a, #f59e0b); text-decoration: none; }
.gate .link { font-size: 12px; color: #8b93b8; text-decoration: none; }
.sm-fade-enter-active { transition: opacity .3s ease; }
.sm-fade-leave-active { transition: opacity .2s ease; }
.sm-fade-enter-from, .sm-fade-leave-to { opacity: 0; }
@media (prefers-reduced-motion: reduce) {
  .sm, .big.in, .stars svg, .rk .fl svg, .lvl .bar .up, .cta .main.claim { animation-duration: .01ms !important; animation-iteration-count: 1 !important; }
}
.lvl .bar .combo { position: absolute; right: -6px; top: -26px; font-family: var(--font-shout); font-size: 24px; line-height: 1; color: #fde68a; text-shadow: 0 2px 0 #b45309, 0 0 12px rgba(252, 211, 77, .7); transform: rotate(-8deg); animation: sm-combo .4s cubic-bezier(.34, 1.56, .64, 1) both; pointer-events: none; }
@keyframes sm-combo { from { transform: rotate(-8deg) scale(2.2); opacity: 0; } to { transform: rotate(-8deg); opacity: 1; } }
</style>
