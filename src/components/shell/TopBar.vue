<script setup>
/**
 * TOP BAR MOBILE (<lg) — estilo juego (Clash Royale / Castle Duels).
 *  Izquierda (un renglón): escudo del rango + "Nv X" + barra de XP con el
 *  degradé de siempre (verde → cian → violeta, igual que el menú de usuario).
 *  Derecha: una sola pastilla con Fichas y Balones → /tienda · avatar equipado
 *  (con punto rojo si hay notificaciones) → hoja de ajustes.
 *  La racha y la campana salieron del encabezado para que respire (moodboard 10 v2).
 *  Invitado: logo + "Entrar".
 * Alto: 60px + safe-area superior (notch / Dynamic Island).
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
        <!-- Rango + nivel + barra de XP, en un solo renglón (misma barra que el menú de usuario) -->
        <RouterLink to="/profile" class="flex items-center gap-2 min-w-0 h-11" :aria-label="`Nivel ${s.level}, ${tier?.label || ''}`">
          <img v-if="tier?.image" :src="tier.image" :alt="tier.label" width="30" height="35" class="w-[30px] h-[35px] shrink-0" />
          <span class="font-display font-bold text-[15px] leading-none text-white tabular-nums whitespace-nowrap">Nv {{ s.level }}</span>
          <span class="block h-1.5 w-[84px] rounded-full bg-white/10 overflow-hidden shrink-0">
            <span class="block h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400 transition-[width] duration-700" :style="{ width: (s.levelPct || 0) + '%' }"></span>
          </span>
        </RouterLink>

        <div class="ml-auto flex items-center gap-2 min-w-0">
          <!-- Monedas juntas en una sola pastilla → /tienda -->
          <RouterLink to="/tienda" class="shell-wallet" data-reward-anchor="fichas" :aria-label="`${s.fichas} Fichas y ${s.balones} Balones de Oro: ir a la tienda`" @click="tapHaptic()">
            <span class="inline-flex items-center gap-1"><CurrencyIcon type="fichas" :size="18" /><span class="tabular-nums">{{ s.loaded ? compact(s.fichas) : '–' }}</span></span>
            <span class="inline-flex items-center gap-1 text-amber-200"><CurrencyIcon type="balones" :size="18" /><span class="tabular-nums">{{ s.loaded ? compact(s.balones) : '–' }}</span></span>
          </RouterLink>
          <!-- Avatar → hoja de ajustes. Las notificaciones viven en la hoja: acá solo un punto rojo.
               data-avatar-anchor: destino de reward-flight (XP/ayudas) y de la medalla de logros en mobile. -->
          <button type="button" data-avatar-anchor class="relative shrink-0 w-11 h-11 grid place-items-center rounded-full active:scale-95 transition"
            :aria-label="shellState.notifCount > 0 ? `Tu cuenta y ajustes, ${shellState.notifCount} notificaciones nuevas` : 'Tu cuenta y ajustes'" @click="tapHaptic(); openSettings()">
            <UserAvatar :size="36" :glow="false" :avatar-url="shellState.user?.avatar_url || ''" :initial="initial"
              :frame-key="shellState.equipped.frameKey" :icon-glyph="shellState.equipped.iconGlyph" :icon-bg="shellState.equipped.iconBg" :frame-premium="shellState.equipped.framePremium"
              :level="Number(shellState.stats.level) || null" :streak="Number(shellState.stats.streak) || 0" />
            <span v-if="shellState.notifCount > 0" class="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-[#0b1220]" aria-hidden="true"></span>
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.shell-topbar {
  padding-top: env(safe-area-inset-top, 0px);
  background: rgba(11,18,32,.96);
  border-bottom: 1px solid rgba(255,255,255,.06);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}
.shell-topbar-inner {
  height: var(--shell-topbar-h, 60px);
  display: flex; align-items: center; gap: 4px;
  padding-left: max(12px, env(safe-area-inset-left, 0px));
  padding-right: max(10px, env(safe-area-inset-right, 0px));
}
.shell-wallet {
  display: inline-flex; align-items: center; gap: 10px;
  height: 34px; padding: 0 12px 0 8px; border-radius: 9999px;
  font-family: var(--font-display); font-weight: 700; font-size: 14px; color: #e2e8f0;
  background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.08);
  transition: transform .12s ease;
}
.shell-wallet:active { transform: scale(.96); }
</style>
