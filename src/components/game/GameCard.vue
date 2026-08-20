<script setup>
import { RouterLink } from 'vue-router'
import { getGameTypeLabel } from '../../services/games'

defineProps({
  game: { type: Object, required: true },
  unlocked: { type: Boolean, default: true },
  unlockLevel: { type: [Number, String], default: null },
  availability: { type: Object, default: null },
  streak: { type: Number, default: 0 },
  showAyudas: { type: Boolean, default: false },
  to: { type: String, default: '' },
})
</script>

<template>
  <!-- Bloqueado -->
  <div
    v-if="!unlocked"
    class="relative flex flex-col rounded-2xl overflow-hidden border border-white/5 bg-gradient-to-b from-slate-800/40 to-slate-900/60 opacity-60 cursor-not-allowed select-none"
  >
    <div class="relative flex items-center justify-center h-36 bg-slate-800/40">
      <img
        v-if="game.cover_url"
        :src="game.cover_url"
        :alt="game.name"
        class="w-24 h-24 object-contain opacity-20 grayscale"
      />
      <div class="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/40">
        <svg class="w-10 h-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
        <span class="text-[10px] text-slate-400 font-semibold text-center px-2 leading-tight">
          Nivel {{ unlockLevel }}
        </span>
      </div>
    </div>
    <div class="bg-slate-900/90 px-3 py-3 border-t border-white/5 text-center">
      <div class="font-display font-bold text-slate-500 text-xs tracking-widest uppercase">BLOQUEADO</div>
      <div class="text-slate-500 text-xs mt-0.5 truncate">{{ game.name }}</div>
    </div>
  </div>

  <!-- Desbloqueado — tratamiento único de card de juego para toda la Zona Hub -->
  <RouterLink
    v-else
    :to="to"
    class="game-card group relative flex flex-col surface-solid overflow-hidden transition-all duration-300 hover:-translate-y-1 active:scale-[0.98]"
    :class="[
      availability?.result === 'win' ? 'is-win' : availability?.result === 'loss' ? 'is-loss' : ''
    ]"
  >
    <div class="relative flex items-center justify-center h-36 bg-black/20 overflow-hidden">
      <div class="card-tint pointer-events-none absolute inset-0"></div>

      <div class="absolute top-2 left-2 right-2 z-20 flex items-start justify-between gap-2">
        <span v-if="getGameTypeLabel(game.slug)" class="min-w-0 truncate max-w-[60%] rounded-md bg-slate-950/70 backdrop-blur px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-200 ring-1 ring-white/10">
          {{ getGameTypeLabel(game.slug) }}
        </span>

        <div v-if="streak > 0" class="z-20 flex items-center gap-1 rounded-full bg-slate-900/90 ring-1 ring-amber-400/30 shadow-[0_0_12px_rgba(251,191,36,0.25)] px-2 py-0.5 shrink-0">
          <svg class="w-3 h-3 text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.5)]" viewBox="0 0 24 24" fill="currentColor"><path d="M12 23c-3.6 0-8-3.1-8-8.5C4 9 8 4 11.5 1c.2-.1.4-.1.5 0 .2.1.2.3.1.5C11 4 14 6 14 6s1-1.5 1.5-4c0-.2.2-.3.4-.3s.3.1.4.3C18 5 20 9 20 14.5 20 19.9 15.6 23 12 23z"/></svg>
          <span class="text-amber-300 font-bold text-[11px] leading-none tabular-nums">{{ streak }}</span>
        </div>
      </div>

      <span
        v-if="showAyudas"
        class="absolute bottom-2 left-2 z-20 inline-flex items-center gap-0.5 rounded-md bg-amber-500/15 ring-1 ring-amber-400/30 px-1.5 py-0.5 text-amber-300"
        title="Podés usar ayudas en este juego"
      >
        <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
        <span class="text-[9px] font-bold uppercase tracking-wide">Ayudas</span>
      </span>

      <div
        v-if="availability?.available === false"
        class="absolute inset-0 flex items-center justify-center bg-black/50 z-10"
      >
        <div
          v-if="availability?.result === 'win'"
          class="w-14 h-14 rounded-2xl flex items-center justify-center ring-1 ring-emerald-400/40 bg-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
        >
          <span class="text-emerald-400 text-3xl font-extrabold leading-none">✓</span>
        </div>
        <div
          v-else
          class="w-14 h-14 rounded-2xl flex items-center justify-center ring-1 ring-red-400/40 bg-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.3)]"
        >
          <span class="text-red-400 text-3xl font-extrabold leading-none">✕</span>
        </div>
      </div>
      <img
        v-if="game.cover_url"
        :src="game.cover_url"
        :alt="game.name"
        width="104" height="104" loading="lazy" decoding="async"
        class="relative w-[104px] h-[104px] object-contain transition-transform duration-300 group-hover:scale-110 drop-shadow-[0_6px_16px_rgba(0,0,0,0.4)]"
        :class="availability?.available === false ? 'opacity-30' : 'opacity-95'"
      />
    </div>
    <div class="px-3 py-2.5 border-t border-white/5 flex items-center gap-2">
      <span class="min-w-0 flex-1 font-display font-bold text-white text-[13px] leading-tight truncate">{{ game.name }}</span>
      <span class="card-cta shrink-0 text-[11px] font-extrabold whitespace-nowrap">
        {{ availability?.available === false ? 'Ver →' : 'Jugar →' }}
      </span>
    </div>
  </RouterLink>
</template>

<style scoped>
/* Tinte de acento Hub (violeta-índigo) — reemplaza el sistema anterior de color
   por tipo de juego (--c / getGameTypeColor), que dependía de un fallback
   esmeralda hardcodeado. Un solo acento para toda la Zona Hub. */
.card-tint {
  background: radial-gradient(78% 78% at 50% 42%, color-mix(in srgb, var(--hub-500) 20%, transparent), transparent 72%);
  opacity: .68;
  transition: opacity .3s ease;
}
.game-card:hover .card-tint { opacity: 1; }
.game-card:hover { border-color: color-mix(in srgb, var(--hub-500) 42%, transparent); box-shadow: 0 14px 34px rgba(0,0,0,.42); }

.game-card.is-win {
  border-color: rgba(16,185,129,.4);
  box-shadow: 0 0 20px rgba(16,185,129,.15);
}
.game-card.is-loss {
  border-color: rgba(239,68,68,.4);
  box-shadow: 0 0 20px rgba(239,68,68,.15);
}

.card-cta {
  color: var(--hub-400);
  opacity: 0;
  transform: translateX(-5px);
  transition: opacity .2s ease, transform .2s ease;
}
.game-card:hover .card-cta { opacity: 1; transform: none; }
@media (hover: none) {
  .card-cta { opacity: .9; transform: none; }
}
</style>
