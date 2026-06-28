<script>
/**
 * FRIENDS DOCK — barra de amigos estilo LoL (presencia + chat integrado).
 *
 * Reemplaza al viejo DirectMessagesDock: unifica todo a la derecha.
 *  - Riel angosto (semi-oculto) en el borde derecho con los amigos en línea.
 *  - Panel expandido con la lista completa (en línea arriba, desconectados abajo).
 *  - Chat 1-a-1 integrado (mismo flujo de DMs que tenía el dock).
 *  - Estado en vivo vía services/presence.js: 🎮 jugando [juego] / 🟢 en línea / ⚫ offline.
 */
import { subscribeToAuthStateChanges } from '../services/auth'
import { listConnections } from '../services/connections'
import { getPublicProfilesByIds, getPublicProfile } from '../services/user-profiles'
import { getEquippedCosmeticsBatch, frameStyle, iconBgStyle } from '../services/cosmetics'
import { presenceState } from '../services/presence'
import { friendlyNameForSlug } from '../services/games'
import {
  fetchRecentConversations, fetchConversation, sendDirectMessage,
  subscribeConversation, markConversationRead,
} from '../services/direct-messages'
import { formatShortDate } from '../services/formatters'
import { supabase } from '../services/supabase'
import { pushErrorToast } from '../stores/notifications'
import CosmeticIcon from './rewards/CosmeticIcon.vue'

let unsubscribeAuth = () => {}
let unsubscribeDM = () => {}

export default {
  name: 'FriendsDock',
  components: { CosmeticIcon },
  data() {
    return {
      user: { id: null, email: null, avatar_url: null, display_name: null },
      expanded: false,     // desktop: riel ↔ panel
      mobileOpen: false,   // mobile: drawer
      view: 'list',        // 'list' | 'chat'
      query: '',
      friends: [],         // perfiles de conexiones aceptadas
      threads: [],         // fetchRecentConversations → no leídos + último msg
      cos: {},             // cosméticos equipados por id (avatar)
      loaded: false,
      loading: false,
      // Chat
      activePeerId: null,
      activePeer: { id: null, display_name: null, email: null, avatar_url: null },
      messages: [],
      newMessage: { content: '' },
      chatLoading: false,
      // Realtime
      _rtChannel: null,
      _notifInterval: null,
      _debounceTimer: null,
    }
  },
  computed: {
    presence() { return presenceState.value },
    baseRows() {
      const th = {}
      for (const t of (this.threads || [])) th[t.peer_id] = t
      return (this.friends || []).map(f => {
        const p = this.presence[f.id]
        const status = p ? (p.game ? 'playing' : 'online') : 'offline'
        const t = th[f.id]
        return {
          id: f.id,
          name: f.display_name || f.email || 'Usuario',
          avatar_url: f.avatar_url,
          status,
          game: p?.game || null,
          gameName: p?.game ? friendlyNameForSlug(p.game) : '',
          unread: t?.unread || 0,
          lastText: t?.last?.content || '',
          lastFromMe: !!t?.last_from_me,
        }
      })
    },
    filteredRows() {
      const q = (this.query || '').trim().toLowerCase()
      const rows = this.baseRows
      return q ? rows.filter(r => r.name.toLowerCase().includes(q)) : rows
    },
    onlineRows() {
      const rank = { playing: 0, online: 1 }
      return this.filteredRows.filter(r => r.status !== 'offline')
        .sort((a, b) => (rank[a.status] - rank[b.status]) || (b.unread - a.unread) || a.name.localeCompare(b.name))
    },
    offlineRows() {
      return this.filteredRows.filter(r => r.status === 'offline')
        .sort((a, b) => (b.unread - a.unread) || a.name.localeCompare(b.name))
    },
    railRows() { return this.onlineRows.slice(0, 30) },
    onlineCount() { return this.baseRows.filter(r => r.status !== 'offline').length },
    totalUnread() { return this.baseRows.reduce((s, r) => s + (r.unread || 0), 0) },
    activePresence() {
      const p = this.presence[this.activePeerId]
      if (!p) return { label: 'Desconectado', dot: 'bg-slate-500' }
      if (p.game) return { label: 'Jugando · ' + friendlyNameForSlug(p.game), dot: 'bg-cyan-400' }
      return { label: 'En línea', dot: 'bg-emerald-400' }
    },
  },
  methods: {
    formatShortDate,
    frameStyle,
    iconBgStyle,
    initial(r) { return ((r?.name || r?.display_name || r?.email || '?').trim()[0] || '?').toUpperCase() },
    gameCover(slug) { return slug ? `/games/${slug}.svg` : '' },
    statusDot(status) {
      if (status === 'playing') return 'bg-cyan-400'
      if (status === 'online') return 'bg-emerald-400'
      return 'bg-slate-500'
    },
    statusRing(status) {
      if (status === 'playing') return 'ring-cyan-400/70'
      if (status === 'online') return 'ring-emerald-400/70'
      return 'ring-white/10'
    },
    // ── UI toggles ──
    toggleExpand() {
      this.expanded = !this.expanded
      if (this.expanded) { this.view = 'list'; this.refresh() }
      try { localStorage.setItem('gl:friendsbar', this.expanded ? '1' : '0') } catch {}
    },
    toggleMobile() {
      this.mobileOpen = !this.mobileOpen
      if (this.mobileOpen) { this.view = 'list'; this.refresh() }
      else if (this.view === 'chat') { this.view = 'list'; this.detachChatRealtime() }
    },
    closePanel() {
      this.expanded = false
      this.mobileOpen = false
      if (this.view === 'chat') { this.view = 'list'; this.detachChatRealtime() }
      try { localStorage.setItem('gl:friendsbar', '0') } catch {}
    },
    // ── Data ──
    async refresh() {
      if (this._debounceTimer) clearTimeout(this._debounceTimer)
      this._debounceTimer = setTimeout(() => this._doRefresh(), 80)
    },
    async _doRefresh() {
      if (!this.user?.id || this.loading) return
      this.loading = true
      try {
        const { data: conns } = await listConnections()
        const ids = (conns || []).map(r => r.user_a === this.user.id ? r.user_b : r.user_a).filter(Boolean)
        if (!ids.length) { this.friends = []; this.cos = {}; this.threads = []; this.loaded = true; return }
        const [{ data: profiles }, cos] = await Promise.all([
          getPublicProfilesByIds(ids),
          getEquippedCosmeticsBatch(ids).catch(() => ({})),
        ])
        this.friends = profiles || []
        this.cos = cos || {}
        await this.loadThreads()
        this.loaded = true
      } finally {
        this.loading = false
      }
    },
    async loadThreads() {
      try {
        const { data } = await fetchRecentConversations(50)
        this.threads = data || []
      } catch { /* noop */ }
    },
    // ── Chat ──
    async openChat(peerId) {
      const row = this.baseRows.find(r => r.id === peerId)
      if (row) row.unread = 0
      const t = this.threads.find(x => x.peer_id === peerId)
      if (t) t.unread = 0
      this.expanded = true
      this.view = 'chat'
      this.activePeerId = peerId
      this.query = ''
      await this.loadPeerProfile(peerId)
      await this.loadConversation()
      this.attachChatRealtime()
    },
    backToList() {
      this.view = 'list'
      this.activePeerId = null
      this.activePeer = { id: null }
      this.messages = []
      this.newMessage.content = ''
      this.detachChatRealtime()
      this.loadThreads()
    },
    async loadPeerProfile(id) {
      try { const { data } = await getPublicProfile(id); this.activePeer = data ? { ...data, id } : { id } }
      catch { this.activePeer = { id } }
    },
    async loadConversation() {
      this.chatLoading = true
      try {
        const { data } = await fetchConversation(this.activePeerId)
        this.messages = data || []
        await this.$nextTick()
        this.scrollChatToBottom()
        await markConversationRead(this.activePeerId)
      } finally { this.chatLoading = false }
    },
    scrollChatToBottom() {
      const el = this.$refs.chatContainer
      if (el) el.scrollTop = el.scrollHeight
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
            this.messages.push(row)
          }
          await this.$nextTick()
          this.scrollChatToBottom()
          if (row.recipient_id === this.user.id) { try { await markConversationRead(peerId) } catch {} }
        },
        onUpdate: (row) => {
          const i = this.messages.findIndex(m => m.id === row.id)
          if (i !== -1) this.messages[i] = { ...this.messages[i], ...row }
        },
      })
    },
    detachChatRealtime() { if (unsubscribeDM) { try { unsubscribeDM() } catch {} } },
    isOwn(m) { return !!m && (m.sender_id === this.user.id || m.email === this.user.email) },
    async handleSubmit() {
      const raw = this.newMessage.content || ''
      const trimmed = raw.replace(/\s+$/g, '')
      if (trimmed.trim().length === 0) return
      const temp = {
        id: `temp-${Date.now()}`, sender_id: this.user.id, recipient_id: this.activePeer.id,
        content: trimmed, created_at: new Date().toISOString(), read: false, optimistic: true, failed: false,
      }
      this.messages.push(temp)
      await this.$nextTick()
      this.scrollChatToBottom()
      this.newMessage.content = ''
      try { await sendDirectMessage(this.activePeer.id, trimmed) }
      catch (e) {
        const idx = this.messages.findIndex(m => m.id === temp.id)
        if (idx !== -1) this.messages[idx].failed = true
        try { pushErrorToast(e?.message || 'No se pudo enviar el mensaje') } catch {}
      }
    },
    setupDmRealtime() {
      if (!this.user?.id) return
      try { this._rtChannel?.unsubscribe?.() } catch {}
      const ch = supabase.channel(`friends-dm:${this.user.id}`)
      ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `recipient_id=eq.${this.user.id}` }, () => this.loadThreads())
      ch.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'direct_messages', filter: `recipient_id=eq.${this.user.id}` }, () => this.loadThreads())
      ch.subscribe()
      this._rtChannel = ch
      try { clearInterval(this._notifInterval) } catch {}
      this._notifInterval = setInterval(() => this.loadThreads(), 30000)
    },
  },
  async mounted() {
    try { this.expanded = localStorage.getItem('gl:friendsbar') === '1' } catch {}
    unsubscribeAuth = subscribeToAuthStateChanges(async (u) => {
      this.user = u || { id: null }
      if (this.user?.id) { await this._doRefresh(); this.setupDmRealtime() }
      else { this.friends = []; this.threads = []; this.cos = {} }
    })
  },
  unmounted() {
    try { unsubscribeAuth() } catch {}
    try { this._rtChannel?.unsubscribe?.() } catch {}
    try { clearInterval(this._notifInterval) } catch {}
    if (this._debounceTimer) clearTimeout(this._debounceTimer)
    this.detachChatRealtime()
  },
}
</script>

<template>
  <div v-if="user?.id">
    <!-- ───────── Mobile: botón flotante ───────── -->
    <button @click="toggleMobile"
      class="sm:hidden fixed bottom-5 right-4 z-40 h-14 w-14 rounded-full grid place-items-center bg-gradient-to-br from-emerald-500 to-cyan-500 text-white shadow-2xl shadow-emerald-500/40 border border-white/20 hover:brightness-110 transition active:scale-95">
      <svg v-if="!mobileOpen" viewBox="0 0 24 24" fill="currentColor" class="h-6 w-6"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
      <svg v-else viewBox="0 0 24 24" fill="currentColor" class="h-6 w-6"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
      <span v-if="totalUnread > 0" class="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold grid place-items-center border border-white/20">{{ totalUnread > 9 ? '9+' : totalUnread }}</span>
    </button>

    <!-- ───────── Desktop: riel (semi-oculto) ───────── -->
    <div v-show="!expanded" class="hidden sm:flex fixed top-24 right-0 bottom-6 z-40 w-[68px] flex-col items-center rounded-l-2xl border border-r-0 border-white/12 bg-gradient-to-b from-slate-900/95 to-slate-950/95 backdrop-blur-xl shadow-2xl">
      <button @click="toggleExpand" title="Amigos" class="relative w-full py-3 grid place-items-center text-slate-300 hover:text-white border-b border-white/10 transition">
        <svg viewBox="0 0 24 24" fill="currentColor" class="h-6 w-6"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
        <span class="absolute top-1.5 right-2 text-[10px] font-bold text-emerald-400 tabular-nums">{{ onlineCount }}</span>
        <span v-if="totalUnread > 0" class="absolute bottom-1.5 right-2 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold grid place-items-center">{{ totalUnread > 9 ? '9+' : totalUnread }}</span>
      </button>

      <div class="flex-1 w-full overflow-y-auto py-2 flex flex-col items-center gap-2.5 rail-scroll">
        <button v-for="r in railRows" :key="r.id" @click="openChat(r.id)" :title="r.status === 'playing' ? ('Jugando · ' + r.gameName) : (r.status === 'online' ? 'En línea' : 'Desconectado')" class="relative group">
          <div :class="['rounded-full ring-2 transition-transform group-hover:scale-110', statusRing(r.status)]">
            <div :class="[frameStyle(cos[r.id]?.frameKey || 'none').wrap, frameStyle(cos[r.id]?.frameKey || 'none').pad, 'rounded-full']">
              <div class="size-10 rounded-full overflow-hidden grid place-items-center text-xs font-bold text-white" :class="iconBgStyle(cos[r.id]?.iconBg || 'emerald')">
                <CosmeticIcon v-if="cos[r.id]?.iconGlyph" :iconKey="cos[r.id].iconGlyph" :size="26" />
                <img v-else-if="r.avatar_url" :src="r.avatar_url" class="w-full h-full object-cover" alt="" />
                <span v-else>{{ initial(r) }}</span>
              </div>
            </div>
          </div>
          <span class="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-slate-950" :class="statusDot(r.status)"></span>
          <span v-if="r.unread > 0" class="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold grid place-items-center">{{ r.unread > 9 ? '9+' : r.unread }}</span>
        </button>
      </div>
    </div>

    <!-- ───────── Panel (desktop expandido / mobile drawer) ───────── -->
    <transition name="panel">
      <div v-if="expanded || mobileOpen"
        :class="mobileOpen ? 'flex' : 'hidden sm:flex'"
        class="fixed z-40 bottom-0 right-0 w-[92vw] max-w-[380px] h-[72vh] rounded-t-2xl
               sm:top-24 sm:bottom-6 sm:h-auto sm:w-[340px] sm:rounded-2xl sm:rounded-r-none
               flex-col overflow-hidden border border-white/12 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 backdrop-blur-xl shadow-2xl">

        <!-- ===== Vista LISTA ===== -->
        <template v-if="view === 'list'">
          <div class="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-white/[0.03]">
            <span class="grid place-items-center h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-400/20">
              <svg viewBox="0 0 24 24" fill="currentColor" class="h-4.5 w-4.5 text-emerald-300"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
            </span>
            <div class="flex-1 min-w-0">
              <div class="font-display font-bold text-white leading-tight">Amigos</div>
              <div class="text-[11px] text-emerald-400 font-medium">{{ onlineCount }} en línea</div>
            </div>
            <button @click="closePanel" class="h-8 w-8 grid place-items-center rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition" title="Ocultar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5"><path d="M9 6l6 6-6 6"/></svg>
            </button>
          </div>

          <div class="px-3 py-2.5 border-b border-white/10">
            <div class="relative">
              <input v-model="query" type="text" placeholder="Buscar amigo…" class="w-full text-sm pl-9 pr-3 py-2 rounded-xl bg-black/30 border border-white/10 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-400/30 transition" />
              <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-500" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zM9.5 14C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
            </div>
          </div>

          <div class="flex-1 overflow-y-auto rail-scroll">
            <div v-if="loading && !loaded" class="p-6 text-center text-slate-400 text-sm">Cargando…</div>
            <div v-else-if="!baseRows.length" class="p-8 text-center">
              <div class="text-3xl mb-2">🤝</div>
              <p class="text-slate-300 text-sm font-medium">Todavía no tenés amigos</p>
              <p class="text-slate-500 text-xs mt-1">Conectá con jugadores desde sus perfiles</p>
            </div>
            <template v-else>
              <!-- En línea -->
              <div v-if="onlineRows.length" class="px-3 pt-3 pb-1 text-[10px] uppercase tracking-wider font-bold text-emerald-400/80">En línea — {{ onlineRows.length }}</div>
              <button v-for="r in onlineRows" :key="r.id" @click="openChat(r.id)" class="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition text-left group">
                <div class="relative shrink-0">
                  <div :class="[frameStyle(cos[r.id]?.frameKey || 'none').wrap, frameStyle(cos[r.id]?.frameKey || 'none').pad, 'rounded-full']">
                    <div class="size-10 rounded-full overflow-hidden grid place-items-center text-xs font-bold text-white" :class="iconBgStyle(cos[r.id]?.iconBg || 'emerald')">
                      <CosmeticIcon v-if="cos[r.id]?.iconGlyph" :iconKey="cos[r.id].iconGlyph" :size="26" />
                      <img v-else-if="r.avatar_url" :src="r.avatar_url" class="w-full h-full object-cover" alt="" />
                      <span v-else>{{ initial(r) }}</span>
                    </div>
                  </div>
                  <span class="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-slate-900" :class="statusDot(r.status)"></span>
                </div>
                <div class="min-w-0 flex-1">
                  <div class="text-sm font-semibold text-white truncate">{{ r.name }}</div>
                  <div v-if="r.status === 'playing'" class="flex items-center gap-1.5 text-[11px] text-cyan-300 truncate">
                    <img :src="gameCover(r.game)" class="h-3.5 w-3.5 rounded-sm" alt="" />
                    <span class="truncate">Jugando · {{ r.gameName }}</span>
                  </div>
                  <div v-else class="text-[11px] text-emerald-400/90">En línea</div>
                </div>
                <span v-if="r.unread > 0" class="shrink-0 min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold grid place-items-center">{{ r.unread > 9 ? '9+' : r.unread }}</span>
              </button>

              <!-- Desconectados -->
              <div v-if="offlineRows.length" class="px-3 pt-4 pb-1 text-[10px] uppercase tracking-wider font-bold text-slate-500">Desconectados — {{ offlineRows.length }}</div>
              <button v-for="r in offlineRows" :key="r.id" @click="openChat(r.id)" class="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition text-left opacity-60 hover:opacity-100">
                <div class="relative shrink-0">
                  <div class="size-10 rounded-full overflow-hidden grid place-items-center text-xs font-bold text-white grayscale" :class="iconBgStyle(cos[r.id]?.iconBg || 'slate')">
                    <CosmeticIcon v-if="cos[r.id]?.iconGlyph" :iconKey="cos[r.id].iconGlyph" :size="26" />
                    <img v-else-if="r.avatar_url" :src="r.avatar_url" class="w-full h-full object-cover" alt="" />
                    <span v-else>{{ initial(r) }}</span>
                  </div>
                  <span class="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-slate-900 bg-slate-500"></span>
                </div>
                <div class="min-w-0 flex-1">
                  <div class="text-sm font-medium text-slate-300 truncate">{{ r.name }}</div>
                  <div class="text-[11px] text-slate-500">Desconectado</div>
                </div>
                <span v-if="r.unread > 0" class="shrink-0 min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold grid place-items-center">{{ r.unread > 9 ? '9+' : r.unread }}</span>
              </button>
            </template>
          </div>
        </template>

        <!-- ===== Vista CHAT ===== -->
        <template v-else>
          <div class="flex items-center gap-2.5 px-3 py-3 border-b border-white/10 bg-white/[0.03]">
            <button @click="backToList" class="h-8 w-8 grid place-items-center rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition" title="Volver">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <router-link :to="`/u/${activePeer.id}`" class="relative shrink-0">
              <div class="size-9 rounded-full overflow-hidden grid place-items-center text-xs font-bold text-white" :class="iconBgStyle(cos[activePeerId]?.iconBg || 'emerald')">
                <CosmeticIcon v-if="cos[activePeerId]?.iconGlyph" :iconKey="cos[activePeerId].iconGlyph" :size="24" />
                <img v-else-if="activePeer.avatar_url" :src="activePeer.avatar_url" class="w-full h-full object-cover" alt="" />
                <span v-else>{{ initial({ name: activePeer.display_name || activePeer.email }) }}</span>
              </div>
              <span class="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-slate-900" :class="activePresence.dot"></span>
            </router-link>
            <div class="min-w-0 flex-1">
              <div class="font-bold text-white truncate leading-tight">{{ activePeer.display_name || activePeer.email || 'Usuario' }}</div>
              <div class="text-[11px] text-slate-400 truncate">{{ activePresence.label }}</div>
            </div>
            <button @click="closePanel" class="h-8 w-8 grid place-items-center rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition" title="Ocultar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5"><path d="M9 6l6 6-6 6"/></svg>
            </button>
          </div>

          <div ref="chatContainer" class="flex-1 overflow-y-auto p-3 bg-black/10 rail-scroll">
            <div v-if="chatLoading" class="text-center text-slate-400 text-sm py-8">Cargando…</div>
            <ol v-else class="flex flex-col gap-2 items-start">
              <li v-for="m in messages" :key="m.id" :class="['w-fit max-w-[85%] rounded-2xl px-3.5 py-2 text-slate-100 border', isOwn(m) ? 'ml-auto bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border-emerald-400/40' : 'bg-slate-800/80 border-white/15']">
                <div class="whitespace-pre-line break-words text-sm">{{ m.content }}</div>
                <div class="mt-0.5 text-[10px] text-slate-400 flex items-center gap-1" :class="isOwn(m) ? 'justify-end' : 'justify-start'">
                  <span>{{ formatShortDate(m.created_at) }}</span>
                  <span v-if="isOwn(m) && m.failed" class="text-rose-400">⚠</span>
                  <span v-else-if="isOwn(m) && m.optimistic" class="text-slate-400/70">·</span>
                  <span v-else-if="isOwn(m) && m.read" class="text-emerald-400">✓✓</span>
                  <span v-else-if="isOwn(m)" class="text-slate-400">✓</span>
                </div>
              </li>
            </ol>
          </div>

          <form @submit.prevent="handleSubmit" class="p-2.5 border-t border-white/10 bg-slate-900/80">
            <div class="flex items-center gap-2 rounded-full border border-white/15 bg-black/30 pl-4 pr-1.5 py-1.5 focus-within:ring-2 focus-within:ring-emerald-400/30 focus-within:border-emerald-400/30 transition">
              <input v-model="newMessage.content" type="text" placeholder="Escribí un mensaje…" class="flex-1 bg-transparent outline-none text-slate-100 placeholder-slate-500 text-sm" @keydown.enter.exact.prevent="handleSubmit" />
              <button type="submit" class="shrink-0 h-8 w-8 grid place-items-center rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:brightness-110 transition active:scale-95">
                <svg viewBox="0 0 24 24" fill="currentColor" class="h-4.5 w-4.5"><path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z"/></svg>
              </button>
            </div>
          </form>
        </template>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.panel-enter-active, .panel-leave-active { transition: transform .22s ease, opacity .22s ease; }
.panel-enter-from, .panel-leave-to { transform: translateX(12px); opacity: 0; }
.rail-scroll::-webkit-scrollbar { width: 6px; }
.rail-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,.12); border-radius: 9999px; }
.rail-scroll::-webkit-scrollbar-track { background: transparent; }
</style>
