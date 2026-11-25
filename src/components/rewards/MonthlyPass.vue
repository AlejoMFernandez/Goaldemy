<script setup>
// ABONO DE TEMPORADA (pase mensual) — v4 "entradas partidas".
//
//  <MonthlyPass />          → pase completo inline (pestaña Pase / RewardCenter,
//                             ChallengesModal). Sin props: ese contrato se mantiene.
//  <MonthlyPass compact />  → teaser chico para la Home; al tocarlo va a /rewards.
//
// Datos: get_monthly_pass (services/rewards.getMonthlyPass) · cobro: claimPassTier.
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { getMonthlyPass, claimPassTier } from '../../services/rewards'
import { pushClaimNotification } from '../../stores/notifications'
import { soundManager } from '../../services/sounds'
import { flyReward } from '../../services/reward-flight'
import { tap, success, error as hapticError } from '../../services/haptics'
import PassSeasonHeader from '../pass/PassSeasonHeader.vue'
import PassTicket from '../pass/PassTicket.vue'
import PassPrize from '../pass/PassPrize.vue'
import { rewardOf, stubState } from '../pass/pass-rewards'
import { rarity as rarityInfo } from '../../services/cosmetics'

const props = defineProps({
  // Versión liviana para el teaser de la Home (Landing.vue).
  compact: { type: Boolean, default: false },
})

const router = useRouter()
const pass = ref({ points: 0, tiers: [], is_premium: false })
const loading = ref(true)
const busyKey = ref('')
const progress = ref(null) // { done, total } durante "Cobrar todo"
const justClaimed = ref(new Set())
const listEl = ref(null)

const POWERUP_TOAST_EMOJI = { fifty_fifty: '✂️', shield: '🛡️', extra_time: '⏱️', reveal_hint: '💡' }

const tiers = computed(() => pass.value.tiers || [])
const points = computed(() => pass.value.points || 0)
const isPremium = computed(() => !!pass.value.is_premium)
const daysLeft = computed(() => Math.max(0, pass.value.days_left ?? 0))

const monthName = computed(() => {
  if (!pass.value.month) return ''
  try {
    const m = new Date(pass.value.month + 'T00:00:00').toLocaleDateString('es-AR', { month: 'long' })
    return m.charAt(0).toUpperCase() + m.slice(1)
  } catch { return '' }
})
const seasonName = computed(() => pass.value.season?.name || (monthName.value ? `Temporada ${monthName.value}` : 'Abono mensual'))
const serialPrefix = computed(() => (seasonName.value.replace(/^temporada\s+/i, '').charAt(0) || 'F').toUpperCase())

const currentTierNum = computed(() => {
  let n = 0
  for (const t of tiers.value) if (t.unlocked) n = t.tier
  return n
})
const nextLevel = computed(() => {
  const next = tiers.value.find(t => !t.unlocked)
  if (!next) return null
  const prev = tiers.value.find(t => t.tier === currentTierNum.value)
  const prevReq = prev ? prev.points_required : 0
  return {
    tier: next.tier,
    into: Math.max(0, points.value - prevReq),
    span: Math.max(1, next.points_required - prevReq),
  }
})
const finalPrize = computed(() => {
  const last = tiers.value[tiers.value.length - 1]
  const cos = last?.free_cosmetic || last?.premium_cosmetic
  return cos ? { name: cos.name, rarity: rarityInfo(cos.rarity).label.toLowerCase(), cos } : null
})

// Todo lo cobrable ahora, en orden (nivel ↑, Popular antes que Platea).
const readyList = computed(() => {
  const out = []
  for (const t of tiers.value) {
    for (const track of ['free', 'premium']) {
      if (stubState(t, track, isPremium.value) === 'ready') out.push({ tier: t, track })
    }
  }
  return out
})

async function load() {
  loading.value = true
  try {
    pass.value = await getMonthlyPass()
  } finally {
    loading.value = false
  }
  if (!props.compact) nextTick(scrollToCurrent)
}

// Scroll del riel de entradas (no de la página) hasta el nivel actual.
function scrollToRow(row, smooth) {
  const list = listEl.value
  if (!list || !row) return
  const top = row.offsetTop - list.clientHeight / 2 + row.offsetHeight / 2
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
  list.scrollTo({ top: Math.max(0, top), behavior: smooth && !reduce ? 'smooth' : 'auto' })
}
function scrollToCurrent() {
  scrollToRow(listEl.value?.querySelector('[data-current="1"]'), false)
}
function stubEl(tierNum, track) {
  const row = listEl.value?.querySelector(`[data-tier="${tierNum}"]`)
  return row?.querySelector(track === 'free' ? '.stub--pop' : '.stub--pla') || row || null
}

function markClaimed(tierNum, track) {
  const idx = pass.value.tiers.findIndex(x => x.tier === tierNum)
  if (idx !== -1) {
    pass.value.tiers[idx] = { ...pass.value.tiers[idx], [track === 'free' ? 'free_claimed' : 'premium_claimed']: true }
  }
  const k = `${tierNum}_${track}`
  justClaimed.value = new Set([...justClaimed.value, k])
  setTimeout(() => {
    const s = new Set(justClaimed.value); s.delete(k); justClaimed.value = s
  }, 700)
}

/**
 * Cobra una mitad. En lote (Cobrar todo) no muestra toasts sueltos: devuelve
 * lo cobrado para armar un resumen al final.
 */
async function claimOne(tier, track, el, { batch = false } = {}) {
  const key = `${tier.tier}_${track}`
  if (busyKey.value) return null
  busyKey.value = key
  if (!batch) tap()
  try {
    const res = await claimPassTier(tier.tier, track)
    if (!res?.ok) {
      hapticError()
      return null
    }
    markClaimed(tier.tier, track)
    soundManager.play('claim')
    if (!batch) success()

    const reward = rewardOf(tier, track)
    const from = el || stubEl(tier.tier, track)
    const title = `${seasonName.value} · Nivel ${tier.tier}`
    // Vuelo de la recompensa (XP / ayuda) hacia su contador; toast de respaldo.
    const flying = res.powerup
      ? flyReward(from, { kind: 'powerup', powerup: res.powerup })
      : (res.xp > 0 ? flyReward(from, { kind: 'xp', amount: res.xp }) : Promise.resolve(false))
    if (!batch) {
      if (reward?.kind === 'cosmetic') {
        pushClaimNotification({ type: 'cosmetic', title: `${title} — ${reward.cos.name}`, emoji: '🎁' })
      } else {
        flying.then((flown) => {
          if (flown) return
          if (res.powerup) pushClaimNotification({ type: 'powerup', title, emoji: POWERUP_TOAST_EMOJI[res.powerup] || '🎁' })
          else pushClaimNotification({ type: 'xp', title, xp: res.xp, emoji: '🎟️' })
        })
      }
    }
    return { xp: Number(res.xp) || 0, cosmetic: reward?.kind === 'cosmetic' ? reward.cos : null }
  } catch {
    hapticError()
    return null
  } finally {
    busyKey.value = ''
  }
}

function onClaim(tier, track, el) {
  if (progress.value) return
  claimOne(tier, track, el)
}

async function claimAll() {
  const list = readyList.value.slice()
  if (!list.length || progress.value) return
  tap()
  progress.value = { done: 0, total: list.length }
  let ok = 0, xp = 0
  const cosmetics = []
  for (const { tier, track } of list) {
    scrollToRow(listEl.value?.querySelector(`[data-tier="${tier.tier}"]`), true)
    const got = await claimOne(tier, track, null, { batch: true })
    if (got) {
      ok++; xp += got.xp
      if (got.cosmetic) cosmetics.push(got.cosmetic)
    }
    progress.value = { done: progress.value.done + 1, total: list.length }
    await new Promise(r => setTimeout(r, 160)) // ritmo: se ve cada sello caer
  }
  progress.value = null
  if (ok) {
    success()
    const title = `${seasonName.value} · cobraste ${ok} ${ok === 1 ? 'premio' : 'premios'}`
    if (cosmetics.length) pushClaimNotification({ type: 'cosmetic', title: `${title} (${cosmetics.map(c => c.name).join(', ')})`, emoji: '🎁' })
    else pushClaimNotification({ type: 'xp', title, xp, emoji: '🎟️' })
  }
  // Si algo falló a mitad de camino, resincronizamos con el servidor.
  if (ok < list.length) load()
}

function goPricing() {
  tap()
  router.push('/pricing')
}
function goPass() {
  router.push('/rewards')
}

onMounted(load)
defineExpose({ reload: load })
</script>

<template>
  <!-- ════════ TEASER (Home) ════════ -->
  <button v-if="compact" type="button" class="mp-teaser" @click="goPass" :aria-label="`Abrir ${seasonName}`">
    <span class="mp-teaser-scan" aria-hidden="true"></span>
    <span class="mp-teaser-row">
      <span class="mp-teaser-title">
        <span class="mp-kicker">ABONO DE TEMPORADA</span>
        <span class="mp-teaser-name">{{ seasonName }}</span>
      </span>
      <span v-if="finalPrize" class="mp-teaser-prize" aria-hidden="true">
        <PassPrize :reward="{ kind: 'cosmetic', cos: finalPrize.cos, rarity: finalPrize.cos.rarity }" />
      </span>
    </span>
    <span v-if="loading" class="mp-teaser-skel" aria-hidden="true"></span>
    <template v-else>
      <span class="mp-teaser-bar"><span :style="{ width: (tiers.length ? Math.round((currentTierNum / tiers.length) * 100) : 0) + '%' }"></span></span>
      <span class="mp-teaser-foot">
        <span>Nivel <b>{{ currentTierNum }}</b> / {{ tiers.length }}</span>
        <span v-if="readyList.length" class="mp-teaser-ready">{{ readyList.length }} para cobrar</span>
        <span v-else class="mp-teaser-cta">Ver abono ›</span>
      </span>
    </template>
  </button>

  <!-- ════════ ABONO COMPLETO ════════ -->
  <div v-else class="mp">
    <div v-if="loading" class="mp-skel" aria-busy="true" aria-label="Cargando abono">
      <span class="mp-skel-hd"></span>
      <span v-for="i in 4" :key="i" class="mp-skel-row"></span>
    </div>

    <template v-else-if="tiers.length">
      <PassSeasonHeader
        :seasonName="seasonName" :daysLeft="daysLeft"
        :level="currentTierNum" :totalLevels="tiers.length" :points="points"
        :nextLevel="nextLevel" :finalPrize="finalPrize"
        :isPremium="isPremium" :readyCount="readyList.length" :progress="progress"
        @activate="goPricing" @claim-all="claimAll"
      />

      <div class="mp-legend" aria-hidden="true">
        <span class="mp-legend-pop">POPULAR <small>gratis</small></span>
        <span class="mp-legend-nv">NV</span>
        <span class="mp-legend-pla">PLATEA <em>PRO</em></span>
      </div>

      <div ref="listEl" class="mp-list" role="list" aria-label="Niveles del abono">
        <div v-for="t in tiers" :key="t.tier" role="listitem" :data-tier="t.tier" :data-current="t.tier === currentTierNum ? '1' : '0'">
          <PassTicket
            :tier="t" :isPremium="isPremium" :current="t.tier === currentTierNum"
            :serialPrefix="serialPrefix" :busyKey="busyKey" :justClaimed="justClaimed"
            @claim="onClaim" @upgrade="goPricing"
          />
        </div>
      </div>
    </template>

    <div v-else class="mp-empty">
      <b>Todavía no hay abono este mes.</b>
      <span>Jugá y volvé en un rato: los niveles aparecen apenas arranca la temporada.</span>
    </div>
  </div>
</template>

<style scoped>
.mp { display: flex; flex-direction: column; gap: 10px; }

.mp-legend {
  display: grid; grid-template-columns: 1fr 54px 1fr; align-items: center; padding: 0 2px;
  font-family: var(--font-bug); font-weight: 800; font-size: 14px; letter-spacing: 1px;
}
.mp-legend-pop { color: #e7d3ad; }
.mp-legend-pop small { font-family: var(--font-sans); font-weight: 700; font-size: 10.5px; letter-spacing: 0; color: #94a3b8; }
.mp-legend-nv { text-align: center; color: #64748b; }
.mp-legend-pla { color: #fca5a5; display: flex; align-items: center; justify-content: flex-end; gap: 4px; }
.mp-legend-pla em {
  font-style: normal; padding: 1px 6px; border-radius: 6px; background: linear-gradient(180deg, #fcd34d, #f59e0b);
  color: #1c1206; font-size: 11px; letter-spacing: 0.5px;
}

/* Riel de entradas: scrollea solo (así el auto-scroll al nivel actual no mueve la página) */
.mp-list {
  position: relative; display: flex; flex-direction: column; gap: 10px;
  max-height: max(340px, calc(100dvh - 400px - env(safe-area-inset-bottom, 0px)));
  overflow-y: auto; overscroll-behavior-y: auto; padding: 8px 6px 14px; margin: 0 -6px;
  scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.15) transparent;
  -webkit-mask-image: linear-gradient(180deg, transparent 0, #000 10px, #000 calc(100% - 14px), transparent 100%);
          mask-image: linear-gradient(180deg, transparent 0, #000 10px, #000 calc(100% - 14px), transparent 100%);
}

.mp-skel { display: flex; flex-direction: column; gap: 10px; }
.mp-skel-hd, .mp-skel-row { display: block; border-radius: 16px; background: rgba(255,255,255,0.05); animation: mp-pulse 1.4s ease-in-out infinite; }
.mp-skel-hd { height: 196px; border-radius: 20px; }
.mp-skel-row { height: 108px; border-radius: 12px; }
@keyframes mp-pulse { 50% { opacity: 0.55; } }

.mp-empty {
  display: flex; flex-direction: column; gap: 4px; padding: 18px; border-radius: 16px; text-align: center;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: #94a3b8; font-size: 13px;
}
.mp-empty b { color: #f1e4c6; font-size: 15px; }

/* ── Teaser ── */
.mp-teaser {
  position: relative; width: 100%; overflow: hidden; display: flex; flex-direction: column; gap: 10px; text-align: left;
  padding: 14px; border-radius: 18px; border: 1px solid rgba(253,230,138,0.25); cursor: pointer; color: #f1e4c6; font: inherit;
  background: linear-gradient(160deg, #4a2e14 0%, #2a1a0c 55%, #160e07 100%); transition: transform 0.12s ease;
  -webkit-tap-highlight-color: transparent;
}
.mp-teaser:active { transform: scale(0.99); }
.mp-teaser:focus-visible { outline: 3px solid #fde68a; outline-offset: 2px; }
.mp-teaser-scan { position: absolute; inset: 0; background: repeating-linear-gradient(0deg, rgba(255,255,255,0.025) 0 2px, transparent 2px 4px); pointer-events: none; }
.mp-teaser-row { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.mp-teaser-title { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.mp-kicker { font-size: 10px; font-weight: 800; letter-spacing: 1.4px; color: #d6b98a; }
.mp-teaser-name {
  font-family: var(--font-bug); font-weight: 800; font-style: italic; font-size: 26px; line-height: 0.95;
  text-transform: uppercase; color: #f5e6c4; text-shadow: 0 2px 0 #7c4a1a;
}
.mp-teaser-prize { flex-shrink: 0; display: grid; place-items: center; }
.mp-teaser-bar { position: relative; display: block; height: 10px; border-radius: 999px; background: rgba(0,0,0,0.4); overflow: hidden; }
.mp-teaser-bar span { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, #d97706, #fbbf24, #fde68a); }
.mp-teaser-foot { position: relative; display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: #c4a679; }
.mp-teaser-foot b { color: #fde68a; }
.mp-teaser-ready {
  padding: 2px 8px; border-radius: 999px; background: #22c55e; box-shadow: 0 2px 0 #15803d; color: #fff;
  font-family: var(--font-bug); font-weight: 800; font-size: 13px; letter-spacing: 0.4px;
}
.mp-teaser-cta { font-weight: 700; color: #fbbf24; }
.mp-teaser-skel { display: block; height: 30px; border-radius: 10px; background: rgba(255,255,255,0.06); animation: mp-pulse 1.4s ease-in-out infinite; }

@media (prefers-reduced-motion: reduce) {
  .mp-skel-hd, .mp-skel-row, .mp-teaser-skel { animation: none; }
  .mp-teaser:active { transform: none; }
}
</style>
