<script>
import AppH1 from '../components/common/AppH1.vue'
import { subscribeToAuthStateChanges } from '../services/auth'
import { formatShortDate } from '../services/formatters'
import { getPublicProfile } from '../services/user-profiles'
import { fetchConversation, sendDirectMessage, subscribeConversation, markConversationRead } from '../services/direct-messages'
import { pushErrorToast } from '../stores/notifications'

let unsubscribeAuth = () => {}
let unsubscribeDM = () => {}

export default {
  name: 'DirectChat',
  components: { AppH1 },
  data() {
    return {
      user: { id: null, email: null },
      peer: { id: null, display_name: null, email: null, avatar_url: null },
      messages: [],
      newMessage: { content: '' },
      loading: false,
      _loadingChat: false,
      _lastPeerId: null,
      _debounceTimer: null,
    }
  },
  methods: {
    formatShortDate,
    isOwn(m) { return !!m && (m.sender_id === this.user.id || m.email === this.user.email) },
    async markAllRead() {
      try { await markConversationRead(this.peer.id) } catch {}
    },
    async handleSubmit() {
      const raw = this.newMessage.content || ''
      const trimmedEnd = raw.replace(/\s+$/g, '')
      if (trimmedEnd.trim().length === 0) return
      // Optimistic append
      const temp = {
        id: `temp-${Date.now()}`,
        sender_id: this.user.id,
        recipient_id: this.peer.id,
        content: trimmedEnd,
        created_at: new Date().toISOString(),
        read: false,
        optimistic: true,
        failed: false,
      }
      this.messages.push(temp)
      await this.$nextTick(); if (this.$refs.chatContainer) this.$refs.chatContainer.scrollTop = this.$refs.chatContainer.scrollHeight
      const contentForMatch = trimmedEnd
      this.newMessage.content = ''
      try {
        await sendDirectMessage(this.peer.id, trimmedEnd)
        // We'll reconcile on realtime INSERT by replacing the optimistic with the real row
      } catch (e) {
        // Mark temp as failed and notify
        const idx = this.messages.findIndex(m => m.id === temp.id)
        if (idx !== -1) this.messages[idx].failed = true
        try { pushErrorToast(e?.message || 'No se pudo enviar el mensaje') } catch {}
      }
    },
    async loadPeerProfile(id) {
      try {
        const { data } = await getPublicProfile(id)
        if (data) this.peer = { ...this.peer, ...data, id }
        else this.peer = { id, display_name: null, email: null, avatar_url: null }
      } catch {
        this.peer = { id, display_name: null, email: null, avatar_url: null }
      }
    },
    async loadConversation(peerId) {
      this.loading = true
      try {
        const { data } = await fetchConversation(peerId)
        this.messages = data || []
        await this.$nextTick()
        if (this.$refs.chatContainer) this.$refs.chatContainer.scrollTop = this.$refs.chatContainer.scrollHeight
        await markConversationRead(peerId)
      } finally {
        this.loading = false
      }
    },
    async loadChat(peerId) {
      // Debounce to avoid duplicate loads from mounted + watch
      if (this._debounceTimer) clearTimeout(this._debounceTimer)
      this._debounceTimer = setTimeout(() => this._doLoadChat(peerId), 50)
    },
    async _doLoadChat(peerId) {
      if (this._loadingChat || peerId === this._lastPeerId) return
      this._loadingChat = true
      this._lastPeerId = peerId
      await this.loadPeerProfile(peerId)
      await this.loadConversation(peerId)
      this.attachRealtime(peerId)
      this._loadingChat = false
    },
    attachRealtime(peerId) {
      if (unsubscribeDM) { try { unsubscribeDM() } catch {} }
      unsubscribeDM = subscribeConversation(peerId, {
        onInsert: async (row) => {
          // Only messages between me and the peer
          const a = row.sender_id, b = row.recipient_id
          const ok = (a === this.user.id && b === peerId) || (a === peerId && b === this.user.id)
          if (!ok) return
          // If it's my own outgoing message, try to replace an optimistic twin by content
          if (row.sender_id === this.user.id && row.recipient_id === peerId) {
            const idx = this.messages.findIndex(m => m.optimistic && !m.failed && m.content === row.content)
            if (idx !== -1) {
              this.messages.splice(idx, 1, { ...row })
            } else {
              this.messages.push(row)
            }
          } else {
            // Incoming message
            // Enrich sender for UI
            if (row.sender_id === this.peer.id) {
              row.display_name = this.peer.display_name; row.avatar_url = this.peer.avatar_url; row.email = this.peer.email
            }
            this.messages.push(row)
          }
          await this.$nextTick()
          if (this.$refs.chatContainer) this.$refs.chatContainer.scrollTop = this.$refs.chatContainer.scrollHeight
          // If I am the recipient, mark as read
          if (row.recipient_id === this.user.id) {
            try { await markConversationRead(peerId) } catch {}
          }
        },
        onUpdate: async (row) => {
          // Update read status in place
          const i = this.messages.findIndex(m => m.id === row.id)
          if (i !== -1) this.messages[i] = { ...this.messages[i], ...row }
        }
      })
    }
  },
  async mounted() {
    unsubscribeAuth = subscribeToAuthStateChanges(async (u) => { this.user = u })
    const peerId = this.$route.params.peerId
    if (!peerId) return
    await this.loadChat(peerId)
  },
  unmounted() {
    try { unsubscribeAuth() } catch {}
    try { unsubscribeDM() } catch {}
    if (this._debounceTimer) clearTimeout(this._debounceTimer)
  },
  watch: {
    '$route.params.peerId': {
      immediate: false,
      async handler(newId) {
        if (!newId) return
        await this.loadChat(newId)
      }
    }
  }
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between gap-2 mb-2">
      <AppH1>Mensaje con {{ peer.display_name || peer.email || 'usuario' }}</AppH1>
      <button @click="markAllRead" class="rounded-full px-3 py-1.5 text-xs font-semibold border border-white/10 text-slate-200 bg-white/5 hover:bg-white/10">
        Marcar todo como leído
      </button>
    </div>
    <section class="card p-0 overflow-hidden">
      <div class="flex flex-col h-[60vh] sm:h-[70vh]">
        <div class="flex-1 overflow-y-auto p-4" ref="chatContainer">
          <h2 class="sr-only">Mensajes directos</h2>
          <ol class="relative flex flex-col gap-3 items-start">
            <li
              v-for="m in messages"
              :key="m.id"
              :class="[
                'w-fit max-w-[90%] sm:max-w-[75%] rounded-2xl px-3 py-2 text-slate-100 shadow-sm border',
                isOwn(m) ? 'ml-auto bg-emerald-500/15 border-emerald-400/30' : 'bg-white/5 border-white/10'
              ]"
            >
              <div class="m-0 text-xs font-semibold text-slate-300" v-if="!isOwn(m)"><span>{{ m.display_name || peer.display_name || m.email || peer.email }}</span></div>
              <div class="whitespace-pre-line break-words text-sm">{{ m.content }}</div>
              <div class="m-0 text-[11px] text-slate-400 flex items-center gap-1" :class="isOwn(m) ? 'justify-end' : 'justify-start'">
                <span>{{ formatShortDate(m.created_at) }}</span>
                <span v-if="isOwn(m)" class="inline-flex items-center">
                  <!-- Status: failed -->
                  <svg v-if="m.failed" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-3.5 w-3.5 text-red-400 ml-1"><path d="M11 7h2v6h-2zm0 8h2v2h-2z"/></svg>
                  <!-- Status: optimistic pending (clock) -->
                  <svg v-else-if="m.optimistic" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-3.5 w-3.5 text-slate-400/70 ml-1"><path d="M12 1a11 11 0 1 0 11 11A11.012 11.012 0 0 0 12 1zm1 11H7V10h4V5h2z"/></svg>
                  <!-- Status: read receipts as single blue check; sent as single gray check -->
                  <svg v-else-if="m.read" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-3.5 w-3.5 text-[oklch(0.62_0.21_270)] ml-1"><path d="M9 16l-5-5 1.41-1.41L9 13.17l9.59-9.59L20 5z"/></svg>
                  <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-3.5 w-3.5 text-slate-400 ml-1"><path d="M9 16l-5-5 1.41-1.41L9 13.17l9.59-9.59L20 5z"/></svg>
                </span>
              </div>
            </li>
          </ol>
        </div>
        <!-- Input bar -->
        <form action="#" @submit.prevent="handleSubmit" class="p-2 bg-slate-900/60 border-t border-white/10">
          <div class="flex items-center gap-2">
            <div class="flex-1 flex items-center gap-2 rounded-full border border-white/10 bg-white/5 pl-3 pr-1.5 py-1.5">
              <input
                v-model="newMessage.content"
                type="text"
                placeholder="Escribe un mensaje"
                class="flex-1 bg-transparent outline-none text-slate-100 placeholder-slate-400"
                @keydown.enter.exact.prevent="handleSubmit"
              />
              <button type="submit" class="shrink-0 rounded-full bg-[oklch(0.62_0.21_270)] hover:brightness-110 text-white h-10 w-10 grid place-items-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-5 w-5">
                  <path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
              </button>
            </div>
          </div>
        </form>
      </div>
    </section>
  </div>
</template>


