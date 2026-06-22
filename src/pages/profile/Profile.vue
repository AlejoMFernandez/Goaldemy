<script>
import AppH1 from '../../components/common/AppH1.vue';
import { subscribeToAuthStateChanges } from '../../services/auth';
import { getUserLevel, computeProgressPercentSync } from '../../services/xp';
import { getUserAchievements } from '../../services/achievements';
import { getUserXpByGame } from '../../services/games';
import { getPublicProfile, updateFeaturedAchievements } from '../../services/user-profiles';
import { getStatusWith, sendRequest, disconnectWith } from '../../services/connections';
import { pushErrorToast } from '../../stores/notifications';
import ProfileHeaderCard from '../../components/profile/ProfileHeaderCard.vue';
import AchievementsCard from '../../components/profile/AchievementsCard.vue';
import FeaturedAchievementsModal from '../../components/profile/FeaturedAchievementsModal.vue';
import XpDonutChart from '../../components/profile/XpDonutChart.vue';
import { getUserMaxStreakByGame } from '../../services/xp';
import { checkAndUnlockSpecials } from '../../services/special-badges';
import ConnectionsCard from '../../components/profile/ConnectionsCard.vue';
import CommunityCard from '../../components/profile/CommunityCard.vue';
import { findTeamByName, findPlayerByName } from '../../services/players';
import { getEquippedCosmetics } from '../../services/cosmetics';
import { listConnections } from '../../services/connections';
import { getPublicProfilesByIds } from '../../services/user-profiles';

let unsubscribeAuth = () => {};

export default {
  name: 'Profile',
  components: { AppH1, ProfileHeaderCard, AchievementsCard, FeaturedAchievementsModal, XpDonutChart, ConnectionsCard, CommunityCard },
  data() {
    return {
      user: {
        id: null,
        email: null,
        display_name: null,
        bio: null,
        career: null,
      },
      currentAuthId: null,
      levelInfo: null,
      equippedFrameKey: 'none',
      equippedTitleText: '',
      equippedTitleRarity: 'common',
      equippedIconGlyph: '',
      equippedBannerKey: 'default',
      equippedIconBg: 'emerald',
      equippedFramePremium: false,
      equippedTitlePremium: false,
      equippedBannerPremium: false,
      levelLoading: false,
      achievements: [],
      achLoading: false,
      xpByGame: [],
      xpByGameLoading: false,
      maxStreaks: [],
      maxStreaksLoading: false,
      streaksMap: {},
      dailyStreaksItems: [],
      dailyStreaksLoading: false,
      followerCount: 0,
      followingCount: 0,
      groupCount: 0,
      forumsCount: 0,
      messagesCount: 0,
      discussionsStartedCount: 0,
      favTeamLogo: '',
      favPlayerImage: '',
      socials: [],
      conn: { state: 'none', row: null },
      connBusy: false,
      connectionsList: [],
      connectionsLoading: false,
      topRank: null,
      _loading: false,
      _lastLoadedUserId: null,
      _debounceTimer: null,
      featuredAchievements: [],
      showFeaturedModal: false,
      activeTab: 'resumen',
    };
  },
  computed: {
    avatarInitial() {
      const name = this.user?.display_name?.trim()
      if (name) return name[0].toUpperCase()
      const email = this.user?.email?.trim()
      if (email) return email[0].toUpperCase()
      return '?'
    },
    displayName() {
      return this.user?.display_name || this.user?.email || '—';
    },
    progressPercent() {
      return computeProgressPercentSync(this.levelInfo);
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
    hasConnections() {
      return this.connectionsList.length > 0
    },
    hasCommunityData() {
      return this.forumsCount > 0 || this.messagesCount > 0 || this.discussionsStartedCount > 0
    },
    hasStreaks() {
      return this.maxStreaks.length > 0 || this.dailyStreaksItems.some(r => r.best > 0)
    },
  },
  mounted() {
    unsubscribeAuth = subscribeToAuthStateChanges(async (userState) => {
      this.currentAuthId = userState?.id || null
      this.ensureLoad()
    });
    this.ensureLoad()
    this.$watch(() => this.$route.params.id, () => this.ensureLoad())
  },
  unmounted() {
    unsubscribeAuth();
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
  },
  methods: {
    async ensureLoad() {
      if (this._debounceTimer) clearTimeout(this._debounceTimer);
      this._debounceTimer = setTimeout(() => this._doLoad(), 50);
    },
    async _doLoad() {
      const paramId = this.$route.params.id
      const targetId = paramId || this.currentAuthId
      if (this._loading || targetId === this._lastLoadedUserId) return;
      if (!targetId) {
        this.user = { id: null, email: null, display_name: null, bio: null, career: null }
        this.levelInfo = null
        this.achievements = []
        this.xpByGame = []
        this._lastLoadedUserId = null
        return
      }
      this._loading = true
      this._lastLoadedUserId = targetId
      await this.loadFor(targetId)
      this._loading = false
    },
    async loadFor(userId) {
      try {
        const { data: profile, error } = await getPublicProfile(userId)
        if (error) console.error('[Profile.vue] getPublicProfile error:', error)
        this.user = profile ? { ...profile, id: userId } : { id: userId }
        this.featuredAchievements = profile?.featured_achievements || []
        try {
          const team = this.user?.favorite_team ? findTeamByName(this.user.favorite_team) : null
          this.favTeamLogo = team?.logo || ''
        } catch {}
        try {
          const player = this.user?.favorite_player ? findPlayerByName(this.user.favorite_player) : null
          this.favPlayerImage = player?.image || ''
        } catch {}
        const s = []
        if (this.user?.linkedin_url) s.push({ type: 'linkedin', url: this.user.linkedin_url })
        if (this.user?.github_url) s.push({ type: 'github', url: this.user.github_url })
        if (this.user?.x_url) s.push({ type: 'twitter', url: this.user.x_url })
        if (this.user?.instagram_url) s.push({ type: 'instagram', url: this.user.instagram_url })
        this.socials = s
        const eq = await getEquippedCosmetics(userId)
        this.equippedFrameKey = eq.frameKey
        this.equippedTitleText = eq.titleText
        this.equippedTitleRarity = eq.titleRarity
        this.equippedIconGlyph = eq.iconGlyph
        this.equippedBannerKey = eq.bannerKey
        this.equippedIconBg = eq.iconBg
        this.equippedFramePremium = eq.framePremium
        this.equippedTitlePremium = eq.titlePremium
        this.equippedBannerPremium = eq.bannerPremium
      } catch (e) {
        console.error('[Profile.vue] getPublicProfile exception:', e)
        this.user = { id: userId }
      }

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

      try {
        const { getLeaderboard } = await import('../../services/xp')
        const { data: topData } = await getLeaderboard({ period: 'all_time', gameId: null, limit: 3, offset: 0 })
        const top = Array.isArray(topData) ? topData : (topData ? [topData] : [])
        const myRank = top.find(r => r.user_id === userId)
        this.topRank = myRank ? (myRank.rank ?? null) : null
      } catch {
        this.topRank = null
      }

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

      this.xpByGameLoading = true
      try {
        const { data: xpRows, error: xpErr } = await getUserXpByGame(userId)
        if (xpErr && !(xpErr.code === 'PGRST202' || /Could not find the function/i.test(xpErr.message || ''))) {
          console.error('load xp by game error:', xpErr)
        }
        this.xpByGame = xpRows || []
      } catch (e) {
        if (!(e?.code === 'PGRST202' || /Could not find the function/i.test(e?.message || ''))) {
          console.error('xp by game exception:', e)
        }
        this.xpByGame = []
      } finally {
        this.xpByGameLoading = false
      }

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

      try {
        const isSelf = (this.$route.params.id || this.currentAuthId) === this.currentAuthId
        this.dailyStreaksLoading = true
        if (!isSelf) {
          this.dailyStreaksItems = []
        } else {
          const mod = await import('../../services/game-modes')
          const games = mod.getDailyGamesList()
          const rows = await Promise.all(games.map(async g => {
            const [cur, best] = await Promise.all([
              mod.fetchDailyWinStreak(g.slug).catch(() => 0),
              mod.fetchMaxDailyWinStreak(g.slug).catch(() => 0),
            ])
            return { slug: g.slug, name: g.name, current: cur || 0, best: best || 0 }
          }))
          this.dailyStreaksItems = rows.sort((a,b) => (b.best||0) - (a.best||0))
        }
      } catch (e) {
        this.dailyStreaksItems = []
      } finally {
        this.dailyStreaksLoading = false
      }

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

      const isSelf = (this.$route.params.id || this.currentAuthId) === this.currentAuthId
      try { await this.loadConnections(userId) } catch {}
      if (!isSelf) {
        try { await this.refreshConn() } catch {}
      }
    },
    async refreshConn() {
      if (!this.user?.id) return
      try { this.conn = await getStatusWith(this.user.id) } catch {}
    },
    async onConnect() {
      if (!this.canConnect) return
      if (this.conn?.state === 'pending_in') { try { pushErrorToast('Abri Notificaciones para responder') } catch {}; return }
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
    },
    openFeaturedModal() {
      this.showFeaturedModal = true
    },
    closeFeaturedModal() {
      this.showFeaturedModal = false
    },
    async saveFeaturedAchievements(codes) {
      try {
        await updateFeaturedAchievements(this.currentAuthId, codes)
        this.featuredAchievements = codes
        this.showFeaturedModal = false
        const { pushSuccessToast } = await import('../../stores/notifications')
        pushSuccessToast('Logros destacados actualizados')
      } catch (e) {
        console.error('save featured achievements error:', e)
        const { pushErrorToast } = await import('../../stores/notifications')
        pushErrorToast('Error al guardar logros destacados')
      }
    },
  }
};
</script>

<template>
  <div class="mx-auto max-w-4xl pb-12 px-4">
    <!-- Page heading + connect buttons -->
    <div class="mb-6 flex items-center justify-between gap-4">
      <div>
        <AppH1 class="!mb-1">{{ isSelf ? 'Mi Perfil' : 'Perfil' }}</AppH1>
        <p class="text-sm text-slate-400">{{ isSelf ? 'Tu progreso y logros' : 'Informacion del usuario' }}</p>
      </div>
      <div v-if="canConnect" class="flex items-center gap-2">
        <template v-if="conn.state==='connected'">
          <button @click="$router.push('/messages/' + user.id)"
            class="rounded-xl px-4 py-2.5 text-sm font-semibold border border-emerald-400/30 text-white bg-emerald-500/20 hover:bg-emerald-500/30 transition-all shadow-lg hover:shadow-emerald-500/20">
            Mensaje
          </button>
          <button @click="onDisconnect" :disabled="connBusy"
            class="rounded-xl px-4 py-2.5 text-sm font-semibold border border-red-400/30 text-red-200 bg-red-500/10 hover:bg-red-500/20 transition-all">
            Desconectar
          </button>
        </template>
        <template v-else-if="conn.state==='pending_out'">
          <button @click="onDisconnect" :disabled="connBusy"
            class="rounded-xl px-4 py-2.5 text-sm font-semibold border border-amber-400/30 text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 transition-all">
            Cancelar solicitud
          </button>
        </template>
        <template v-else>
          <button @click="onConnect" :disabled="connectDisabled"
            class="rounded-xl px-4 py-2.5 text-sm font-semibold border border-emerald-400/30 bg-emerald-500/20 text-white hover:bg-emerald-500/30 transition-all shadow-lg hover:shadow-emerald-500/20">
            Conectar
          </button>
        </template>
      </div>
    </div>

    <!-- Pending connection banner -->
    <div v-if="canConnect && conn.state==='pending_in'"
      class="rounded-xl border border-amber-400/30 bg-amber-500/10 backdrop-blur p-4 mb-6">
      <p class="text-sm text-amber-200 flex items-center gap-2">
        <svg class="w-5 h-5 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
        </svg>
        Tenes una solicitud de esta persona. Respondela desde Notificaciones.
      </p>
    </div>

    <!-- Hero header with fused progress -->
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
      :level-info="levelInfo"
      :progress-percent="progressPercent"
      :xp-now="xpNow"
      :achievements-count="achievements.length"
      :top-rank="topRank"
      :frame-style-key="equippedFrameKey"
      :title-text="equippedTitleText"
      :title-rarity="equippedTitleRarity"
      :icon-glyph="equippedIconGlyph"
      :banner-key="equippedBannerKey"
      :icon-bg-key="equippedIconBg"
      :frame-premium="equippedFramePremium"
      :title-premium="equippedTitlePremium"
      :banner-premium="equippedBannerPremium"
    />

    <!-- Tab bar -->
    <div class="mt-6 flex gap-1 rounded-xl border border-white/10 bg-slate-900/50 p-1">
      <button
        v-for="tab in [
          { key: 'resumen', label: 'Resumen' },
          { key: 'logros', label: 'Logros' },
          { key: 'estadisticas', label: 'Estadisticas' },
        ]"
        :key="tab.key"
        @click="activeTab = tab.key"
        class="flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all"
        :class="activeTab === tab.key
          ? 'bg-white/10 text-white shadow-sm'
          : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'"
      >{{ tab.label }}</button>
    </div>

    <!-- Tab: Resumen -->
    <div v-if="activeTab === 'resumen'" class="mt-6 space-y-6">
      <XpDonutChart
        :items="xpByGame"
        :streaks-by-game="streaksMap"
        :daily-best-by-name="Object.fromEntries((dailyStreaksItems||[]).map(r => [r.name, r.best]))"
        :loading="xpByGameLoading || maxStreaksLoading || dailyStreaksLoading"
      />

      <ConnectionsCard
        v-if="hasConnections || connectionsLoading"
        :follower-count="followerCount"
        :following-count="followingCount"
        :group-count="groupCount"
        :connections="connectionsList"
        :loading="connectionsLoading"
      />

      <CommunityCard
        v-if="hasCommunityData"
        :forums-count="forumsCount"
        :messages-count="messagesCount"
        :discussions-started-count="discussionsStartedCount"
      />
    </div>

    <!-- Tab: Logros -->
    <div v-if="activeTab === 'logros'" class="mt-6">
      <AchievementsCard
        :achievements="achievements"
        :loading="achLoading"
        :featured-codes="featuredAchievements"
        :is-self="isSelf"
        @customize="openFeaturedModal"
      />
    </div>

    <!-- Tab: Estadisticas -->
    <div v-if="activeTab === 'estadisticas'" class="mt-6 space-y-6">
      <!-- Max streaks by game -->
      <div v-if="hasStreaks" class="card p-6">
        <p class="text-xs uppercase tracking-wide text-slate-400 mb-4">Mejores rachas por juego</p>
        <div class="space-y-3">
          <div v-for="s in maxStreaks" :key="s.id" class="flex items-center gap-3">
            <span class="text-sm text-slate-300 w-36 truncate shrink-0">{{ s.name }}</span>
            <div class="flex-1 h-5 bg-slate-800/50 rounded-full overflow-hidden border border-white/5">
              <div
                class="h-full rounded-full bg-gradient-to-r from-amber-500/80 to-orange-500/80 transition-all duration-500 flex items-center justify-end pr-2"
                :style="{ width: Math.max(12, Math.min(100, (s.streak / Math.max(...maxStreaks.map(x => x.streak || 1))) * 100)) + '%' }"
              >
                <span class="text-[10px] font-bold text-white drop-shadow">{{ s.streak }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Daily streaks -->
      <div v-if="dailyStreaksItems.some(r => r.best > 0)" class="card p-6">
        <p class="text-xs uppercase tracking-wide text-slate-400 mb-4">Rachas diarias</p>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div
            v-for="d in dailyStreaksItems.filter(r => r.best > 0)"
            :key="d.slug"
            class="rounded-xl border border-white/10 bg-gradient-to-br from-slate-800/60 to-slate-700/40 p-3.5"
          >
            <p class="text-[10px] uppercase tracking-wider text-slate-500 mb-1 truncate">{{ d.name }}</p>
            <div class="flex items-baseline gap-2">
              <span class="text-xl font-bold text-white">{{ d.current }}</span>
              <span class="text-[10px] text-slate-500">actual</span>
            </div>
            <div class="flex items-baseline gap-2 mt-0.5">
              <span class="text-sm font-semibold text-amber-400">{{ d.best }}</span>
              <span class="text-[10px] text-slate-500">mejor</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-if="!hasStreaks && !dailyStreaksLoading && !maxStreaksLoading" class="card p-8 text-center">
        <svg class="w-12 h-12 mx-auto text-slate-700 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
        <p class="text-slate-500 text-sm">Juga partidas para ver tus estadisticas</p>
      </div>
    </div>

    <!-- Featured Achievements Modal -->
    <FeaturedAchievementsModal
      v-if="showFeaturedModal"
      :achievements="achievements"
      :current-featured="featuredAchievements"
      @save="saveFeaturedAchievements"
      @cancel="closeFeaturedModal"
    />
  </div>
</template>
