<script>
export default {
  name: 'RewardCard',
  props: {
    reward: { type: Object, required: true },
  },
  emits: ['claim'],
  computed: {
    icon() {
      if (this.reward.type === 'achievement') return { emoji: '🏆', color: 'emerald' }
      if (this.reward.type === 'milestone') return { emoji: '🏅', color: this.reward.data?.color || 'amber' }
      if (this.reward.type === 'levelUp') return { emoji: '⬆️', color: 'yellow' }
      if (this.reward.type === 'streak') return { emoji: '🔥', color: 'orange' }
      return { emoji: '🎁', color: 'cyan' }
    },
    title() {
      if (this.reward.type === 'achievement') return this.reward.data?.title || 'Logro desbloqueado'
      if (this.reward.type === 'milestone') return `Rango: ${this.reward.data?.tier || '?'}`
      if (this.reward.type === 'levelUp') return `Nivel ${this.reward.data?.level || '?'}`
      if (this.reward.type === 'streak') return `Racha de ${this.reward.data?.days || '?'} días`
      return 'Recompensa'
    },
    subtitle() {
      if (this.reward.type === 'achievement') return 'Logro'
      if (this.reward.type === 'milestone') return `Nivel ${this.reward.data?.level} alcanzado`
      if (this.reward.type === 'levelUp') return 'Subida de nivel'
      if (this.reward.type === 'streak') return 'Racha diaria'
      return 'Recompensa'
    },
    points() {
      return this.reward.data?.xpBonus || this.reward.data?.points || 0
    },
    timeAgo() {
      if (!this.reward.createdAt) return ''
      const diff = Date.now() - this.reward.createdAt
      const mins = Math.floor(diff / 60000)
      if (mins < 1) return 'ahora'
      if (mins < 60) return `hace ${mins}m`
      const hrs = Math.floor(mins / 60)
      if (hrs < 24) return `hace ${hrs}h`
      const days = Math.floor(hrs / 24)
      return `hace ${days}d`
    },
    iconBg() {
      return {
        emerald: 'linear-gradient(160deg,#10b981,#064e3b)',
        yellow: 'linear-gradient(160deg,#facc15,#713f12)',
        amber: 'linear-gradient(160deg,#f59e0b,#78350f)',
        orange: 'linear-gradient(160deg,#fb923c,#7c2d12)',
        red: 'linear-gradient(160deg,#ef4444,#450a0a)',
        cyan: 'linear-gradient(160deg,#38bdf8,#0369a1)',
      }[this.icon.color] || 'linear-gradient(160deg,#64748b,#1e293b)'
    },
  }
}
</script>

<template>
  <!-- Fila estilo V4 (misma familia que MissionRow): va dentro de una lista con borde -->
  <div :data-reward-id="reward.id" class="rcard" :class="{ 'is-claimed': reward.claimed, 'is-pending': !reward.claimed }">
    <span class="rcard-ic" :style="{ background: iconBg }" aria-hidden="true">{{ icon.emoji }}</span>

    <span class="rcard-body">
      <span class="rcard-title">{{ title }}</span>
      <span class="rcard-sub">{{ subtitle }}<template v-if="timeAgo"> · {{ timeAgo }}</template></span>
    </span>

    <button v-if="!reward.claimed" type="button" class="rcard-claim"
            :aria-label="`Cobrar ${points} XP de ${title}`" @click="$emit('claim', reward.id, $event.currentTarget)">
      +{{ points }} XP
    </button>
    <span v-else class="rcard-done">Cobrado</span>
  </div>
</template>

<style scoped>
.rcard {
  display: flex; align-items: center; gap: 12px; padding: 12px 14px;
  border-bottom: 1px solid rgba(255,255,255,0.07);
}
.rcard:last-child { border-bottom: 0; }
.rcard.is-pending { background: rgba(34,197,94,0.07); }
.rcard-ic {
  width: 44px; height: 44px; flex-shrink: 0; border-radius: 12px; display: grid; place-items: center;
  font-size: 22px; line-height: 1; box-shadow: inset 0 1px 0 rgba(255,255,255,.18);
}
.is-claimed .rcard-ic { filter: grayscale(.85) brightness(.7); }
.rcard-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.rcard-title { font-weight: 700; font-size: 14px; color: #f1f5f9; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.is-claimed .rcard-title { color: #64748b; text-decoration: line-through; }
.rcard-sub { font-size: 12px; color: #94a3b8; }
.rcard-claim {
  min-height: 44px; padding: 0 12px; border: 0; border-radius: 12px; background: #22c55e; box-shadow: 0 4px 0 #15803d;
  color: #fff; font-family: var(--font-bug); font-weight: 800; font-size: 16px; white-space: nowrap; cursor: pointer;
  transform: translateY(-2px); transition: transform .08s ease, box-shadow .08s ease;
}
.rcard-claim:active { transform: translateY(2px); box-shadow: 0 0 0 #15803d; }
.rcard-claim:focus-visible { outline: 2px solid #bbf7d0; outline-offset: 2px; }
.rcard-done { font-family: var(--font-bug); font-weight: 800; font-size: 13px; color: #64748b; text-transform: uppercase; }
@media (prefers-reduced-motion: reduce) { .rcard-claim { transition: none; } }
</style>
