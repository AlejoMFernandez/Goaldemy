<script>
import { subscribeToAuthStateChanges } from '../services/auth'
import { fetchRecentConversations } from '../services/direct-messages'
import { formatDayMonth } from '../services/formatters'
import { openMiniChat } from '../stores/dms-ui'
import { listConnections } from '../services/connections'
import { getPublicProfilesByIds } from '../services/user-profiles'

let unsubscribeAuth = () => {}

export default {
  name: 'DirectMessagesDock',
  data() {
    return {
      open: false,
      collapsedReady: true,
      user: { id: null, email: null, avatar_url: null, display_name: null },
      threads: [],
      loading: false,
      activePeerId: null,
      // Search state
      query: '',
      connsProfiles: [],
      connsLoaded: false,
      searching: false,
    }
  },
  methods: {
    formatDayMonth,
    toggle() {
      if (!this.open) {
        // Opening: hide collapsed header, then show panel
        this.collapsedReady = false
        this.open = true
        this.load()
      } else {
        // Closing: start leave transition; show collapsed after it finishes
        this.open = false
      }
    },
    async load() {
      this.loading = true
      try {
        const { data } = await fetchRecentConversations()
        this.threads = data || []
      } finally { this.loading = false }
    },
    openChat(peerId) { openMiniChat(peerId) },
    async ensureConnectionsLoaded() {
      if (this.connsLoaded || !this.user?.id) return
      const { data: rows } = await listConnections()
      const peers = (rows || []).map(r => r.user_a === this.user.id ? r.user_b : r.user_a)
      if (!peers.length) { this.connsProfiles = []; this.connsLoaded = true; return }
      const { data: profiles } = await getPublicProfilesByIds(peers)
      // Sort alphabetically by display_name/email for nicer UX
      this.connsProfiles = (profiles || []).slice().sort((a,b)=>{
        const an = (a?.display_name || a?.email || '').toLowerCase()
        const bn = (b?.display_name || b?.email || '').toLowerCase()
        return an.localeCompare(bn)
      })
      this.connsLoaded = true
    },
    onSearchInput() {
      this.searching = (this.query || '').trim().length > 0
      if (this.searching && !this.connsLoaded) {
        this.ensureConnectionsLoaded()
      }
    },
    clearSearch() { this.query = ''; this.searching = false },
  },
  computed: {
    filteredFriends() {
      const q = (this.query || '').trim().toLowerCase()
      if (!q) return []
      return (this.connsProfiles || []).filter(p =>
        (p?.display_name || '').toLowerCase().includes(q) ||
        (p?.email || '').toLowerCase().includes(q)
      ).slice(0, 12)
    }
  },
  async mounted() {
    unsubscribeAuth = subscribeToAuthStateChanges(async (u) => { this.user = u || {}; if (this.open) await this.load() })
  },
  unmounted() { try { unsubscribeAuth() } catch {} }
}
</script>

<template>
  <div v-if="user?.id" class="fixed bottom-0 right-6 z-40">
    <!-- Floating toggle button (mobile only) -->
    <button @click="toggle" class="sm:hidden rounded-full h-12 w-12 grid place-items-center bg-[oklch(0.62_0.21_270)] text-white shadow-lg shadow-black/40 border border-white/10 hover:brightness-110">
      <svg v-if="!open" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-6 w-6"><path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/></svg>
      <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-6 w-6"><path d="M19 13H5v-2h14z"/></svg>
    </button>

    <!-- Desktop collapsed header (acts as opener) -->
  <button v-if="collapsedReady && !open" @click="toggle" class="hidden sm:flex items-center gap-2 p-3 mt-3 w-[380px] bg-slate-900/95 backdrop-blur rounded-t-2xl border border-white/10 border-b-0 shadow-xl hover:bg-white/5">
      <img v-if="user?.avatar_url" :src="user.avatar_url" alt="avatar" class="h-7 w-7 rounded-full" />
      <div v-else class="h-7 w-7 rounded-full bg-slate-700 grid place-items-center text-xs text-slate-200">
        {{ ((user?.display_name || user?.email || '?').trim()[0] || '?').toUpperCase() }}
      </div>
      <div class="font-semibold text-slate-100">Mensajes</div>
      <div class="ml-auto text-slate-300 mr-1">▲</div>
    </button>

    <!-- Bottom sheet panel -->
    <transition name="sheet" @before-enter="collapsedReady = false" @after-leave="collapsedReady = true">
      <div v-if="open" class="mt-3 w-[88vw] sm:w-[380px] max-h-[60vh] bg-slate-900/95 backdrop-blur rounded-t-2xl border border-white/10 border-b-0 shadow-xl overflow-hidden">
        <!-- Header clickable whole area -->
        <button @click="toggle" class="w-full text-left flex items-center gap-2 p-3 border-b border-white/10 hover:bg-white/5">
          <img v-if="user?.avatar_url" :src="user.avatar_url" alt="avatar" class="h-7 w-7 rounded-full" />
          <div v-else class="h-7 w-7 rounded-full bg-slate-700 grid place-items-center text-xs text-slate-200">
            {{ ((user?.display_name || user?.email || '?').trim()[0] || '?').toUpperCase() }}
          </div>
          <div class="font-semibold text-slate-100">Mensajes</div>
          <div class="ml-auto text-slate-300 mr-1">▼</div>
        </button>
        <!-- Search bar -->
        <div class="px-3 pt-2 pb-2 border-b border-white/10 bg-white/0">
          <div class="relative">
            <input
              v-model="query"
              @input="onSearchInput"
              type="text"
              class="w-full text-[13px] px-8 py-1.5 rounded-md bg-white/5 border border-white/10 placeholder:text-slate-400 text-slate-100 focus:outline-none focus:ring-1 focus:ring-white/20"
              placeholder="Buscar entre tus conexiones…"
            />
            <!-- search icon -->
            <svg class="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zM9.5 14C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
            <!-- clear -->
            <button v-if="query" @click="clearSearch" class="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 grid place-items-center text-slate-300 hover:text-slate-100" aria-label="Limpiar búsqueda">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-4 w-4"><path d="M18.3 5.71 12 12l6.3 6.29-1.41 1.42L10.59 13.4 4.3 19.71 2.89 18.3 9.17 12 2.89 5.71 4.3 4.29l6.29 6.3 6.3-6.3z"/></svg>
            </button>
          </div>
        </div>
        <div class="max-h-[50vh] overflow-y-auto">
          <div v-if="loading" class="p-3 text-slate-400 text-sm">Cargando…</div>
          <!-- Search results over connections -->
          <template v-if="searching">
            <div v-if="!connsLoaded" class="p-3 text-slate-400 text-sm">Buscando en tus conexiones…</div>
            <div v-else-if="filteredFriends.length === 0" class="p-3 text-slate-400 text-sm">Sin resultados</div>
            <ul v-else class="divide-y divide-white/5">
              <li v-for="p in filteredFriends" :key="p.id">
                <button @click="openChat(p.id); clearSearch()" class="w-full text-left flex items-center gap-2 p-2 hover:bg-white/5">
                  <img v-if="p?.avatar_url" :src="p.avatar_url" class="w-7 h-7 rounded-full object-cover" alt="avatar" />
                  <div v-else class="w-7 h-7 rounded-full bg-slate-700 grid place-items-center text-[11px] text-slate-200">
                    {{ ((p?.display_name || p?.email || '?').trim()[0] || '?').toUpperCase() }}
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="text-slate-100 text-sm truncate">{{ p.display_name || p.email || p.id }}</div>
                    <div class="text-[11px] text-slate-400 truncate">Conexión</div>
                  </div>
                </button>
              </li>
            </ul>
          </template>

          <!-- Threads list (default) -->
          <template v-else>
            <div v-if="!threads.length" class="p-3 text-slate-400 text-sm">Sin conversaciones</div>
            <ul v-else class="divide-y divide-white/5">
              <li v-for="t in threads" :key="t.peer_id">
                <button @click="openChat(t.peer_id)" class="w-full text-left flex items-center gap-2 p-2 hover:bg-white/5">
                  <img v-if="t.profile?.avatar_url" :src="t.profile.avatar_url" class="w-7 h-7 rounded-full object-cover" alt="avatar" />
                  <div v-else class="w-7 h-7 rounded-full bg-slate-700 grid place-items-center text-[11px] text-slate-200">
                    {{ ((t.profile?.display_name || t.profile?.email || '?').trim()[0] || '?').toUpperCase() }}
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2">
                      <div class="text-slate-100 text-sm truncate">
                        {{ t.profile?.display_name || t.profile?.email || t.peer_id }}
                      </div>
                      <div class="ml-auto text-[12px] text-slate-400">
                        {{ formatDayMonth(t.last?.created_at) }}
                      </div>
                    </div>
                    <div class="text-[12px] text-slate-300 truncate">
                      {{ t.last?.content || '' }}
                    </div>
                  </div>
                  <div v-if="t.unread > 0" class="shrink-0 ml-2 rounded-full bg-[oklch(0.62_0.21_270)] text-white text-[10px] px-1.5 py-0.5">
                    {{ t.unread }}
                  </div>
                </button>
              </li>
            </ul>
          </template>
        </div>

        <!-- Mini chat render moved to global host -->
      </div>
    </transition>
  </div>
</template>

<style scoped>
.sheet-enter-active, .sheet-leave-active { transition: transform .2s ease, opacity .2s ease; }
.sheet-enter-from { transform: translateY(8px); opacity: 0; }
.sheet-leave-to { transform: translateY(16px); opacity: 0; }
</style>
