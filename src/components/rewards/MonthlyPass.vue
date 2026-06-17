<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getMonthlyPass, claimPassTier, powerupLabel } from '../../services/rewards'
import { pushClaimNotification } from '../../stores/notifications'
import { soundManager } from '../../services/sounds'

const router = useRouter()
const pass = ref({ points: 0, tiers: [], is_premium: false })
const loading = ref(true)
const claiming = ref(null)

const POWERUP_ICONS = { fifty_fifty: '✂️', shield: '🛡️', extra_time: '⏱️', reveal_hint: '💡' }
function powerupIcon(t) { return POWERUP_ICONS[t] || '🎁' }

const monthLabel = computed(() => {
  if (!pass.value.month) return ''
  try {
    return new Date(pass.value.month + 'T00:00:00').toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  } catch { return '' }
})

const maxPoints = computed(() => {
  const t = pass.value.tiers
  return t.length ? t[t.length - 1].points_required : 1
})

async function load() {
  loading.value = true
  try {
    pass.value = await getMonthlyPass()
  } finally {
    loading.value = false
  }
}

function canClaim(tier, track) {
  if (!tier.unlocked) return false
  if (track === 'premium' && !pass.value.is_premium) return false
  const has = track === 'free' ? (tier.free_xp > 0 || tier.free_powerup) : (tier.premium_xp > 0 || tier.premium_powerup)
  const claimed = track === 'free' ? tier.free_claimed : tier.premium_claimed
  return has && !claimed
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

onMounted(load)
defineExpose({ reload: load })
</script>

<template>
  <div class="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/[0.06] via-slate-900/40 to-cyan-500/[0.04] p-5">
    <!-- Header -->
    <div class="flex items-center justify-between gap-3 mb-4">
      <div>
        <div class="flex items-center gap-2">
          <span class="text-lg">🎟️</span>
          <h2 class="font-display font-bold text-white text-lg leading-tight">Pase mensual</h2>
        </div>
        <div class="text-[11px] text-slate-400 capitalize mt-0.5">{{ monthLabel }} · {{ pass.points }} pts</div>
      </div>
      <div v-if="!pass.is_premium" class="shrink-0">
        <button
          @click="router.push('/pricing')"
          class="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-110 text-black px-3.5 py-2 text-xs font-bold transition shadow-lg shadow-amber-500/20"
        >
          Desbloquear premium
        </button>
      </div>
      <div v-else class="shrink-0 rounded-full bg-amber-500/15 border border-amber-500/30 px-3 py-1 text-xs font-bold text-amber-300">
        ⭐ Premium
      </div>
    </div>

    <div v-if="loading" class="h-40 rounded-xl bg-white/5 animate-pulse"></div>

    <div v-else-if="pass.tiers.length" class="overflow-x-auto -mx-1 px-1 pb-1">
      <div class="flex gap-2.5 min-w-min">
        <div v-for="tier in pass.tiers" :key="tier.tier" class="w-[88px] shrink-0 flex flex-col gap-2">

          <!-- Track PREMIUM (arriba) -->
          <div
            class="relative rounded-xl border p-2 h-[68px] flex flex-col items-center justify-center text-center transition-all"
            :class="[
              tier.premium_claimed ? 'border-amber-500/20 bg-amber-500/[0.04] opacity-60'
                : canClaim(tier, 'premium') ? 'border-amber-500/40 bg-amber-500/10 cursor-pointer hover:bg-amber-500/15'
                : 'border-white/8 bg-white/[0.02]',
            ]"
            @click="canClaim(tier, 'premium') && handleClaim(tier, 'premium')"
          >
            <div v-if="tier.premium_xp > 0" class="text-[11px] font-bold text-amber-300 leading-none">+{{ tier.premium_xp }}<span class="text-[8px]"> XP</span></div>
            <div v-if="tier.premium_powerup" class="text-base leading-none mt-0.5">{{ powerupIcon(tier.premium_powerup) }}<span class="text-[9px] font-bold text-amber-200">×{{ tier.premium_powerup_qty }}</span></div>

            <div v-if="tier.premium_claimed" class="absolute inset-0 grid place-items-center bg-slate-900/40 rounded-xl">
              <svg class="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
            </div>
            <div v-else-if="!pass.is_premium" class="absolute top-1 right-1 text-amber-400/70">
              <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/></svg>
            </div>
            <div v-else-if="canClaim(tier, 'premium')" class="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></div>
          </div>

          <!-- Nodo central: nivel + puntos -->
          <div class="flex flex-col items-center">
            <div
              class="w-8 h-8 rounded-full grid place-items-center text-xs font-bold border-2 transition-all"
              :class="tier.unlocked ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300' : 'bg-slate-800 border-white/10 text-slate-500'"
            >
              {{ tier.tier }}
            </div>
            <div class="text-[9px] text-slate-500 mt-0.5 tabular-nums">{{ tier.points_required }}</div>
          </div>

          <!-- Track GRATIS (abajo) -->
          <div
            class="relative rounded-xl border p-2 h-[68px] flex flex-col items-center justify-center text-center transition-all"
            :class="[
              tier.free_claimed ? 'border-emerald-500/20 bg-emerald-500/[0.04] opacity-60'
                : canClaim(tier, 'free') ? 'border-emerald-500/40 bg-emerald-500/10 cursor-pointer hover:bg-emerald-500/15'
                : 'border-white/8 bg-white/[0.02]',
            ]"
            @click="canClaim(tier, 'free') && handleClaim(tier, 'free')"
          >
            <div v-if="tier.free_xp > 0" class="text-[11px] font-bold text-emerald-300 leading-none">+{{ tier.free_xp }}<span class="text-[8px]"> XP</span></div>
            <div v-if="tier.free_powerup" class="text-base leading-none mt-0.5">{{ powerupIcon(tier.free_powerup) }}<span class="text-[9px] font-bold text-emerald-200">×{{ tier.free_powerup_qty }}</span></div>
            <div v-if="!tier.free_xp && !tier.free_powerup" class="text-[10px] text-slate-600">—</div>

            <div v-if="tier.free_claimed" class="absolute inset-0 grid place-items-center bg-slate-900/40 rounded-xl">
              <svg class="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
            </div>
            <div v-else-if="canClaim(tier, 'free')" class="absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></div>
          </div>

          <!-- Etiquetas de fila (solo primera columna) -->
        </div>
      </div>
      <div class="flex items-center justify-between mt-2 text-[10px] uppercase tracking-wider text-slate-500">
        <span class="text-amber-400/70">▲ Premium</span>
        <span class="text-emerald-400/70">▼ Gratis</span>
      </div>
    </div>
  </div>
</template>
