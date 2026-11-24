<script setup>
/**
 * HOJA DE AJUSTES (bottom sheet) — se abre desde el avatar de la TopBar.
 * Junta en un solo lugar pantallas que en mobile quedaban huérfanas (sin
 * acceso desde la navegación): Mensajes, Planes, Carrera, Acerca de, legales,
 * reportar un problema. "Reportar" y "Desafíos" reusan los modales que ya
 * viven en FriendsDock (pedido vía shell-state, sin duplicar el formulario).
 */
import { computed, watch, onBeforeUnmount } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { logout } from '../../services/auth'
import { shellState, closeSettings, requestBugReport, requestChallenges, tapHaptic } from './shell-state'
import { getTierForLevel } from '../../services/tiers'
import UserAvatar from '../common/UserAvatar.vue'

const router = useRouter()
const route = useRoute()
const open = computed(() => shellState.settingsOpen)
const name = computed(() => shellState.user?.display_name || shellState.user?.email || 'Jugador')
const tier = computed(() => getTierForLevel(shellState.stats.level))

const SECTIONS = computed(() => [
  {
    title: 'Cuenta',
    items: [
      { key: 'perfil', label: 'Mi perfil', to: '/profile', icon: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0' },
      { key: 'editar', label: 'Editar perfil', to: '/profile-edit', icon: 'M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4' },
      { key: 'notificaciones', label: 'Notificaciones', to: '/notifications', icon: 'M6 9a6 6 0 1112 0c0 2.3.7 3.6 1.2 4.4.4.6.6.9.6 1.1 0 .8-.7 1.5-1.5 1.5H5.7A1.7 1.7 0 014 14.3c0-.2.2-.5.6-1.1C5.1 12.6 6 11.3 6 9zM14 18.5a2 2 0 11-4 0', count: shellState.notifCount },
      { key: 'mensajes', label: 'Mensajes', to: '/messages', icon: 'M4 5h16v11H8l-4 4V5z' },
      { key: 'desafios', label: 'Objetivos y desafíos', action: 'challenges', icon: 'M5 21V4M5 4h13l-3 4 3 4H5' },
      { key: 'planes', label: 'Premium · Planes', to: '/pricing', icon: 'M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8z', accent: true },
      ...(shellState.isAdmin ? [{ key: 'admin', label: 'Panel admin', to: '/admin', icon: 'M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z' }] : []),
    ],
  },
  {
    title: 'Jugar',
    items: [
      { key: 'carrera', label: 'Modo Carrera', to: '/carrera', icon: 'M4 18l5-5 4 4 7-8M20 9V4h-5' },
    ],
  },
  {
    title: 'FULVO',
    items: [
      { key: 'acerca', label: 'Acerca de FULVO', to: '/about/fulvo', icon: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 16v-4M12 8h.01' },
      { key: 'privacidad', label: 'Privacidad', to: '/privacidad', icon: 'M6 11V8a6 6 0 1112 0v3M5 11h14v10H5z' },
      { key: 'terminos', label: 'Términos', to: '/terminos', icon: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6' },
      { key: 'bug', label: 'Reportar un problema', action: 'bug', icon: 'M8 2l1.5 2.5M16 2l-1.5 2.5M7 6h10v7a5 5 0 01-10 0V6zM4 10h3M17 10h3M4 15h3M17 15h3' },
    ],
  },
])

function pick(item) {
  tapHaptic()
  closeSettings()
  if (item.action === 'bug') return requestBugReport()
  if (item.action === 'challenges') return requestChallenges()
  if (item.to && route.path !== item.to) router.push(item.to)
}
async function doLogout() {
  closeSettings()
  try { await logout() } catch {}
  router.push('/login')
}

// Cerrar con Escape, al navegar, y bloquear el scroll del fondo mientras está abierta.
function onKey(e) { if (e.key === 'Escape') closeSettings() }
watch(open, (v) => {
  if (typeof document === 'undefined') return
  document.documentElement.style.overflow = v ? 'hidden' : ''
  if (v) document.addEventListener('keydown', onKey)
  else document.removeEventListener('keydown', onKey)
})
watch(() => route.fullPath, () => closeSettings())
onBeforeUnmount(() => { document.removeEventListener('keydown', onKey); document.documentElement.style.overflow = '' })
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet-fade">
      <div v-if="open" class="fixed inset-0 z-[65] bg-black/60 backdrop-blur-[2px]" aria-hidden="true" @click="closeSettings()"></div>
    </Transition>
    <Transition name="sheet-up">
      <section v-if="open" class="settings-sheet fixed inset-x-0 bottom-0 z-[66] mx-auto w-full max-w-lg rounded-t-3xl border border-white/10 border-b-0 bg-gradient-to-b from-slate-900 to-[#070a1a] shadow-2xl"
        role="dialog" aria-modal="true" aria-label="Cuenta y ajustes">
        <div class="pt-2.5 pb-1 grid place-items-center"><span class="block h-1.5 w-10 rounded-full bg-white/20"></span></div>

        <!-- Cabecera: igual que el menú de usuario de siempre (avatar, nombre, Nivel · XP y la barra verde→cian→violeta) -->
        <div class="px-5 pt-2 pb-4 border-b border-white/10">
          <div class="flex items-center gap-3">
            <UserAvatar :size="48" :avatar-url="shellState.user?.avatar_url || ''" :initial="(name.trim()[0] || '?').toUpperCase()"
              :frame-key="shellState.equipped.frameKey" :icon-glyph="shellState.equipped.iconGlyph" :icon-bg="shellState.equipped.iconBg" :frame-premium="shellState.equipped.framePremium" />
            <div class="min-w-0 flex-1">
              <div class="font-display font-bold text-white truncate leading-tight">{{ name }}</div>
              <div class="text-[11px] text-slate-400">Nivel {{ shellState.stats.level }}<span v-if="shellState.stats.xpTotal"> · {{ shellState.stats.xpTotal.toLocaleString('es-AR') }} XP</span><span v-if="tier"> · {{ tier.label }}</span></div>
            </div>
            <img v-if="tier?.image" :src="tier.image" :alt="tier.label" width="34" height="40" class="w-[34px] h-[40px] shrink-0" />
            <button type="button" class="h-11 w-11 grid place-items-center rounded-full text-slate-300 hover:text-white hover:bg-white/10" aria-label="Cerrar" @click="closeSettings()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="h-5 w-5"><path d="M6 18 18 6M6 6l12 12"/></svg>
            </button>
          </div>
          <div class="mt-3 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div class="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400 transition-all duration-700" :style="{ width: (shellState.stats.levelPct || 0) + '%' }"></div>
          </div>
        </div>

        <div class="settings-scroll overflow-y-auto px-3 py-2">
          <div v-for="sec in SECTIONS" :key="sec.title" class="py-1.5">
            <div class="px-2 pt-1 pb-1.5 text-[10.5px] uppercase tracking-[0.14em] font-bold text-slate-500">{{ sec.title }}</div>
            <button v-for="it in sec.items" :key="it.key" type="button" class="w-full min-h-[48px] flex items-center gap-3 px-2.5 rounded-xl text-left hover:bg-white/5 active:bg-white/10 transition" @click="pick(it)">
              <span class="h-9 w-9 shrink-0 grid place-items-center rounded-xl border" :class="it.accent ? 'border-amber-400/40 bg-amber-500/10 text-amber-300' : 'border-white/10 bg-white/[0.04] text-slate-300'">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="h-[18px] w-[18px]"><path :d="it.icon"/></svg>
              </span>
              <span class="flex-1 text-[14.5px] font-semibold" :class="it.accent ? 'text-amber-200' : 'text-slate-100'">{{ it.label }}</span>
              <span v-if="it.count > 0" class="min-w-[20px] h-5 px-1.5 rounded-full bg-rose-500 text-white text-[11px] font-bold grid place-items-center">{{ it.count > 9 ? '9+' : it.count }}</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4 text-slate-600"><path d="M9 6l6 6-6 6"/></svg>
            </button>
          </div>
          <button type="button" class="mt-1 mb-2 w-full min-h-[48px] rounded-xl border border-rose-400/25 bg-rose-500/10 text-rose-300 font-bold text-sm hover:bg-rose-500/15 active:scale-[.99] transition" @click="doLogout">
            Cerrar sesión
          </button>
        </div>
      </section>
    </Transition>
  </Teleport>
</template>

<style scoped>
.settings-sheet { padding-bottom: env(safe-area-inset-bottom, 0px); }
.settings-scroll { max-height: calc(85dvh - 120px); overscroll-behavior: contain; }
.sheet-fade-enter-active, .sheet-fade-leave-active { transition: opacity .22s ease; }
.sheet-fade-enter-from, .sheet-fade-leave-to { opacity: 0; }
.sheet-up-enter-active { transition: transform .34s cubic-bezier(.16, 1, .3, 1); }
.sheet-up-leave-active { transition: transform .2s ease-in; }
.sheet-up-enter-from, .sheet-up-leave-to { transform: translateY(100%); }
@media (prefers-reduced-motion: reduce) {
  .sheet-up-enter-active, .sheet-up-leave-active { transition: opacity .12s ease; }
  .sheet-up-enter-from, .sheet-up-leave-to { transform: none; opacity: 0; }
}
</style>
