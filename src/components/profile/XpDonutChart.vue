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
  <div class="rounded-lg border border-white/10 p-4 w-full">
    <p class="text-xs uppercase tracking-wide text-slate-400">XP por juego</p>
    <div class="mt-2 min-h-56">
      <div v-if="loading" class="text-slate-300">Cargando…</div>
      <div v-else-if="!items.length" class="text-slate-500">Aún no hay XP para graficar</div>
      <div v-else>
        <div style="height: 240px;">
          <Doughnut ref="chart" :data="chartData" :options="chartOptions" :height="240" :width="240" v-slot="{ chart }" >
          </Doughnut>
        </div>
        <div class="rounded-lg bg-white/3 border border-white/10 p-3">
          <p class="text-[10px] uppercase tracking-wider text-slate-400">Detalle</p>
          <ul class="mt-1 space-y-1">
            <li v-for="(g,idx) in items" :key="g.id" class="flex items-center gap-2 text-sm text-slate-200 rounded px-2 py-1">
              <span class="truncate">{{ g.name }}</span>
              <span class="ml-auto flex items-center gap-2">
                <span v-if="streaksByGame[g.id]" class="inline-flex items-center rounded-full px-2 py-0.5 ring-1 ring-emerald-400/40 bg-emerald-500/10 text-emerald-200 text-xs" title="Mejor racha en juego">×{{ streaksByGame[g.id] }}</span>
                <span v-if="dailyBestByName[g.name]" class="inline-flex items-center rounded-full px-2 py-0.5 ring-1 ring-orange-400/40 bg-orange-500/10 text-amber-200 text-xs" title="Mejor racha por día">🔥{{ dailyBestByName[g.name] }}</span>
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
