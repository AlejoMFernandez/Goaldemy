<script>
import ProfileHeaderCard from '../components/profile/ProfileHeaderCard.vue'
import { getPublicProfile } from '../services/user-profiles'
import { subscribeToAuthStateChanges } from '../services/auth'
import { getStatusWith, sendRequest } from '../services/connections'
import { pushErrorToast } from '../stores/notifications'

export default {
  name: 'UserPublic',
  components: { ProfileHeaderCard },
  data() {
    return { user: null, loading: true, me: { id: null }, conn: { state: 'none', row: null }, busy: false }
  },
  async mounted() {
    const id = this.$route.params.id
    this._unsub = subscribeToAuthStateChanges(u => { this.me = u || { id: null }; this.refreshStatus() })
    try {
      const { data, error } = await getPublicProfile(id)
      if (error) console.error(error)
      this.user = data
      await this.refreshStatus()
    } catch (e) {
      this.user = null
    } finally {
      this.loading = false
    }
  },
  unmounted() { if (this._unsub) this._unsub() },
  computed: {
    avatarInitial() {
      const email = this.user?.email || ''
      return email ? email[0].toUpperCase() : '?'
    },
    displayName() {
      return this.user?.display_name || this.user?.email || '—'
    },
    isSelf() { return this.me?.id && this.user?.id && this.me.id === this.user.id },
    canConnect() { return !this.isSelf && this.me?.id && this.user?.id },
    connectLabel() {
      const s = this.conn?.state
      if (s === 'connected') return 'Conectados'
      if (s === 'pending_out') return 'Solicitud enviada'
      if (s === 'pending_in') return 'Responder solicitud'
      return 'Conectar'
    },
    connectDisabled() {
      const s = this.conn?.state
      return this.busy || s === 'connected' || s === 'pending_out'
    }
  },
  methods: {
    async refreshStatus() {
      if (!this.user?.id) return
      try { this.conn = await getStatusWith(this.user.id) } catch {}
    },
    async onConnect() {
      if (!this.canConnect) return
      if (this.conn?.state === 'pending_in') { pushErrorToast('Abrí notificaciones para responder'); return }
      this.busy = true
      try { await sendRequest(this.user.id); await this.refreshStatus() } catch (e) { try { pushErrorToast(e?.message || 'No se pudo conectar') } catch {} }
      finally { this.busy = false }
    }
  }
}
</script>

<template>
  <section class="mx-auto max-w-3xl pb-8">
    <div v-if="loading" class="text-slate-300">Cargando…</div>
    <template v-else>
      <ProfileHeaderCard
        :avatar-initial="avatarInitial"
        :avatar-url="user?.avatar_url"
        :display-name="displayName"
        :email="user?.email"
        :nationality-code="user?.nationality_code"
        :favorite-team="user?.favorite_team"
        :favorite-player="user?.favorite_player"
        :career="user?.career"
        :bio="user?.bio"
      />
      <div v-if="canConnect" class="mt-3">
        <button @click="onConnect" :disabled="connectDisabled" class="rounded-full px-4 py-2 text-sm font-semibold border"
          :class="[
            conn.state==='connected' ? 'bg-emerald-500/15 border-emerald-400/30 text-emerald-200' :
            conn.state==='pending_out' ? 'bg-amber-500/10 border-amber-400/30 text-amber-200' :
            conn.state==='pending_in' ? 'bg-sky-500/10 border-sky-400/30 text-sky-200' :
            'bg-[oklch(0.62_0.21_270)] border-white/10 text-white hover:brightness-110'
          ]">
          {{ connectLabel }}
        </button>
        <p v-if="conn.state==='pending_in'" class="mt-1 text-xs text-slate-400">Tenés una solicitud de esta persona. Respondela desde Notificaciones.</p>
      </div>
    </template>
  </section>
</template>

<style scoped>
</style>