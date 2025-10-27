<script>
import AppH1 from '../components/AppH1.vue';
import { subscribeToAuthStateChanges } from '../services/auth';
import { getUserLevel } from '../services/xp';
import { getUserAchievements } from '../services/achievements';
import { getUserXpByGame } from '../services/games';
import { getPublicProfile } from '../services/user-profiles';
import { getStatusWith, sendRequest, disconnectWith } from '../services/connections';
import { pushErrorToast } from '../stores/notifications';
import ProfileHeaderCard from '../components/profile/ProfileHeaderCard.vue';
import AchievementsCard from '../components/profile/AchievementsCard.vue';
// XpByGameCard inlined into XpDonutChart list
import XpDonutChart from '../components/profile/XpDonutChart.vue';
import ProgressCard from '../components/profile/ProgressCard.vue';
import { getUserMaxStreakByGame } from '../services/xp';
import { checkAndUnlockSpecials } from '../services/special-badges';
import ConnectionsCard from '../components/profile/ConnectionsCard.vue';
import CommunityCard from '../components/profile/CommunityCard.vue';
import { findTeamByName, findPlayerByName } from '../services/players';
import { listConnections } from '../services/connections';
import { getPublicProfilesByIds } from '../services/user-profiles';

let unsubscribeAuth = () => {};

export default {
  name: 'Profile',
  components: { AppH1, ProfileHeaderCard, AchievementsCard, XpDonutChart, ProgressCard, ConnectionsCard, CommunityCard },
  data() {
    return {
      // This holds the profile being viewed (own or other user's)
      user: {
        id: null,
        email: null,
        display_name: null,
        bio: null,
        career: null,
      },
      // Authenticated user's id (used when no :id param)
      currentAuthId: null,
      levelInfo: null,
      levelLoading: false,
      achievements: [],
      achLoading: false,
      xpByGame: [],
      xpByGameLoading: false,
  maxStreaks: [],
  maxStreaksLoading: false,
  streaksMap: {},
  dailyStreaksItems: [], // [{ slug, name, current, best }]
  dailyStreaksLoading: false,
      // Placeholders for future community data
      followerCount: 0,
      followingCount: 0,
      groupCount: 0,
      forumsCount: 0,
      messagesCount: 0,
      discussionsStartedCount: 0,
      // Derived visuals for header
      favTeamLogo: '',
      favPlayerImage: '',
      socials: [],
      // Connections state
      conn: { state: 'none', row: null },
      connBusy: false,
      connectionsList: [],
      connectionsLoading: false,
    };
  },
  computed: {
    avatarInitial() {
      if (!this.user || !this.user.email) return '?';
      const letter = this.user.email.trim()[0] || '?';
      return letter.toUpperCase();
    },
    displayName() {
      return this.user?.display_name || this.user?.email || '—';
    },
    progressPercent() {
      if (!this.levelInfo) return 0;
      if (!this.levelInfo.next_level_xp) return 100;
      const completed = this.levelInfo.next_level_xp - (this.levelInfo.xp_to_next ?? 0);
      const denom = this.levelInfo.next_level_xp || 1;
      const pct = Math.max(0, Math.min(100, Math.round((completed / denom) * 100)));
      return pct;
    },
    xpNow() {
      return this.levelInfo?.xp_total ?? 0;
    },
    isSelf() {
      return (this.$route.params.id || this.currentAuthId) === this.currentAuthId
    },
    canConnect() { return !this.isSelf && !!this.currentAuthId && !!this.user?.id },
    connectLabel() {
      const s = this.conn?.state
      if (s === 'connected') return 'Conectados'
      if (s === 'pending_out') return 'Solicitud enviada'
      if (s === 'pending_in') return 'Responder solicitud'
      return 'Conectar'
    },
    connectDisabled() {
      const s = this.conn?.state
      return this.connBusy || s === 'connected' || s === 'pending_out'
    },
  },
  mounted() {
    // Subscribe to auth to know the default profile id when there's no :id param
    unsubscribeAuth = subscribeToAuthStateChanges(async (userState) => {
      console.debug('[Profile.vue] auth state:', userState?.id)
      this.currentAuthId = userState?.id || null
      // Reload if viewing own profile and auth changed
      this.ensureLoad()
    });
    // Initial load
    this.ensureLoad()
    // React to route changes (/u/:id)
    this.$watch(() => this.$route.params.id, () => this.ensureLoad())
  },
  unmounted() {
    unsubscribeAuth();
  },
  methods: {
    async ensureLoad() {
      const paramId = this.$route.params.id
      const targetId = paramId || this.currentAuthId
      if (!targetId) {
        // Anonymous and no target id
        this.user = { id: null, email: null, display_name: null, bio: null, career: null }
        this.levelInfo = null
        this.achievements = []
        this.xpByGame = []
        return
      }
      await this.loadFor(targetId)
    },
    async loadFor(userId) {
      try {
        // Load public profile info for display (works for own and others)
        const { data: profile, error } = await getPublicProfile(userId)
        if (error) console.error('[Profile.vue] getPublicProfile error:', error)
        // Fall back: at least set id when not found
        this.user = profile ? { ...profile, id: userId } : { id: userId }
        // Derive logos from favorites
        try {
          const team = this.user?.favorite_team ? findTeamByName(this.user.favorite_team) : null
          this.favTeamLogo = team?.logo || ''
        } catch {}
        try {
          const player = this.user?.favorite_player ? findPlayerByName(this.user.favorite_player) : null
          this.favPlayerImage = player?.image || ''
        } catch {}
  // Build socials from profile fields
  const s = []
  if (this.user?.linkedin_url) s.push({ type: 'linkedin', url: this.user.linkedin_url })
  if (this.user?.github_url) s.push({ type: 'github', url: this.user.github_url })
  if (this.user?.x_url) s.push({ type: 'twitter', url: this.user.x_url })
  if (this.user?.instagram_url) s.push({ type: 'instagram', url: this.user.instagram_url })
  this.socials = s
      } catch (e) {
        console.error('[Profile.vue] getPublicProfile exception:', e)
        this.user = { id: userId }
      }

      // Level
      this.levelLoading = true
      try {
        const { data, error } = await getUserLevel(userId)
        if (error) console.error('getUserLevel error:', error)
        this.levelInfo = Array.isArray(data) ? data[0] : data
      } catch (e) {
        console.error('getUserLevel exception:', e)
        this.levelInfo = null
      } finally {
        this.levelLoading = false
      }

      // Achievements
      this.achLoading = true
      try {
        const { data: ach, error: achErr } = await getUserAchievements(userId)
        if (achErr) console.error('load achievements error:', achErr)
        this.achievements = ach || []
      } catch (e) {
        console.error('achievements exception:', e)
        this.achievements = []
      } finally {
        this.achLoading = false
      }

      // XP by game
      this.xpByGameLoading = true
      try {
        const { data: xpRows, error: xpErr } = await getUserXpByGame(userId)
        // Silenciar el caso esperado de RPC inexistente que ya cubrimos con fallback
        if (xpErr && !(xpErr.code === 'PGRST202' || /Could not find the function/i.test(xpErr.message || ''))) {
          console.error('load xp by game error:', xpErr)
        }
        this.xpByGame = xpRows || []
      } catch (e) {
        // Evitar ruido si el backend no tiene el RPC todavía
        if (!(e?.code === 'PGRST202' || /Could not find the function/i.test(e?.message || ''))) {
          console.error('xp by game exception:', e)
        }
        this.xpByGame = []
      } finally {
        this.xpByGameLoading = false
      }

  // Max streaks by game
      this.maxStreaksLoading = true
      try {
        const { data: sRows } = await getUserMaxStreakByGame(userId)
        this.maxStreaks = sRows || []
        const map = {}
        for (const r of this.maxStreaks) if (r && r.id) map[r.id] = r.streak || 0
        this.streaksMap = map
      } catch (e) {
        this.maxStreaks = []
        this.streaksMap = {}
      } finally {
        this.maxStreaksLoading = false
      }

      // Daily streaks (current and best) - own profile only due to RLS
      try {
        const isSelf = (this.$route.params.id || this.currentAuthId) === this.currentAuthId
        this.dailyStreaksLoading = true
        if (!isSelf) {
          this.dailyStreaksItems = []
        } else {
          const mod = await import('../services/game-modes')
          const games = mod.getDailyGamesList()
          const rows = await Promise.all(games.map(async g => {
            const [cur, best] = await Promise.all([
              mod.fetchDailyWinStreak(g.slug).catch(() => 0),
              mod.fetchMaxDailyWinStreak(g.slug).catch(() => 0),
            ])
            return { slug: g.slug, name: g.name, current: cur || 0, best: best || 0 }
          }))
          // Order by best desc
          this.dailyStreaksItems = rows.sort((a,b) => (b.best||0) - (a.best||0))
        }
      } catch (e) {
        this.dailyStreaksItems = []
      } finally {
        this.dailyStreaksLoading = false
      }

      // Attempt to unlock special badges when viewing own profile
      try {
        const isSelf = (this.$route.params.id || this.currentAuthId) === this.currentAuthId
        const res = await checkAndUnlockSpecials(userId, this.xpByGame, this.maxStreaks, isSelf)
        const r = res?.results || {}
        const anyNew = [r.streak_dual_100, r.xp_multi_5k_3].some(x => x && x.data === true)
        if (anyNew) {
          const { data: ach } = await getUserAchievements(userId)
          this.achievements = ach || this.achievements
        }
      } catch {}

      // Refresh connection state when profile changes
      try { await this.refreshConn() } catch {}
      try { await this.loadConnections(userId) } catch {}
    }
    ,
    async refreshConn() {
      if (!this.user?.id) return
      try { this.conn = await getStatusWith(this.user.id) } catch {}
    },
    async onConnect() {
      if (!this.canConnect) return
      if (this.conn?.state === 'pending_in') { try { pushErrorToast('Abrí Notificaciones para responder') } catch {}; return }
      this.connBusy = true
      try { await sendRequest(this.user.id); await this.refreshConn() } catch (e) { try { pushErrorToast(e?.message || 'No se pudo conectar') } catch {} } finally { this.connBusy = false }
    },
    async onDisconnect() {
      if (!this.canConnect) return
      this.connBusy = true
      try { await disconnectWith(this.user.id); await this.refreshConn(); await this.loadConnections(this.user.id) } catch (e) { try { pushErrorToast(e?.message || 'No se pudo desconectar') } catch {} } finally { this.connBusy = false }
    },
    async loadConnections(userId) {
      this.connectionsLoading = true
      try {
        const { data: rows } = await listConnections(userId)
        const others = (rows||[]).map(r => (r.user_a===userId? r.user_b : r.user_a)).filter(Boolean)
        if (!others.length) { this.connectionsList = []; return }
        const { data: profiles } = await getPublicProfilesByIds(others)
        this.connectionsList = (profiles||[])
      } finally {
        this.connectionsLoading = false
      }
    }
  }
};
</script>

<template>
  <div class="mx-auto max-w-5xl pb-8">
    <div class="mb-4 flex items-center justify-between gap-2">
      <AppH1>{{ isSelf ? 'Mi Perfil' : 'Perfil' }}</AppH1>
      <div v-if="canConnect" class="flex items-center gap-2">
        <!-- When connected: show Disconnect -->
        <template v-if="conn.state==='connected'">
          <button @click="onDisconnect" :disabled="connBusy" class="rounded-full px-4 py-2 text-sm font-semibold border border-red-400/40 text-red-200 bg-red-500/10 hover:brightness-110">Desconectar</button>
        </template>
        <!-- When pending_out: allow cancel -->
        <template v-else-if="conn.state==='pending_out'">
          <button @click="onDisconnect" :disabled="connBusy" class="rounded-full px-4 py-2 text-sm font-semibold border border-amber-400/40 text-amber-200 bg-amber-500/10 hover:brightness-110">Cancelar solicitud</button>
        </template>
        <!-- Default: connect CTA -->
        <template v-else>
          <button @click="onConnect" :disabled="connectDisabled" class="rounded-full px-4 py-2 text-sm font-semibold border bg-[oklch(0.62_0.21_270)] border-white/10 text-white hover:brightness-110">Conectar</button>
        </template>
      </div>
    </div>

  <section class="grid gap-4 md:grid-cols-12">

      <!-- Columna izquierda: avatar, nombre, carrera, bio -->
      <div class="flex flex-col gap-4 md:col-span-8">
        <ProfileHeaderCard
          :avatar-initial="avatarInitial"
          :avatar-url="user.avatar_url"
          :display-name="displayName"
          :email="user.email"
          :nationality-code="user.nationality_code"
          :favorite-team="user.favorite_team"
          :favorite-player="user.favorite_player"
          :favorite-team-logo="favTeamLogo"
          :favorite-player-image="favPlayerImage"
          :socials="socials"
          :can-edit="isSelf"
          :career="user.career"
          :bio="user.bio"
        />
        <div v-if="canConnect" class="-mt-2 mb-2">
          <p v-if="conn.state==='pending_in'" class="text-xs text-slate-400">Tenés una solicitud de esta persona. Respondela desde Notificaciones.</p>
        </div>
  <AchievementsCard :achievements="achievements" :loading="achLoading" />
  <XpDonutChart
    :items="xpByGame"
    :streaks-by-game="streaksMap"
    :daily-best-by-name="Object.fromEntries((dailyStreaksItems||[]).map(r => [r.name, r.best]))"
    :loading="xpByGameLoading || maxStreaksLoading || dailyStreaksLoading" />
        <div class="rounded-lg border border-white/10 p-4">
          <p class="text-xs uppercase tracking-wide text-slate-400">Detalles del usuario</p>
          <ul class="mt-1 text-slate-300 text-sm space-y-1 list-disc list-inside">
            <li>Carrera: {{ user.career || '—' }}</li>
            <li>Compañía: —</li>
            <li>Localidad: —</li>
            <li>Social media: —</li>
            <li>Teléfono: —</li>
            <li>Work email: —</li>
          </ul>
        </div>
      </div>

      <!-- Columna derecha: nivel, XP, achievements y progreso -->
    <div class="flex flex-col gap-4 md:col-span-4">
  <ProgressCard :level-info="levelInfo" :loading="levelLoading" :xp-now="xpNow" :progress-percent="progressPercent" :achievements-count="achievements.length" />
  <ConnectionsCard :follower-count="followerCount" :following-count="followingCount" :group-count="groupCount" :connections="connectionsList" :loading="connectionsLoading" />
        <CommunityCard :forums-count="forumsCount" :messages-count="messagesCount" :discussions-started-count="discussionsStartedCount" />
      </div>
      
    </section>
  </div>
</template>