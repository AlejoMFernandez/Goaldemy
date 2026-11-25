<script>
/**
 * HUB DE LA PESTAÑA "PASE" (TabBar) — segmentos tipo píldora (diseño V4):
 *   Pase · Misiones · Sobre · Bandeja   (sincronizado con ?tab= para links y "atrás")
 *  - Pase     → <MonthlyPass /> tal cual.
 *  - Misiones → diseño V4 Misiones: desafío del mes + misiones del día + en curso.
 *  - Sobre    → racha + sobre del día (DailyStreakCalendar + DailyEnvelope, mismas props).
 *  - Bandeja  → premios pendientes / reclamados (notificaciones).
 * Links viejos: ?tab=diario → Sobre, ?tab=progresos → Misiones.
 */
import { computed, ref, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DailyStreakCalendar from '../components/rewards/DailyStreakCalendar.vue'
import RewardCard from '../components/rewards/RewardCard.vue'
import MonthlyPass from '../components/rewards/MonthlyPass.vue'
import DailyEnvelope from '../components/rewards/DailyEnvelope.vue'
import MissionsPanel from '../components/missions/MissionsPanel.vue'
import { passClaimableCount } from '../components/missions/missions'
import { notificationsState, claimReward, claimAllRewards, clearClaimedRewards, pushClaimNotification } from '../stores/notifications'
import { soundManager } from '../services/sounds'
import { supabase } from '../services/supabase'
import { flyReward, hasRewardAnchor } from '../services/reward-flight'
import { appToday } from '../services/app-date'
import { tap as hapticTap, success as hapticSuccess, error as hapticError } from '../services/haptics'
import { getDailyChallenges, claimDailyChallenge, getDailyReward, claimDailyReward, getProgressiveChallenges, claimProgressive, getMonthlyPass, powerupLabel } from '../services/rewards'

const POWERUP_ICONS = { fifty_fifty: '✂️', shield: '🛡️', extra_time: '⏱️', reveal_hint: '💡' }
const TAB_KEYS = ['pase', 'misiones', 'sobre', 'bandeja']
const TAB_ALIASES = { diario: 'sobre', progresos: 'misiones', retos: 'misiones' }

export default {
  name: 'RewardCenter',
  components: { DailyStreakCalendar, RewardCard, MonthlyPass, DailyEnvelope, MissionsPanel },
  setup() {
    const route = useRoute()
    const router = useRouter()

    const activeTab = computed(() => {
      const q = String(route.query.tab || '').toLowerCase()
      const k = TAB_ALIASES[q] || q
      return TAB_KEYS.includes(k) ? k : 'pase'
    })
    function setTab(k) {
      if (k === activeTab.value) return
      hapticTap()
      router.replace({ query: { ...route.query, tab: k } })
    }

    const currentStreak = ref(0)
    const bestStreak = ref(0)
    const playedToday = ref(false)

    const challenges = ref([])
    const progressive = ref([])
    const dailyReward = ref({ available: false })
    const passClaimable = ref(0)
    // Día 7 del calendario (domingo) → sobre dorado
    const isSunday = new Date().getDay() === 0
    const loadingDaily = ref(true)
    const claiming = ref(null)

    const rewards = computed(() => notificationsState.pendingRewards)
    const unclaimed = computed(() => rewards.value.filter(r => !r.claimed).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)))
    const claimed = computed(() => rewards.value.filter(r => r.claimed).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)))
    const unclaimedCount = computed(() => unclaimed.value.length)

    // Contadores rojos por segmento (lo que hay para cobrar)
    const missionsClaimable = computed(() =>
      challenges.value.filter(c => !c.claimed && c.progress >= c.target).length +
      progressive.value.filter(c => c.claimable).length
    )
    const envelopeClaimable = computed(() => (dailyReward.value.available ? 1 : 0))

    const TABS = computed(() => [
      { key: 'pase', label: 'Pase', count: passClaimable.value },
      { key: 'misiones', label: 'Misiones', count: missionsClaimable.value },
      { key: 'sobre', label: 'Sobre', count: envelopeClaimable.value },
      { key: 'bandeja', label: 'Bandeja', count: unclaimedCount.value },
    ])
    const tabIdx = computed(() => TAB_KEYS.indexOf(activeTab.value))

    function powerupIcon(t) { return POWERUP_ICONS[t] || '🎁' }

    // Recompensa que viaja (moodboard 02): del botón a tu avatar. Toast solo si no hay destino.
    function rewardXp(r) { return r?.data?.xpBonus || r?.data?.points || 0 }
    function handleClaim(id, el) {
      const r = notificationsState.pendingRewards.find(x => x.id === id)
      const fly = !!el && hasRewardAnchor('xp')
      claimReward(id, { quiet: fly })
      soundManager.play('claim')
      hapticSuccess()
      if (fly) flyReward(el, { kind: 'xp', amount: rewardXp(r) })
    }
    function handleClaimAll(ev) {
      const pending = notificationsState.pendingRewards.filter(r => !r.claimed)
      const fly = hasRewardAnchor('xp')
      // Cascada: cada tarjeta despega con 150 ms de diferencia
      if (fly) pending.forEach((r, i) => {
        const el = document.querySelector(`[data-reward-id="${r.id}"]`) || ev?.currentTarget
        flyReward(el, { kind: 'xp', amount: rewardXp(r), delay: i * 150 })
      })
      claimAllRewards({ quiet: fly })
      soundManager.play('claim')
      hapticSuccess()
    }
    // Recompensa diaria / misiones: vuela si hay destino, si no, toast
    function sendReward(el, { kind, amount, powerup, toast }) {
      if (el && hasRewardAnchor(kind)) flyReward(el, { kind, amount, powerup })
      else pushClaimNotification(toast)
    }
    function handleClearClaimed() { clearClaimedRewards() }
    function scrollToEnvelope() { document.getElementById('sobre-del-dia')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }

    async function loadStreak() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data } = await supabase
          .from('user_profiles')
          .select('daily_streak, best_daily_streak, last_activity_date')
          .eq('id', user.id)
          .single()
        if (data) {
          currentStreak.value = data.daily_streak || 0
          bestStreak.value = data.best_daily_streak || 0
          // Mismo "hoy" que el servidor (app_today() = Argentina)
          playedToday.value = data.last_activity_date === appToday()
        }
      } catch {}
    }

    async function loadPassCount() {
      try { passClaimable.value = passClaimableCount(await getMonthlyPass()) } catch {}
    }

    async function loadDaily() {
      loadingDaily.value = true
      try {
        const [ch, dr, pg] = await Promise.all([getDailyChallenges(), getDailyReward(), getProgressiveChallenges()])
        challenges.value = ch
        dailyReward.value = dr
        progressive.value = pg
      } finally {
        loadingDaily.value = false
      }
    }

    async function handleClaimDailyReward(ev) {
      const el = ev?.currentTarget
      if (!dailyReward.value.available || claiming.value === 'daily') return
      claiming.value = 'daily'
      try {
        const res = await claimDailyReward()
        if (res.ok) {
          dailyReward.value = { ...dailyReward.value, available: false, claimed: true }
          soundManager.play('claim')
          hapticSuccess()
          if (res.reward_kind === 'powerup') {
            sendReward(el, { kind: 'powerup', powerup: res.reward_powerup, toast: { type: 'powerup', title: `${powerupLabel(res.reward_powerup)} ×${res.amount}`, emoji: powerupIcon(res.reward_powerup) } })
          } else {
            sendReward(el, { kind: 'xp', amount: res.amount, toast: { type: 'xp', title: 'Recompensa diaria', xp: res.amount, emoji: '⭐' } })
          }
        } else hapticError()
      } finally {
        claiming.value = null
      }
    }

    async function handleClaimChallenge(c, ev) {
      const el = ev?.currentTarget
      if (c.claimed || c.progress < c.target || claiming.value === c.code) return
      claiming.value = c.code
      try {
        const res = await claimDailyChallenge(c.code)
        if (res.ok) {
          const idx = challenges.value.findIndex(x => x.code === c.code)
          if (idx !== -1) challenges.value[idx] = { ...challenges.value[idx], claimed: true }
          soundManager.play('claim')
          hapticSuccess()
          if (res.reward_powerup) {
            sendReward(el, { kind: 'powerup', powerup: res.reward_powerup, toast: { type: 'powerup', title: `${res.title}`, emoji: powerupIcon(res.reward_powerup) } })
          } else {
            sendReward(el, { kind: 'xp', amount: res.reward_xp, toast: { type: 'xp', title: res.title, xp: res.reward_xp, emoji: '🎯' } })
          }
        } else hapticError()
      } finally {
        claiming.value = null
      }
    }

    async function handleClaimProgressive(c, ev) {
      const el = ev?.currentTarget
      const key = 'prog_' + c.code
      if (!c.claimable || claiming.value === key) return
      claiming.value = key
      try {
        const res = await claimProgressive(c.code)
        if (res.ok) {
          soundManager.play('claim')
          hapticSuccess()
          if (res.powerup) sendReward(el, { kind: 'powerup', powerup: res.powerup, toast: { type: 'powerup', title: res.title, emoji: powerupIcon(res.powerup) } })
          else sendReward(el, { kind: 'xp', amount: res.xp, toast: { type: 'xp', title: res.title, xp: res.xp, emoji: '🏆' } })
          await loadDaily()
        } else hapticError()
      } finally {
        claiming.value = null
      }
    }

    // El pase se cobra adentro de MonthlyPass: al salir del segmento, refrescar su contador.
    watch(activeTab, (t, prev) => { if (prev === 'pase') loadPassCount() })

    onMounted(() => {
      loadStreak(); loadDaily(); loadPassCount()
      const q = String(route.query.tab || '').toLowerCase()
      if (!q || TAB_ALIASES[q]) router.replace({ query: { ...route.query, tab: activeTab.value } })
    })

    return { isSunday, scrollToEnvelope,
      activeTab, TABS, tabIdx, setTab,
      unclaimed, claimed, unclaimedCount,
      currentStreak, bestStreak, playedToday,
      challenges, progressive, dailyReward, loadingDaily, claiming,
      handleClaim, handleClaimAll, handleClearClaimed,
      handleClaimDailyReward, handleClaimChallenge, handleClaimProgressive,
    }
  }
}
</script>

<template>
  <section class="max-w-2xl mx-auto -mt-4 lg:mt-0 space-y-4">
    <!-- Segmentos tipo píldora (V4) -->
    <div class="rc-seg-wrap">
      <div class="rc-seg" role="tablist" aria-label="Secciones de Pase">
        <span class="rc-seg-thumb" :style="{ transform: `translateX(${tabIdx * 100}%)` }" aria-hidden="true"></span>
        <button v-for="t in TABS" :key="t.key" type="button" role="tab"
          :id="`rc-tab-${t.key}`" :aria-selected="activeTab === t.key" :aria-controls="`rc-panel-${t.key}`"
          class="rc-seg-btn" :class="{ 'is-on': activeTab === t.key }" @click="setTab(t.key)">
          {{ t.label }}
          <span v-if="t.count > 0" class="rc-seg-badge" :aria-label="`${t.count} para cobrar`">{{ t.count > 9 ? '9+' : t.count }}</span>
        </button>
      </div>
    </div>

    <Transition name="rc-fade" mode="out-in">
      <!-- ═════════ PASE ═════════ -->
      <div v-if="activeTab === 'pase'" key="pase" id="rc-panel-pase" role="tabpanel" aria-labelledby="rc-tab-pase">
        <MonthlyPass />
      </div>

      <!-- ═════════ MISIONES ═════════ -->
      <div v-else-if="activeTab === 'misiones'" key="misiones" id="rc-panel-misiones" role="tabpanel" aria-labelledby="rc-tab-misiones">
        <MissionsPanel
          :challenges="challenges"
          :progressive="progressive"
          :loading="loadingDaily"
          :claiming="claiming"
          @claim-daily="handleClaimChallenge"
          @claim-progressive="handleClaimProgressive"
        />
      </div>

      <!-- ═════════ SOBRE ═════════ -->
      <div v-else-if="activeTab === 'sobre'" key="sobre" id="rc-panel-sobre" role="tabpanel" aria-labelledby="rc-tab-sobre" class="space-y-5">
        <DailyStreakCalendar
          :currentStreak="currentStreak"
          :bestStreak="bestStreak"
          :playedToday="playedToday"
          :todayOpened="!dailyReward.available && !loadingDaily"
          @open-today="scrollToEnvelope"
        />

        <!-- Sobre del día (Moodboard 02): se abre arrastrando; al abrirse se reclama y la recompensa vuela -->
        <div class="relative overflow-hidden rounded-2xl border p-5 transition-all"
             :class="dailyReward.available ? 'border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-slate-900/40 to-amber-600/5' : 'border-white/10 bg-white/[0.03]'">
          <div class="text-center text-[10px] uppercase tracking-wider text-amber-300/80 font-semibold mb-2">Recompensa diaria</div>
          <DailyEnvelope id="sobre-del-dia" :streak-day="currentStreak" :reward="dailyReward" :busy="claiming === 'daily'" :gold="isSunday" @open="handleClaimDailyReward" />
        </div>
      </div>

      <!-- ═════════ BANDEJA (pendientes + historial) ═════════ -->
      <div v-else key="bandeja" id="rc-panel-bandeja" role="tabpanel" aria-labelledby="rc-tab-bandeja" class="space-y-5">
        <div v-if="unclaimed.length > 0" class="space-y-3">
          <div class="flex items-center justify-between gap-3">
            <h2 class="font-display font-bold text-white text-xl">
              Para cobrar
              <span class="ml-1.5 inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold align-middle">{{ unclaimedCount }}</span>
            </h2>
            <button
              v-if="unclaimedCount > 1"
              type="button"
              @click="handleClaimAll($event)"
              class="rc-claim-all"
            >
              COBRAR TODO
            </button>
          </div>
          <div class="rc-list">
            <RewardCard v-for="r in unclaimed" :key="r.id" :reward="r" @claim="handleClaim" />
          </div>
        </div>

        <!-- Historial -->
        <div v-if="claimed.length > 0" class="space-y-3">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-semibold text-slate-400 uppercase tracking-wider">Cobrados</h2>
            <button type="button" @click="handleClearClaimed" class="min-h-[44px] px-3 text-xs text-slate-400 hover:text-slate-200 transition">
              Limpiar
            </button>
          </div>
          <div class="rc-list">
            <RewardCard v-for="r in claimed" :key="r.id" :reward="r" />
          </div>
        </div>

        <!-- Vacío -->
        <div v-if="unclaimed.length === 0 && claimed.length === 0" class="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <div class="text-4xl mb-3" aria-hidden="true">📭</div>
          <p class="font-display font-bold text-white">Bandeja vacía</p>
          <p class="text-sm text-slate-400 mt-1">Acá van a aparecer los premios de logros y subidas de nivel.</p>
        </div>
      </div>
    </Transition>
  </section>
</template>

<style scoped>
.rc-seg-wrap {
  position: sticky; top: calc(env(safe-area-inset-top, 0px) + var(--shell-topbar-h, 56px)); z-index: 20;
  padding: 6px 0; margin: 0 -2px;
}
@media (min-width: 1024px) { .rc-seg-wrap { top: 64px; } }
.rc-seg {
  position: relative; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr));
  padding: 4px; border-radius: 999px; background: rgba(15,23,42,.82);
  border: 1px solid rgba(255,255,255,.08); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
}
.rc-seg-thumb {
  position: absolute; top: 4px; bottom: 4px; left: 4px; width: calc((100% - 8px) / 4);
  border-radius: 999px; background: linear-gradient(180deg, #ffffff, #e2e8f0);
  box-shadow: 0 2px 8px rgba(0,0,0,.35);
  transition: transform .3s cubic-bezier(.34, 1.4, .64, 1);
}
.rc-seg-btn {
  position: relative; z-index: 1; min-height: 44px; border: 0; border-radius: 999px; background: transparent;
  font-weight: 800; font-size: 14px; color: #94a3b8; cursor: pointer; transition: color .2s ease;
}
.rc-seg-btn.is-on { color: #0f172a; }
.rc-seg-btn:focus-visible { outline: 2px solid #fbbf24; outline-offset: 1px; }
.rc-seg-badge {
  position: absolute; top: 2px; right: 6px; display: grid; place-items: center;
  min-width: 18px; height: 18px; padding: 0 4px; border-radius: 999px;
  background: #ef4444; color: #fff; font-size: 10px; font-weight: 800; line-height: 1;
  box-shadow: 0 0 0 2px #0b1220; animation: rc-badge-pop .4s cubic-bezier(.34, 1.56, .64, 1);
}
@keyframes rc-badge-pop { from { transform: scale(0); } to { transform: scale(1); } }

.rc-list { border-radius: 18px; border: 1px solid rgba(255,255,255,0.1); overflow: hidden; background: rgba(255,255,255,0.015); }
.rc-claim-all {
  min-height: 44px; padding: 0 16px; border: 0; border-radius: 12px; background: #22c55e; box-shadow: 0 4px 0 #15803d;
  color: #fff; font-family: var(--font-bug); font-weight: 800; font-size: 16px; cursor: pointer; transform: translateY(-2px);
  transition: transform .08s ease, box-shadow .08s ease; white-space: nowrap;
}
.rc-claim-all:active { transform: translateY(2px); box-shadow: 0 0 0 #15803d; }

.rc-fade-enter-active, .rc-fade-leave-active { transition: opacity .16s ease, transform .16s ease; }
.rc-fade-enter-from { opacity: 0; transform: translateY(6px); }
.rc-fade-leave-to { opacity: 0; }
@media (prefers-reduced-motion: reduce) {
  .rc-seg-thumb, .rc-seg-btn { transition: none; }
  .rc-seg-badge { animation: none; }
  .rc-fade-enter-active, .rc-fade-leave-active { transition: opacity .1s ease; }
  .rc-fade-enter-from { transform: none; }
}
</style>
