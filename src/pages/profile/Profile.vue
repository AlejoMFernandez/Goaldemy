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
import LoadoutShowcase from '../../components/profile/LoadoutShowcase.vue';
import ProfileIdentityCard from '../../components/profile/ProfileIdentityCard.vue';
import { findTeamByName, findPlayerByName } from '../../services/players';
import { getEquippedCosmetics, bannerStyle } from '../../services/cosmetics';
import { listConnections } from '../../services/connections';
import { getPublicProfilesByIds } from '../../services/user-profiles';

let unsubscribeAuth = () => {};

export default {
  name: 'Profile',
  components: { AppH1, ProfileHeaderCard, AchievementsCard, FeaturedAchievementsModal, XpDonutChart, ConnectionsCard, CommunityCard, LoadoutShowcase, ProfileIdentityCard },
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
    bannerClass() {
      return bannerStyle(this.equippedBannerKey)
    },
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
    socialIconSrc(type) {
      const t = (type || '').toLowerCase()
      if (t === 'linkedin') return '/social/linkedinmain.png'
      if (t === 'github') return '/social/githubmain.png'
      if (t === 'twitter' || t === 'x') return '/social/xmain.png'
      if (t === 'instagram') return '/social/igmain.png'
      return ''
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
  <div class="mx-auto max-w-6xl pb-12 px-4">
    <!-- Botones de conexión (solo en perfiles ajenos) -->
    <div v-if="canConnect" class="mb-4 flex items-center justify-end gap-2">
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

    <!-- Banner del usuario full-bleed (100% del ancho de pantalla, estilo Salesforce) -->
    <div class="relative h-36 sm:h-52 overflow-hidden w-screen left-1/2 -translate-x-1/2 -mt-10 lg:-mt-12" :class="[bannerClass, equippedBannerPremium ? 'anim-pan' : '']">
      <div class="absolute inset-0 overflow-hidden pointer-events-none">
        <div class="absolute top-5 right-12 w-28 h-28 rounded-full border-2 border-white/10 opacity-40"></div>
        <div class="absolute -bottom-6 right-32 w-20 h-20 rounded-full border border-white/10 opacity-30"></div>
        <div class="absolute top-8 left-[38%] w-12 h-12 rounded-full border border-white/5 opacity-20"></div>
      </div>
    </div>

    <!-- Dashboard 2 columnas (solapan el banner) -->
    <div class="-mt-16 relative z-10 grid grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)] gap-5 items-start">

      <!-- Columna izquierda (fija en desktop; top alto para que el avatar saliente no quede bajo el navbar) -->
      <div class="space-y-4 lg:sticky lg:top-28">
        <ProfileIdentityCard
          :avatar-initial="avatarInitial"
          :avatar-url="user.avatar_url"
          :display-name="displayName"
          :title-text="equippedTitleText"
          :title-rarity="equippedTitleRarity"
          :title-premium="equippedTitlePremium"
          :nationality-code="user.nationality_code"
          :frame-style-key="equippedFrameKey"
          :icon-glyph="equippedIconGlyph"
          :icon-bg-key="equippedIconBg"
          :frame-premium="equippedFramePremium"
          :level-info="levelInfo"
          :progress-percent="progressPercent"
          :xp-now="xpNow"
          :achievements-count="achievements.length"
          :top-rank="topRank"
          :bio="user.bio"
          :can-edit="isSelf"
        />

        <!-- Redes sociales -->
        <div v-if="socials.length" class="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/50 p-4">
          <div class="flex items-center gap-2.5 mb-3">
            <span class="w-1 h-5 rounded-full bg-gradient-to-b from-sky-400 to-blue-500"></span>
            <h3 class="font-display font-bold text-white">Redes</h3>
          </div>
          <div class="grid grid-cols-4 gap-2">
            <a v-for="so in socials" :key="so.type" :href="so.url" target="_blank" rel="noopener"
               class="aspect-square rounded-xl border border-white/10 bg-white/[0.03] grid place-items-center hover:bg-white/10 hover:border-white/25 hover:scale-105 transition" :title="so.type">
              <img :src="socialIconSrc(so.type)" :alt="so.type" class="w-7 h-7 object-contain" />
            </a>
          </div>
        </div>

        <!-- Favoritos -->
        <div v-if="user.favorite_player || user.favorite_team" class="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/50 p-4">
          <div class="flex items-center gap-2.5 mb-3">
            <span class="w-1 h-5 rounded-full bg-gradient-to-b from-emerald-400 to-cyan-500"></span>
            <h3 class="font-display font-bold text-white">Favoritos</h3>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div v-if="user.favorite_player" class="rounded-xl border border-white/10 bg-white/[0.03] p-3 flex flex-col items-center text-center gap-2">
              <div class="w-16 h-16 rounded-xl overflow-hidden bg-slate-800/50 grid place-items-center ring-1 ring-white/10">
                <img v-if="favPlayerImage" :src="favPlayerImage" alt="" class="h-full w-full object-cover" />
                <svg v-else class="w-6 h-6 text-slate-600" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/></svg>
              </div>
              <div class="min-w-0 w-full"><p class="text-[9px] uppercase tracking-wider text-emerald-400/70 font-semibold">Jugador</p><p class="text-xs text-white font-medium truncate">{{ user.favorite_player }}</p></div>
            </div>
            <div v-if="user.favorite_team" class="rounded-xl border border-white/10 bg-white/[0.03] p-3 flex flex-col items-center text-center gap-2">
              <div class="w-16 h-16 rounded-xl overflow-hidden bg-slate-800/50 grid place-items-center ring-1 ring-white/10">
                <img v-if="favTeamLogo" :src="favTeamLogo" alt="" class="h-full w-full object-contain p-1.5" />
                <svg v-else class="w-6 h-6 text-slate-600" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 2L3 7v6c0 3.5 3 6 7 9 4-3 7-5.5 7-9V7l-7-5z" clip-rule="evenodd"/></svg>
              </div>
              <div class="min-w-0 w-full"><p class="text-[9px] uppercase tracking-wider text-cyan-400/70 font-semibold">Equipo</p><p class="text-xs text-white font-medium truncate">{{ user.favorite_team }}</p></div>
            </div>
          </div>
        </div>

        <!-- Amistades -->
        <ConnectionsCard
          v-if="hasConnections || connectionsLoading"
          :follower-count="followerCount"
          :following-count="followingCount"
          :group-count="groupCount"
          :connections="connectionsList"
          :loading="connectionsLoading"
        />
      </div>

      <!-- Columna derecha (secciones) -->
      <div class="space-y-5 min-w-0">
        <!-- 1. Logros destacados -->
        <AchievementsCard
          :achievements="achievements"
          :loading="achLoading"
          :featured-codes="featuredAchievements"
          :is-self="isSelf"
          @customize="openFeaturedModal"
        />

        <!-- 2. Coleccionables destacados -->
        <LoadoutShowcase
          :frame-key="equippedFrameKey"
          :icon-glyph="equippedIconGlyph"
          :icon-bg="equippedIconBg"
          :title-text="equippedTitleText"
          :title-rarity="equippedTitleRarity"
          :banner-key="equippedBannerKey"
          :frame-premium="equippedFramePremium"
          :title-premium="equippedTitlePremium"
          :banner-premium="equippedBannerPremium"
          :is-self="isSelf"
        />

        <!-- 3. Juego más jugado / XP por juego -->
        <XpDonutChart
          :items="xpByGame"
          :streaks-by-game="streaksMap"
          :daily-best-by-name="Object.fromEntries((dailyStreaksItems||[]).map(r => [r.name, r.best]))"
          :loading="xpByGameLoading || maxStreaksLoading || dailyStreaksLoading"
        />

        <!-- 4. Mejores rachas -->
        <div v-if="hasStreaks" class="card p-6">
          <div class="flex items-center gap-2.5 mb-4">
            <span class="w-1 h-5 rounded-full bg-gradient-to-b from-amber-400 to-orange-500"></span>
            <h3 class="font-display font-bold text-white">Mejores rachas</h3>
          </div>
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

        <!-- Rachas diarias (visual: imagen del juego + 🔥 + números) -->
        <div v-if="dailyStreaksItems.some(r => r.best > 0)" class="card p-6">
          <div class="flex items-center gap-2.5 mb-4">
            <span class="w-1 h-5 rounded-full bg-gradient-to-b from-orange-400 to-red-500"></span>
            <h3 class="font-display font-bold text-white">Rachas diarias</h3>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div
              v-for="d in dailyStreaksItems.filter(r => r.best > 0)"
              :key="d.slug"
              class="flex items-center gap-3 rounded-xl border border-white/10 bg-gradient-to-br from-orange-500/[0.06] to-slate-900/40 p-3"
            >
              <div class="relative w-11 h-11 rounded-lg overflow-hidden bg-slate-800/60 grid place-items-center shrink-0 text-lg">
                🔥
                <img :src="`/games/${d.slug}.svg`" :alt="d.name" class="absolute inset-0 w-full h-full object-contain p-1 bg-slate-800/70" @error="$event.target.remove()" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-xs text-slate-300 truncate font-medium mb-0.5">{{ d.name }}</p>
                <div class="flex items-center gap-2.5">
                  <span class="inline-flex items-baseline gap-1 text-orange-300">
                    <span class="text-base">🔥</span>
                    <span class="font-display font-extrabold text-xl leading-none">{{ d.current }}</span>
                  </span>
                  <span class="text-[10px] text-slate-500">mejor <span class="text-amber-400 font-bold">{{ d.best }}</span></span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Comunidad -->
        <CommunityCard
          v-if="hasCommunityData"
          :forums-count="forumsCount"
          :messages-count="messagesCount"
          :discussions-started-count="discussionsStartedCount"
        />
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
