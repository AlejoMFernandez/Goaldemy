<script setup>
/**
 * AppSplash — "Salir a la cancha" (Moodboard 06)
 *
 * Primera vez (≈2,2 s): se prenden los 4 reflectores de a uno, se traza el
 * círculo central, el escudo aparece adentro con un barrido de luz, la línea
 * de mitad de cancha se estira y las letras FULVO salen desde la profundidad.
 * Si ya entró antes (`quick`): la misma escena comprimida en ≈0,9 s.
 * Si la carga tarda (`slow`): aparece "Preparando la cancha" con una pelota.
 * La salida (empuje de cámara) la hace la <Transition name="splash-fade"> de App.vue.
 */
defineProps({
  quick: { type: Boolean, default: false },
  slow: { type: Boolean, default: false },
})
const letters = ['F', 'U', 'L', 'V', 'O']
</script>

<template>
  <div class="app-splash" :class="{ 'is-quick': quick }" role="status" aria-label="Fulvo">
    <!-- Reflectores: se prenden de a uno -->
    <i v-for="k in 4" :key="k" class="sp-light" :class="`l${k}`" :style="{ '--i': k - 1 }" aria-hidden="true"></i>
    <div class="sp-haze" aria-hidden="true"></div>

    <!-- Escudo con barrido de luz -->
    <div class="sp-crest">
      <img src="/iconclaro.png" alt="" draggable="false" />
      <i class="sp-sweep" aria-hidden="true"></i>
    </div>

    <!-- FULVO desde la profundidad -->
    <div class="sp-word" aria-hidden="true">
      <span v-for="(ch, i) in letters" :key="i" :style="{ '--i': i }">{{ ch }}</span>
    </div>

    <Transition name="sp-slow">
      <p v-if="slow" class="sp-loading"><i class="ball" aria-hidden="true"></i>Preparando la cancha</p>
    </Transition>
  </div>
</template>

<style scoped>
.app-splash {
  --t: 1;              /* escala de tiempos: 1 = primera vez, .4 = rápida */
  position: fixed; inset: 0; z-index: 9999;
  display: grid; place-items: center; overflow: hidden;
  background: radial-gradient(120% 90% at 50% 45%, #0e1a33 0%, #070b18 60%, #04060e 100%);
  isolation: isolate;
}
.app-splash.is-quick { --t: .4; }

/* ── Reflectores ── */
.sp-light {
  position: absolute; inset: 0; z-index: 0; pointer-events: none; opacity: 0;
  background: conic-gradient(from calc(var(--a) - 9deg) at var(--x) -3%, transparent 0deg, rgba(255, 248, 220, .34) 9deg, transparent 18deg, transparent 360deg);
  -webkit-mask: radial-gradient(130% 95% at var(--x) 0, #000 25%, transparent 85%); mask: radial-gradient(130% 95% at var(--x) 0, #000 25%, transparent 85%);
  filter: blur(3px); mix-blend-mode: screen;
  animation: sp-light-on calc(.5s * var(--t)) steps(1, end) calc((.1s + var(--i) * .16s) * var(--t)) forwards,
             sp-light-hum 3s ease-in-out calc(1.2s * var(--t)) infinite;
}
.sp-light.l1 { --x: 4%; --a: 146deg; }
.sp-light.l2 { --x: 30%; --a: 166deg; }
.sp-light.l3 { --x: 70%; --a: 194deg; }
.sp-light.l4 { --x: 96%; --a: 214deg; }
@media (orientation: portrait) {
  .sp-light.l1 { --a: 155deg; } .sp-light.l2 { --a: 168deg; } .sp-light.l3 { --a: 192deg; } .sp-light.l4 { --a: 205deg; }
}
@keyframes sp-light-on { 0% { opacity: 0; } 30% { opacity: 1; } 45% { opacity: .35; } 60%, 100% { opacity: .85; } }
@keyframes sp-light-hum { 50% { filter: blur(4px) brightness(1.2); } }
.sp-haze {
  position: absolute; inset: 0; z-index: 0; pointer-events: none;
  background: radial-gradient(45% 35% at 50% 52%, rgba(52, 211, 153, .18), transparent 70%);
  opacity: 0; animation: sp-fade calc(.8s * var(--t)) ease calc(.7s * var(--t)) forwards;
}

@keyframes sp-fade { to { opacity: 1; } }

/* ── Escudo ── */
.sp-crest { position: relative; z-index: 2; width: min(24vmin, 116px); aspect-ratio: 1; display: grid; place-items: center;
  opacity: 0; transform: scale(.7);
  animation: sp-crest-in calc(.6s * var(--t)) cubic-bezier(.34, 1.56, .64, 1) calc(.85s * var(--t)) forwards; }
.sp-crest img { width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 0 22px rgba(252, 211, 77, .35)); }
.sp-sweep { position: absolute; inset: 0; pointer-events: none;
  -webkit-mask: url(/iconclaro.png) center / contain no-repeat; mask: url(/iconclaro.png) center / contain no-repeat;
  background: linear-gradient(105deg, transparent 35%, rgba(255, 255, 255, .85) 50%, transparent 65%) -150% 0 / 250% 100% no-repeat;
  animation: sp-sweep calc(.7s * var(--t)) ease calc(1.25s * var(--t)) forwards; }
@keyframes sp-crest-in { to { opacity: 1; transform: none; } }
@keyframes sp-sweep { to { background-position: 150% 0; } }

/* ── FULVO ── */
.sp-word { position: absolute; z-index: 2; top: calc(50% + min(25vmin, 125px) - 4px); display: flex; gap: .06em; perspective: 400px;
  font-family: 'Montserrat', 'Inter', sans-serif; font-weight: 800; font-size: clamp(34px, 9vmin, 56px); letter-spacing: .04em; color: #fff; }
.sp-word span { display: inline-block; opacity: 0; transform: translateZ(-260px) scale(1.9); filter: blur(8px);
  text-shadow: 0 0 18px rgba(255, 255, 255, .25);
  animation: sp-letter calc(.5s * var(--t)) cubic-bezier(.16, 1, .3, 1) calc((1.3s + var(--i) * .07s) * var(--t)) forwards; }
@keyframes sp-letter { to { opacity: 1; transform: none; filter: none; } }

/* ── Carga lenta ── */
.sp-loading { position: absolute; z-index: 2; bottom: max(8vh, 40px); margin: 0; display: flex; align-items: center; gap: 10px;
  font: 600 13px/1 'Inter', sans-serif; letter-spacing: .08em; text-transform: uppercase; color: #94a3b8; }
.sp-loading .ball { width: 12px; height: 12px; border-radius: 50%; background: #fff; box-shadow: inset -3px -3px 0 rgba(15, 23, 42, .35); animation: sp-bounce .6s cubic-bezier(.5, 0, .5, 1) infinite alternate; }
@keyframes sp-bounce { from { transform: translateY(-7px); } to { transform: translateY(3px); } }
.sp-slow-enter-active { transition: opacity .4s ease, transform .4s ease; }
.sp-slow-enter-from { opacity: 0; transform: translateY(6px); }

@media (prefers-reduced-motion: reduce) {
  .sp-light, .sp-haze, .sp-crest, .sp-sweep, .sp-word span, .sp-loading .ball { animation: none !important; }
  .sp-light { opacity: .5; } .sp-haze { opacity: 1; }
  .sp-crest { opacity: 1; transform: none; } .sp-sweep { display: none; }
  .sp-word span { opacity: 1; transform: none; filter: none; }
}
</style>
