<script setup>
/**
 * SOCIAL (v4) — hub de la 5ª pestaña. Control segmentado Amigos · Ranking · Fútbol
 * (sincronizado con ?tab= para links y "atrás").
 *  - Amigos  → buscador, pedidos de amistad (aceptar/rechazar), tus amigos con
 *              presencia en vivo, RETAR (abre el chat con tus juegos de hoy) y
 *              mensaje, e invitación con tu código de referido.
 *  - Ranking → "Entre amigos · esta semana" (top 5) + link al ranking completo.
 *  - Fútbol  → igual que antes (la pantalla v4 de Fútbol queda para más adelante).
 * Todo sale de los services existentes (connections, presence, direct-messages,
 * referral, xp) vía social-hub.js.
 */
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { searchAll, competitionRoute } from '../services/global-search'
import { getEquippedCosmeticsBatch } from '../services/cosmetics'
import { acceptRequest, blockRequest } from '../services/connections'
import { fetchRecentConversations } from '../services/direct-messages'
import { presenceState } from '../services/presence'
import { friendlyNameForSlug } from '../services/games'
import { getReferralStats, buildReferralLink } from '../services/referral'
import { success as hapticSuccess } from '../services/haptics'
import { pushErrorToast } from '../stores/notifications'
import {
  loadFriends, loadIncomingRequests, loadFriendsLeaderboard, loadLeaderboardPage, withCosmetics,
  periodEndsAt, shortCountdown, initialOf, REFERRAL_FICHAS,
} from '../services/social-hub'
import { shellState, tapHaptic } from '../components/shell/shell-state'
import { useUpcomingMatches } from '../components/home/useUpcomingMatches'
import HubState from '../components/shell/HubState.vue'
import UserAvatar from '../components/common/UserAvatar.vue'
import GlobalSearchResults from '../components/GlobalSearchResults.vue'
import TodayMatchesGrid from '../components/home/TodayMatchesGrid.vue'
import LeaderboardTable from '../components/leaderboard/LeaderboardTable.vue'

const route = useRoute()
const router = useRouter()
const TABS = [
  { key: 'amigos', label: 'Amigos' },
  { key: 'ranking', label: 'Ranking' },
  { key: 'futbol', label: 'Fútbol' },
]
const tab = computed(() => TABS.some(t => t.key === route.query.tab) ? route.query.tab : 'amigos')
const tabIdx = computed(() => TABS.findIndex(t => t.key === tab.value))
function setTab(k) {
  if (k === tab.value) return
  tapHaptic()
  router.replace({ query: { ...route.query, tab: k } })
}
const meId = computed(() => shellState.user?.id || null)
const logged = computed(() => !!meId.value)

// ── Amigos ──
const friends = ref([])
const requests = ref([])
const unreadBy = ref({})
const friendsLoading = ref(false)
const friendsError = ref(false)
const busy = ref({})
let friendsLoadedFor = null

async function loadAmigos(force = false) {
  if (!meId.value) return
  if (!force && friendsLoadedFor === meId.value) return
  friendsLoadedFor = meId.value
  friendsLoading.value = true
  friendsError.value = false
  try {
    const [f, r, th] = await Promise.all([
      loadFriends(meId.value),
      loadIncomingRequests().catch(() => []),
      fetchRecentConversations(50).catch(() => ({ data: [] })),
    ])
    friends.value = f
    requests.value = r
    unreadBy.value = Object.fromEntries((th?.data || []).map(t => [t.peer_id, t.unread || 0]))
  } catch (e) {
    console.warn('[social] amigos:', e?.message || e)
    friendsError.value = true
    friendsLoadedFor = null
  } finally {
    friendsLoading.value = false
  }
}

function statusOf(id) {
  const p = presenceState.value?.[id]
  if (!p) return { key: 'off', label: '' }
  if (p.game) return { key: 'play', label: 'jugando ' + friendlyNameForSlug(p.game) }
  return { key: 'on', label: 'en línea' }
}
const friendRows = computed(() => {
  const rank = { play: 0, on: 1, off: 2 }
  return friends.value
    .map(f => ({ ...f, st: statusOf(f.id), unread: unreadBy.value[f.id] || 0 }))
    .sort((a, b) => (rank[a.st.key] - rank[b.st.key]) || (b.unread - a.unread) || a.name.localeCompare(b.name, 'es'))
})
const onlineCount = computed(() => friendRows.value.filter(f => f.st.key !== 'off').length)

async function answer(req, ok) {
  if (busy.value[req.connectionId]) return
  tapHaptic()
  busy.value = { ...busy.value, [req.connectionId]: true }
  try {
    if (ok) { await acceptRequest(req.connectionId); hapticSuccess() }
    else await blockRequest(req.connectionId)
    requests.value = requests.value.filter(r => r.connectionId !== req.connectionId)
    if (ok) loadAmigos(true)
  } catch (e) {
    pushErrorToast(ok ? 'No pudimos aceptar el pedido' : 'No pudimos rechazar el pedido')
  } finally {
    const b = { ...busy.value }; delete b[req.connectionId]; busy.value = b
  }
}
function openChat(f, retar = false) {
  tapHaptic()
  router.push({ path: `/messages/${f.id}`, query: retar ? { retar: '1' } : {} })
}

// ── Invitación (referidos) ──
const refCode = ref('')
const copied = ref(false)
let copiedTimer = null
async function loadRef() {
  if (!logged.value || refCode.value) return
  const { code } = await getReferralStats()
  refCode.value = code || ''
}
async function copyInvite() {
  if (!refCode.value) return
  tapHaptic()
  const link = buildReferralLink(refCode.value)
  try {
    await navigator.clipboard.writeText(link)
    copied.value = true
    hapticSuccess()
    clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => { copied.value = false }, 2200)
  } catch {
    pushErrorToast('No pudimos copiar el link')
  }
}

// ── Ranking entre amigos ──
const rankRows = ref([])
const rankLoading = ref(false)
const rankError = ref(false)
let rankLoadedFor = undefined
const now = ref(Date.now())
const endsLabel = computed(() => 'Termina en ' + shortCountdown(periodEndsAt('weekly'), now.value))
async function loadRanking(force = false) {
  if (!force && rankLoadedFor === meId.value) return
  rankLoadedFor = meId.value
  rankLoading.value = true
  rankError.value = false
  try {
    let rows
    if (meId.value) {
      if (friendsLoadedFor !== meId.value && !friendsLoading.value) await loadAmigos()
      rows = await loadFriendsLeaderboard({ period: 'weekly', meId: meId.value, friendIds: friends.value.map(f => f.id) })
    } else {
      rows = await loadLeaderboardPage({ period: 'weekly', limit: 5 })
    }
    const top = rows.slice(0, 5)
    const mine = rows.find(r => r.user_id === meId.value)
    if (mine && !top.includes(mine)) top.push(mine)
    rankRows.value = await withCosmetics(top)
  } catch (e) {
    console.warn('[social] ranking:', e?.message || e)
    rankError.value = true
    rankLoadedFor = undefined
  } finally {
    rankLoading.value = false
  }
}

// ── Fútbol ──
const { loading: mLoading, error: mError, load: loadMatches, todayMatches } = useUpcomingMatches()
let matchesLoaded = false

watch([tab, meId], ([t]) => {
  if (t === 'amigos') { loadAmigos(); loadRef() }
  if (t === 'ranking') loadRanking()
  if (t === 'futbol' && !matchesLoaded) { matchesLoaded = true; loadMatches() }
}, { immediate: true })

// ── Buscador global ──
const q = ref('')
const searching = ref(false)
const results = ref({ users: [], players: [], teams: [], competitions: [] })
const resultCos = ref({})
let searchTimer = null
function onSearch() {
  clearTimeout(searchTimer)
  const term = q.value.trim()
  if (term.length < 2) { results.value = { users: [], players: [], teams: [], competitions: [] }; return }
  searchTimer = setTimeout(async () => {
    searching.value = true
    try {
      const res = await searchAll(term, { limitEach: 5, currentUserId: meId.value })
      results.value = res
      const ids = (res.users || []).map(u => u.id).filter(Boolean)
      resultCos.value = ids.length ? await getEquippedCosmeticsBatch(ids).catch(() => ({})) : {}
    } finally { searching.value = false }
  }, 220)
}
function clearSearch() { q.value = ''; results.value = { users: [], players: [], teams: [], competitions: [] } }
function go(path) { clearSearch(); router.push(path) }

const FUTBOL_CARDS = [
  { to: '/competiciones', title: 'Competiciones', sub: 'Ligas, copas y torneos: tablas, fixtures y brackets', accent: 'from-emerald-500/25 to-cyan-500/10 border-emerald-400/25',
    icon: 'M8 21h8M12 17v4M7 4h10v4a5 5 0 01-10 0V4zM17 5h3v2a3 3 0 01-3 3M7 5H4v2a3 3 0 003 3' },
  { to: '/teams', title: 'Equipos', sub: 'Planteles, últimos partidos y estadísticas', accent: 'from-sky-500/25 to-indigo-500/10 border-sky-400/25',
    icon: 'M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z' },
]

let tick = null
onMounted(() => {
  if (!route.query.tab) router.replace({ query: { ...route.query, tab: 'amigos' } })
  tick = setInterval(() => { now.value = Date.now() }, 60000)
})
onBeforeUnmount(() => { clearInterval(tick); clearTimeout(copiedTimer); clearTimeout(searchTimer) })
</script>

<template>
  <section class="soc max-w-xl mx-auto -mt-4 lg:mt-0">
    <header class="flex flex-col gap-3 pt-1">
      <div class="flex items-center justify-between">
        <h1 class="font-display font-bold text-2xl text-white">Social</h1>
        <RouterLink v-if="logged" to="/notifications" class="soc-bell" :aria-label="shellState.notifCount ? `Notificaciones, ${shellState.notifCount} sin leer` : 'Notificaciones'" @click="tapHaptic()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0112 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 20a2 2 0 004 0"/></svg>
          <span v-if="shellState.notifCount > 0" class="soc-bell-n">{{ shellState.notifCount > 9 ? '9+' : shellState.notifCount }}</span>
        </RouterLink>
      </div>
      <div class="soc-seg" role="tablist" aria-label="Secciones de Social">
        <span class="soc-seg-thumb" :style="{ transform: `translateX(${tabIdx * 100}%)` }" aria-hidden="true"></span>
        <button v-for="t in TABS" :key="t.key" type="button" role="tab" :aria-selected="tab === t.key"
          class="soc-seg-btn" :class="tab === t.key ? 'is-on' : ''" @click="setTab(t.key)">{{ t.label }}</button>
      </div>
    </header>

    <Transition name="seg-fade" mode="out-in">
      <!-- ───────── AMIGOS ───────── -->
      <div v-if="tab === 'amigos'" key="amigos" class="pt-3 flex flex-col gap-3">
        <div class="relative">
          <svg class="absolute left-3.5 top-[13px] pointer-events-none" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>
          <input v-model="q" type="search" inputmode="search" aria-label="Buscar usuarios, jugadores o equipos" placeholder="Buscá usuarios, jugadores o equipos"
            class="soc-search" @input="onSearch" />
          <div v-if="q.trim().length >= 2" class="absolute z-30 mt-2 w-full max-h-[60dvh] overflow-auto rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur shadow-2xl p-2">
            <GlobalSearchResults :results="results" :result-cos="resultCos" :searching="searching" :query="q"
              @go-user="(u) => go(`/u/${u.id}`)" @go-player="(p) => p?.teamId && go(`/team/${p.teamId}`)"
              @go-team="(t) => go(`/team/${t.id}`)" @go-competition="(c) => go(competitionRoute(c))" />
          </div>
        </div>

        <template v-if="logged">
          <!-- Pedidos -->
          <section v-if="requests.length" aria-label="Pedidos de amistad" class="flex flex-col gap-1.5">
            <div class="flex items-center gap-2">
              <h2 class="font-display font-bold text-base text-white">Pedidos</h2>
              <span class="soc-count">{{ requests.length }}</span>
            </div>
            <TransitionGroup tag="div" name="soc-row" class="soc-card soc-card-gold">
              <div v-for="r in requests" :key="r.connectionId" class="soc-req">
                <RouterLink :to="`/u/${r.id}`" class="shrink-0" :aria-label="`Ver perfil de ${r.name}`">
                  <UserAvatar :size="38" :avatar-url="r.avatar_url" :initial="initialOf(r.name)" :frame-key="r.cos.frameKey || 'none'" :icon-glyph="r.cos.iconGlyph || ''" :icon-bg="r.cos.iconBg || 'emerald'" :glow="false" />
                </RouterLink>
                <span class="flex-1 min-w-0">
                  <span class="block font-bold text-sm text-white truncate">{{ r.name }}</span>
                  <span class="block text-[11px] text-slate-400">Quiere ser tu amigo</span>
                </span>
                <button type="button" class="soc-no" :aria-label="`Rechazar a ${r.name}`" :disabled="busy[r.connectionId]" @click="answer(r, false)">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
                </button>
                <button type="button" class="soc-ok" :aria-label="`Aceptar a ${r.name}`" :disabled="busy[r.connectionId]" @click="answer(r, true)">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
                </button>
              </div>
            </TransitionGroup>
          </section>

          <!-- Amigos -->
          <section aria-label="Tus amigos" class="flex flex-col gap-1.5">
            <div class="flex items-baseline justify-between">
              <h2 class="font-display font-bold text-base text-white">Amigos <span class="text-slate-500 font-semibold">· {{ friends.length }}</span></h2>
              <span v-if="friends.length" class="soc-online">{{ onlineCount }} EN LÍNEA</span>
            </div>
            <div v-if="friendsLoading && !friends.length" class="soc-card">
              <div v-for="i in 4" :key="i" class="soc-friend"><span class="soc-skel w-11 h-11 rounded-[13px]"></span><span class="flex-1 flex flex-col gap-1.5"><span class="soc-skel h-3 w-28"></span><span class="soc-skel h-2.5 w-36"></span></span></div>
            </div>
            <HubState v-else-if="friendsError" error message="No pudimos traer tus amigos." @retry="loadAmigos(true)" />
            <div v-else-if="!friends.length" class="soc-card px-5 py-6 text-center">
              <p class="font-bold text-white">Todavía no tenés amigos en FULVO</p>
              <p class="text-[13px] text-slate-400 mt-1">Buscalos por nombre arriba o mandales tu link de invitación.</p>
            </div>
            <div v-else class="soc-card">
              <div v-for="f in friendRows" :key="f.id" class="soc-friend">
                <RouterLink :to="`/u/${f.id}`" class="flex items-center gap-2.5 flex-1 min-w-0 min-h-[44px]" :aria-label="`Ver perfil de ${f.name}`">
                  <span class="relative shrink-0">
                    <UserAvatar :size="44" :avatar-url="f.avatar_url" :initial="initialOf(f.name)" :frame-key="f.cos.frameKey || 'none'" :icon-glyph="f.cos.iconGlyph || ''" :icon-bg="f.cos.iconBg || 'emerald'" :frame-premium="false" :glow="false" />
                    <span class="soc-dot" :class="'st-' + f.st.key" aria-hidden="true"></span>
                  </span>
                  <span class="flex-1 min-w-0 flex flex-col gap-0.5">
                    <span class="flex items-center gap-1.5 min-w-0">
                      <span class="font-bold text-sm text-white truncate">{{ f.name }}</span>
                      <span v-if="f.level != null" class="soc-lvl">NV {{ f.level }}</span>
                    </span>
                    <span class="text-[11px] text-slate-400 truncate"><template v-if="f.tier">{{ f.tier.label }}</template><template v-if="f.tier && f.st.label"> · </template><span v-if="f.st.label" class="font-bold" :class="'stc-' + f.st.key">{{ f.st.label }}</span><template v-if="!f.tier && !f.st.label">Desconectado</template></span>
                  </span>
                </RouterLink>
                <button type="button" class="soc-duel" :aria-label="`Retar a ${f.name}`" @click="openChat(f, true)">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2"/></svg>RETAR
                </button>
                <button type="button" class="soc-msg" :aria-label="f.unread ? `Mensajes con ${f.name}, ${f.unread} sin leer` : `Mandarle un mensaje a ${f.name}`" @click="openChat(f)">
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 01-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1121 12z"/></svg>
                  <span v-if="f.unread" class="soc-msg-n">{{ f.unread > 9 ? '9+' : f.unread }}</span>
                </button>
              </div>
            </div>
            <RouterLink v-if="friends.length" to="/messages" class="soc-link-sm">Ver todas las conversaciones
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
            </RouterLink>
          </section>

          <!-- Invitá amigos -->
          <section v-if="refCode" aria-label="Invitá amigos" class="soc-invite">
            <svg class="soc-invite-art" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46" fill="none" stroke="#fff" stroke-width="5"/><path d="M50 22l13 9.5-5 15.5H42l-5-15.5z" fill="#fff"/></svg>
            <div class="flex flex-col gap-0.5 max-w-[270px]">
              <span class="soc-invite-t">Invitá amigos y ganá {{ REFERRAL_FICHAS.referrer }} Fichas</span>
              <span class="text-[11.5px] font-semibold text-cyan-100">Cuando tu amigo confirme su cuenta, cobrás vos y él se lleva {{ REFERRAL_FICHAS.referred }} de bienvenida.</span>
            </div>
            <div class="flex gap-2">
              <span class="soc-code" :aria-label="`Tu código de invitación: ${refCode}`">{{ refCode }}</span>
              <button type="button" class="soc-copy" :class="copied ? 'is-done' : ''" @click="copyInvite">
                <svg v-if="!copied" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 011-1h10"/></svg>
                <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
                {{ copied ? 'Copiado' : 'Copiar link' }}
              </button>
            </div>
          </section>
        </template>

        <div v-else class="soc-card p-8 text-center">
          <p class="font-display font-bold text-white text-lg">Jugá con amigos</p>
          <p class="text-slate-400 text-sm mt-1">Creá tu cuenta para agregar amigos, retarlos y chatear.</p>
          <RouterLink to="/register" class="mt-5 inline-flex min-h-[44px] items-center rounded-xl px-6 font-bold text-slate-900 bg-gradient-to-b from-amber-300 to-amber-500">Crear cuenta gratis</RouterLink>
        </div>
      </div>

      <!-- ───────── RANKING ───────── -->
      <div v-else-if="tab === 'ranking'" key="ranking" class="pt-3.5 flex flex-col gap-2">
        <div class="flex items-baseline justify-between">
          <h2 class="font-display font-bold text-base text-white">{{ logged ? 'Entre amigos · esta semana' : 'Top de la semana' }}</h2>
          <span class="soc-ends">{{ endsLabel.toUpperCase() }}</span>
        </div>
        <HubState v-if="rankError" error message="No pudimos traer el ranking." @retry="loadRanking(true)" />
        <LeaderboardTable v-else :rows="rankRows" :loading="rankLoading" :me-id="meId || ''" compact :skeleton="5"
          :empty-text="logged ? 'Esta semana nadie sumó XP todavía. ¡Arrancá vos!' : 'Todavía nadie sumó XP esta semana'" />
        <RouterLink to="/leaderboards" class="soc-more">Ver ranking completo
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
        </RouterLink>
      </div>

      <!-- ───────── FÚTBOL (sin cambios: la v4 queda para más adelante) ───────── -->
      <div v-else key="futbol" class="pt-4 space-y-6">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <RouterLink v-for="c in FUTBOL_CARDS" :key="c.to" :to="c.to"
            class="group flex items-center gap-4 rounded-2xl border bg-gradient-to-br p-4 min-h-[84px] active:scale-[.98] transition" :class="c.accent">
            <span class="h-12 w-12 shrink-0 grid place-items-center rounded-xl bg-black/30 text-white">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6"><path :d="c.icon"/></svg>
            </span>
            <span class="min-w-0 flex-1">
              <span class="block font-display font-bold text-white">{{ c.title }}</span>
              <span class="block text-xs text-slate-300/80 mt-0.5">{{ c.sub }}</span>
            </span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-5 w-5 text-slate-400"><path d="M9 6l6 6-6 6"/></svg>
          </RouterLink>
        </div>
        <HubState v-if="mError && !mLoading" error message="No pudimos traer los partidos." @retry="loadMatches" />
        <TodayMatchesGrid v-else :matches="todayMatches" :loading="mLoading" />
      </div>
    </Transition>
  </section>
</template>

<style scoped>
.soc { position: relative; }
.soc::before {
  content: ''; position: absolute; inset: -40px -24px auto; height: 260px; pointer-events: none; z-index: -1;
  background: radial-gradient(80% 60% at 50% 0%, rgba(16,185,129,0.16), transparent 70%);
}
.soc-bell {
  position: relative; width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; color: #e2e8f0;
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08);
}
.soc-bell-n {
  position: absolute; top: 4px; right: 3px; min-width: 16px; height: 16px; padding: 0 3px; box-sizing: border-box; border-radius: 999px;
  background: #f43f5e; border: 2px solid #0b1220; font-size: 9px; font-weight: 800; line-height: 12px; text-align: center; color: #fff;
}
.soc-seg {
  position: relative; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); padding: 4px; border-radius: 999px;
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08);
}
.soc-seg-thumb {
  position: absolute; top: 4px; bottom: 4px; left: 4px; width: calc((100% - 8px) / 3); border-radius: 999px;
  background: linear-gradient(180deg, #ffffff, #e2e8f0); box-shadow: 0 2px 8px rgba(0,0,0,0.35);
  transition: transform .3s cubic-bezier(.34, 1.3, .64, 1);
}
.soc-seg-btn { position: relative; z-index: 1; min-height: 40px; border-radius: 999px; font-weight: 800; font-size: 14px; color: #94a3b8; transition: color .2s ease; }
.soc-seg-btn.is-on { color: #0f172a; }
.soc-search {
  width: 100%; height: 44px; padding: 0 14px 0 42px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.1);
  background: #111a2e; color: #f1f5f9; font-size: 14px; outline: none;
}
.soc-search::placeholder { color: #64748b; }
.soc-search:focus { border-color: rgba(251,191,36,0.6); box-shadow: 0 0 0 3px rgba(251,191,36,0.15); }
.soc-count { min-width: 22px; height: 20px; padding: 0 6px; border-radius: 999px; background: #f43f5e; font-size: 11px; font-weight: 800; line-height: 20px; text-align: center; color: #fff; }
.soc-card { border-radius: 16px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.03); overflow: hidden; }
.soc-card-gold { border-color: rgba(251,191,36,0.28); background: linear-gradient(90deg, rgba(251,191,36,0.08), rgba(255,255,255,0.02)); }
.soc-req { min-height: 56px; padding: 6px 8px 6px 12px; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid rgba(255,255,255,0.06); }
.soc-req:last-child, .soc-friend:last-child { border-bottom: 0; }
.soc-no { width: 44px; height: 44px; flex-shrink: 0; border-radius: 50%; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.04); color: #94a3b8; display: grid; place-items: center; }
.soc-ok { width: 44px; height: 44px; flex-shrink: 0; border-radius: 50%; background: #22c55e; box-shadow: 0 3px 0 #15803d; color: #fff; display: grid; place-items: center; }
.soc-ok:active { transform: translateY(2px); box-shadow: 0 1px 0 #15803d; }
.soc-no:disabled, .soc-ok:disabled { opacity: .5; }
.soc-online { font-family: var(--font-shout); font-weight: 800; font-size: 14px; color: #4ade80; }
.soc-friend { min-height: 62px; padding: 8px 8px 8px 12px; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid rgba(255,255,255,0.06); }
.soc-dot { position: absolute; right: -3px; bottom: -3px; width: 12px; height: 12px; border-radius: 50%; border: 2.5px solid #0f1729; }
.st-on { background: #22c55e; } .st-play { background: #22d3ee; } .st-off { background: #475569; }
.stc-on { color: #4ade80; } .stc-play { color: #67e8f9; } .stc-off { color: #64748b; }
.soc-lvl {
  flex-shrink: 0; height: 18px; padding: 0 5px; border-radius: 5px; background: linear-gradient(180deg, #818cf8, #4f46e5); border: 1px solid #c7d2fe;
  font-family: var(--font-shout); font-weight: 800; font-size: 12px; line-height: 16px; color: #fff;
}
.soc-duel {
  min-height: 44px; padding: 0 11px; border-radius: 12px; flex-shrink: 0; background: linear-gradient(180deg, #fcd34d, #f59e0b); box-shadow: 0 3px 0 #b45309;
  color: #1c1206; font-family: var(--font-shout); font-weight: 800; font-style: italic; font-size: 16px; display: inline-flex; align-items: center; gap: 4px;
}
.soc-duel:active { transform: translateY(2px); box-shadow: 0 1px 0 #b45309; }
.soc-msg { position: relative; width: 44px; height: 44px; flex-shrink: 0; border-radius: 12px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.04); color: #e2e8f0; display: grid; place-items: center; }
.soc-msg-n { position: absolute; top: -5px; right: -5px; min-width: 18px; height: 18px; padding: 0 4px; border-radius: 999px; background: #f43f5e; border: 2px solid #0b1220; font-size: 10px; font-weight: 800; line-height: 14px; color: #fff; }
.soc-link-sm { align-self: center; min-height: 44px; display: inline-flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 700; color: #94a3b8; }
.soc-invite {
  position: relative; overflow: hidden; border-radius: 18px; padding: 12px 14px; display: flex; flex-direction: column; gap: 10px;
  background: linear-gradient(135deg, #065f46 0%, #0e7490 100%); border: 1px solid rgba(103,232,249,0.4);
}
.soc-invite-art { position: absolute; right: -10px; top: -12px; width: 86px; height: 86px; opacity: .3; transform: rotate(14deg); }
.soc-invite-t { font-family: var(--font-shout); font-weight: 800; font-style: italic; font-size: 21px; line-height: 1.05; text-transform: uppercase; color: #fff; }
.soc-code {
  flex: 1; min-width: 0; height: 44px; border-radius: 12px; border: 1.5px dashed rgba(255,255,255,0.5); background: rgba(2,6,23,0.35);
  display: flex; align-items: center; justify-content: center; font-family: var(--font-shout); font-weight: 800; font-size: 22px; letter-spacing: 3px; color: #fff;
  user-select: all;
}
.soc-copy { min-height: 44px; min-width: 112px; padding: 0 14px; border-radius: 12px; background: #fff; color: #0f172a; font-weight: 800; font-size: 14px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; transition: background-color .2s ease, color .2s ease; }
.soc-copy.is-done { background: #22c55e; color: #fff; }
.soc-ends { font-family: var(--font-shout); font-weight: 800; font-size: 14px; color: #94a3b8; }
.soc-more { margin-top: 4px; min-height: 44px; border-radius: 14px; border: 1px solid rgba(251,191,36,0.4); display: flex; align-items: center; justify-content: center; gap: 6px; font-weight: 800; font-size: 14px; color: #fbbf24; }
.soc-skel { display: block; border-radius: 6px; background: rgba(255,255,255,0.07); animation: soc-pulse 1.4s ease-in-out infinite; }
@keyframes soc-pulse { 50% { opacity: .45 } }
.soc-row-leave-active { transition: opacity .2s ease, transform .2s ease; }
.soc-row-leave-to { opacity: 0; transform: translateX(24px); }
.seg-fade-enter-active, .seg-fade-leave-active { transition: opacity .16s ease, transform .16s ease; }
.seg-fade-enter-from { opacity: 0; transform: translateY(6px); }
.seg-fade-leave-to { opacity: 0; }
@media (prefers-reduced-motion: reduce) {
  .soc-seg-thumb, .soc-seg-btn, .soc-copy { transition: none; }
  .soc-skel { animation: none; }
  .soc-row-leave-active { transition: opacity .1s ease; }
  .soc-row-leave-to { transform: none; }
  .seg-fade-enter-active, .seg-fade-leave-active { transition: opacity .1s ease; }
  .seg-fade-enter-from { transform: none; }
}
</style>
