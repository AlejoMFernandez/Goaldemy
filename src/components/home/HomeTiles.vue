<script setup>
/**
 * ACCESOS DEL INICIO (diseño V4 · opción A): 4 baldosas 2×2 con ícono,
 * título, una línea de estado y el globito rojo si hay algo para cobrar.
 * Recibe la lista ya armada desde Landing: [{ key, to, title, sub, badge }].
 * key ∈ evento | ranking | sobre | misiones | pase (decide colores e ícono).
 */
import { RouterLink } from 'vue-router'
import { tap } from '../../services/haptics'

defineProps({
  tiles: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
})

const THEME = {
  evento:   { tint: 'rgba(16,185,129,0.25)', ring: 'rgba(52,211,153,0.3)', icon: 'linear-gradient(160deg,#34d399,#047857)', sub: '#6ee7b7' },
  pase:     { tint: 'rgba(16,185,129,0.25)', ring: 'rgba(52,211,153,0.3)', icon: 'linear-gradient(160deg,#34d399,#047857)', sub: '#6ee7b7' },
  ranking:  { tint: 'rgba(59,130,246,0.25)', ring: 'rgba(96,165,250,0.3)', icon: 'linear-gradient(160deg,#60a5fa,#1d4ed8)', sub: '#93c5fd' },
  sobre:    { tint: 'rgba(245,158,11,0.25)', ring: 'rgba(251,191,36,0.35)', icon: 'linear-gradient(160deg,#fcd34d,#b45309)', sub: '#fde68a' },
  misiones: { tint: 'rgba(139,92,246,0.25)', ring: 'rgba(167,139,250,0.3)', icon: 'linear-gradient(160deg,#a78bfa,#6d28d9)', sub: '#c4b5fd' },
}
const th = (k) => THEME[k] || THEME.ranking
</script>

<template>
  <section class="ht" aria-label="Accesos">
    <template v-if="loading">
      <div v-for="i in 4" :key="i" class="ht-sk" aria-hidden="true"></div>
    </template>
    <RouterLink
      v-for="t in tiles" v-else :key="t.key" :to="t.to" class="ht-tile"
      :style="{ background: `linear-gradient(135deg, ${th(t.key).tint}, rgba(15,23,42,0.6) 60%)`, borderColor: th(t.key).ring }"
      :aria-label="`${t.title}: ${t.sub}${t.badge ? ' (' + t.badge + ' nuevo)' : ''}`"
      @click="tap()"
    >
      <span class="ic" :style="{ background: th(t.key).icon }" aria-hidden="true">
        <svg v-if="t.key === 'evento' || t.key === 'pase'" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /><path d="M12 13l1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4z" fill="#fff" stroke="none" /></svg>
        <svg v-else-if="t.key === 'ranking'" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0zM7 6H4a3 3 0 003 4M17 6h3a3 3 0 01-3 4" /></svg>
        <svg v-else-if="t.key === 'sobre'" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 8l9 6 9-6" /></svg>
        <svg v-else width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6h11M9 12h11M9 18h11" /><path d="M3.5 6l1.2 1.2L7 5M3.5 12l1.2 1.2L7 11M3.5 18l1.2 1.2L7 17" /></svg>
      </span>
      <span class="tx">
        <span class="tt">{{ t.title }}</span>
        <span class="sb" :style="{ color: th(t.key).sub }">{{ t.sub }}</span>
      </span>
      <span v-if="t.badge" class="bd" aria-hidden="true">{{ t.badge }}</span>
    </RouterLink>
  </section>
</template>

<style scoped>
.ht { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.ht-tile { position: relative; min-height: 66px; box-sizing: border-box; border-radius: 16px; padding: 10px; border: 1px solid; display: flex; align-items: center; gap: 10px; text-decoration: none; color: #fff; -webkit-tap-highlight-color: transparent; transition: transform .12s ease; }
.ht-tile:active { transform: scale(.97); }
.ht-tile:focus-visible { outline: 2px solid #fcd34d; outline-offset: 2px; }
.ic { width: 42px; height: 42px; flex-shrink: 0; border-radius: 12px; box-shadow: inset 0 1px 0 rgba(255, 255, 255, .35); display: grid; place-items: center; }
.tx { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.tt { font-family: var(--font-bug); font-weight: 800; font-size: 17px; text-transform: uppercase; letter-spacing: .3px; line-height: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sb { font-size: 11.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bd { position: absolute; top: -6px; right: -4px; min-width: 20px; height: 20px; padding: 0 5px; box-sizing: border-box; border-radius: 999px; background: #f43f5e; border: 2px solid #0b1220; font-size: 11px; font-weight: 800; line-height: 16px; text-align: center; color: #fff; }
.ht-sk { min-height: 66px; border-radius: 16px; background: rgba(255, 255, 255, .04); animation: ht-p 1.4s ease-in-out infinite; }
@keyframes ht-p { 50% { opacity: .55; } }
@media (prefers-reduced-motion: reduce) { .ht-sk { animation: none; } .ht-tile { transition: none; } }
</style>
