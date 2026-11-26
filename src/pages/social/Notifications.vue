<script>
/**
 * NOTIFICACIONES (v4) — agrupadas por día (Hoy / Ayer / fecha), con la racha
 * en peligro destacada arriba y "Marcar todo como leído".
 * Fuentes: notifications.js (historial), connections.js (pedidos entrantes),
 * streak-calendar.js (racha). Tipos que hoy existen en la base:
 * friend_accepted, friend_added, friend_removed, duel_challenge y los pedidos
 * de amistad. Cualquier otro tipo se muestra genérico.
 */
import { listNotifications, markAsRead } from '../../services/notifications'
import { listIncomingRequests, acceptRequest, blockRequest } from '../../services/connections'
import { getPublicProfilesByIds } from '../../services/user-profiles'
import { getStreakProfile, addDaysKey } from '../../services/streak-calendar'
import { appToday } from '../../services/app-date'
import { formatTimeOnly, formatDayLabel } from '../../services/formatters'
import { publicName } from '../../services/social-hub'
import { tap, success as hapticSuccess } from '../../services/haptics'
import { pushErrorToast } from '../../stores/notifications'
import { shellState } from '../../components/shell/shell-state'
import { supabase } from '../../services/supabase'

const KIND = {
  friend: { bg: 'linear-gradient(160deg,#34d399,#047857)', icon: 'M9 12a4 4 0 100-8 4 4 0 000 8zM2 21c1-4 3.6-6 7-6s6 2 7 6M16 11l2 2 4-4' },
  request: { bg: 'linear-gradient(160deg,#34d399,#047857)', icon: 'M9 12a4 4 0 100-8 4 4 0 000 8zM2 21c1-4 3.6-6 7-6s6 2 7 6M19 8v6M16 11h6' },
  removed: { bg: 'linear-gradient(160deg,#475569,#1e293b)', icon: 'M9 12a4 4 0 100-8 4 4 0 000 8zM2 21c1-4 3.6-6 7-6s6 2 7 6M16 11h6' },
  duel: { bg: 'linear-gradient(160deg,#ef4444,#7f1d1d)', icon: 'M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2' },
  sys: { bg: 'linear-gradient(160deg,#334155,#1e293b)', icon: '' },
}

export default {
  name: 'Notifications',
  data() {
    return { loading: true, error: false, items: [], profiles: {}, busy: {}, meId: null, streak: null, today: appToday() }
  },
  computed: {
    unreadCount() { return this.items.filter(n => n.unread).length },
    streakDanger() {
      const s = this.streak
      if (!s?.current || !s.lastActivity) return null
      return s.lastActivity === addDaysKey(this.today, -1) ? s.current : null
    },
    groups() {
      const out = []
      let last = null
      for (const n of this.items) {
        const key = new Date(n.created_at).toDateString()
        if (key !== last) { out.push({ key, title: formatDayLabel(n.created_at), items: [] }); last = key }
        out[out.length - 1].items.push(n)
      }
      return out
    },
  },
  async mounted() {
    try { this.meId = (await supabase.auth.getUser())?.data?.user?.id || null } catch {}
    getStreakProfile().then(s => { this.streak = s }).catch(() => {})
    await this.loadAll()
  },
  methods: {
    tap,
    KIND(k) { return KIND[k] || KIND.sys },
    who(u) { return publicName(this.profiles[u] || {}) },
    when(ts) {
      const d = new Date(ts)
      const diff = Date.now() - d.getTime()
      if (diff < 3600000) return `hace ${Math.max(1, Math.round(diff / 60000))} min`
      if (new Date().toDateString() === d.toDateString()) return `hace ${Math.round(diff / 3600000)} h`
      return formatTimeOnly(ts)
    },
    describe(n) {
      const name = this.who(n.from_user)
      switch (n.type) {
        case 'request': return { kind: 'request', text: `${name} quiere ser tu amigo` }
        case 'friend_accepted': return { kind: 'friend', text: `${name} aceptó tu pedido de amistad` }
        case 'friend_added': return { kind: 'friend', text: `Ahora sos amigo de ${name}` }
        case 'friend_removed': return { kind: 'removed', text: n.payload?.initiator_id === this.meId ? `Sacaste a ${name} de tus amigos` : `${name} te sacó de sus amigos` }
        case 'duel_challenge': return { kind: 'duel', text: `${name} te retó`, cta: 'Responder', to: `/messages/${n.from_user}` }
        default: return { kind: 'sys', text: 'Tenés una novedad en FULVO' }
      }
    },
    async loadAll() {
      this.loading = true
      this.error = false
      try {
        const [{ data: notifs, error }, { data: incoming }] = await Promise.all([listNotifications(50), listIncomingRequests()])
        if (error) throw error
        const ids = new Set()
        for (const n of notifs || []) if (n?.from_user) ids.add(n.from_user)
        for (const r of incoming || []) if (r?.user_a) ids.add(r.user_a)
        if (ids.size) {
          const { data: profiles } = await getPublicProfilesByIds(Array.from(ids))
          this.profiles = Object.fromEntries((profiles || []).map(p => [p.id, p]))
        }
        const reqs = (incoming || []).map(r => ({ key: 'r' + r.id, type: 'request', connectionId: r.id, created_at: r.created_at, from_user: r.user_a, unread: true }))
        const rest = (notifs || []).filter(n => n?.type && n.type !== 'connection_request').map(n => ({
          key: 'n' + n.id, id: n.id, type: n.type, created_at: n.created_at, from_user: n.from_user, payload: n.payload, unread: !n.read,
        }))
        this.items = [...reqs, ...rest]
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .map(n => ({ ...n, ...this.describe(n) }))
      } catch {
        this.error = true
      } finally {
        this.loading = false
      }
    },
    async markOne(n) {
      if (!n.id || !n.unread) return
      n.unread = false
      try { await markAsRead(n.id); shellState.notifCount = Math.max(0, (shellState.notifCount || 0) - 1) } catch { n.unread = true }
    },
    async openItem(n) {
      tap()
      this.markOne(n)
      if (n.to) this.$router.push(n.to)
      else if (n.from_user) this.$router.push(`/u/${n.from_user}`)
    },
    async readAll() {
      tap()
      const pending = this.items.filter(n => n.id && n.unread)
      pending.forEach(n => { n.unread = false })
      const res = await Promise.allSettled(pending.map(n => markAsRead(n.id)))
      const failed = pending.filter((n, i) => res[i].status === 'rejected')
      failed.forEach(n => { n.unread = true })
      shellState.notifCount = failed.length
      if (failed.length) pushErrorToast('No pudimos marcar todo como leído')
    },
    async answer(n, ok) {
      if (this.busy[n.connectionId]) return
      tap()
      this.busy = { ...this.busy, [n.connectionId]: true }
      try {
        if (ok) { await acceptRequest(n.connectionId); hapticSuccess() } else await blockRequest(n.connectionId)
        this.items = this.items.filter(x => x.key !== n.key)
      } catch {
        pushErrorToast(ok ? 'No pudimos aceptar el pedido' : 'No pudimos rechazar el pedido')
      } finally {
        const b = { ...this.busy }; delete b[n.connectionId]; this.busy = b
      }
    },
    goBack() {
      tap()
      if (window.history.state?.back) this.$router.back()
      else this.$router.push('/social')
    },
  },
}
</script>

<template>
  <section class="max-w-xl mx-auto -mt-4 lg:mt-0 pb-6">
    <header class="nt-head">
      <button type="button" class="w-11 h-11 -ml-2 grid place-items-center rounded-xl text-slate-200" aria-label="Volver" @click="goBack">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>
      </button>
      <h1 class="flex-1 min-w-0 truncate font-display font-bold text-xl text-white">Notificaciones</h1>
      <button type="button" class="nt-readall" aria-label="Marcar todo como leído" :disabled="!items.some(n => n.id && n.unread)" @click="readAll">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 13l4 4 8-9M10 15l2 2 9-10"/></svg>
        {{ items.some(n => n.id && n.unread) ? 'Leer todo' : 'Todo leído' }}
      </button>
    </header>

    <div class="flex flex-col gap-2.5 pt-3">
      <!-- Racha en peligro -->
      <section v-if="streakDanger" class="nt-streak" aria-label="Racha en peligro">
        <span class="nt-flame" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="#fff"><path d="M12 2c1 4 5 6 5 11a5 5 0 01-10 0c0-2.4 1.2-3.9 2.3-5 .2 1.6.9 2.6 2 3 0-3.5.7-6.3.7-9z"/></svg>
        </span>
        <span class="flex-1 min-w-0 flex flex-col gap-0.5">
          <span class="nt-streak-t">Tu racha de {{ streakDanger }} {{ streakDanger === 1 ? 'día' : 'días' }} está en peligro</span>
          <span class="text-xs font-semibold text-orange-200">Jugá 1 juego antes de las 00:00</span>
        </span>
        <RouterLink to="/play/points" class="nt-play" @click="tap()">JUGAR</RouterLink>
      </section>

      <div v-if="loading" class="nt-card">
        <div v-for="i in 5" :key="i" class="nt-row"><span class="w-10 h-10 rounded-xl bg-white/5 animate-pulse"></span><span class="flex-1 flex flex-col gap-1.5"><span class="h-3 w-48 rounded bg-white/5 animate-pulse"></span><span class="h-2.5 w-16 rounded bg-white/5 animate-pulse"></span></span></div>
      </div>
      <div v-else-if="error" class="nt-card p-6 text-center">
        <p class="text-sm text-slate-300">No pudimos traer tus notificaciones.</p>
        <button type="button" class="mt-3 min-h-[44px] px-5 rounded-xl border border-white/15 text-sm font-bold text-white" @click="loadAll">Reintentar</button>
      </div>
      <div v-else-if="!items.length" class="nt-card px-6 py-10 text-center">
        <p class="font-display font-bold text-white">Estás al día</p>
        <p class="text-[13px] text-slate-400 mt-1">Acá vas a ver pedidos de amistad, retos y novedades de tus amigos.</p>
      </div>

      <template v-else>
      <section v-for="g in groups" :key="g.key" :aria-label="g.title" class="flex flex-col gap-1.5">
        <h2 class="nt-day">{{ g.title }}</h2>
        <TransitionGroup tag="div" name="nt-row" class="nt-card">
          <div v-for="n in g.items" :key="n.key" class="nt-row" :class="n.unread ? 'is-unread' : ''">
            <button type="button" class="flex items-center gap-[11px] flex-1 min-w-0 min-h-[46px] text-left" @click="openItem(n)">
              <span class="nt-ic" :style="{ background: KIND(n.kind).bg }" aria-hidden="true">
                <svg v-if="KIND(n.kind).icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path :d="KIND(n.kind).icon"/></svg>
                <img v-else src="/iconclaro.png" alt="" width="18" height="24" />
              </span>
              <span class="flex-1 min-w-0 flex flex-col gap-0.5">
                <span class="nt-text">{{ n.text }}</span>
                <span class="text-[11px] font-semibold text-slate-500">{{ when(n.created_at) }}</span>
              </span>
            </button>
            <template v-if="n.type === 'request'">
              <button type="button" class="nt-cta" :disabled="busy[n.connectionId]" :aria-label="`Rechazar a ${who(n.from_user)}`" @click="answer(n, false)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
              </button>
              <button type="button" class="nt-cta is-gold" :disabled="busy[n.connectionId]" @click="answer(n, true)">Aceptar</button>
            </template>
            <RouterLink v-else-if="n.cta" :to="n.to" class="nt-cta is-gold" @click="markOne(n)">{{ n.cta }}</RouterLink>
            <span class="nt-dot" :class="n.unread ? 'is-on' : ''" :aria-label="n.unread ? 'Sin leer' : undefined"></span>
          </div>
        </TransitionGroup>
      </section>
      </template>
    </div>
  </section>
</template>

<style scoped>
.nt-head { display: flex; align-items: center; gap: 4px; min-height: 52px; border-bottom: 1px solid rgba(255,255,255,0.06); }
.nt-readall { flex-shrink: 0; white-space: nowrap; min-height: 44px; padding: 0 2px 0 6px; display: inline-flex; align-items: center; gap: 5px; font-weight: 700; font-size: 12.5px; color: #fbbf24; }
.nt-readall:disabled { color: #64748b; }
.nt-streak {
  position: relative; overflow: hidden; border-radius: 18px; padding: 12px; display: flex; align-items: center; gap: 12px;
  background: linear-gradient(135deg, #9a3412 0%, #431407 100%); border: 1.5px solid #fb923c; box-shadow: 0 8px 24px rgba(249,115,22,0.25);
}
.nt-flame {
  width: 50px; height: 50px; flex-shrink: 0; border-radius: 50%; display: grid; place-items: center;
  background: radial-gradient(circle at 50% 35%, #fdba74, #ea580c); border: 2px solid #fed7aa; animation: nt-flame 1.6s ease-in-out infinite;
}
@keyframes nt-flame { 50% { transform: scale(1.08); } }
.nt-streak-t { font-family: var(--font-shout); font-weight: 800; font-style: italic; font-size: 20px; line-height: 1; text-transform: uppercase; color: #fff; }
.nt-play {
  min-height: 46px; padding: 0 14px; border-radius: 12px; background: linear-gradient(180deg, #fcd34d, #f59e0b); border-bottom: 4px solid #b45309;
  color: #1c1206; display: inline-flex; align-items: center; font-family: var(--font-shout); font-weight: 800; font-style: italic; font-size: 19px;
}
.nt-day { font-size: 12px; font-weight: 800; letter-spacing: 1.2px; text-transform: uppercase; color: #94a3b8; padding: 2px 2px 0; }
.nt-card { border-radius: 16px; border: 1px solid rgba(255,255,255,0.08); overflow: hidden; }
.nt-row { min-height: 64px; box-sizing: border-box; padding: 9px 10px 9px 12px; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid rgba(255,255,255,0.06); transition: background-color .2s ease; }
.nt-row:last-child { border-bottom: 0; }
.nt-row.is-unread { background: rgba(96,165,250,0.08); }
.nt-ic { width: 40px; height: 40px; flex-shrink: 0; border-radius: 12px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.3); display: grid; place-items: center; color: #fff; }
.nt-text { font-size: 13.5px; line-height: 1.3; font-weight: 500; color: #cbd5e1; }
.is-unread .nt-text { font-weight: 700; color: #f1f5f9; }
.nt-cta {
  min-height: 44px; min-width: 44px; padding: 0 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.16); background: rgba(255,255,255,0.04);
  color: #e2e8f0; display: inline-flex; align-items: center; justify-content: center; font-weight: 800; font-size: 12.5px; white-space: nowrap; flex-shrink: 0;
}
.nt-cta.is-gold { background: linear-gradient(180deg, #fcd34d, #f59e0b); border-color: #b45309; color: #1c1206; }
.nt-cta:disabled { opacity: .5; }
.nt-dot { width: 9px; height: 9px; flex-shrink: 0; border-radius: 50%; background: transparent; }
.nt-dot.is-on { background: #60a5fa; }
.nt-row-leave-active { transition: opacity .2s ease, transform .2s ease; }
.nt-row-leave-to { opacity: 0; transform: translateX(24px); }
@media (prefers-reduced-motion: reduce) {
  .nt-flame { animation: none; }
  .nt-row { transition: none; }
  .nt-row-leave-active { transition: opacity .1s ease; }
  .nt-row-leave-to { transform: none; }
}
</style>
