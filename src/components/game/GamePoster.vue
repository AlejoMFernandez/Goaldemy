<script setup>
/**
 * GamePoster — portada de juego tipo PÓSTER (Moodboard 07).
 *
 * Ilustración limpia con el color de identidad del juego y una cinta por tipo
 * (Contrarreloj, Ordenar, Vidas…). El nombre va en el pie, nunca encima del
 * dibujo. Cada ilustración tiene un movimiento corto que explica el juego y
 * que solo corre al pasar el mouse / enfocar (en celular, una vez al aparecer).
 *
 * Estados: '' · 'win' · 'loss' · 'locked'. En win/loss el pie muestra la ficha
 * del partido de hoy (✓ 10/10 ★★★ / ✕ 6/10 · revancha) sin tapar el arte.
 */
import { computed, ref, onMounted, onBeforeUnmount, useId } from 'vue'
import { GAME_ART, GAME_POSTER_META, POSTER_RIBBONS } from '@/services/game-art'

const props = defineProps({
  slug: { type: String, required: true },
  name: { type: String, default: '' },
  sub: { type: String, default: '' },
  state: { type: String, default: '' },        // '' | 'win' | 'loss' | 'locked'
  score: { type: String, default: '' },        // "10/10", "0:48", "2 ❤"
  stars: { type: Number, default: 0 },         // 0..3 (precisión)
  streak: { type: Number, default: 0 },
  revenge: { type: String, default: '' },      // "revancha en 7 h"
  lockLevel: { type: [Number, String], default: null },
  missLevels: { type: Number, default: 0 },
  lockPct: { type: Number, default: 0 },
  play: { type: Boolean, default: false },     // forzar animación
  showRibbon: { type: Boolean, default: false }, // cinta por tipo (oculta por ahora, pedido de Alejo)
})

const meta = computed(() => GAME_POSTER_META[props.slug] || { c1: '#475569', c2: '#0f172a', type: '', sub: '' })
const ribbon = computed(() => POSTER_RIBBONS[meta.value.type] || null)
const uid = 'gp' + useId().replace(/[^a-zA-Z0-9_-]/g, '')
// ids únicos por instancia (clipPath) para que dos pósters del mismo juego no se pisen
const art = computed(() => (GAME_ART[props.slug] || '').replace(/id="(cp[a-z])"/g, `id="${uid}$1"`).replace(/url\(#(cp[a-z])\)/g, `url(#${uid}$1)`))
const starsText = computed(() => props.stars > 0 ? '★'.repeat(props.stars) + '☆'.repeat(Math.max(0, 3 - props.stars)) : '')

// En pantallas táctiles no hay hover: se anima una vez al aparecer
const root = ref(null)
const autoPlay = ref(false)
let io = null
onMounted(() => {
  if (typeof window === 'undefined' || !window.matchMedia?.('(hover: none)').matches || !('IntersectionObserver' in window)) return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        autoPlay.value = true
        setTimeout(() => { autoPlay.value = false }, 3200)
        io.disconnect(); io = null
      }
    }
  }, { threshold: 0.6 })
  io.observe(root.value)
})
onBeforeUnmount(() => io?.disconnect())
</script>

<template>
  <div
    ref="root"
    class="gposter"
    :class="[state ? 'is-' + state : '', { play: play || autoPlay, hasb: streak > 0 || state === 'loss' }]"
    :style="{ '--c1': meta.c1, '--c2': meta.c2 }"
  >
    <span class="gp-pa">
      <span class="gp-artw" v-html="art"></span>
      <span v-if="ribbon && showRibbon" class="gp-rib" :style="{ '--rc': ribbon.color }"><span class="gp-ri" v-html="ribbon.icon"></span><span class="tx">{{ ribbon.label }}</span></span>
      <span v-if="streak > 0 && state !== 'loss' && state !== 'locked'" class="gp-strk" :title="`Racha ×${streak}`">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67z"/></svg>{{ streak }}
      </span>
      <!-- Ya jugado hoy: el arte se desenfoca y aparece un sello grande ✓ / ✕ -->
      <span v-if="state === 'win' || state === 'loss'" class="gp-stamp" :aria-label="state === 'win' ? 'Ganado hoy' : 'Perdido hoy'">
        <span class="mark">
          <svg v-if="state === 'win'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" /></svg>
        </span>
        <span class="sc">{{ score }}</span>
        <span v-if="state === 'win' && starsText" class="st">{{ starsText }}</span>
      </span>
      <span v-if="state === 'locked'" class="gp-lock">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
        <span class="lv">NV {{ lockLevel }}</span>
      </span>
    </span>
    <span class="gp-pf">
      <span class="gp-nm">{{ name }}</span>
      <template v-if="state === 'win' || state === 'loss'">
        <span class="gp-res">
          <template v-if="state === 'win'">Ganado hoy</template>
          <template v-else>Perdido<span v-if="revenge" class="rv"> · {{ revenge }}</span></template>
        </span>
      </template>
      <template v-else-if="state === 'locked'">
        <span class="gp-sub">Te faltan {{ missLevels }} {{ missLevels === 1 ? 'nivel' : 'niveles' }}</span>
        <span class="gp-lbar"><i :style="{ width: Math.max(4, Math.min(100, lockPct)) + '%' }"></i></span>
      </template>
      <span v-else class="gp-sub">{{ sub || meta.sub }}</span>
    </span>
  </div>
</template>

<style>
/* No scoped: el arte entra por v-html y tiene que recibir estas reglas. Todo cuelga de .gposter. */
.gposter { --c1: #10b981; --c2: #064e3b; position: relative; display: flex; flex-direction: column; aspect-ratio: 4 / 5; width: 100%; border-radius: 14px; overflow: hidden; isolation: isolate; container-type: inline-size; color: #fff; text-align: left; background: #0b1024;
  box-shadow: 0 10px 26px rgba(0, 0, 0, .45), inset 0 0 0 1px rgba(255, 255, 255, .1); transition: transform .25s cubic-bezier(.34, 1.56, .64, 1), box-shadow .25s; }
.gposter .gp-pa { position: relative; flex: 1; min-height: 0; overflow: hidden; display: grid; place-items: center;
  background: radial-gradient(80% 70% at 50% 42%, color-mix(in srgb, var(--c1) 50%, transparent) 0%, transparent 72%), linear-gradient(165deg, color-mix(in srgb, var(--c1) 70%, #000) 0%, var(--c2) 75%, #050716 100%); }
.gposter .gp-pa::before { content: ""; position: absolute; inset: 0; background: repeating-linear-gradient(115deg, rgba(255, 255, 255, .045) 0 9px, transparent 9px 22px); mask: linear-gradient(180deg, #000, transparent 85%); -webkit-mask: linear-gradient(180deg, #000, transparent 85%); }
.gposter .gp-pa::after { content: ""; position: absolute; left: -30%; top: -10%; width: 40%; height: 130%; background: linear-gradient(90deg, transparent, rgba(255, 255, 255, .2), transparent); transform: translateX(-120%) rotate(12deg); pointer-events: none; }
a:hover > .gposter, a:focus-visible > .gposter, .gposter:hover, .gposter.play { transform: translateY(-4px); box-shadow: 0 16px 34px rgba(0, 0, 0, .55), 0 0 0 2px color-mix(in srgb, var(--c1) 70%, #fff), 0 0 26px color-mix(in srgb, var(--c1) 40%, transparent); }
.gposter:hover .gp-pa::after, .gposter.play .gp-pa::after { animation: gp-shine 1.1s ease forwards; }
@keyframes gp-shine { to { transform: translateX(420%) rotate(12deg); } }
.gposter .gp-artw { position: relative; width: 94%; margin-top: 6%; display: block; }
.gposter .gp-art { width: 100%; height: auto; display: block; }
.gposter .gp-rib { position: absolute; left: 0; top: 8%; z-index: 2; display: flex; align-items: center; gap: .35em; padding: .3em .65em .3em .55em; font-family: var(--font-bug); font-weight: 800; text-transform: uppercase; letter-spacing: .06em; font-size: max(10px, 6cqw); line-height: 1; border-radius: 0 6px 6px 0; background: var(--rc); color: #141005; box-shadow: 0 4px 10px rgba(0, 0, 0, .3); }
.gposter .gp-ri { display: inline-flex; width: 1.1em; height: 1.1em; }
.gposter .gp-ri svg { width: 100%; height: 100%; }
@container (max-width: 200px) { .gposter.hasb .gp-rib .tx { display: none; } }
.gposter .gp-strk { position: absolute; right: 6%; top: 7%; z-index: 2; display: flex; align-items: center; gap: 2px; padding: .2em .5em; border-radius: 999px; background: rgba(8, 10, 25, .8); border: 1.5px solid #fbbf24; color: #fcd34d; font-family: var(--font-bug); font-weight: 800; font-size: max(11px, 6.6cqw); line-height: 1; }
.gposter .gp-strk svg { width: .95em; height: .95em; }
.gposter .gp-pf { position: relative; flex: none; padding: .55em .7em .6em; border-top: 2px solid var(--c1); background: linear-gradient(180deg, #10163a, #0b1024); display: grid; gap: 1px; font-size: max(12px, 7.2cqw); }
.gposter .gp-nm { font-family: var(--font-bug); font-weight: 800; text-transform: uppercase; letter-spacing: .02em; font-size: 1.1em; line-height: 1.05; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-wrap: balance; }
.gposter .gp-sub { font-size: .72em; color: #8b93b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.3; }
.gposter .gp-res { display: flex; align-items: center; gap: .4em; font-family: var(--font-bug); font-weight: 800; text-transform: uppercase; font-size: .95em; line-height: 1.3; font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; }
.gposter .gp-res b { display: inline-grid; place-items: center; width: 1.25em; height: 1.25em; border-radius: 4px; font-size: .9em; }
.gposter .gp-res .st { color: #fcd34d; letter-spacing: -.04em; }
.gposter .gp-res .rv { color: #fca5a5; font-weight: 700; font-size: .9em; overflow: hidden; text-overflow: ellipsis; }
.gposter.is-win .gp-res b { background: #4ade80; color: #052e16; }
.gposter.is-loss .gp-res b { background: #ef4444; color: #fff; }
.gposter.is-win .gp-pf { border-top-color: #4ade80; }
.gposter.is-loss .gp-pf { border-top-color: #ef4444; }
.gposter.is-loss .gp-art { filter: grayscale(.6) brightness(.7); }
/* Sello de jugado: arte desenfocado y oscurecido + ✓ verde / ✕ rojo grande */
.gposter.is-win .gp-artw, .gposter.is-loss .gp-artw { filter: blur(3px) brightness(.55) saturate(.8); transform: scale(1.04); }
.gposter.is-loss .gp-artw { filter: blur(3px) brightness(.45) grayscale(.85); }
.gposter.is-win .gp-pa, .gposter.is-loss .gp-pa { background-blend-mode: normal; }
.gposter .gp-stamp { position: absolute; inset: 0; z-index: 3; display: grid; place-items: center; align-content: center; gap: .25em; font-family: var(--font-bug); font-weight: 800; }
.gposter .gp-stamp .mark { width: 42%; aspect-ratio: 1; border-radius: 50%; display: grid; place-items: center; border: 4px solid rgba(255, 255, 255, .9); animation: gp-stamp .5s cubic-bezier(.34, 1.56, .64, 1) both; }
.gposter .gp-stamp .mark svg { width: 62%; height: 62%; }
.gposter.is-win .gp-stamp .mark { background: #22c55e; color: #fff; box-shadow: 0 8px 22px rgba(0, 0, 0, .45), 0 0 26px rgba(74, 222, 128, .55); }
.gposter.is-loss .gp-stamp .mark { background: #dc2626; color: #fff; box-shadow: 0 8px 22px rgba(0, 0, 0, .45), 0 0 22px rgba(239, 68, 68, .45); }
.gposter .gp-stamp .sc { font-size: max(15px, 11cqw); line-height: 1; color: #fff; text-shadow: 0 2px 6px rgba(0, 0, 0, .7); font-variant-numeric: tabular-nums; }
.gposter .gp-stamp .st { font-size: max(12px, 8cqw); line-height: 1; color: #fcd34d; letter-spacing: -.02em; text-shadow: 0 2px 6px rgba(0, 0, 0, .7); }
@keyframes gp-stamp { from { transform: scale(1.8) rotate(-12deg); opacity: 0; } to { transform: none; opacity: 1; } }
.gposter.is-win .gp-res { color: #86efac; }
.gposter.is-loss .gp-res { color: #fca5a5; }
.gposter.is-locked .gp-pa { filter: saturate(.2) brightness(.65); }
.gposter.is-locked .gp-art { filter: brightness(0) opacity(.5); }
.gposter .gp-lock { position: absolute; inset: 0; display: grid; place-items: center; align-content: center; gap: 4px; z-index: 3; font-family: var(--font-bug); font-weight: 800; text-transform: uppercase; }
.gposter .gp-lock .lv { font-size: max(20px, 13cqw); line-height: 1; }
.gposter .gp-lbar { height: 5px; border-radius: 5px; background: rgba(255, 255, 255, .12); overflow: hidden; margin-top: 3px; }
.gposter .gp-lbar i { display: block; height: 100%; background: #fcd34d; }
a:hover > .gposter.is-locked, .gposter.is-locked:hover { transform: none; box-shadow: 0 10px 26px rgba(0, 0, 0, .45); }

/* ── animaciones de cada ilustración (solo en hover / .play) ── */
.gposter .an{transform-box:fill-box; transform-origin:center}
.gposter:is(:hover,.play) .a-blur{animation:gp-a-blur 2.6s ease-in-out infinite}
@keyframes gp-a-blur{0%{filter:blur(7px)}55%,85%{filter:blur(0)}100%{filter:blur(7px)}}
.gposter .a-blur{filter:blur(5px)}
.gposter:is(:hover,.play) .a-q{animation:gp-a-q 1.3s ease-in-out infinite}
@keyframes gp-a-q{0%,100%{transform:rotate(-8deg) scale(1)}50%{transform:rotate(8deg) scale(1.12)}}
.gposter:is(:hover,.play) .a-x2{animation:gp-a-x2 2.6s ease-in-out infinite}
@keyframes gp-a-x2{0%,20%{opacity:1; transform:scale(1)}30%{transform:scale(1.2)}55%,100%{opacity:.35; transform:scale(.9)}}
.gposter:is(:hover,.play) .a-mer{animation:gp-a-mer 2.4s linear infinite}
.gposter:is(:hover,.play) .a-mer.d2{animation-delay:-.8s} .gposter:is(:hover,.play) .a-mer.d3{animation-delay:-1.6s}
@keyframes gp-a-mer{0%{transform:scaleX(1)}50%{transform:scaleX(.05)}100%{transform:scaleX(1)}}
.gposter:is(:hover,.play) .a-pin{animation:gp-a-pin 1.8s cubic-bezier(.34,1.56,.64,1) infinite}
.gposter:is(:hover,.play) .a-pin.d2{animation-delay:.3s} .gposter:is(:hover,.play) .a-pin.d3{animation-delay:.6s}
@keyframes gp-a-pin{0%{transform:translateY(-14px) scale(.4); opacity:0}25%,80%{transform:none; opacity:1}100%{opacity:0}}
.gposter:is(:hover,.play) .a-run{animation:gp-a-run 3s cubic-bezier(.65,0,.35,1) infinite}
@keyframes gp-a-run{0%,12%{transform:translate(0,0)}33%,45%{transform:translate(-44px,22px)}66%,78%{transform:translate(38px,28px)}100%{transform:translate(0,0)}}
.gposter:is(:hover,.play) .a-zone{animation:gp-a-zone 3s ease infinite}
@keyframes gp-a-zone{0%,12%{opacity:.9}20%,90%{opacity:.25}100%{opacity:.9}}
.gposter:is(:hover,.play) .a-odo{animation:gp-a-odo 3.2s cubic-bezier(.7,0,.3,1) infinite}
@keyframes gp-a-odo{0%,20%{transform:translateY(0)}33%,53%{transform:translateY(-44px)}66%,86%{transform:translateY(-88px)}100%{transform:translateY(-132px)}}
.gposter:is(:hover,.play) .a-shirt{animation:gp-a-shirt 1.6s ease-in-out infinite}
@keyframes gp-a-shirt{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(2deg)}}
.gposter:is(:hover,.play) .a-c1{animation:gp-a-c1 3s cubic-bezier(.65,0,.35,1) infinite}
.gposter:is(:hover,.play) .a-c2{animation:gp-a-c2 3s cubic-bezier(.65,0,.35,1) infinite}
.gposter:is(:hover,.play) .a-c3{animation:gp-a-c3 3s cubic-bezier(.65,0,.35,1) infinite}
@keyframes gp-a-c1{0%,15%{transform:translate(0,0)}40%,85%{transform:translate(0,0)}100%{transform:translate(0,0)}}
@keyframes gp-a-c2{0%,15%{transform:translate(0,0)}28%{transform:translate(28px,-26px)}40%,85%{transform:translate(56px,0)}100%{transform:translate(0,0)}}
@keyframes gp-a-c3{0%,15%{transform:translate(0,0)}28%{transform:translate(-28px,26px)}40%,85%{transform:translate(-56px,0)}100%{transform:translate(0,0)}}
.gposter:is(:hover,.play) .a-ok{animation:gp-a-ok 3s ease infinite}
@keyframes gp-a-ok{0%,40%{opacity:0; transform:scale(.3)}48%,85%{opacity:1; transform:scale(1)}100%{opacity:0}}
.gposter .a-ok{opacity:0}
.gposter .a-bar{transform-box:fill-box; transform-origin:50% 100%}
.gposter:is(:hover,.play) .a-bar{animation:gp-a-bar 2.6s cubic-bezier(.34,1.3,.64,1) infinite}
.gposter:is(:hover,.play) .a-bar.d2{animation-delay:.12s} .gposter:is(:hover,.play) .a-bar.d3{animation-delay:.24s} .gposter:is(:hover,.play) .a-bar.d4{animation-delay:.36s}
@keyframes gp-a-bar{0%{transform:scaleY(.08)}35%,85%{transform:scaleY(1)}100%{transform:scaleY(.08)}}
.gposter:is(:hover,.play) .a-coin{animation:gp-a-coin 2.6s ease-in infinite}
.gposter:is(:hover,.play) .a-coin.d2{animation-delay:.5s}
@keyframes gp-a-coin{0%{transform:translateY(-40px); opacity:0}15%{opacity:1}45%,100%{transform:translateY(0); opacity:0}}
.gposter .a-coin{opacity:0}
.gposter .a-grow{transform-box:fill-box; transform-origin:50% 100%}
.gposter:is(:hover,.play) .a-grow{animation:gp-a-grow 2.8s cubic-bezier(.34,1.4,.64,1) infinite}
.gposter:is(:hover,.play) .a-grow.d2{animation-delay:.15s} .gposter:is(:hover,.play) .a-grow.d3{animation-delay:.3s}
@keyframes gp-a-grow{0%{transform:scaleY(.2)}35%,85%{transform:scaleY(1)}100%{transform:scaleY(.2)}}
.gposter:is(:hover,.play) .a-meas{animation:gp-a-meas 2.8s ease-in-out infinite}
@keyframes gp-a-meas{0%,20%{transform:translateY(60px); opacity:0}40%{opacity:1}75%{transform:translateY(0); opacity:1}100%{transform:translateY(0); opacity:0}}
.gposter:is(:hover,.play) .a-lens{animation:gp-a-lens 3s ease-in-out infinite}
@keyframes gp-a-lens{0%,100%{transform:translate(0,0)}25%{transform:translate(-40px,-22px)}50%{transform:translate(-10px,26px)}75%{transform:translate(20px,-10px)}}
.gposter:is(:hover,.play) .a-heart{animation:gp-a-heart 1.4s ease-in-out infinite}
@keyframes gp-a-heart{0%,100%{transform:scale(1)}15%{transform:scale(1.25)}30%{transform:scale(1)}}
.gposter:is(:hover,.play) .a-heart.d3{animation:gp-a-hlost 2.8s ease infinite}
@keyframes gp-a-hlost{0%,50%{opacity:1; transform:none}60%{transform:scale(1.4); opacity:.6}70%,100%{transform:scale(.6); opacity:.2}}


/* animaciones nuevas */
.gposter:is(:hover,.play) .a-radar{animation:gp-a-radar 2.8s cubic-bezier(.34,1.3,.64,1) infinite}
@keyframes gp-a-radar{0%{transform:scale(.15)}35%,85%{transform:scale(1)}100%{transform:scale(.15)}}
.gposter:is(:hover,.play) .a-vsL{animation:gp-a-vsL 2.4s ease-in-out infinite}
.gposter:is(:hover,.play) .a-vsR{animation:gp-a-vsR 2.4s ease-in-out infinite}
@keyframes gp-a-vsL{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@keyframes gp-a-vsR{0%,100%{transform:translateY(0)}50%{transform:translateY(8px)}}
.gposter:is(:hover,.play) .a-up{animation:gp-a-up 1.2s ease-in-out infinite}
@keyframes gp-a-up{0%,100%{transform:translateY(2px)}50%{transform:translateY(-5px)}}
.gposter:is(:hover,.play) .a-link{animation:gp-a-link 2.4s ease infinite}
.gposter:is(:hover,.play) .a-link.d2{animation-delay:.3s} .gposter:is(:hover,.play) .a-link.d3{animation-delay:.6s}
@keyframes gp-a-link{0%{opacity:.25}20%,80%{opacity:1}100%{opacity:.25}}
.gposter .a-grp{opacity:0}
.gposter:is(:hover,.play) .a-grp{animation:gp-a-grp 3s cubic-bezier(.16,1,.3,1) infinite}
@keyframes gp-a-grp{0%,20%{opacity:0; transform:scaleX(.3)}35%,85%{opacity:1; transform:none}100%{opacity:0}}
.gposter:is(:hover,.play) .a-dotj{animation:gp-a-dotj 3s ease infinite}
@keyframes gp-a-dotj{0%,20%{opacity:1}30%,85%{opacity:0}100%{opacity:1}}
.gposter .a-cell{opacity:.15}
.gposter:is(:hover,.play) .a-cell{animation:gp-a-cell 3.2s ease infinite; animation-delay:calc(var(--i) * .22s)}
@keyframes gp-a-cell{0%{opacity:.15; transform:scale(.4)}12%,80%{opacity:1; transform:none}100%{opacity:.15}}
.gposter .a-tile{transform-box:fill-box; transform-origin:50% 50%}
.gposter:is(:hover,.play) .a-tile{animation:gp-a-tile 3.4s ease infinite; animation-delay:calc(var(--i) * .16s)}
@keyframes gp-a-tile{0%,4%{transform:scaleY(1); fill:#1e293b}9%{transform:scaleY(0)}14%,85%{transform:scaleY(1); fill:var(--tc)}100%{fill:#1e293b}}
.gposter .a-pl{opacity:.2}
.gposter:is(:hover,.play) .a-pl{animation:gp-a-pl 3.4s cubic-bezier(.34,1.56,.64,1) infinite; animation-delay:calc(var(--i) * .12s)}
@keyframes gp-a-pl{0%{opacity:.2; transform:scale(.3)}15%,85%{opacity:1; transform:none}100%{opacity:.2}}

@media (prefers-reduced-motion: reduce) {
  .gposter, .gposter *, .gposter .gp-pa::after { animation: none !important; transition: none !important; }
}
</style>
