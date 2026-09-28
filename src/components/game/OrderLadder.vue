<script setup>
/**
 * OrderLadder — tablero único de los juegos de ORDENAR (Moodboard 04)
 *
 * · Nunca hay puestos vacíos: los jugadores arrancan ya ubicados (orden al azar)
 *   y solo se reordenan.
 * · Arrastre real con pointer events (dedo, mouse): la carta se levanta y las
 *   demás se corren solas. También se puede tocar dos cartas para cambiarlas,
 *   o usar teclado (Tab + flechas). Pulso corto de vibración al acomodar.
 * · Una metáfora por juego (prop `variant`):
 *     'stairs'   → la escalera (Valor de mercado, vertical)
 *     'team'     → la foto de equipo (Altura, horizontal): las siluetas crecen
 *                  a su altura real contra la regla al revelar
 *     'timeline' → la línea de tiempo (Edad, horizontal): cada carta deja caer
 *                  un pin en la línea según su edad
 * · Reveal de a uno con suspenso (de abajo hacia arriba / de atrás para
 *   adelante). Después, las cartas mal puestas VIAJAN a su lugar correcto y
 *   muestran cuántos puestos estaban corridas. Al terminar emite `done`.
 *
 * El juego sigue siendo el dueño del puntaje: le pasa `result` =
 * { correctness: bool[] por puesto, desiredOrder: idx[] } cuando comprueba.
 */
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import { soundManager } from '@/services/sounds'
import { reducedMotion, sparks, center } from '@/services/game-fx'

const props = defineProps({
  items: { type: Array, required: true },          // jugadores { id, name, image, ... }
  order: { type: Array, required: true },          // índices de items, puesto 0 = primero
  variant: { type: String, default: 'stairs' },    // 'stairs' | 'team' | 'timeline'
  metric: { type: Function, required: true },      // p => número a comparar
  format: { type: Function, default: v => String(v) }, // número → texto del dato
  startLabel: { type: String, default: '' },
  endLabel: { type: String, default: '' },
  locked: { type: Boolean, default: false },
  result: { type: Object, default: null },         // { correctness, desiredOrder }
  instant: { type: Boolean, default: false },      // revisión: mostrar el resultado sin animar
})
const emit = defineEmits(['update:order', 'done'])

const horizontal = computed(() => props.variant === 'team' || props.variant === 'timeline')
const n = computed(() => props.order.length)

// ── Orden que se ve (durante la animación final puede diferir de `order`) ──
const shown = ref([...props.order])
watch(() => props.order, (o) => { if (!travelling.value) shown.value = [...o] }, { deep: true })

// ── Rango del dato (para escalas de barras / siluetas / pines) ──
const values = computed(() => props.items.map(p => Number(props.metric(p)) || 0))
const vMin = computed(() => Math.min(...values.value))
const vMax = computed(() => Math.max(...values.value))
function norm(v) { const r = vMax.value - vMin.value; return r > 0 ? (v - vMin.value) / r : 1 }

// ── Selección para "tocar dos" ──
const picked = ref(null) // posición seleccionada
const cardEls = ref({})  // idx → elemento
const boardEl = ref(null)

function vibrate() { try { navigator.vibrate?.(8) } catch {} }
function commit(newOrder) {
  emit('update:order', newOrder)
  shown.value = [...newOrder]
}
function swap(a, b) {
  const o = [...props.order]
  ;[o[a], o[b]] = [o[b], o[a]]
  commit(o); vibrate(); soundManager.play('click')
}
function move(from, to) {
  if (from === to) return
  const o = [...props.order]
  const [x] = o.splice(from, 1)
  o.splice(to, 0, x)
  commit(o)
}

// ── Arrastre con pointer events ──
let drag = null
const dragPos = ref(null)       // posición del que se arrastra
const shiftFor = ref({})        // posición → desplazamiento en px de las demás
const dragDelta = ref(0)
const dragTarget = ref(null)

function onPointerDown(e, pos) {
  if (props.locked || props.result) return
  if (e.button != null && e.button !== 0) return
  const el = e.currentTarget
  const rects = shown.value.map(i => cardEls.value[i]?.getBoundingClientRect())
  if (rects.some(r => !r)) return
  const r0 = rects[pos]
  const step = n.value > 1
    ? (horizontal.value ? rects[1].left - rects[0].left : rects[1].top - rects[0].top)
    : (horizontal.value ? r0.width : r0.height)
  drag = { pos, el, started: false, x0: e.clientX, y0: e.clientY, rects, step, target: pos, pointerId: e.pointerId }
  try { el.setPointerCapture(e.pointerId) } catch {}
}
function onPointerMove(e) {
  if (!drag) return
  const d = horizontal.value ? e.clientX - drag.x0 : e.clientY - drag.y0
  const other = horizontal.value ? e.clientY - drag.y0 : e.clientX - drag.x0
  if (!drag.started) {
    if (Math.abs(d) < 6 && Math.abs(other) < 6) return
    drag.started = true
    dragPos.value = drag.pos
    dragTarget.value = drag.pos
    picked.value = null
    soundManager.play('click')
  }
  e.preventDefault()
  // Límite: no sacar la carta del tablero
  const minD = -drag.pos * drag.step
  const maxD = (n.value - 1 - drag.pos) * drag.step
  const dd = Math.max(minD, Math.min(maxD, d))
  dragDelta.value = dd
  const target = Math.max(0, Math.min(n.value - 1, Math.round(drag.pos + dd / drag.step)))
  if (target !== drag.target) { drag.target = target; dragTarget.value = target; vibrate(); soundManager.play('tick') }
  const s = {}
  for (let k = 0; k < n.value; k++) {
    if (k === drag.pos) continue
    if (drag.pos < k && k <= target) s[k] = -drag.step
    else if (target <= k && k < drag.pos) s[k] = drag.step
    else s[k] = 0
  }
  shiftFor.value = s
}
function onPointerUp(e, pos) {
  if (!drag) return
  const d = drag
  drag = null
  try { d.el.releasePointerCapture(d.pointerId) } catch {}
  if (d.started) {
    const target = d.target
    dragPos.value = null
    dragTarget.value = null
    shiftFor.value = {}
    dragDelta.value = 0
    move(d.pos, target)
    if (target !== d.pos) vibrate()
    return
  }
  // Toque: seleccionar / cambiar
  if (picked.value == null) { picked.value = pos; soundManager.play('click') }
  else if (picked.value === pos) picked.value = null
  else { const a = picked.value; picked.value = null; swap(a, pos) }
}
function onKey(e, pos) {
  if (props.locked || props.result) return
  const back = horizontal.value ? 'ArrowLeft' : 'ArrowUp'
  const fwd = horizontal.value ? 'ArrowRight' : 'ArrowDown'
  if (e.key === back && pos > 0) { e.preventDefault(); move(pos, pos - 1); vibrate(); nextTick(() => focusPos(pos - 1)) }
  else if (e.key === fwd && pos < n.value - 1) { e.preventDefault(); move(pos, pos + 1); vibrate(); nextTick(() => focusPos(pos + 1)) }
  else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPointerUp.call(null, e, pos) }
}
function focusPos(pos) { cardEls.value[shown.value[pos]]?.focus?.() }

// Número de puesto que se ve: durante el arrastre acompaña al lugar al que va cada carta
function rankAt(pos) {
  if (dragPos.value == null) return pos + 1
  if (pos === dragPos.value) return (dragTarget.value ?? pos) + 1
  const s = shiftFor.value[pos] || 0
  return pos + 1 + (s > 0 ? 1 : s < 0 ? -1 : 0)
}
// "38 años" → ['38', 'años'] para mostrar el número grande y la unidad chica
function splitVal(t) {
  const m = /^([^\d]*[\d.,]+)\s*(.*)$/.exec(t || '')
  return m ? [m[1], m[2]] : [t, '']
}
function cardStyle(pos) {
  if (dragPos.value === pos) {
    const t = horizontal.value ? `translateX(${dragDelta.value}px)` : `translateY(${dragDelta.value}px)`
    return { transform: `${t} scale(1.04)`, zIndex: 5, transition: 'none' }
  }
  const s = shiftFor.value[pos]
  if (s) return { transform: horizontal.value ? `translateX(${s}px)` : `translateY(${s}px)` }
  return null
}

// ── Reveal ──
const revealed = ref({})   // idx → true (ya mostró su dato)
const verdict = ref({})    // idx → 'ok' | 'bad'
const offBy = ref({})      // idx → puestos corridos
const counters = ref({})   // idx → valor mostrado (cuenta)
const travelling = ref(false)
const settled = ref(false) // ya viajaron a su lugar
let timers = []
function T(fn, ms) { timers.push(setTimeout(fn, reducedMotion ? 0 : ms)) }
onBeforeUnmount(() => timers.forEach(clearTimeout))

function countUp(idx, target, ms = 380) {
  if (reducedMotion) { counters.value = { ...counters.value, [idx]: target }; return }
  const t0 = performance.now()
  const step = (t) => {
    const k = Math.min(1, (t - t0) / ms)
    counters.value = { ...counters.value, [idx]: target * (1 - Math.pow(1 - k, 3)) }
    if (k < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

function runReveal(res) {
  timers.forEach(clearTimeout); timers = []
  revealed.value = {}; verdict.value = {}; offBy.value = {}; counters.value = {}; settled.value = false
  const order = [...props.order]
  const desired = res.desiredOrder || []
  // posición correcta de cada item (con empates: el puesto que el juego marcó como correcto)
  const correctPos = {}
  desired.forEach((idx, p) => { correctPos[idx] = p })
  order.forEach((idx, p) => { if (res.correctness?.[p]) correctPos[idx] = p })
  if (props.instant) {
    order.forEach((idx, p) => {
      revealed.value[idx] = true
      verdict.value[idx] = res.correctness?.[p] ? 'ok' : 'bad'
      counters.value[idx] = values.value[idx]
      if (!res.correctness?.[p]) offBy.value[idx] = Math.abs(p - (correctPos[idx] ?? p))
    })
    return
  }
  // De atrás para adelante: el último puesto primero, la tensión sube hasta el 1°
  const seq = order.map((idx, p) => ({ idx, p })).reverse()
  let t = 250
  seq.forEach(({ idx, p }, k) => {
    T(() => {
      revealed.value = { ...revealed.value, [idx]: true }
      countUp(idx, values.value[idx])
      soundManager.play('tick')
    }, t)
    T(() => {
      const ok = !!res.correctness?.[p]
      verdict.value = { ...verdict.value, [idx]: ok ? 'ok' : 'bad' }
      soundManager.play(ok ? 'correct' : 'incorrect')
      const el = cardEls.value[idx]
      if (ok && el) { const c = center(el); sparks(c.x, c.y, 8, ['#4ade80', '#fff'], 40) }
    }, t + 420)
    t += k === seq.length - 1 ? 700 : 560 // el primer puesto se hace esperar
  })
  const wrong = order.filter((idx, p) => !res.correctness?.[p])
  if (wrong.length) {
    // El error enseña: las mal puestas viajan a su lugar y dicen cuántos puestos estaban corridas
    T(() => {
      const off = {}
      order.forEach((idx, p) => { if (!res.correctness?.[p]) off[idx] = Math.abs(p - (correctPos[idx] ?? p)) })
      offBy.value = off
      travelling.value = true
      const finalOrder = [...order]
      for (const idx of order) finalOrder[correctPos[idx] ?? order.indexOf(idx)] = idx
      // si hubo empates raros y quedó un hueco, respetar el orden deseado
      shown.value = finalOrder.every(x => x != null) && new Set(finalOrder).size === order.length ? finalOrder : [...desired]
      soundManager.play('swoosh')
    }, t + 300)
    T(() => { settled.value = true; emit('done') }, t + 1300)
  } else {
    T(() => { settled.value = true; soundManager.play('win'); emit('done') }, t + 500)
  }
}
watch(() => props.result, (r) => { if (r) nextTick(() => runReveal(r)) }, { immediate: true })
// Nueva ronda: limpiar
watch(() => props.items, () => {
  timers.forEach(clearTimeout); timers = []
  revealed.value = {}; verdict.value = {}; offBy.value = {}; counters.value = {}
  travelling.value = false; settled.value = false; picked.value = null
  shown.value = [...props.order]
})

function valueText(idx) {
  const v = counters.value[idx]
  if (v == null) return ''
  return props.format(Math.abs(values.value[idx] - v) < 0.001 ? values.value[idx] : Math.round(v))
}
function posOf(idx) { return shown.value.indexOf(idx) }

// Línea de tiempo: diferencia entre extremos (dato curioso)
const spread = computed(() => vMax.value - vMin.value)
</script>

<template>
  <div class="olad" :class="[`v-${variant}`, { horiz: horizontal, 'is-locked': locked || !!result, 'is-dragging': dragPos != null }]" :style="{ '--n': n }">
    <div class="olad-ends" aria-hidden="true"><span>{{ startLabel }}</span><span>{{ endLabel }}</span></div>

    <div ref="boardEl" class="olad-board" role="listbox" :aria-label="`${startLabel} a ${endLabel}`">
      <!-- regla de la foto de equipo -->
      <div v-if="variant === 'team'" class="olad-ruler" aria-hidden="true"><i v-for="k in 8" :key="k"></i></div>

      <TransitionGroup name="olad" tag="div" class="olad-list">
        <div
          v-for="(idx, pos) in shown" :key="items[idx]?.id ?? idx"
          :ref="el => { if (el) cardEls[idx] = el }"
          class="olad-card"
          :class="[verdict[idx] ? 'is-' + verdict[idx] : '', { 'is-picked': picked === pos, 'is-drag': dragPos === pos, 'is-rev': revealed[idx] }]"
          :style="[cardStyle(pos), variant === 'stairs' ? { '--step': pos } : null]"
          role="option" :aria-selected="picked === pos" tabindex="0"
          :aria-label="`${pos + 1}. ${items[idx]?.name}${revealed[idx] ? ', ' + format(values[idx]) : ''}`"
          @pointerdown="onPointerDown($event, pos)"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp($event, pos)"
          @pointercancel="onPointerUp($event, pos)"
          @keydown="onKey($event, pos)"
        >
          <!-- ESCALERA -->
          <template v-if="variant === 'stairs'">
            <span class="rk">{{ rankAt(pos) }}</span>
            <img :src="items[idx]?.image" :alt="''" class="ph" draggable="false" />
            <span class="nm">{{ items[idx]?.name }}</span>
            <b class="val">{{ revealed[idx] ? valueText(idx) : '' }}</b>
            <i class="bar" aria-hidden="true" :style="{ width: revealed[idx] ? (8 + norm(values[idx]) * 92) + '%' : '0%' }"></i>
          </template>

          <!-- FOTO DE EQUIPO -->
          <template v-else-if="variant === 'team'">
            <span class="fig" :style="{ '--h': revealed[idx] ? (0.55 + norm(values[idx]) * 0.45) : 0.72 }">
              <img :src="items[idx]?.image" :alt="''" class="head" draggable="false" />
              <i class="body"></i>
              <i v-if="revealed[idx]" class="mark" aria-hidden="true"></i>
            </span>
            <span class="nm">{{ items[idx]?.name }}</span>
            <b class="val"><template v-if="revealed[idx]">{{ splitVal(valueText(idx))[0] }}<small>{{ splitVal(valueText(idx))[1] }}</small></template><template v-else>?</template></b>
          </template>

          <!-- LÍNEA DE TIEMPO -->
          <template v-else>
            <img :src="items[idx]?.image" :alt="''" class="ph" draggable="false" />
            <span class="nm">{{ items[idx]?.name }}</span>
            <b class="val"><template v-if="revealed[idx]">{{ splitVal(valueText(idx))[0] }}<small>{{ splitVal(valueText(idx))[1] }}</small></template><template v-else>?</template></b>
          </template>

          <span v-if="offBy[idx] && settled" class="off" :title="`Estaba ${offBy[idx]} ${offBy[idx] === 1 ? 'puesto' : 'puestos'} corrida`">↕ {{ offBy[idx] }}</span>
          <span v-if="verdict[idx]" class="tick" aria-hidden="true">{{ verdict[idx] === 'ok' ? '✓' : '✕' }}</span>
        </div>
      </TransitionGroup>

      <!-- eje de la línea de tiempo con los pines -->
      <div v-if="variant === 'timeline'" class="olad-axis" aria-hidden="true">
        <i class="line"></i>
        <span v-for="idx in shown" :key="'pin' + idx" class="pin" :class="[{ in: revealed[idx] }, verdict[idx] ? 'is-' + verdict[idx] : '']" :style="{ left: (4 + (1 - norm(values[idx])) * 92) + '%' }">
          <img :src="items[idx]?.image" alt="" />
        </span>
      </div>
    </div>

    <p v-if="variant === 'timeline' && settled && spread > 0" class="olad-fact">Entre el más veterano y el más joven hay <b>{{ format(spread) }}</b> de diferencia.</p>
    <p v-else-if="!result && !locked" class="olad-hint">Arrastrá una carta, o tocá dos para cambiarlas.</p>
  </div>
</template>

<style scoped>
.olad { display: grid; gap: 10px; user-select: none; -webkit-user-select: none; }
.olad-ends { display: flex; justify-content: space-between; font-family: var(--font-bug); font-weight: 800; text-transform: uppercase; letter-spacing: .1em; font-size: 12px; color: #8b93b8; padding: 0 4px; }
.olad-board { position: relative; }
.olad-list { display: flex; flex-direction: column; gap: 8px; }
.horiz .olad-list { flex-direction: row; gap: clamp(4px, 1.4vw, 10px); }
.olad-card { position: relative; touch-action: none; cursor: grab; outline: none; transition: transform .22s cubic-bezier(.2, .8, .2, 1), box-shadow .2s, border-color .2s, background .2s; }
.is-locked .olad-card { cursor: default; }
.is-dragging .olad-card.is-drag { cursor: grabbing; box-shadow: 0 16px 34px rgba(0, 0, 0, .55), 0 0 0 2px #fcd34d; }
.olad-card:focus-visible { box-shadow: 0 0 0 2px #fcd34d; }
.olad-card.is-picked { box-shadow: 0 0 0 2px #38bdf8, 0 0 18px rgba(56, 189, 248, .45); }
.olad-move { transition: transform .55s cubic-bezier(.34, 1.25, .64, 1); }
.olad-card .tick { position: absolute; top: -7px; right: -7px; width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; font-weight: 900; font-size: 12px; animation: olad-pop .35s cubic-bezier(.34, 1.56, .64, 1) both; }
.olad-card.is-ok .tick { background: #4ade80; color: #052e16; }
.olad-card.is-bad .tick { background: #ef4444; color: #fff; }
.olad-card.is-bad { animation: olad-shake .4s ease; }
.olad-card .off { position: absolute; bottom: -8px; left: 50%; transform: translateX(-50%); z-index: 2; white-space: nowrap; font-family: var(--font-bug); font-weight: 800; font-size: 12px; letter-spacing: .04em; padding: 2px 8px; border-radius: 999px; background: #0b1024; color: #fca5a5; border: 1px solid rgba(239, 68, 68, .5); animation: olad-pop .35s cubic-bezier(.34, 1.56, .64, 1) both; }
@keyframes olad-pop { from { transform: translateX(var(--tx, 0)) scale(.3); opacity: 0; } to { transform: translateX(var(--tx, 0)) scale(1); opacity: 1; } }
.olad-card .off { --tx: -50%; }
@keyframes olad-shake { 20%, 60% { translate: -4px 0; } 40%, 80% { translate: 4px 0; } }

/* ── ESCALERA ── */
.v-stairs .olad-card { display: flex; align-items: center; gap: 10px; min-height: 52px; padding: 7px 12px 7px 8px; border-radius: 12px; border: 1.5px solid rgba(255, 255, 255, .12); background: linear-gradient(90deg, #141a38, #0f1430);
  margin-left: calc(var(--step, 0) * clamp(4px, 1.6vw, 12px)); }
.v-stairs .olad-card .rk { flex: none; width: 30px; height: 30px; border-radius: 8px; display: grid; place-items: center; font-family: var(--font-bug); font-weight: 800; font-size: 16px; background: rgba(252, 211, 77, .14); color: #fcd34d; }
.v-stairs .olad-card .ph { flex: none; width: 40px; height: 40px; border-radius: 50%; object-fit: cover; box-shadow: 0 0 0 2px rgba(255, 255, 255, .15); pointer-events: none; }
.v-stairs .olad-card .nm { flex: 1; min-width: 0; font-weight: 600; font-size: 14px; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.v-stairs .olad-card { overflow: visible; }
.v-stairs .olad-card .val { flex: none; min-width: 64px; text-align: right; font-family: var(--font-bug); font-weight: 800; font-size: 17px; color: #fde68a; font-variant-numeric: tabular-nums; }
.v-stairs .olad-card .bar { position: absolute; left: 10px; bottom: 4px; height: 3px; max-width: calc(100% - 20px); border-radius: 3px; background: linear-gradient(90deg, #b45309, #fcd34d); transition: width .6s cubic-bezier(.16, 1, .3, 1); }
.v-stairs .olad-card.is-ok { border-color: #4ade80; background: linear-gradient(90deg, rgba(74, 222, 128, .14), #0f1430); }
.v-stairs .olad-card.is-bad { border-color: #ef4444; background: linear-gradient(90deg, rgba(239, 68, 68, .14), #0f1430); }
@media (max-width: 420px) { .v-stairs .olad-card { min-height: 48px; gap: 8px; } .v-stairs .olad-card .ph { width: 34px; height: 34px; } .v-stairs .olad-card .nm { font-size: 13px; } }

/* ── FOTO DE EQUIPO ── */
.v-team .olad-board { padding-left: 22px; background: linear-gradient(180deg, rgba(16, 185, 129, .08), rgba(16, 185, 129, .02)); border-radius: 14px; padding-top: 10px; padding-bottom: 6px; }
.olad-ruler { position: absolute; left: 6px; top: 10px; bottom: 58px; width: 10px; display: flex; flex-direction: column; justify-content: space-between; border-right: 2px solid rgba(94, 234, 212, .5); }
.olad-ruler i { display: block; height: 2px; background: rgba(94, 234, 212, .5); }
.olad-ruler i:nth-child(odd) { width: 60%; margin-left: 40%; }
.v-team .olad-list { align-items: flex-end; min-height: calc(clamp(150px, 34vw, 220px) + 64px); }
.v-team .olad-card { flex: 1 1 0; min-width: 0; display: grid; justify-items: center; gap: 4px; padding: 4px 2px 6px; border-radius: 12px; border: 1.5px solid transparent; }
.v-team .olad-card.is-picked, .v-team .olad-card:focus-visible { border-color: #38bdf8; }
.v-team .fig { --h: .72; position: relative; width: min(100%, 64px); height: calc(clamp(150px, 34vw, 220px) * var(--h)); display: flex; flex-direction: column; align-items: center; transition: height .7s cubic-bezier(.34, 1.3, .64, 1); }
.v-team .fig .head { flex: none; width: 70%; aspect-ratio: 1; border-radius: 50%; object-fit: cover; box-shadow: 0 0 0 2px rgba(255, 255, 255, .25); pointer-events: none; }
.v-team .fig .body { flex: 1; width: 62%; margin-top: 3px; border-radius: 12px 12px 4px 4px; background: linear-gradient(180deg, #2dd4bf, #0f766e); }
.v-team .fig .mark { position: absolute; top: -3px; left: -14%; right: -14%; border-top: 2px dashed rgba(252, 211, 77, .7); }
.v-team .olad-card.is-ok .fig .body { background: linear-gradient(180deg, #4ade80, #15803d); }
.v-team .olad-card.is-bad .fig .body { background: linear-gradient(180deg, #f87171, #991b1b); }
.v-team .nm, .v-timeline .nm { width: 100%; text-align: center; font-size: 11px; font-weight: 600; color: #e2e8f0; line-height: 1.15; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; min-height: 2.3em; }
.v-team .val, .v-timeline .val { display: grid; justify-items: center; min-height: 2.1em; line-height: 1; font-family: var(--font-bug); font-weight: 800; font-size: 17px; color: #fde68a; font-variant-numeric: tabular-nums; }
.v-team .val small, .v-timeline .val small { font-size: 10px; letter-spacing: .08em; text-transform: uppercase; color: #c9a94a; margin-top: 2px; }
.horiz .olad-card .off { top: -8px; bottom: auto; left: -6px; --tx: 0; }

/* ── LÍNEA DE TIEMPO ── */
.v-timeline .olad-card { flex: 1 1 0; min-width: 0; display: grid; justify-items: center; gap: 4px; padding: 8px 4px; border-radius: 12px; border: 1.5px solid rgba(255, 255, 255, .12); background: #141a38; }
.v-timeline .olad-card .ph { width: min(100%, 52px); aspect-ratio: 1; border-radius: 50%; object-fit: cover; box-shadow: 0 0 0 2px rgba(255, 255, 255, .15); pointer-events: none; }
.v-timeline .olad-card.is-ok { border-color: #4ade80; }
.v-timeline .olad-card.is-bad { border-color: #ef4444; }
.olad-axis { position: relative; height: 54px; margin-top: 12px; }
.olad-axis .line { position: absolute; left: 0; right: 0; top: 34px; height: 3px; border-radius: 3px; background: linear-gradient(90deg, #fda4af, #fb7185); }
.olad-axis .pin { position: absolute; top: 0; width: 28px; margin-left: -14px; display: grid; justify-items: center; opacity: 0; transform: translateY(-18px); transition: opacity .3s, transform .45s cubic-bezier(.34, 1.56, .64, 1), left .5s; }
.olad-axis .pin.in { opacity: 1; transform: none; }
.olad-axis .pin img { width: 24px; height: 24px; border-radius: 50%; object-fit: cover; border: 2px solid #fff; }
.olad-axis .pin::after { content: ""; width: 2px; height: 12px; background: #fff; }
.olad-axis .pin.is-ok img { border-color: #4ade80; } .olad-axis .pin.is-bad img { border-color: #ef4444; }
.olad-fact { margin: 0; text-align: center; font-size: 13px; color: #c5cbe8; animation: olad-in .4s ease both; }
.olad-fact b { color: #fcd34d; }
@keyframes olad-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
.olad-hint { margin: 0; text-align: center; font-size: 12px; color: #5b6388; }

@media (prefers-reduced-motion: reduce) {
  .olad-card, .olad-move, .v-team .fig, .olad-axis .pin { transition: none !important; }
  .olad-card .tick, .olad-card .off, .olad-card.is-bad { animation: none !important; }
}
</style>
