<script>
/**
 * CHAT 1 a 1 (v4) — pantalla completa en el celu.
 *  - Cabecera: volver, avatar con borde y presencia, nombre + NV, retar y menú.
 *  - Mensajes agrupados por día; las tarjetas de juego (resultado / reto) se
 *    dibujan desde el texto del mensaje (services/chat-cards.js).
 *  - (+) abre "tus juegos de hoy" para MANDAR RESULTADO o RETAR A ESTE JUEGO.
 *  - Silenciar / Bloquear / Reportar: todavía no hay servidor → se muestran
 *    deshabilitados con "Próximamente" (CHAT_SAFETY_ENABLED).
 * La lógica de mensajes (optimista + realtime + leídos) es la de siempre.
 */
import { subscribeToAuthStateChanges } from '../../services/auth'
import { formatTimeOnly, formatDayLabel } from '../../services/formatters'
import { getPublicProfile } from '../../services/user-profiles'
import { getEquippedCosmeticsBatch } from '../../services/cosmetics'
import { getUserLevel } from '../../services/xp'
import { presenceState } from '../../services/presence'
import { friendlyNameForSlug, gameRouteForSlug } from '../../services/games'
import { isChallengeAvailable } from '../../services/game-modes'
import { isGameUnlocked, getGameUnlockLevel } from '../../services/level-rewards'
import { fetchConversation, sendDirectMessage, subscribeConversation, markConversationRead } from '../../services/direct-messages'
import { encodeCard, decodeCard, isSentToday } from '../../services/chat-cards'
import { publicName, initialOf } from '../../services/social-hub'
import { tap, success as hapticSuccess } from '../../services/haptics'
import { pushErrorToast, pushInfoToast } from '../../stores/notifications'
import { shellState } from '../../components/shell/shell-state'
import UserAvatar from '../../components/common/UserAvatar.vue'
import ChatCard from '../../components/social/ChatCard.vue'
import ChatShareSheet from '../../components/social/ChatShareSheet.vue'

// Silenciar / bloquear / reportar necesitan servidor (ver informe del PR).
const CHAT_SAFETY_ENABLED = false

let unsubscribeAuth = () => {}
let unsubscribeDM = () => {}

export default {
  name: 'DirectChat',
  components: { UserAvatar, ChatCard, ChatShareSheet },
  data() {
    return {
      user: { id: null, email: null },
      peer: { id: null, display_name: null, email: null, avatar_url: null },
      peerCos: {},
      peerLevel: null,
      messages: [],
      newMessage: { content: '' },
      loading: false,
      sheetOpen: false,
      preferReto: false,
      menuOpen: false,
      accepting: null,
      CHAT_SAFETY_ENABLED,
      isLg: typeof window !== 'undefined' && !!window.matchMedia?.('(min-width: 1024px)').matches,
      _loadingChat: false,
      _lastPeerId: null,
      _debounceTimer: null,
    }
  },
  computed: {
    peerName() { return publicName(this.peer) },
    peerFirst() { return this.peerName.split(' ')[0] },
    presence() {
      const p = presenceState.value?.[this.peer.id]
      if (!p) return { key: 'off', label: 'desconectado' }
      if (p.game) return { key: 'play', label: 'jugando ' + friendlyNameForSlug(p.game) }
      return { key: 'on', label: 'en línea' }
    },
    lastOwnId() {
      for (let i = this.messages.length - 1; i >= 0; i--) if (this.isOwn(this.messages[i])) return this.messages[i].id
      return null
    },
    dayGroups() {
      const groups = []
      let lastKey = null
      for (const m of this.messages) {
        const key = new Date(m.created_at).toDateString()
        if (key !== lastKey) { groups.push({ key, label: formatDayLabel(m.created_at), items: [] }); lastKey = key }
        groups[groups.length - 1].items.push({ m, card: decodeCard(m.content), own: this.isOwn(m) })
      }
      return groups
    },
  },
  methods: {
    initialOf,
    tap,
    formatTimeOnly,
    isOwn(m) { return !!m && (m.sender_id === this.user.id || m.email === this.user.email) },
    goBack() {
      tap()
      if (window.history.state?.back) this.$router.back()
      else this.$router.push({ path: '/social', query: { tab: 'amigos' } })
    },
    toggleSheet(reto = false) {
      tap()
      this.menuOpen = false
      this.preferReto = !!reto
      this.sheetOpen = !this.sheetOpen
    },
    closeOverlays() { this.sheetOpen = false; this.menuOpen = false },
    onKey(e) { if (e.key === 'Escape') this.closeOverlays() },
    scrollToEnd() {
      this.$nextTick(() => { const el = this.$refs.chatContainer; if (el) el.scrollTop = el.scrollHeight })
    },
    async handleSubmit() {
      const raw = this.newMessage.content || ''
      const text = raw.replace(/\s+$/g, '')
      if (!text.trim()) return
      this.newMessage.content = ''
      await this.sendContent(text)
    },
    async sendContent(text) {
      const temp = {
        id: `temp-${Date.now()}`, sender_id: this.user.id, recipient_id: this.peer.id, content: text,
        created_at: new Date().toISOString(), read: false, optimistic: true, failed: false,
      }
      this.messages.push(temp)
      this.scrollToEnd()
      try {
        await sendDirectMessage(this.peer.id, text)
        // Se reconcilia con el INSERT de realtime (reemplaza al optimista).
      } catch (e) {
        const idx = this.messages.findIndex(m => m.id === temp.id)
        if (idx !== -1) this.messages[idx].failed = true
        try { pushErrorToast(e?.message || 'No se pudo enviar el mensaje') } catch {}
      }
    },
    async sendCard({ kind, game }) {
      this.sheetOpen = false
      hapticSuccess()
      await this.sendContent(encodeCard(kind, game))
    },
    async acceptReto(card) {
      if (this.accepting) return
      tap()
      const level = shellState.stats.level || 1
      if (!isGameUnlocked(card.slug, level)) {
        pushInfoToast(`${card.name} se desbloquea en el Nivel ${getGameUnlockLevel(card.slug)}`)
        return
      }
      this.accepting = card.slug
      try {
        const av = await isChallengeAvailable(card.slug)
        if (av && av.available === false) {
          pushInfoToast(`Ya jugaste ${card.name} hoy. El desafío se renueva a las 00:00`)
          return
        }
        this.$router.push(`${gameRouteForSlug(card.slug)}?mode=challenge`)
      } catch {
        pushErrorToast('No pudimos abrir el reto')
      } finally {
        this.accepting = null
      }
    },
    retoExpired(item) { return !item.m.optimistic && !isSentToday(item.m.created_at) },
    async loadPeerProfile(id) {
      try {
        const { data } = await getPublicProfile(id)
        this.peer = data ? { ...this.peer, ...data, id } : { id, display_name: null, email: null, avatar_url: null }
      } catch {
        this.peer = { id, display_name: null, email: null, avatar_url: null }
      }
      getEquippedCosmeticsBatch([id]).then(c => { this.peerCos = c?.[id] || {} }).catch(() => {})
      getUserLevel(id).then(({ data }) => {
        const info = Array.isArray(data) ? data[0] : data
        this.peerLevel = info?.level ?? null
      }).catch(() => {})
    },
    async loadConversation(peerId) {
      this.loading = true
      try {
        const { data } = await fetchConversation(peerId)
        this.messages = data || []
        this.scrollToEnd()
        await markConversationRead(peerId)
      } finally {
        this.loading = false
      }
    },
    async loadChat(peerId) {
      if (this._debounceTimer) clearTimeout(this._debounceTimer)
      this._debounceTimer = setTimeout(() => this._doLoadChat(peerId), 50)
    },
    async _doLoadChat(peerId) {
      if (this._loadingChat || peerId === this._lastPeerId) return
      this._loadingChat = true
      this._lastPeerId = peerId
      shellState.embeddedChatPeer = peerId // el dock global no tira toast de este chat
      this.peerCos = {}; this.peerLevel = null
      await this.loadPeerProfile(peerId)
      await this.loadConversation(peerId)
      this.attachRealtime(peerId)
      this._loadingChat = false
      if (this.$route.query.retar === '1') {
        this.preferReto = true
        this.sheetOpen = true
        const { retar, ...rest } = this.$route.query
        this.$router.replace({ query: rest })
      }
    },
    attachRealtime(peerId) {
      if (unsubscribeDM) { try { unsubscribeDM() } catch {} }
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
          this.scrollToEnd()
          if (row.recipient_id === this.user.id) {
            try { await markConversationRead(peerId) } catch {}
          }
        },
        onUpdate: async (row) => {
          const i = this.messages.findIndex(m => m.id === row.id)
          if (i !== -1) this.messages[i] = { ...this.messages[i], ...row }
        },
      })
    },
  },
  async mounted() {
    unsubscribeAuth = subscribeToAuthStateChanges(async (u) => { this.user = u })
    document.addEventListener('keydown', this.onKey)
    const peerId = this.$route.params.peerId
    if (!peerId) return
    await this.loadChat(peerId)
  },
  unmounted() {
    try { unsubscribeAuth() } catch {}
    try { unsubscribeDM() } catch {}
    document.removeEventListener('keydown', this.onKey)
    if (shellState.embeddedChatPeer === this._lastPeerId) shellState.embeddedChatPeer = null
    if (this._debounceTimer) clearTimeout(this._debounceTimer)
  },
  watch: {
    '$route.params.peerId': {
      immediate: false,
      async handler(newId) {
        if (!newId) return
        this.closeOverlays()
        await this.loadChat(newId)
      },
    },
  },
}
</script>

<template>
  <div class="chat-page">
  <!-- En el celu va a <body>: así tapa la top bar (el <main> del shell es su propio contexto de apilado). -->
  <Teleport to="body" :disabled="isLg">
  <div class="chat-root">
    <!-- Cabecera -->
    <header class="chat-head">
      <button type="button" class="chat-ib" aria-label="Volver" @click="goBack">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>
      </button>
      <RouterLink v-if="peer.id" :to="`/u/${peer.id}`" class="flex-1 min-w-0 min-h-[44px] flex items-center gap-2.5" :aria-label="`Ver perfil de ${peerName}`">
        <span class="relative shrink-0">
          <UserAvatar :size="40" :avatar-url="peer.avatar_url || ''" :initial="initialOf(peerName)" :frame-key="peerCos.frameKey || 'none'" :icon-glyph="peerCos.iconGlyph || ''" :icon-bg="peerCos.iconBg || 'emerald'" :glow="false" :level="peerCos.frameLevel ?? null" :streak="peerCos.dailyStreak || 0" />
          <span class="chat-dot" :class="'st-' + presence.key" aria-hidden="true"></span>
        </span>
        <span class="min-w-0 flex flex-col gap-px">
          <span class="flex items-center gap-1.5 min-w-0">
            <span class="font-display font-bold text-base text-white truncate">{{ peerName }}</span>
            <span v-if="peerLevel != null" class="chat-lvl">NV {{ peerLevel }}</span>
          </span>
          <span class="text-[11.5px] font-bold truncate" :class="'stc-' + presence.key">{{ presence.label }}</span>
        </span>
      </RouterLink>
      <span v-else class="flex-1"></span>
      <button type="button" class="chat-ib text-amber-400" :aria-label="`Retar a ${peerName}`" @click="toggleSheet(true)">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2"/></svg>
      </button>
      <button type="button" class="chat-ib" :class="menuOpen ? 'bg-white/10' : ''" aria-label="Más opciones del chat" aria-haspopup="menu" :aria-expanded="menuOpen" @click="tap(); menuOpen = !menuOpen; sheetOpen = false">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
      </button>
    </header>

    <!-- Menú … -->
    <Transition name="chat-pop">
      <div v-if="menuOpen" class="chat-menu" role="menu" aria-label="Opciones del chat">
        <RouterLink v-if="peer.id" :to="`/u/${peer.id}`" role="menuitem" class="chat-mi">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/></svg>Ver perfil
        </RouterLink>
        <button type="button" role="menuitem" class="chat-mi" :disabled="!CHAT_SAFETY_ENABLED" :aria-disabled="!CHAT_SAFETY_ENABLED">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0112 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 004 0M3 3l18 18"/></svg>Silenciar<span v-if="!CHAT_SAFETY_ENABLED" class="chat-soon">Próximamente</span>
        </button>
        <button type="button" role="menuitem" class="chat-mi" :disabled="!CHAT_SAFETY_ENABLED" :aria-disabled="!CHAT_SAFETY_ENABLED">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/></svg>Bloquear<span v-if="!CHAT_SAFETY_ENABLED" class="chat-soon">Próximamente</span>
        </button>
        <button type="button" role="menuitem" class="chat-mi text-red-400" :disabled="!CHAT_SAFETY_ENABLED" :aria-disabled="!CHAT_SAFETY_ENABLED">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 21V4h11l-1.5 4L16 12H5"/></svg>Reportar<span v-if="!CHAT_SAFETY_ENABLED" class="chat-soon">Próximamente</span>
        </button>
      </div>
    </Transition>
    <button v-if="menuOpen" type="button" class="chat-menu-scrim" aria-label="Cerrar menú" @click="menuOpen = false"></button>

    <!-- Conversación -->
    <main ref="chatContainer" class="chat-scroll" aria-label="Conversación" aria-live="polite">
      <div class="chat-list">
        <div v-if="loading && !messages.length" class="flex flex-col gap-2 py-6" aria-busy="true">
          <span class="h-10 w-48 rounded-2xl bg-white/5 animate-pulse"></span>
          <span class="h-10 w-40 self-end rounded-2xl bg-white/5 animate-pulse"></span>
          <span class="h-10 w-56 rounded-2xl bg-white/5 animate-pulse"></span>
        </div>
        <div v-else-if="!messages.length" class="chat-empty">
          <p class="font-display font-bold text-white">Arrancá la charla con {{ peerFirst }}</p>
          <p class="text-[13px] text-slate-400 mt-1">Mandale un mensaje o tocá <strong class="text-amber-300">+</strong> para compartir un juego de hoy o retarlo.</p>
        </div>
        <template v-for="g in dayGroups" :key="g.key">
          <span class="chat-day">{{ g.label }}</span>
          <template v-for="it in g.items" :key="it.m.id">
            <ChatCard v-if="it.card" :card="it.card" :own="it.own" :peer-name="peerFirst" :expired="it.card.kind === 'reto' && retoExpired(it)"
              :busy="accepting === it.card.slug" class="chat-in" @accept="acceptReto" />
            <div v-else class="chat-bubble chat-in" :class="it.own ? 'is-own' : 'is-peer'">{{ it.m.content }}</div>
            <span v-if="it.own && (it.m.failed || it.m.id === lastOwnId)" class="chat-meta" :class="it.m.failed ? 'text-red-400' : ''">
              <template v-if="it.m.failed">No se envió</template>
              <template v-else-if="it.m.optimistic">Enviando…</template>
              <template v-else>{{ it.m.read ? 'Visto' : 'Enviado' }} {{ formatTimeOnly(it.m.created_at) }}</template>
            </span>
          </template>
        </template>
      </div>
    </main>

    <!-- Escribir -->
    <form class="chat-foot" action="#" @submit.prevent="handleSubmit">
      <ChatShareSheet :open="sheetOpen" :prefer-reto="preferReto" @close="sheetOpen = false" @send="sendCard" />
      <button type="button" class="chat-att" :class="sheetOpen ? 'is-on' : ''" aria-label="Adjuntar un juego de hoy" aria-haspopup="dialog" :aria-expanded="sheetOpen" aria-controls="chat-share-sheet" @click="toggleSheet(false)">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
      </button>
      <input v-model="newMessage.content" type="text" class="chat-input" aria-label="Escribir mensaje" :placeholder="`Escribile a ${peerFirst}…`" enterkeyhint="send" maxlength="1000" />
      <button type="submit" class="chat-send" aria-label="Enviar mensaje" :disabled="!newMessage.content.trim()">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12l16-8-6 16-3-6.5z"/></svg>
      </button>
    </form>
  </div>
  </Teleport>
  </div>
</template>

<style scoped>
.chat-root {
  --cs-bottom: calc(60px + env(safe-area-inset-bottom, 0px));
  position: fixed; inset: 0; z-index: 50; display: flex; flex-direction: column; background: #0b1220; color: #f1f5f9;
}
@media (min-width: 1024px) {
  .chat-root { --cs-bottom: 60px; position: relative; inset: auto; z-index: 1; height: calc(100dvh - 12rem); max-width: 42rem; margin: 0 auto; border-radius: 20px; border: 1px solid rgba(255,255,255,0.08); overflow: hidden; }
}
.chat-head {
  flex-shrink: 0; z-index: 3; min-height: 64px; box-sizing: border-box; display: flex; align-items: center; gap: 6px;
  padding: env(safe-area-inset-top, 0px) 6px 0; background: rgba(11,18,32,0.94); border-bottom: 1px solid rgba(255,255,255,0.07);
}
.chat-ib { width: 44px; height: 44px; flex-shrink: 0; border-radius: 12px; display: grid; place-items: center; color: #e2e8f0; }
.chat-ib.text-amber-400 { color: #fbbf24; }
.chat-dot { position: absolute; right: -3px; bottom: -3px; width: 12px; height: 12px; border-radius: 50%; border: 2.5px solid #0b1220; }
.st-on { background: #22c55e; } .st-play { background: #22d3ee; } .st-off { background: #475569; }
.stc-on { color: #4ade80; } .stc-play { color: #67e8f9; } .stc-off { color: #64748b; }
.chat-lvl { flex-shrink: 0; height: 18px; padding: 0 5px; border-radius: 5px; background: linear-gradient(180deg, #818cf8, #4f46e5); border: 1px solid #c7d2fe; font-family: var(--font-shout); font-weight: 800; font-size: 12px; line-height: 16px; color: #fff; }
.chat-menu {
  position: absolute; z-index: 9; top: calc(env(safe-area-inset-top, 0px) + 58px); right: 10px; width: 230px; border-radius: 16px; padding: 6px;
  background: #16213a; border: 1px solid rgba(255,255,255,0.12); box-shadow: 0 18px 40px rgba(0,0,0,0.55);
}
.chat-menu-scrim { position: absolute; inset: 0; z-index: 8; background: transparent; border: 0; }
.chat-mi { width: 100%; min-height: 44px; padding: 0 12px; border-radius: 10px; color: #e2e8f0; font-weight: 700; font-size: 14px; display: flex; align-items: center; gap: 10px; text-align: left; }
.chat-mi.text-red-400 { color: #f87171; }
.chat-mi:disabled { opacity: .55; cursor: default; }
.chat-soon { margin-left: auto; padding: 2px 6px; border-radius: 6px; background: rgba(255,255,255,0.08); font-size: 10px; font-weight: 800; letter-spacing: .3px; color: #94a3b8; }
.chat-scroll { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
.chat-list { min-height: 100%; box-sizing: border-box; padding: 14px 12px 10px; display: flex; flex-direction: column; justify-content: flex-end; gap: 6px; }
.chat-empty { margin: auto 0; padding: 24px 16px; text-align: center; }
.chat-day { align-self: center; padding: 3px 10px; border-radius: 999px; background: rgba(255,255,255,0.06); font-size: 11px; font-weight: 700; color: #94a3b8; margin: 6px 0 4px; }
.chat-bubble { max-width: 76%; padding: 9px 12px; border-radius: 16px; font-size: 14px; line-height: 1.35; white-space: pre-line; overflow-wrap: anywhere; }
.chat-bubble.is-peer { align-self: flex-start; border-bottom-left-radius: 4px; background: #16213a; border: 1px solid rgba(255,255,255,0.07); }
.chat-bubble.is-own { align-self: flex-end; border-bottom-right-radius: 4px; background: linear-gradient(180deg, rgba(252,211,77,0.24), rgba(245,158,11,0.16)); border: 1px solid rgba(251,191,36,0.4); color: #fef3c7; }
.chat-meta { align-self: flex-end; font-size: 10.5px; color: #64748b; margin-top: -2px; }
.chat-foot {
  position: relative; flex-shrink: 0; box-sizing: border-box; display: flex; align-items: center; gap: 8px;
  padding: 8px 10px calc(8px + env(safe-area-inset-bottom, 0px)); background: #0d1526; border-top: 1px solid rgba(255,255,255,0.07);
}
.chat-att { position: relative; z-index: 8; width: 44px; height: 44px; flex-shrink: 0; border-radius: 50%; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.04); color: #e2e8f0; display: grid; place-items: center; transition: background-color .2s ease, border-color .2s ease, color .2s ease; }
.chat-att svg { transition: transform .2s ease; }
.chat-att.is-on { background: rgba(251,191,36,0.16); border-color: rgba(251,191,36,0.6); color: #fde68a; }
.chat-att.is-on svg { transform: rotate(45deg); }
.chat-input { flex: 1; min-width: 0; height: 44px; box-sizing: border-box; padding: 0 16px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.12); background: #111a2e; color: #f1f5f9; font-size: 15px; outline: none; }
.chat-input::placeholder { color: #64748b; }
.chat-input:focus { border-color: rgba(251,191,36,0.6); }
.chat-send { width: 44px; height: 44px; flex-shrink: 0; border-radius: 50%; background: linear-gradient(180deg, #fcd34d, #f59e0b); box-shadow: 0 3px 0 #b45309; color: #1c1206; display: grid; place-items: center; }
.chat-send:disabled { opacity: .55; }
.chat-send:active:not(:disabled) { transform: translateY(2px); box-shadow: 0 1px 0 #b45309; }
.chat-in { animation: chat-in .3s cubic-bezier(.2,.8,.2,1) both; }
@keyframes chat-in { from { opacity: 0; transform: translateY(8px) scale(.97); } to { opacity: 1; transform: none; } }
.chat-pop-enter-active, .chat-pop-leave-active { transition: opacity .16s ease, transform .16s ease; transform-origin: top right; }
.chat-pop-enter-from, .chat-pop-leave-to { opacity: 0; transform: scale(.95); }
@media (prefers-reduced-motion: reduce) {
  .chat-in { animation: none; }
  .chat-att, .chat-att svg { transition: none; }
  .chat-pop-enter-active, .chat-pop-leave-active { transition: opacity .1s ease; }
  .chat-pop-enter-from, .chat-pop-leave-to { transform: none; }
}
</style>
