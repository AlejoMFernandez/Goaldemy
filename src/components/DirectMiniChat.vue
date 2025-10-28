<script>
import { fetchConversation, sendDirectMessage, subscribeConversation, markConversationRead } from '../services/direct-messages'
import { formatShortDate } from '../services/formatters'
import { getPublicProfile } from '../services/user-profiles'
import { subscribeToAuthStateChanges } from '../services/auth'
import { pushErrorToast } from '../stores/notifications'

let unsubscribeAuth = () => {}
let unsubscribeDM = () => {}

export default {
  name: 'DirectMiniChat',
  props: {
    peerId: { type: String, required: true },
    onClose: { type: Function, default: () => {} }, // toggle collapse
    onRemove: { type: Function, default: () => {} }, // close window
  },
  data() {
    return {
      user: { id: null, email: null },
      peer: { id: null, display_name: null, email: null, avatar_url: null },
      messages: [],
      newMessage: { content: '' },
      loading: false,
    }
  },
  methods: {
    formatShortDate,
    isOwn(m) { return !!m && (m.sender_id === this.user.id || m.email === this.user.email) },
    async handleSubmit() {
      const raw = this.newMessage.content || ''
      const trimmedEnd = raw.replace(/\s+$/g, '')
      if (trimmedEnd.trim().length === 0) return
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
      this.newMessage.content = ''
      try { await sendDirectMessage(this.peer.id, trimmedEnd) } catch (e) {
        const idx = this.messages.findIndex(m => m.id === temp.id)
        if (idx !== -1) this.messages[idx].failed = true
        try { pushErrorToast(e?.message || 'No se pudo enviar el mensaje') } catch {}
      }
    },
    async loadPeerProfile(id) {
      try { const { data } = await getPublicProfile(id); this.peer = data ? { ...data, id } : { id } } catch { this.peer = { id } }
    },
    async loadConversation() {
      this.loading = true
      try {
        const { data } = await fetchConversation(this.peer.id)
        this.messages = data || []
        await this.$nextTick(); if (this.$refs.chatContainer) this.$refs.chatContainer.scrollTop = this.$refs.chatContainer.scrollHeight
        await markConversationRead(this.peer.id)
      } finally { this.loading = false }
    },
    attachRealtime() {
      if (unsubscribeDM) { try { unsubscribeDM() } catch {} }
      const peerId = this.peer.id
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
            if (row.sender_id === this.peer.id) {
              row.display_name = this.peer.display_name; row.avatar_url = this.peer.avatar_url; row.email = this.peer.email
            }
            this.messages.push(row)
          }
          await this.$nextTick(); if (this.$refs.chatContainer) this.$refs.chatContainer.scrollTop = this.$refs.chatContainer.scrollHeight
          if (row.recipient_id === this.user.id) { try { await markConversationRead(peerId) } catch {} }
        },
        onUpdate: async (row) => {
          const i = this.messages.findIndex(m => m.id === row.id)
          if (i !== -1) this.messages[i] = { ...this.messages[i], ...row }
        }
      })
    }
  },
  async mounted() {
    unsubscribeAuth = subscribeToAuthStateChanges(async (u) => { this.user = u })
    await this.loadPeerProfile(this.peerId)
    await this.loadConversation()
    this.attachRealtime()
  },
  unmounted() { try { unsubscribeAuth() } catch {}; try { unsubscribeDM() } catch {} }
}
</script>

<template>
  <div class="w-[360px] sm:w-[380px] bg-slate-900/95 backdrop-blur rounded-t-2xl border border-white/10 border-b-0 shadow-2xl overflow-hidden">
    <div class="flex items-center gap-2 p-2 border-b border-white/10 cursor-pointer" @click="onClose && onClose()">
      <img v-if="peer?.avatar_url" :src="peer.avatar_url" alt="avatar" class="h-7 w-7 rounded-full" />
      <div v-else class="h-7 w-7 rounded-full bg-slate-700 grid place-items-center text-xs text-slate-200">
        {{ ((peer?.display_name || peer?.email || '?').trim()[0] || '?').toUpperCase() }}
      </div>
      <div class="font-semibold text-slate-100 truncate">
        {{ peer.display_name || peer.email || 'usuario' }}
      </div>
      <button @click.stop="onRemove && onRemove()" class="ml-auto rounded-md h-7 w-7 grid place-items-center hover:bg-white/5" aria-label="Cerrar">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-4 w-4"><path d="M19 13H5v-2h14z"/></svg>
      </button>
    </div>
    <div class="flex flex-col h-[46vh]">
      <div class="flex-1 overflow-y-auto p-3" ref="chatContainer">
        <ol class="relative flex flex-col gap-2 items-start">
          <li v-for="m in messages" :key="m.id" :class="['w-fit max-w-[85%] rounded-2xl px-3 py-1.5 text-slate-100 shadow-sm border', isOwn(m) ? 'ml-auto bg-emerald-500/15 border-emerald-400/30' : 'bg-white/5 border-white/10']">
            <div class="whitespace-pre-line break-words text-[13px]">{{ m.content }}</div>
            <div class="m-0 text-[11px] text-slate-400 flex items-center gap-1" :class="isOwn(m) ? 'justify-end' : 'justify-start'">
              <span>{{ formatShortDate(m.created_at) }}</span>
              <span v-if="isOwn(m)" class="inline-flex items-center">
                <svg v-if="m.failed" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-3.5 w-3.5 text-red-400 ml-1"><path d="M11 7h2v6h-2zm0 8h2v2h-2z"/></svg>
                <svg v-else-if="m.optimistic" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-3.5 w-3.5 text-slate-400/70 ml-1"><path d="M12 1a11 11 0 1 0 11 11A11.012 11.012 0 0 0 12 1zm1 11H7V10h4V5h2z"/></svg>
                <svg v-else-if="m.read" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-3.5 w-3.5 text-[oklch(0.62_0.21_270)] ml-1"><path d="M9 16l-5-5 1.41-1.41L9 13.17l9.59-9.59L20 5z"/></svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-3.5 w-3.5 text-slate-400 ml-1"><path d="M9 16l-5-5 1.41-1.41L9 13.17l9.59-9.59L20 5z"/></svg>
              </span>
            </div>
          </li>
        </ol>
      </div>
      <form action="#" @submit.prevent="handleSubmit" class="p-2 bg-slate-900/60 border-t border-white/10">
        <div class="flex items-center gap-2">
          <div class="flex-1 flex items-center gap-2 rounded-full border border-white/10 bg-white/5 pl-3 pr-1.5 py-1.5">
            <input v-model="newMessage.content" type="text" placeholder="Escribe un mensaje" class="flex-1 bg-transparent outline-none text-slate-100 placeholder-slate-400" @keydown.enter.exact.prevent="handleSubmit" />
            <button type="submit" class="shrink-0 rounded-full bg-[oklch(0.62_0.21_270)] hover:brightness-110 text-white h-9 w-9 grid place-items-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-5 w-5"><path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z"/></svg>
            </button>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.slide-up-enter-active, .slide-up-leave-active { transition: transform .18s ease, opacity .18s ease; }
.slide-up-enter-from, .slide-up-leave-to { transform: translateY(8px); opacity: 0; }
</style>
