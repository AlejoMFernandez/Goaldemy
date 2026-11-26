<script setup>
/**
 * TAB BAR MOBILE (<lg) — 5 pestañas, la central (JUGAR) elevada y más grande,
 * como el botón "Batalla" de Clash Royale.
 *   Tienda · Colección · ⚽ JUGAR · Pase · Social
 * - Activa: se levanta + brillo dorado (micro-animación con resorte).
 * - Toque: vibración corta (navigator.vibrate, solo donde exista).
 * - Áreas táctiles ≥ 48px. Padding inferior = safe-area (home indicator iOS).
 * - Se oculta en rutas inmersivas (juegos, carrera), auth, admin y chat 1-a-1
 *   (ver isTabBarHidden, exportada para que App.vue reserve el alto solo cuando se ve).
 */
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getUnclaimedCount } from '../../stores/notifications'
import { tapHaptic } from './shell-state'

const route = useRoute()
const router = useRouter()
const rewardCount = computed(() => getUnclaimedCount())

const TABS = [
  { key: 'tienda', to: '/tienda', label: 'Tienda', match: ['/tienda', '/pricing'] },
  { key: 'coleccion', to: '/coleccion', label: 'Colección', match: ['/coleccion', '/colecciones', '/camino', '/profile-edit'] },
  { key: 'jugar', to: '/', label: 'Jugar', match: ['/', '/play/points'], center: true },
  { key: 'pase', to: '/rewards', label: 'Pase', match: ['/rewards', '/racha', '/logros'] },
  { key: 'social', to: '/social', label: 'Social', match: ['/social', '/leaderboards', '/competiciones', '/leagues', '/teams', '/team', '/messages', '/notifications'] },
]

function isActive(tab) {
  const p = route.path
  return tab.match.some(m => (m === '/' ? p === '/' : (p === m || p.startsWith(m + '/'))))
}
function go(tab) {
  tapHaptic()
  if (route.path === tab.to) { window.scrollTo({ top: 0, behavior: 'smooth' }); return }
  router.push(tab.to)
}
</script>

<template>
  <nav class="shell-tabbar lg:hidden" aria-label="Navegación principal">
    <ul class="shell-tabbar-row">
      <li v-for="t in TABS" :key="t.key" class="flex-1 flex justify-center">
        <button v-if="t.center" type="button" class="shell-tab-center" :class="{ 'is-active': isActive(t) }"
          :aria-current="isActive(t) ? 'page' : undefined" aria-label="Jugar" @click="go(t)">
          <span class="shell-tab-center-disc">
            <img class="shell-tab-center-logo" src="/iconclaro.png" alt="" aria-hidden="true" width="27" height="36" />
          </span>
          <span class="shell-tab-center-label">Jugar</span>
        </button>
        <button v-else type="button" class="shell-tab" :class="{ 'is-active': isActive(t) }"
          :aria-current="isActive(t) ? 'page' : undefined" @click="go(t)">
          <span class="relative shell-tab-icon">
            <!-- Tienda -->
            <svg v-if="t.key === 'tienda'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9l1.2-4.2A1 1 0 016.2 4h11.6a1 1 0 011 .8L20 9"/><path d="M4 9h16v1.5a2.5 2.5 0 01-4 2 2.5 2.5 0 01-4 0 2.5 2.5 0 01-4 0 2.5 2.5 0 01-4-2z"/><path d="M5.5 13v6.5a.5.5 0 00.5.5h12a.5.5 0 00.5-.5V13"/><path d="M10 20v-4h4v4"/></svg>
            <!-- Colección -->
            <svg v-else-if="t.key === 'coleccion'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="6" width="12" height="15" rx="2"/><path d="M8 3h11a2 2 0 012 2v13"/><path d="M9 11.5l1 2 2.2.3-1.6 1.5.4 2.2L9 16.4l-2 1.1.4-2.2-1.6-1.5 2.2-.3z"/></svg>
            <!-- Pase -->
            <svg v-else-if="t.key === 'pase'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12v9H4v-9"/><path d="M2 7h20v5H2z"/><path d="M12 21V7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg>
            <!-- Social -->
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><circle cx="17" cy="9" r="2.4"/><path d="M16 14.6c2.8.2 5 2 5 4.9"/></svg>
            <span v-if="t.key === 'pase' && rewardCount > 0" class="shell-tab-badge">{{ rewardCount > 9 ? '9+' : rewardCount }}</span>
          </span>
          <span class="shell-tab-label">{{ t.label }}</span>
        </button>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.shell-tabbar {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 45;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  padding-left: env(safe-area-inset-left, 0px);
  padding-right: env(safe-area-inset-right, 0px);
  background: linear-gradient(180deg, rgba(15,23,42,.94), rgba(7,10,26,.98));
  border-top: 1px solid rgba(251,191,36,.18);
  box-shadow: 0 -10px 30px rgba(0,0,0,.45);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
.shell-tabbar-row { height: var(--shell-tabbar-h, 64px); display: flex; align-items: stretch; }

.shell-tab {
  position: relative; width: 100%; min-width: 48px; min-height: 48px;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
  color: #94a3b8; -webkit-tap-highlight-color: transparent;
  transition: color .2s ease, transform .25s cubic-bezier(.34, 1.56, .64, 1);
}
.shell-tab:active { transform: scale(.9); }
.shell-tab-icon { width: 24px; height: 24px; display: block; transition: transform .3s cubic-bezier(.34, 1.56, .64, 1), filter .3s ease; }
.shell-tab-icon > svg { width: 24px; height: 24px; }
.shell-tab-label { font-size: 10.5px; font-weight: 700; letter-spacing: .01em; }
.shell-tab.is-active { color: #fcd34d; }
.shell-tab.is-active .shell-tab-icon { transform: translateY(-3px) scale(1.12); filter: drop-shadow(0 0 8px rgba(251,191,36,.55)); }
.shell-tab.is-active::after {
  content: ''; position: absolute; bottom: 4px; width: 18px; height: 3px; border-radius: 9999px;
  background: #fbbf24; box-shadow: 0 0 10px rgba(251,191,36,.8);
}
.shell-tab-badge {
  position: absolute; top: -6px; right: -10px; min-width: 18px; height: 18px; padding: 0 4px;
  border-radius: 9999px; display: grid; place-items: center;
  font-size: 10px; font-weight: 800; color: #fff; background: #10b981;
  box-shadow: 0 0 0 2px #0b1220; animation: shell-badge-pop .4s cubic-bezier(.34, 1.56, .64, 1);
}

/* Botón central: círculo perfecto (aspect-ratio 1 + sin encogerse), apenas elevado */
.shell-tab-center {
  position: relative; width: 72px; min-height: 48px; margin-top: -18px;
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  -webkit-tap-highlight-color: transparent;
  transition: transform .25s cubic-bezier(.34, 1.56, .64, 1);
}
.shell-tab-center:active { transform: scale(.92); }
.shell-tab-center-disc {
  flex: none; box-sizing: border-box; width: 58px; height: 58px; aspect-ratio: 1 / 1;
  border-radius: 50%; display: grid; place-items: center;
  /* Escudo de FULVO sobre círculo oscuro con aro dorado: la marca en todas las pantallas */
  background: radial-gradient(circle at 50% 30%, #1e3a5f 0%, #0b1220 75%);
  border: 2px solid #fbbf24;
  box-shadow: 0 0 0 3px #0b1220, 0 0 16px rgba(251,191,36,.3), 0 6px 16px rgba(0,0,0,.45);
  transition: box-shadow .3s ease, transform .3s cubic-bezier(.34, 1.56, .64, 1);
}
.shell-tab-center-logo { height: 36px; width: auto; display: block; margin-top: -2px; }
.shell-tab-center-label { font-size: 10.5px; font-weight: 800; letter-spacing: .02em; color: #94a3b8; }
.shell-tab-center.is-active .shell-tab-center-label { color: #fcd34d; }
.shell-tab-center.is-active .shell-tab-center-disc {
  box-shadow: 0 0 0 3px #0b1220, 0 0 22px rgba(251,191,36,.55), 0 6px 16px rgba(0,0,0,.45);
}
@keyframes shell-badge-pop { from { transform: scale(0); } to { transform: scale(1); } }

@media (prefers-reduced-motion: reduce) {
  .shell-tab, .shell-tab-icon, .shell-tab-center, .shell-tab-center-disc { transition: none; }
  .shell-tab.is-active .shell-tab-icon { transform: none; }
  .shell-tab-center.is-active .shell-tab-center-disc { animation: none; }
  .shell-tab-badge { animation: none; }
}
</style>
