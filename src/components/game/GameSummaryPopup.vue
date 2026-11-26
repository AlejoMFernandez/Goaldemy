<script>
/**
 * EL RESUMEN DE PARTIDA (diseño V4 aprobado: V4Resumen)
 *
 * Pantalla completa, en orden de transmisión:
 *  1. Juego · dificultad arriba; estrellas por PRECISIÓN (3 = sin errores,
 *     2 = hasta 2, 1 = más) y ¡GANASTE! / PERDISTE con el marcador.
 *  2. Desglose del XP en filas (aciertos, ¡Basta!, PRO…) + la racha del juego
 *     (se enciende o se corta) y el TOTAL.
 *  3. Barra de nivel (lo ganado en dorado) + el próximo premio real.
 *  4. SIGUIENTE JUEGO (el próximo de la jornada, con cuántos te quedan),
 *     Compartir y Volver.
 * Los logros medios y difíciles NO se listan acá: aparecen con su escena al
 * cerrar (cola: resumen → logros → ¡PUM! → cosméticos). Los fáciles ya
 * salieron como cartel durante el partido.
 */
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { soundManager } from '@/services/sounds'
import { setSuppressOverlays, whenOverlaysIdle } from '@/stores/notifications'
import { useRouter } from 'vue-router'
import { friendlyNameForSlug } from '@/services/games'
import { buildShareText, shareOrCopy } from '@/services/share'
import { getAuthUser } from '@/services/auth'
import { computeGuestRewards, getPendingGuestSummary } from '@/services/guest-play'
import { fetchDailyWinStreak, findNextDailyGame } from '@/services/game-modes'
import { nextRealPrize, PRIZE_TYPE_LABEL } from '@/services/prize-card'
import { GAME_ART, GAME_POSTER_META } from '@/services/game-art'
import { tap, success } from '@/services/haptics'
import { sparks, center, smoke, reducedMotion } from '@/services/game-fx'
import PrizePeek from '@/components/rewards/PrizePeek.vue'

const CONFETTI_COLORS = ['#fbbf24', '#34d399', '#22d3ee', '#818cf8', '#f472b6', '#ffffff']
const CONFETTI = Array.from({ length: 14 }, (_, i) => ({
  x: ((i * 29 + 11) % 370) / 3.9 + '%', y: ((i * 17) % 90) + 'px',
  w: (i % 3 === 0 ? 10 : 6) + 'px', h: (i % 2 === 0 ? 4 : 9) + 'px',
  c: CONFETTI_COLORS[i % CONFETTI_COLORS.length], d: (i * 0.09).toFixed(2) + 's',
}))
const FLAME_PATH = 'M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67z'

export default {
  name: 'GameSummaryPopup',
  components: { PrizePeek },
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
    // El delta del total también trae la XP de los logros de la partida: no es todo "PRO".
    // El bonus solo existe con plan pago (multiplicador > 1) y nunca pasa de base × (mult − 1).
    // (Antes una cuenta GRATIS veía "Bonus PRO +40" en Ordenar por edad: era la XP de un logro.)
    const xpMult = ref(1)
    import('@/services/premium').then(m => m.getXpMultiplier()).then(v => { xpMult.value = Number(v) || 1 }).catch(() => {})
    const xpGained = computed(() => Math.max(0, (props.xpAfterTotal - props.xpBeforeTotal) || 0))
    const baseXp = computed(() => Math.max(0, props.xpEarned || 0))
    const bonusXp = computed(() => {
      if (xpMult.value <= 1 || !(xpGained.value > 0 && baseXp.value > 0)) return 0
      return Math.min(Math.max(0, xpGained.value - baseXp.value), Math.round(baseXp.value * (xpMult.value - 1)))
    })
    const totalXp = computed(() => baseXp.value > 0 ? baseXp.value + bonusXp.value : xpGained.value)
    const chips = computed(() => {
      const rows = (props.xpBreakdown || []).filter(r => r && r.xp > 0)
      const list = rows.length ? [...rows] : (baseXp.value > 0 ? [{ kind: 'ball', label: `${props.corrects} ${props.corrects === 1 ? 'acierto' : 'aciertos'}`, xp: baseXp.value }] : [])
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
    const nextPrizeTypeLabel = computed(() => (PRIZE_TYPE_LABEL[nextPrize.value?.prize?.kind] || '').toLowerCase())
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
      // Ganaste: la racha nueva nunca puede ser menor a la de antes + 1 (por si el server todavía no la actualizó)
      else if (before != null) after = Math.max(Number(after) || 0, before + 1)
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

      T(() => { phase.value = 1; soundManager.playBig(won.value ? 'whistle' : 'lose'); if (won.value) soundManager.play('stamp') }, 150)
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
            if (flameNewEl.value) { smoke(flameNewEl.value); setTimeout(() => flameNewEl.value && smoke(flameNewEl.value), 350) }
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

    // ── Siguiente juego del día: el CTA principal del relanzamiento ──
    // El próximo de la jornada (mismo orden que JUGAR RÁPIDO) + cuántos te quedan.
    // Sin ninguno → índice de juegos. Si falla, el buscador de siempre.
    const nextHref = ref('/play/points')
    const nextIsGame = ref(false)
    const nextName = ref('')
    const nextLeft = ref(null)
    async function resolveNext() {
      if (props.guest) return
      try {
        const { getNextQuickPlay } = await import('@/services/quick-play')
        const r = await getNextQuickPlay({ level: props.levelAfter || props.levelBefore || 1 })
        const n = r?.next && r.next.slug !== slug.value ? r.next : null
        nextHref.value = n ? n.to : '/play/points'
        nextIsGame.value = !!n
        nextName.value = n?.name || ''
        nextLeft.value = r ? Math.max(0, r.total - r.played) : null
      } catch {
        const href = await findNextDailyGame(slug.value)
        nextHref.value = href || '/play/points'
        nextIsGame.value = !!href
      }
    }
    watch(() => props.show, (val) => { if (val) resolveNext() })
    onMounted(() => { if (props.show) resolveNext() })

    // ── Datos de la cabecera y la barra (V4) ──
    const meta = computed(() => GAME_POSTER_META[slug.value] || { c1: '#475569', c2: '#0f172a' })
    const miniArt = computed(() => (GAME_ART[slug.value] || '').replace(/id="(cp[a-z])"/g, 'id="sm$1"').replace(/url\(#(cp[a-z])\)/g, 'url(#sm$1)'))
    const headLine = computed(() => [displayName.value, difficultyLabel.value].filter(Boolean).join(' · ').toUpperCase())
    const fmt = (n) => Number(n || 0).toLocaleString('es-AR')
    // XP relativo (lo que falta), no el acumulado de toda la vida: igual que el perfil y la TopBar
    const xpLabel = computed(() => (props.xpToNextAfter != null && props.xpToNextAfter > 0) ? `faltan ${fmt(props.xpToNextAfter)} XP` : '')
    // Parte "vieja" de la barra (verde→violeta) y lo ganado hoy (dorado, animado)
    const basePct = computed(() => didLevelUp.value ? 0 : Math.min(props.beforePercent || 0, xpBarWidth.value))
    const levelNow = computed(() => props.levelAfter || props.levelBefore || 0)
    const nextPrizeSoon = computed(() => !!(nextPrize.value && nextPrize.value.level === levelNow.value + 1))
    const DOT = { ball: '#34d399', clock: '#22d3ee', flag: '#4ade80', pro: '#fbbf24' }
    const rows = computed(() => chips.value.map((c, i) => ({ ...c, dot: DOT[c.kind] || '#818cf8', delay: (0.1 + i * 0.1) + 's' })))
    // Cola (moodboard 03/07): resumen → logros → nivel/ascenso → sobres y RECIÉN después se
    // navega. Antes SIGUIENTE JUEGO navegaba al toque y las escenas salían encima de la
    // previa del juego nuevo. Mientras se muestran, el resumen queda abajo.
    const router = useRouter()
    const leaving = ref(false)
    async function leaveTo(to) {
      if (leaving.value) return
      tap()
      leaving.value = true
      setSuppressOverlays(false)
      try { await whenOverlaysIdle() } catch { /* seguimos igual */ }
      leaving.value = false
      emit('close')
      if (to) router.push(to).catch(() => {})
    }
    function goNext() { leaveTo(nextHref.value) }
    function goBack() { leaveTo(props.guest ? '/' : props.backPath) }
    watch(phase, (p) => { if (p === 1 && won.value) success() })

    return { barCombo, barEl,
      phase, won, animatedXp, starsRevealed, starCount, accuracy, precisionLine, missing, ballsTotal, xpBarWidth,
      levelShown, levelPop, claimGate, guestPreview, guestSummary, guestTotalXp, guestShowsAccumulated,
      subLine, totalXp, chips, didLevelUp, nextPrize, nextPrizeTypeLabel, perCorrect,
      streakBefore, streakAfter, rkPhase, showStreak, flamesShown, FLAME_PATH,
      shared, onShare, onContinue, nextHref, nextIsGame, cardEl, starEls, flameNewEl, flamesEl,
      nextName, nextLeft, meta, miniArt, headLine, xpLabel, basePct, levelNow, nextPrizeSoon, rows, goNext, goBack, leaving, fmt, CONFETTI,
    }
  },
}
</script>


<template>
  <Teleport to="body">
    <Transition name="sm-fade">
      <div v-if="show" class="sm-wrap">
        <div ref="cardEl" class="sm" :class="won ? 'is-win' : 'is-loss'" role="dialog" aria-modal="true" :aria-label="won ? `Resumen: ganaste ${headLine}` : `Resumen: perdiste ${headLine}`">
          <!-- Papelitos (solo al ganar) -->
          <div v-if="won" class="sm-conf" aria-hidden="true">
            <i v-for="(c, i) in CONFETTI" :key="i" :style="{ left: c.x, top: c.y, width: c.w, height: c.h, background: c.c, animationDelay: c.d }"></i>
          </div>

          <div class="sm-top">
            <span class="sm-pill">
              <span v-if="miniArt" class="mi" :style="{ background: `linear-gradient(160deg, ${meta.c1}, ${meta.c2})` }" aria-hidden="true" v-html="miniArt"></span>
              {{ headLine }}
            </span>
          </div>

          <div class="sm-body">
            <!-- 1 · resultado -->
            <section class="res" :aria-label="won ? `Ganaste con ${starCount} de 3 estrellas` : 'Perdiste'">
              <div v-if="won" class="stars" aria-hidden="true">
                <svg v-for="i in 3" :key="i" :ref="el => { starEls[i - 1] = el }" viewBox="0 0 24 24"
                     :class="{ mid: i === 2, in: starsRevealed >= i && i <= starCount, off: starsRevealed >= i && i > starCount }">
                  <path d="M12 2.2l2.95 6.1 6.7.9-4.9 4.65 1.2 6.65L12 17.3l-5.95 3.2 1.2-6.65L2.35 9.2l6.7-.9z" stroke-width="1.4" stroke-linejoin="round" />
                </svg>
              </div>
              <div v-else class="short" :class="{ in: phase >= 2 }" aria-hidden="true">
                <i v-for="i in ballsTotal" :key="i" :class="{ no: i > corrects }"></i>
              </div>
              <h2 class="big" :class="{ in: phase >= 1 }">{{ won ? '¡GANASTE!' : 'PERDISTE' }}</h2>
              <div class="score" :class="{ in: phase >= 2 }">
                <span class="n">{{ Math.min(corrects, winThreshold) }}<span>/{{ winThreshold }}</span></span>
                <span class="sep"></span>
                <span class="tx">
                  <span>aciertos<template v-if="won && errors != null"> · precisión <strong>{{ accuracy }} %</strong></template></span>
                  <span v-if="won && precisionLine">{{ precisionLine }}</span>
                  <span v-else-if="!won && missing > 0">te faltaron <strong>{{ missing }}</strong></span>
                  <span v-else-if="won && starCount === 3">¡partido perfecto!</span>
                </span>
              </div>
            </section>

            <!-- 2 · XP ganada -->
            <section v-if="!guest" class="tbl" :class="{ in: phase >= 3 }" aria-label="XP ganada">
              <div v-for="(r, i) in rows" :key="i" class="row" :style="{ animationDelay: r.delay }">
                <span class="dot" :style="{ background: r.dot }"></span>
                <span class="lb">{{ r.label }}</span>
                <span class="v">+{{ fmt(r.xp) }}</span>
              </div>
              <div v-if="showStreak" class="row rk" :class="{ cut: !won && rkPhase >= 2 }">
                <span class="dot" style="background:#fb923c"></span>
                <span class="lb">{{ won ? 'Racha del juego' : 'Racha cortada' }}</span>
                <span class="v fl">
                  <svg viewBox="0 0 24 24" aria-hidden="true" :class="{ lit: won && rkPhase >= 2, out: !won && rkPhase >= 2 }" ref="flameNewEl"><path :d="FLAME_PATH" fill="currentColor" /></svg>
                  <span v-if="!(rkPhase >= 3)" class="old">×{{ streakBefore }}</span>
                  <span v-else class="nw">×{{ won ? streakAfter : 0 }}</span>
                </span>
              </div>
              <div class="tot">
                <span class="k">TOTAL</span>
                <span class="x">+{{ fmt(animatedXp) }} XP</span>
              </div>
            </section>

            <!-- 3 · nivel + próximo premio -->
            <section v-if="!guest && levelShown != null" class="lvl" :class="{ in: phase >= 4 }" :aria-label="xpLabel ? `Tu nivel: ${xpLabel}` : 'Tu nivel'">
              <div class="lr">
                <span class="nv" :class="{ pop: levelPop }">NV {{ levelShown }}</span>
                <span ref="barEl" class="bar">
                  <i class="gold" :style="{ width: xpBarWidth + '%' }"></i>
                  <i class="base" :style="{ width: basePct + '%' }"></i>
                  <span v-if="xpLabel" class="lbl">{{ xpLabel }}</span>
                  <span v-if="levelPop" class="up">¡Nivel {{ levelShown }}!</span>
                  <span v-if="barCombo > 1" :key="'bc' + barCombo" class="combo">×{{ barCombo }}</span>
                </span>
                <span class="nx">{{ (levelShown || 0) + 1 }}</span>
              </div>
              <div v-if="nextPrize" class="prz">
                <PrizePeek class="prz-card" :prize="nextPrize.prize" :size="56" />
                <span class="pt">
                  <span class="k">PRÓXIMO PREMIO · NV {{ nextPrize.level }}</span>
                  <span class="n">{{ nextPrizeTypeLabel ? nextPrizeTypeLabel.charAt(0).toUpperCase() + nextPrizeTypeLabel.slice(1) + ' ' : '' }}{{ nextPrize.prize.name }}</span>
                </span>
                <!-- Lo que falta en XP ya está escrito en la barra: acá solo cuántos niveles -->
                <span v-if="nextPrizeSoon" class="lf">en el próximo<br>nivel</span>
                <span v-else class="lf">en {{ nextPrize.level - levelNow }}<br>{{ nextPrize.level - levelNow === 1 ? 'nivel' : 'niveles' }}</span>
              </div>
            </section>

            <!-- Invitado: lo que se lleva al registrarse -->
            <section v-if="guest" class="guest" :class="{ in: phase >= 3 }">
              <p class="note">Estás jugando <b>como invitado</b>: esta XP todavía no está guardada.</p>
              <div class="gxp">
                <div><small>XP a reclamar</small><b class="x">+{{ guestPreview.xp }}</b></div>
                <div><small>Fichas a reclamar</small><b class="f">+{{ guestPreview.fichas }}</b></div>
              </div>
              <p v-if="guestShowsAccumulated" class="note c">Ya llevás <b>{{ guestSummary.count }} juegos</b> probados: <b>{{ guestSummary.xp }} XP</b> y <b>{{ guestSummary.fichas }} Fichas</b> acumuladas.</p>
              <p v-if="guestTotalXp >= guestPreview.xpForLevel2" class="note y">Esa XP alcanza para pasar a Nivel 2 apenas te registrés.</p>
              <p v-if="guestPreview.perfect" class="note y">Un resultado perfecto como este desbloquea logros al crear tu cuenta.</p>
              <div v-if="claimGate" class="gate">
                <h3>Tus recompensas te esperan</h3>
                <p>Creá tu cuenta gratis y guardá <b>+{{ guestTotalXp }} XP</b><span v-if="guestShowsAccumulated"> de {{ guestSummary.count }} juegos</span> para siempre.</p>
                <router-link to="/register" class="main">Crear cuenta gratis y reclamar</router-link>
                <router-link to="/login" class="link">Ya tengo cuenta</router-link>
              </div>
            </section>
          </div>

          <!-- 4 · acciones -->
          <div class="sm-go" :class="{ in: phase >= 6 }">
            <button v-if="!guest" type="button" class="next" :disabled="leaving" @click="goNext">
              <span class="t">
                <span class="a">{{ nextIsGame ? 'SIGUIENTE JUEGO' : 'VER JUEGOS DEL DÍA' }}</span>
                <span v-if="nextIsGame && nextName" class="b">{{ nextName }}<template v-if="nextLeft != null"> · te {{ nextLeft === 1 ? 'queda' : 'quedan' }} {{ nextLeft }}</template></span>
              </span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4l13 8-13 8z" /></svg>
            </button>
            <button v-else-if="!claimGate" type="button" class="next claim" @click="claimGate = true"><span class="t"><span class="a">RECLAMAR MIS PREMIOS</span></span></button>
            <div class="two">
              <button type="button" class="ghost" @click="onShare">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3M7 8l5-5 5 5M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6" /></svg>{{ shared ? '¡Copiado!' : 'Compartir' }}
              </button>
              <button type="button" class="ghost" :disabled="leaving" @click="goBack">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-7 9 7M5 10v10h14V10" /></svg>Volver
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.sm-wrap { position: fixed; inset: 0; z-index: 55; display: grid; place-items: center; background: rgba(3, 5, 14, .88); }
.sm { position: relative; width: min(100%, 430px); height: min(100dvh, 900px); display: flex; flex-direction: column; overflow: hidden; color: #f1f5f9; background: radial-gradient(90% 38% at 50% 8%, rgba(34, 197, 94, .32), transparent 70%), #0b1220; animation: sm-pop .4s cubic-bezier(.16, 1, .3, 1) both; }
.sm.is-loss { background: radial-gradient(90% 38% at 50% 8%, rgba(239, 68, 68, .22), transparent 70%), #0b1220; }
@media (min-width: 560px) { .sm { border-radius: 24px; border: 1px solid rgba(255, 255, 255, .1); box-shadow: 0 30px 80px rgba(0, 0, 0, .6); height: min(calc(100dvh - 32px), 860px); } }
@keyframes sm-pop { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }

.sm-conf { position: absolute; inset: 0 0 auto 0; height: 260px; pointer-events: none; overflow: hidden; }
.sm-conf i { position: absolute; display: block; border-radius: 2px; animation: sm-fall 2.6s ease-in both; }
@keyframes sm-fall { 0% { transform: translateY(-30px) rotate(0); } 100% { transform: translateY(240px) rotate(260deg); opacity: 0; } }

.sm-top { position: relative; flex: none; height: 52px; box-sizing: content-box; padding: env(safe-area-inset-top, 0px) 16px 0; display: flex; align-items: center; justify-content: center; }
.sm-pill { display: flex; align-items: center; gap: 6px; max-width: 100%; padding: 4px 10px; border-radius: 999px; background: rgba(255, 255, 255, .06); border: 1px solid rgba(255, 255, 255, .1); font-family: var(--font-bug); font-weight: 800; font-size: 13px; letter-spacing: 1px; color: #a7f3d0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.is-loss .sm-pill { color: #fecaca; }
.sm-pill .mi { width: 18px; height: 18px; flex: none; border-radius: 5px; overflow: hidden; display: grid; place-items: center; }
.sm-pill .mi :deep(svg) { width: 20px; height: auto; display: block; }

.sm-body { position: relative; flex: 1; min-height: 0; overflow-y: auto; padding: 14px 16px 12px; display: flex; flex-direction: column; gap: 20px; }
/* Pantallas altas: contenido + botones van juntos y centrados debajo de la píldora (antes
   quedaba un vacío enorme entre el próximo premio y los botones). Si no entra, el cuerpo
   scrollea y los botones quedan abajo, como siempre. */
.sm-body { flex: 0 1 auto; margin-top: auto; }
.sm-go { margin-bottom: auto; }

/* resultado */
.res { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.stars { display: flex; align-items: flex-end; gap: 6px; height: 64px; }
.stars svg { width: 48px; height: 48px; fill: #1e293b; stroke: #475569; opacity: 0; transform: scale(0) rotate(-30deg); }
.stars svg.mid { width: 62px; height: 62px; margin-bottom: 8px; }
.stars svg.in { fill: #fbbf24; stroke: #fff7d6; filter: drop-shadow(0 0 10px rgba(251, 191, 36, .6)); animation: sm-star .5s cubic-bezier(.2, .9, .3, 1.3) forwards; }
.stars svg.off { animation: sm-staroff .35s ease forwards; }
@keyframes sm-star { 0% { transform: scale(0) rotate(-30deg); opacity: 0; } 70% { transform: scale(1.18) rotate(6deg); opacity: 1; } 100% { transform: none; opacity: 1; } }
@keyframes sm-staroff { to { opacity: 1; transform: none; } }
.short { display: flex; gap: 3px; justify-content: center; height: 30px; align-items: center; opacity: 0; transition: opacity .3s; }
.short.in { opacity: 1; }
.short i { width: 16px; height: 16px; border-radius: 50%; display: block; background: radial-gradient(circle at 35% 30%, #fff, #e2e8f0 60%, #94a3b8); }
.short i.no { background: none; border: 1.5px dashed #f87171; }
.big { margin: 0; font-family: var(--font-shout); font-weight: 800; font-style: italic; font-size: 62px; line-height: .95; letter-spacing: 1px; opacity: 0;
  background: linear-gradient(180deg, #ffffff 0%, #bbf7d0 45%, #22c55e 100%); -webkit-background-clip: text; background-clip: text; color: transparent; filter: drop-shadow(0 3px 0 rgba(5, 46, 22, .9)); }
.is-loss .big { background: linear-gradient(180deg, #ffffff 0%, #fecaca 45%, #ef4444 100%); -webkit-background-clip: text; background-clip: text; filter: drop-shadow(0 3px 0 rgba(69, 10, 10, .9)); }
.big.in { animation: sm-title .45s cubic-bezier(.2, .9, .3, 1.2) forwards; }
@keyframes sm-title { 0% { transform: scale(1.4); opacity: 0; } 100% { transform: none; opacity: 1; } }
.score { display: flex; align-items: center; gap: 12px; margin-top: 2px; opacity: 0; transition: opacity .4s; }
.score.in { opacity: 1; }
.score .n { font-family: var(--font-bug); font-weight: 800; font-size: 30px; line-height: 1; font-variant-numeric: tabular-nums; }
.score .n span { color: #475569; }
.score .sep { width: 1px; height: 22px; background: rgba(255, 255, 255, .15); }
.score .tx { display: flex; flex-direction: column; font-size: 11.5px; color: #94a3b8; line-height: 1.3; }
.score strong { color: #e2e8f0; }

/* tabla de XP */
.tbl { border-radius: 18px; background: rgba(255, 255, 255, .04); border: 1px solid rgba(255, 255, 255, .08); overflow: hidden; opacity: 0; transition: opacity .3s; }
.tbl.in { opacity: 1; }
.row { min-height: 36px; padding: 0 14px; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid rgba(255, 255, 255, .06); }
.tbl.in .row { animation: sm-row .3s ease-out both; }
@keyframes sm-row { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: none; } }
.row .dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.row .lb { flex: 1; min-width: 0; font-size: 13.5px; font-weight: 600; color: #e2e8f0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.row .v { font-family: var(--font-bug); font-weight: 800; font-size: 18px; font-variant-numeric: tabular-nums; }
.row .fl { display: flex; align-items: center; gap: 4px; color: #fcd34d; }
.row .fl svg { width: 18px; height: 18px; color: #fb923c; transition: transform .4s, color .4s; }
.row .fl svg.lit { color: #fcd34d; transform: scale(1.25); filter: drop-shadow(0 0 8px #fbbf24); }
.row .fl svg.out { color: #475569; }
.row.cut .lb, .row.cut .fl { color: #fca5a5; }
.row .fl .nw { animation: sm-row .3s ease-out both; }
.tot { padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; background: rgba(251, 191, 36, .08); }
.tot .k { font-family: var(--font-bug); font-weight: 800; font-size: 16px; letter-spacing: 1px; color: #fde68a; }
.tot .x { font-family: var(--font-bug); font-weight: 800; font-size: 26px; line-height: 1; color: #fde68a; font-variant-numeric: tabular-nums; }

/* nivel */
.lvl { display: flex; flex-direction: column; gap: 6px; opacity: 0; transition: opacity .3s; }
.lvl.in { opacity: 1; }
.lr { display: flex; align-items: center; gap: 8px; }
.lr .nv { height: 28px; padding: 0 9px; border-radius: 8px; background: linear-gradient(180deg, #818cf8, #4f46e5); border: 1.5px solid #c7d2fe; display: flex; align-items: center; font-family: var(--font-bug); font-weight: 800; font-size: 16px; white-space: nowrap; }
.lr .nv.pop { animation: sm-nvpop .5s cubic-bezier(.34, 1.56, .64, 1); }
@keyframes sm-nvpop { 0% { transform: scale(1.6); } 100% { transform: none; } }
.lr .bar { position: relative; flex: 1; height: 18px; border-radius: 999px; background: rgba(255, 255, 255, .08); border: 1px solid rgba(255, 255, 255, .1); overflow: visible; display: block; }
.lr .bar i { position: absolute; left: 0; top: 0; bottom: 0; display: block; border-radius: 999px; }
.lr .bar .gold { background: linear-gradient(90deg, #fde68a, #fbbf24); }
.lr .bar .base { background: linear-gradient(90deg, #34d399, #22d3ee, #818cf8); }
.lr .bar .lbl { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-family: var(--font-bug); font-weight: 800; font-size: 13px; text-shadow: 0 1px 2px #000; white-space: nowrap; }
.lr .bar .up { position: absolute; left: 50%; top: -6px; transform: translate(-50%, -100%); font-family: var(--font-bug); font-weight: 800; text-transform: uppercase; letter-spacing: .06em; font-size: 15px; color: #fcd34d; white-space: nowrap; text-shadow: 0 0 14px rgba(252, 211, 77, .8); animation: sm-up 2s ease forwards; }
/* "¡Nivel N!" sube y se va (moodboard 03, como en main) */
@keyframes sm-up { 0% { opacity: 0; transform: translate(-50%, -60%) scale(.5); } 20% { opacity: 1; transform: translate(-50%, -100%) scale(1.12); } 80% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%, -130%); } }
.lr .bar .combo { position: absolute; right: -6px; top: -26px; font-family: var(--font-shout); font-weight: 800; font-style: italic; font-size: 22px; line-height: 1; color: #fde68a; text-shadow: 0 2px 0 #b45309, 0 0 12px rgba(252, 211, 77, .7); transform: rotate(-8deg); animation: sm-combo .4s cubic-bezier(.34, 1.56, .64, 1) both; pointer-events: none; }
/* ×2, ×3: cada vuelta de la barra estampa el contador (se re-monta por :key) */
@keyframes sm-combo { from { transform: rotate(-8deg) scale(2.2); opacity: 0; } to { transform: rotate(-8deg); opacity: 1; } }
.lr .nx { font-family: var(--font-bug); font-weight: 800; font-size: 16px; color: #64748b; }
.prz-card { flex: none; }
.prz { min-height: 52px; box-sizing: border-box; border-radius: 14px; padding: 6px 12px 6px 8px; background: linear-gradient(90deg, rgba(129, 140, 248, .18), rgba(129, 140, 248, .03)); border: 1px solid rgba(129, 140, 248, .35); display: flex; align-items: center; gap: 10px; }
.prz .pt { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.prz .pt .k { font-size: 11px; font-weight: 700; color: #a5b4fc; }
.prz .pt .n { font-size: 13.5px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.prz .lf { font-family: var(--font-bug); font-weight: 800; font-size: 14px; color: #c7d2fe; text-align: right; line-height: 1.05; white-space: nowrap; }

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
.gate { display: grid; gap: 8px; text-align: center; padding: 14px; border-radius: 14px; border: 1px solid rgba(252, 211, 77, .3); background: rgba(252, 211, 77, .06); }
.gate h3 { margin: 0; font-family: var(--font-bug); font-weight: 800; text-transform: uppercase; font-size: 18px; color: #fff; }
.gate p { margin: 0; font-size: 12.5px; color: #c5cbe8; }
.gate p b { color: #4ade80; }
.gate .main { display: grid; place-items: center; min-height: 48px; border-radius: 12px; font-weight: 800; color: #141005; background: linear-gradient(180deg, #fde68a, #f59e0b); text-decoration: none; }
.gate .link { min-height: 44px; display: grid; place-items: center; font-size: 13px; color: #8b93b8; text-decoration: none; }

/* acciones */
.sm-go { flex: none; padding: 8px 16px calc(20px + env(safe-area-inset-bottom, 0px)); display: flex; flex-direction: column; gap: 10px; opacity: 0; transform: translateY(8px); transition: opacity .35s, transform .35s; }
.sm-go.in { opacity: 1; transform: none; }
.next { width: 100%; min-height: 60px; box-sizing: border-box; border: 0; border-radius: 16px; background: linear-gradient(180deg, #fcd34d 0%, #f59e0b 100%); border-bottom: 4px solid #b45309; color: #1c1206; display: flex; align-items: center; justify-content: center; gap: 10px; text-decoration: none; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.next:active { transform: translateY(2px); border-bottom-width: 2px; }
.next .t { display: flex; flex-direction: column; align-items: center; line-height: 1; min-width: 0; }
.next .a { font-family: var(--font-shout); font-weight: 800; font-style: italic; font-size: 26px; letter-spacing: 1px; }
.next .b { font-size: 11.5px; font-weight: 700; color: #78350f; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.ghost { min-height: 48px; border-radius: 14px; border: 1px solid rgba(255, 255, 255, .14); background: rgba(255, 255, 255, .05); color: #e2e8f0; font: inherit; font-weight: 700; font-size: 14px; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; text-decoration: none; }

.sm-fade-enter-active { transition: opacity .3s ease; }
.sm-fade-leave-active { transition: opacity .2s ease; }
.sm-fade-enter-from, .sm-fade-leave-to { opacity: 0; }
@media (prefers-reduced-motion: reduce) {
  .sm, .big.in, .stars svg.in, .tbl.in .row, .row .fl .nw, .lr .nv.pop, .lr .bar .up, .lr .bar .combo { animation-duration: .01ms !important; animation-iteration-count: 1 !important; }
  .sm-conf i { animation: none; opacity: .5; }
}
</style>
