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
    loading: { type: Boolean, default: false },
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
          legend: { position: 'bottom', labels: { color: '#cbd5e1', boxWidth: 12 } },
          title: { display: true, text: 'XP total por juego', color: '#e2e8f0', font: { size: 14 } }
        },
        layout: { padding: 8 },
      }
    }
  }
}
</script>

<template>
  <div class="rounded-lg border border-white/10 p-4 w-full">
    <p class="text-xs uppercase tracking-wide text-slate-400">XP por juego (dona)</p>
    <div class="mt-2 min-h-56">
      <div v-if="loading" class="text-slate-300">Cargando…</div>
      <div v-else-if="!items.length" class="text-slate-500">Aún no hay XP para graficar</div>
      <div v-else style="height: 240px;">
        <Doughnut :data="chartData" :options="chartOptions" />
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>
