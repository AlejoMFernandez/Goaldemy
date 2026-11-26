<script setup>
// ABONO DE TEMPORADA (pase mensual) — v4 "entradas partidas".
//
//  <MonthlyPass />          → pase completo inline (pestaña Pase / RewardCenter,
//                             ChallengesModal). Sin props: ese contrato se mantiene.
//  <MonthlyPass compact />  → teaser chico para la Home; al tocarlo va a /rewards.
//
// Datos: get_monthly_pass (services/rewards.getMonthlyPass) · cobro: claimPassTier.
//
// Gestos del artifact "Abono de temporada", sumados sobre el diseño V4:
//  · Troquel: al volver al abono, cada nivel nuevo se agujerea con "¡clac!"
//    (uno por uno, con el tono subiendo) y los hitos 5/10/…/30 reciben su sello.
//  · Cortar el talón: tocar o arrastrar la mitad lista; el premio vuela.
//  · Se prende la Platea: al activar PRO la columna se enciende de arriba abajo
//    y caen los premios ya ganados, empezando por el nivel 0.
//  · Últimos 3 días: contador rojo con horas (PassSeasonHeader).
//  · Pitazo final: primer ingreso del mes nuevo → sello FINAL + resumen.
// Lo que necesita servidor (nivel 0, Fichas por talón, tiempo de descuento,
// resumen del mes anterior) se pinta solo si get_monthly_pass lo trae
// (ver supabase/pendientes/2026-11-26-abono-temporada.sql).
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { getMonthlyPass, claimPassTier, claimPassOvertime } from '../../services/rewards'
import { getAuthUser } from '../../services/auth'
import { pushClaimNotification } from '../../stores/notifications'
import { soundManager } from '../../services/sounds'
import { flyReward } from '../../services/reward-flight'
import { tap, success, heavy, error as hapticError } from '../../services/haptics'
import PassSeasonHeader from '../pass/PassSeasonHeader.vue'
import PassTicket from '../pass/PassTicket.vue'
import PassPrize from '../pass/PassPrize.vue'
import PassFinalWhistle from '../pass/PassFinalWhistle.vue'
import { rewardOf, stubState } from '../pass/pass-rewards'
import { passTheme, themeVars, isMilestone, monthEndsAt, monthLabel, readMemory, writeMemory } from '../pass/pass-season'
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

// Escenas
const punchedUpTo = ref(null)   // hasta qué nivel se ven agujereados (null = el actual)
const punchTier = ref(null)     // nivel que el troquel está agujereando ahora
const stampTier = ref(null)     // hito que recibe el sello ahora
const lightsOn = ref(false)     // se prende la Platea
const ribbon = ref('')          // aviso corto arriba del riel
const finalSummary = ref(null)  // pitazo final
let finalResolve = null
let alive = true
const timers = []
const wait = (ms) => new Promise(r => timers.push(setTimeout(r, ms)))
const reduced = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches

const POWERUP_TOAST_EMOJI = { fifty_fifty: '✂️', shield: '🛡️', extra_time: '⏱️', reveal_hint: '💡' }
const OVERTIME_TIER = 99 // fila sintética del tiempo de descuento (no es un nivel real)

const tiers = computed(() => pass.value.tiers || [])
const levelTiers = computed(() => tiers.value.filter(t => t.tier > 0))
const zeroTier = computed(() => tiers.value.find(t => t.tier === 0) || null)
const points = computed(() => pass.value.points || 0)
const isPremium = computed(() => !!pass.value.is_premium)
const daysLeft = computed(() => Math.max(0, pass.value.days_left ?? 0))
const endsAt = computed(() => monthEndsAt(pass.value.month))
const theme = computed(() => passTheme(pass.value.season))
const themeStyle = computed(() => themeVars(theme.value))

const monthName = computed(() => monthLabel(pass.value.month))
const seasonName = computed(() => pass.value.season?.name || (monthName.value ? `Temporada ${monthName.value}` : 'Abono mensual'))
const serialPrefix = computed(() => (seasonName.value.replace(/^temporada\s+/i, '').charAt(0) || 'F').toUpperCase())

const currentTierNum = computed(() => {
  let n = 0
  for (const t of levelTiers.value) if (t.unlocked) n = t.tier
  return n
})
const punchLimit = computed(() => punchedUpTo.value ?? currentTierNum.value)
const nextLevel = computed(() => {
  const next = levelTiers.value.find(t => !t.unlocked)
  if (!next) return null
  const prev = levelTiers.value.find(t => t.tier === currentTierNum.value)
  const prevReq = prev ? prev.points_required : 0
  return {
    tier: next.tier,
    into: Math.max(0, points.value - prevReq),
    span: Math.max(1, next.points_required - prevReq),
  }
})
const finalPrize = computed(() => {
  const last = levelTiers.value[levelTiers.value.length - 1]
  const cos = last?.free_cosmetic || last?.premium_cosmetic
  return cos ? { name: cos.name, rarity: rarityInfo(cos.rarity).label.toLowerCase(), cos } : null
})

// ── Tiempo de descuento (solo si el servidor lo manda) ──
// get_monthly_pass.overtime = { step, fichas, max, earned, free_claimed, premium_claimed }
const overtime = computed(() => {
  const o = pass.value.overtime
  if (!o || typeof o !== 'object') return null
  const step = Number(o.step) || 30
  const max = Number(o.max) || 10
  const earned = Math.max(0, Math.min(max, Number(o.earned) || 0))
  const last = levelTiers.value[levelTiers.value.length - 1]
  const over = Math.max(0, points.value - (last?.points_required || 0))
  return {
    step, max, earned, fichas: Number(o.fichas) || 50,
    freeClaimed: Number(o.free_claimed) || 0, premiumClaimed: Number(o.premium_claimed) || 0,
    into: earned >= max ? step : over % step,
  }
})
const overtimeTier = computed(() => {
  const o = overtime.value
  if (!o) return null
  const has = o.earned > 0
  return {
    tier: OVERTIME_TIER, overtime: true, points_required: 0, unlocked: has,
    free_fichas: o.fichas, premium_fichas: o.fichas,
    free_claimed: has && o.freeClaimed >= o.earned,
    premium_claimed: has && o.premiumClaimed >= o.earned,
  }
})

// Filas del riel: nivel 0 (si hay) · 1–30 · tiempo de descuento (si hay)
const rows = computed(() => {
  const out = []
  if (zeroTier.value) out.push({ t: zeroTier.value, variant: 'zero' })
  for (const t of levelTiers.value) out.push({ t, variant: '' })
  if (overtimeTier.value) out.push({ t: overtimeTier.value, variant: 'overtime' })
  return out.map((r, i) => ({ ...r, i }))
})

// Todo lo cobrable ahora, en orden (nivel ↑, Popular antes que Platea).
const readyList = computed(() => {
  const out = []
  for (const { t } of rows.value) {
    for (const track of ['free', 'premium']) {
      if (stubState(t, track, isPremium.value) === 'ready') out.push({ tier: t, track })
    }
  }
  return out
})

const uid = () => getAuthUser()?.id || 'anon'
function claimedCount() {
  let n = 0
  for (const t of tiers.value) n += (t.free_claimed ? 1 : 0) + (t.premium_claimed ? 1 : 0)
  return n
}
function saveMemory(extra = {}) {
  if (!pass.value.month) return
  const prev = readMemory(uid()) || {}
  writeMemory(uid(), {
    ...prev,
    month: pass.value.month,
    lvl: currentTierNum.value,
    pro: isPremium.value,
    snap: {
      month: pass.value.month, seasonName: seasonName.value, level: currentTierNum.value,
      totalLevels: levelTiers.value.length, claimed: claimedCount(), points: points.value,
    },
    ...extra,
  })
}

async function load() {
  loading.value = true
  try {
    pass.value = await getMonthlyPass()
  } finally {
    loading.value = false
  }
  if (!props.compact) {
    await nextTick()
    scrollToCurrent()
    runIntro()
  }
}

// Scroll del riel de entradas (no de la página) hasta el nivel actual.
function scrollToRow(row, smooth) {
  const list = listEl.value
  if (!list || !row) return
  const top = row.offsetTop - list.clientHeight / 2 + row.offsetHeight / 2
  list.scrollTo({ top: Math.max(0, top), behavior: smooth && !reduced() ? 'smooth' : 'auto' })
}
function rowEl(tierNum) { return listEl.value?.querySelector(`[data-tier="${tierNum}"]`) || null }
function scrollToCurrent() {
  scrollToRow(listEl.value?.querySelector('[data-current="1"]'), false)
}
function stubEl(tierNum, track) {
  const row = rowEl(tierNum)
  return row?.querySelector(track === 'free' ? '.stub--pop' : '.stub--pla') || row || null
}

// ════════ Escenas de entrada: pitazo final → troquel → Platea ════════
async function runIntro() {
  if (!levelTiers.value.length || !pass.value.month) return
  // Con link directo, la escena espera a que se vaya el splash de arranque (máx. 3 s)
  for (let i = 0; i < 30 && alive && document.querySelector('.app-splash'); i++) await wait(100)
  if (!alive) return
  const month = pass.value.month
  const mem = readMemory(uid())
  const cur = currentTierNum.value
  const sameMonth = mem?.month === month

  // 1 · Pitazo final (primer ingreso del mes nuevo)
  const summary = buildFinalSummary(mem)
  const baseLvl = sameMonth ? Math.min(cur, Number(mem.lvl) || 0) : (mem ? 0 : cur)
  const plateaNow = sameMonth && mem.pro === false && isPremium.value
  punchedUpTo.value = Math.max(baseLvl, cur - 6) // a lo sumo 6 troqueles seguidos
  saveMemory({ finalSeen: month })

  if (summary) {
    finalSummary.value = summary
    await new Promise(r => { finalResolve = r })
    if (!alive) return
    await wait(250)
  }
  // 2 · Troquel
  if (punchedUpTo.value < cur) await punchSequence(cur)
  punchedUpTo.value = null
  if (!alive) return
  // 3 · Se prende la Platea
  if (plateaNow) await plateaSequence()
}

function buildFinalSummary(mem) {
  const month = pass.value.month
  if (mem?.finalSeen === month) return null
  const srv = pass.value.previous
  let s = null
  if (srv && srv.month && srv.month < month) {
    s = {
      month: srv.month, seasonName: srv.season_name || `Temporada ${monthLabel(srv.month)}`,
      level: Number(srv.level) || 0, totalLevels: Number(srv.total_levels) || levelTiers.value.length,
      claimed: Number(srv.claimed) || 0, points: Number(srv.points) || 0,
      note: Number(srv.credited) > 0 ? `Los ${srv.credited} talones que no cortaste se acreditaron solos.` : '',
    }
  } else if (mem?.snap?.month && mem.snap.month < month) {
    s = { ...mem.snap }
  }
  if (!s) return null
  const short = monthLabel(s.month, { month: 'short' }).replace('.', '').toUpperCase()
  return { ...s, monthLabel: monthLabel(s.month, { month: 'long', year: 'numeric' }), monthShort: `${short} · ${String(s.month).slice(2, 4)}` }
}
function onFinalClose() {
  finalSummary.value = null
  finalResolve?.(); finalResolve = null
}

async function punchSequence(to) {
  if (reduced()) {
    punchedUpTo.value = to
    soundManager.play('clac'); heavy()
    if (isMilestone(to)) soundManager.play('stamp')
    return
  }
  let i = 0
  for (let n = punchedUpTo.value + 1; n <= to; n++, i++) {
    if (!alive) return
    scrollToRow(rowEl(n), true)
    await wait(i === 0 ? 320 : 120)
    punchTier.value = n
    punchedUpTo.value = n
    soundManager.play('clac', { rate: 1 + i * 0.08 })
    heavy()
    if (isMilestone(n)) {
      await wait(260)
      stampTier.value = n
      soundManager.play('stamp')
      heavy()
      await wait(380)
    } else {
      await wait(i < 2 ? 380 : 300) // cada vez un poco más rápido
    }
    punchTier.value = null
    stampTier.value = null
  }
}

async function plateaSequence() {
  const list = listEl.value
  if (list) list.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' }) // arranca por el nivel 0
  await wait(reduced() ? 0 : 350)
  const ready = readyList.value.filter(r => r.track === 'premium').length
  ribbon.value = ready
    ? `¡Se prendió la Platea! Tenés ${ready} ${ready === 1 ? 'premio' : 'premios'} para cortar.`
    : '¡Se prendió la Platea!'
  lightsOn.value = true
  soundManager.play('swoosh')
  success()
  if (!reduced() && ready) timers.push(setTimeout(() => soundManager.play('coin'), 700))
  await wait(reduced() ? 400 : 2200)
  lightsOn.value = false
  timers.push(setTimeout(() => { ribbon.value = '' }, 2600))
}
// Delay del reflector por fila (de arriba abajo), con tope para que no tarde.
const fxDelay = (i) => (reduced() ? 0 : Math.min(i, 24) * 55)

// ════════ Cortar el talón ════════
function markClaimed(tier, track) {
  if (tier.overtime) {
    const o = pass.value.overtime || {}
    const k = track === 'free' ? 'free_claimed' : 'premium_claimed'
    pass.value = { ...pass.value, overtime: { ...o, [k]: (Number(o[k]) || 0) + 1 } }
  } else {
    const idx = pass.value.tiers.findIndex(x => x.tier === tier.tier)
    if (idx !== -1) {
      pass.value.tiers[idx] = { ...pass.value.tiers[idx], [track === 'free' ? 'free_claimed' : 'premium_claimed']: true }
    }
  }
  const k = `${tier.tier}_${track}`
  justClaimed.value = new Set([...justClaimed.value, k])
  timers.push(setTimeout(() => {
    const s = new Set(justClaimed.value); s.delete(k); justClaimed.value = s
  }, 700))
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
  soundManager.play('tear')
  try {
    const res = tier.overtime ? await claimPassOvertime(track) : await claimPassTier(tier.tier, track)
    if (!res?.ok) {
      hapticError()
      return null
    }
    markClaimed(tier, track)
    soundManager.play('tearDone')
    if (!batch) success()
    saveMemory()

    const reward = rewardOf(tier, track)
    const from = el || stubEl(tier.tier, track)
    const title = tier.overtime ? `${seasonName.value} · Tiempo de descuento` : `${seasonName.value} · Nivel ${tier.tier}`
    const fichas = Number(res.fichas) || 0
    // Vuelo de la recompensa (XP / ayuda / Fichas) hacia su contador; toast de respaldo.
    const flying = res.powerup
      ? flyReward(from, { kind: 'powerup', powerup: res.powerup })
      : (res.xp > 0 ? flyReward(from, { kind: 'xp', amount: res.xp }) : Promise.resolve(false))
    const flyingFichas = fichas > 0 ? flyReward(from, { kind: 'fichas', amount: fichas, delay: res.xp > 0 || res.powerup ? 160 : 0 }) : Promise.resolve(true)
    if (!batch) {
      if (reward?.kind === 'cosmetic') {
        pushClaimNotification({ type: 'cosmetic', title: `${title} — ${reward.cos.name}`, emoji: '🎁' })
      } else {
        flying.then((flown) => {
          if (flown) return
          if (res.powerup) pushClaimNotification({ type: 'powerup', title, emoji: POWERUP_TOAST_EMOJI[res.powerup] || '🎁' })
          else if (res.xp > 0) pushClaimNotification({ type: 'xp', title, xp: res.xp, emoji: '🎟️' })
        })
        flyingFichas.then((flown) => { if (!flown) pushClaimNotification({ type: 'xp', title: `${title} · +${fichas} Fichas`, emoji: '🪙' }) })
      }
    }
    return { xp: Number(res.xp) || 0, fichas, cosmetic: reward?.kind === 'cosmetic' ? reward.cos : null }
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
  let ok = 0, xp = 0, fichas = 0
  const cosmetics = []
  for (const { tier, track } of list) {
    scrollToRow(rowEl(tier.tier), true)
    const got = await claimOne(tier, track, null, { batch: true })
    if (got) {
      ok++; xp += got.xp; fichas += got.fichas
      if (got.cosmetic) cosmetics.push(got.cosmetic)
    }
    progress.value = { done: progress.value.done + 1, total: list.length }
    await wait(160) // ritmo: se ve cada talón cortarse
  }
  progress.value = null
  if (ok) {
    success()
    const title = `${seasonName.value} · cortaste ${ok} ${ok === 1 ? 'talón' : 'talones'}${fichas ? ` · +${fichas} Fichas` : ''}`
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
onBeforeUnmount(() => {
  alive = false
  timers.forEach(clearTimeout)
  finalResolve?.()
})
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
      <span class="mp-teaser-bar"><span :style="{ width: (levelTiers.length ? Math.round((currentTierNum / levelTiers.length) * 100) : 0) + '%' }"></span></span>
      <span class="mp-teaser-foot">
        <span>Nivel <b>{{ currentTierNum }}</b> / {{ levelTiers.length }}</span>
        <span v-if="readyList.length" class="mp-teaser-ready">{{ readyList.length }} para cobrar</span>
        <span v-else class="mp-teaser-cta">Ver abono ›</span>
      </span>
    </template>
  </button>

  <!-- ════════ ABONO COMPLETO ════════ -->
  <div v-else class="mp" :style="themeStyle">
    <div v-if="loading" class="mp-skel" aria-busy="true" aria-label="Cargando abono">
      <span class="mp-skel-hd"></span>
      <span v-for="i in 4" :key="i" class="mp-skel-row"></span>
    </div>

    <template v-else-if="tiers.length">
      <PassSeasonHeader
        :seasonName="seasonName" :daysLeft="daysLeft" :endsAt="endsAt"
        :level="currentTierNum" :totalLevels="levelTiers.length" :points="points"
        :nextLevel="nextLevel" :finalPrize="finalPrize" :overtime="overtime" :grain="theme.grain"
        :isPremium="isPremium" :readyCount="readyList.length" :progress="progress"
        @activate="goPricing" @claim-all="claimAll"
      />

      <div class="mp-legend" aria-hidden="true">
        <span class="mp-legend-pop">POPULAR <small>gratis</small></span>
        <span class="mp-legend-nv">NV</span>
        <span class="mp-legend-pla">PLATEA <em>PRO</em></span>
      </div>

      <p v-if="ribbon" class="mp-ribbon" role="status">{{ ribbon }}</p>

      <div ref="listEl" class="mp-list" role="list" aria-label="Niveles del abono">
        <div v-for="r in rows" :key="r.t.tier" role="listitem" :data-tier="r.t.tier" :data-current="!r.variant && r.t.tier === currentTierNum ? '1' : '0'">
          <PassTicket
            :tier="r.t" :isPremium="isPremium" :current="!r.variant && r.t.tier === currentTierNum"
            :serialPrefix="serialPrefix" :busyKey="busyKey" :justClaimed="justClaimed"
            :variant="r.variant" :overtime="r.variant === 'overtime' ? overtime : null"
            :punched="!r.variant && r.t.unlocked && r.t.tier <= punchLimit"
            :punching="punchTier === r.t.tier" :stamping="stampTier === r.t.tier"
            :lights="lightsOn" :fxDelay="fxDelay(r.i)"
            @claim="onClaim" @upgrade="goPricing"
          />
        </div>
      </div>
    </template>

    <div v-else class="mp-empty">
      <b>Todavía no hay abono este mes.</b>
      <span>Jugá y volvé en un rato: los niveles aparecen apenas arranca la temporada.</span>
    </div>

    <PassFinalWhistle v-if="finalSummary" :summary="finalSummary" :nextName="seasonName" :nextPrize="finalPrize" @close="onFinalClose" />
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

.mp-ribbon {
  margin: 0; padding: 8px 12px; border-radius: 12px; text-align: center; font-size: 13px; font-weight: 700; color: #1c1206;
  background: linear-gradient(90deg, #fde68a, #fbbf24); box-shadow: 0 4px 14px rgba(251,191,36,.35);
  animation: mp-ribbon .35s cubic-bezier(.2,1.2,.4,1) both;
}
@keyframes mp-ribbon { from { opacity: 0; transform: translateY(-6px) scale(.97); } }

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
  .mp-ribbon { animation: none; }
  .mp-teaser:active { transform: none; }
}
</style>
