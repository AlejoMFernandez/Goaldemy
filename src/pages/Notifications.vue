<script>
import { listNotifications, markAsRead } from '../services/notifications'
import { listIncomingRequests, acceptRequest, blockRequest } from '../services/connections'
import { getPublicProfilesByIds } from '../services/user-profiles'
import AppH1 from '../components/AppH1.vue'
import { supabase } from '../services/supabase'

export default {
  name: 'Notifications',
  components: { AppH1 },
  data() {
    return { loading: true, items: [], profiles: {}, busy: {}, meId: null }
  },
  async mounted() {
    try { this.meId = (await supabase.auth.getUser())?.data?.user?.id || null } catch {}
    await this.loadAll()
  },
  methods: {
    async loadAll() {
      this.loading = true
      try {
        const [{ data: notifs }, { data: incoming }] = await Promise.all([
          listNotifications(50),
          listIncomingRequests(),
        ])
        const ids = new Set()
        for (const n of notifs) if (n?.from_user) ids.add(n.from_user)
        for (const r of incoming) if (r?.user_a) ids.add(r.user_a)
        if (ids.size) {
          const { data: profiles } = await getPublicProfilesByIds(Array.from(ids))
          const map = {}
          for (const p of profiles || []) map[p.id] = p
          this.profiles = map
        }
        // Merge: show incoming requests at top, then other notifications
        const reqs = (incoming||[]).map(r => ({ kind: 'request', connection: r, created_at: r.created_at, from_user: r.user_a }))
        // Excluir 'connection_request' (lo tratamos como requests) y quedarnos con historial útil
        const rest = (notifs||[]).filter(n => n?.type && n.type !== 'connection_request').map(n => ({
          kind: 'log', id: n.id, type: n.type, created_at: n.created_at, from_user: n.from_user, read: n.read
        }))
        this.items = [...reqs, ...rest]
      } finally {
        this.loading = false
      }
    },
    p(u) { return this.profiles[u] || {} },
    who(u) { const pp = this.p(u); return pp.display_name || pp.email || 'Usuario' },
    fmtWhen(ts) {
      const d = new Date(ts)
      const now = Date.now()
      const diffMs = now - d.getTime()
      const oneHour = 60 * 60 * 1000
      const oneDay = 24 * oneHour
      if (diffMs < oneDay) {
        if (diffMs < oneHour) { const mins = Math.max(1, Math.round(diffMs / (60 * 1000))); return `Hace ${mins}m` }
        const hrs = Math.max(1, Math.round(diffMs / oneHour)); return `Hace ${hrs}h` }
      const mm = String(d.getMonth()+1).padStart(2,'0'); const dd = String(d.getDate()).padStart(2,'0'); return `${mm}/${dd}`
    },
    fmtWhenFull(ts) { return new Date(ts).toLocaleString() },
    async onAccept(connId, notifId=null) {
      this.$set(this.busy, connId, true)
      try { await acceptRequest(connId); if (notifId) await markAsRead(notifId) } finally { this.$delete(this.busy, connId); await this.loadAll() }
    },
    async onReject(connId, notifId=null) {
      this.$set(this.busy, connId, true)
      try { await blockRequest(connId); if (notifId) await markAsRead(notifId) } finally { this.$delete(this.busy, connId); await this.loadAll() }
    },
    async markOne(n) {
      if (n.kind !== 'log' || n.read) return
      try { await markAsRead(n.id); n.read = true } catch {}
    }
  }
}
</script>

<template>
  <section class="container mx-auto max-w-3xl pb-8">
    <div class="mb-4 flex items-center justify-between">
      <AppH1>Notificaciones</AppH1>
    </div>
    <div v-if="loading" class="text-slate-300">Cargando…</div>
    <div v-else>
      <div v-if="!items.length" class="text-slate-400">No tenés notificaciones</div>
      <ul v-else class="flex flex-col gap-2">
        <li v-for="(n, idx) in items" :key="idx" class="relative rounded-xl border border-white/10 bg-white/5 p-3 flex items-center gap-3" @mouseenter="markOne(n)">
          <template v-if="n.kind==='request'">
            <router-link :to="`/u/${n.from_user}`" class="shrink-0">
              <img v-if="p(n.from_user).avatar_url" :src="p(n.from_user).avatar_url" class="w-10 h-10 rounded-lg object-cover" alt="avatar" />
              <div v-else class="w-10 h-10 rounded-lg bg-slate-700 grid place-items-center text-slate-300">
                {{ ((p(n.from_user).display_name || p(n.from_user).email || '?').trim()[0] || '?').toUpperCase() }}
              </div>
            </router-link>
            <div class="flex-1 min-w-0">
              <div class="text-slate-100 text-[13px] leading-snug">{{ who(n.from_user) }} quiere conectarse con vos</div>
              <div class="text-[11px] text-slate-400">{{ fmtWhen(n.created_at) }}</div>
            </div>
            <div class="flex items-center gap-1">
              <button @click="onAccept(n.connection.id)" :disabled="busy[n.connection.id]" title="Aceptar" class="inline-flex items-center justify-center rounded-full border border-emerald-400/40 text-emerald-300 hover:bg-emerald-400/10 w-8 h-8">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
              </button>
              <button @click="onReject(n.connection.id)" :disabled="busy[n.connection.id]" title="Rechazar" class="inline-flex items-center justify-center rounded-full border border-red-400/40 text-red-300 hover:bg-red-400/10 w-8 h-8">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
          </template>
          <template v-else-if="n.kind==='log'">
            <router-link :to="`/u/${n.from_user}`" class="shrink-0">
              <img v-if="p(n.from_user).avatar_url" :src="p(n.from_user).avatar_url" class="w-10 h-10 rounded-lg object-cover" alt="avatar" />
              <div v-else class="w-10 h-10 rounded-lg bg-slate-700 grid place-items-center text-slate-300">
                {{ ((p(n.from_user).display_name || p(n.from_user).email || '?').trim()[0] || '?').toUpperCase() }}
              </div>
            </router-link>
            <div class="flex-1 min-w-0">
              <div class="text-slate-100 text-[13px] leading-snug">
                <template v-if="n.type==='friend_accepted'"><router-link :to="`/u/${n.from_user}`" class="hover:underline">{{ who(n.from_user) }}</router-link>&nbsp;aceptó tu solicitud y ahora son amigos</template>
                <template v-else-if="n.type==='friend_added'"><router-link :to="`/u/${n.from_user}`" class="hover:underline">{{ who(n.from_user) }}</router-link>&nbsp;fue agregado como amigo</template>
                <template v-else-if="n.type==='friend_removed'">
                  <template v-if="n.payload && n.payload.initiator_id && n.payload.initiator_id === meId">
                    Cancelaste la conexión con <router-link :to="`/u/${n.from_user}`" class="hover:underline">{{ who(n.from_user) }}</router-link>
                  </template>
                  <template v-else>
                    <router-link :to="`/u/${n.from_user}`" class="hover:underline">{{ who(n.from_user) }}</router-link>&nbsp;canceló la conexión
                  </template>
                </template>
                <template v-else>Notificación</template>
              </div>
              <div class="text-[11px] text-slate-400">{{ fmtWhenFull(n.created_at) }}</div>
            </div>
            <!-- Right-side stripe for unread -->
            <div v-if="!n.read" class="absolute right-0 top-0 h-full w-1 bg-sky-400 rounded-r"></div>
          </template>
        </li>
      </ul>
    </div>
  </section>
</template>
