<script>
import { getReferralStats, buildReferralLink } from '../../services/referral'
import { shareOrCopy } from '../../services/share'
import { pushErrorToast } from '../../stores/notifications'

export default {
  name: 'ReferralCard',
  data() {
    return {
      code: '',
      invitedCount: 0,
      loading: true,
      copied: false,
    }
  },
  computed: {
    link() {
      return buildReferralLink(this.code)
    },
  },
  async mounted() {
    try {
      const stats = await getReferralStats()
      this.code = stats.code || ''
      this.invitedCount = stats.invitedCount || 0
    } catch (e) {
      try { pushErrorToast('No pudimos cargar tu link de invitación') } catch {}
    } finally {
      this.loading = false
    }
  },
  methods: {
    async onShare() {
      const result = await shareOrCopy(this.link)
      if (result === 'copied' || result === 'shared') {
        this.copied = true
        setTimeout(() => { this.copied = false }, 2200)
      }
    },
  },
}
</script>

<template>
  <div v-if="!loading && code" class="rounded-2xl border border-amber-400/20 bg-gradient-to-br from-amber-500/[0.07] to-slate-900/60 p-4">
    <div class="flex items-start justify-between gap-3 mb-3">
      <div class="min-w-0">
        <p class="text-[10px] uppercase tracking-wider text-amber-300 font-bold mb-0.5">Invitá a un amigo</p>
        <p class="text-xs text-slate-300 leading-snug">
          Vos ganás <strong class="text-amber-300">150 Fichas</strong>, tu amigo suma
          <strong class="text-amber-300">80</strong> al crear su cuenta.
        </p>
      </div>
      <div v-if="invitedCount > 0" class="shrink-0 text-center rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-1.5">
        <div class="font-display text-lg font-bold text-white leading-none">{{ invitedCount }}</div>
        <div class="text-[9px] uppercase tracking-wider text-slate-400 mt-0.5">{{ invitedCount === 1 ? 'amigo' : 'amigos' }}</div>
      </div>
    </div>
    <button
      @click="onShare"
      :class="[
        'w-full flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition',
        copied ? 'bg-emerald-500/15 border border-emerald-400/40 text-emerald-300' : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 text-slate-900',
      ]"
    >
      <svg v-if="!copied" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
      </svg>
      <svg v-else class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
      </svg>
      {{ copied ? '¡Copiado!' : 'Copiar mi link de invitación' }}
    </button>
  </div>
</template>
