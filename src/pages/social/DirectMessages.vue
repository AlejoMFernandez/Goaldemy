<script>
/**
 * MENSAJES (v4) — lista de conversaciones con el mismo lenguaje que Social y
 * el chat: avatar con borde, último mensaje (las tarjetas de juego se resumen
 * como "Te retó a…"), hora y no leídos.
 */
import { subscribeToAuthStateChanges } from '../../services/auth'
import { fetchRecentConversations } from '../../services/direct-messages'
import { getEquippedCosmeticsBatch } from '../../services/cosmetics'
import { formatShortDate, formatTimeOnly } from '../../services/formatters'
import { previewText } from '../../services/chat-cards'
import { publicName, initialOf } from '../../services/social-hub'
import { presenceState } from '../../services/presence'
import UserAvatar from '../../components/common/UserAvatar.vue'

let unsubscribeAuth = () => {}

export default {
  name: 'DirectMessagesIndex',
  components: { UserAvatar },
  data() {
    return { user: { id: null }, threads: [], cos: {}, loading: false, error: false }
  },
  methods: {
    initialOf,
    publicName,
    preview(t) { return (t.last_from_me ? 'Vos: ' : '') + previewText(t.last?.content, t.last_from_me).split('\n')[0] },
    when(iso) {
      if (!iso) return ''
      const d = new Date(iso)
      return new Date().toDateString() === d.toDateString() ? formatTimeOnly(iso) : formatShortDate(iso)
    },
    online(id) { return !!presenceState.value?.[id] },
    async load() {
      if (this.loading) return
      this.loading = true
      this.error = false
      try {
        const { data, error } = await fetchRecentConversations()
        if (error) throw error
        this.threads = data || []
        const ids = this.threads.map(t => t.peer_id)
        this.cos = ids.length ? await getEquippedCosmeticsBatch(ids).catch(() => ({})) : {}
      } catch { this.error = true }
      finally { this.loading = false }
    },
  },
  async mounted() {
    let first = true
    unsubscribeAuth = subscribeToAuthStateChanges(async (u) => {
      const changed = u?.id !== this.user?.id
      this.user = u
      if (!first && changed) await this.load()
      first = false
    })
    await this.load()
  },
  unmounted() { try { unsubscribeAuth() } catch {} },
}
</script>

<template>
  <section class="max-w-xl mx-auto -mt-4 lg:mt-0">
    <header class="flex items-center gap-1 pt-1 pb-3">
      <RouterLink :to="{ path: '/social', query: { tab: 'amigos' } }" class="w-11 h-11 -ml-2 grid place-items-center rounded-xl text-slate-200" aria-label="Volver a Social">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>
      </RouterLink>
      <h1 class="font-display font-bold text-2xl text-white">Mensajes</h1>
    </header>

    <div v-if="loading && !threads.length" class="dm-card">
      <div v-for="i in 5" :key="i" class="dm-row"><span class="w-11 h-11 rounded-xl bg-white/5 animate-pulse"></span><span class="flex-1 flex flex-col gap-1.5"><span class="h-3 w-28 rounded bg-white/5 animate-pulse"></span><span class="h-2.5 w-44 rounded bg-white/5 animate-pulse"></span></span></div>
    </div>
    <div v-else-if="error" class="dm-card p-6 text-center">
      <p class="text-sm text-slate-300">No pudimos traer tus conversaciones.</p>
      <button type="button" class="mt-3 min-h-[44px] px-5 rounded-xl border border-white/15 text-sm font-bold text-white" @click="load">Reintentar</button>
    </div>
    <div v-else-if="!threads.length" class="dm-card px-6 py-10 text-center">
      <p class="font-display font-bold text-white">Todavía no tenés conversaciones</p>
      <p class="text-[13px] text-slate-400 mt-1">Entrá a Social y mandale un mensaje (o un reto) a un amigo.</p>
      <RouterLink :to="{ path: '/social', query: { tab: 'amigos' } }" class="mt-4 inline-flex min-h-[44px] items-center rounded-xl px-5 font-bold text-slate-900 bg-gradient-to-b from-amber-300 to-amber-500">Ir a Amigos</RouterLink>
    </div>
    <ul v-else class="dm-card">
      <li v-for="t in threads" :key="t.peer_id">
        <RouterLink :to="`/messages/${t.peer_id}`" class="dm-row">
          <span class="relative shrink-0">
            <UserAvatar :size="44" :avatar-url="t.profile?.avatar_url || ''" :initial="initialOf(publicName(t.profile))"
              :frame-key="cos[t.peer_id]?.frameKey || 'none'" :icon-glyph="cos[t.peer_id]?.iconGlyph || ''" :icon-bg="cos[t.peer_id]?.iconBg || 'emerald'" :glow="false" />
            <span v-if="online(t.peer_id)" class="dm-dot" aria-label="En línea"></span>
          </span>
          <span class="flex-1 min-w-0">
            <span class="flex items-baseline gap-2">
              <span class="font-bold text-sm text-white truncate" :class="t.unread ? '' : 'font-semibold'">{{ publicName(t.profile) }}</span>
              <span class="ml-auto text-[11px] shrink-0" :class="t.unread ? 'text-amber-300 font-bold' : 'text-slate-500'">{{ when(t.last?.created_at) }}</span>
            </span>
            <span class="flex items-center gap-2 mt-0.5">
              <span class="text-[13px] truncate" :class="t.unread ? 'text-slate-100 font-semibold' : 'text-slate-400'">{{ preview(t) }}</span>
              <span v-if="t.unread > 0" class="dm-n">{{ t.unread > 9 ? '9+' : t.unread }}</span>
            </span>
          </span>
        </RouterLink>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.dm-card { border-radius: 16px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.03); overflow: hidden; }
.dm-row { min-height: 64px; padding: 9px 12px; display: flex; align-items: center; gap: 11px; border-bottom: 1px solid rgba(255,255,255,0.06); transition: background-color .15s ease; }
li:last-child .dm-row, .dm-card > .dm-row:last-child { border-bottom: 0; }
.dm-row:active { background: rgba(255,255,255,0.05); }
.dm-dot { position: absolute; right: -3px; bottom: -3px; width: 12px; height: 12px; border-radius: 50%; background: #22c55e; border: 2.5px solid #0f1729; }
.dm-n { margin-left: auto; flex-shrink: 0; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 999px; background: #f43f5e; font-size: 11px; font-weight: 800; line-height: 20px; text-align: center; color: #fff; }
@media (prefers-reduced-motion: reduce) { .dm-row { transition: none; } }
</style>
