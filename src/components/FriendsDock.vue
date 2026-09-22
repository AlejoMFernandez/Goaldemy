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
import { formatTimeOnly, formatDayLabel } from '../services/formatters'
import { supabase } from '../services/supabase'
import { pushErrorToast, pushSuccessToast, pushDmToast } from '../stores/notifications'
import { playNotifySound } from '../services/sounds'
import { setSidebarUser, sidebarState } from '../stores/sidebar'
import UserAvatar from './common/UserAvatar.vue'
import ChallengesModal from './rewards/ChallengesModal.vue'
import ProfileHoverCard from './profile/ProfileHoverCard.vue'

let unsubscribeAuth = () => {}
let unsubscribeDM = () => {}

export default {
  name: 'FriendsDock',
  components: { UserAvatar, ChallengesModal, ProfileHoverCard },
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
      bugImageFile: null,
      bugImagePreview: '',
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
      // Hover card estilo Steam sobre los avatares del rail
      hover: { id: null, name: '', avatarUrl: '', top: 0, right: 0 },
      // Centrado vertical real: entre el borde inferior del header y el borde
      // inferior de la pantalla (antes usaba un offset fijo medido desde el
      // TOPE de la pantalla, que con el header fijo arriba quedaba desparejo:
      // muy pegado al header y con mucho más aire abajo).
      headerH: 72,
      sidebarGapPx: 44, // 80 (muy corta) -> 24 (muy larga) -> 34 -> 44: +10px más de aire de cada lado
      retentionInfoOpen: false,
    }
  },
  computed: {
    openChatRequest() { return sidebarState.openChatRequest },
    sidebarTopPx() { return (this.headerH + this.sidebarGapPx) + 'px' },
    sidebarBottomPx() { return this.sidebarGapPx + 'px' },
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
    // Agrupa los mensajes por día calendario para el separador estilo WhatsApp
    // ("Hoy" / "Ayer") — así la fecha no se repite en cada mensaje.
    messageDayGroups() {
      const groups = []
      let lastKey = null
      for (const m of this.messages) {
        const d = new Date(m.created_at)
        const key = d.toDateString()
        if (key !== lastKey) {
          groups.push({ key, label: formatDayLabel(m.created_at), items: [] })
          lastKey = key
        }
        groups[groups.length - 1].items.push(m)
      }
      return groups
    },
  },
  watch: {
    // Click en un toast de DM (o cualquier otro disparador externo) → abrir ese chat.
    openChatRequest(req) {
      if (req?.peerId) this.openFromRail(req.peerId)
    },
  },
  methods: {
    formatTimeOnly,
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
    measureHeader() {
      // Solo importa en desktop (lg+): rail y centrado del panel son lg-only.
      // En mobile no hacemos nada acá — evita trabajo/reflow innecesario justo
      // cuando el teclado abre y dispara resize (el mismo momento del bug que
      // rompía la página en el chat).
      if (typeof window !== 'undefined' && window.innerWidth < 1024) return
      try {
        const h = document.querySelector('header')
        this.headerH = h ? Math.round(h.getBoundingClientRect().height) : 72
      } catch { this.headerH = 72 }
    },
    onDocumentPointerDown(e) {
      if (!this.mobileOpen) return
      try {
        const panel = this.$refs.dockPanel
        const toggles = [this.$refs.desktopToggleBtn, this.$refs.mobileToggleBtn].filter(Boolean)
        if (panel && panel.contains(e.target)) return
        if (toggles.some(el => el.contains(e.target))) return
        this.closeMobile()
      } catch {}
    },
    async doLogout() {
      try { await logout() } catch {}
      this.$router.push('/login')
    },
    onBugImageSelected(e) {
      const file = e.target?.files?.[0]
      if (!file) return
      if (!file.type.startsWith('image/')) { pushErrorToast('Elegí un archivo de imagen'); return }
      if (file.size > 5 * 1024 * 1024) { pushErrorToast('La imagen pesa demasiado (máx. 5MB)'); return }
      this.bugImageFile = file
      this.bugImagePreview = URL.createObjectURL(file)
    },
    clearBugImage() {
      if (this.bugImagePreview) URL.revokeObjectURL(this.bugImagePreview)
      this.bugImageFile = null
      this.bugImagePreview = ''
      if (this.$refs.bugImageInput) this.$refs.bugImageInput.value = ''
    },
    async submitBug() {
      if (this.bugBusy) return
      this.bugBusy = true
      const res = await submitBugReport({ message: this.bugMsg, contact: this.bugContact, imageFile: this.bugImageFile })
      this.bugBusy = false
      if (res.ok) {
        pushSuccessToast('¡Gracias! Reporte enviado')
        this.bugOpen = false; this.bugMsg = ''; this.bugContact = ''
        this.clearBugImage()
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
    openFromRail(peerId) {
      // Desde el rail preview: abre el drawer directo en el chat del amigo.
      this.mobileOpen = true
      this.openChat(peerId)
    },
    onRailHover(r, e) {
      // Card estilo Steam a la IZQUIERDA del avatar (el rail está pegado al borde).
      const rect = e.currentTarget.getBoundingClientRect()
      this.hover = {
        id: r.id,
        name: r.name,
        avatarUrl: r.avatar_url,
        top: Math.max(76, Math.round(rect.top - 8)),
        right: Math.round(window.innerWidth - rect.left + 10),
      }
    },
    clearRailHover() { this.hover.id = null },
    async openChat(peerId) {
      const row = this.baseRows.find(r => r.id === peerId)
      if (row) row.unread = 0
      const t = this.threads.find(x => x.peer_id === peerId)
      if (t) t.unread = 0
      this.view = 'chat'
      this.activePeerId = peerId
      this.query = ''
      this.retentionInfoOpen = false
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
      } finally { this.chatLoading = false }
      // El scroll tiene que pasar DESPUÉS de que chatLoading pase a false: recién ahí
      // el DOM cambia de "Cargando…" a la lista real de mensajes (si no, se scrollea
      // un contenedor que todavía no tiene los mensajes adentro).
      await this.$nextTick()
      this.scrollChatToBottom()
      await markConversationRead(this.activePeerId)
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
      ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `recipient_id=eq.${this.user.id}` }, (payload) => {
        try { playNotifySound() } catch {}
        this.loadThreads()
        this.maybeToastIncomingDm(payload?.new)
      })
      ch.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'direct_messages', filter: `recipient_id=eq.${this.user.id}` }, () => this.loadThreads())
      ch.subscribe()
      this._rtChannel = ch
      try { clearInterval(this._notifInterval) } catch {}
      this._notifInterval = setInterval(() => this.loadThreads(), 30000)
    },
    // Toast efímero estilo WhatsApp: solo si NO estoy ya mirando ese chat puntual.
    maybeToastIncomingDm(row) {
      if (!row?.sender_id) return
      const viewingThisChat = this.mobileOpen && this.view === 'chat' && this.activePeerId === row.sender_id
      if (viewingThisChat) return
      const friend = (this.friends || []).find(f => f.id === row.sender_id)
      const c = this.cos[row.sender_id] || {}
      pushDmToast({
        peerId: row.sender_id,
        name: friend?.display_name || friend?.email || 'Mensaje nuevo',
        avatarUrl: friend?.avatar_url || '',
        message: row.content || '',
        frameKey: c.frameKey || 'none',
        iconGlyph: c.iconGlyph || '',
        iconBg: c.iconBg || 'emerald',
        initial: this.initial({ name: friend?.display_name || friend?.email }),
      })
    },
  },
  async mounted() {
    document.addEventListener('mousedown', this.onDocumentPointerDown)
    this.measureHeader()
    window.addEventListener('resize', this.measureHeader)
    unsubscribeAuth = subscribeToAuthStateChanges(async (u) => {
      this.user = u || { id: null }
      setSidebarUser(!!this.user?.id)
      if (this.user?.id) { await this._doRefresh(); this.loadSelf(); this.setupDmRealtime() }
      else { this.friends = []; this.threads = []; this.cos = {}; this.levelInfo = null }
    })
  },
  unmounted() {
    document.removeEventListener('mousedown', this.onDocumentPointerDown)
    window.removeEventListener('resize', this.measureHeader)
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
    <!-- ───────── CARD flotante de amigos (desktop) — preview icono+estado ─────────
         Ya NO es una columna full-height: es una card centrada verticalmente y
         separada del borde (right-3) para dejar la barra de scroll de la página
         totalmente libre a su derecha. Flota sobre el contenido. -->
    <div class="hidden lg:flex fixed right-5 z-30 w-[58px] flex-col items-center rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 shadow-2xl py-2"
      :style="{ top: sidebarTopPx, bottom: sidebarBottomPx }">
      <!-- Abrir lista completa -->
      <button ref="desktopToggleBtn" @click="toggleMobile" title="Ver amigos" class="relative mb-1 h-10 w-10 grid place-items-center rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition">
        <svg viewBox="0 0 24 24" fill="currentColor" class="h-5 w-5"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
        <span v-if="totalUnread > 0" class="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold grid place-items-center">{{ totalUnread > 9 ? '9+' : totalUnread }}</span>
      </button>

      <!-- Amigos: solo avatar (icono + borde) + estado -->
      <div class="flex-1 min-h-0 w-full overflow-y-auto rail-scroll flex flex-col items-center gap-2 py-1">
        <button v-for="r in sortedRows" :key="r.id" @click="openFromRail(r.id)"
          @mouseenter="onRailHover(r, $event)" @mouseleave="clearRailHover"
          class="relative shrink-0 hover:scale-110 transition" :class="r.status==='offline' ? 'opacity-60 hover:opacity-100' : ''">
          <UserAvatar :size="42" :glow="false" v-bind="avatarPropsFor(r)" />
          <span class="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-slate-900" :class="statusDot(r.status)"></span>
          <span v-if="r.unread > 0" class="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold grid place-items-center">{{ r.unread > 9 ? '9+' : r.unread }}</span>
        </button>
      </div>

      <!-- Desafíos + reportar bug (abajo, fijos) -->
      <div class="w-full flex flex-col items-center gap-1.5 pt-2 mt-1 border-t border-white/10">
        <button @click="challengesOpen = true" title="Objetivos y desafíos" class="h-9 w-9 grid place-items-center rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-amber-300 transition">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12v10H4V12"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg>
        </button>
        <button @click="bugOpen = true" title="Reportar un bug" class="h-9 w-9 grid place-items-center rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><path d="M8 2l1.5 2.5M16 2l-1.5 2.5"/><rect x="7" y="6" width="10" height="12" rx="5"/><path d="M12 10v6M4 10h3M17 10h3M4 15h3M17 15h3M5 20l2.5-2M19 20l-2.5-2"/></svg>
        </button>
      </div>
    </div>

    <!-- ───────── Mobile: cluster flotante (desafíos + bug + amigos) ───────── -->
    <div class="lg:hidden fixed bottom-5 right-4 z-40 flex flex-col items-center gap-2.5">
      <button @click="challengesOpen = true" title="Desafíos" class="h-11 w-11 grid place-items-center rounded-full border border-white/15 bg-slate-800/90 text-amber-300 shadow-xl hover:brightness-110 transition active:scale-95">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12v10H4V12"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg>
      </button>
      <button @click="bugOpen = true" title="Reportar bug" class="h-11 w-11 grid place-items-center rounded-full border border-white/15 bg-slate-800/90 text-slate-300 shadow-xl hover:brightness-110 transition active:scale-95">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5"><path d="M8 2l1.5 2.5M16 2l-1.5 2.5"/><rect x="7" y="6" width="10" height="12" rx="5"/><path d="M12 10v6M4 10h3M17 10h3M4 15h3M17 15h3M5 20l2.5-2M19 20l-2.5-2"/></svg>
      </button>
      <button ref="mobileToggleBtn" @click="toggleMobile" title="Amigos" class="relative h-14 w-14 rounded-full grid place-items-center bg-gradient-to-br from-indigo-500 to-purple-500 text-white shadow-2xl shadow-indigo-500/40 border border-white/20 hover:brightness-110 transition active:scale-95">
        <svg v-if="!mobileOpen" viewBox="0 0 24 24" fill="currentColor" class="h-6 w-6"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
        <svg v-else viewBox="0 0 24 24" fill="currentColor" class="h-6 w-6"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        <span v-if="totalUnread > 0" class="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold grid place-items-center border border-white/20">{{ totalUnread > 9 ? '9+' : totalUnread }}</span>
      </button>
    </div>

    <!-- ───────── Barra de AMIGOS desplegable (card flotante, no full-height) ─────────
         Chica y con transición (antes: sidebar full-height "enorme" que aparecía/
         desaparecía sin animación). -->
    <Transition name="dock-pop">
    <div v-if="mobileOpen" ref="dockPanel"
      class="fd-dock-panel fixed z-40 right-4 bottom-24 w-[92vw] max-w-[320px] h-[65vh] max-h-[520px]
             lg:right-5 lg:h-auto lg:max-h-none lg:w-[320px] lg:max-w-none
             flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 backdrop-blur-xl shadow-2xl"
      :style="{ '--fd-top': sidebarTopPx, '--fd-bottom': sidebarBottomPx }">

      <!-- ===== Vista LISTA ===== -->
      <template v-if="view === 'list'">
        <div class="flex items-center gap-2 px-3.5 py-2.5 border-b border-white/10 bg-white/[0.02]">
          <span class="font-display font-bold text-white leading-tight text-sm flex-1">Amigos</span>
          <span class="text-[11px] text-slate-400 mr-0.5"><span class="text-emerald-400 font-bold">{{ onlineCount }}</span> en línea</span>
          <button @click="closeMobile" class="shrink-0 h-8 w-8 grid place-items-center rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition" title="Cerrar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5"><path d="M6 18 18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div class="px-3 py-2 border-b border-white/10">
          <div class="relative">
            <input v-model="query" type="text" placeholder="Buscar amigo…" class="w-full text-sm pl-9 pr-3 py-1.5 rounded-lg bg-black/30 border border-white/10 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400/30 transition" />
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
            <div v-for="r in onlineRows" :key="r.id" class="group w-full flex items-center gap-1.5 px-3 py-2 hover:bg-white/5 transition">
              <button @click="openChat(r.id)" class="flex items-center gap-3 flex-1 min-w-0 text-left">
                <div class="relative shrink-0">
                  <UserAvatar :size="40" v-bind="avatarPropsFor(r)" />
                  <span class="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-slate-900" :class="statusDot(r.status)"></span>
                </div>
                <div class="min-w-0 flex-1">
                  <div class="text-sm font-semibold text-white truncate">{{ r.name }}</div>
                  <div v-if="r.status === 'playing'" class="text-[11px] text-cyan-300 truncate">Jugando · {{ r.gameName }}</div>
                  <div v-else class="text-[11px] text-emerald-400/90">En línea</div>
                </div>
              </button>
              <span v-if="r.unread > 0" class="shrink-0 min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold grid place-items-center">{{ r.unread > 9 ? '9+' : r.unread }}</span>
            </div>

            <div v-if="offlineRows.length" class="px-3 pt-4 pb-1 text-[10px] uppercase tracking-wider font-bold text-slate-500">Desconectados</div>
            <div v-for="r in offlineRows" :key="r.id" class="group w-full flex items-center gap-1.5 px-3 py-2 hover:bg-white/5 transition opacity-60 hover:opacity-100">
              <button @click="openChat(r.id)" class="flex items-center gap-3 flex-1 min-w-0 text-left">
                <div class="relative shrink-0">
                  <UserAvatar :size="40" v-bind="avatarPropsFor(r)" />
                  <span class="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-slate-900 bg-slate-500"></span>
                </div>
                <div class="min-w-0 flex-1">
                  <div class="text-sm font-medium text-slate-300 truncate">{{ r.name }}</div>
                  <div class="text-[11px] text-slate-500">Desconectado</div>
                </div>
              </button>
              <span v-if="r.unread > 0" class="shrink-0 min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold grid place-items-center">{{ r.unread > 9 ? '9+' : r.unread }}</span>
            </div>
          </template>
        </div>

      </template>

      <!-- ===== Vista CHAT ===== -->
      <template v-else>
        <div class="flex items-center gap-3 px-4 py-3.5 border-b border-white/10 bg-white/[0.02]">
          <button @click="backToList" class="h-9 w-9 grid place-items-center rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition shrink-0" title="Volver">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <!-- Sin activePeer.id todavía (justo al abrir, mientras carga el perfil)
               no debe ser navegable: evita un link roto a /u/null por un instante. -->
          <component :is="activePeer.id ? 'router-link' : 'div'" :to="activePeer.id ? `/u/${activePeer.id}` : undefined" @click="activePeer.id && closeMobile()" class="relative shrink-0">
            <UserAvatar :size="46" :avatar-url="activePeer.avatar_url" :initial="initial({ name: activePeer.display_name || activePeer.email })" :frame-key="cos[activePeerId]?.frameKey || 'none'" :icon-glyph="cos[activePeerId]?.iconGlyph || ''" :icon-bg="cos[activePeerId]?.iconBg || 'emerald'" />
            <span class="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-slate-900" :class="activePresence.dot"></span>
          </component>
          <div class="min-w-0 flex-1">
            <div class="font-bold text-white truncate leading-tight text-base">{{ activePeer.display_name || activePeer.email || 'Usuario' }}</div>
            <div class="text-xs text-slate-400 truncate mt-0.5">{{ activePresence.label }}</div>
          </div>
          <div class="relative shrink-0">
            <button
              @mouseenter="retentionInfoOpen = true" @mouseleave="retentionInfoOpen = false"
              @click="retentionInfoOpen = !retentionInfoOpen" type="button"
              class="h-8 w-8 grid place-items-center rounded-full text-slate-500 hover:text-slate-300 hover:bg-white/10 transition"
              aria-label="Información sobre este chat">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-[18px] w-[18px]"><circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/></svg>
            </button>
            <div v-if="retentionInfoOpen" class="absolute right-0 top-9 z-20 w-56 rounded-xl border border-white/10 bg-slate-900/95 backdrop-blur-xl shadow-2xl p-3 text-[11px] leading-snug text-slate-300">
              Los mensajes de este chat se borran automáticamente después de <span class="text-white font-semibold">48 horas</span> para mantener la app liviana. Guardá lo importante por otro medio.
            </div>
          </div>
        </div>

        <div ref="chatContainer" class="flex-1 overflow-y-auto p-3 bg-black/10 rail-scroll">
          <div v-if="chatLoading" class="flex flex-col gap-2 items-start animate-pulse">
            <div class="h-9 w-2/5 rounded-2xl bg-slate-700/40"></div>
            <div class="h-9 w-1/2 rounded-2xl bg-slate-700/40 ml-auto"></div>
            <div class="h-7 w-1/3 rounded-2xl bg-slate-700/40"></div>
            <div class="h-9 w-2/5 rounded-2xl bg-slate-700/40 ml-auto"></div>
            <div class="h-7 w-1/4 rounded-2xl bg-slate-700/40"></div>
          </div>
          <div v-else class="flex flex-col gap-3">
            <div v-for="g in messageDayGroups" :key="g.key" class="flex flex-col gap-2">
              <div class="flex justify-center">
                <span class="text-[10px] font-semibold uppercase tracking-wide text-slate-400 bg-white/5 border border-white/10 rounded-full px-2.5 py-1">{{ g.label }}</span>
              </div>
              <ol class="flex flex-col gap-2 items-start">
                <li v-for="m in g.items" :key="m.id" :class="['w-fit max-w-[85%] rounded-2xl px-3.5 py-2 text-slate-100 border', isOwn(m) ? 'ml-auto bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border-violet-400/40' : 'bg-violet-500/10 border-violet-400/25']">
                  <div class="whitespace-pre-line break-words text-sm">{{ m.content }}</div>
                  <div class="mt-0.5 text-[10px] text-slate-400 flex items-center gap-1" :class="isOwn(m) ? 'justify-end' : 'justify-start'">
                    <span>{{ formatTimeOnly(m.created_at) }}</span>
                    <span v-if="isOwn(m) && m.failed" class="text-rose-400">⚠</span>
                    <span v-else-if="isOwn(m) && m.optimistic" class="inline-flex items-center text-slate-400/70">
                      <svg width="13" height="13" viewBox="0 0 16 15" fill="none"><path d="M1 7.5L5 11.5L11 3.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </span>
                    <span v-else-if="isOwn(m)" class="inline-flex items-center" :class="m.read ? 'text-emerald-400' : 'text-slate-400'">
                      <svg width="13" height="13" viewBox="0 0 16 15" fill="none"><path d="M1 7.5L5 11.5L11 3.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
                      <svg width="13" height="13" viewBox="0 0 16 15" fill="none" class="-ml-[7px]"><path d="M1 7.5L5 11.5L11 3.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </span>
                  </div>
                </li>
              </ol>
            </div>
          </div>
        </div>

        <form @submit.prevent="handleSubmit" class="p-2.5 border-t border-white/10 bg-slate-900/80">
          <div class="flex items-center gap-2 rounded-full border border-white/15 bg-black/30 pl-4 pr-1.5 py-1.5 focus-within:ring-2 focus-within:ring-violet-400/30 focus-within:border-violet-400/30 transition">
            <input v-model="newMessage.content" type="text" placeholder="Escribí un mensaje…" class="flex-1 bg-transparent outline-none text-slate-100 placeholder-slate-500 text-sm" @keydown.enter.exact.prevent="handleSubmit" />
            <button type="submit" class="shrink-0 h-8 w-8 grid place-items-center rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:brightness-110 transition active:scale-95">
              <svg viewBox="0 0 24 24" fill="currentColor" class="h-4 w-4"><path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z"/></svg>
            </button>
          </div>
        </form>
      </template>
    </div>
    </Transition>

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
          <textarea v-model="bugMsg" rows="4" maxlength="2000" placeholder="¿Qué salió mal? ¿En qué parte?" class="w-full text-sm rounded-xl bg-black/30 border border-white/10 text-slate-100 placeholder:text-slate-500 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400/30 transition resize-none"></textarea>
          <input v-model="bugContact" type="text" maxlength="200" placeholder="Contacto (opcional): mail o @usuario" class="mt-2 w-full text-sm rounded-xl bg-black/30 border border-white/10 text-slate-100 placeholder:text-slate-500 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400/30 transition" />

          <input ref="bugImageInput" type="file" accept="image/*" class="hidden" @change="onBugImageSelected" />
          <div v-if="!bugImagePreview" class="mt-2">
            <button @click="$refs.bugImageInput.click()" type="button" class="w-full text-xs font-semibold rounded-xl border border-dashed border-white/15 text-slate-400 hover:text-white hover:border-white/30 transition px-3 py-2.5 flex items-center justify-center gap-2">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
              Adjuntar una captura (opcional)
            </button>
          </div>
          <div v-else class="mt-2 relative inline-block">
            <img :src="bugImagePreview" alt="Captura adjunta" class="h-20 rounded-lg border border-white/10 object-cover" />
            <button @click="clearBugImage" type="button" class="absolute -top-2 -right-2 h-6 w-6 grid place-items-center rounded-full bg-slate-900 border border-white/15 text-slate-300 hover:text-white transition">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5"><path d="M6 18 18 6M6 6l12 12"/></svg>
            </button>
          </div>

          <div class="mt-3 flex justify-end gap-2">
            <button @click="bugOpen = false" class="px-4 py-2 rounded-xl text-sm font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition">Cancelar</button>
            <button @click="submitBug" :disabled="bugBusy" class="px-4 py-2 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-500 hover:brightness-110 active:scale-95 transition disabled:opacity-60">{{ bugBusy ? 'Enviando…' : 'Enviar reporte' }}</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ───────── Popup de Objetivos (desafíos) ───────── -->
    <ChallengesModal :open="challengesOpen" @close="challengesOpen = false" />

    <!-- ───────── Hover card estilo Steam sobre los avatares del rail ───────── -->
    <Teleport to="body">
      <div v-if="hover.id" class="fixed z-[60] pointer-events-none" :style="{ top: hover.top + 'px', right: hover.right + 'px' }">
        <ProfileHoverCard :user-id="hover.id" :name="hover.name" :avatar-url="hover.avatarUrl" />
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* Scroll invisible: nunca reserva ancho ni corre el contenido al aparecer/hover. */
.rail-scroll { scrollbar-width: none; -ms-overflow-style: none; }
.rail-scroll::-webkit-scrollbar { display: none; width: 0; height: 0; }

/* Transición de la card de amigos al abrir/cerrar (antes aparecía/desaparecía sólida). */
.dock-pop-enter-active, .dock-pop-leave-active { transition: opacity .18s ease, transform .18s ease; }
.dock-pop-enter-from, .dock-pop-leave-to { opacity: 0; transform: translateY(8px) scale(.96); }

/* Solo en desktop el panel se centra entre el header y el borde de la pantalla
   (en mobile es un drawer anclado abajo, ver clases bottom-24 de arriba). */
@media (min-width: 1024px) {
  .fd-dock-panel { top: var(--fd-top, 90px); bottom: var(--fd-bottom, 80px); }
}
</style>
