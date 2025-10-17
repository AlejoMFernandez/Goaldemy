<script>
import AppH1 from '../components/AppH1.vue'
import LeaderboardTable from '../components/leaderboard/LeaderboardTable.vue'
import PeriodTabs from '../components/leaderboard/PeriodTabs.vue'
import GameFilter from '../components/leaderboard/GameFilter.vue'
import { getLeaderboard } from '../services/xp'
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
        this.games = await fetchGames()
      } catch (e) {
        this.games = []
      }
    },
    async load() {
      this.loading = true
      try {
        const { data, error } = await getLeaderboard({
          period: this.period,
          gameId: this.gameId || null,
          limit: this.limit,
          offset: this.page * this.limit,
        })
        if (error) console.error('getLeaderboard error:', error)
        const base = Array.isArray(data) ? data : (data ? [data] : [])
        this.rows = base.map((r, idx) => ({
          rank: r.rank ?? (this.page * this.limit + idx + 1),
          user_id: r.user_id,
          display_name: r.display_name || r.username || r.user_id?.slice(0,8),
          avatar_url: r.avatar_url || null,
          total_xp: r.xp_total ?? 0,
        }))
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
