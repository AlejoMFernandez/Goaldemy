<script setup>
/**
 * Tarjeta de juego dentro del chat (ver services/chat-cards.js):
 *  - kind 'res'  → resultado compartido (Ganado/Perdido, marcador, estrellas).
 *  - kind 'reto' → reto a un juego. Si lo recibís, botón ACEPTAR RETO (vale
 *    solo el día que se mandó: los desafíos se renuevan a las 00:00).
 */
import { computed } from 'vue'
import GameThumb from './GameThumb.vue'

const props = defineProps({
  card: { type: Object, required: true },   // { kind, slug, name, score, win, stars }
  own: { type: Boolean, default: false },
  peerName: { type: String, default: '' },
  expired: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
})
defineEmits(['accept'])
const starsAria = computed(() => `${props.card.stars} de 3 estrellas`)
</script>

<template>
  <!-- Resultado compartido -->
  <article v-if="card.kind === 'res'" class="cc-res" :class="[own ? 'is-own' : 'is-peer', card.win ? 'is-win' : 'is-loss']"
    :aria-label="`Resultado compartido: ${card.name}, ${card.win ? 'ganado' : 'perdido'} ${card.score}`">
    <GameThumb :slug="card.slug" :w="58" :h="66" class="rounded-[10px]" />
    <div class="flex-1 min-w-0 flex flex-col gap-0.5">
      <span class="cc-kicker truncate">{{ card.name }} · HOY</span>
      <span class="cc-score">{{ card.win ? 'Ganado' : 'Perdido' }} {{ card.score }}</span>
      <span class="flex gap-0.5" :aria-label="starsAria">
        <svg v-for="i in 3" :key="i" width="14" height="14" viewBox="0 0 24 24" :fill="i <= card.stars ? '#fbbf24' : 'rgba(255,255,255,0.18)'" aria-hidden="true"><path d="M12 2l3 6.5 7 .8-5.2 4.8 1.4 7L12 17.6 5.8 21l1.4-7L2 9.3l7-.8z"/></svg>
      </span>
    </div>
  </article>

  <!-- Reto -->
  <article v-else class="cc-reto" :class="own ? 'is-own' : 'is-peer'" :aria-label="own ? `Tu reto: ${card.name}` : `Reto de ${peerName}: ${card.name}`">
    <div class="cc-head">
      <GameThumb :slug="card.slug" bleed />
      <span class="cc-tag">{{ own ? 'TU RETO' : 'RETO' }}</span>
      <span class="cc-title">{{ card.name }}</span>
    </div>
    <div class="cc-body">
      <template v-if="own">
        <div class="flex items-baseline gap-1.5">
          <span class="text-xs font-bold text-slate-400">{{ card.score ? 'Que supere tu' : 'Retaste a' }}</span>
          <span v-if="card.score" class="cc-big text-amber-200">{{ card.score }}</span>
          <span class="ml-auto text-[11px] font-bold text-slate-400 truncate">{{ expired ? 'vencido' : `esperando a ${peerName}` }}</span>
        </div>
      </template>
      <template v-else>
        <div class="flex items-center justify-between gap-2">
          <span class="text-[13px] text-slate-300">Te retó a <strong class="text-white">{{ card.name }}</strong></span>
          <span class="text-[11px] font-bold text-slate-400 shrink-0">{{ expired ? 'vencido' : 'vence a las 00:00' }}</span>
        </div>
        <div v-if="card.score" class="flex items-baseline gap-1.5">
          <span class="text-xs font-bold text-slate-400">Superá</span>
          <span class="cc-big text-red-300">{{ card.score }}</span>
        </div>
        <button type="button" class="cc-accept" :disabled="expired || busy" @click="$emit('accept', card)">
          {{ expired ? 'RETO VENCIDO' : (busy ? 'ABRIENDO…' : 'ACEPTAR RETO') }}
        </button>
      </template>
    </div>
  </article>
</template>

<style scoped>
.cc-res {
  width: 250px; max-width: 80%; border-radius: 18px; padding: 10px 12px 10px 10px; display: flex; gap: 11px; align-items: center;
  background: linear-gradient(160deg, var(--tint), #111a2e 68%); border: 1px solid var(--ring);
}
.cc-res.is-own { align-self: flex-end; border-bottom-right-radius: 4px; }
.cc-res.is-peer { align-self: flex-start; border-bottom-left-radius: 4px; }
.cc-res.is-win { --tint: rgba(74,222,128,0.18); --ring: rgba(74,222,128,0.45); --acc: #86efac; --sc: #4ade80; }
.cc-res.is-loss { --tint: rgba(248,113,113,0.16); --ring: rgba(248,113,113,0.45); --acc: #fca5a5; --sc: #f87171; }
.cc-kicker { font-family: var(--font-shout); font-weight: 800; font-size: 13px; letter-spacing: 1px; color: var(--acc); text-transform: uppercase; }
.cc-score { font-family: var(--font-shout); font-weight: 800; font-size: 26px; line-height: 1; color: var(--sc); }
.cc-reto { width: 268px; max-width: 82%; border-radius: 18px; overflow: hidden; background: #111a2e; box-shadow: 0 10px 24px rgba(0,0,0,0.35); }
.cc-reto.is-peer { align-self: flex-start; border: 1px solid rgba(248,113,113,0.45); border-bottom-left-radius: 4px; }
.cc-reto.is-own { align-self: flex-end; width: 260px; border: 1px solid rgba(251,191,36,0.5); border-bottom-right-radius: 4px; }
.cc-head { position: relative; height: 78px; overflow: hidden; }
.is-own .cc-head { height: 64px; }
.cc-tag { position: absolute; left: 12px; top: 9px; padding: 2px 8px; border-radius: 6px; background: rgba(0,0,0,0.45); font-family: var(--font-shout); font-weight: 800; font-size: 13px; letter-spacing: 1px; color: #fecaca; }
.is-own .cc-tag { color: #fde68a; font-size: 12px; }
.cc-title { position: absolute; left: 12px; bottom: 8px; right: 12px; font-family: var(--font-shout); font-weight: 800; font-style: italic; font-size: 24px; line-height: 1; text-transform: uppercase; color: #fff; text-shadow: 0 2px 6px rgba(0,0,0,0.6); }
.is-own .cc-title { font-size: 22px; bottom: 7px; }
.cc-body { padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 10px; }
.is-own .cc-body { padding: 9px 12px 11px; }
.cc-big { font-family: var(--font-shout); font-weight: 800; font-size: 32px; line-height: .9; }
.cc-accept {
  min-height: 46px; border-radius: 12px; background: linear-gradient(180deg, #fcd34d, #f59e0b); border-bottom: 4px solid #b45309; color: #1c1206;
  font-family: var(--font-shout); font-weight: 800; font-style: italic; font-size: 20px; letter-spacing: .5px;
}
.cc-accept:active:not(:disabled) { transform: translateY(2px); border-bottom-width: 2px; }
.cc-accept:disabled { background: #1e293b; border-bottom-color: #0f172a; color: #64748b; }
</style>
