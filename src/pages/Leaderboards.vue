<script>
import AppH1 from '../components/AppH1.vue'
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
          display_name: r.display_name || r.username || r.user_id?.slice(0,8),
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
  <section class="mx-auto max-w-4xl">
    <div class="mb-4 flex items-center justify-between gap-2">
      <AppH1>Top Global</AppH1>
    </div>
    <div class="mb-3 flex justify-between items-center gap-3">
      <PeriodTabs v-model="period" @update:modelValue="page=0; load()" />
      <GameFilter v-model="gameId" :games="games" @update:modelValue="page=0; load()" />
    </div>
    <LeaderboardTable :rows="rows" :loading="loading" />
    <div class="mt-3 flex items-center justify-between">
      <div class="flex items-center gap-2 text-sm text-slate-300">
        <span>Mostrar</span>
  <select v-model.number="limit" @change="page = 0; load()" class="rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-slate-100 focus:outline-none focus:ring-2 focus:ring-white/20 hover:bg-white/10">
          <option :value="10">10</option>
          <option :value="25">25</option>
          <option :value="50">50</option>
          <option :value="100">100</option>
        </select>
        <span>por página</span>
      </div>
      <div class="flex items-center gap-2">
        <button class="px-3 py-1 rounded bg-white/5 border border-white/10 disabled:opacity-50" :disabled="page===0 || loading" @click="prevPage">Anterior</button>
        <button class="px-3 py-1 rounded bg-white/5 border border-white/10 disabled:opacity-50" :disabled="rows.length < limit || loading" @click="nextPage">Siguiente</button>
      </div>
    </div>
  </section>
</template>
