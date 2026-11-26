<script>
/**
 * RANKING (v4) — lista con los 3 primeros destacados (número metálico + franja),
 * período en píldora (Global · Mensual · Semanal), alcance (Todos · Amigos ·
 * Peñas), filtro por juego y tu puesto fijo abajo con lo que te falta para
 * pasar al de arriba. Datos: get_leaderboard (xp.js) vía social-hub.js.
 */
import { RouterLink } from 'vue-router'
import { getAuthUser } from '../services/auth'
import LeaderboardTable from '../components/leaderboard/LeaderboardTable.vue'
import UserAvatar from '../components/common/UserAvatar.vue'
import { fetchGames } from '../services/games'
import { getFanbaseLeaderboard } from '../services/fanbase'
import { findTeamByName } from '../services/players'
import { getUserRank } from '../services/xp'
import { listConnections } from '../services/connections'
import { loadLeaderboardPage, loadFriendsLeaderboard, withCosmetics, periodEndsAt, shortCountdown, initialOf } from '../services/social-hub'
import { shellState, tapHaptic } from '../components/shell/shell-state'

const PERIODS = [
  { value: 'all_time', label: 'Global' },
  { value: 'monthly', label: 'Mensual' },
  { value: 'weekly', label: 'Semanal' },
]

export default {
  name: 'Leaderboards',
  components: { LeaderboardTable, UserAvatar, RouterLink },
  data() {
    return {
      PERIODS,
      period: 'weekly',
      scope: 'todos',      // 'todos' | 'amigos' | 'penias'
      gameId: '',
      games: [],
      rows: [],
      pageSize: 25,
      hasMore: false,
      loading: false,
      loadingMore: false,
      error: false,
      meId: '',
      friendIds: null,
      myGlobal: null,      // { rank, xp } (solo Global, cuando no estás en la página cargada)
      penias: [],
      peniasLoading: false,
      now: Date.now(),
      _reqId: 0,
      _tick: null,
    }
  },
  computed: {
    logged() { return !!this.meId },
    scopes() {
      return [
        { key: 'todos', label: 'Todos' },
        ...(this.logged ? [{ key: 'amigos', label: 'Amigos' }] : []),
        { key: 'penias', label: 'Peñas' },
      ]
    },
    endsLabel() {
      const end = periodEndsAt(this.period)
      return end ? `Termina en ${shortCountdown(end, this.now)}` : 'Histórico'
    },
    meRow() { return this.rows.find(r => r.user_id === this.meId) || null },
    above() {
      const me = this.meRow
      if (!me) return null
      return [...this.rows].reverse().find(r => r.rank < me.rank) || null
    },
    meBar() {
      if (!this.logged || this.scope === 'penias' || this.loading) return null
      const me = this.meRow
      // Lista corta: tu fila ya se ve entera en pantalla → la barra fija sería repetida.
      if (me && this.rows.length <= 7) return null
      if (me) {
        const sub = me.rank === 1
          ? '¡Vas primero! Sostenelo.'
          : (this.above ? `Te faltan ${(this.above.total_xp - me.total_xp + 1).toLocaleString('es-AR')} XP para pasar al #${this.above.rank}` : '')
        return { rank: me.rank, xp: me.total_xp, sub }
      }
      if (this.period === 'all_time' && !this.gameId && this.scope === 'todos' && this.myGlobal?.rank) {
        return { rank: this.myGlobal.rank, xp: this.myGlobal.xp, sub: 'Jugá para seguir subiendo' }
      }
      return { rank: null, xp: null, sub: this.period === 'all_time' ? 'Jugá para entrar al ranking' : 'Jugá hoy para entrar al ranking de este período' }
    },
    me() { return shellState.user || {} },
    meEquip() { return shellState.equipped || {} },
  },
  async mounted() {
    this.meId = getAuthUser()?.id || ''
    this._tick = setInterval(() => { this.now = Date.now() }, 60000)
    this.loadGames()
    this.load()
  },
  beforeUnmount() { clearInterval(this._tick) },
  methods: {
    initialOf,
    tapHaptic,
    teamLink(team) { const t = findTeamByName(team); return t?.id ? `/team/${t.id}` : null },
    setPeriod(v) {
      if (v === this.period) return
      tapHaptic(); this.period = v; this.reload()
    },
    setScope(k) {
      if (k === this.scope) return
      tapHaptic(); this.scope = k; this.reload()
    },
    setGame(e) { this.gameId = e.target.value; this.reload() },
    reload() { this.scope === 'penias' ? this.loadPenias() : this.load() },
    async loadGames() {
      try {
        const all = await fetchGames()
        const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        const byName = new Map()
        for (const g of (all || [])) {
          if (!uuid.test(String(g.id || '')) || g.slug === 'name-correct' || g.slug === 'quien-es') continue
          const key = (g.name || '').toLowerCase().trim()
          if (!byName.has(key)) byName.set(key, { id: g.id, name: g.name })
        }
        this.games = Array.from(byName.values())
      } catch { this.games = [] }
    },
    async ensureFriendIds() {
      if (this.friendIds) return this.friendIds
      const { data } = await listConnections(this.meId)
      this.friendIds = (data || []).map(r => (r.user_a === this.meId ? r.user_b : r.user_a)).filter(Boolean)
      return this.friendIds
    },
    async load() {
      const req = ++this._reqId
      this.loading = true
      this.error = false
      try {
        let rows
        if (this.scope === 'amigos' && this.logged) {
          const friendIds = await this.ensureFriendIds()
          rows = await loadFriendsLeaderboard({ period: this.period, gameId: this.gameId || null, meId: this.meId, friendIds })
          this.hasMore = false
        } else {
          rows = await loadLeaderboardPage({ period: this.period, gameId: this.gameId || null, limit: this.pageSize, offset: 0 })
          this.hasMore = rows.length === this.pageSize
        }
        if (req !== this._reqId) return
        this.rows = rows
        this.rows = await withCosmetics(rows)
        if (req !== this._reqId) return
        if (this.logged && this.period === 'all_time' && !this.meRow && !this.myGlobal) {
          const { rank } = await getUserRank(this.meId).catch(() => ({ rank: null }))
          this.myGlobal = rank ? { rank, xp: shellState.stats.xpTotal || null } : null
        }
      } catch (e) {
        console.warn('[ranking]', e?.message || e)
        if (req === this._reqId) { this.rows = []; this.error = true }
      } finally {
        if (req === this._reqId) this.loading = false
      }
    },
    async loadMore() {
      if (this.loadingMore || !this.hasMore) return
      this.loadingMore = true
      try {
        const more = await loadLeaderboardPage({ period: this.period, gameId: this.gameId || null, limit: this.pageSize, offset: this.rows.length })
        this.hasMore = more.length === this.pageSize
        this.rows = [...this.rows, ...(await withCosmetics(more))]
      } catch { this.hasMore = false }
      finally { this.loadingMore = false }
    },
    async loadPenias() {
      this.peniasLoading = true
      try { this.penias = await getFanbaseLeaderboard(this.period === 'all_time' ? 'monthly' : this.period) }
      catch { this.penias = [] }
      finally { this.peniasLoading = false }
    },
  },
}
</script>

<template>
  <section class="rk-page max-w-xl mx-auto -mt-4 lg:mt-0">
    <header class="flex flex-col gap-3 pt-1">
      <div class="flex items-center justify-between">
        <h1 class="font-display font-bold text-2xl text-white">Ranking</h1>
        <span class="rk-ends">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2"/></svg>{{ endsLabel }}
        </span>
      </div>

      <div class="rk-seg" role="tablist" aria-label="Período">
        <span class="rk-seg-thumb" :style="{ transform: `translateX(${PERIODS.findIndex(p => p.value === period) * 100}%)` }" aria-hidden="true"></span>
        <button v-for="p in PERIODS" :key="p.value" type="button" role="tab" :aria-selected="period === p.value"
          class="rk-seg-btn" :class="period === p.value ? 'is-on' : ''" @click="setPeriod(p.value)">{{ p.label }}</button>
      </div>

      <div class="rk-filters">
        <button v-for="s in scopes" :key="s.key" type="button" class="rk-pill" :class="scope === s.key ? 'is-on' : ''"
          :aria-pressed="scope === s.key" @click="setScope(s.key)">{{ s.label }}</button>
        <label v-if="scope !== 'penias' && games.length" class="rk-pill rk-game">
          <span class="sr-only">Juego</span>
          <select :value="gameId" @change="setGame" aria-label="Filtrar por juego">
            <option value="">Juego: todos</option>
            <option v-for="g in games" :key="g.id" :value="g.id">{{ g.name }}</option>
          </select>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
        </label>
      </div>
    </header>

    <main class="pt-3.5 flex flex-col gap-2">
      <template v-if="scope !== 'penias'">
        <div v-if="error" class="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
          <p class="text-sm text-slate-300">No pudimos traer el ranking.</p>
          <button type="button" class="mt-3 min-h-[44px] px-5 rounded-xl border border-white/15 text-sm font-bold text-white" @click="load">Reintentar</button>
        </div>
        <LeaderboardTable v-else :rows="rows" :loading="loading" :me-id="meId"
          :empty-text="scope === 'amigos' ? 'Ni vos ni tus amigos sumaron XP en este período' : 'Todavía nadie sumó XP en este período'" />
        <button v-if="hasMore && !loading && !error" type="button" class="rk-more" :disabled="loadingMore" @click="loadMore">
          {{ loadingMore ? 'Cargando…' : 'Ver más' }}
        </button>
      </template>

      <template v-else>
        <p class="text-[12px] text-slate-400 -mt-1">Peñas: la XP sumada por los hinchas de cada club ({{ period === 'weekly' ? 'esta semana' : 'este mes' }}).</p>
        <div v-if="peniasLoading" class="flex flex-col gap-2"><div v-for="i in 6" :key="i" class="h-[52px] rounded-2xl bg-white/5 animate-pulse"></div></div>
        <div v-else-if="!penias.length" class="rounded-2xl border border-white/10 bg-white/[0.03] py-10 text-center text-sm text-slate-400">Todavía no hay peñas activas este período</div>
        <ol v-else class="flex flex-col gap-2">
          <li v-for="(p, idx) in penias" :key="p.team">
            <component :is="teamLink(p.team) ? 'RouterLink' : 'div'" :to="teamLink(p.team) || undefined" class="rk-penia" :class="idx < 3 ? 'med-' + (idx + 1) : ''">
              <span class="rk-penia-pos">{{ idx + 1 }}</span>
              <span class="flex-1 min-w-0">
                <span class="block text-sm font-bold text-white truncate">{{ p.team }}</span>
                <span class="block text-[11px] text-slate-400">{{ p.activeCount }} activos de {{ p.memberCount }} hinchas</span>
              </span>
              <span class="font-display font-bold text-[13px] text-slate-200 tabular-nums">{{ p.totalXp.toLocaleString('es-AR') }} XP</span>
            </component>
          </li>
        </ol>
      </template>
    </main>

    <!-- Tu puesto, fijo abajo (sobre la tab bar) -->
    <div v-if="meBar" class="rk-mebar" role="status">
      <span class="rk-mebar-pos">{{ meBar.rank ? '#' + meBar.rank : '–' }}</span>
      <UserAvatar :size="38" :avatar-url="me.avatar_url || ''" :initial="initialOf(me.display_name || me.email)"
        :frame-key="meEquip.frameKey" :icon-glyph="meEquip.iconGlyph" :icon-bg="meEquip.iconBg" :glow="false" />
      <span class="flex-1 min-w-0 flex flex-col">
        <strong class="text-sm text-white truncate">Vos<template v-if="meBar.xp != null"> · {{ meBar.xp.toLocaleString('es-AR') }} XP</template></strong>
        <span v-if="meBar.sub" class="text-[11px] leading-tight text-blue-200">{{ meBar.sub }}</span>
      </span>
      <RouterLink to="/play/points" class="rk-play" @click="tapHaptic">JUGAR</RouterLink>
    </div>
    <div v-else-if="!logged" class="rk-mebar">
      <span class="flex-1 min-w-0 text-[13px] font-semibold text-blue-100">Creá tu cuenta para aparecer en el ranking</span>
      <RouterLink to="/register" class="rk-play">CREAR CUENTA</RouterLink>
    </div>
  </section>
</template>

<style scoped>
.rk-page { position: relative; }
.rk-page::before {
  content: ''; position: absolute; inset: -40px -24px auto; height: 260px; pointer-events: none; z-index: -1;
  background: radial-gradient(80% 60% at 50% 0%, rgba(59,130,246,0.22), transparent 70%);
}
.rk-ends {
  display: inline-flex; align-items: center; gap: 5px; padding: 5px 10px; border-radius: 999px;
  background: rgba(255,255,255,0.06); font-family: var(--font-shout); font-weight: 700; font-size: 14px; color: #cbd5e1;
}
.rk-seg {
  position: relative; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); padding: 4px; border-radius: 999px;
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08);
}
.rk-seg-thumb {
  position: absolute; top: 4px; bottom: 4px; left: 4px; width: calc((100% - 8px) / 3); border-radius: 999px;
  background: linear-gradient(180deg, #ffffff, #e2e8f0); box-shadow: 0 2px 8px rgba(0,0,0,0.35);
  transition: transform .3s cubic-bezier(.34, 1.3, .64, 1);
}
.rk-seg-btn { position: relative; z-index: 1; min-height: 40px; border-radius: 999px; font-weight: 800; font-size: 14px; color: #94a3b8; transition: color .2s ease; }
.rk-seg-btn.is-on { color: #0f172a; }
.rk-pill {
  min-height: 36px; padding: 0 14px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.12);
  color: #94a3b8; font-weight: 700; font-size: 13px; display: inline-flex; align-items: center; gap: 6px;
}
.rk-pill.is-on { background: rgba(96,165,250,0.18); border-color: rgba(96,165,250,0.6); color: #bfdbfe; }
.rk-filters { display: flex; align-items: center; gap: 8px; overflow-x: auto; scrollbar-width: none; margin: 0 -16px; padding: 0 16px; }
.rk-filters::-webkit-scrollbar { display: none; }
.rk-pill { flex-shrink: 0; }
.rk-game { position: relative; padding-right: 10px; margin-left: auto; }
.rk-game select { appearance: none; background: transparent; color: #cbd5e1; font: inherit; min-height: 34px; max-width: 100%; text-overflow: ellipsis; color-scheme: dark; outline: none; }
.rk-game option { background: #0b1220; color: #e2e8f0; }
.rk-more { min-height: 44px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.12); color: #e2e8f0; font-weight: 700; font-size: 14px; }
.rk-penia {
  display: flex; align-items: center; gap: 12px; min-height: 52px; padding: 0 12px; border-radius: 16px;
  background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); text-decoration: none;
}
.rk-penia-pos { width: 30px; text-align: center; font-family: var(--font-shout); font-weight: 800; font-size: 18px; color: #64748b; }
.rk-penia.med-1 { border-color: rgba(251,191,36,0.55); background: linear-gradient(90deg, rgba(251,191,36,0.2), rgba(251,191,36,0.02) 70%); }
.rk-penia.med-2 { border-color: rgba(203,213,225,0.45); background: linear-gradient(90deg, rgba(203,213,225,0.16), rgba(203,213,225,0.02) 70%); }
.rk-penia.med-3 { border-color: rgba(251,146,60,0.5); background: linear-gradient(90deg, rgba(234,88,12,0.18), rgba(234,88,12,0.02) 70%); }
.rk-penia.med-1 .rk-penia-pos { color: #fbbf24; } .rk-penia.med-2 .rk-penia-pos { color: #e2e8f0; } .rk-penia.med-3 .rk-penia-pos { color: #fb923c; }
.rk-mebar {
  position: sticky; z-index: 20; margin-top: 14px;
  bottom: calc(var(--shell-tabbar-h, 64px) + env(safe-area-inset-bottom, 0px) + 12px);
  border-radius: 18px; padding: 10px 12px; display: flex; align-items: center; gap: 10px;
  background: linear-gradient(90deg, #1e3a8a, #1e40af); border: 1px solid rgba(147,197,253,0.5);
  box-shadow: 0 -8px 24px rgba(0,0,0,0.5);
}
@media (min-width: 1024px) { .rk-mebar { bottom: 16px; } }
.rk-mebar-pos { font-family: var(--font-shout); font-weight: 800; font-size: 20px; color: #bfdbfe; min-width: 34px; }
.rk-play {
  min-height: 44px; padding: 0 16px; border-radius: 12px; background: linear-gradient(180deg, #fcd34d, #f59e0b);
  box-shadow: 0 3px 0 #b45309; color: #1c1206; display: inline-flex; align-items: center; white-space: nowrap;
  font-family: var(--font-shout); font-weight: 800; font-size: 18px; text-decoration: none;
}
.rk-play:active { transform: translateY(2px); box-shadow: 0 1px 0 #b45309; }
@media (prefers-reduced-motion: reduce) {
  .rk-seg-thumb, .rk-seg-btn { transition: none; }
}
</style>
