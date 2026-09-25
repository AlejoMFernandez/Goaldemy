<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { getMonthlyPass, claimPassTier, powerupLabel } from '../../services/rewards'
import { pushClaimNotification } from '../../stores/notifications'
import { soundManager } from '../../services/sounds'
import PassCosmetic from './PassCosmetic.vue'
import PowerupIcon from './PowerupIcon.vue'

const props = defineProps({
  // Versión liviana para el teaser del Home: oculta días-restantes/pulso de
  // reclamo y los chips "sumás jugando" — esa info ya vive en el modal de
  // detalle (Ver pase completo). RewardCenter.vue no pasa esto, sigue igual.
  compact: { type: Boolean, default: false },
})

const router = useRouter()
const pass = ref({ points: 0, tiers: [], is_premium: false })
const loading = ref(true)
const claiming = ref(null)
const detailOpen = ref(false)
const trackEl = ref(null)

// Tinte por ayuda — mismo criterio que AyudasPanel.vue (índice de juegos), así
// una mejora se reconoce por color en cualquier parte de la app.
const POWERUP_COLORS = {
  fifty_fifty: { ring: 'ring-fuchsia-400/30', bg: 'bg-fuchsia-500/15', text: 'text-fuchsia-200' },
  shield: { ring: 'ring-sky-400/30', bg: 'bg-sky-500/15', text: 'text-sky-200' },
  extra_time: { ring: 'ring-amber-400/30', bg: 'bg-amber-500/15', text: 'text-amber-100' },
  reveal_hint: { ring: 'ring-emerald-400/30', bg: 'bg-emerald-500/15', text: 'text-emerald-200' },
}
function puColor(type) { return POWERUP_COLORS[type] || POWERUP_COLORS.reveal_hint }
// Emoji legacy solo para el toast global de "reclamado" (stack compartido con
// el resto de la app, fuera del alcance de este rediseño).
const POWERUP_TOAST_EMOJI = { fifty_fifty: '✂️', shield: '🛡️', extra_time: '⏱️', reveal_hint: '💡' }
function powerupToastEmoji(t) { return POWERUP_TOAST_EMOJI[t] || '🎁' }

const monthLabel = computed(() => {
  if (!pass.value.month) return ''
  try {
    return new Date(pass.value.month + 'T00:00:00').toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  } catch { return '' }
})

const seasonName = computed(() => pass.value.season?.name || 'Pase Mensual')
const daysLeft = computed(() => Math.max(0, pass.value.days_left ?? 0))

const tiers = computed(() => pass.value.tiers || [])
const points = computed(() => pass.value.points || 0)
const finalTier = computed(() => tiers.value[tiers.value.length - 1] || null)
const maxPoints = computed(() => finalTier.value?.points_required || 1)

// Nivel actual = el tier desbloqueado más alto; próximo = primero bloqueado.
const currentTierNum = computed(() => {
  let n = 0
  for (const t of tiers.value) if (t.unlocked) n = t.tier
  return n
})
const nextTier = computed(() => tiers.value.find(t => !t.unlocked) || null)

// Progreso del segmento actual → próximo nivel (para la barra principal).
const segment = computed(() => {
  const prevReq = currentTierNum.value > 0
    ? (tiers.value.find(t => t.tier === currentTierNum.value)?.points_required || 0)
    : 0
  const nextReq = nextTier.value ? nextTier.value.points_required : maxPoints.value
  const span = Math.max(1, nextReq - prevReq)
  const into = Math.max(0, points.value - prevReq)
  return { prevReq, nextReq, span, into, pct: Math.min(100, Math.round((into / span) * 100)) }
})

const claimableCount = computed(() =>
  tiers.value.filter(t => canClaim(t, 'free') || canClaim(t, 'premium')).length
)

// Gran premio FREE = el cosmético del último tier del track gratis (teaser).
const grandPrize = computed(() => finalTier.value?.free_cosmetic || null)
// Cuántos cosméticos reparte cada track (para el resumen comparativo).
const freeCosmeticsCount = computed(() => tiers.value.filter(t => t.free_cosmetic).length)
const premiumCosmeticsCount = computed(() => tiers.value.filter(t => t.premium_cosmetic).length)

function rewardFor(tier, track) {
  if (track === 'free') return { xp: tier.free_xp, powerup: tier.free_powerup, qty: tier.free_powerup_qty, cos: tier.free_cosmetic }
  return { xp: tier.premium_xp, powerup: tier.premium_powerup, qty: tier.premium_powerup_qty, cos: tier.premium_cosmetic }
}

function hasReward(tier, track) {
  const r = rewardFor(tier, track)
  return !!r.cos || !!r.powerup || r.xp > 0
}

// Hito = trae un cosmético — son los premios "jugosos" que venden el pase,
// se destacan con una tile más grande que XP/powerups sueltos.
function isMilestone(tier, track) {
  return !!rewardFor(tier, track).cos
}

function canClaim(tier, track) {
  if (!tier.unlocked) return false
  if (track === 'premium' && !pass.value.is_premium) return false
  const claimed = track === 'free' ? tier.free_claimed : tier.premium_claimed
  return hasReward(tier, track) && !claimed
}

function tierState(tier, track) {
  const claimed = track === 'free' ? tier.free_claimed : tier.premium_claimed
  if (claimed) return 'claimed'
  if (canClaim(tier, track)) return 'claimable'
  if (track === 'premium' && tier.unlocked && !pass.value.is_premium) return 'locked-premium'
  if (!tier.unlocked) return 'locked'
  return 'empty'
}

async function load() {
  loading.value = true
  try {
    pass.value = await getMonthlyPass()
  } finally {
    loading.value = false
  }
}

async function handleClaim(tier, track) {
  const key = `${tier.tier}_${track}`
  if (claiming.value === key || !canClaim(tier, track)) return
  claiming.value = key
  try {
    const res = await claimPassTier(tier.tier, track)
    if (res.ok) {
      const idx = pass.value.tiers.findIndex(x => x.tier === tier.tier)
      if (idx !== -1) {
        pass.value.tiers[idx] = {
          ...pass.value.tiers[idx],
          [track === 'free' ? 'free_claimed' : 'premium_claimed']: true,
        }
      }
      soundManager.play('claim')
      const title = `${seasonName.value} · Nivel ${tier.tier}`
      const cos = rewardFor(tier, track).cos
      if (cos) pushClaimNotification({ type: 'cosmetic', title: `${title} — ${cos.name}`, emoji: '🎁' })
      else if (res.powerup) pushClaimNotification({ type: 'powerup', title, emoji: powerupToastEmoji(res.powerup) })
      else pushClaimNotification({ type: 'xp', title, xp: res.xp, emoji: '🎟️' })
    }
  } finally {
    claiming.value = null
  }
}

function openDetail() {
  detailOpen.value = true
  nextTick(scrollToCurrent)
}

function scrollToCurrent() {
  const node = trackEl.value?.querySelector('[data-current="1"]')
  if (node) node.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

onMounted(load)
defineExpose({ reload: load })
</script>

<template>
  <!-- ════════ CARD PRE-ENTRADA (teaser) ════════ -->
  <button
    type="button"
    @click="openDetail"
    class="group relative w-full text-left overflow-hidden rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/[0.10] via-slate-900/60 to-amber-600/[0.05] p-5 transition-all hover:border-amber-500/40 active:scale-[0.99]"
  >
    <!-- brillo decorativo -->
    <div class="pointer-events-none absolute -top-16 -right-10 w-48 h-48 rounded-full bg-amber-500/10 blur-3xl"></div>

    <div class="relative flex items-start justify-between gap-3">
      <div class="flex items-center gap-2.5">
        <div class="w-11 h-11 rounded-2xl grid place-items-center bg-amber-500/15 border border-amber-400/30 shadow-lg shadow-amber-500/10 text-amber-300">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6">
            <path d="M3 8.2a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1a1.6 1.6 0 0 0 0 5.6v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1a1.6 1.6 0 0 0 0-5.6v-1Z" />
            <path d="M14.5 6.5v11" stroke-dasharray="0.1 3.2" />
          </svg>
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h2 class="font-display font-bold text-white text-lg leading-tight">{{ seasonName }}</h2>
            <span v-if="pass.is_premium" class="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/40 px-2 py-0.5 text-[10px] font-bold text-amber-300">
              <svg viewBox="0 0 24 24" fill="currentColor" class="w-2.5 h-2.5"><path d="M12 2l2.6 6.9L22 9.6l-5.6 4.8L18 22l-6-3.7L6 22l1.6-7.6L2 9.6l7.4-.7Z" /></svg>
              PRO
            </span>
          </div>
          <div class="text-[11px] text-slate-400 capitalize mt-0.5">{{ monthLabel }}</div>
        </div>
      </div>

      <!-- Días restantes (arriba a la derecha) -->
      <div v-if="!compact" class="shrink-0 flex flex-col items-end gap-1">
        <div class="inline-flex items-center gap-1.5 rounded-full bg-black/30 border border-white/10 px-2.5 py-1 text-[11px] font-bold text-slate-200">
          <svg class="w-3.5 h-3.5 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <span class="tabular-nums">{{ daysLeft }}</span> {{ daysLeft === 1 ? 'día' : 'días' }}
        </div>
        <div v-if="claimableCount > 0" class="inline-flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-300/40 px-2.5 py-1 text-[11px] font-bold text-amber-300" style="animation: claim-pulse 2s ease-in-out infinite">
          {{ claimableCount }} para reclamar
        </div>
      </div>
      <svg v-else class="w-4 h-4 text-slate-500 shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
    </div>

    <div v-if="loading" class="relative h-16 mt-4 rounded-xl bg-white/5 animate-pulse"></div>

    <template v-else>
      <!-- Puntos + barra al próximo nivel -->
      <div class="relative mt-4">
        <div class="flex items-end justify-between mb-1.5">
          <div class="flex items-baseline gap-1.5">
            <span class="font-display font-bold text-2xl text-white tabular-nums">{{ points }}</span>
            <span class="text-xs text-slate-400 font-semibold">puntos</span>
          </div>
          <div v-if="nextTier" class="text-[11px] text-slate-400">
            <span class="text-amber-300 font-bold tabular-nums">{{ Math.max(0, nextTier.points_required - points) }}</span> al Nivel {{ nextTier.tier }}
          </div>
          <div v-else class="inline-flex items-center gap-1 text-[11px] text-amber-300 font-bold">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4Z"/><path d="M7 5H4a1 1 0 0 0-1 1v1a4 4 0 0 0 4 4M17 5h3a1 1 0 0 1 1 1v1a4 4 0 0 1-4 4"/></svg>
            ¡Pase completado!
          </div>
        </div>
        <div class="h-3 rounded-full bg-black/40 overflow-hidden ring-1 ring-white/5">
          <div class="h-full rounded-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 transition-all duration-700" :style="{ width: segment.pct + '%' }"></div>
        </div>
        <div class="mt-1 flex items-center justify-between text-[10px] text-slate-500">
          <span>Nivel {{ currentTierNum }}</span>
          <span>{{ tiers.length }} niveles</span>
        </div>
      </div>

      <!-- De dónde salen los puntos (claro y gráfico) -->
      <div v-if="!compact" class="relative mt-3 flex items-center gap-2">
        <span class="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Sumás jugando</span>
        <span class="inline-flex items-center gap-1 rounded-lg bg-amber-500/10 border border-amber-500/20 px-2 py-1 text-[11px] font-bold text-amber-300">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3 h-3"><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4Z"/><path d="M7 5H4a1 1 0 0 0-1 1v1a4 4 0 0 0 4 4M17 5h3a1 1 0 0 1 1 1v1a4 4 0 0 1-4 4"/></svg>
          +3 ganar
        </span>
        <span class="inline-flex items-center gap-1 rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[11px] font-semibold text-slate-300">
          <svg viewBox="0 0 24 24" fill="currentColor" class="w-2.5 h-2.5"><path d="M8 5v14l11-7Z"/></svg>
          +1 jugar
        </span>
      </div>

      <!-- Footer: ver pase + gran premio real -->
      <div class="relative mt-4 flex items-center justify-between gap-3">
        <span class="inline-flex items-center gap-1.5 text-sm font-bold text-amber-300 group-hover:gap-2.5 transition-all">
          Ver pase completo
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7" /></svg>
        </span>
        <div v-if="grandPrize" class="flex items-center gap-2 text-[10px] text-slate-400">
          <div class="text-right leading-tight">
            <div class="uppercase tracking-wider">Premio final gratis</div>
            <div class="text-amber-200 font-bold text-[11px]">{{ grandPrize.name }}</div>
          </div>
          <PassCosmetic :cos="grandPrize" :size="34" />
        </div>
      </div>
    </template>
  </button>

  <!-- ════════ MODAL DE DETALLE — timeline vertical estilo Clash Royale ════════ -->
  <Teleport to="body">
    <Transition name="pass-modal">
      <div v-if="detailOpen" class="fixed inset-0 z-[60] overflow-hidden">
        <div class="fixed inset-0 bg-black/80 backdrop-blur-sm" @click="detailOpen = false"></div>
        <div class="relative h-full flex items-center justify-center p-2 sm:p-4" @click.self="detailOpen = false">
          <div class="relative w-full max-w-6xl h-full sm:h-[92vh] flex flex-col rounded-2xl border border-white/15 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 shadow-2xl overflow-hidden">

            <!-- Header -->
            <div class="relative shrink-0 overflow-hidden border-b border-white/10 bg-gradient-to-r from-amber-500/[0.12] to-amber-600/[0.06] p-4 sm:p-5">
              <div class="pointer-events-none absolute -top-12 right-10 w-40 h-40 rounded-full bg-amber-500/15 blur-3xl"></div>
              <button @click="detailOpen = false" class="absolute top-4 right-4 text-slate-400 hover:text-white transition z-10">
                <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
              <div class="relative flex items-center gap-3 pr-10">
                <div class="w-12 h-12 rounded-2xl grid place-items-center bg-amber-500/15 border border-amber-400/30 text-amber-300 shrink-0">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6">
                    <path d="M3 8.2a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1a1.6 1.6 0 0 0 0 5.6v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1a1.6 1.6 0 0 0 0-5.6v-1Z" />
                    <path d="M14.5 6.5v11" stroke-dasharray="0.1 3.2" />
                  </svg>
                </div>
                <div class="flex-1 min-w-0">
                  <h2 class="font-display font-bold text-white text-xl leading-tight">{{ seasonName }}</h2>
                  <div class="text-xs text-slate-400 capitalize">{{ monthLabel }} · <span class="text-amber-300 font-bold">{{ points }} puntos</span></div>
                </div>
                <!-- Días restantes -->
                <div class="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-black/30 border border-white/10 px-3 py-1.5 text-xs font-bold text-slate-200">
                  <svg class="w-4 h-4 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  <span class="hidden sm:inline">Quedan</span> <span class="tabular-nums text-amber-200">{{ daysLeft }}</span> {{ daysLeft === 1 ? 'día' : 'días' }}
                </div>
              </div>

              <!-- Barra global -->
              <div class="relative mt-4">
                <div class="h-2.5 rounded-full bg-black/40 overflow-hidden ring-1 ring-white/5">
                  <div class="h-full rounded-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 transition-all duration-700" :style="{ width: Math.min(100, Math.round((points / maxPoints) * 100)) + '%' }"></div>
                </div>
                <div class="mt-1.5 flex items-center justify-between text-[11px]">
                  <span class="text-slate-400">Nivel <span class="text-white font-bold">{{ currentTierNum }}</span> / {{ tiers.length }}</span>
                  <span class="inline-flex items-center gap-2 text-slate-400">
                    <span class="inline-flex items-center gap-1 text-amber-300 font-semibold">+3 ganar</span>
                    <span class="inline-flex items-center gap-1">+1 jugar</span>
                  </span>
                </div>
              </div>
            </div>

            <!-- Comparativa Gratis vs PRO (leyenda + CTA) -->
            <div class="shrink-0 px-4 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-white/5">
              <div class="flex items-center gap-4 text-xs">
                <span class="inline-flex items-center gap-1.5 font-bold text-emerald-300">
                  <span class="w-2.5 h-2.5 rounded-full bg-emerald-400"></span> Gratis
                  <span class="text-slate-500 font-normal">· {{ freeCosmeticsCount }} cosmético{{ freeCosmeticsCount === 1 ? '' : 's' }}</span>
                </span>
                <span class="inline-flex items-center gap-1.5 font-bold text-amber-300">
                  <span class="w-2.5 h-2.5 rounded-full bg-amber-400"></span> PRO
                  <span class="text-slate-500 font-normal">· {{ premiumCosmeticsCount }} cosméticos + más XP</span>
                </span>
              </div>
              <button
                v-if="!pass.is_premium"
                @click="router.push('/pricing')"
                class="shrink-0 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-black px-3 py-1.5 text-xs font-bold hover:brightness-110 transition"
              >Desbloquear PRO</button>
            </div>

            <!-- Timeline vertical: GRATIS (izq) · nivel (centro) · PRO (der) -->
            <div ref="trackEl" class="relative flex-1 overflow-y-auto pass-track px-3 sm:px-6 py-5">
              <!-- línea central continua, detrás de los nodos -->
              <div class="pointer-events-none absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[3px] rounded-full bg-gradient-to-b from-amber-500/40 via-white/10 to-white/5 z-0"></div>

              <div class="relative z-[1] max-w-2xl sm:max-w-3xl mx-auto flex flex-col gap-2.5">
                <div
                  v-for="tier in tiers"
                  :key="tier.tier"
                  :data-current="tier.tier === currentTierNum ? '1' : '0'"
                  class="grid items-center gap-2 sm:gap-4"
                  style="grid-template-columns: 1fr 56px 1fr"
                >
                  <!-- ── Vía GRATIS ── -->
                  <div
                    class="relative rounded-xl border p-2 transition-all flex flex-col items-center justify-center text-center"
                    :class="[
                      isMilestone(tier, 'free') ? 'min-h-[104px] p-3' : 'min-h-[76px]',
                      tierState(tier, 'free') === 'claimable' ? 'border-emerald-400/50 bg-emerald-500/[0.09] shadow-[0_0_16px_rgba(16,185,129,0.15)]' : 'border-emerald-500/15 bg-emerald-500/[0.03]',
                      !tier.unlocked ? 'opacity-60' : '',
                    ]"
                  >
                    <div class="flex-1 grid place-items-center">
                      <div v-if="rewardFor(tier, 'free').cos" class="flex flex-col items-center gap-1">
                        <PassCosmetic :cos="rewardFor(tier, 'free').cos" :size="isMilestone(tier, 'free') ? 56 : 40" />
                        <div class="text-[9px] font-bold text-emerald-200 leading-none truncate max-w-[120px]">{{ rewardFor(tier, 'free').cos.name }}</div>
                      </div>
                      <div v-else-if="rewardFor(tier, 'free').powerup" class="flex flex-col items-center gap-1">
                        <div class="rounded-full p-2 ring-1" :class="[puColor(rewardFor(tier, 'free').powerup).bg, puColor(rewardFor(tier, 'free').powerup).ring, puColor(rewardFor(tier, 'free').powerup).text]">
                          <PowerupIcon :type="rewardFor(tier, 'free').powerup" :size="22" />
                        </div>
                        <div class="text-[9px] font-bold text-emerald-300">×{{ rewardFor(tier, 'free').qty }}</div>
                      </div>
                      <div v-else-if="rewardFor(tier, 'free').xp > 0">
                        <div class="font-display font-bold text-lg leading-none text-emerald-300">+{{ rewardFor(tier, 'free').xp }}</div>
                        <div class="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">XP</div>
                      </div>
                      <div v-else class="text-slate-600 text-lg">—</div>
                    </div>
                    <button
                      v-if="canClaim(tier, 'free')"
                      @click="handleClaim(tier, 'free')"
                      :disabled="claiming === tier.tier + '_free'"
                      class="mt-1.5 w-full rounded-lg py-1 text-[11px] font-bold bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:brightness-110 transition disabled:opacity-60"
                    >Reclamar</button>
                    <div v-else class="mt-1.5 h-5 grid place-items-center"
                      :class="tierState(tier, 'free') === 'claimed' ? 'text-emerald-400' : 'text-slate-600'">
                      <svg v-if="tierState(tier, 'free') === 'claimed'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M5 13l4 4L19 7" /></svg>
                      <svg v-else-if="tierState(tier, 'free') === 'locked'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
                    </div>
                  </div>

                  <!-- ── Nodo del nivel ── -->
                  <div class="flex flex-col items-center">
                    <div
                      class="w-10 h-10 rounded-full grid place-items-center text-xs font-bold border-2 relative shrink-0"
                      :class="tier.tier === currentTierNum
                        ? 'bg-amber-500/25 border-amber-300 text-amber-100 shadow-[0_0_0_4px_rgba(251,191,36,0.15),0_0_18px_rgba(251,191,36,0.4)]'
                        : tier.unlocked ? 'bg-amber-500/15 border-amber-400/40 text-amber-200' : 'bg-slate-800 border-white/10 text-slate-500'"
                    >
                      {{ tier.tier }}
                      <svg v-if="!tier.unlocked" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="absolute -bottom-1 -right-1 w-3.5 h-3.5 text-slate-500 bg-slate-900 rounded-full p-0.5"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
                    </div>
                    <div class="text-[7px] sm:text-[8px] text-slate-500 mt-1 tabular-nums text-center leading-tight">{{ tier.points_required }} pts</div>
                    <div v-if="tier.tier === currentTierNum" class="mt-0.5 text-[7px] sm:text-[8px] font-bold text-amber-300 uppercase tracking-wide">Tu nivel</div>
                  </div>

                  <!-- ── Vía PRO ── -->
                  <div
                    class="relative rounded-xl border p-2 transition-all flex flex-col items-center justify-center text-center"
                    :class="[
                      isMilestone(tier, 'premium') ? 'min-h-[104px] p-3' : 'min-h-[76px]',
                      tierState(tier, 'premium') === 'claimable' ? 'border-amber-400/50 bg-amber-500/[0.09] shadow-[0_0_16px_rgba(251,191,36,0.15)]' : 'border-amber-500/15 bg-amber-500/[0.03]',
                      (!tier.unlocked || !pass.is_premium) ? 'opacity-70' : '',
                    ]"
                  >
                    <div class="absolute top-1.5 right-1.5 text-[7px] font-bold uppercase tracking-wide text-amber-400/70">PRO</div>
                    <div class="flex-1 grid place-items-center">
                      <div v-if="rewardFor(tier, 'premium').cos" class="flex flex-col items-center gap-1">
                        <PassCosmetic :cos="rewardFor(tier, 'premium').cos" :size="isMilestone(tier, 'premium') ? 56 : 40" />
                        <div class="text-[9px] font-bold text-amber-200 leading-none truncate max-w-[120px]">{{ rewardFor(tier, 'premium').cos.name }}</div>
                      </div>
                      <div v-else-if="rewardFor(tier, 'premium').powerup" class="flex flex-col items-center gap-1">
                        <div class="rounded-full p-2 ring-1" :class="[puColor(rewardFor(tier, 'premium').powerup).bg, puColor(rewardFor(tier, 'premium').powerup).ring, puColor(rewardFor(tier, 'premium').powerup).text]">
                          <PowerupIcon :type="rewardFor(tier, 'premium').powerup" :size="22" />
                        </div>
                        <div class="text-[9px] font-bold text-amber-300">×{{ rewardFor(tier, 'premium').qty }}</div>
                      </div>
                      <div v-else-if="rewardFor(tier, 'premium').xp > 0">
                        <div class="font-display font-bold text-lg leading-none text-amber-300">+{{ rewardFor(tier, 'premium').xp }}</div>
                        <div class="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">XP</div>
                      </div>
                      <div v-else class="text-slate-600 text-lg">—</div>
                    </div>
                    <button
                      v-if="canClaim(tier, 'premium')"
                      @click="handleClaim(tier, 'premium')"
                      :disabled="claiming === tier.tier + '_premium'"
                      class="mt-1.5 w-full rounded-lg py-1 text-[11px] font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:brightness-110 transition disabled:opacity-60"
                    >Reclamar</button>
                    <button
                      v-else-if="tierState(tier, 'premium') === 'locked-premium'"
                      @click="router.push('/pricing')"
                      class="mt-1.5 w-full inline-flex items-center justify-center gap-1 rounded-lg py-1 text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3 h-3"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
                      PRO
                    </button>
                    <div v-else class="mt-1.5 h-5 grid place-items-center"
                      :class="tierState(tier, 'premium') === 'claimed' ? 'text-amber-400' : 'text-slate-600'">
                      <svg v-if="tierState(tier, 'premium') === 'claimed'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M5 13l4 4L19 7" /></svg>
                      <svg v-else-if="tierState(tier, 'premium') === 'locked'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="shrink-0 px-5 py-2.5 text-center text-[11px] text-slate-500 border-t border-white/5">
              <span class="text-emerald-300">Gratis</span> a la izquierda · <span class="text-amber-300">PRO</span> a la derecha · el nivel te marca el camino
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.pass-track { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.15) transparent; }
.pass-track::-webkit-scrollbar { width: 8px; }
.pass-track::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 4px; }

.pass-modal-enter-active, .pass-modal-leave-active { transition: opacity 0.25s ease; }
.pass-modal-enter-from, .pass-modal-leave-to { opacity: 0; }
.pass-modal-enter-active .relative.w-full, .pass-modal-leave-active .relative.w-full { transition: transform 0.25s var(--ease-bounce, ease); }
.pass-modal-enter-from .relative.w-full { transform: scale(0.96); }
</style>
