<script setup>
/**
 * Popup de BIENVENIDA PRO / LEGEND.
 * Se muestra una vez, la primera vez que detectamos plan pago (guard por
 * usuario en localStorage), ANTES de la lluvia de cosméticos desbloqueados
 * (CosmeticUnlockOverlay espera mientras notificationsState.proWelcome != null).
 */
import { computed } from 'vue'
import { notificationsState, clearProWelcome } from '../../stores/notifications'
import { getAuthUser } from '../../services/auth'
import { planStyle } from '../../services/plans-ui'
import { triggerConfetti } from '../../services/confetti'
import { soundManager } from '../../services/sounds'

const pw = computed(() => notificationsState.proWelcome)
const isLegend = computed(() => pw.value?.plan === 'legend')
const style = computed(() => planStyle(pw.value?.plan || 'pro'))

const xpBonusPct = computed(() => {
  const m = pw.value?.xpMultiplier || 1
  return m > 1 ? Math.round((m - 1) * 100) : 0
})
const protectors = computed(() => pw.value?.weeklyStreakProtectors || (isLegend.value ? 3 : 1))
const powerups = computed(() => pw.value?.dailyPowerups || (isLegend.value ? 15 : 5))

const perks = computed(() => {
  const p = []
  if (xpBonusPct.value > 0) p.push({ icon: 'bolt', title: `Bonus de XP +${xpBonusPct.value}%`, desc: 'Subís de nivel más rápido en cada partida.' })
  p.push({ icon: 'powerup', title: `${powerups.value} ayudas por día`, desc: '50/50, escudo, tiempo extra y pistas para tus partidas.' })
  p.push({ icon: 'pass', title: 'Pase de Batalla PRO', desc: 'Track premium con recompensas y cosméticos exclusivos cada mes.' })
  p.push({ icon: 'cosmetic', title: 'Cosméticos exclusivos', desc: 'Íconos, bordes, banners y títulos que solo tienen los PRO.' })
  if (protectors.value > 0) p.push({ icon: 'shield', title: `${protectors.value} protector${protectors.value === 1 ? '' : 'es'} de racha/semana`, desc: 'No pierdas tu racha si un día no podés jugar.' })
  p.push({ icon: 'badge', title: `Etiqueta ${pw.value?.planName || 'PRO'} en tu perfil`, desc: 'Que todos vean tu plan al entrar a tu perfil.' })
  return p
})

const ICONS = {
  bolt: 'M13 10V3L4 14h7v7l9-11h-7z',
  powerup: 'M12 2l2.4 7.4H22l-6 4.6 2.3 7.4L12 17l-6.3 4.4L8 14 2 9.4h7.6z',
  pass: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  cosmetic: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4l2 3h8a2 2 0 012 2v9a2 2 0 01-2 2H7z',
  shield: 'M12 3l7 4v5c0 4.5-3 8-7 9-4-1-7-4.5-7-9V7l7-4z',
  badge: 'M9 12l2 2 4-4m5.6-4A12 12 0 0112 2.9 12 12 0 013.4 6 12 12 0 003 9c0 5.6 3.8 10.3 9 11.6 5.2-1.3 9-6 9-11.6 0-1-.1-2-.4-3z',
}

function close() {
  try {
    const { id } = getAuthUser() || {}
    if (id) localStorage.setItem(`gl:pro_welcome_seen:${id}`, '1')
  } catch {}
  clearProWelcome()
}

function onEnter() {
  try { soundManager.play('achievement') } catch {}
  try {
    triggerConfetti({ particleCount: 90, colors: isLegend.value
      ? ['#fbbf24', '#f59e0b', '#fde047', '#fff7ed']
      : ['#e879f9', '#d946ef', '#f0abfc', '#a855f7'] })
  } catch {}
}
</script>

<template>
  <Teleport to="body">
    <Transition name="prow-fade" @enter="onEnter">
      <div v-if="pw" class="fixed inset-0 z-[65] grid place-items-center p-4">
        <div class="absolute inset-0 bg-black/85 backdrop-blur-md"></div>

        <div class="relative w-full max-w-lg rounded-3xl border bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 shadow-2xl overflow-hidden"
             :class="isLegend ? 'border-amber-500/40' : 'border-fuchsia-500/40'"
             style="animation: prow-pop 0.5s var(--ease-bounce, cubic-bezier(0.34,1.56,0.64,1)) both">
          <!-- Glow superior -->
          <div class="absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-48 rounded-full blur-3xl opacity-30"
               :class="isLegend ? 'bg-amber-500' : 'bg-fuchsia-500'"></div>

          <div class="relative p-6 sm:p-7">
            <!-- Header -->
            <div class="text-center mb-5">
              <div class="inline-grid place-items-center w-16 h-16 rounded-2xl mb-3 shadow-lg"
                   :class="isLegend ? 'bg-gradient-to-br from-amber-400 to-yellow-600' : 'bg-gradient-to-br from-fuchsia-500 to-violet-600'">
                <svg class="w-9 h-9 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
              </div>
              <div class="text-[11px] uppercase tracking-widest font-bold mb-1" :class="isLegend ? 'text-amber-300' : 'text-fuchsia-300'">Bienvenido a</div>
              <h2 class="font-display text-3xl font-extrabold text-white">Plan {{ pw.planName }}</h2>
              <p class="text-sm text-slate-400 mt-1">Desbloqueaste todos estos beneficios 🎉</p>
            </div>

            <!-- Perks -->
            <div class="space-y-2 mb-6 max-h-[46vh] overflow-y-auto pr-1">
              <div v-for="(perk, i) in perks" :key="i"
                   class="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div class="shrink-0 grid place-items-center w-9 h-9 rounded-lg"
                     :class="isLegend ? 'bg-amber-500/15 text-amber-300' : 'bg-fuchsia-500/15 text-fuchsia-300'">
                  <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" :d="ICONS[perk.icon]" /></svg>
                </div>
                <div class="min-w-0">
                  <div class="text-sm font-bold text-white leading-tight">{{ perk.title }}</div>
                  <div class="text-xs text-slate-400 leading-snug mt-0.5">{{ perk.desc }}</div>
                </div>
              </div>
            </div>

            <button @click="close"
                    class="w-full rounded-2xl py-3.5 font-display font-bold text-lg transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
                    :class="isLegend ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-black shadow-lg shadow-amber-500/25' : 'bg-gradient-to-r from-fuchsia-500 to-violet-500 text-white shadow-lg shadow-fuchsia-500/25'">
              ¡Empezar!
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.prow-fade-enter-active { transition: opacity 0.3s ease; }
.prow-fade-leave-active { transition: opacity 0.25s ease; }
.prow-fade-enter-from, .prow-fade-leave-to { opacity: 0; }
@keyframes prow-pop { from { opacity: 0; transform: scale(0.9) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
</style>
