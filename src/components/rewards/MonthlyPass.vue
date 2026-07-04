<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getMonthlyPass, claimPassTier, powerupLabel } from '../../services/rewards'
import { pushClaimNotification } from '../../stores/notifications'
import { soundManager } from '../../services/sounds'
import PassCosmetic from './PassCosmetic.vue'
import PowerupIcon from './PowerupIcon.vue'

const router = useRouter()
const pass = ref({ points: 0, tiers: [], is_premium: false })
const loading = ref(true)
const claiming = ref(null)
const detailOpen = ref(false)
const trackEl = ref(null)

const POWERUP_ICONS = { fifty_fifty: '✂️', shield: '🛡️', extra_time: '⏱️', reveal_hint: '💡' }
function powerupIcon(t) { return POWERUP_ICONS[t] || '🎁' }

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
      else if (res.powerup) pushClaimNotification({ type: 'powerup', title, emoji: powerupIcon(res.powerup) })
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
            <h2 class="font-display font-extrabold text-white text-lg leading-tight">{{ seasonName }}</h2>
            <span v-if="pass.is_premium" class="rounded-full bg-amber-500/15 border border-amber-500/40 px-2 py-0.5 text-[10px] font-bold text-amber-300">⭐ PRO</span>
          </div>
          <div class="text-[11px] text-slate-400 capitalize mt-0.5">{{ monthLabel }}</div>
        </div>
      </div>

      <!-- Días restantes (arriba a la derecha) -->
      <div class="shrink-0 flex flex-col items-end gap-1">
        <div class="inline-flex items-center gap-1.5 rounded-full bg-black/30 border border-white/10 px-2.5 py-1 text-[11px] font-bold text-slate-200">
          <svg class="w-3.5 h-3.5 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <span class="tabular-nums">{{ daysLeft }}</span> {{ daysLeft === 1 ? 'día' : 'días' }}
        </div>
        <div v-if="claimableCount > 0" class="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 px-2.5 py-1 text-[11px] font-bold text-emerald-300" style="animation: claim-pulse 2s ease-in-out infinite">
          {{ claimableCount }} para reclamar
        </div>
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

  <!-- ════════ MODAL DE DETALLE ════════ -->
  <Teleport to="body">
    <Transition name="pass-modal">
      <div v-if="detailOpen" class="fixed inset-0 z-[60] overflow-y-auto">
        <div class="fixed inset-0 bg-black/80 backdrop-blur-sm" @click="detailOpen = false"></div>
        <div class="relative min-h-full flex items-center justify-center p-3 sm:p-4" @click.self="detailOpen = false">
          <div class="relative w-full max-w-5xl rounded-2xl border border-white/15 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 shadow-2xl">

            <!-- Header -->
            <div class="relative overflow-hidden rounded-t-2xl border-b border-white/10 bg-gradient-to-r from-amber-500/[0.12] to-cyan-500/[0.06] p-5">
              <div class="pointer-events-none absolute -top-12 right-10 w-40 h-40 rounded-full bg-amber-500/15 blur-3xl"></div>
              <button @click="detailOpen = false" class="absolute top-4 right-4 text-slate-400 hover:text-white transition z-10">
                <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
              <div class="relative flex items-center gap-3 pr-10">
                <div class="w-12 h-12 rounded-2xl grid place-items-center text-2xl bg-amber-500/15 border border-amber-400/30">🎟️</div>
                <div class="flex-1 min-w-0">
                  <h2 class="font-display font-extrabold text-white text-xl leading-tight">{{ seasonName }}</h2>
                  <div class="text-xs text-slate-400 capitalize">{{ monthLabel }} · <span class="text-amber-300 font-bold">{{ points }} puntos</span></div>
                </div>
                <!-- Días restantes -->
                <div class="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-black/30 border border-white/10 px-3 py-1.5 text-xs font-bold text-slate-200">
                  <svg class="w-4 h-4 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  Quedan <span class="tabular-nums text-amber-200">{{ daysLeft }}</span> {{ daysLeft === 1 ? 'día' : 'días' }}
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

            <!-- Comparativa Gratis vs PRO (leyenda + CTA) -->
            <div class="px-5 pt-4 flex flex-wrap items-center justify-between gap-3">
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

            <!-- Track horizontal: DOS VÍAS (Gratis arriba / PRO abajo) -->
            <div ref="trackEl" class="overflow-x-auto px-5 py-4 pass-track">
              <div class="flex gap-3 min-w-min">
                <div
                  v-for="tier in tiers"
                  :key="tier.tier"
                  :data-current="tier.tier === currentTierNum ? '1' : '0'"
                  class="w-[120px] shrink-0 flex flex-col gap-2"
                >
                  <!-- ── Vía GRATIS ── -->
                  <div
                    class="relative rounded-xl border p-2 transition-all"
                    :class="[
                      tierState(tier, 'free') === 'claimable' ? 'border-emerald-400/50 bg-emerald-500/[0.08]' : 'border-emerald-500/15 bg-emerald-500/[0.03]',
                      !tier.unlocked ? 'opacity-70' : '',
                    ]"
                  >
                    <div class="h-[62px] grid place-items-center text-center">
                      <div v-if="rewardFor(tier, 'free').cos" class="flex flex-col items-center gap-1">
                        <PassCosmetic :cos="rewardFor(tier, 'free').cos" :size="40" />
                        <div class="text-[8px] font-bold text-emerald-200 leading-none truncate max-w-[104px]">{{ rewardFor(tier, 'free').cos.name }}</div>
                      </div>
                      <div v-else-if="rewardFor(tier, 'free').powerup">
                        <PowerupIcon :type="rewardFor(tier, 'free').powerup" :size="40" />
                        <div class="text-[9px] font-bold text-emerald-300 mt-0.5">×{{ rewardFor(tier, 'free').qty }}</div>
                      </div>
                      <div v-else-if="rewardFor(tier, 'free').xp > 0">
                        <div class="font-display font-extrabold text-lg leading-none text-emerald-300">+{{ rewardFor(tier, 'free').xp }}</div>
                        <div class="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">XP</div>
                      </div>
                      <div v-else class="text-slate-600 text-lg">—</div>
                    </div>
                    <button
                      v-if="canClaim(tier, 'free')"
                      @click="handleClaim(tier, 'free')"
                      :disabled="claiming === tier.tier + '_free'"
                      class="mt-1 w-full rounded-lg py-1 text-[11px] font-bold bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:brightness-110 transition disabled:opacity-60"
                    >Reclamar</button>
                    <div v-else class="mt-1 text-center text-[10px] font-semibold py-1"
                      :class="tierState(tier, 'free') === 'claimed' ? 'text-emerald-400' : 'text-slate-600'">
                      <span v-if="tierState(tier, 'free') === 'claimed'">✓</span>
                      <span v-else-if="tierState(tier, 'free') === 'locked'">🔒</span>
                      <span v-else>—</span>
                    </div>
                  </div>

                  <!-- ── Nodo del nivel ── -->
                  <div class="flex flex-col items-center py-0.5">
                    <div
                      class="w-8 h-8 rounded-full grid place-items-center text-xs font-bold border-2"
                      :class="tier.unlocked ? 'bg-amber-500/20 border-amber-400/50 text-amber-200' : 'bg-slate-800 border-white/10 text-slate-500'"
                    >{{ tier.tier }}</div>
                    <div class="text-[8px] text-slate-500 mt-0.5 tabular-nums">{{ tier.points_required }} pts</div>
                  </div>

                  <!-- ── Vía PRO ── -->
                  <div
                    class="relative rounded-xl border p-2 transition-all"
                    :class="[
                      tierState(tier, 'premium') === 'claimable' ? 'border-amber-400/50 bg-amber-500/[0.08]' : 'border-amber-500/15 bg-amber-500/[0.03]',
                      (!tier.unlocked || (!pass.is_premium)) ? 'opacity-80' : '',
                    ]"
                  >
                    <div class="absolute top-1 right-1 text-[8px] font-bold uppercase tracking-wide text-amber-400/70">PRO</div>
                    <div class="h-[62px] grid place-items-center text-center">
                      <div v-if="rewardFor(tier, 'premium').cos" class="flex flex-col items-center gap-1">
                        <PassCosmetic :cos="rewardFor(tier, 'premium').cos" :size="40" />
                        <div class="text-[8px] font-bold text-amber-200 leading-none truncate max-w-[104px]">{{ rewardFor(tier, 'premium').cos.name }}</div>
                      </div>
                      <div v-else-if="rewardFor(tier, 'premium').powerup">
                        <PowerupIcon :type="rewardFor(tier, 'premium').powerup" :size="40" />
                        <div class="text-[9px] font-bold text-amber-300 mt-0.5">×{{ rewardFor(tier, 'premium').qty }}</div>
                      </div>
                      <div v-else-if="rewardFor(tier, 'premium').xp > 0">
                        <div class="font-display font-extrabold text-lg leading-none text-amber-300">+{{ rewardFor(tier, 'premium').xp }}</div>
                        <div class="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">XP</div>
                      </div>
                      <div v-else class="text-slate-600 text-lg">—</div>
                    </div>
                    <button
                      v-if="canClaim(tier, 'premium')"
                      @click="handleClaim(tier, 'premium')"
                      :disabled="claiming === tier.tier + '_premium'"
                      class="mt-1 w-full rounded-lg py-1 text-[11px] font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:brightness-110 transition disabled:opacity-60"
                    >Reclamar</button>
                    <button
                      v-else-if="tierState(tier, 'premium') === 'locked-premium'"
                      @click="router.push('/pricing')"
                      class="mt-1 w-full rounded-lg py-1 text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition"
                    >🔒 PRO</button>
                    <div v-else class="mt-1 text-center text-[10px] font-semibold py-1"
                      :class="tierState(tier, 'premium') === 'claimed' ? 'text-amber-400' : 'text-slate-600'">
                      <span v-if="tierState(tier, 'premium') === 'claimed'">✓</span>
                      <span v-else-if="tierState(tier, 'premium') === 'locked'">🔒</span>
                      <span v-else>—</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="px-5 pb-5 text-center text-[11px] text-slate-500">
              Deslizá para ver todos los niveles · <span class="text-emerald-300">Gratis</span> arriba, <span class="text-amber-300">PRO</span> abajo
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
