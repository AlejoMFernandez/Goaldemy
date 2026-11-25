<script setup>
/**
 * DailyEnvelope — "Sobre del día" (diseño V4Sobre).
 *
 * Un sobre en SVG: espalda, bolsillo de adelante y solapa con sello FULVO.
 * Se abre ARRASTRANDO la solapa hacia arriba (o tocándola / ABRIR SOBRE / teclado).
 * Al abrirse sale la carta con lo que trae hoy (sale de get_daily_reward: XP o
 * una ayuda). COBRAR emite `open` y el padre llama a claimDailyReward y hace
 * volar la recompensa desde la carta.
 * Domingo (prop gold): sobre DORADO.
 *
 * API sin cambios: props reward/busy/gold/streakDay, emite `open` con { currentTarget }.
 */
import { computed, ref, onBeforeUnmount } from 'vue'
import PowerupIcon from './PowerupIcon.vue'
import { POWERUP_NAME } from '@/services/prize-card'
import { soundManager } from '@/services/sounds'
import { sparks, center, reducedMotion } from '@/services/game-fx'
import { tap, success } from '@/services/haptics'
import { appWeekday } from '@/services/streak-calendar'

const props = defineProps({
  reward: { type: Object, default: () => ({ available: false }) }, // getDailyReward()
  busy: { type: Boolean, default: false },
  gold: { type: Boolean, default: false },
  streakDay: { type: Number, default: 0 },
})
const emit = defineEmits(['open'])

const uid = 'dse' + Math.random().toString(36).slice(2, 8)
const isHelp = computed(() => props.reward?.reward_kind === 'powerup')
const amount = computed(() => Number(props.reward?.amount) || (isHelp.value ? 1 : 100))
const helpName = computed(() => (POWERUP_NAME && POWERUP_NAME[props.reward?.reward_powerup]) || 'Ayuda')

// Día de la semana en hora Argentina: lunes = 1 … domingo = 7
const dow = appWeekday()
const weekDay = dow === 0 ? 7 : dow

// ─── Estado ─────────────────────────────────────────────
const opened = ref(false)
const angle = ref(0)          // 0 cerrada … 170 abierta
const dragging = ref(false)
const cardOut = ref(false)
const stageEl = ref(null)
const cardEl = ref(null)

// done: ya se cobró hoy (y no lo abriste en esta visita) · sealed · open · cobrado
const state = computed(() => {
  if (!opened.value) return props.reward?.available ? 'sealed' : 'done'
  return props.reward?.available ? 'open' : 'cobrado'
})

let timers = []
onBeforeUnmount(() => timers.forEach(clearTimeout))
function T(fn, ms) { timers.push(setTimeout(fn, reducedMotion ? Math.min(ms, 30) : ms)) }

function openEnvelope() {
  if (opened.value || state.value !== 'sealed' || props.busy) return
  opened.value = true
  angle.value = 170
  tap()
  soundManager.play(props.gold ? 'cardEpic' : 'cardRare')
  T(() => {
    cardOut.value = true
    soundManager.play('coin')
    if (props.gold) soundManager.play('cardLegendary')
  }, 260)
  T(() => {
    const ce = cardEl.value
    if (ce) { const c = center(ce); sparks(c.x, c.y, props.gold ? 30 : 16, [props.gold ? '#fcd34d' : isHelp.value ? '#60a5fa' : '#fcd34d', '#fff'], 110) }
  }, 900)
}

function claim() {
  if (state.value !== 'open' || props.busy) return
  success()
  emit('open', { currentTarget: cardEl.value || stageEl.value })
}

function onCta() {
  if (state.value === 'sealed') openEnvelope()
  else if (state.value === 'open') claim()
}

// ─── Arrastrar la solapa ────────────────────────────────
let y0 = 0, moved = false
function onDown(e) {
  if (state.value !== 'sealed' || props.busy) return
  e.preventDefault()
  dragging.value = true
  moved = false
  y0 = e.clientY
  try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
}
function onMove(e) {
  if (!dragging.value) return
  const dy = y0 - e.clientY
  if (Math.abs(dy) > 6) moved = true
  angle.value = Math.max(0, Math.min(1, dy / 110)) * 170
  if (angle.value >= 150) { dragging.value = false; openEnvelope() }
}
function onUp() {
  if (!dragging.value) return
  dragging.value = false
  if (!moved || angle.value > 70) openEnvelope()
  else angle.value = 0
}
// Teclado (Enter / Espacio): el click llega con detail 0
function onFlapClick(e) { if (e.detail === 0) openEnvelope() }

// ─── Presentación ───────────────────────────────────────
const pal = computed(() => props.gold
  ? { back: ['#92400e', '#78350f'], pocket: ['#f59e0b', '#d97706', '#92400e'], flap: ['#fde68a', '#f59e0b'], ink: '#fff7d6' }
  : { back: ['#312e81', '#1e1b4b'], pocket: ['#4f46e5', '#4338ca', '#312e81'], flap: ['#818cf8', '#4f46e5'], ink: '#e0e7ff' })

const flapStyle = computed(() => {
  const a = state.value === 'done' ? 170 : angle.value
  return { transform: `rotateX(${a}deg)`, zIndex: a > 90 || opened.value ? 1 : 4 }
})
const flapAria = computed(() => state.value === 'sealed' ? 'Abrir el sobre: deslizá la solapa hacia arriba o tocala' : 'Sobre abierto')

const badge = computed(() => props.gold ? 'SOBRE DORADO' : isHelp.value ? 'AYUDA' : 'XP')
const resultTitle = computed(() => isHelp.value ? `Te salió una ayuda: ${helpName.value}` : `Te salieron +${amount.value} XP`)
const ctaLabel = computed(() => ({ sealed: 'ABRIR SOBRE', open: props.busy ? 'COBRANDO…' : 'COBRAR', cobrado: '¡COBRADO!', done: 'VOLVÉ MAÑANA' })[state.value])

const tiles = computed(() => [
  { key: 'xp', when: 'Lun a Vie', value: '+100', label: 'XP', today: weekDay <= 5 },
  { key: 'sab', when: 'Sábado', value: 'Ayuda', label: '50/50, Escudo, Tiempo o Pista', today: weekDay === 6 },
  { key: 'dom', when: 'Domingo', value: 'Ayuda', label: 'en sobre dorado', today: weekDay === 7, gold: true },
])
const footnote = computed(() => weekDay === 7
  ? 'Hoy toca el sobre dorado · el lunes arranca otra semana'
  : `Volvé mañana por el día ${weekDay + 1} · el día 7 es un `)
</script>

<template>
  <div class="dse" :class="['is-' + state, { gold, help: isHelp }]">
    <section ref="stageEl" class="stage" aria-label="Tu sobre">
      <span v-if="cardOut" class="rays" aria-hidden="true"></span>

      <div class="env" :class="{ dragging }">
        <!-- Espalda -->
        <svg class="back" aria-hidden="true" width="236" height="236" viewBox="0 0 236 236">
          <defs>
            <linearGradient :id="uid + 'b'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" :stop-color="pal.back[0]" /><stop offset="1" :stop-color="pal.back[1]" /></linearGradient>
            <linearGradient :id="uid + 'p'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" :stop-color="pal.pocket[0]" /><stop offset=".6" :stop-color="pal.pocket[1]" /><stop offset="1" :stop-color="pal.pocket[2]" /></linearGradient>
            <linearGradient :id="uid + 'f'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" :stop-color="pal.flap[0]" /><stop offset="1" :stop-color="pal.flap[1]" /></linearGradient>
          </defs>
          <rect x="0" y="0" width="236" height="236" rx="18" :fill="`url(#${uid}b)`" />
        </svg>

        <!-- La carta de adentro -->
        <div ref="cardEl" class="card" :class="{ out: cardOut }" aria-live="polite">
          <div class="card-in">
            <span class="card-badge">{{ badge }}</span>
            <span class="card-art">
              <PowerupIcon v-if="isHelp" :type="reward.reward_powerup" :size="36" />
              <svg v-else viewBox="0 0 24 24" width="40" height="40" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#fcd34d" /><circle cx="12" cy="12" r="8" fill="none" stroke="#b45309" stroke-width="1" stroke-dasharray="1.5 1.5" /><text x="12" y="15.5" text-anchor="middle" font-family="'Barlow Condensed',Impact,sans-serif" font-weight="800" font-size="9" fill="#141005">XP</text></svg>
            </span>
            <span class="card-kind">{{ isHelp ? 'AYUDA' : 'EXPERIENCIA' }}</span>
            <span class="card-name">{{ isHelp ? helpName : `+${amount} XP` }}</span>
          </div>
        </div>

        <!-- Bolsillo de adelante -->
        <div class="front" aria-hidden="true">
          <svg width="236" height="236" viewBox="0 0 236 236">
            <path d="M0 22 L104 100 Q118 110 132 100 L236 22 V218 Q236 236 218 236 H18 Q0 236 0 218 Z" :fill="`url(#${uid}p)`" />
            <path d="M0 22 L104 100 Q118 110 132 100 L236 22" fill="none" stroke="rgba(255,255,255,0.16)" stroke-width="1.5" />
            <path d="M0 218 L92 150 M236 218 L144 150" fill="none" stroke="rgba(0,0,0,0.18)" stroke-width="1.5" stroke-linecap="round" />
          </svg>
          <div class="front-txt">
            <img src="/iconclaro.png" alt="" class="front-logo" draggable="false">
            <span class="front-title" :style="{ color: pal.ink }">{{ gold ? 'SOBRE DORADO' : 'SOBRE DEL DÍA' }}</span>
            <span class="front-day">DÍA {{ weekDay }} · FULVO</span>
          </div>
        </div>

        <!-- Solapa: se arrastra hacia arriba o se toca -->
        <button type="button" class="flap" :style="flapStyle" :aria-label="flapAria" :aria-expanded="opened ? 'true' : 'false'"
                :disabled="state !== 'sealed' || busy"
                @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp" @pointercancel="onUp" @click="onFlapClick">
          <svg aria-hidden="true" width="236" height="128" viewBox="0 0 236 128">
            <path d="M0 18 Q0 0 18 0 H218 Q236 0 236 18 V22 L132 104 Q118 115 104 104 L0 22 Z" :fill="`url(#${uid}f)`" />
            <path d="M2 20 Q2 2 18 2 H218 Q234 2 234 20" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1.5" />
          </svg>
          <span class="seal" aria-hidden="true"><span><img src="/iconclaro.png" alt="" draggable="false"></span></span>
        </button>

        <span v-if="state === 'sealed' && !dragging && angle === 0" class="nudge" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fde68a" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 14l6-6 6 6" /><path d="M6 20l6-6 6 6" opacity="0.5" /></svg>
          <span>DESLIZÁ PARA ABRIR</span>
        </span>
      </div>
    </section>

    <section v-if="state === 'sealed'" class="odds" aria-label="Lo que trae el sobre">
      <div class="odds-h">LO QUE TRAE</div>
      <div class="odds-g">
        <div v-for="t in tiles" :key="t.key" class="tile" :class="{ today: t.today, gold: t.gold }">
          <span class="tile-when">{{ t.today ? 'HOY' : t.when }}</span>
          <span class="tile-val">{{ t.value }}</span>
          <span class="tile-lbl">{{ t.label }}</span>
        </div>
      </div>
    </section>

    <section v-else-if="state === 'open' || state === 'cobrado'" class="result" aria-label="Lo que te salió">
      <div class="result-t">{{ resultTitle }}</div>
      <div class="result-chips">
        <span v-if="isHelp" class="chip help"><PowerupIcon :type="reward.reward_powerup" :size="16" />{{ helpName }} ×{{ amount }}</span>
        <span v-else class="chip xp">+{{ amount }} XP</span>
        <span v-if="gold" class="chip goldc">Sobre dorado</span>
      </div>
    </section>

    <p v-else class="done-msg">Ya abriste el sobre de hoy · mañana te espera otro</p>

    <div class="cta-wrap">
      <button type="button" class="cta" :disabled="state === 'done' || state === 'cobrado' || busy" @click="onCta">{{ ctaLabel }}</button>
      <span class="foot">{{ footnote }}<strong v-if="weekDay !== 7">sobre dorado</strong></span>
    </div>
  </div>
</template>

<style scoped>
.dse img { -webkit-user-drag: none; }
.dse { display: flex; flex-direction: column; align-items: center; gap: 10px; user-select: none; -webkit-user-select: none; }

/* Escenario: el sobre (236) + lugar arriba para que salga la carta */
.stage { position: relative; width: 100%; max-width: 340px; height: 366px; }
.rays { position: absolute; left: 50%; top: 4px; width: 320px; height: 320px; margin-left: -160px; border-radius: 50%; pointer-events: none;
  background: repeating-conic-gradient(rgba(96, 165, 250, .22) 0 10deg, transparent 10deg 24deg);
  -webkit-mask-image: radial-gradient(circle, #000 30%, transparent 70%); mask-image: radial-gradient(circle, #000 30%, transparent 70%);
  animation: dse-rays 14s linear infinite; }
.gold .rays, .is-open:not(.help) .rays, .is-cobrado:not(.help) .rays { background: repeating-conic-gradient(rgba(251, 191, 36, .2) 0 10deg, transparent 10deg 24deg); }
@keyframes dse-rays { to { transform: rotate(360deg); } }

.env { position: absolute; left: 50%; bottom: 0; width: 236px; height: 300px; margin-left: -118px; perspective: 900px; }
.back { position: absolute; left: 0; top: 64px; z-index: 0; overflow: visible; filter: drop-shadow(0 22px 26px rgba(0, 0, 0, .55)); }

.card { position: absolute; left: 22px; right: 22px; top: 80px; height: 206px; z-index: 2; border-radius: 14px; padding: 5px; box-sizing: border-box;
  background: linear-gradient(160deg, #fde68a, #f59e0b 45%, #92400e); box-shadow: 0 0 24px rgba(251, 191, 36, .5);
  transition: transform .7s cubic-bezier(.2, .9, .25, 1.15); }
.help .card { background: linear-gradient(160deg, #bfdbfe, #3b82f6 45%, #1e3a8a); box-shadow: 0 0 24px rgba(96, 165, 250, .55); }
.card.out { transform: translateY(-132px) rotate(-3deg); }
.is-done .card { visibility: hidden; }
.card-in { height: 100%; border-radius: 10px; box-sizing: border-box; padding-top: 10px; display: flex; flex-direction: column; align-items: center; gap: 6px;
  background: radial-gradient(90% 60% at 50% 30%, #b45309, #0f172a 75%); }
.help .card-in { background: radial-gradient(90% 60% at 50% 30%, #1d4ed8, #0f172a 75%); }
.card-badge { padding: 2px 9px; border-radius: 6px; background: #fbbf24; color: #0b1220; font-family: var(--font-bug); font-weight: 800; font-size: 13px; letter-spacing: 1.5px; }
.help .card-badge { background: #60a5fa; }
.card-art { width: 70px; height: 70px; box-sizing: border-box; border-radius: 18px; display: flex; align-items: center; justify-content: center; color: #93c5fd;
  border: 4px solid #fcd34d; background: repeating-linear-gradient(45deg, transparent 0 7px, rgba(252, 211, 77, .4) 7px 8.5px), repeating-linear-gradient(-45deg, transparent 0 7px, rgba(252, 211, 77, .4) 7px 8.5px), #0b1220; }
.help .card-art { border-color: #93c5fd; background: repeating-linear-gradient(45deg, transparent 0 7px, rgba(147, 197, 253, .55) 7px 8.5px), repeating-linear-gradient(-45deg, transparent 0 7px, rgba(147, 197, 253, .55) 7px 8.5px), #0b1220; }
.card-kind { font-size: 10px; font-weight: 800; letter-spacing: 1.4px; color: #fde68a; }
.help .card-kind { color: #93c5fd; }
.card-name { font-family: var(--font-shout); font-weight: 800; font-style: italic; font-size: 26px; line-height: .9; color: #fff; text-align: center; padding: 0 8px; text-transform: uppercase; }

.front { position: absolute; left: 0; top: 64px; width: 236px; height: 236px; z-index: 3; pointer-events: none; }
.front > svg { position: absolute; inset: 0; }
.front-txt { position: absolute; left: 0; right: 0; bottom: 16px; display: flex; flex-direction: column; align-items: center; }
.front-logo { height: 34px; width: auto; opacity: .95; }
.front-title { margin-top: 4px; font-family: var(--font-shout); font-weight: 800; font-style: italic; font-size: 22px; line-height: 1; letter-spacing: 1px; }
.front-day { margin-top: 2px; font-size: 11px; font-weight: 800; letter-spacing: 1.6px; color: #fbbf24; }
.gold .front-day { color: #1c1206; }

.flap { position: absolute; left: 0; top: 64px; width: 236px; height: 128px; padding: 0; border: 0; background: transparent; cursor: grab; touch-action: none;
  transform-origin: 50% 0; transition: transform .7s cubic-bezier(.2, .9, .25, 1.15); -webkit-tap-highlight-color: transparent; }
.flap:disabled { cursor: default; }
.flap:focus-visible { outline: none; }
.flap:focus-visible .seal { box-shadow: 0 0 0 3px #fde68a, 0 4px 10px rgba(0, 0, 0, .45); }
.dragging .flap { transition: none; cursor: grabbing; }
.flap > svg, .seal { pointer-events: none; }
.flap > svg { position: absolute; left: 0; top: 0; overflow: visible; filter: drop-shadow(0 5px 6px rgba(0, 0, 0, .35)); }
.seal { position: absolute; left: 50%; top: 84px; margin-left: -24px; width: 48px; height: 48px; box-sizing: border-box; border-radius: 50%;
  background: radial-gradient(circle at 38% 32%, #fde68a, #f59e0b 58%, #b45309); border: 2px solid #fff7d6;
  box-shadow: 0 4px 10px rgba(0, 0, 0, .45), inset 0 -2px 0 rgba(120, 53, 15, .5); display: flex; align-items: center; justify-content: center; }
.seal > span { width: 34px; height: 34px; border-radius: 50%; background: #1e1b4b; box-shadow: inset 0 1px 2px rgba(0, 0, 0, .6); display: flex; align-items: center; justify-content: center; }
.gold .seal { background: radial-gradient(circle at 38% 32%, #fff7d6, #fde68a 50%, #b45309); }
.gold .seal > span { background: #1c1206; }
.seal img { height: 24px; width: auto; }

.nudge { position: absolute; left: 50%; top: -6px; width: 160px; margin-left: -80px; z-index: 5; display: flex; flex-direction: column; align-items: center; gap: 2px; pointer-events: none;
  animation: dse-nudge 1.4s ease-in-out infinite; }
.nudge > span { padding: 4px 12px; border-radius: 999px; background: rgba(11, 18, 32, .75); border: 1px solid rgba(253, 230, 138, .45); font-family: var(--font-bug); font-weight: 800; font-size: 15px; letter-spacing: .5px; color: #fde68a; white-space: nowrap; }
@keyframes dse-nudge { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }

.is-done .env { filter: saturate(.45) brightness(.8); }

/* Lo que trae / lo que salió */
.odds { width: 100%; }
.odds-h { font-size: 12px; font-weight: 800; letter-spacing: 1.2px; color: #94a3b8; margin-bottom: 8px; }
.odds-g { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
.tile { border-radius: 14px; padding: 8px 4px; background: rgba(255, 255, 255, .04); border: 1px solid rgba(255, 255, 255, .08); display: flex; flex-direction: column; align-items: center; gap: 3px; text-align: center; }
.tile.today { border-color: rgba(251, 191, 36, .6); background: rgba(251, 191, 36, .08); }
.tile-when { font-family: var(--font-bug); font-weight: 800; font-size: 12px; letter-spacing: .5px; color: #94a3b8; text-transform: uppercase; }
.tile.today .tile-when { color: #fde68a; }
.tile-val { font-family: var(--font-bug); font-weight: 800; font-size: 18px; line-height: 1; color: #a5f3fc; }
.tile.gold .tile-val { color: #fbbf24; }
.tile-lbl { font-size: 10px; color: #94a3b8; line-height: 1.2; }

.result { width: 100%; text-align: center; }
.result-t { font-family: var(--font-display); font-weight: 700; font-size: 20px; color: #f1f5f9; }
.result-chips { margin-top: 8px; display: flex; justify-content: center; flex-wrap: wrap; gap: 8px; }
.chip { display: inline-flex; align-items: center; gap: 5px; padding: 6px 10px; border-radius: 999px; background: rgba(255, 255, 255, .06); font-family: var(--font-bug); font-weight: 800; font-size: 15px; }
.chip.xp { color: #fde68a; }
.chip.help { color: #bfdbfe; background: rgba(96, 165, 250, .15); border: 1px solid rgba(96, 165, 250, .5); }
.chip.goldc { color: #fbbf24; background: rgba(251, 191, 36, .12); border: 1px solid rgba(251, 191, 36, .45); }
.done-msg { margin: 0; font-size: 13px; color: #94a3b8; text-align: center; }

.cta-wrap { width: 100%; display: flex; flex-direction: column; align-items: center; gap: 8px; margin-top: 4px; }
.cta { width: 100%; min-height: 56px; border-radius: 16px; border: 0; border-bottom: 4px solid #b45309; background: linear-gradient(180deg, #fcd34d 0%, #f59e0b 100%);
  color: #1c1206; font-family: var(--font-shout); font-weight: 800; font-style: italic; font-size: 24px; letter-spacing: 1px; cursor: pointer; transition: transform .1s; }
.cta:active:not(:disabled) { transform: translateY(2px); border-bottom-width: 2px; }
.cta:disabled { cursor: default; background: rgba(255, 255, 255, .08); border-bottom-color: rgba(255, 255, 255, .06); color: #94a3b8; }
.is-cobrado .cta:disabled { background: rgba(34, 197, 94, .18); color: #86efac; border-bottom-color: rgba(34, 197, 94, .3); }
.cta:focus-visible { outline: 2px solid #fde68a; outline-offset: 3px; }
.foot { font-size: 12px; color: #94a3b8; text-align: center; }
.foot strong { color: #fbbf24; }

@media (prefers-reduced-motion: reduce) {
  .rays, .nudge { animation: none; }
  .card, .flap, .cta { transition: none; }
}
</style>
