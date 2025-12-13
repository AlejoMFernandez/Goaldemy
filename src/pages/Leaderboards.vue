<script>
import AppH1 from '../components/common/AppH1.vue'
import LeaderboardTable from '../components/leaderboard/LeaderboardTable.vue'
import PeriodTabs from '../components/leaderboard/PeriodTabs.vue'
import GameFilter from '../components/leaderboard/GameFilter.vue'
import { getLeaderboard, fetchLevelThresholds, computeLevelFromXp } from '../services/xp'
import { fetchGames } from '../services/games'

export default {
  name: 'Leaderboards',
  components: { AppH1, LeaderboardTable, PeriodTabs, GameFilter },
  data() {
    return {
      limit: 10,
      page: 0,
      period: 'all_time',
      gameId: '',
      games: [],
      rows: [],
      loading: false,
      _loadingLeaderboard: false,
    }
  },
  async mounted() {
    await this.loadGames()
    this.load()
  },
  methods: {
    async loadGames() {
      try {
        const all = await fetchGames()
        const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        // 1) Sólo juegos con UUID (existen en DB)
        // 2) Ocultar 'name-correct' y el slug legacy 'quien-es'
        const filtered = (all || [])
          .filter(g => uuid.test(String(g.id || '')))
          .filter(g => g.slug !== 'name-correct' && g.slug !== 'quien-es')

        // 3) Deduplicar por nombre (hay casos en DB con dos filas con mismo nombre)
        const byName = new Map()
        for (const g of filtered) {
          const key = (g.name || '').toLowerCase().trim()
          if (!byName.has(key)) byName.set(key, { id: g.id, slug: g.slug, name: g.name })
        }
        this.games = Array.from(byName.values())
      } catch (e) {
        this.games = []
      }
    },
    async load() {
      if (this._loadingLeaderboard) return; // prevent concurrent loads
      this._loadingLeaderboard = true;
      this.loading = true
      try {
        const thresholds = await fetchLevelThresholds().catch(() => [])
        const { data, error } = await getLeaderboard({
          period: this.period,
          gameId: this.gameId || null,
          limit: this.limit,
          offset: this.page * this.limit,
        })
        if (error) console.error('getLeaderboard error:', error)
        const base = Array.isArray(data) ? data : (data ? [data] : [])
        const mapped = base.map((r, idx) => ({
          rank: r.rank ?? (this.page * this.limit + idx + 1),
          user_id: r.user_id,
          // Prioritize display_name over username over email over user_id
          display_name: r.display_name || r.username || r.email || r.user_id?.slice(0,8) || '—',
          avatar_url: r.avatar_url || null,
          // Prefer server-provided global level. As a fallback, compute from all-time thresholds only if server omitted it.
          level: r.user_level ?? r.level ?? null,
          total_xp: r.xp_total ?? 0,
        }))
        this.rows = mapped

        // If any level is missing (older DB without global level), fetch per-user global level as a fallback
        if (this.rows.some(r => r.level == null)) {
          try {
            const { getUserLevel } = await import('../services/xp')
            const promises = this.rows.map(async (r, i) => {
              if (r.level != null) return null
              const { data } = await getUserLevel(r.user_id)
              const info = Array.isArray(data) ? data[0] : data
              const lvl = info?.level ?? null
              if (lvl != null) this.$set ? this.$set(this.rows, i, { ...r, level: lvl }) : (this.rows[i] = { ...r, level: lvl })
              return null
            })
            await Promise.all(promises)
          } catch (e) {
            // ignore fallback errors, UI can show — for missing levels
          }
        }
      } catch (e) {
        console.error('getLeaderboard exception:', e)
        this.rows = []
      } finally {
        this.loading = false
        this._loadingLeaderboard = false;
      }
    },
    nextPage() {
      this.page += 1
      this.load()
    },
    prevPage() {
      if (this.page === 0) return
      this.page -= 1
      this.load()
    }
  }
}
</script>

<template>
  <section class="mx-auto max-w-4xl px-0 sm:px-4">
    <div class="mb-4 px-4 sm:px-0">
      <AppH1>Top Global</AppH1>
    </div>
    <div class="mb-3 flex justify-between flex-col sm:flex-row gap-3 px-4 sm:px-0">
      <PeriodTabs v-model="period" @update:modelValue="page=0; load()" />
      <GameFilter v-model="gameId" :games="games" @update:modelValue="page=0; load()" />
    </div>
    <div class="px-4 sm:px-0">
      <LeaderboardTable :rows="rows" :loading="loading" />
    </div>
    <div class="mt-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 sm:px-0">
      <div class="flex items-center gap-2 text-xs sm:text-sm text-slate-300 flex-wrap">
        <span>Mostrar</span>
        <select v-model.number="limit" @change="page = 0; load()" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-slate-100 focus:outline-none focus:ring-2 focus:ring-white/20 hover:bg-white/10 text-xs sm:text-sm">
          <option :value="10">10</option>
          <option :value="25">25</option>
          <option :value="50">50</option>
          <option :value="100">100</option>
        </select>
        <span>por página</span>
      </div>
      <div class="flex items-center gap-2 w-full sm:w-auto">
        <button class="flex-1 sm:flex-initial px-3 py-1.5 text-xs sm:text-sm rounded bg-white/5 border border-white/10 disabled:opacity-50" :disabled="page===0 || loading" @click="prevPage">Anterior</button>
        <button class="flex-1 sm:flex-initial px-3 py-1.5 text-xs sm:text-sm rounded bg-white/5 border border-white/10 disabled:opacity-50" :disabled="rows.length < limit || loading" @click="nextPage">Siguiente</button>
      </div>
    </div>
  </section>
</template>


