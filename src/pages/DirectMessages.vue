<script>
import AppH1 from '../components/common/AppH1.vue'
import { subscribeToAuthStateChanges } from '../services/auth'
import { fetchRecentConversations } from '../services/direct-messages'
import { formatShortDate } from '../services/formatters'

let unsubscribeAuth = () => {}

export default {
  name: 'DirectMessagesIndex',
  components: { AppH1 },
  data() {
    return {
      user: { id: null, email: null },
      threads: [],
      loading: false,
    }
  },
  methods: {
    formatShortDate,
    async load() {
      this.loading = true
      try {
        const { data } = await fetchRecentConversations()
        this.threads = data || []
      } finally { this.loading = false }
    }
  },
  async mounted() {
    unsubscribeAuth = subscribeToAuthStateChanges(async (u) => { this.user = u; await this.load() })
    await this.load()
  },
  unmounted() { try { unsubscribeAuth() } catch {} }
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between gap-2 mb-2">
      <AppH1>Mensajes</AppH1>
    </div>
    <section class="card p-0 overflow-hidden">
      <div class="p-3">
        <div v-if="loading" class="text-slate-400 text-sm">Cargando…</div>
        <div v-else-if="!threads.length" class="text-slate-400 text-sm">Sin conversaciones</div>
        <ul v-else class="divide-y divide-white/5">
          <li v-for="t in threads" :key="t.peer_id">
            <router-link :to="`/messages/${t.peer_id}`" class="flex items-center gap-3 p-3 hover:bg-white/5">
              <img v-if="t.profile?.avatar_url" :src="t.profile.avatar_url" class="w-10 h-10 rounded-full object-cover" alt="avatar" />
              <div v-else class="w-10 h-10 rounded-full bg-slate-700 grid place-items-center text-sm text-slate-200">
                {{ ((t.profile?.display_name || t.profile?.email || '?').trim()[0] || '?').toUpperCase() }}
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <div class="text-slate-100 font-medium truncate">
                    {{ t.profile?.display_name || t.profile?.email || t.peer_id }}
                  </div>
                  <div class="ml-auto text-[11px] text-slate-400">
                    {{ formatShortDate(t.last?.created_at) }}
                  </div>
                </div>
                <div class="text-sm text-slate-300 truncate">
                  {{ t.last?.content || '' }}
                </div>
              </div>
              <div v-if="t.unread > 0" class="shrink-0 ml-2 rounded-full bg-[oklch(0.62_0.21_270)] text-white text-[11px] px-2 py-0.5">
                {{ t.unread }}
              </div>
            </router-link>
          </li>
        </ul>
      </div>
    </section>
  </div>
</template>


