<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getMonthlyPass, claimPassTier, powerupLabel } from '../../services/rewards'
import { pushClaimNotification } from '../../stores/notifications'
import { soundManager } from '../../services/sounds'
import { frameStyle } from '../../services/cosmetics'

const router = useRouter()
const pass = ref({ points: 0, tiers: [], is_premium: false })
const loading = ref(true)
const claiming = ref(null)
const detailOpen = ref(false)
const activeTrack = ref('free') // 'free' | 'premium'
const trackEl = ref(null)

const POWERUP_ICONS = { fifty_fifty: '✂️', shield: '🛡️', extra_time: '⏱️', reveal_hint: '💡' }
function powerupIcon(t) { return POWERUP_ICONS[t] || '🎁' }

const monthLabel = computed(() => {
  if (!pass.value.month) return ''
  try {
    return new Date(pass.value.month + 'T00:00:00').toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  } catch { return '' }
})

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

// Próxima recompensa gratis sin reclamar (para el teaser).
const nextFreeReward = computed(() => {
  const t = tiers.value.find(x => x.unlocked && !x.free_claimed && (x.free_xp > 0 || x.free_powerup))
    || tiers.value.find(x => !x.unlocked && (x.free_xp > 0 || x.free_powerup))
  return t || null
})

function rewardFor(tier, track) {
  if (track === 'free') return { xp: tier.free_xp, powerup: tier.free_powerup, qty: tier.free_powerup_qty }
  return { xp: tier.premium_xp, powerup: tier.premium_powerup, qty: tier.premium_powerup_qty }
}

function canClaim(tier, track) {
  if (!tier.unlocked) return false
  if (track === 'premium' && !pass.value.is_premium) return false
  const r = rewardFor(tier, track)
  const has = r.xp > 0 || r.powerup
  const claimed = track === 'free' ? tier.free_claimed : tier.premium_claimed
  return has && !claimed
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
      const title = `Pase · Nivel ${tier.tier}`
      if (res.powerup) pushClaimNotification({ type: 'powerup', title, emoji: powerupIcon(res.powerup) })
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
  const el = trackEl.value
  if (!el) return
  const node = el.querySelector('[data-current="1"]')
  if (node) el.scrollTo({ left: node.offsetLeft - 80, behavior: 'smooth' })
}

watch(activeTrack, () => nextTick(scrollToCurrent))

onMounted(load)
defineExpose({ reload: load })
</script>

<template>
  <!-- ════════ CARD PRE-ENTRADA (teaser) ════════ -->
  <button
    type="button"
    @click="openDetail"
    class="group relative w-full text-left overflow-hidden rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/[0.10] via-slate-900/60 to-cyan-500/[0.05] p-5 transition-all hover:border-amber-500/40 active:scale-[0.99]"
  >
    <!-- brillo decorativo -->
    <div class="pointer-events-none absolute -top-16 -right-10 w-48 h-48 rounded-full bg-amber-500/10 blur-3xl"></div>

    <div class="relative flex items-start justify-between gap-3">
      <div class="flex items-center gap-2.5">
        <div class="w-11 h-11 rounded-2xl grid place-items-center text-2xl bg-amber-500/15 border border-amber-400/30 shadow-lg shadow-amber-500/10">🎟️</div>
        <div>
          <div class="flex items-center gap-2">
            <h2 class="font-display font-extrabold text-white text-lg leading-tight">Pase Mensual</h2>
            <span v-if="pass.is_premium" class="rounded-full bg-amber-500/15 border border-amber-500/40 px-2 py-0.5 text-[10px] font-bold text-amber-300">⭐ PREMIUM</span>
          </div>
          <div class="text-[11px] text-slate-400 capitalize mt-0.5">{{ monthLabel }}</div>
        </div>
      </div>
      <div v-if="claimableCount > 0" class="shrink-0 flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 px-2.5 py-1 text-[11px] font-bold text-emerald-300" style="animation: claim-pulse 2s ease-in-out infinite">
        {{ claimableCount }} para reclamar
      </div>
    </div>

    <div v-if="loading" class="relative h-16 mt-4 rounded-xl bg-white/5 animate-pulse"></div>

    <template v-else>
      <!-- Puntos + barra al próximo nivel -->
      <div class="relative mt-4">
        <div class="flex items-end justify-between mb-1.5">
          <div class="flex items-baseline gap-1.5">
            <span class="font-display font-extrabold text-2xl text-white tabular-nums">{{ points }}</span>
            <span class="text-xs text-slate-400 font-semibold">puntos</span>
          </div>
          <div v-if="nextTier" class="text-[11px] text-slate-400">
            <span class="text-amber-300 font-bold tabular-nums">{{ Math.max(0, nextTier.points_required - points) }}</span> al Nivel {{ nextTier.tier }}
          </div>
          <div v-else class="text-[11px] text-amber-300 font-bold">¡Pase completado! 🏆</div>
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
      <div class="relative mt-3 flex items-center gap-2">
        <span class="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Sumás jugando</span>
        <span class="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 text-[11px] font-bold text-emerald-300">🏆 +3 ganar</span>
        <span class="inline-flex items-center gap-1 rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[11px] font-semibold text-slate-300">🎮 +1 jugar</span>
      </div>

      <!-- Footer: ver pase + gran premio -->
      <div class="relative mt-4 flex items-center justify-between gap-3">
        <span class="inline-flex items-center gap-1.5 text-sm font-bold text-amber-300 group-hover:gap-2.5 transition-all">
          Ver pase completo
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7" /></svg>
        </span>
        <div v-if="finalTier" class="flex items-center gap-1.5 text-[10px] text-slate-400">
          <span class="uppercase tracking-wider">Gran premio</span>
          <span class="inline-grid place-items-center w-6 h-6 rounded-full text-[11px]" :class="frameStyle('champion').wrap">🏅</span>
        </div>
      </div>
    </template>
  </button>

  <!-- ════════ MODAL DE DETALLE ════════ -->
  <Teleport to="body">
    <Transition name="pass-modal">
      <div v-if="detailOpen" class="fixed inset-0 z-[60] overflow-y-auto">
        <div class="fixed inset-0 bg-black/80 backdrop-blur-sm" @click="detailOpen = false"></div>
        <div class="relative min-h-full flex items-center justify-center p-3 sm:p-4" @click.self="detailOpen = false">
          <div class="relative w-full max-w-4xl rounded-2xl border border-white/15 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 shadow-2xl">

            <!-- Header -->
            <div class="relative overflow-hidden rounded-t-2xl border-b border-white/10 bg-gradient-to-r from-amber-500/[0.12] to-cyan-500/[0.06] p-5">
              <div class="pointer-events-none absolute -top-12 right-10 w-40 h-40 rounded-full bg-amber-500/15 blur-3xl"></div>
              <button @click="detailOpen = false" class="absolute top-4 right-4 text-slate-400 hover:text-white transition z-10">
                <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
              <div class="relative flex items-center gap-3">
                <div class="w-12 h-12 rounded-2xl grid place-items-center text-2xl bg-amber-500/15 border border-amber-400/30">🎟️</div>
                <div>
                  <h2 class="font-display font-extrabold text-white text-xl leading-tight">Pase Mensual</h2>
                  <div class="text-xs text-slate-400 capitalize">{{ monthLabel }} · <span class="text-amber-300 font-bold">{{ points }} puntos</span></div>
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
                    <span class="inline-flex items-center gap-1 text-emerald-300 font-semibold">🏆 +3 ganar</span>
                    <span class="inline-flex items-center gap-1">🎮 +1 jugar</span>
                  </span>
                </div>
              </div>
            </div>

            <!-- Tabs Gratis / Premium -->
            <div class="px-5 pt-4">
              <div class="inline-flex rounded-xl border border-white/10 bg-black/20 p-1">
                <button
                  @click="activeTrack = 'free'"
                  class="px-4 py-1.5 rounded-lg text-sm font-bold transition-all"
                  :class="activeTrack === 'free' ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/30' : 'text-slate-400 hover:text-slate-200'"
                >Gratis</button>
                <button
                  @click="activeTrack = 'premium'"
                  class="px-4 py-1.5 rounded-lg text-sm font-bold transition-all inline-flex items-center gap-1.5"
                  :class="activeTrack === 'premium' ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-400/30' : 'text-slate-400 hover:text-slate-200'"
                >
                  <span>Premium</span>
                  <svg v-if="!pass.is_premium" class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/></svg>
                </button>
              </div>
              <!-- Aviso premium -->
              <div v-if="activeTrack === 'premium' && !pass.is_premium" class="mt-3 flex items-center justify-between gap-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-2.5">
                <span class="text-xs text-amber-200/90">Desbloqueá el track premium para recompensas mucho mejores.</span>
                <button @click="router.push('/pricing')" class="shrink-0 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-black px-3 py-1.5 text-xs font-bold hover:brightness-110 transition">Hacerme premium</button>
              </div>
            </div>

            <!-- Track horizontal -->
            <div ref="trackEl" class="overflow-x-auto px-5 py-4 pass-track">
              <div class="flex gap-3 min-w-min">
                <div
                  v-for="tier in tiers"
                  :key="tier.tier"
                  :data-current="tier.tier === currentTierNum ? '1' : '0'"
                  class="w-[116px] shrink-0"
                >
                  <!-- GRAN PREMIO (último tier) -->
                  <div v-if="tier.tier === finalTier?.tier" class="relative rounded-2xl border-2 border-amber-400/50 bg-gradient-to-b from-amber-500/15 to-slate-900/60 p-3 shadow-lg shadow-amber-500/10">
                    <div class="text-[9px] uppercase tracking-wider text-amber-300 font-bold text-center mb-2">★ Gran Premio ★</div>
                    <div class="grid place-items-center">
                      <div class="w-16 h-16 rounded-2xl grid place-items-center text-3xl" :class="frameStyle('champion').wrap">🏅</div>
                    </div>
                    <div class="text-center mt-2">
                      <div class="text-[11px] font-bold text-amber-200 leading-tight">Borde Campeón</div>
                      <div class="text-[9px] text-slate-400">exclusivo del pase</div>
                    </div>
                    <button
                      v-if="canClaim(tier, activeTrack)"
                      @click="handleClaim(tier, activeTrack)"
                      :disabled="claiming === tier.tier + '_' + activeTrack"
                      class="mt-2 w-full rounded-lg bg-gradient-to-r from-amber-400 to-yellow-500 text-black py-1.5 text-xs font-bold hover:brightness-110 transition disabled:opacity-60"
                    >Reclamar</button>
                    <div v-else class="mt-2 text-center text-[10px] font-semibold" :class="tierState(tier, activeTrack) === 'claimed' ? 'text-amber-400' : 'text-slate-500'">
                      {{ tierState(tier, activeTrack) === 'claimed' ? '✓ Reclamado' : 'Nivel ' + tier.tier }}
                    </div>
                  </div>

                  <!-- Tier normal -->
                  <div
                    v-else
                    class="relative rounded-2xl border p-3 transition-all"
                    :class="[
                      tier.tier === currentTierNum ? 'border-amber-400/40 bg-amber-500/[0.05]' : 'border-white/10 bg-white/[0.02]',
                      !tier.unlocked ? 'opacity-70' : '',
                    ]"
                  >
                    <!-- Nodo nivel -->
                    <div class="flex justify-center">
                      <div
                        class="w-9 h-9 rounded-full grid place-items-center text-sm font-bold border-2"
                        :class="tier.unlocked ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300' : 'bg-slate-800 border-white/10 text-slate-500'"
                      >{{ tier.tier }}</div>
                    </div>
                    <div class="text-center text-[9px] text-slate-500 mt-1 tabular-nums">{{ tier.points_required }} pts</div>

                    <!-- Recompensa del track activo -->
                    <div class="mt-2 h-[60px] rounded-xl grid place-items-center text-center"
                      :class="activeTrack === 'free' ? 'bg-emerald-500/[0.07] border border-emerald-500/15' : 'bg-amber-500/[0.07] border border-amber-500/15'">
                      <div v-if="rewardFor(tier, activeTrack).powerup">
                        <div class="text-2xl leading-none">{{ powerupIcon(rewardFor(tier, activeTrack).powerup) }}</div>
                        <div class="text-[9px] font-bold mt-0.5" :class="activeTrack === 'free' ? 'text-emerald-300' : 'text-amber-300'">×{{ rewardFor(tier, activeTrack).qty }}</div>
                      </div>
                      <div v-else-if="rewardFor(tier, activeTrack).xp > 0">
                        <div class="font-display font-extrabold text-lg leading-none" :class="activeTrack === 'free' ? 'text-emerald-300' : 'text-amber-300'">+{{ rewardFor(tier, activeTrack).xp }}</div>
                        <div class="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">XP</div>
                      </div>
                      <div v-else class="text-slate-600 text-lg">—</div>
                    </div>

                    <!-- Estado / claim -->
                    <button
                      v-if="canClaim(tier, activeTrack)"
                      @click="handleClaim(tier, activeTrack)"
                      :disabled="claiming === tier.tier + '_' + activeTrack"
                      class="mt-2 w-full rounded-lg py-1.5 text-xs font-bold transition disabled:opacity-60"
                      :class="activeTrack === 'free' ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:brightness-110' : 'bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:brightness-110'"
                    >Reclamar</button>
                    <div v-else class="mt-2 text-center text-[10px] font-semibold py-1.5"
                      :class="{
                        'text-emerald-400': tierState(tier, activeTrack) === 'claimed' && activeTrack === 'free',
                        'text-amber-400': tierState(tier, activeTrack) === 'claimed' && activeTrack === 'premium',
                        'text-slate-500': tierState(tier, activeTrack) !== 'claimed',
                      }">
                      <span v-if="tierState(tier, activeTrack) === 'claimed'">✓ Reclamado</span>
                      <span v-else-if="tierState(tier, activeTrack) === 'locked-premium'">🔒 Premium</span>
                      <span v-else-if="tierState(tier, activeTrack) === 'locked'">🔒 Bloqueado</span>
                      <span v-else>—</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="px-5 pb-5 text-center text-[11px] text-slate-500">
              Deslizá para ver todos los niveles · el último te da un borde exclusivo
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.pass-track { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.15) transparent; }
.pass-track::-webkit-scrollbar { height: 8px; }
.pass-track::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 4px; }

.pass-modal-enter-active, .pass-modal-leave-active { transition: opacity 0.25s ease; }
.pass-modal-enter-from, .pass-modal-leave-to { opacity: 0; }
.pass-modal-enter-active .relative.w-full, .pass-modal-leave-active .relative.w-full { transition: transform 0.25s var(--ease-bounce, ease); }
.pass-modal-enter-from .relative.w-full { transform: scale(0.96); }
</style>
