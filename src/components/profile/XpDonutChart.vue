<script>
import { Doughnut } from 'vue-chartjs'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js'

ChartJS.register(Title, Tooltip, Legend, ArcElement)

export default {
  name: 'XpDonutChart',
  components: { Doughnut },
  props: {
    items: { type: Array, required: true }, // [{ id, name, xp }]
    streaksByGame: { type: Object, default: () => ({}) }, // { [gameId]: maxStreak }
    dailyBestByName: { type: Object, default: () => ({}) }, // { [gameName]: bestDailyStreak }
    loading: { type: Boolean, default: false },
  },
  data() {
    return { chartRef: null }
  },
  computed: {
    chartData() {
      const labels = this.items.map(i => i.name)
      const data = this.items.map(i => i.xp)
      const palette = [
        '#60a5fa', '#a78bfa', '#34d399', '#fbbf24', '#f87171', '#f472b6', '#22d3ee', '#93c5fd'
      ]
      const bg = labels.map((_, idx) => palette[idx % palette.length] + '88')
      const border = labels.map((_, idx) => palette[idx % palette.length])
      return {
        labels,
        datasets: [{
          data,
          backgroundColor: bg,
          borderColor: border,
          borderWidth: 1,
        }]
      }
    },
    chartOptions() {
      return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          // Legend below the chart with extra spacing to separate from the donut
          legend: {
            position: 'bottom',
            labels: { color: '#cbd5e1', boxWidth: 12, padding: 16 },
            padding: 16,
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const v = ctx.parsed ?? ctx.raw ?? 0
                const nf = new Intl.NumberFormat('es-AR')
                return ` ${nf.format(v)} XP`
              }
            }
          }
        },
        // Extra bottom padding creates a clearer gap between the chart area and the legend
        layout: { padding: { top: 8, right: 8, bottom: 16, left: 8 } },
      }
    }
  },
  methods: {
    onChartMounted(el) {
      this.chartRef = el
    },
    highlightIndex(i) {
      const c = this.chartRef?.chart
      if (!c) return
      c.setActiveElements([{ datasetIndex: 0, index: i }])
      c.tooltip?.setActiveElements?.([{ datasetIndex: 0, index: i }], { x: 0, y: 0 })
      c.update()
    },
    clearHighlight() {
      const c = this.chartRef?.chart
      if (!c) return
      c.setActiveElements([])
      c.tooltip?.setActiveElements?.([], { x: 0, y: 0 })
      c.update()
    }
  }
}
</script>

<template>
  <div class="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/50 backdrop-blur p-6 w-full shadow-xl">
    <p class="text-xs uppercase tracking-wide text-slate-400 mb-4">XP por juego</p>
    <div class="min-h-56">
      <div v-if="loading" class="text-center py-12 text-slate-400">
        <div class="animate-pulse">Cargando estadísticas...</div>
      </div>
      <div v-else-if="!items.length" class="text-center py-12 rounded-xl bg-slate-800/30 border border-white/5">
        <div class="text-3xl mb-2">📊</div>
        <p class="text-slate-400">Aún no hay XP para graficar</p>
      </div>
      <div v-else>
        <div style="height: 240px;" class="mb-4">
          <Doughnut ref="chart" :data="chartData" :options="chartOptions" :height="240" :width="240" v-slot="{ chart }" >
          </Doughnut>
        </div>
        <div class="rounded-xl bg-slate-800/40 border border-white/10 p-4">
          <p class="text-[10px] uppercase tracking-wider text-slate-400 mb-3">Detalle por juego</p>
          <ul class="space-y-1">
            <li v-for="(g,idx) in items" :key="g.id" 
              class="flex items-center gap-2 text-sm rounded-lg px-2 py-1 hover:bg-white/5 transition-all">
              <span class="truncate text-slate-200">{{ g.name }}</span>
              <span class="ml-auto flex items-center gap-2">
                <span v-if="streaksByGame[g.id]" 
                  class="hidden sm:inline-flex items-center rounded-lg px-2 py-0.5 border border-emerald-400/30 bg-emerald-500/10 text-emerald-200 text-xs font-semibold" 
                  title="Mejor racha en juego">
                  ×{{ streaksByGame[g.id] }}
                </span>
                <span v-if="dailyBestByName[g.name]" 
                  class="hidden sm:inline-flex items-center rounded-lg px-2 py-0.5 border border-orange-400/30 bg-orange-500/10 text-orange-200 text-xs font-semibold" 
                  title="Mejor racha diaria">
                  🔥{{ dailyBestByName[g.name] }}
                </span>
                <span class="text-slate-100 font-medium">{{ new Intl.NumberFormat('es-AR').format(g.xp) }} XP</span>
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
canvas { cursor: pointer; }
</style>
