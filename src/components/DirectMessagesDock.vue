<script>
import { subscribeToAuthStateChanges } from '../services/auth'
import { fetchRecentConversations, fetchConversation, sendDirectMessage, subscribeConversation, markConversationRead } from '../services/direct-messages'
import { formatDayMonth, formatShortDate } from '../services/formatters'
import { listConnections } from '../services/connections'
import { getPublicProfilesByIds, getPublicProfile } from '../services/user-profiles'
import { supabase } from '../services/supabase'
import { pushErrorToast } from '../stores/notifications'

let unsubscribeAuth = () => {}
let unsubscribeDM = () => {}

export default {
  name: 'DirectMessagesDock',
  data() {
    return {
      // Views: 'list' (conversations list) or 'chat' (individual chat)
      currentView: 'list',
      open: false,
      collapsedReady: true,
      user: { id: null, email: null, avatar_url: null, display_name: null },
      threads: [],
      loading: false,
      peerLimit: 30,
      // Search state
      query: '',
      connsProfiles: [],
      connsLoaded: false,
      searching: false,
      // Chat state (when currentView === 'chat')
      activePeerId: null,
      activePeer: { id: null, display_name: null, email: null, avatar_url: null },
      messages: [],
      newMessage: { content: '' },
      chatLoading: false,
      // Realtime
      _rtChannelIns: null,
      _rtChannelUpd: null,
      _notifInterval: null,
      _loadingConvs: false,
      _debounceTimer: null,
    }
  },
  methods: {
    formatDayMonth,
    formatShortDate,
    toggle() {
      if (!this.open) {
        this.collapsedReady = false
        this.open = true
        this.load()
      } else {
        this.open = false
        // Reset view when closing
        if (this.currentView === 'chat') {
          this.currentView = 'list'
          this.detachChatRealtime()
        }
      }
    },
    async load() {
      if (this._debounceTimer) clearTimeout(this._debounceTimer)
      this._debounceTimer = setTimeout(() => this._doLoad(), 100)
    },
    async _doLoad() {
      if (this._loadingConvs) return
      this._loadingConvs = true
      this.loading = true
      try {
        const { data } = await fetchRecentConversations(this.peerLimit)
        this.threads = data || []
        this.ensureConnectionsLoaded()
      } finally {
        this.loading = false
        this._loadingConvs = false
      }
    },
    async openChat(peerId) {
      // Clear unread in thread list
      const t = this.threads.find(x => x.peer_id === peerId)
      if (t) t.unread = 0
      
      // Switch to chat view
      this.currentView = 'chat'
      this.activePeerId = peerId
      this.clearSearch()
      
      // Load peer profile and conversation
      await this.loadPeerProfile(peerId)
      await this.loadConversation()
      this.attachChatRealtime()
    },
    backToList() {
      this.currentView = 'list'
      this.activePeerId = null
      this.messages = []
      this.newMessage.content = ''
      this.detachChatRealtime()
      this.load() // Refresh list
    },
    async loadPeerProfile(id) {
      try {
        const { data } = await getPublicProfile(id)
        this.activePeer = data ? { ...data, id } : { id }
      } catch {
        this.activePeer = { id }
      }
    },
    async loadConversation() {
      this.chatLoading = true
      try {
        const { data } = await fetchConversation(this.activePeerId)
        this.messages = data || []
        await this.$nextTick()
        if (this.$refs.chatContainer) {
          this.$refs.chatContainer.scrollTop = this.$refs.chatContainer.scrollHeight
        }
        await markConversationRead(this.activePeerId)
      } finally {
        this.chatLoading = false
      }
    },
    attachChatRealtime() {
      if (unsubscribeDM) { try { unsubscribeDM() } catch {} }
      const peerId = this.activePeerId
      unsubscribeDM = subscribeConversation(peerId, {
        onInsert: async (row) => {
          const a = row.sender_id, b = row.recipient_id
          const ok = (a === this.user.id && b === peerId) || (a === peerId && b === this.user.id)
          if (!ok) return
          
          if (row.sender_id === this.user.id && row.recipient_id === peerId) {
            const idx = this.messages.findIndex(m => m.optimistic && !m.failed && m.content === row.content)
            if (idx !== -1) this.messages.splice(idx, 1, { ...row })
            else this.messages.push(row)
          } else {
            if (row.sender_id === this.activePeer.id) {
              row.display_name = this.activePeer.display_name
              row.avatar_url = this.activePeer.avatar_url
              row.email = this.activePeer.email
            }
            this.messages.push(row)
          }
          
          await this.$nextTick()
          if (this.$refs.chatContainer) {
            this.$refs.chatContainer.scrollTop = this.$refs.chatContainer.scrollHeight
          }
          
          if (row.recipient_id === this.user.id) {
            try { await markConversationRead(peerId) } catch {}
          }
        },
        onUpdate: async (row) => {
          const i = this.messages.findIndex(m => m.id === row.id)
          if (i !== -1) this.messages[i] = { ...this.messages[i], ...row }
        }
      })
    },
    detachChatRealtime() {
      if (unsubscribeDM) { try { unsubscribeDM() } catch {} }
    },
    isOwn(m) {
      return !!m && (m.sender_id === this.user.id || m.email === this.user.email)
    },
    async handleSubmit() {
      const raw = this.newMessage.content || ''
      const trimmedEnd = raw.replace(/\s+$/g, '')
      if (trimmedEnd.trim().length === 0) return
      
      const temp = {
        id: `temp-${Date.now()}`,
        sender_id: this.user.id,
        recipient_id: this.activePeer.id,
        content: trimmedEnd,
        created_at: new Date().toISOString(),
        read: false,
        optimistic: true,
        failed: false,
      }
      
      this.messages.push(temp)
      await this.$nextTick()
      if (this.$refs.chatContainer) {
        this.$refs.chatContainer.scrollTop = this.$refs.chatContainer.scrollHeight
      }
      this.newMessage.content = ''
      
      try {
        await sendDirectMessage(this.activePeer.id, trimmedEnd)
      } catch (e) {
        const idx = this.messages.findIndex(m => m.id === temp.id)
        if (idx !== -1) this.messages[idx].failed = true
        try { pushErrorToast(e?.message || 'No se pudo enviar el mensaje') } catch {}
      }
    },
    async ensureConnectionsLoaded() {
      if (this.connsLoaded || !this.user?.id) return
      const { data: rows } = await listConnections()
      const peers = (rows || []).map(r => r.user_a === this.user.id ? r.user_b : r.user_a)
      if (!peers.length) { this.connsProfiles = []; this.connsLoaded = true; return }
      const { data: profiles } = await getPublicProfilesByIds(peers)
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
    setupRealtime() {
      if (!this.user?.id) return
      try { this._rtChannelIns?.unsubscribe?.() } catch {}
      try { this._rtChannelUpd?.unsubscribe?.() } catch {}
      
      const chIns = supabase.channel(`dm-ins:${this.user.id}`)
      chIns.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `recipient_id=eq.${this.user.id}` }, () => this.load())
      chIns.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `sender_id=eq.${this.user.id}` }, () => this.load())
      chIns.subscribe()
      this._rtChannelIns = chIns
      
      const chUpd = supabase.channel(`dm-upd:${this.user.id}`)
      chUpd.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'direct_messages', filter: `recipient_id=eq.${this.user.id}` }, () => this.load())
      chUpd.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'direct_messages', filter: `sender_id=eq.${this.user.id}` }, () => this.load())
      chUpd.subscribe()
      this._rtChannelUpd = chUpd
      
      try { clearInterval(this._notifInterval) } catch {}
      this._notifInterval = setInterval(() => { if (this.open) this.load() }, 20000)
    },
  },
  computed: {
    filteredFriends() {
      const q = (this.query || '').trim().toLowerCase()
      if (!q) return []
      return (this.connsProfiles || []).filter(p =>
        (p?.display_name || '').toLowerCase().includes(q) ||
        (p?.email || '').toLowerCase().includes(q)
      ).slice(0, 12)
    },
    newContactsSuggestions() {
      const inThreads = new Set((this.threads || []).map(t => t.peer_id))
      return (this.connsProfiles || []).filter(p => !inThreads.has(p.id)).slice(0, 6)
    }
  },
  async mounted() {
    unsubscribeAuth = subscribeToAuthStateChanges(async (u) => {
      this.user = u || {}
      if (this.open) await this.load()
      this.setupRealtime()
    })
  },
  unmounted() {
    try { unsubscribeAuth() } catch {}
    try { this._rtChannelIns?.unsubscribe?.() } catch {}
    try { this._rtChannelUpd?.unsubscribe?.() } catch {}
    try { clearInterval(this._notifInterval) } catch {}
    if (this._debounceTimer) clearTimeout(this._debounceTimer)
    this.detachChatRealtime()
  }
}
</script>

<template>
  <div v-if="user?.id" class="fixed bottom-0 right-6 z-40">
    <!-- Floating toggle button (mobile only) -->
    <button @click="toggle" class="sm:hidden rounded-full h-14 w-14 grid place-items-center bg-gradient-to-br from-emerald-500 to-cyan-500 text-white shadow-2xl shadow-emerald-500/40 border border-white/20 hover:brightness-110 transition-all hover:scale-105 active:scale-95" style="margin-bottom:10px; margin-right:-15px;">
      <svg v-if="!open" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-6 w-6"><path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/></svg>
      <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-6 w-6"><path d="M19 13H5v-2h14z"/></svg>
    </button>

    <!-- Desktop collapsed header (acts as opener) -->
    <button v-if="collapsedReady && !open" @click="toggle" class="hidden sm:flex items-center gap-2 px-3 py-2 mt-3 w-[340px] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 backdrop-blur-xl rounded-t-2xl border border-white/20 border-b-0 shadow-2xl hover:shadow-emerald-500/10 hover:border-emerald-500/30 transition-all group">
      <!-- Glow effect -->
      <div class="absolute inset-0 bg-gradient-to-br from-emerald-500/0 to-cyan-500/0 group-hover:from-emerald-500/5 group-hover:to-cyan-500/5 rounded-t-2xl transition-all pointer-events-none"></div>
      
      <img v-if="user?.avatar_url" :src="user.avatar_url" alt="avatar" class="relative z-10 h-7 w-7 rounded-full ring-2 ring-white/10 group-hover:ring-emerald-400/30 transition-all" />
      <div v-else class="relative z-10 h-7 w-7 rounded-full bg-gradient-to-br from-slate-700 to-slate-600 ring-2 ring-white/10 group-hover:ring-emerald-400/30 grid place-items-center text-xs font-semibold text-slate-200 transition-all">
        {{ ((user?.display_name || user?.email || '?').trim()[0] || '?').toUpperCase() }}
      </div>
      <div class="relative z-10 flex-1">
        <div class="font-semibold text-sm text-slate-100 text-left ml-1 group-hover:text-white transition-colors">Mensajes</div>
      </div>
      <div class="relative z-10 ml-auto text-slate-300 group-hover:text-emerald-400 transition-colors text-sm">▲</div>
    </button>

    <!-- Main panel (list or chat view) -->
    <transition name="sheet" @before-enter="collapsedReady = false" @after-leave="collapsedReady = true">
      <div v-if="open" class="mt-3 w-[88vw] sm:w-[380px] max-h-[65vh] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 backdrop-blur-xl rounded-t-2xl border border-white/20 border-b-0 shadow-2xl overflow-hidden">
        
        <!-- CONVERSATIONS LIST VIEW -->
        <template v-if="currentView === 'list'">
          <!-- Header clickable whole area -->
          <button @click="toggle" class="w-full text-left flex items-center gap-3 p-4 border-b border-white/10 hover:bg-white/5 transition-colors group">
            <img v-if="user?.avatar_url" :src="user.avatar_url" alt="avatar" class="h-9 w-9 rounded-full ring-2 ring-white/10" />
            <div v-else class="h-9 w-9 rounded-full bg-gradient-to-br from-slate-700 to-slate-600 ring-2 ring-white/10 grid place-items-center text-sm font-semibold text-slate-200">
              {{ ((user?.display_name || user?.email || '?').trim()[0] || '?').toUpperCase() }}
            </div>
            <div class="flex-1">
              <div class="font-bold text-slate-100">Mensajes</div>
              <div class="text-xs text-slate-400">{{ threads.length }} conversaciones</div>
            </div>
            <div class="text-slate-300 group-hover:text-slate-100 transition-colors">▼</div>
          </button>
          
          <!-- Search bar -->
          <div class="px-4 pt-3 pb-3 border-b border-white/10 bg-gradient-to-br from-white/5 to-transparent">
            <div class="relative">
              <input
                v-model="query"
                @input="onSearchInput"
                type="text"
                class="w-full text-sm px-10 py-2.5 rounded-xl bg-black/20 border border-white/10 placeholder:text-slate-400 text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-400/30 transition-all"
                placeholder="Buscar en tus conexiones..."
              />
              <svg class="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zM9.5 14C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
              <button v-if="query" @click="clearSearch" class="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 grid place-items-center text-slate-300 hover:text-slate-100 rounded-full hover:bg-white/10 transition-all" aria-label="Limpiar búsqueda">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-4 w-4"><path d="M18.3 5.71 12 12l6.3 6.29-1.41 1.42L10.59 13.4 4.3 19.71 2.89 18.3 9.17 12 2.89 5.71 4.3 4.29l6.29 6.3 6.3-6.3z"/></svg>
              </button>
            </div>
          </div>
          
          <!-- Scrollable content -->
          <div class="max-h-[48vh] overflow-y-auto">
            <div v-if="loading" class="p-4 text-slate-400 text-sm text-center">Cargando…</div>
            
            <!-- Search results -->
            <template v-if="searching">
              <div v-if="!connsLoaded" class="p-4 text-slate-400 text-sm text-center">Buscando...</div>
              <div v-else-if="filteredFriends.length === 0" class="p-4 text-slate-400 text-sm text-center">Sin resultados</div>
              <ul v-else class="divide-y divide-white/5">
                <li v-for="p in filteredFriends" :key="p.id">
                  <button @click="openChat(p.id)" class="w-full text-left flex items-center gap-3 p-3 hover:bg-gradient-to-r hover:from-emerald-500/5 hover:to-cyan-500/5 transition-all group">
                    <img v-if="p?.avatar_url" :src="p.avatar_url" class="w-10 h-10 rounded-full object-cover ring-2 ring-white/10 group-hover:ring-emerald-400/30 transition-all" alt="avatar" />
                    <div v-else class="w-10 h-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-600 ring-2 ring-white/10 group-hover:ring-emerald-400/30 grid place-items-center text-sm font-semibold text-slate-200 transition-all">
                      {{ ((p?.display_name || p?.email || '?').trim()[0] || '?').toUpperCase() }}
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="text-slate-100 font-medium truncate group-hover:text-white transition-colors">{{ p.display_name || p.email || p.id }}</div>
                      <div class="text-xs text-slate-400 truncate">Conexión</div>
                    </div>
                    <svg class="w-5 h-5 text-slate-400 group-hover:text-emerald-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </li>
              </ul>
            </template>

            <!-- Threads list (default) -->
            <template v-else>
              <div v-if="!threads.length" class="p-8 text-center">
                <div class="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-slate-700/50 to-slate-600/50 grid place-items-center">
                  <svg class="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p class="text-slate-400 text-sm">Sin conversaciones</p>
                <p class="text-slate-500 text-xs mt-1">Usa el buscador para iniciar un chat</p>
              </div>
              <ul v-else class="divide-y divide-white/5">
                <li v-for="t in threads" :key="t.peer_id">
                  <button @click="openChat(t.peer_id)" class="w-full text-left flex items-center gap-3 p-3 hover:bg-gradient-to-r hover:from-emerald-500/5 hover:to-cyan-500/5 transition-all group relative">
                    <img v-if="t.profile?.avatar_url" :src="t.profile.avatar_url" class="w-10 h-10 rounded-full object-cover ring-2 ring-white/10 group-hover:ring-emerald-400/30 transition-all" alt="avatar" />
                    <div v-else class="w-10 h-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-600 ring-2 ring-white/10 group-hover:ring-emerald-400/30 grid place-items-center text-sm font-semibold text-slate-200 transition-all">
                      {{ ((t.profile?.display_name || t.profile?.email || '?').trim()[0] || '?').toUpperCase() }}
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-2 mb-0.5">
                        <div class="text-slate-100 font-medium truncate group-hover:text-white transition-colors">
                          {{ t.profile?.display_name || t.profile?.email || t.peer_id }}
                        </div>
                        <div class="ml-auto text-xs text-slate-400 tabular-nums">
                          {{ formatDayMonth(t.last?.created_at) }}
                        </div>
                      </div>
                      <div class="text-xs text-slate-400 truncate">
                        <span v-if="t.last_from_me" class="font-medium mr-1">Vos:</span>{{ t.last?.content || '' }}
                      </div>
                    </div>
                    <div v-if="t.unread > 0" class="shrink-0 ml-2 h-6 w-6 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 text-white grid place-items-center text-xs font-bold shadow-lg shadow-emerald-500/30">
                      {{ t.unread > 9 ? '9+' : t.unread }}
                    </div>
                  </button>
                </li>
              </ul>
              
              <!-- Load more -->
              <div v-if="!searching && threads.length >= peerLimit" class="p-3 border-t border-white/10 bg-gradient-to-br from-white/5 to-transparent">
                <button @click="peerLimit = Math.min(peerLimit + 50, 500); load()" class="w-full rounded-xl border border-white/15 bg-gradient-to-r from-white/5 to-transparent hover:from-emerald-500/10 hover:to-cyan-500/10 hover:border-emerald-400/30 text-slate-100 text-sm py-2.5 font-medium transition-all">
                  Cargar más conversaciones
                </button>
              </div>
              
              <!-- Suggestions -->
              <div v-if="!searching && newContactsSuggestions.length" class="p-3 border-t border-white/10 bg-gradient-to-br from-white/5 to-transparent">
                <div class="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">Nuevos contactos</div>
                <div class="grid grid-cols-2 gap-2">
                  <button v-for="p in newContactsSuggestions" :key="p.id" @click="openChat(p.id)" class="flex items-center gap-2 p-2 rounded-xl hover:bg-gradient-to-r hover:from-emerald-500/10 hover:to-cyan-500/10 border border-transparent hover:border-emerald-400/20 transition-all group">
                    <img v-if="p?.avatar_url" :src="p.avatar_url" class="w-8 h-8 rounded-full object-cover ring-2 ring-white/10 group-hover:ring-emerald-400/30 transition-all" alt="avatar" />
                    <div v-else class="w-8 h-8 rounded-full bg-gradient-to-br from-slate-700 to-slate-600 ring-2 ring-white/10 group-hover:ring-emerald-400/30 grid place-items-center text-xs font-semibold text-slate-200 transition-all">
                      {{ ((p?.display_name || p?.email || '?').trim()[0] || '?').toUpperCase() }}
                    </div>
                    <div class="min-w-0 text-left">
                      <div class="text-xs font-medium text-slate-100 truncate group-hover:text-white transition-colors">{{ p.display_name || p.email || p.id }}</div>
                      <div class="text-[10px] text-slate-400 truncate">Conectar</div>
                    </div>
                  </button>
                </div>
              </div>
            </template>
          </div>
        </template>

        <!-- INDIVIDUAL CHAT VIEW -->
        <template v-else-if="currentView === 'chat'">
          <!-- Chat header with back button -->
          <div class="flex items-center gap-3 p-3 border-b border-white/10 bg-gradient-to-r from-white/5 to-transparent">
            <button @click="backToList" class="rounded-xl h-9 w-9 grid place-items-center hover:bg-gradient-to-br hover:from-emerald-500/10 hover:to-cyan-500/10 border border-transparent hover:border-emerald-400/20 transition-all" aria-label="Volver a lista">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-5 w-5 text-slate-300">
                <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
              </svg>
            </button>
            <img v-if="activePeer?.avatar_url" :src="activePeer.avatar_url" alt="avatar" class="h-9 w-9 rounded-full ring-2 ring-white/10" />
            <div v-else class="h-9 w-9 rounded-full bg-gradient-to-br from-slate-700 to-slate-600 ring-2 ring-white/10 grid place-items-center text-sm font-semibold text-slate-200">
              {{ ((activePeer?.display_name || activePeer?.email || '?').trim()[0] || '?').toUpperCase() }}
            </div>
            <div class="font-bold text-slate-100 truncate flex-1">
              {{ activePeer.display_name || activePeer.email || 'usuario' }}
            </div>
          </div>
          
          <!-- Messages container -->
          <div class="flex flex-col h-[48vh]">
            <div class="flex-1 overflow-y-auto p-3 bg-gradient-to-br from-black/10 to-transparent" ref="chatContainer">
              <div v-if="chatLoading" class="text-slate-400 text-sm text-center py-8">Cargando mensajes…</div>
              <ol v-else class="relative flex flex-col gap-2 items-start">
                <li v-for="m in messages" :key="m.id" :class="['w-fit max-w-[85%] rounded-2xl px-4 py-2 text-slate-100 shadow-lg border backdrop-blur-sm', isOwn(m) ? 'ml-auto bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border-emerald-400/40' : 'bg-gradient-to-br from-slate-800/80 to-slate-700/80 border-white/20']">
                  <div class="whitespace-pre-line break-words text-sm">{{ m.content }}</div>
                  <div class="mt-1 text-[11px] text-slate-400 flex items-center gap-1" :class="isOwn(m) ? 'justify-end' : 'justify-start'">
                    <span>{{ formatShortDate(m.created_at) }}</span>
                    <span v-if="isOwn(m)" class="inline-flex items-center">
                      <svg v-if="m.failed" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-3.5 w-3.5 text-red-400 ml-1"><path d="M11 7h2v6h-2zm0 8h2v2h-2z"/></svg>
                      <svg v-else-if="m.optimistic" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-3.5 w-3.5 text-slate-400/70 ml-1"><path d="M12 1a11 11 0 1 0 11 11A11.012 11.012 0 0 0 12 1zm1 11H7V10h4V5h2z"/></svg>
                      <svg v-else-if="m.read" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-3.5 w-3.5 text-emerald-400 ml-1"><path d="M9 16l-5-5 1.41-1.41L9 13.17l9.59-9.59L20 5z"/></svg>
                      <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-3.5 w-3.5 text-slate-400 ml-1"><path d="M9 16l-5-5 1.41-1.41L9 13.17l9.59-9.59L20 5z"/></svg>
                    </span>
                  </div>
                </li>
              </ol>
            </div>
            
            <!-- Message input -->
            <form action="#" @submit.prevent="handleSubmit" class="p-3 bg-gradient-to-br from-slate-900/90 to-slate-800/90 border-t border-white/10 backdrop-blur-sm">
              <div class="flex items-center gap-2">
                <div class="flex-1 flex items-center gap-2 rounded-full border border-white/15 bg-black/20 pl-4 pr-2 py-2 focus-within:ring-2 focus-within:ring-emerald-400/30 focus-within:border-emerald-400/30 transition-all">
                  <input v-model="newMessage.content" type="text" placeholder="Escribe un mensaje..." class="flex-1 bg-transparent outline-none text-slate-100 placeholder-slate-400 text-sm" @keydown.enter.exact.prevent="handleSubmit" />
                  <button type="submit" class="shrink-0 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110 text-white h-9 w-9 grid place-items-center shadow-lg shadow-emerald-500/30 transition-all hover:scale-105 active:scale-95">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-5 w-5"><path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </template>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.sheet-enter-active, .sheet-leave-active { transition: transform .2s ease, opacity .2s ease; }
.sheet-enter-from { transform: translateY(8px); opacity: 0; }
.sheet-leave-to { transform: translateY(16px); opacity: 0; }
</style>
