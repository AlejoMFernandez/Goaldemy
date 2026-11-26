<script setup>
/**
 * HOJA DE AJUSTES (v4, bottom sheet) — se abre desde el avatar de la TopBar.
 *  - Tarjeta de perfil: banner, avatar con borde, título equipado, NV y XP.
 *  - Accesos 3×2: Mi perfil, Vestuario (= Colección/cosméticos), Notificaciones,
 *    Mensajes, Racha y Logros.
 *  - Premium, sonido, más opciones (editar perfil, desafíos, carrera, acerca
 *    de, reportar), legales, cerrar sesión y BORRAR CUENTA (lo exige Apple;
 *    solo con VITE_ACCOUNT_DELETION=1, usa services/account.js).
 * "Reportar" y "Desafíos" reusan los modales de FriendsDock vía shell-state.
 */
import { ref, computed, watch, onBeforeUnmount, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { logout } from '../../services/auth'
import { shellState, closeSettings, requestBugReport, requestChallenges, tapHaptic } from './shell-state'
import { getTierForLevel } from '../../services/tiers'
import { resolveLevelProgress } from '../../services/xp'
import { getEquippedCosmetics, titleClass } from '../../services/cosmetics'
import { soundManager } from '../../services/sounds'
import { ACCOUNT_DELETION_ENABLED, DELETE_CONFIRM_WORD, deleteMyAccount } from '../../services/account'
import { error as hapticError } from '../../services/haptics'
import UserAvatar from '../common/UserAvatar.vue'
import BannerScene from '../common/BannerScene.vue'

const router = useRouter()
const route = useRoute()
const open = computed(() => shellState.settingsOpen)
const rawName = computed(() => shellState.user?.display_name || shellState.user?.email || 'Jugador')
const name = computed(() => rawName.value.includes('@') ? rawName.value.split('@')[0] : rawName.value)
const s = computed(() => shellState.stats)
const tier = computed(() => getTierForLevel(s.value.level))
const prog = computed(() => {
  const p = resolveLevelProgress({ level: s.value.level, xp_total: s.value.xpTotal })
  if (p.xpToNext == null || !p.range) return null
  return { earned: p.range - p.xpToNext, range: p.range }
})
const fmt = (n) => (Number(n) || 0).toLocaleString('es-AR')

// Título + banner equipados (shellState solo trae borde/ícono).
const cos = ref({ titleText: '', titleRarity: 'common', bannerKey: 'default' })
watch(open, async (v) => {
  if (!v || !shellState.user?.id) return
  try { const e = await getEquippedCosmetics(shellState.user.id); if (e) cos.value = e } catch {}
})

const TILES = computed(() => [
  { key: 'perfil', title: 'Mi perfil', sub: 'Tus números', to: '/profile', bg: 'linear-gradient(160deg,#34d399,#047857)', icon: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c1-4.5 4.2-6.5 8-6.5s7 2 8 6.5' },
  { key: 'vestuario', title: 'Vestuario', sub: 'Tu colección', to: '/coleccion', bg: 'linear-gradient(160deg,#fcd34d,#b45309)', subCls: 'text-amber-200', icon: 'M8 3l-5 3 2 5 3-1v11h8V10l3 1 2-5-5-3c-.5 2-2 3-4 3s-3.5-1-4-3z' },
  { key: 'notif', title: 'Notificaciones', sub: shellState.notifCount ? `${shellState.notifCount} ${shellState.notifCount === 1 ? 'nueva' : 'nuevas'}` : 'Al día', to: '/notifications', bg: 'linear-gradient(160deg,#fb7185,#be123c)', subCls: shellState.notifCount ? 'text-rose-300' : '', badge: shellState.notifCount, icon: 'M6 16V11a6 6 0 0112 0v5l2 2H4zM10 21h4' },
  { key: 'mensajes', title: 'Mensajes', sub: 'De tus amigos', to: '/messages', bg: 'linear-gradient(160deg,#60a5fa,#1d4ed8)', icon: 'M4 5h16v11H9l-5 4z' },
  { key: 'racha', title: 'Racha', sub: s.value.streak ? `${s.value.streak} ${s.value.streak === 1 ? 'día' : 'días'}` : 'Arrancala hoy', to: '/racha', bg: 'linear-gradient(160deg,#fb923c,#c2410c)', subCls: 'text-orange-300', icon: 'M12 3c1 4 5 5.5 5 10a5 5 0 01-10 0c0-2.5 1.5-3.5 2-5.5 1.5 1 2 2.5 2 3.5 1-1.5 1-4.5 1-8z' },
  { key: 'logros', title: 'Logros', sub: 'Tus medallas', to: '/logros', bg: 'linear-gradient(160deg,#c084fc,#7e22ce)', subCls: 'text-purple-300', icon: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0zM7 6H4a3 3 0 003 4M17 6h3a3 3 0 01-3 4' },
])

const ROWS = computed(() => [
  { key: 'editar', label: 'Editar perfil', to: '/profile-edit', icon: 'M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4' },
  { key: 'desafios', label: 'Objetivos y desafíos', action: 'challenges', icon: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 17a5 5 0 100-10 5 5 0 000 10zM12 13a1 1 0 100-2 1 1 0 000 2z' },
  { key: 'carrera', label: 'Modo Carrera', to: '/carrera', icon: 'M4 18l5-5 4 4 7-8M20 9V4h-5' },
  { key: 'acerca', label: 'Acerca de FULVO', to: '/about/fulvo', icon: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 16v-4M12 8h.01' },
  { key: 'bug', label: 'Reportar un problema', action: 'bug', icon: 'M5 21V4h12l-2 4 2 4H5' },
  ...(shellState.isAdmin ? [{ key: 'admin', label: 'Panel admin', to: '/admin', icon: 'M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z' }] : []),
])

function pick(item) {
  tapHaptic()
  closeSettings()
  if (item.action === 'bug') return requestBugReport()
  if (item.action === 'challenges') return requestChallenges()
  if (item.to && route.path !== item.to) router.push(item.to)
}
async function doLogout() {
  tapHaptic()
  closeSettings()
  try { await logout() } catch {}
  router.push('/login')
}

// Sonido (mismo flag que usa todo el juego: goaldemy_sound_enabled)
const soundOn = ref(!!soundManager.enabled)
function toggleSound() {
  soundOn.value = !!soundManager.toggle()
  tapHaptic()
}

// Borrar cuenta (Apple): confirmación tipeando BORRAR.
const delOpen = ref(false)
const delText = ref('')
const delBusy = ref(false)
const delError = ref('')
const delInput = ref(null)
function openDelete() {
  tapHaptic()
  delOpen.value = true; delText.value = ''; delError.value = ''
  nextTick(() => delInput.value?.focus())
}
function cancelDelete() { if (!delBusy.value) delOpen.value = false }
async function confirmDelete() {
  if (delText.value.trim() !== DELETE_CONFIRM_WORD || delBusy.value) return
  delBusy.value = true; delError.value = ''
  const res = await deleteMyAccount(delText.value)
  delBusy.value = false
  if (!res.ok) { delError.value = res.error; hapticError(); return }
  delOpen.value = false
  closeSettings()
  router.replace('/')
}

// Cerrar con Escape, al navegar, y bloquear el scroll del fondo mientras está abierta.
function onKey(e) {
  if (e.key !== 'Escape') return
  if (delOpen.value) cancelDelete(); else closeSettings()
}
watch(open, (v) => {
  if (typeof document === 'undefined') return
  document.documentElement.style.overflow = v ? 'hidden' : ''
  if (v) { soundOn.value = !!soundManager.enabled; document.addEventListener('keydown', onKey) }
  else { document.removeEventListener('keydown', onKey); delOpen.value = false }
})
watch(() => route.fullPath, () => closeSettings())
onBeforeUnmount(() => { document.removeEventListener('keydown', onKey); document.documentElement.style.overflow = '' })
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet-fade">
      <div v-if="open" class="fixed inset-0 z-[65] bg-[rgba(2,6,23,0.72)]" aria-hidden="true" @click="closeSettings()"></div>
    </Transition>
    <Transition name="sheet-up">
      <section v-if="open" class="st-sheet" role="dialog" aria-modal="true" aria-label="Tu cuenta y ajustes">
        <span class="st-grab" aria-hidden="true"></span>

        <div class="st-scroll">
          <!-- Perfil -->
          <div class="st-profile">
            <BannerScene class="st-banner" :style-key="cos.bannerKey || 'default'" :premium="!!cos.bannerPremium">
              <button type="button" class="st-close" aria-label="Cerrar" @click="closeSettings()">
                <span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></span>
              </button>
            </BannerScene>
            <div class="flex gap-3 px-3 pb-3 -mt-[26px] relative">
              <RouterLink to="/profile" class="st-av" aria-label="Mi perfil" @click="tapHaptic()">
                <UserAvatar :size="66" :avatar-url="shellState.user?.avatar_url || ''" :initial="(name.trim()[0] || '?').toUpperCase()"
                  :frame-key="shellState.equipped.frameKey" :icon-glyph="shellState.equipped.iconGlyph" :icon-bg="shellState.equipped.iconBg" :frame-premium="shellState.equipped.framePremium"
                  :level="Number(s.level) || null" :streak="Number(shellState.stats.streak) || 0" />
              </RouterLink>
              <div class="flex-1 min-w-0 pt-[30px] flex flex-col gap-1.5">
                <div class="flex items-center gap-2 min-w-0">
                  <span class="font-display font-bold text-lg leading-none text-white truncate">{{ name }}</span>
                  <span v-if="cos.titleText" class="st-title" :class="titleClass(cos.titleRarity, cos.titlePremium)">{{ cos.titleText }}</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="st-nv">NV {{ s.level }}</span>
                  <span class="st-bar" role="progressbar" :aria-valuenow="s.levelPct || 0" aria-valuemin="0" aria-valuemax="100" :aria-label="`Progreso del nivel ${s.level}`">
                    <span class="st-bar-fill" :style="{ width: (s.levelPct || 0) + '%' }"></span>
                    <span class="st-bar-t">{{ prog ? `${fmt(prog.earned)} / ${fmt(prog.range)}` : (tier ? tier.label : '') }}</span>
                  </span>
                  <img v-if="tier?.image" :src="tier.image" :alt="tier.label" width="22" height="26" class="w-[22px] h-[26px] shrink-0" />
                </div>
              </div>
            </div>
          </div>

          <!-- Accesos -->
          <nav aria-label="Accesos" class="grid grid-cols-3 gap-2">
            <button v-for="t in TILES" :key="t.key" type="button" class="st-tile" @click="pick(t)">
              <span class="st-tile-ic" :style="{ background: t.bg }">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="t.icon"/></svg>
              </span>
              <span class="flex flex-col text-left">
                <span class="font-bold text-[13px] leading-tight text-white">{{ t.title }}</span>
                <span class="text-[11px] font-semibold" :class="t.subCls || 'text-slate-400'">{{ t.sub }}</span>
              </span>
              <span v-if="t.badge > 0" class="st-badge">{{ t.badge > 9 ? '9+' : t.badge }}</span>
            </button>
          </nav>

          <!-- Premium -->
          <button type="button" class="st-premium" @click="pick({ to: '/pricing' })">
            <img src="/iconclaro.png" alt="" width="24" height="32" class="w-6 h-8" />
            <span class="flex-1 flex flex-col text-left">
              <span class="st-premium-t">PREMIUM · PRO Y LEGEND</span>
              <span class="text-[11.5px] text-slate-200">Más XP, más intentos por día y protectores de racha</span>
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fde68a" stroke-width="2.6" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
          </button>

          <!-- Ajustes + más -->
          <div class="st-list">
            <div class="st-row">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 010 6M18.5 6.5a8 8 0 010 11"/></svg>
              <span class="flex-1 text-sm font-semibold">Sonido</span>
              <button type="button" role="switch" :aria-checked="soundOn" aria-label="Sonido" class="st-switch" @click="toggleSound">
                <span class="st-track" :class="soundOn ? 'is-on' : ''"><span class="st-knob"></span></span>
              </button>
            </div>
            <div class="st-row">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></svg>
              <span class="flex-1 text-sm font-semibold">Idioma</span>
              <span class="text-[13px] text-slate-500 pr-1">Español</span>
            </div>
            <button v-for="r in ROWS" :key="r.key" type="button" class="st-row st-row-btn" @click="pick(r)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="r.icon"/></svg>
              <span class="flex-1 text-left text-sm font-semibold">{{ r.label }}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2.6" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
            </button>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <button type="button" class="st-legal" @click="pick({ to: '/privacidad' })">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/></svg>Privacidad
            </button>
            <button type="button" class="st-legal" @click="pick({ to: '/terminos' })">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6"/></svg>Términos
            </button>
          </div>

          <button type="button" class="st-logout" @click="doLogout">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/></svg>Cerrar sesión
          </button>

          <div class="flex items-center justify-between">
            <span class="text-[11px] text-slate-600">FULVO · Hecho en Argentina</span>
            <button v-if="ACCOUNT_DELETION_ENABLED" type="button" class="st-delete" @click="openDelete">Borrar cuenta</button>
          </div>
        </div>

        <!-- Confirmación de borrado -->
        <Transition name="sheet-fade">
          <div v-if="delOpen" class="st-del-wrap" role="alertdialog" aria-modal="true" aria-labelledby="st-del-t" aria-describedby="st-del-d">
            <div class="st-del">
              <h2 id="st-del-t" class="font-display font-bold text-lg text-white">¿Borrar tu cuenta?</h2>
              <p id="st-del-d" class="text-[13px] text-slate-300 leading-snug">Se borra para siempre tu progreso, XP, logros, Fichas, Balones, cosméticos y mensajes. Si tenés un plan pago, se cancela. No se puede deshacer.</p>
              <label for="st-del-in" class="text-xs font-bold text-slate-300">Para confirmar, escribí <strong class="text-red-300">{{ DELETE_CONFIRM_WORD }}</strong></label>
              <input id="st-del-in" ref="delInput" v-model="delText" type="text" class="st-del-in" autocomplete="off" autocapitalize="characters" spellcheck="false" :placeholder="DELETE_CONFIRM_WORD" :disabled="delBusy" @keydown.enter.prevent="confirmDelete" />
              <p v-if="delError" class="text-sm text-red-400" role="alert">{{ delError }}</p>
              <div class="grid grid-cols-2 gap-2 mt-1">
                <button type="button" class="st-del-no" :disabled="delBusy" @click="cancelDelete">Cancelar</button>
                <button type="button" class="st-del-yes" :disabled="delText.trim() !== DELETE_CONFIRM_WORD || delBusy" @click="confirmDelete">{{ delBusy ? 'Borrando…' : 'Borrar cuenta' }}</button>
              </div>
            </div>
          </div>
        </Transition>
      </section>
    </Transition>
  </Teleport>
</template>

<style scoped>
.st-sheet {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 66; margin: 0 auto; width: 100%; max-width: 32rem;
  top: max(88px, calc(env(safe-area-inset-top, 0px) + 64px)); display: flex; flex-direction: column;
  border-radius: 24px 24px 0 0; background: #0f172a; border-top: 1px solid rgba(255,255,255,0.12); box-shadow: 0 -20px 40px rgba(0,0,0,0.5);
}
@media (min-height: 900px) { .st-sheet { top: auto; max-height: 88dvh; } }
.st-grab { align-self: center; flex-shrink: 0; width: 42px; height: 5px; margin: 8px 0 2px; border-radius: 999px; background: rgba(255,255,255,0.22); }
.st-scroll {
  flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; display: flex; flex-direction: column; gap: 10px;
  padding: 8px 14px calc(18px + env(safe-area-inset-bottom, 0px));
}
.st-scroll > * { flex-shrink: 0; }
.st-profile { position: relative; border-radius: 18px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); background: #111a2e; }
.st-banner { height: 58px; }
.st-close { position: absolute; top: 7px; right: 7px; width: 44px; height: 44px; display: grid; place-items: center; color: #fff; }
.st-close > span { width: 32px; height: 32px; border-radius: 50%; background: rgba(0,0,0,0.45); display: grid; place-items: center; }
.st-av { flex-shrink: 0; border-radius: 50%; box-shadow: 0 6px 16px rgba(0,0,0,0.5); }
.st-title { font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 55%; }
.st-nv { flex-shrink: 0; height: 22px; padding: 0 7px; border-radius: 6px; background: linear-gradient(180deg, #818cf8, #4f46e5); border: 1.5px solid #c7d2fe; display: flex; align-items: center; font-family: var(--font-shout); font-weight: 800; font-size: 14px; color: #fff; }
.st-bar { position: relative; flex: 1; height: 14px; border-radius: 999px; background: rgba(255,255,255,0.08); overflow: hidden; display: block; }
.st-bar-fill { display: block; height: 100%; background: linear-gradient(90deg, #34d399, #22d3ee, #818cf8); transition: width .7s ease; }
.st-bar-t { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-family: var(--font-shout); font-weight: 800; font-size: 11px; color: #fff; text-shadow: 0 1px 2px #000; }
.st-tile {
  position: relative; min-height: 66px; box-sizing: border-box; border-radius: 14px; padding: 9px 8px; display: flex; flex-direction: column; justify-content: space-between; gap: 6px;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); transition: transform .12s ease, background-color .15s ease;
}
.st-tile:active { transform: scale(.97); background: rgba(255,255,255,0.08); }
.st-tile-ic { width: 28px; height: 28px; border-radius: 9px; display: grid; place-items: center; }
.st-badge { position: absolute; top: 7px; right: 7px; min-width: 20px; height: 20px; padding: 0 5px; border-radius: 999px; background: #f43f5e; font-size: 11px; font-weight: 800; line-height: 20px; text-align: center; color: #fff; }
.st-premium {
  min-height: 54px; border-radius: 16px; padding: 8px 12px; display: flex; align-items: center; gap: 10px;
  background: linear-gradient(110deg, rgba(251,191,36,0.22), rgba(168,85,247,0.18) 70%, rgba(15,23,42,0.4)); border: 1px solid rgba(251,191,36,0.45);
}
.st-premium-t { font-family: var(--font-shout); font-weight: 800; font-style: italic; font-size: 18px; line-height: 1; letter-spacing: .4px; color: #fde68a; }
.st-list { border-radius: 16px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); overflow: hidden; }
.st-row { min-height: 48px; padding: 0 8px 0 12px; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid rgba(255,255,255,0.06); color: #f1f5f9; width: 100%; }
.st-row:last-child { border-bottom: 0; }
.st-row-btn { padding-right: 12px; }
.st-row-btn:active { background: rgba(255,255,255,0.05); }
.st-switch { width: 60px; height: 44px; display: grid; place-items: center; }
.st-track { position: relative; width: 46px; height: 28px; border-radius: 999px; background: #334155; display: block; transition: background .18s ease; }
.st-track.is-on { background: linear-gradient(90deg, #22c55e, #4ade80); }
.st-knob { position: absolute; top: 3px; left: 3px; width: 22px; height: 22px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.4); transition: transform .18s ease; }
.is-on .st-knob { transform: translateX(18px); }
.st-legal { min-height: 44px; border-radius: 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 13px; font-weight: 600; color: #cbd5e1; }
.st-logout { min-height: 48px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.14); color: #f1f5f9; font-weight: 700; font-size: 14px; display: flex; align-items: center; justify-content: center; gap: 8px; }
.st-delete { min-height: 44px; padding: 0 4px; color: #f87171; font-size: 12.5px; font-weight: 600; text-decoration: underline; text-underline-offset: 3px; }
.st-del-wrap { position: absolute; inset: 0; z-index: 2; border-radius: 24px 24px 0 0; background: rgba(2,6,23,0.8); display: flex; align-items: flex-end; padding: 14px 14px calc(14px + env(safe-area-inset-bottom, 0px)); }
.st-del { width: 100%; border-radius: 18px; padding: 16px; background: #131d33; border: 1px solid rgba(248,113,113,0.4); display: flex; flex-direction: column; gap: 10px; }
.st-del-in { min-height: 48px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.14); background: #0b1220; color: #f1f5f9; padding: 0 12px; font-size: 15px; outline: none; letter-spacing: 2px; }
.st-del-in:focus { border-color: #f87171; box-shadow: 0 0 0 3px rgba(248,113,113,0.2); }
.st-del-no { min-height: 48px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.14); color: #e2e8f0; font-weight: 700; }
.st-del-yes { min-height: 48px; border-radius: 12px; background: #dc2626; color: #fff; font-weight: 800; }
.st-del-yes:disabled, .st-del-no:disabled { opacity: .4; }
.sheet-fade-enter-active, .sheet-fade-leave-active { transition: opacity .22s ease; }
.sheet-fade-enter-from, .sheet-fade-leave-to { opacity: 0; }
.sheet-up-enter-active { transition: transform .34s cubic-bezier(.16, 1, .3, 1), opacity .34s ease; }
.sheet-up-leave-active { transition: transform .2s ease-in, opacity .2s ease-in; }
.sheet-up-enter-from, .sheet-up-leave-to { transform: translateY(40px); opacity: 0; }
@media (prefers-reduced-motion: reduce) {
  .sheet-up-enter-active, .sheet-up-leave-active { transition: opacity .12s ease; }
  .sheet-up-enter-from, .sheet-up-leave-to { transform: none; }
  .st-track, .st-knob, .st-tile, .st-bar-fill { transition: none; }
}
</style>
