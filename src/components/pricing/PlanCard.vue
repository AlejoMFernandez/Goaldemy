<script setup>
/**
 * Card de plan (Free / Pro / Legend). Fuente ÚNICA usada en el home (Landing)
 * y en /pricing. Data-driven desde la DB (fetchPlans). El estilo/precio viene
 * de plans-ui.js. Emite `subscribe` con el plan; el padre decide qué hacer
 * (abrir checkout en Pricing, o navegar a /pricing en el home).
 */
import { planStyle, formatPrice } from '../../services/plans-ui'
import PassCosmetic from '../rewards/PassCosmetic.vue'
import PowerupIcon from '../rewards/PowerupIcon.vue'

const props = defineProps({
  plan: { type: Object, required: true },
  currentPlan: { type: String, default: '' },
})
defineEmits(['subscribe'])

// ── Datos de preview para los hovers ──
const POWERUP_PREVIEW = [
  { type: 'fifty_fifty', name: '50/50', desc: 'Elimina 2 opciones incorrectas' },
  { type: 'shield', name: 'Escudo', desc: 'Protege de un error sin perder' },
  { type: 'extra_time', name: '+15 seg', desc: 'Suma tiempo al reloj' },
  { type: 'reveal_hint', name: 'Pista', desc: 'Revela una pista extra' },
]
const ICON_PREVIEW = [
  { type: 'icon', style_key: 'crown', rarity: 'legendary', name: 'Corona' },
  { type: 'icon', style_key: 'goat', rarity: 'legendary', name: 'GOAT' },
  { type: 'icon', style_key: 'trophy', rarity: 'epic', name: 'Trofeo' },
]
const COSMETIC_PREVIEW = [
  { type: 'frame', style_key: 'premium', rarity: 'legendary', name: 'Élite' },
  { type: 'frame', style_key: 'champion', rarity: 'legendary', name: 'Campeón' },
  { type: 'banner', style_key: 'gold', rarity: 'legendary', name: 'Oro' },
  { type: 'banner', style_key: 'galaxy', rarity: 'legendary', name: 'Galaxia' },
]

// Lista de features por plan (con marca de hover). Sin "desafíos por día por juego".
function planFeatures(plan) {
  const f = []
  if (plan.xp_multiplier > 1) f.push({ text: `Bonus de XP +${Math.round((plan.xp_multiplier - 1) * 100)}%`, strong: true })
  f.push({ text: `${plan.daily_powerups} power-up${plan.daily_powerups === 1 ? '' : 's'} por día`, hover: 'powerups' })
  if (plan.slug === 'free') {
    f.push({ text: 'Pase de Batalla — recompensas gratis' })
    f.push({ text: '9 modos, XP y ranking global' })
  } else {
    f.push({ text: 'Pase de Batalla PRO — recompensas premium', strong: true })
    f.push({ text: 'Íconos exclusivos', hover: 'icons' })
    f.push({ text: 'Bordes y banners exclusivos', hover: 'cosmetics' })
    if (plan.weekly_streak_protectors > 0)
      f.push({ text: `${plan.weekly_streak_protectors} protector${plan.weekly_streak_protectors === 1 ? '' : 'es'} de racha/semana` })
    if (plan.badge) f.push({ text: `Badge ${plan.slug === 'legend' ? 'Legend dorado' : 'Pro'} en perfil`, hover: 'badge' })
  }
  return f
}
</script>

<template>
  <div
    class="relative rounded-2xl border bg-white/[0.02] p-6 flex flex-col transition-transform hover:scale-[1.02]"
    :class="[planStyle(plan.slug).border, planStyle(plan.slug).ring, plan.slug === 'pro' ? 'md:-mt-2' : '']"
  >
    <div
      v-if="plan.slug === 'pro'"
      class="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-0.5 rounded-full text-xs font-bold bg-gradient-to-r from-fuchsia-500 to-violet-500 text-white shadow-lg"
    >
      Popular
    </div>

    <div
      v-if="plan.slug === currentPlan"
      class="absolute -top-3 right-4 px-3 py-0.5 rounded-full text-xs font-bold bg-emerald-500 text-black"
    >
      Tu plan
    </div>

    <div class="mb-4">
      <div
        class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold mb-3"
        :class="planStyle(plan.slug).badge"
      >
        <span class="w-2 h-2 rounded-full" :class="planStyle(plan.slug).dot"></span>
        {{ plan.name }}
      </div>
      <div class="flex items-end gap-1">
        <span class="text-3xl font-extrabold text-white">{{ formatPrice(plan) }}</span>
        <span v-if="plan.price_ars > 0" class="text-slate-500 text-sm mb-1">ARS/mes</span>
      </div>
    </div>

    <ul class="space-y-2.5 flex-1 mb-6">
      <li
        v-for="(feat, fi) in planFeatures(plan)"
        :key="fi"
        class="group/feat relative flex items-center gap-2 text-sm"
      >
        <svg class="w-4 h-4 flex-shrink-0" :class="planStyle(plan.slug).accent" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
        <span :class="feat.strong ? 'text-white font-semibold' : 'text-slate-300'">{{ feat.text }}</span>

        <!-- Indicador de que hay preview -->
        <svg v-if="feat.hover" class="w-3.5 h-3.5 text-slate-500 group-hover/feat:text-slate-300 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>

        <!-- ── POPUP: power-ups ── -->
        <div v-if="feat.hover === 'powerups'" class="pointer-events-none absolute bottom-full left-0 mb-2 z-30 w-64 rounded-xl border border-white/15 bg-slate-900/95 backdrop-blur p-3 opacity-0 translate-y-1 shadow-2xl transition-all group-hover/feat:opacity-100 group-hover/feat:translate-y-0">
          <div class="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-2">Tus ayudas en partida</div>
          <div class="space-y-2">
            <div v-for="pu in POWERUP_PREVIEW" :key="pu.type" class="flex items-center gap-2.5">
              <div class="w-10 h-10 rounded-lg bg-white/5 border border-white/10 grid place-items-center shrink-0"><PowerupIcon :type="pu.type" :size="30" /></div>
              <div class="min-w-0">
                <div class="text-xs font-bold text-white leading-tight">{{ pu.name }}</div>
                <div class="text-[10px] text-slate-400 leading-tight">{{ pu.desc }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- ── POPUP: íconos exclusivos ── -->
        <div v-else-if="feat.hover === 'icons'" class="pointer-events-none absolute bottom-full left-0 mb-2 z-30 w-56 rounded-xl border border-white/15 bg-slate-900/95 backdrop-blur p-3 opacity-0 translate-y-1 shadow-2xl transition-all group-hover/feat:opacity-100 group-hover/feat:translate-y-0">
          <div class="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-2">Íconos que desbloqueás</div>
          <div class="flex items-center justify-around gap-2">
            <div v-for="c in ICON_PREVIEW" :key="c.style_key" class="flex flex-col items-center gap-1">
              <PassCosmetic :cos="c" :size="42" />
              <div class="text-[9px] font-semibold text-slate-300">{{ c.name }}</div>
            </div>
          </div>
          <div class="mt-2 text-[10px] text-slate-500 text-center">y muchos más</div>
        </div>

        <!-- ── POPUP: bordes y banners ── -->
        <div v-else-if="feat.hover === 'cosmetics'" class="pointer-events-none absolute bottom-full left-0 mb-2 z-30 w-64 rounded-xl border border-white/15 bg-slate-900/95 backdrop-blur p-3 opacity-0 translate-y-1 shadow-2xl transition-all group-hover/feat:opacity-100 group-hover/feat:translate-y-0">
          <div class="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-2">Bordes y banners</div>
          <div class="grid grid-cols-4 gap-2 place-items-center">
            <div v-for="c in COSMETIC_PREVIEW" :key="c.style_key" class="flex flex-col items-center gap-1">
              <PassCosmetic :cos="c" :size="38" />
              <div class="text-[8px] font-semibold text-slate-400">{{ c.name }}</div>
            </div>
          </div>
        </div>

        <!-- ── POPUP: badge en el perfil ── -->
        <div v-else-if="feat.hover === 'badge'" class="pointer-events-none absolute bottom-full left-0 mb-2 z-30 w-60 rounded-xl border border-white/15 bg-slate-900/95 backdrop-blur p-3 opacity-0 translate-y-1 shadow-2xl transition-all group-hover/feat:opacity-100 group-hover/feat:translate-y-0">
          <div class="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-2">Así se ve en tu perfil</div>
          <div class="flex items-center gap-3 rounded-lg bg-black/40 ring-1 ring-white/10 p-2.5">
            <div class="w-11 h-11 rounded-full bg-gradient-to-br from-slate-500 to-slate-700 blur-[2px] shrink-0"></div>
            <div class="flex-1 min-w-0">
              <div class="h-2.5 w-20 rounded bg-white/25 blur-[1px] mb-1.5"></div>
              <span
                class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold"
                :class="[planStyle(plan.slug).badge, planStyle(plan.slug).glow]"
              >
                <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                {{ plan.slug === 'legend' ? 'LEGEND' : 'PRO' }}
              </span>
            </div>
          </div>
        </div>
      </li>
    </ul>

    <button
      v-if="plan.slug !== currentPlan && plan.slug !== 'free'"
      class="w-full py-3 rounded-xl text-sm font-bold transition-all duration-200"
      :class="planStyle(plan.slug).cta"
      @click="$emit('subscribe', plan)"
    >
      Suscribirme
    </button>
    <div
      v-else-if="plan.slug === currentPlan"
      class="w-full py-3 rounded-xl text-sm text-center bg-white/5 text-white/40 cursor-default"
    >
      Plan actual
    </div>
    <div v-else class="w-full py-3 rounded-xl text-sm text-center text-white/30">
      Incluido
    </div>
  </div>
</template>
