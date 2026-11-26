<script setup>
/**
 * Hoja "Compartir un juego de hoy" del chat (+): lista los desafíos que ya
 * jugaste hoy y deja MANDAR RESULTADO o RETAR A ESTE JUEGO.
 */
import { ref, watch, computed } from 'vue'
import { RouterLink } from 'vue-router'
import GameThumb from './GameThumb.vue'
import { loadTodayPlayed } from '../../services/chat-cards'
import { tap } from '../../services/haptics'

const props = defineProps({
  open: { type: Boolean, default: false },
  preferReto: { type: Boolean, default: false },
})
const emit = defineEmits(['close', 'send'])

const loading = ref(false)
const error = ref(false)
const played = ref([])
const total = ref(0)
const sel = ref(0)
let loadedAt = 0

async function load() {
  if (Date.now() - loadedAt < 60000 && played.value.length) return
  loading.value = true
  error.value = false
  try {
    const r = await loadTodayPlayed()
    played.value = r.played
    total.value = r.total
    sel.value = 0
    loadedAt = Date.now()
  } catch { error.value = true }
  finally { loading.value = false }
}
watch(() => props.open, (v) => { if (v) load() }, { immediate: true })

const current = computed(() => played.value[sel.value] || null)
function pick(i) { tap(); sel.value = i }
function send(kind) {
  if (!current.value) return
  emit('send', { kind, game: current.value })
}
</script>

<template>
  <Transition name="cs-fade">
    <button v-if="open" type="button" class="cs-scrim" aria-label="Cerrar hoja de compartir" @click="emit('close')"></button>
  </Transition>
  <Transition name="cs-up">
    <section v-if="open" id="chat-share-sheet" class="cs-sheet" role="dialog" aria-label="Compartir un juego de hoy">
      <span class="cs-grab" aria-hidden="true"></span>
      <div class="flex items-center justify-between">
        <div class="flex flex-col gap-px">
          <span class="font-display font-bold text-[17px] text-white">{{ preferReto ? 'Retar con un juego de hoy' : 'Compartir un juego de hoy' }}</span>
          <span v-if="!loading && played.length" class="text-xs text-slate-400">Jugaste {{ played.length }} de {{ total }} · elegí uno</span>
        </div>
        <button type="button" class="cs-x" aria-label="Cerrar" @click="emit('close')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </div>

      <div v-if="loading" class="flex flex-col gap-1.5" aria-busy="true">
        <div v-for="i in 3" :key="i" class="h-[60px] rounded-[14px] bg-white/5 animate-pulse"></div>
      </div>
      <div v-else-if="error" class="py-4 text-center text-sm text-slate-400">No pudimos traer tus juegos de hoy.
        <button type="button" class="block mx-auto mt-2 min-h-[44px] px-4 font-bold text-amber-300" @click="loadedAt = 0; load()">Reintentar</button>
      </div>
      <div v-else-if="!played.length" class="py-3 text-center">
        <p class="text-sm text-slate-300">Todavía no jugaste ningún desafío hoy.</p>
        <p class="text-xs text-slate-500 mt-1">Jugá uno y volvé para mandar tu resultado o retar con ese juego.</p>
        <RouterLink to="/play/points" class="cs-go mt-3">JUGAR</RouterLink>
      </div>
      <template v-else>
        <div role="radiogroup" aria-label="Juegos jugados hoy" class="cs-list">
          <button v-for="(g, i) in played" :key="g.slug" type="button" role="radio" :aria-checked="sel === i" class="cs-opt" :class="sel === i ? 'is-on' : ''" @click="pick(i)">
            <GameThumb :slug="g.slug" />
            <span class="flex-1 min-w-0 flex flex-col gap-0.5">
              <span class="cs-name truncate">{{ g.name }}</span>
              <span class="flex items-center gap-1.5">
                <span class="cs-chip" :class="g.win ? 'is-win' : 'is-loss'">{{ (g.win ? 'Ganado' : 'Perdido') + (g.score ? ' ' + g.score : '') }}</span>
                <span class="flex gap-px" :aria-label="`${g.stars} de 3 estrellas`">
                  <svg v-for="k in 3" :key="k" width="12" height="12" viewBox="0 0 24 24" :fill="k <= g.stars ? '#fbbf24' : 'rgba(255,255,255,0.18)'" aria-hidden="true"><path d="M12 2l3 6.5 7 .8-5.2 4.8 1.4 7L12 17.6 5.8 21l1.4-7L2 9.3l7-.8z"/></svg>
                </span>
              </span>
            </span>
            <span class="cs-radio" aria-hidden="true">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1c1206" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg>
            </span>
          </button>
        </div>
        <div class="grid grid-cols-2 gap-2 mt-0.5">
          <button type="button" class="cs-reto" @click="send('reto')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2"/></svg>RETAR A ESTE JUEGO
          </button>
          <button type="button" class="cs-send" @click="send('res')">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12l16-8-6 16-3-6.5z"/></svg>MANDAR RESULTADO
          </button>
        </div>
      </template>
    </section>
  </Transition>
</template>

<style scoped>
.cs-scrim { position: absolute; left: 0; right: 0; top: 0; bottom: var(--cs-bottom, 60px); z-index: 6; background: rgba(2,6,23,0.62); border: 0; padding: 0; }
.cs-sheet {
  position: absolute; left: 8px; right: 8px; bottom: calc(var(--cs-bottom, 60px) + 6px); z-index: 7; border-radius: 22px; padding: 8px 12px 12px;
  background: #131d33; border: 1px solid rgba(255,255,255,0.12); box-shadow: 0 -10px 40px rgba(0,0,0,0.55);
  display: flex; flex-direction: column; gap: 8px; max-height: min(64dvh, 520px);
}
.cs-grab { align-self: center; width: 40px; height: 4px; border-radius: 999px; background: rgba(255,255,255,0.2); }
.cs-x { width: 44px; height: 44px; border-radius: 12px; background: rgba(255,255,255,0.05); color: #cbd5e1; display: grid; place-items: center; }
.cs-list { display: flex; flex-direction: column; gap: 6px; overflow-y: auto; overscroll-behavior: contain; min-height: 0; }
.cs-opt {
  min-height: 60px; padding: 6px 10px 6px 6px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.03);
  color: #f1f5f9; text-align: left; display: flex; align-items: center; gap: 10px; transition: background-color .15s ease, border-color .15s ease;
}
.cs-opt.is-on { background: rgba(251,191,36,0.1); border-color: rgba(251,191,36,0.6); }
.cs-name { font-family: var(--font-shout); font-weight: 800; font-style: italic; font-size: 17px; line-height: 1; text-transform: uppercase; }
.cs-chip { padding: 1px 6px; border-radius: 5px; font-size: 11.5px; font-weight: 800; }
.cs-chip.is-win { background: rgba(74,222,128,0.12); color: #4ade80; }
.cs-chip.is-loss { background: rgba(248,113,113,0.12); color: #f87171; }
.cs-radio { width: 22px; height: 22px; flex-shrink: 0; border-radius: 50%; border: 2px solid rgba(255,255,255,0.25); display: grid; place-items: center; }
.cs-radio svg { opacity: 0; }
.is-on .cs-radio { border-color: #fbbf24; background: #fbbf24; }
.is-on .cs-radio svg { opacity: 1; }
.cs-reto, .cs-send {
  min-height: 48px; border-radius: 13px; display: flex; align-items: center; justify-content: center; gap: 6px;
  font-family: var(--font-shout); font-weight: 800; font-style: italic; font-size: 16px; letter-spacing: .4px; line-height: 1;
}
.cs-reto { border: 1px solid rgba(251,191,36,0.55); background: rgba(251,191,36,0.08); color: #fde68a; }
.cs-send { border-bottom: 4px solid #b45309; background: linear-gradient(180deg, #fcd34d, #f59e0b); color: #1c1206; }
.cs-send:active { transform: translateY(2px); border-bottom-width: 2px; }
.cs-go {
  display: inline-flex; align-items: center; min-height: 44px; padding: 0 22px; border-radius: 12px; background: linear-gradient(180deg, #fcd34d, #f59e0b);
  box-shadow: 0 3px 0 #b45309; color: #1c1206; font-family: var(--font-shout); font-weight: 800; font-size: 18px;
}
.cs-fade-enter-active, .cs-fade-leave-active { transition: opacity .2s ease; }
.cs-fade-enter-from, .cs-fade-leave-to { opacity: 0; }
.cs-up-enter-active { transition: opacity .28s cubic-bezier(.2,.8,.2,1), transform .28s cubic-bezier(.2,.8,.2,1); }
.cs-up-leave-active { transition: opacity .16s ease, transform .16s ease; }
.cs-up-enter-from, .cs-up-leave-to { opacity: 0; transform: translateY(24px); }
@media (prefers-reduced-motion: reduce) {
  .cs-up-enter-active, .cs-up-leave-active { transition: opacity .12s ease; }
  .cs-up-enter-from, .cs-up-leave-to { transform: none; }
  .cs-opt { transition: none; }
}
</style>
