<script setup>
/**
 * TOP BAR MOBILE (<lg) — estilo juego (Clash Royale / Castle Duels).
 *  Izquierda: insignia de rango + nivel con barra fina de XP, y la racha 🔥.
 *  Derecha: Fichas (+), Balones (+) → /tienda · campana (notificaciones reales)
 *           · avatar equipado → abre la hoja de ajustes.
 *  Invitado: logo + "Entrar".
 * Alto: 56px + safe-area superior (notch / Dynamic Island).
 * En desktop (lg+) no se renderiza: sigue la navbar actual.
 */
import { computed, watch } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { shellState, loadShellStats, openSettings, tapHaptic } from './shell-state'
import { getTierForLevel } from '../../services/tiers'
import UserAvatar from '../common/UserAvatar.vue'
import CurrencyIcon from '../shop/CurrencyIcon.vue'
import FulvoLogo from '../FulvoLogo.vue'

const route = useRoute()
const logged = computed(() => !!shellState.user?.id)
const s = computed(() => shellState.stats)
const tier = computed(() => getTierForLevel(s.value.level))
const initial = computed(() => ((shellState.user?.display_name || shellState.user?.email || '?').trim()[0] || '?').toUpperCase())

function compact(n) {
  const v = Number(n) || 0
  if (v >= 100000) return Math.round(v / 1000) + 'k'
  if (v >= 10000) return (v / 1000).toFixed(1).replace('.0', '') + 'k'
  return v.toLocaleString('es-AR')
}

// Carga al tener sesión y refresco al navegar (throttle 15 s). Al volver de
// la tienda o de un juego se fuerza: ahí es donde cambian monedas/XP/racha.
watch(() => shellState.user?.id, (id) => { if (id) loadShellStats(true) }, { immediate: true })
watch(() => route.path, (to, from) => {
  if (!logged.value) return
  const force = !!from && (from.startsWith('/tienda') || from.startsWith('/games/') || from.startsWith('/rewards'))
  loadShellStats(force)
})
</script>

<template>
  <div class="shell-topbar lg:hidden sticky top-0 z-40" role="banner">
    <div class="shell-topbar-inner">
      <!-- ── Invitado ── -->
      <template v-if="!logged">
        <RouterLink to="/" class="flex items-center h-11" aria-label="Inicio">
          <FulvoLogo variant="full" size="sm" :animated="false" />
        </RouterLink>
        <RouterLink to="/login" class="ml-auto h-10 inline-flex items-center rounded-full px-5 text-sm font-extrabold text-slate-900 bg-gradient-to-b from-amber-300 to-amber-500 shadow-lg shadow-amber-500/25 active:scale-95 transition" @click="tapHaptic()">
          Entrar
        </RouterLink>
      </template>

      <!-- ── Logueado ── -->
      <template v-else>
        <!-- Rango + nivel + XP -->
        <RouterLink to="/profile" class="flex items-center gap-1.5 min-w-0 h-11 pr-1" :aria-label="`Nivel ${s.level}, ${tier?.label || ''}`">
          <span class="relative shrink-0 w-9 h-9 grid place-items-center">
            <img v-if="tier?.image" :src="tier.image" :alt="tier.label" width="36" height="36" class="w-9 h-9 drop-shadow-[0_0_6px_rgba(251,191,36,.35)]" />
          </span>
          <span class="flex flex-col justify-center min-w-[34px]">
            <span class="font-display font-extrabold text-[13px] leading-none text-white tabular-nums">Nv {{ s.level }}</span>
            <span class="mt-1 block h-1 w-9 rounded-full bg-white/10 overflow-hidden">
              <span class="block h-full rounded-full bg-gradient-to-r from-amber-300 to-amber-500 transition-[width] duration-700" :style="{ width: (s.levelPct || 0) + '%' }"></span>
            </span>
          </span>
        </RouterLink>
        <RouterLink to="/play/points" class="flex items-center gap-0.5 h-11 px-1 shrink-0" :aria-label="`Racha de ${s.streak} días`">
          <svg class="w-[18px] h-[18px] shell-flame" :class="s.streak > 0 ? 'text-orange-400' : 'text-slate-600'" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 23c-3.6 0-8-3.1-8-8.5C4 9 8 4 11.5 1c.2-.1.4-.1.5 0 .2.1.2.3.1.5C11 4 14 6 14 6s1-1.5 1.5-4c0-.2.2-.3.4-.3s.3.1.4.3C18 5 20 9 20 14.5 20 19.9 15.6 23 12 23z"/></svg>
          <span class="font-display font-extrabold text-[13px] tabular-nums" :class="s.streak > 0 ? 'text-orange-300' : 'text-slate-500'">{{ s.streak }}</span>
        </RouterLink>

        <div class="ml-auto flex items-center gap-1.5 min-w-0">
          <!-- Monedas -->
          <RouterLink to="/tienda" class="shell-pill" aria-label="Fichas: ir a la tienda" @click="tapHaptic()">
            <CurrencyIcon type="fichas" :size="18" />
            <span class="tabular-nums">{{ s.loaded ? compact(s.fichas) : '–' }}</span>
            <span class="shell-pill-plus" aria-hidden="true">+</span>
          </RouterLink>
          <RouterLink to="/tienda" class="shell-pill shell-pill--gold" aria-label="Balones de Oro: ir a la tienda" @click="tapHaptic()">
            <CurrencyIcon type="balones" :size="18" />
            <span class="tabular-nums">{{ s.loaded ? compact(s.balones) : '–' }}</span>
            <span class="shell-pill-plus" aria-hidden="true">+</span>
          </RouterLink>
          <!-- Notificaciones -->
          <RouterLink to="/notifications" class="relative shrink-0 w-10 h-11 grid place-items-center text-slate-200" aria-label="Notificaciones">
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 18.5a2 2 0 1 1-4 0" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M6 9a6 6 0 1 1 12 0c0 2.28.67 3.6 1.2 4.38.4.6.6.9.6 1.12 0 .83-.67 1.5-1.5 1.5H5.7A1.7 1.7 0 0 1 4 14.3c0-.22.2-.52.6-1.12C5.13 12.6 6 11.28 6 9Z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            <span v-if="shellState.notifCount > 0" class="absolute top-1 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold grid place-items-center ring-2 ring-[#0b1220]">{{ shellState.notifCount > 9 ? '9+' : shellState.notifCount }}</span>
          </RouterLink>
          <!-- Avatar → ajustes -->
          <button type="button" class="shrink-0 w-11 h-11 grid place-items-center rounded-full active:scale-95 transition" aria-label="Abrir menú de cuenta y ajustes" @click="tapHaptic(); openSettings()">
            <UserAvatar :size="34" :glow="false" :avatar-url="shellState.user?.avatar_url || ''" :initial="initial"
              :frame-key="shellState.equipped.frameKey" :icon-glyph="shellState.equipped.iconGlyph" :icon-bg="shellState.equipped.iconBg" :frame-premium="shellState.equipped.framePremium" />
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.shell-topbar {
  padding-top: env(safe-area-inset-top, 0px);
  background: linear-gradient(180deg, rgba(11,18,32,.98), rgba(11,18,32,.92));
  border-bottom: 1px solid rgba(255,255,255,.08);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}
.shell-topbar-inner {
  height: var(--shell-topbar-h, 56px);
  display: flex; align-items: center; gap: 4px;
  padding-left: max(10px, env(safe-area-inset-left, 0px));
  padding-right: max(8px, env(safe-area-inset-right, 0px));
}
.shell-pill {
  position: relative; display: inline-flex; align-items: center; gap: 4px;
  height: 30px; padding: 0 20px 0 6px; border-radius: 9999px;
  font-family: var(--font-display); font-weight: 800; font-size: 12.5px; color: #e2e8f0;
  background: rgba(2,6,23,.7); border: 1px solid rgba(52,211,153,.35);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.06);
  transition: transform .12s ease;
}
.shell-pill:active { transform: scale(.95); }
.shell-pill--gold { border-color: rgba(251,191,36,.45); color: #fde68a; }
.shell-pill-plus {
  position: absolute; right: 3px; top: 50%; transform: translateY(-50%);
  width: 15px; height: 15px; border-radius: 9999px; display: grid; place-items: center;
  font-size: 12px; line-height: 1; font-weight: 900; color: #0f172a;
  background: linear-gradient(180deg, #6ee7b7, #10b981);
}
.shell-pill--gold .shell-pill-plus { background: linear-gradient(180deg, #fde68a, #f59e0b); }
/* Llama viva: titila suave (desactivado con movimiento reducido) */
.shell-flame.text-orange-400 { animation: shell-flame 2.4s ease-in-out infinite; transform-origin: 50% 90%; }
@keyframes shell-flame { 0%, 100% { transform: scale(1) rotate(0); } 40% { transform: scale(1.08) rotate(-3deg); } 70% { transform: scale(.97) rotate(2deg); } }
@media (prefers-reduced-motion: reduce) { .shell-flame.text-orange-400 { animation: none; } }
</style>
