<script>
/**
 * SIDEBAR SOCIAL — barra ESTÁTICA a la derecha, estilo LoL (hub de juego).
 *
 *  - Desktop (lg+): SIEMPRE visible, ancla a la derecha, altura completa. NO se
 *    esconde ni se contrae (integrada a la app). El contenido reserva su ancho
 *    en App.vue (.with-sidebar) → nada queda por debajo.
 *  - Arriba de todo: MI perfil (avatar equipado + nivel/XP + acciones). El avatar
 *    lleva al perfil (con hover que lo deja claro).
 *  - Debajo: mis amigos (jugando → en línea → desconectados) con presencia en vivo.
 *  - Chat 1-a-1 integrado.
 *  - Abajo de todo: accesos rápidos (Desafíos, Reportar bug).
 *  - Mobile (<lg): botón flotante → drawer con el mismo contenido.
 */
import { subscribeToAuthStateChanges, logout } from '../services/auth'
import { listConnections } from '../services/connections'
import { getPublicProfilesByIds, getPublicProfile } from '../services/user-profiles'
import { getEquippedCosmeticsBatch, getEquippedCosmetics, rarity } from '../services/cosmetics'
import { presenceState } from '../services/presence'
import { friendlyNameForSlug } from '../services/games'
import { getUserLevel, computeProgressPercentSync, fetchLevelThresholds } from '../services/xp'
import { isAdmin } from '../services/admin'
import { submitBugReport } from '../services/feedback'
import {
  fetchRecentConversations, fetchConversation, sendDirectMessage,
  subscribeConversation, markConversationRead,
} from '../services/direct-messages'
import { formatShortDate } from '../services/formatters'
import { supabase } from '../services/supabase'
import { pushErrorToast, pushSuccessToast } from '../stores/notifications'
import { playNotifySound } from '../services/sounds'
import { setSidebarUser } from '../stores/sidebar'
import UserAvatar from './common/UserAvatar.vue'
import ChallengesModal from './rewards/ChallengesModal.vue'

let unsubscribeAuth = () => {}
let unsubscribeDM = () => {}

export default {
  name: 'FriendsDock',
  components: { UserAvatar, ChallengesModal },
  data() {
    return {
      user: { id: null, email: null, avatar_url: null, display_name: null },
      mobileOpen: false,   // mobile: drawer
      view: 'list',        // 'list' | 'chat'
      query: '',
      friends: [],
      threads: [],
      cos: {},
      loaded: false,
      loading: false,
      // Mi perfil (bloque superior)
      selfCos: { frameKey: 'none', iconGlyph: '', iconBg: 'emerald', titleText: '', titleRarity: 'common', framePremium: false, titlePremium: false },
      levelInfo: null,
      isAdminUser: false,
      // Reportar bug
      bugOpen: false,
      bugMsg: '',
      bugContact: '',
      bugBusy: false,
      // Objetivos (desafíos) popup
      challengesOpen: false,
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
    selfName() { return this.user?.display_name || this.user?.email || 'Jugador' },
    selfInitial() { return (this.selfName.trim()[0] || '?').toUpperCase() },
    selfTitleClass() { return this.selfCos?.titlePremium ? 'title-premium-anim' : rarity(this.selfCos?.titleRarity).text },
    level() { return this.levelInfo?.level ?? 1 },
    xpNow() { return this.levelInfo?.xp_total ?? 0 },
    levelPct() { return computeProgressPercentSync(this.levelInfo) || 0 },
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
        }
      })
    },
    filteredRows() {
      const q = (this.query || '').trim().toLowerCase()
      const rows = this.baseRows
      return q ? rows.filter(r => r.name.toLowerCase().includes(q)) : rows
    },
    sortedRows() {
      const rank = { playing: 0, online: 1, offline: 2 }
      return this.filteredRows.slice().sort((a, b) =>
        (rank[a.status] - rank[b.status]) || (b.unread - a.unread) || a.name.localeCompare(b.name))
    },
    onlineRows() { return this.sortedRows.filter(r => r.status !== 'offline') },
    offlineRows() { return this.sortedRows.filter(r => r.status === 'offline') },
    totalUnread() { return this.baseRows.reduce((s, r) => s + (r.unread || 0), 0) },
    onlineCount() { return this.baseRows.filter(r => r.status !== 'offline').length },
    activePresence() {
      const p = this.presence[this.activePeerId]
      if (!p) return { label: 'Desconectado', dot: 'bg-slate-500' }
      if (p.game) return { label: 'Jugando · ' + friendlyNameForSlug(p.game), dot: 'bg-cyan-400' }
      return { label: 'En línea', dot: 'bg-emerald-400' }
    },
  },
  methods: {
    formatShortDate,
    initial(r) { return ((r?.name || r?.display_name || r?.email || '?').trim()[0] || '?').toUpperCase() },
    avatarPropsFor(r) {
      const c = this.cos[r.id] || {}
      return {
        avatarUrl: r.avatar_url || '',
        initial: this.initial(r),
        frameKey: c.frameKey || 'none',
        iconGlyph: c.iconGlyph || '',
        iconBg: c.iconBg || 'emerald',
      }
    },
    statusDot(status) {
      if (status === 'playing') return 'bg-cyan-400'
      if (status === 'online') return 'bg-emerald-400'
      return 'bg-slate-500'
    },
    toggleMobile() {
      this.mobileOpen = !this.mobileOpen
      if (this.mobileOpen) { this.view = 'list'; this.refresh() }
      else if (this.view === 'chat') { this.view = 'list'; this.detachChatRealtime() }
    },
    closeMobile() {
      this.mobileOpen = false
      if (this.view === 'chat') { this.view = 'list'; this.detachChatRealtime() }
    },
    async doLogout() {
      try { await logout() } catch {}
      this.$router.push('/login')
    },
    async submitBug() {
      if (this.bugBusy) return
      this.bugBusy = true
      const res = await submitBugReport({ message: this.bugMsg, contact: this.bugContact })
      this.bugBusy = false
      if (res.ok) {
        pushSuccessToast('¡Gracias! Reporte enviado')
        this.bugOpen = false; this.bugMsg = ''; this.bugContact = ''
      } else {
        pushErrorToast(res.error || 'No se pudo enviar el reporte')
      }
    },
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
    async loadSelf() {
      if (!this.user?.id) return
      try { const e = await getEquippedCosmetics(this.user.id); if (e) this.selfCos = e } catch {}
      try {
        await fetchLevelThresholds()
        const { data, error } = await getUserLevel(null)
        if (!error) this.levelInfo = Array.isArray(data) ? data[0] : data
      } catch {}
      try { this.isAdminUser = await isAdmin() } catch { this.isAdminUser = false }
    },
    async loadThreads() {
      try { const { data } = await fetchRecentConversations(50); this.threads = data || [] } catch {}
    },
    async openChat(peerId) {
      const row = this.baseRows.find(r => r.id === peerId)
      if (row) row.unread = 0
      const t = this.threads.find(x => x.peer_id === peerId)
      if (t) t.unread = 0
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
    scrollChatToBottom() { const el = this.$refs.chatContainer; if (el) el.scrollTop = el.scrollHeight },
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
      ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `recipient_id=eq.${this.user.id}` }, () => { try { playNotifySound() } catch {}; this.loadThreads() })
      ch.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'direct_messages', filter: `recipient_id=eq.${this.user.id}` }, () => this.loadThreads())
      ch.subscribe()
      this._rtChannel = ch
      try { clearInterval(this._notifInterval) } catch {}
      this._notifInterval = setInterval(() => this.loadThreads(), 30000)
    },
  },
  async mounted() {
    unsubscribeAuth = subscribeToAuthStateChanges(async (u) => {
      this.user = u || { id: null }
      setSidebarUser(!!this.user?.id)
      if (this.user?.id) { await this._doRefresh(); this.loadSelf(); this.setupDmRealtime() }
      else { this.friends = []; this.threads = []; this.cos = {}; this.levelInfo = null }
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
      class="lg:hidden fixed bottom-5 right-4 z-40 h-14 w-14 rounded-full grid place-items-center bg-gradient-to-br from-emerald-500 to-cyan-500 text-white shadow-2xl shadow-emerald-500/40 border border-white/20 hover:brightness-110 transition active:scale-95">
      <svg v-if="!mobileOpen" viewBox="0 0 24 24" fill="currentColor" class="h-6 w-6"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
      <svg v-else viewBox="0 0 24 24" fill="currentColor" class="h-6 w-6"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
      <span v-if="totalUnread > 0" class="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold grid place-items-center border border-white/20">{{ totalUnread > 9 ? '9+' : totalUnread }}</span>
    </button>

    <!-- ───────── Barra (desktop estática / mobile drawer) ───────── -->
    <div :class="mobileOpen ? 'flex' : 'hidden lg:flex'"
      class="fixed z-40 bottom-0 right-0 w-[86vw] max-w-[340px] h-[82vh] rounded-t-2xl
             lg:top-0 lg:bottom-0 lg:h-auto lg:w-[300px] lg:rounded-none lg:max-w-none
             flex-col overflow-hidden border-l border-white/10 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 backdrop-blur-xl shadow-2xl">

      <!-- ===== MI PERFIL (arriba de todo) ===== -->
      <div class="shrink-0 px-3 pt-3.5 pb-3 border-b border-white/10 bg-gradient-to-b from-white/[0.05] to-transparent">
        <div class="flex items-center gap-2.5">
          <router-link to="/profile" @click="closeMobile" class="group relative shrink-0" title="Ver mi perfil">
            <UserAvatar :size="46" :avatar-url="user.avatar_url" :initial="selfInitial" frame-key="none" :ring="false" :icon-glyph="selfCos.iconGlyph" :icon-bg="selfCos.iconBg" />
            <!-- Overlay hover: deja claro que se va al perfil -->
            <span class="absolute inset-0 rounded-[10px] bg-black/50 opacity-0 group-hover:opacity-100 transition grid place-items-center text-white">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><path d="M2.04 12.32a1 1 0 0 1 0-.64C3.42 7.5 7.36 4.5 12 4.5s8.57 3 9.96 7.18a1 1 0 0 1 0 .64C20.58 16.5 16.64 19.5 12 19.5s-8.57-3-9.96-7.18Z"/><circle cx="12" cy="12" r="3"/></svg>
            </span>
          </router-link>
          <router-link to="/profile" @click="closeMobile" class="min-w-0 flex-1 group">
            <div class="font-display font-bold text-white truncate leading-tight group-hover:text-emerald-300 transition">{{ selfName }}</div>
            <div v-if="selfCos.titleText" class="text-[11px] font-semibold truncate" :class="selfTitleClass">{{ selfCos.titleText }}</div>
            <div v-else class="text-[11px] text-slate-400">Ver mi perfil →</div>
          </router-link>
          <button v-if="mobileOpen" @click="closeMobile" class="shrink-0 h-8 w-8 grid place-items-center rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition" title="Cerrar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5"><path d="M6 18 18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <!-- Nivel + XP -->
        <div class="mt-2.5">
          <div class="flex items-center justify-between text-[10px] text-slate-400">
            <span class="font-semibold text-slate-300">Nivel {{ level }}</span>
            <span class="tabular-nums">{{ xpNow }} XP</span>
          </div>
          <div class="mt-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div class="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400 transition-all duration-700" :style="{ width: levelPct + '%' }"></div>
          </div>
        </div>
        <!-- Acciones rápidas (el avatar y el nombre ya llevan al perfil) -->
        <div class="mt-2.5 flex items-center gap-1.5">
          <router-link to="/profile-edit" @click="closeMobile" title="Personalizar identidad" class="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold py-1.5 transition">
            <svg viewBox="0 0 24 24" fill="currentColor" class="h-3.5 w-3.5"><path d="M21.731 2.269a2.625 2.625 0 00-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 000-3.712zM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 00-1.32 2.214l-.8 2.685a.75.75 0 00.933.933l2.685-.8a5.25 5.25 0 002.214-1.32l8.4-8.4z"/></svg>
            Personalizar
          </router-link>
          <router-link v-if="isAdminUser" to="/admin" @click="closeMobile" title="Panel Admin" class="h-8 w-8 grid place-items-center rounded-lg border border-amber-400/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 transition">
            <svg viewBox="0 0 24 24" fill="currentColor" class="h-4 w-4"><path d="M12 1 3 5v6c0 5.5 3.8 10.7 9 12 5.2-1.3 9-6.5 9-12V5l-9-4z"/></svg>
          </router-link>
          <button @click="doLogout" title="Cerrar sesión" class="h-8 w-8 grid place-items-center rounded-lg border border-white/10 bg-white/5 hover:bg-rose-500/15 hover:border-rose-400/30 hover:text-rose-300 text-slate-300 transition">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>
          </button>
        </div>
      </div>

      <!-- ===== Vista LISTA ===== -->
      <template v-if="view === 'list'">
        <div class="flex items-center gap-2 px-3.5 py-2 border-b border-white/10 bg-white/[0.02]">
          <span class="font-display font-bold text-white leading-tight text-sm flex-1">Amigos</span>
          <span class="text-[11px] text-slate-400"><span class="text-emerald-400 font-bold">{{ onlineCount }}</span> en línea</span>
        </div>

        <div class="px-3 py-2 border-b border-white/10">
          <div class="relative">
            <input v-model="query" type="text" placeholder="Buscar amigo…" class="w-full text-sm pl-9 pr-3 py-1.5 rounded-lg bg-black/30 border border-white/10 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-400/30 transition" />
            <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zM9.5 14C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto rail-scroll">
          <div v-if="loading && !loaded" class="p-6 text-center text-slate-400 text-sm">Cargando…</div>
          <div v-else-if="!baseRows.length" class="p-8 text-center">
            <p class="text-slate-300 text-sm font-medium">Todavía no tenés amigos</p>
            <p class="text-slate-500 text-xs mt-1">Conectá con jugadores desde sus perfiles</p>
          </div>
          <template v-else>
            <div v-if="onlineRows.length" class="px-3 pt-3 pb-1 text-[10px] uppercase tracking-wider font-bold text-emerald-400/80">En línea</div>
            <button v-for="r in onlineRows" :key="r.id" @click="openChat(r.id)" class="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 transition text-left">
              <div class="relative shrink-0">
                <UserAvatar :size="40" v-bind="avatarPropsFor(r)" />
                <span class="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-slate-900" :class="statusDot(r.status)"></span>
              </div>
              <div class="min-w-0 flex-1">
                <div class="text-sm font-semibold text-white truncate">{{ r.name }}</div>
                <div v-if="r.status === 'playing'" class="text-[11px] text-cyan-300 truncate">Jugando · {{ r.gameName }}</div>
                <div v-else class="text-[11px] text-emerald-400/90">En línea</div>
              </div>
              <span v-if="r.unread > 0" class="shrink-0 min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold grid place-items-center">{{ r.unread > 9 ? '9+' : r.unread }}</span>
            </button>

            <div v-if="offlineRows.length" class="px-3 pt-4 pb-1 text-[10px] uppercase tracking-wider font-bold text-slate-500">Desconectados</div>
            <button v-for="r in offlineRows" :key="r.id" @click="openChat(r.id)" class="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 transition text-left opacity-60 hover:opacity-100">
              <div class="relative shrink-0">
                <UserAvatar :size="40" v-bind="avatarPropsFor(r)" />
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

        <!-- ===== Accesos rápidos (abajo de todo, estilo LoL) ===== -->
        <div class="shrink-0 border-t border-white/10 bg-slate-950/40 px-2 py-2 flex items-center gap-1.5">
          <button @click="closeMobile(); challengesOpen = true" class="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold py-2 transition" title="Objetivos y desafíos">
            <svg viewBox="0 0 24 24" fill="currentColor" class="h-4 w-4 text-amber-300"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            Desafíos
          </button>
          <button @click="bugOpen = true" title="Reportar un bug" class="h-9 w-9 grid place-items-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><path d="M8 2l1.5 2.5M16 2l-1.5 2.5"/><rect x="7" y="6" width="10" height="12" rx="5"/><path d="M12 10v6M4 10h3M17 10h3M4 15h3M17 15h3M5 20l2.5-2M19 20l-2.5-2"/></svg>
          </button>
        </div>
      </template>

      <!-- ===== Vista CHAT ===== -->
      <template v-else>
        <div class="flex items-center gap-2.5 px-3 py-2 border-b border-white/10 bg-white/[0.02]">
          <button @click="backToList" class="h-8 w-8 grid place-items-center rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition" title="Volver">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <router-link :to="`/u/${activePeer.id}`" @click="closeMobile" class="relative shrink-0">
            <UserAvatar :size="38" :avatar-url="activePeer.avatar_url" :initial="initial({ name: activePeer.display_name || activePeer.email })" :frame-key="cos[activePeerId]?.frameKey || 'none'" :icon-glyph="cos[activePeerId]?.iconGlyph || ''" :icon-bg="cos[activePeerId]?.iconBg || 'emerald'" />
            <span class="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-slate-900" :class="activePresence.dot"></span>
          </router-link>
          <div class="min-w-0 flex-1">
            <div class="font-bold text-white truncate leading-tight text-sm">{{ activePeer.display_name || activePeer.email || 'Usuario' }}</div>
            <div class="text-[11px] text-slate-400 truncate">{{ activePresence.label }}</div>
          </div>
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
              <svg viewBox="0 0 24 24" fill="currentColor" class="h-4 w-4"><path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z"/></svg>
            </button>
          </div>
        </form>
      </template>
    </div>

    <!-- ───────── Modal: reportar bug ───────── -->
    <Teleport to="body">
      <div v-if="bugOpen" class="fixed inset-0 z-[70] grid place-items-center p-4" @click.self="bugOpen = false">
        <div class="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
        <div class="relative w-full max-w-md rounded-2xl border border-white/15 bg-gradient-to-br from-slate-900 to-slate-800 shadow-2xl p-5">
          <div class="flex items-center gap-2.5 mb-3">
            <span class="grid place-items-center h-9 w-9 rounded-lg bg-rose-500/15 border border-rose-400/25 text-rose-300">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5"><path d="M8 2l1.5 2.5M16 2l-1.5 2.5"/><rect x="7" y="6" width="10" height="12" rx="5"/><path d="M12 10v6M4 10h3M17 10h3M4 15h3M17 15h3"/></svg>
            </span>
            <div class="flex-1">
              <h3 class="font-display font-bold text-white leading-tight">Reportar un bug</h3>
              <p class="text-[11px] text-slate-400">Contanos qué pasó y lo revisamos</p>
            </div>
            <button @click="bugOpen = false" class="h-8 w-8 grid place-items-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5"><path d="M6 18 18 6M6 6l12 12"/></svg>
            </button>
          </div>
          <textarea v-model="bugMsg" rows="4" maxlength="2000" placeholder="¿Qué salió mal? ¿En qué parte?" class="w-full text-sm rounded-xl bg-black/30 border border-white/10 text-slate-100 placeholder:text-slate-500 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-400/30 transition resize-none"></textarea>
          <input v-model="bugContact" type="text" maxlength="200" placeholder="Contacto (opcional): mail o @usuario" class="mt-2 w-full text-sm rounded-xl bg-black/30 border border-white/10 text-slate-100 placeholder:text-slate-500 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-400/30 transition" />
          <div class="mt-3 flex justify-end gap-2">
            <button @click="bugOpen = false" class="px-4 py-2 rounded-xl text-sm font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition">Cancelar</button>
            <button @click="submitBug" :disabled="bugBusy" class="px-4 py-2 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110 active:scale-95 transition disabled:opacity-60">{{ bugBusy ? 'Enviando…' : 'Enviar reporte' }}</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ───────── Popup de Objetivos (desafíos) ───────── -->
    <ChallengesModal :open="challengesOpen" @close="challengesOpen = false" />
  </div>
</template>

<style scoped>
.rail-scroll::-webkit-scrollbar { width: 6px; }
.rail-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,.12); border-radius: 9999px; }
.rail-scroll::-webkit-scrollbar-track { background: transparent; }
</style>
