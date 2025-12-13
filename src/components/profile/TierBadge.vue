<script>
import { getTierForLevel, getNextTier, TIERS, tierColorClasses } from '../../services/tiers'

export default {
  name: 'TierBadge',
  props: {
    levelInfo: { type: Object, default: null },
  },
  computed: {
    level() { return this.levelInfo?.level ?? 0 },
    xpTotal() { return this.levelInfo?.xp_total ?? 0 },
    tier() { return getTierForLevel(this.level) },
    nextTier() { return getNextTier(this.level) },
    colorClasses() { return tierColorClasses(this.tier?.color) },
    unlockedTiers() {
      const lvl = this.level
      return TIERS.filter(t => lvl >= (t.minLevel || 1)).sort((a,b) => (a.minLevel||0) - (b.minLevel||0))
    },
  }
}
</script>

<template>
  <div class="card p-6">
    <div class="flex items-center justify-between">
      <p class="text-xs uppercase tracking-wide text-slate-400">Insignia</p>
      <span v-if="tier" :class="['inline-flex items-center rounded-full px-2 py-0.5 text-xs border', colorClasses]">{{ tier.label }}</span>
    </div>
    <div class="mt-3 flex items-center gap-4">
      <div class="h-16 w-16 rounded-xl overflow-hidden grid place-items-center border border-white/10 bg-white/5">
        <img v-if="tier?.image" :src="tier.image" alt="badge" class="w-full h-full object-contain"/>
        <span v-else class="text-2xl">{{ tier?.emoji || '🏅' }}</span>
      </div>
      <div class="flex-1">
        <p class="text-slate-200 font-medium">{{ tier?.label || '—' }}</p>
        <p v-if="nextTier" class="text-xs text-slate-400 mt-0.5">
          Avanzá hasta {{ nextTier.label }} en nivel {{ nextTier.minLevel }}
        </p>
        <p v-else class="text-xs text-slate-400 mt-0.5">Máxima insignia configurada alcanzada</p>
      </div>
    </div>

    <div class="mt-4">
      <p class="text-[10px] uppercase tracking-wider text-slate-400">Insignias logradas</p>
      <div class="mt-2 flex flex-wrap gap-2">
        <div v-for="b in unlockedTiers" :key="b.key" class="rounded-lg border border-white/10 bg-white/5 px-2 py-1 inline-flex items-center gap-1">
          <img v-if="b.image" :src="b.image" alt="b" class="h-5 w-5 object-contain"/>
          <span v-else class="text-base leading-none">{{ b.emoji || '🏅' }}</span>
          <span class="text-xs text-slate-200">{{ b.label }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

