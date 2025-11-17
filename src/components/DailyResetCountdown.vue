<script>
export default {
  name: 'DailyResetCountdown',
  data() {
    return {
      timeLeft: '',
      timer: null
    }
  },
  mounted() {
    this.updateCountdown()
    this.timer = setInterval(() => this.updateCountdown(), 1000)
  },
  unmounted() {
    if (this.timer) clearInterval(this.timer)
  },
  methods: {
    updateCountdown() {
      const now = new Date()
      const midnight = new Date()
      midnight.setHours(24, 0, 0, 0)
      
      const diff = midnight - now
      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)
      
      this.timeLeft = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    }
  }
}
</script>

<template>
  <div class="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/60 backdrop-blur px-3 py-2">
    <div class="flex items-center gap-1.5">
      <svg class="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <div class="text-xs text-slate-400 uppercase tracking-wide">Reset en</div>
    </div>
    <div class="font-mono text-sm font-bold text-emerald-400 tabular-nums">{{ timeLeft }}</div>
  </div>
</template>
