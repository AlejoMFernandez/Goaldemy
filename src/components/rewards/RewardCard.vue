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
      if (this.reward.type === 'levelUp') return { emoji: '⬆️', color: 'yellow' }
      if (this.reward.type === 'streak') return { emoji: '🔥', color: 'orange' }
      return { emoji: '🎁', color: 'cyan' }
    },
    title() {
      if (this.reward.type === 'achievement') return this.reward.data?.title || 'Logro desbloqueado'
      if (this.reward.type === 'levelUp') return `Nivel ${this.reward.data?.level || '?'}`
      if (this.reward.type === 'streak') return `Racha de ${this.reward.data?.days || '?'} días`
      return 'Recompensa'
    },
    subtitle() {
      if (this.reward.type === 'achievement') return 'Logro'
      if (this.reward.type === 'levelUp') return 'Subida de nivel'
      if (this.reward.type === 'streak') return 'Racha diaria'
      return 'Recompensa'
    },
    points() {
      return this.reward.data?.points || 0
    },
    borderColor() {
      const c = this.icon.color
      return {
        emerald: 'border-emerald-500/30 hover:border-emerald-500/50',
        yellow: 'border-yellow-500/30 hover:border-yellow-500/50',
        orange: 'border-orange-500/30 hover:border-orange-500/50',
        cyan: 'border-cyan-500/30 hover:border-cyan-500/50',
      }[c] || 'border-white/15'
    }
  }
}
</script>

<template>
  <div
    class="rounded-xl border p-3 flex items-center gap-3 transition-all duration-200"
    :class="[borderColor, reward.claimed ? 'opacity-50 bg-white/2' : 'bg-white/5']"
  >
    <div class="shrink-0 w-10 h-10 rounded-lg grid place-items-center text-xl"
      :class="{
        'bg-emerald-500/15': icon.color === 'emerald',
        'bg-yellow-500/15': icon.color === 'yellow',
        'bg-orange-500/15': icon.color === 'orange',
        'bg-cyan-500/15': icon.color === 'cyan',
      }"
    >
      {{ icon.emoji }}
    </div>

    <div class="min-w-0 flex-1">
      <p class="text-sm font-semibold text-white truncate">{{ title }}</p>
      <p class="text-[11px] text-slate-400">{{ subtitle }}</p>
    </div>

    <div v-if="!reward.claimed" class="shrink-0">
      <button
        @click="$emit('claim', reward.id)"
        class="rounded-lg px-3 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110 active:scale-95 transition-all"
      >
        +{{ points }} XP
      </button>
    </div>
    <div v-else class="shrink-0">
      <span class="text-xs text-slate-500 font-medium">Reclamado</span>
    </div>
  </div>
</template>
