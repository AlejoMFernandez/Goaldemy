<script setup>
/**
 * DailyEnvelope — "El sobre del día" (Moodboard 02 · punto 02)
 *
 * Un sobre de figuritas FULVO (vertical) que se abre arrastrando el dedo por la
 * línea punteada de arriba, de izquierda a derecha, como un sobre de verdad.
 * Mientras se rompe se escapa luz del color de lo que hay adentro (dorado = XP,
 * celeste = ayuda). La tira sale volando, sube la figurita, el sobre cae, y
 * recién ahí se reclama (el padre llama a claimDailyReward y la recompensa vuela).
 * Día 7 de la racha (o domingo): sobre DORADO.
 * La API no cambió: props reward/busy/gold, emite `open` con { currentTarget }.
 */
import { computed, ref, onBeforeUnmount } from 'vue'
import PowerupIcon from './PowerupIcon.vue'
import { POWERUP_NAME } from '@/services/prize-card'
import { soundManager } from '@/services/sounds'
import { sparks, center, reducedMotion } from '@/services/game-fx'

const props = defineProps({
  reward: { type: Object, default: () => ({ available: false }) }, // getDailyReward()
  busy: { type: Boolean, default: false },
  gold: { type: Boolean, default: false },
  streakDay: { type: Number, default: 0 },
})
const emit = defineEmits(['open'])

const isHelp = computed(() => props.reward?.reward_kind === 'powerup')
const amount = computed(() => Number(props.reward?.amount) || (isHelp.value ? 1 : 100))
const helpName = computed(() => (POWERUP_NAME && POWERUP_NAME[props.reward?.reward_powerup]) || 'Ayuda')
const leak = computed(() => props.gold ? '#fcd34d' : isHelp.value ? '#38bdf8' : '#fcd34d')

// sealed → torn (animando) → open ; si ya se reclamó hoy: done
const torn = ref(false)
const opened = ref(false)
const dragging = ref(false)
const prog = ref(0)
const cardUp = ref(0) // 0 adentro · 1 asomando · 2 afuera
const stripEl = ref(null)
const packEl = ref(null)
const cardEl = ref(null)
const state = computed(() => (!props.reward?.available && !opened.value) ? 'done' : (opened.value ? 'open' : (torn.value ? 'torn' : 'sealed')))

let sx = 0, lastTear = 0, timers = []
onBeforeUnmount(() => timers.forEach(clearTimeout))
function T(fn, ms) { timers.push(setTimeout(fn, reducedMotion ? Math.min(ms, 30) : ms)) }

function setProg(p) { prog.value = Math.max(0, Math.min(1, p)) }
function onDown(e) {
  if (state.value !== 'sealed' || props.busy) return
  dragging.value = true
  try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
  sx = e.clientX - prog.value * (stripEl.value?.getBoundingClientRect().width || 1)
  lastTear = e.clientX
}
function onMove(e) {
  if (!dragging.value) return
  const w = stripEl.value?.getBoundingClientRect().width || 1
  setProg((e.clientX - sx) / w)
  if (Math.abs(e.clientX - lastTear) > 14) { lastTear = e.clientX; soundManager.play('tear') }
  if (prog.value >= 0.98) { dragging.value = false; completeTear() }
}
function onUp() {
  if (!dragging.value) return
  dragging.value = false
  if (prog.value > 0.6) return completeTear()
  // no llegó: la tira vuelve
  const p0 = prog.value, t0 = performance.now()
  const back = (now) => { const k = Math.min(1, (now - t0) / 250); setProg(p0 * (1 - k)); if (k < 1) requestAnimationFrame(back) }
  requestAnimationFrame(back)
}
// Tocar sin arrastrar (o teclado): se rompe solo
function autoOpen() {
  if (state.value !== 'sealed' || props.busy) return
  dragging.value = true
  const t0 = performance.now(); let lt = 0
  const go = (now) => {
    const k = Math.min(1, (now - t0) / 650); setProg(k)
    if (now - lt > 45) { lt = now; soundManager.play('tear') }
    if (k < 1) requestAnimationFrame(go); else { dragging.value = false; completeTear() }
  }
  requestAnimationFrame(go)
}
function onKey(e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); autoOpen() } }

function completeTear() {
  if (torn.value) return
  torn.value = true
  soundManager.play('tearDone')
  const el = packEl.value
  if (el) { const c = center(el); sparks(c.x, c.y - c.h * 0.4, 18, [leak.value, '#fff'], 80) }
  T(() => { cardUp.value = 1; soundManager.play(props.gold ? 'cardEpic' : 'cardRare') }, 150)
  T(() => {
    cardUp.value = 2; opened.value = true
    soundManager.play('coin')
    if (props.gold) soundManager.play('cardLegendary')
    const ce = cardEl.value
    if (ce) { const c = center(ce); sparks(c.x, c.y, props.gold ? 30 : 16, [leak.value, '#fff'], 110) }
  }, 750)
  // La figurita queda un instante a la vista y después se reclama (y vuela a su contador)
  T(() => emit('open', { currentTarget: cardEl.value || packEl.value }), 1500)
}
const stripStyle = computed(() => torn.value ? null : { transform: `rotate(${-prog.value * 9}deg) translateY(${-prog.value * 6}px)` })
</script>

<template>
  <div class="dpk" :class="['is-' + state, { gold, dragging, help: isHelp }]" :style="{ '--leak': leak }">
    <p class="dpk-lbl">
      <template v-if="gold">Recompensa diaria · <b>sobre dorado</b></template>
      <template v-else-if="streakDay">Recompensa diaria · <b>Día {{ streakDay }}</b> de racha</template>
      <template v-else>Recompensa diaria</template>
    </p>

    <div ref="packEl" class="pack" role="button" :tabindex="state === 'sealed' ? 0 : -1" :aria-label="state === 'sealed' ? 'Abrir el sobre del día' : 'Sobre abierto'" @keydown="onKey">
      <i class="leak" :style="{ opacity: state === 'sealed' ? prog * 0.9 : (state === 'done' ? 0 : 0.9) }" aria-hidden="true"></i>

      <!-- La figurita de adentro -->
      <div ref="cardEl" class="card2" :class="'up' + cardUp" aria-live="polite">
        <template v-if="isHelp">
          <span class="ic help"><PowerupIcon :type="reward.reward_powerup" :size="52" /></span>
          <span class="big">+{{ amount }}</span>
          <span class="sm">{{ helpName }}</span>
        </template>
        <template v-else>
          <svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#fcd34d" /><circle cx="12" cy="12" r="8" fill="none" stroke="#b45309" stroke-width="1" stroke-dasharray="1.5 1.5" /><text x="12" y="15.5" text-anchor="middle" font-family="'Barlow Condensed',Impact,sans-serif" font-size="9" fill="#141005">XP</text></svg>
          <span class="big">+{{ amount }}</span>
          <span class="sm">XP<template v-if="gold"> · sobre dorado</template></span>
        </template>
      </div>

      <!-- Cuerpo del sobre -->
      <div class="body" aria-hidden="true">
        <div class="skin"></div>
        <div class="logo"><span class="F">F</span><span class="lb">{{ gold ? 'Sobre dorado' : 'Sobre diario' }}</span></div>
      </div>

      <!-- Tira de arriba: se rompe arrastrando -->
      <div ref="stripEl" class="strip" :style="stripStyle" @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp" @pointercancel="onUp" @click="!dragging && prog === 0 && autoOpen()">
        <div class="skin"></div>
        <i class="grip" :style="{ width: (prog * 100) + '%' }"></i>
        <i class="perf"></i>
      </div>
      <span class="hand" aria-hidden="true">👆</span>
    </div>

    <p class="dpk-hint">
      <template v-if="state === 'sealed'">Arrastrá por la línea punteada para abrirlo</template>
      <template v-else-if="state === 'done'">Ya lo abriste hoy · mañana te espera otro</template>
      <template v-else>&nbsp;</template>
    </p>
  </div>
</template>

<style scoped>
.dpk { display: grid; justify-items: center; gap: 12px; user-select: none; -webkit-user-select: none; }
.dpk-lbl { margin: 0; font-family: var(--font-bug); font-weight: 800; text-transform: uppercase; letter-spacing: .16em; font-size: 13px; color: #8b93b8; text-align: center; }
.dpk-lbl b { color: #fcd34d; }
.pack { position: relative; width: clamp(150px, 42vw, 210px); aspect-ratio: 3 / 4.1; margin-top: 30px; touch-action: none; outline: none; }
.pack:focus-visible { filter: drop-shadow(0 0 0 2px #fcd34d); }
.is-sealed .pack { animation: dpk-idle 3s ease-in-out infinite; }
@keyframes dpk-idle { 0%, 100% { transform: rotate(0); } 6% { transform: rotate(-2deg); } 12% { transform: rotate(1.5deg); } 18% { transform: rotate(0); } }

.card2 { position: absolute; left: 7%; right: 7%; top: 6%; height: 84%; border-radius: 10px; background: linear-gradient(160deg, #1c2555, #0f1433); border: 2px solid rgba(255, 255, 255, .2);
  display: grid; place-items: center; align-content: center; gap: 6%; text-align: center; transition: transform .7s cubic-bezier(.16, 1, .3, 1); z-index: 1; box-shadow: 0 0 30px color-mix(in srgb, var(--leak) 40%, transparent); }
.card2.up1 { transform: translateY(-42%); }
.card2.up2 { transform: translateY(-8%) scale(1.12); z-index: 4; }
.is-done .card2 { opacity: 0; }
.card2 .ic { width: 42%; height: auto; }
.card2 .ic.help { display: grid; place-items: center; width: auto; color: #38bdf8; }
.card2 .big { font-family: var(--font-shout); font-weight: 800; font-style: italic; font-size: clamp(34px, 9vw, 50px); line-height: .9; color: #fcd34d; }
.card2 .sm { font-family: var(--font-bug); font-weight: 800; text-transform: uppercase; letter-spacing: .1em; font-size: 12px; color: #dfe4ff; padding: 0 6px; }

.body { position: absolute; left: 0; right: 0; bottom: 0; top: 15%; border-radius: 0 0 12px 12px; overflow: hidden; z-index: 2; transition: transform .6s cubic-bezier(.6, 0, .4, 1), opacity .5s; box-shadow: 0 16px 30px rgba(0, 0, 0, .45); }
.is-open .body { transform: translateY(70%); opacity: 0; }
.strip { position: absolute; left: 0; right: 0; top: 0; height: 15.5%; border-radius: 12px 12px 0 0; overflow: hidden; z-index: 3; transform-origin: 100% 100%; cursor: grab; }
.dragging .strip { cursor: grabbing; }
.is-torn .strip, .is-open .strip { animation: dpk-strip .65s cubic-bezier(.2, .8, .3, 1) forwards; pointer-events: none; }
.is-done .strip { display: none; }
@keyframes dpk-strip { from { transform: rotate(-9deg) translateY(-6px); opacity: 1; } to { transform: translate(60%, -160%) rotate(-38deg); opacity: 0; } }
.skin { position: absolute; inset: 0; background: repeating-linear-gradient(90deg, rgba(255, 255, 255, .06) 0 12%, transparent 12% 24%), linear-gradient(165deg, #10b981 0%, #0e7490 60%, #0b3a4a 100%); }
.gold .skin { background: repeating-linear-gradient(90deg, rgba(255, 255, 255, .12) 0 12%, transparent 12% 24%), linear-gradient(165deg, #fde68a 0%, #f59e0b 55%, #92400e 100%); }
.body .skin { top: -18.3%; }
.body .logo { position: absolute; inset: 0; display: grid; place-items: center; align-content: center; gap: 4%; }
.body .logo .F { font-family: var(--font-shout); font-weight: 800; font-style: italic; font-size: clamp(64px, 18vw, 96px); line-height: .85; color: rgba(255, 255, 255, .95); text-shadow: 0 4px 0 rgba(0, 0, 0, .2); }
.body .logo .lb { font-family: var(--font-bug); font-weight: 800; letter-spacing: .2em; text-transform: uppercase; font-size: 12px; color: rgba(255, 255, 255, .85); }
.perf { position: absolute; left: 4%; right: 4%; bottom: 0; border-bottom: 2px dashed rgba(255, 255, 255, .6); }
.grip { position: absolute; left: 0; top: 0; bottom: 0; width: 0; background: rgba(255, 255, 255, .28); }
.leak { position: absolute; left: 6%; right: 6%; top: 13%; height: 5%; border-radius: 50%; filter: blur(8px); z-index: 1; background: var(--leak); transition: opacity .3s; }
.is-open .leak { top: 0; height: 40%; filter: blur(20px); opacity: .6 !important; }
.hand { position: absolute; top: -4%; left: 4%; font-size: 24px; z-index: 5; animation: dpk-hand 1.8s ease-in-out infinite; pointer-events: none; }
.is-torn .hand, .is-open .hand, .is-done .hand, .dragging .hand { display: none; }
@keyframes dpk-hand { 0% { transform: translateX(0); opacity: 0; } 15% { opacity: 1; } 70% { transform: translateX(420%); opacity: 1; } 100% { transform: translateX(480%); opacity: 0; } }
.is-done .pack { filter: saturate(.5) brightness(.8); }
.dpk-hint { margin: 0; font-size: 12.5px; color: #8b93b8; text-align: center; min-height: 1.2em; }
@media (prefers-reduced-motion: reduce) { .pack, .hand, .strip { animation: none !important; } .card2, .body { transition: none; } }
</style>
