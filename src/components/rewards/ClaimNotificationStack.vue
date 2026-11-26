<script>
import { computed } from 'vue'
import { notificationsState } from '@/stores/notifications'

/**
 * Aviso chico de respaldo (reclamos del pase, misiones, bandeja…).
 * UNO por vez, arriba, debajo de la TopBar y respetando la safe area: nunca se apila
 * ni tapa botones (antes era una pila de hasta 6 abajo a la derecha, encima del
 * resumen de partida). Lo que se desbloquea tiene su escena; esto es solo respaldo.
 */
export default {
  name: 'ClaimNotificationStack',
  setup() {
    const notif = computed(() => notificationsState.claimShown)
    return { notif }
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="cn-wrap" aria-live="polite">
      <Transition name="cn">
        <div v-if="notif" :key="notif.id" class="cn">
          <span class="cn-ico" aria-hidden="true">{{ notif.emoji }}</span>
          <div class="cn-tx">
            <p class="cn-t">{{ notif.title }}</p>
            <p v-if="notif.xp > 0" class="cn-s xp">+{{ notif.xp }} XP</p>
            <p v-else-if="notif.sub" class="cn-s">{{ notif.sub }}</p>
          </div>
        </div>
      </Transition>
    </div>
  </Teleport>
</template>

<style scoped>
.cn-wrap { position: fixed; left: 50%; top: calc(env(safe-area-inset-top, 0px) + var(--shell-topbar-h, 56px) + 8px); transform: translateX(-50%); z-index: 70; width: min(92vw, 360px); pointer-events: none; display: grid; }
.cn { display: flex; align-items: center; gap: 10px; padding: 9px 14px 9px 10px; border-radius: 14px; background: rgba(11, 16, 36, .95); border: 1px solid rgba(255, 255, 255, .14); box-shadow: 0 12px 30px rgba(0, 0, 0, .5); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); }
.cn-ico { font-size: 22px; line-height: 1; flex: none; }
.cn-tx { flex: 1; min-width: 0; }
.cn-t { margin: 0; font-size: 14px; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cn-s { margin: 1px 0 0; font-size: 12px; color: #94a3b8; }
.cn-s.xp { color: #34d399; font-weight: 700; }
.cn-enter-active { transition: opacity .25s ease, transform .3s cubic-bezier(.34, 1.56, .64, 1); }
.cn-leave-active { transition: opacity .2s ease, transform .2s ease-in; }
.cn-enter-from { opacity: 0; transform: translateY(-14px) scale(.96); }
.cn-leave-to { opacity: 0; transform: translateY(-8px); }
@media (prefers-reduced-motion: reduce) { .cn-enter-active, .cn-leave-active { transition: opacity .12s; } .cn-enter-from, .cn-leave-to { transform: none; } }
</style>
